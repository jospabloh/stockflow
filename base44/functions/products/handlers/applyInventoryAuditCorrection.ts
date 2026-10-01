import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Aplica la corrección decidida por el admin durante la auditoría de inventario.
 *
 * Acciones:
 *   accept_current   — acepta el stock actual como correcto y registra la reconciliación
 *   revert_to_calculated — revierte product.stock al valor calculado desde movimientos
 *
 * En ambos casos:
 *   - Se crea un movimiento de tipo 'adjustment' como registro contable
 *   - Se crea una entrada en InventoryAuditLog con event_type 'system_correction'
 */

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Solo administradores pueden aplicar correcciones de auditoría' }, { status: 403 });
    }

    // DESHABILITADA por regla de JP: el stock pasado NO se modifica, solo se reporta.
    // Esta action ya no escribe nada (ni Product, ni Movement, ni InventoryAuditLog).
    // Rehabilitarla requiere un PR aparte aprobado explicitamente: recalcular expected_stock
    // en el servidor (misma logica que auditInventory) y rechazar no_movements/legacy_bug.
    return Response.json(
      { error: 'Las correcciones de auditoria estan deshabilitadas: el stock historico solo se reporta, no se modifica. Usa Movimientos -> Ajuste.', code: 'audit_correction_disabled' },
      { status: 403 },
    );

    const body = await req.json().catch(() => ({}));
    const { product_id, action, expected_stock, notes } = body as {
      product_id?: string;
      action?: 'accept_current' | 'revert_to_calculated';
      expected_stock?: number;
      notes?: string;
    };

    if (!product_id) {
      return Response.json({ error: 'product_id es requerido' }, { status: 400 });
    }
    if (action !== 'accept_current' && action !== 'revert_to_calculated') {
      return Response.json({ error: 'action debe ser accept_current o revert_to_calculated' }, { status: 400 });
    }
    if (expected_stock === undefined || expected_stock === null) {
      return Response.json({ error: 'expected_stock es requerido' }, { status: 400 });
    }

    // Validate product ownership
    const products = await base44.asServiceRole.entities.Product.filter({ id: product_id });
    if (!products || products.length === 0) {
      return Response.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    const product = products[0];

    if (product.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentStock = product.stock ?? 0;
    const businessId = user.business_id;

    let finalStock: number;
    let movementReason: string;
    let auditNotes: string;

    if (action === 'accept_current') {
      finalStock = currentStock;
      movementReason = 'Reconciliación de auditoría — stock actual aceptado por admin';
      auditNotes = notes || `Admin aceptó el stock actual (${currentStock}) como correcto. Stock calculado era ${expected_stock}.`;
    } else {
      finalStock = expected_stock;
      movementReason = 'Reconciliación de auditoría — revertido a stock calculado por movimientos';
      auditNotes = notes || `Admin corrigió el stock de ${currentStock} a ${expected_stock} (valor calculado por historial de movimientos).`;
    }

    // For revert_to_calculated: update product stock first
    if (action === 'revert_to_calculated' && finalStock !== currentStock) {
      await base44.asServiceRole.entities.Product.update(product_id, { stock: finalStock });
    }

    // Create a reconciliation adjustment movement for the audit trail.
    // El stock final ya quedó fijado arriba (o se mantiene el actual), por eso
    // se marca stock_applied=true: es un registro de auditoría que no debe
    // volver a modificar el stock vía applyMovementStock/automatización.
    // quantity = delta needed to reach finalStock (can be 0 for accept_current)
    const delta = finalStock - currentStock;
    await base44.asServiceRole.entities.Movement.create({
      product_id,
      product_name: product.name,
      type: 'adjustment',
      quantity: delta,
      unit_price: 0,
      total: 0,
      stock_after: finalStock,
      reason: movementReason,
      business_id: businessId,
      stock_applied: true,
    });

    // Log the correction to InventoryAuditLog
    await base44.asServiceRole.entities.InventoryAuditLog.create({
      product_id,
      product_name: product.name,
      business_id: businessId,
      event_type: 'system_correction',
      stock_before: currentStock,
      stock_after: finalStock,
      notes: auditNotes,
      performed_by: user.email,
    });

    return Response.json({
      success: true,
      product_id,
      product_name: product.name,
      action,
      stock_before: currentStock,
      stock_after: finalStock,
    });
  } catch (error) {
    console.log(`[AUDIT-CORRECTION] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
