import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[VERIFY] User: ${user.email}, business_id: ${user.business_id}`);

    // List products
    const products = await base44.entities.Product.list();
    console.log(`[VERIFY] Products count: ${products.length}`);
    
    if (products.length > 0) {
      const p = products[0];
      console.log(`[VERIFY] Sample product:`, JSON.stringify(p, null, 2));
      
      // Try to get it by ID
      try {
        const fetched = await base44.entities.Product.get(p.id);
        console.log(`[VERIFY] ✅ Product.get(${p.id}) SUCCESS`);
      } catch (e) {
        console.log(`[VERIFY] ❌ Product.get(${p.id}) FAILED: ${(e as Error).message}`);
      }
    }

    // List categories
    const cats = await base44.entities.Category.list();
    console.log(`[VERIFY] Categories count: ${cats.length}`);

    // Create a new product to test full flow
    console.log(`[VERIFY] Creating new product...`);
    const newProd = await base44.entities.Product.create({
      name: `VERIFY_PROD_${Date.now()}`,
      sale_price: 150.00,
      business_id: user.business_id,
      stock: 10
    });
    console.log(`[VERIFY] ✅ Created product: ${newProd.id}, stock: ${newProd.stock}`);

    // Fetch it back
    const fetched = await base44.entities.Product.get(newProd.id);
    console.log(`[VERIFY] ✅ Fetched product: ${fetched.id}, stock: ${fetched.stock}`);

    // Create a movement entry
    console.log(`[VERIFY] Creating movement entry...`);
    const movement = await base44.entities.Movement.create({
      product_id: newProd.id,
      product_name: newProd.name,
      type: 'entry',
      quantity: 5,
      unit_price: 100,
      total: 500,
      reason: 'Test entry',
      business_id: user.business_id
    });
    console.log(`[VERIFY] ✅ Created movement: ${movement.id}, type: ${movement.type}`);

    return Response.json({
      status: 'success',
      products_count: products.length,
      categories_count: cats.length,
      new_product_id: newProd.id,
      new_product_stock: newProd.stock,
      movement_id: movement.id
    });

  } catch (error) {
    console.log(`[VERIFY] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});