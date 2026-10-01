import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Safe on-demand-item arrival registration — CreateFromOnDemandModal.jsx
 * used to run this 3-write sequence (Movement.create, Product.update,
 * Quotation.update) directly from the client, with no permission or billing
 * gate at all (the "Crear" button in QuotationPreviewDialog.jsx isn't even
 * gated by can() today — only by quotation.status). Gated here by
 * 'Movimientos:entry' since this registers a stock entry, mirroring the
 * action id PettyCash/Movements already use for the same concept.
 *
 * Keeps the exact same write shape the client used (Movement created with
 * stock_applied:true + a direct Product.stock update, not
 * applyMovementStock — unlike deliverQuotationSafe's EXIT movements, this
 * was never routed through the stock-apply automation, so switching that now
 * would be an unrelated behavior change). Adds an idempotency guard
 * (skip if an entry movement already exists for this quotation+item) since
 * this is not atomic and could be double-invoked, mirroring the pattern
 * deliverQuotationSafe already uses for its own EXIT movements.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null); // me() throws when there is no valid session -> 401, not 500

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, item_index, quantity_received, notes } = body;

    if (!quotation_id) return Response.json({ success: false, error: 'quotation_id is required' }, { status: 400 });
    if (item_index === undefined || item_index === null) return Response.json({ success: false, error: 'item_index is required' }, { status: 400 });

    const qty = Number(quantity_received);
    if (!qty || qty <= 0) {
      return Response.json({ success: false, error: 'La cantidad recibida debe ser mayor a 0' }, { status: 400 });
    }

    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    const quotation = quotations[0];
    if (!quotation) return Response.json({ success: false, error: 'Quotation not found' }, { status: 404 });
    if (quotation.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const item = (quotation.items || [])[item_index];
    if (!item) return Response.json({ success: false, error: 'Item not found' }, { status: 404 });
    if (!item.is_on_demand || item.on_demand_status !== 'pending') {
      return Response.json({ success: false, error: 'Este producto ya fue registrado o no es bajo pedido' }, { status: 409 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Movimientos', 'entry');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Movimientos:entry' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // Idempotency guard — see file header.
    const already = await base44.asServiceRole.entities.Movement.filter({
      quotation_id: quotation.id,
      product_id: item.product_id,
      type: 'entry',
    });
    if (already.length > 0) {
      return Response.json({ success: false, error: 'Esta entrada ya fue registrada.' }, { status: 409 });
    }

    const prods = await base44.asServiceRole.entities.Product.filter({ id: item.product_id, business_id: user.business_id });
    if (prods.length === 0) {
      return Response.json({ success: false, error: 'Producto no encontrado en el catálogo' }, { status: 404 });
    }
    const product = prods[0];
    const currentStock = product.stock || 0;
    const newStock = currentStock + qty;

    // El stock se actualiza a mano abajo, por eso se marca stock_applied=true
    // (evita que applyMovementStock/automatización lo sume otra vez).
    await base44.asServiceRole.entities.Movement.create({
      product_id: item.product_id,
      product_name: item.product_name,
      type: 'entry',
      quantity: qty,
      unit_price: item.unit_price,
      total: qty * item.unit_price,
      quotation_id: quotation.id,
      stock_after: newStock,
      reason: `Entrada por pedido - Cotización #${quotation.folio || quotation.id}${notes ? ` — ${notes}` : ''}`,
      business_id: user.business_id,
      stock_applied: true,
    });

    await base44.asServiceRole.entities.Product.update(item.product_id, { stock: newStock });

    const updatedItems = (quotation.items || []).map((it, idx) =>
      idx === Number(item_index) ? { ...it, on_demand_status: 'product_created' } : it
    );
    await base44.asServiceRole.entities.Quotation.update(quotation.id, { items: updatedItems });

    return Response.json({ success: true, new_stock: newStock });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
