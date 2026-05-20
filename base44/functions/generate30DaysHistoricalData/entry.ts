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

    const movements = [];

    // Create 1 transaction per day for the last 30 days
    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      // Calculate the date for this day
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(12, 0, 0, 0); // Set to noon
      
      // Convert to ISO string (UTC)
      const isoDate = date.toISOString();

      movements.push({
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 2,
        unit_price: salePrice,
        cost_price: product.purchase_price || 100,
        total: 2 * salePrice,
        reason: client.name,
        reference: 'Efectivo',
        stock_after: 100,
        paid: daysAgo > 15, // Older transactions are paid
        business_id: businessId,
        created_date: isoDate // Explicitly set the date
      });
    }

    // Use service role to bulk create with explicit dates
    const result = await base44.asServiceRole.entities.Movement.bulkCreate(movements);

    return Response.json({
      status: 'success',
      created_movements: movements.length,
      message: 'Created 30 transactions across the last 30 days (one per day)',
      date_range: `${new Date(new Date().setDate(new Date().getDate() - 29)).toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});