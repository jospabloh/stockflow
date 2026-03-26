import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[FINAL-CLOSURE] Starting verification for ${user.email}, business: ${user.business_id}`);

    const results = {
      user_email: user.email,
      user_business_id: user.business_id,
      tests: {
        step_1_isolation: null,
        step_2_product_create: null,
        step_3_entry_create: null,
        step_4_exit_create: null,
        step_5_stock_updated: null,
        step_6_quotation_create: null,
        step_7_conversion: null,
        step_8_final_stock: null,
        final_stock_value: null,
        expected_stock: 35
      },
      errors: []
    };

    // STEP 1: Isolation check
    try {
      const allCats = await base44.entities.Category.list();
      const otherBizCats = allCats.filter(c => c.business_id !== user.business_id);
      results.tests.step_1_isolation = otherBizCats.length === 0;
      console.log(`[FINAL-CLOSURE] Step 1 - Isolation: ${otherBizCats.length === 0 ? 'PASS' : 'FAIL'} (other biz cats: ${otherBizCats.length})`);
    } catch (e) {
      results.errors.push(`Step 1 isolation error: ${e.message}`);
      results.tests.step_1_isolation = false;
    }

    // STEP 2: Create product
    try {
      const prod = await base44.entities.Product.create({
        name: `FINAL_TEST_${Date.now()}`,
        sale_price: 100,
        business_id: user.business_id,
        stock: 0
      });
      results.tests.step_2_product_create = !!prod.id;
      console.log(`[FINAL-CLOSURE] Step 2 - Product created: ${prod.id}, stock: ${prod.stock}`);
      results._product_id = prod.id;
    } catch (e) {
      results.errors.push(`Step 2 product create error: ${e.message}`);
      results.tests.step_2_product_create = false;
      return Response.json(results);
    }

    // Wait for automation to process
    await new Promise(r => setTimeout(r, 500));

    // STEP 3: Create entry movement (+50)
    try {
      const entry = await base44.entities.Movement.create({
        product_id: results._product_id,
        product_name: `FINAL_TEST_${Date.now()}`,
        type: 'entry',
        quantity: 50,
        unit_price: 80,
        total: 4000,
        reason: 'Initial entry',
        stock_after: 50,
        business_id: user.business_id
      });
      results.tests.step_3_entry_create = !!entry.id;
      console.log(`[FINAL-CLOSURE] Step 3 - Entry movement created: ${entry.id}`);
    } catch (e) {
      results.errors.push(`Step 3 entry error: ${e.message}`);
      results.tests.step_3_entry_create = false;
    }

    // Wait for automation sync (longer delay for stock calc)
    await new Promise(r => setTimeout(r, 1000));

    // Check stock after entry
    let product;
    try {
      product = await base44.entities.Product.get(results._product_id);
      console.log(`[FINAL-CLOSURE] After ENTRY: stock = ${product.stock}`);
    } catch (e) {
      console.log(`[FINAL-CLOSURE] Error fetching product after entry: ${e.message}`);
      // Try to fetch via list as fallback
      const prods = await base44.entities.Product.filter({ id: results._product_id });
      if (prods.length > 0) {
        product = prods[0];
        console.log(`[FINAL-CLOSURE] Found product via list: stock = ${product.stock}`);
      } else {
        throw new Error('Product not found via get or list');
      }
    }

    // STEP 4: Create exit movement (-10)
    try {
      const exit = await base44.entities.Movement.create({
        product_id: results._product_id,
        product_name: product.name,
        type: 'exit',
        quantity: 10,
        unit_price: 100,
        total: 1000,
        reason: 'Sale',
        stock_after: 40,
        business_id: user.business_id
      });
      results.tests.step_4_exit_create = !!exit.id;
      console.log(`[FINAL-CLOSURE] Step 4 - Exit movement created: ${exit.id}`);
    } catch (e) {
      results.errors.push(`Step 4 exit error: ${e.message}`);
      results.tests.step_4_exit_create = false;
    }

    // Wait for automation sync
    await new Promise(r => setTimeout(r, 1000));

    // Check stock after exit
    product = await base44.entities.Product.get(results._product_id);
    console.log(`[FINAL-CLOSURE] After EXIT: stock = ${product.stock}`);
    results.tests.step_5_stock_updated = product.stock === 40;

    // STEP 6: Create quotation
    try {
      const quote = await base44.entities.Quotation.create({
        folio: `Q-${Date.now()}`,
        client_name: 'Test Client',
        items: [{
          product_id: results._product_id,
          product_name: product.name,
          quantity: 5,
          unit_price: 100,
          total: 500,
          tax_rate: 16
        }],
        subtotal: 500,
        tax: 80,
        total: 580,
        status: 'draft',
        business_id: user.business_id
      });
      results.tests.step_6_quotation_create = !!quote.id;
      results._quote_id = quote.id;
      console.log(`[FINAL-CLOSURE] Step 6 - Quotation created: ${quote.id}`);
    } catch (e) {
      results.errors.push(`Step 6 quotation error: ${e.message}`);
      results.tests.step_6_quotation_create = false;
    }

    // STEP 7: Convert quotation to sale
    try {
      await base44.entities.Quotation.update(results._quote_id, {
        status: 'converted',
        delivered: true,
        paid: true
      });
      results.tests.step_7_conversion = true;
      
      // Create exit for conversion
      const conversionExit = await base44.entities.Movement.create({
        product_id: results._product_id,
        product_name: product.name,
        type: 'exit',
        quantity: 5,
        unit_price: 100,
        total: 500,
        reason: 'Quotation sale conversion',
        quotation_id: results._quote_id,
        stock_after: 35,
        business_id: user.business_id
      });
      console.log(`[FINAL-CLOSURE] Step 7 - Conversion exit created: ${conversionExit.id}`);
    } catch (e) {
      results.errors.push(`Step 7 conversion error: ${e.message}`);
      results.tests.step_7_conversion = false;
    }

    // Wait for final automation sync
    await new Promise(r => setTimeout(r, 1500));

    // STEP 8: Final stock verification
    product = await base44.entities.Product.get(results._product_id);
    console.log(`[FINAL-CLOSURE] FINAL STOCK: ${product.stock}, expected: 35`);
    results.tests.step_8_final_stock = product.stock === 35;
    results.final_stock_value = product.stock;

    console.log('[FINAL-CLOSURE] All tests complete');
    return Response.json(results);

  } catch (error) {
    console.log(`[FINAL-CLOSURE] FATAL: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});