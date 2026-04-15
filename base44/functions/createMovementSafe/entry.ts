import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Safe Movement creation with business_id validation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { product_id, product_name, type, quantity, unit_price, cost_price, total, reason, reference, stock_after, quotation_id, business_id, paid } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }

    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const movement = await base44.asServiceRole.entities.Movement.create({
      product_id,
      product_name,
      type,
      quantity,
      unit_price,
      cost_price: cost_price ?? null,
      total,
      reason,
      reference,
      stock_after,
      quotation_id,
      business_id,
      paid: paid ?? false
    });

    // If this is a paid direct exit, reconcile petty cash based on tenant rule + payment method
    if (movement.type === 'exit' && !movement.quotation_id && movement.paid) {
      base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
        action: 'reconcile',
        origin_type: 'movement',
        origin_id: movement.id,
        amount: (movement.quantity || 0) * (movement.unit_price || 0),
        payment_method: movement.reference || '',
        description: `Venta directa — ${movement.product_name || ''} (${movement.reason || ''})`,
        folio_or_ref: movement.reference || movement.id,
        movement_date: new Date().toLocaleDateString('en-CA'),
        business_id,
      }).catch(() => {});
    }

    return Response.json({ success: true, movement_id: movement.id, movement });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
