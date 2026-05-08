import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

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
        await base44.asServiceRole.entities.Movement.create({
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
      await base44.asServiceRole.entities.Quotation.update(quotation.id, {
        status: 'converted',
        payment_method: finalPaymentMethod,
        paid: isZeroPrice ? true : false,
        amount_paid: 0,
        balance: isZeroPrice ? 0 : (quotation.total || 0),
        payments: quotation.payments || [],
      });

      // Auto-register in petty cash if efectivo and full payment at conversion (isZeroPrice is excluded)
      const isCash = finalPaymentMethod.toLowerCase().includes('efectivo');
      if (isCash && !isZeroPrice) {
        try {
          await base44.asServiceRole.entities.PettyCashMovement.create({
            business_id: user.business_id,
            movement_type: 'income',
            amount: quotation.total || 0,
            description: `Venta efectivo — ${quotation.folio} | ${quotation.client_name}`,
            category: 'Venta efectivo',
            movement_date: new Date().toLocaleDateString('en-CA'),
            reference: quotation.folio,
            notes: `Cotización ${quotation.folio} · Cliente: ${quotation.client_name} · Convertida en venta`,
            generated_by_system: true,
            origin_type: 'quotation',
            origin_id: quotation.id,
            payment_method_snapshot: finalPaymentMethod,
          });
        } catch (e) {
          console.error('PettyCash auto-create on conversion error:', e?.message);
        }
      }

      return Response.json({ success: true, quotation_id });
    } catch (error) {
      return Response.json({ error: error.message || 'Conversion failed' }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});