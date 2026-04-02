import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'No business_id' }, { status: 400 });
    }

    // Clean existing data
    const existingMovements = await base44.entities.Movement.filter({ business_id: businessId }, '-created_date', 10000);
    const existingQuotations = await base44.entities.Quotation.filter({ business_id: businessId }, '-created_date', 10000);
    
    for (const mov of existingMovements) {
      await base44.entities.Movement.delete(mov.id);
    }
    for (const quot of existingQuotations) {
      await base44.entities.Quotation.delete(quot.id);
    }

    // Get product
    const products = await base44.entities.Product.filter({ business_id: businessId }, '-created_date', 1);
    if (!products.length) {
      return Response.json({ error: 'No products' }, { status: 400 });
    }

    const product = products[0];
    
    // Create TODAY movements: 3 exits = $750
    const todayMovements = [];
    for (let i = 0; i < 3; i++) {
      todayMovements.push({
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 3,
        unit_price: 150,
        cost_price: 75,
        total: 450,
        reason: `Cliente ${String.fromCharCode(65 + i)} Hoy`,
        reference: i % 2 === 0 ? 'Efectivo' : 'Tarjeta',
        business_id: businessId,
        paid: i === 0,
      });
    }

    const created = await base44.entities.Movement.bulkCreate(todayMovements);

    return Response.json({
      status: 'success',
      created: created.length,
      message: 'Test data created for today only',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});