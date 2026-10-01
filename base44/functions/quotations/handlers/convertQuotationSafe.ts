import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null); // me() throws when there is no valid session -> 401, not 500

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, payment_method } = body;

    if (!quotation_id) {
      return Response.json({ error: 'quotation_id is required' }, { status: 400 });
    }

    if (!payment_method || !payment_method.trim()) {
      return Response.json({ error: 'payment_method is required' }, { status: 400 });
    }

    // Fetch quotation to validate ownership — use asServiceRole to avoid RLS blocking almacenista users
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const quotation = quotations[0];

    // CRITICAL: Validate business_id ownership
    if (quotation.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate quotation status
    if (quotation.status === 'converted') {
      return Response.json({ error: 'Quotation already converted' }, { status: 400 });
    }

    // IDEMPOTENCY GUARD (P1 — duplicate movements):
    // convertQuotationSafe is NOT atomic and was being invoked multiple times for
    // the same quotation (impatient double/triple-click while the multi-second
    // conversion was in flight, or client retries on a slow network). Each call
    // passed the status check above — which reads a snapshot taken before the
    // first call finished its status update — and created a FULL extra set of exit
    // movements, over-deducting stock. Guard: if ANY exit movement already exists
    // for this quotation, treat the conversion as already done and no-op. This
    // closes the retry window even when calls are seconds apart. (A frontend
    // in-flight guard handles the sub-second double-click; this is the
    // server-side backstop and the source of truth.)
    const existingMovements = await base44.asServiceRole.entities.Movement.filter({
      quotation_id: quotation.id,
      type: 'exit',
    });
    if (existingMovements.length > 0) {
      return Response.json({ error: 'Quotation already converted', already_converted: true }, { status: 400 });
    }

    // PERMISSION CHECK — the granular key is re-checked server-side (the UI gate alone is bypassable).
    if (!(await hasPermission(base44.asServiceRole, user, 'Cotizaciones', 'convert'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Cotizaciones:convert' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const tenantBiz = bizArr[0];
    const billingStatus = tenantBiz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // PHASE 1: Validate stock BEFORE any operations — skip on-demand items
    const itemsWithStock = [];
    for (const item of (quotation.items || [])) {
      // Skip on-demand items — no stock to validate or deduct
      if (item.is_on_demand) continue;
      // Skip empty/ghost items (product_id vacío, sin nombre, sin precio)
      if (!item.product_id || !item.product_id.trim() || !item.product_name) continue;

      let prods;
      try {
        prods = await base44.asServiceRole.entities.Product.filter({ id: item.product_id, business_id: user.business_id });
      } catch (err) {
        return Response.json({ error: `Error fetching product: ${err.message}` }, { status: 500 });
      }
      if (prods.length === 0) {
        return Response.json({ error: `Product ${item.product_id} not found` }, { status: 404 });
      }
      const product = prods[0];
      if (item.quantity > (product.stock || 0)) {
        return Response.json({ error: `Insufficient stock for ${item.product_name}: available ${product.stock}, requested ${item.quantity}` }, { status: 400 });
      }
      itemsWithStock.push({ ...item, product });
    }

    // PHASE 2: Create movements for catalog items only — on-demand items stay pending
    try {
      for (const item of itemsWithStock) {
        const mov = await base44.asServiceRole.entities.Movement.create({
          product_id: item.product_id,
          product_name: item.product_name,
          type: 'exit',
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.product.purchase_price ?? 0,
          total: item.total,
          stock_after: (item.product.stock || 0) - item.quantity,
          reference: `Venta ${quotation.folio}`,
          reason: `Venta a ${quotation.client_name}`,
          quotation_id: quotation.id,
          business_id: user.business_id,
        });
        // Descuento de stock síncrono y exactamente-una-vez (no depende del trigger).
        // Best-effort: automatización + dailyStockReconcile son respaldo.
        try {
          await base44.asServiceRole.functions.invoke('movements', {
            action: 'applyMovementStock',
            movement_id: mov.id,
            business_id: user.business_id,
            'x-cron-secret': Deno.env.get('CRON_SECRET'),
          });
        } catch (e) {
          console.log(`[convertQuotationSafe] applyMovementStock failed for ${mov.id}: ${e.message}`);
        }
      }

      // Check if client has force_zero_price — if so, mark as paid automatically with "Sin cargo"
      const clientId = quotation.client_id;
      let isZeroPrice = (quotation.total || 0) === 0;
      if (!isZeroPrice && clientId) {
        const clients = await base44.asServiceRole.entities.Client.filter({ id: clientId, business_id: user.business_id });
        if (clients[0]?.force_zero_price) isZeroPrice = true;
      }

      const finalPaymentMethod = isZeroPrice ? 'Sin cargo' : payment_method.trim();

      // Update quotation status
       // CRITICAL FIX: DO NOT auto-register petty cash on conversion
       // Petty cash income is only registered when payments are actually confirmed
       // This prevents the bug where the FULL amount was registered as cash when only partial payment was cash
       await base44.asServiceRole.entities.Quotation.update(quotation.id, {
         status: 'converted',
         payment_method: finalPaymentMethod,
         paid: isZeroPrice ? true : false,
         amount_paid: isZeroPrice ? (quotation.total || 0) : 0,
         balance: isZeroPrice ? 0 : (quotation.total || 0),
         payments: quotation.payments || [],
       });

      return Response.json({ success: true, quotation_id });
    } catch (error) {
      return Response.json({ error: error.message || 'Conversion failed' }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}