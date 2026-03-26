import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[TEST-PRODUCT-CRUD] User: ${user.email}, business: ${user.business_id}`);

    // Test 1: Create product
    console.log('[TEST-PRODUCT-CRUD] Attempting Product CREATE...');
    const product = await base44.entities.Product.create({
      name: `TEST_${Date.now()}`,
      sale_price: 99.99,
      business_id: user.business_id,
      stock: 0
    });
    console.log(`[TEST-PRODUCT-CRUD] ✅ Product created: ${product.id}, stock=${product.stock}`);

    // Test 2: Read product via get
    console.log('[TEST-PRODUCT-CRUD] Attempting Product.get()...');
    const fetched = await base44.entities.Product.get(product.id);
    console.log(`[TEST-PRODUCT-CRUD] ✅ Product fetched: id=${fetched.id}, name=${fetched.name}, stock=${fetched.stock}`);

    // Test 3: Create category
    console.log('[TEST-PRODUCT-CRUD] Attempting Category CREATE...');
    const cat = await base44.entities.Category.create({
      name: `CAT_${Date.now()}`,
      business_id: user.business_id
    });
    console.log(`[TEST-PRODUCT-CRUD] ✅ Category created: ${cat.id}`);

    // Test 4: Read category
    const catFetch = await base44.entities.Category.get(cat.id);
    console.log(`[TEST-PRODUCT-CRUD] ✅ Category fetched: id=${catFetch.id}, name=${catFetch.name}`);

    return Response.json({
      status: 'success',
      product_id: product.id,
      category_id: cat.id,
      user_business_id: user.business_id
    });

  } catch (error) {
    console.log(`[TEST-PRODUCT-CRUD] ❌ ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});