import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;

    // Get all movements
    const movements = await base44.entities.Movement.list();
    console.log(`[DEBUG] Total movements: ${movements.length}`);

    // Filter to recent test movements
    const testMovements = movements.filter(m => 
      m.reason && (m.reason.includes('Test') || m.reason.includes('Initial') || m.reason.includes('Sale'))
    );
    console.log(`[DEBUG] Test movements: ${testMovements.length}`);

    testMovements.forEach((m, i) => {
      console.log(`[DEBUG] Movement ${i}:`, {
        id: m.id,
        type: m.type,
        product_id: m.product_id,
        quantity: m.quantity,
        reason: m.reason,
        quotation_id: m.quotation_id
      });
    });

    // Get all products
    const products = await base44.entities.Product.list();
    console.log(`[DEBUG] Total products: ${products.length}`);

    const testProducts = products.filter(p => p.name && p.name.includes('STOCK_TEST'));
    console.log(`[DEBUG] Test products: ${testProducts.length}`);

    testProducts.forEach((p, i) => {
      const movs = testMovements.filter(m => m.product_id === p.id);
      console.log(`[DEBUG] Product ${i} (${p.name}):`, {
        id: p.id,
        stock: p.stock,
        movements_count: movs.length,
        movements: movs.map(m => ({ type: m.type, qty: m.quantity, reason: m.reason }))
      });
    });

    return Response.json({
      total_movements: movements.length,
      test_movements: testMovements.length,
      test_products: testProducts.length,
      movements: testMovements.map(m => ({
        id: m.id,
        type: m.type,
        product_id: m.product_id,
        quantity: m.quantity,
        reason: m.reason,
        quotation_id: m.quotation_id
      })),
      products: testProducts.map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock
      }))
    });

  } catch (error) {
    console.log(`[DEBUG] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});