import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { classifyProduct, CORRECTABLE_REASONS, fetchAll, type Row } from './_inventoryAudit.ts';

/**
 * Aplica UNA corrección de inventario decidida por una persona desde la auditoría.
 * Nunca corre en automático.
 *
 * Contrato (el router `products` despacha por body.action; el modo viaja en body.mode):
 *   { action: 'applyInventoryAuditCorrection',
 *     product_id,
 *     mode: 'accept_current' | 'revert_to_calculated',
 *     expected_stock,   // el valor calculado que la persona vio y confirmó
 *     current_stock,    // el stock actual que la persona vio y confirmó
 *     reason,           // motivo (obligatorio)
 *     confirm: true }   // confirmación explícita (obligatoria)
 *
 *   accept_current       — acepta el stock actual como correcto (no cambia Product.stock)
 *   revert_to_calculated — fija Product.stock al valor calculado desde los movimientos
 *
 * Seguridad:
 *   - Solo owner/admin del negocio, y solo sobre productos de SU negocio
 *     (el business_id sale de la sesión, nunca del body).
 *   - El valor calculado se RECALCULA en el servidor con la misma lógica que
 *     auditInventory; si lo que la persona vio ya no coincide (409) o el caso no es
 *     corregible (no_movements / legacy_bug) no se escribe nada.
 *
 * Registro: cada corrección crea un Movement 'adjustment' (stock_applied=true, ya fija
 * el stock) y una fila en InventoryAuditLog (event_type 'system_correction') con
 * quién (performed_by = email), cuándo (created_date), antes (stock_before),
 * después (stock_after) y motivo (notes). Si el registro falla, se revierte el stock.
 */

const MODES = ['accept_current', 'revert_to_calculated'] as const;
type Mode = typeof MODES[number];
const MIN_REASON = 3;
const MAX_REASON = 500;

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Solo el owner o un admin del negocio pueden aplicar correcciones de auditoría' }, { status: 403 });
    }
    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'business_id requerido' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({})) as Row;
    const { product_id, mode, expected_stock, current_stock, confirm } = body;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!product_id || typeof product_id !== 'string') {
      return Response.json({ error: 'product_id es requerido' }, { status: 400 });
    }
    if (!MODES.includes(mode)) {
      return Response.json({ error: 'mode debe ser accept_current o revert_to_calculated' }, { status: 400 });
    }
    if (confirm !== true) {
      return Response.json(
        { error: 'Se requiere confirmación explícita (confirm: true) para corregir el inventario', code: 'confirmation_required' },
        { status: 400 },
      );
    }
    if (reason.length < MIN_REASON) {
      return Response.json({ error: `El motivo es obligatorio (mínimo ${MIN_REASON} caracteres)`, code: 'reason_required' }, { status: 400 });
    }
    if (typeof expected_stock !== 'number' || !Number.isFinite(expected_stock) ||
        typeof current_stock !== 'number' || !Number.isFinite(current_stock)) {
      return Response.json({ error: 'expected_stock y current_stock deben ser números' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const products = await sr.entities.Product.filter({ id: product_id });
    const product = products?.[0];
    if (!product) {
      return Response.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    // Solo su propio tenant.
    if (product.business_id !== businessId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Recalcular en el servidor: no se confía en lo que manda el cliente.
    const movements = await fetchAll(sr.entities.Movement, { business_id: businessId, product_id }, 'created_date');
    const logs = await fetchAll(sr.entities.InventoryAuditLog, { business_id: businessId, product_id }, 'created_date')
      .catch(() => ({ rows: [] as Row[], truncated: false }));
    if (movements.truncated) {
      return Response.json({ error: 'Historial demasiado grande para recalcular; usa Movimientos → Ajuste', code: 'not_correctable' }, { status: 409 });
    }
    const discrepancy = classifyProduct(product, movements.rows, logs.rows);

    if (!discrepancy) {
      return Response.json({ error: 'El stock de este producto ya cuadra con sus movimientos; no hay nada que corregir', code: 'no_discrepancy' }, { status: 409 });
    }
    if (!CORRECTABLE_REASONS.includes(discrepancy.reason_type)) {
      return Response.json(
        { error: 'Este caso no se corrige desde la auditoría; usa Movimientos → Ajuste', code: 'not_correctable', reason_type: discrepancy.reason_type },
        { status: 409 },
      );
    }
    if (discrepancy.expected_stock !== expected_stock || discrepancy.current_stock !== current_stock) {
      return Response.json(
        {
          error: 'Los datos cambiaron desde que se ejecutó la auditoría; vuelve a auditar antes de corregir',
          code: 'stale_audit',
          current_stock: discrepancy.current_stock,
          expected_stock: discrepancy.expected_stock,
        },
        { status: 409 },
      );
    }

    const currentStock = discrepancy.current_stock;
    const finalStock = (mode as Mode) === 'accept_current' ? currentStock : discrepancy.expected_stock;
    const delta = finalStock - currentStock;
    const clipped = reason.slice(0, MAX_REASON);
    const movementReason = mode === 'accept_current'
      ? 'Reconciliación de auditoría — stock actual aceptado'
      : 'Reconciliación de auditoría — corregido al stock calculado por movimientos';

    let stockUpdated = false;
    let movementId: string | null = null;
    try {
      if (delta !== 0) {
        await sr.entities.Product.update(product_id, { stock: finalStock });
        stockUpdated = true;
      }
      // Registro contable. stock_applied=true: el stock ya quedó fijado arriba, no debe
      // volver a aplicarse vía applyMovementStock/automatización.
      const movement = await sr.entities.Movement.create({
        product_id,
        product_name: product.name,
        type: 'adjustment',
        quantity: finalStock, // 'adjustment' = stock final ABSOLUTO (convención del sistema); el delta queda en InventoryAuditLog
        unit_price: 0,
        total: 0,
        stock_after: finalStock,
        reason: movementReason,
        business_id: businessId,
        stock_applied: true,
      });
      movementId = movement?.id ?? null;

      await sr.entities.InventoryAuditLog.create({
        product_id,
        product_name: product.name,
        business_id: businessId,
        event_type: 'system_correction',
        stock_before: currentStock,
        stock_after: finalStock,
        notes: `[${mode}] ${clipped}`,
        performed_by: user.email,
      });
    } catch (writeError) {
      // Sin registro no hay corrección: deshacer lo escrito (mejor esfuerzo).
      if (stockUpdated) await sr.entities.Product.update(product_id, { stock: currentStock }).catch(() => {});
      if (movementId) await sr.entities.Movement.delete(movementId).catch(() => {});
      throw writeError;
    }

    return Response.json({
      success: true,
      product_id,
      product_name: product.name,
      mode,
      stock_before: currentStock,
      stock_after: finalStock,
    });
  } catch (error) {
    console.log(`[AUDIT-CORRECTION] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
