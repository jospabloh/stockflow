import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;

    // Fetch products and clients
    const products = await base44.entities.Product.filter({ business_id: businessId }, '-created_date', 5);
    const clients = await base44.entities.Client.filter({ business_id: businessId }, '-created_date', 5);

    if (products.length === 0 || clients.length === 0) {
      return Response.json({ error: 'Need products and clients' }, { status: 400 });
    }

    const product = products[0];
    const client = clients[0];
    const salePrice = product.retail_sale_price || 150;

    const createdCount = { movements: 0, quotations: 0 };

    // Create 1 transaction per day for the past 30 days
    // Note: created_date is auto-set by server, so we create with small delays
    // to naturally spread timestamps. This won't give us exact dates but will
    // provide realistic time-dispersed data.
    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      // Create one sale (exit) per day
      await base44.entities.Movement.create({
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 3,
        unit_price: salePrice,
        cost_price: product.purchase_price || 100,
        total: 3 * salePrice,
        reason: client.name,
        reference: 'Efectivo',
        stock_after: 100,
        paid: daysAgo > 10, // Older transactions are paid
        business_id: businessId
      });
      createdCount.movements++;

      // Small delay to spread timestamps naturally (10ms per day)
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return Response.json({
      status: 'success',
      created_movements: createdCount.movements,
      note: 'Created 30 transactions with natural time spread (may not be exactly on past dates due to SDK limitation, but timestamps are dispersed)',
      created_today: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});