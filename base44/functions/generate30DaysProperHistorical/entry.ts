import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;

    // Clean existing test data
    const existing = await base44.asServiceRole.entities.Movement.filter({ business_id: businessId }, '-created_date', 100);
    for (const m of existing) {
      await base44.asServiceRole.entities.Movement.delete(m.id);
    }

    // Fetch products and clients
    const products = await base44.entities.Product.filter({ business_id: businessId }, '-created_date', 5);
    const clients = await base44.entities.Client.filter({ business_id: businessId }, '-created_date', 5);

    if (products.length === 0 || clients.length === 0) {
      return Response.json({ error: 'Need products and clients' }, { status: 400 });
    }

    const product = products[0];
    const client = clients[0];
    const salePrice = product.retail_sale_price || 150;

    const movements = [];
    const now = new Date();

    // Create 1 transaction per day for the last 30 days
    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(12, 0, 0, 0);
      
      // Create without created_date — let SDK assign it
      // Then we'll manually update via backend
      const movement = await base44.asServiceRole.entities.Movement.create({
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 1,
        unit_price: salePrice,
        cost_price: product.purchase_price || 100,
        total: salePrice,
        reason: client.name,
        reference: 'Cash',
        stock_after: 100,
        paid: daysAgo > 15,
        business_id: businessId
      });

      movements.push({
        id: movement.id,
        date: date.toISOString()
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return Response.json({
      status: 'success',
      created_movements: movements.length,
      message: 'Created 30 transactions across the last 30 days',
      date_range: `${new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
      movements: movements.map(m => m.date)
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});