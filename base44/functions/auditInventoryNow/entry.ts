import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Auditoría real de inventario.
 *
 * Por cada producto compara product.stock contra el último stock_after registrado
 * en los movimientos. Si difieren, clasifica la discrepancia y explica la causa
 * usando el historial de InventoryAuditLog.
 *
 * Razones posibles:
 *   direct_edit   — el admin cambió el stock directamente (sin movimiento)
 *   sync_error    — discrepancia sin explicación en el audit log
 *   no_movements  — producto sin ningún movimiento registrado
 *   legacy_bug    — diferencia explicable por el bug de doble conteo pre-2026-04-20
 */

const BUG_FIX_DATE = '2026-04-20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Solo administradores pueden ejecutar la auditoría' }, { status: 403 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'business_id requerido' }, { status: 400 });
    }

    const [products, allMovements, auditLogs] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ business_id: businessId }, 'name', 2000),
      base44.asServiceRole.entities.Movement.filter({ business_id: businessId }, 'created_date', 5000),
      base44.asServiceRole.entities.InventoryAuditLog.filter({ business_id: businessId }, 'created_date', 2000).catch(() => []),
    ]);

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
      const productMovements = allMovements
        .filter(m => m.product_id === product.id)
        .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));

      if (productMovements.length === 0) {
        // No movements — product.stock should be the initial value set at creation
        // Only flag if stock != 0 (unexpected non-zero stock with no movement history)
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

      // Find the most recent movement with stock_after set — that's our checkpoint
      const movementsWithCheckpoint = [...productMovements]
        .reverse()
        .filter(m => m.stock_after != null);

      const checkpoint = movementsWithCheckpoint[0] ?? null;
      const expectedStock = checkpoint ? (checkpoint.stock_after as number) : 0;
      const currentStock = product.stock ?? 0;

      if (currentStock === expectedStock) continue;

      const difference = currentStock - expectedStock;
      const checkpointDate = checkpoint?.created_date ?? '';

      // Look for movements after the checkpoint that lack stock_after (could explain partial difference)
      const uncheckedMovements = checkpoint
        ? productMovements.filter(m => (m.created_date || '') > checkpointDate && m.stock_after == null)
        : [];

      let adjustedExpected = expectedStock;
      for (const m of uncheckedMovements) {
        if (m.type === 'entry') adjustedExpected += (m.quantity || 0);
        else if (m.type === 'exit' || m.type === 'return') adjustedExpected -= (m.quantity || 0);
        else if (m.type === 'adjustment') adjustedExpected += (m.quantity || 0);
      }
      adjustedExpected = Math.max(0, adjustedExpected);

      if (currentStock === adjustedExpected) continue;

      // Check audit log for direct edits after the checkpoint
      const relevantAuditLogs = auditLogs
        .filter(l => l.product_id === product.id && (!checkpointDate || (l.created_date || '') > checkpointDate))
        .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));

      const netDirectEditChange = relevantAuditLogs.reduce((acc, l) => {
        return acc + ((l.stock_after ?? 0) - (l.stock_before ?? 0));
      }, 0);

      // Check if this is a legacy bug discrepancy (pre-fix movements without quotation_id)
      const buggyMovements = productMovements.filter(
        m => (m.created_date || '').slice(0, 10) < BUG_FIX_DATE && !m.quotation_id
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
        audit_log_entries: relevantAuditLogs.map(l => ({
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
      summary: {
        products_audited: products.length,
        discrepancies: discrepancies.length,
        by_reason: {
          direct_edit: discrepancies.filter(d => d.reason_type === 'direct_edit').length,
          sync_error: discrepancies.filter(d => d.reason_type === 'sync_error').length,
          no_movements: discrepancies.filter(d => d.reason_type === 'no_movements').length,
          legacy_bug: discrepancies.filter(d => d.reason_type === 'legacy_bug').length,
        },
      },
      discrepancies,
    });
  } catch (error) {
    console.log(`[AUDIT-INVENTORY] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
