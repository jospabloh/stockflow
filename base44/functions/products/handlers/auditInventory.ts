import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';
import { classifyProduct, fetchAll, type DiscrepancyEntry, type Row } from './_inventoryAudit.ts';

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

    const discrepancies: DiscrepancyEntry[] = [];
    for (const product of products) {
      const d = classifyProduct(product, movementsByProduct.get(product.id) || [], auditLogs);
      if (d) discrepancies.push(d);
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
