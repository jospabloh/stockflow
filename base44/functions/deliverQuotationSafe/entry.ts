import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id } = body;

    if (!quotation_id) return Response.json({ error: 'quotation_id is required' }, { status: 400 });

    // Fetch quotation
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) return Response.json({ error: 'Quotation not found' }, { status: 404 });

    const q = quotations[0];
    if (q.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (q.status !== 'converted') return Response.json({ error: 'Only converted quotations can be marked delivered' }, { status: 400 });

    // Check for pending on-demand items
    const pendingOnDemand = (q.items || []).filter(
      item => item.is_on_demand && item.on_demand_status === 'pending'
    );
    if (pendingOnDemand.length > 0) {
      return Response.json({
        success: false,
        warning: true,
        message: `⚠️ Hay ${pendingOnDemand.length} producto(s) bajo pedido que aún no han sido recibidos en almacén: ${pendingOnDemand.map(i => i.product_name).join(', ')}`,
      }, { status: 400 });
    }

    // Process on-demand items with product_created status → create EXIT movements
    const onDemandCreated = (q.items || []).filter(
      item => item.is_on_demand && item.on_demand_status === 'product_created'
    );

    for (const item of onDemandCreated) {
      // Fetch current product stock
      const prods = await base44.asServiceRole.entities.Product.filter({
        id: item.product_id,
        business_id: user.business_id,
      });
      if (prods.length === 0) continue;

      const product = prods[0];
      const newStock = (product.stock || 0) - item.quantity;

      // Create EXIT movement
      await base44.asServiceRole.entities.Movement.create({
        product_id: item.product_id,
        product_name: item.product_name,
        type: 'exit',
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: product.purchase_price ?? 0,
        total: item.total,
        quotation_id: q.id,
        reason: q.client_name,
        reference: q.payment_method || '',
        stock_after: Math.max(0, newStock),
        business_id: q.business_id,
      });

      // Update product stock
      await base44.asServiceRole.entities.Product.update(item.product_id, {
        stock: Math.max(0, newStock),
      });
    }

    // Mark quotation as delivered
    await base44.asServiceRole.entities.Quotation.update(q.id, {
      delivered: true,
      in_route: false,
    });

    return Response.json({
      success: true,
      quotation_id,
      exit_movements_created: onDemandCreated.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});