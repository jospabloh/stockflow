/**
 * Lógica pura de la auditoría de inventario, compartida por `auditInventory`
 * (solo lectura) y `applyInventoryAuditCorrection` (que la RECALCULA en el
 * servidor en vez de fiarse del `expected_stock` que manda el cliente).
 */

export const BUG_FIX_DATE = '2026-04-20';

// deno-lint-ignore no-explicit-any
export type Row = Record<string, any>;

const PAGE_SIZE = 500;
const MAX_PAGES = 200; // tope de seguridad: 100 000 registros por entidad

// Lee TODAS las filas que cumplen la consulta, paginando con skip. Sustituye
// los topes fijos de la versión original (Movement 5000, Product/Log 2000),
// que truncaban en silencio a los tenants grandes.
export async function fetchAll(
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

export type DiscrepancyReason = 'direct_edit' | 'sync_error' | 'no_movements' | 'legacy_bug';

export type DiscrepancyEntry = {
  product_id: string;
  product: string;
  current_stock: number;
  expected_stock: number;
  difference: number;
  reason_type: DiscrepancyReason;
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

/** Motivos que una persona puede corregir desde la auditoría. */
export const CORRECTABLE_REASONS: DiscrepancyReason[] = ['direct_edit', 'sync_error'];

/**
 * Compara product.stock contra el último stock_after de sus movimientos.
 * Devuelve la discrepancia, o null si el stock cuadra. `productMovements` y
 * `auditLogs` deben ser del mismo tenant; `auditLogs` puede incluir otros productos.
 */
export function classifyProduct(product: Row, productMovementsRaw: Row[], auditLogs: Row[]): DiscrepancyEntry | null {
  const productMovements = productMovementsRaw
    .slice()
    .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));

  if (productMovements.length === 0) {
    if ((product.stock ?? 0) !== 0) {
      return {
        product_id: product.id,
        product: product.name,
        current_stock: product.stock ?? 0,
        expected_stock: 0,
        difference: product.stock ?? 0,
        reason_type: 'no_movements',
        reason_detail: `El producto tiene stock ${product.stock} pero no hay movimientos registrados. El stock puede haber sido asignado directamente al crear o editar el producto.`,
        // Sin historial no hay nada contra qué recalcular: se ajusta con un movimiento manual.
        can_auto_correct: false,
        audit_log_entries: [],
      };
    }
    return null;
  }

  const checkpoint = [...productMovements].reverse().find((m) => m.stock_after != null) ?? null;
  const expectedStock = checkpoint ? (checkpoint.stock_after as number) : 0;
  const currentStock = product.stock ?? 0;

  if (currentStock === expectedStock) return null;

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

  if (currentStock === adjustedExpected) return null;

  const relevantAuditLogs = auditLogs
    .filter((l) => l.product_id === product.id && (l.event_type ?? 'direct_edit') === 'direct_edit' && (!checkpointDate || (l.created_date || '') > checkpointDate))
    .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));

  const netDirectEditChange = relevantAuditLogs.reduce(
    (acc, l) => acc + ((l.stock_after ?? 0) - (l.stock_before ?? 0)),
    0,
  );

  const buggyMovements = productMovements.filter(
    (m) => (m.created_date || '').slice(0, 10) < BUG_FIX_DATE && !m.quotation_id,
  );
  const isLikelyLegacyBug = buggyMovements.length > 0 && relevantAuditLogs.length === 0;

  let reason_type: DiscrepancyReason;
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

  return {
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
  };
}
