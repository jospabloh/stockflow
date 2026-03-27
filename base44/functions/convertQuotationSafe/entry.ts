import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // Fetch quotation to validate ownership
    const quotations = await base44.entities.Quotation.filter({ id: quotation_id });
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

    // PHASE 1: Validate stock BEFORE any operations
    const itemsWithStock = [];
    for (const item of (quotation.items || [])) {
      const prods = await base44.entities.Product.filter({ id: item.product_id, business_id: user.business_id });
      if (prods.length === 0) {
        return Response.json({ error: 'Product not found' }, { status: 400 });
      }
      const product = prods[0];
      if (item.quantity > (product.stock || 0)) {
        return Response.json({ error: 'Insufficient stock' }, { status: 400 });
      }
      itemsWithStock.push({ ...item, product });
    }

    // PHASE 2: Prepare movements and product updates
    const movementsToCreate = itemsWithStock.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      type: 'exit',
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      stock_after: (item.product.stock || 0) - item.quantity,
      reference: `Venta ${quotation.folio}`,
      reason: `Venta a ${quotation.client_name}`,
      quotation_id: quotation.id,
      business_id: user.business_id,
    }));

    const productsToUpdate = itemsWithStock.map(item => ({
      id: item.product.id,
      newStock: (item.product.stock || 0) - item.quantity,
    }));

    // PHASE 3: Execute operations
    try {
      // Create movements
      for (const mov of movementsToCreate) {
        await base44.entities.Movement.create(mov);
      }

      // Update product stock using safe function
      for (const prod of productsToUpdate) {
        await base44.asServiceRole.functions.invoke('updateProductStockSafe', {
          product_id: prod.id,
          new_stock: prod.newStock,
          business_id: user.business_id
        });
      }

      // Update quotation status with whitelist
      await base44.asServiceRole.entities.Quotation.update(quotation.id, {
        status: 'converted',
        payment_method: payment_method.trim()
      });

      return Response.json({
        success: true,
        quotation_id
      });
    } catch (error) {
      return Response.json({ error: error.message || 'Conversion failed' }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});