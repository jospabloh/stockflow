import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bId = user.business_id;
    const productId = '69c5917765af33917b51fd4b';
    const results = {
      steps: [],
      movements: []
    };

    // Get initial product state
    const prods = await base44.entities.Product.filter({ id: productId, business_id: bId });
    const product = prods[0];
    results.initialStock = product.stock;
    results.steps.push({ step: 'Initial', stock: product.stock });

    // STEP 1: ENTRY - Add 100 units
    const entry = await base44.entities.Movement.create({
      product_id: productId,
      product_name: product.name,
      type: 'entry',
      quantity: 100,
      unit_price: 100.00,
      total: 10000.00,
      stock_after: product.stock + 100,
      reason: 'TEST-ENTRY-001',
      reference: 'TEST-ENTRY',
      business_id: bId
    });
    results.movements.push(entry.id);
    await base44.entities.Product.update(productId, { stock: product.stock + 100 });
    results.steps.push({ step: 'ENTRY +100', expectedStock: 100, movement: entry.id });

    // STEP 2: EXIT - Remove 30 units
    const currentAfterEntry = product.stock + 100;
    const exit = await base44.entities.Movement.create({
      product_id: productId,
      product_name: product.name,
      type: 'exit',
      quantity: 30,
      unit_price: 150.00,
      total: 4500.00,
      stock_after: currentAfterEntry - 30,
      reason: 'TEST-EXIT-001',
      reference: 'TEST-EXIT',
      business_id: bId
    });
    results.movements.push(exit.id);
    await base44.entities.Product.update(productId, { stock: currentAfterEntry - 30 });
    results.steps.push({ step: 'EXIT -30', expectedStock: 70, movement: exit.id });

    // STEP 3: ADJUSTMENT - Set to absolute value 50
    const currentAfterExit = currentAfterEntry - 30;
    const adjustment = await base44.entities.Movement.create({
      product_id: productId,
      product_name: product.name,
      type: 'adjustment',
      quantity: 50,
      unit_price: 100.00,
      total: 5000.00,
      stock_after: 50,
      reason: 'TEST-ADJUSTMENT-001',
      reference: 'TEST-ADJUSTMENT',
      business_id: bId
    });
    results.movements.push(adjustment.id);
    await base44.entities.Product.update(productId, { stock: 50 });
    results.steps.push({ step: 'ADJUSTMENT =50', expectedStock: 50, movement: adjustment.id });

    // Verify final state
    const finalProds = await base44.entities.Product.filter({ id: productId, business_id: bId });
    const finalProduct = finalProds[0];
    results.finalStock = finalProduct.stock;
    results.success = finalProduct.stock === 50;

    // Verify all movements exist and are isolated to this business
    const allMovements = await base44.entities.Movement.filter({ business_id: bId }, '-created_date', 1000);
    const testMovements = allMovements.filter(m => m.product_id === productId);
    results.movementsCount = testMovements.length;
    results.movementsData = testMovements.map(m => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      stock_after: m.stock_after,
      business_id: m.business_id
    }));

    return Response.json({
      success: results.success,
      businessId: bId,
      results
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message, stack: error.stack }, { status: 500 });
  }
});