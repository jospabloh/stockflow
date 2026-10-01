import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';

/**
 * auditInventory — auditoría de inventario del tenant (SOLO LECTURA).
 *
 * Restaura la antigua función `auditInventoryNow` (borrada por error en ec0139e
 * junto con funciones de depuración; el botón "Auditar inventario" de Ajustes
 * quedó llamando a un endpoint inexistente). Ahora es una action del router
 * `products`, así que no ocupa un slot de función nuevo.
 *
 * Por cada producto del tenant compara product.stock contra el último stock_after
 * de sus Movement y clasifica cada diferencia:
 *   direct_edit   — el stock cambió por edición directa (hay InventoryAuditLog posterior)
 *   sync_error    — diferencia sin explicación registrada
 *   no_movements  — stock != 0 sin ningún movimiento
 *   legacy_bug    — posible doble conteo previo a 2026-04-20
 *
 * NUNCA escribe: no modifica Product, Movement ni ningún otro dato. Solo informa.
 * Las correcciones las decide una persona y pasan por applyInventoryAuditCorrection.
 *
 * Autorización: permiso Configuracion:audit_inventory (owner/admin del negocio
 * y platform owner siempre; otros roles según su PermissionProfile).
 */

const BUG_FIX_DATE = '2026-04-20';
const PAGE_SIZE = 500;
const MAX_PAGES = 200; // tope de seguridad: 100 000 registros por entidad

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// Lee TODAS las filas que cumplen la consulta, paginando con skip. Sustituye
// los topes fijos de la versión original (Movement 5000, Product/Log 2000),
// que truncaban en silencio a los tenants grandes.
async function fetchAll(
  entity: { filter: (q: Row, sort?: string, limit?: number, skip?: number) => Promise<Row[]> },
  query: Row,
  sort: string,
): Promise<{ rows: Row[]; truncated: boolean }> {
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const chunk = (await entity.filter(query, sort, PAGE_SIZE, page * PAGE_SIZE)) || [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const allowed = await hasPermission(base44.asServiceRole, user, 'Configuracion', 'audit_inventory');
    if (!allowed) {
      return Response.json({ error: 'No tienes permiso para ejecutar la auditoría de inventario' }, { status: 403 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'business_id requerido' }, { status: 400 });
    }

    const [productsRes, movementsRes, logsRes] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.Product, { business_id: businessId }, 'name'),
      fetchAll(base44.asServiceRole.entities.Movement, { business_id: businessId }, 'created_date'),
      fetchAll(base44.asServiceRole.entities.InventoryAuditLog, { business_id: businessId }, 'created_date')
        .catch(() => ({ rows: [] as Row[], truncated: false })),
    ]);
    const products = productsRes.rows;
    const allMovements = movementsRes.rows;
    const auditLogs = logsRes.rows;

    // Agrupar una sola vez por producto (evita O(productos x movimientos)).
    const movementsByProduct = new Map<string, Row[]>();
    for (const m of allMovements) {
      if (!m.product_id) continue;
      const arr = movementsByProduct.get(m.product_id);
      if (arr) arr.push(m); else movementsByProduct.set(m.product_id, [m]);
    }

    type DiscrepancyEntry = {
      product_id: string;
      product: string;
      current_stock: number;
      expected_stock: number;
      difference: number;
      reason_type: 'direct_edit' | 'sync_error' | 'no_movements' | 'legacy_bug';
      reason_detail: string;
      can_auto_correct: boolean;
      audit_log_entries: Array<{
        event_type: string;
        stock_before: number;
        stock_after: number;
        notes: string;
        performed_by: string;
        created_date: string;
      }>;
    };

    const discrepancies: DiscrepancyEntry[] = [];

    for (const product of products) {
      const productMovements = (movementsByProduct.get(product.id) || [])
        .slice()
        .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));

      if (productMovements.length === 0) {
        if ((product.stock ?? 0) !== 0) {
          discrepancies.push({
            product_id: product.id,
            product: product.name,
            current_stock: product.stock ?? 0,
            expected_stock: 0,
            difference: product.stock ?? 0,
            reason_type: 'no_movements',
            reason_detail: `El producto tiene stock ${product.stock} pero no hay movimientos registrados. El stock puede haber sido asignado directamente al crear o editar el producto.`,
            can_auto_correct: true,
            audit_log_entries: [],
          });
        }
        continue;
      }

      const checkpoint = [...productMovements].reverse().find((m) => m.stock_after != null) ?? null;
      const expectedStock = checkpoint ? (checkpoint.stock_after as number) : 0;
      const currentStock = product.stock ?? 0;

      if (currentStock === expectedStock) continue;

      const difference = currentStock - expectedStock;
      const checkpointDate = checkpoint?.created_date ?? '';

      const uncheckedMovements = checkpoint
        ? productMovements.filter((m) => (m.created_date || '') > checkpointDate && m.stock_after == null)
        : [];

      let adjustedExpected = expectedStock;
      for (const m of uncheckedMovements) {
        if (m.type === 'entry') adjustedExpected += (m.quantity || 0);
        else if (m.type === 'exit' || m.type === 'return') adjustedExpected -= (m.quantity || 0);
        else if (m.type === 'adjustment') adjustedExpected += (m.quantity || 0);
      }
      adjustedExpected = Math.max(0, adjustedExpected);

      if (currentStock === adjustedExpected) continue;

      const relevantAuditLogs = auditLogs
        .filter((l) => l.product_id === product.id && (!checkpointDate || (l.created_date || '') > checkpointDate))
        .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));

      const netDirectEditChange = relevantAuditLogs.reduce(
        (acc, l) => acc + ((l.stock_after ?? 0) - (l.stock_before ?? 0)),
        0,
      );

      const buggyMovements = productMovements.filter(
        (m) => (m.created_date || '').slice(0, 10) < BUG_FIX_DATE && !m.quotation_id,
      );
      const isLikelyLegacyBug = buggyMovements.length > 0 && relevantAuditLogs.length === 0;

      let reason_type: DiscrepancyEntry['reason_type'];
      let reason_detail: string;
      let can_auto_correct = true;

      if (relevantAuditLogs.length > 0) {
        reason_type = 'direct_edit';
        const editsCount = relevantAuditLogs.length;
        const netChange = netDirectEditChange >= 0 ? `+${netDirectEditChange}` : `${netDirectEditChange}`;
        reason_detail = `Stock editado directamente ${editsCount} ${editsCount === 1 ? 'vez' : 'veces'} sin crear un movimiento de inventario (cambio neto: ${netChange} uds). Último editor: ${relevantAuditLogs[relevantAuditLogs.length - 1].performed_by || 'desconocido'}.`;
      } else if (isLikelyLegacyBug) {
        reason_type = 'legacy_bug';
        reason_detail = `Posible discrepancia por el bug de doble-conteo detectado antes del ${BUG_FIX_DATE}. ${buggyMovements.length} movimiento(s) manual(es) aplicado(s) antes de la corrección. Usa "Verificar stock (bug histórico)" si necesitas corregir específicamente ese bug.`;
        can_auto_correct = false;
      } else {
        reason_type = 'sync_error';
        reason_detail = `Discrepancia de ${Math.abs(currentStock - adjustedExpected)} uds sin explicación registrada. El stock actual (${currentStock}) no coincide con lo esperado por el historial de movimientos (${adjustedExpected}). Puede ser un error de sincronización.`;
      }

      discrepancies.push({
        product_id: product.id,
        product: product.name,
        current_stock: currentStock,
        expected_stock: adjustedExpected,
        difference,
        reason_type,
        reason_detail,
        can_auto_correct,
        audit_log_entries: relevantAuditLogs.map((l) => ({
          event_type: l.event_type,
          stock_before: l.stock_before ?? 0,
          stock_after: l.stock_after ?? 0,
          notes: l.notes || '',
          performed_by: l.performed_by || '',
          created_date: l.created_date || '',
        })),
      });
    }

    return Response.json({
      audited_at: new Date().toISOString(),
      business_id: businessId,
      read_only: true,
      truncated: productsRes.truncated || movementsRes.truncated || logsRes.truncated,
      summary: {
        products_audited: products.length,
        discrepancies: discrepancies.length,
        by_reason: {
          direct_edit: discrepancies.filter((d) => d.reason_type === 'direct_edit').length,
          sync_error: discrepancies.filter((d) => d.reason_type === 'sync_error').length,
          no_movements: discrepancies.filter((d) => d.reason_type === 'no_movements').length,
          legacy_bug: discrepancies.filter((d) => d.reason_type === 'legacy_bug').length,
        },
      },
      discrepancies,
    });
  } catch (error) {
    console.log(`[AUDIT-INVENTORY] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
