import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;
    console.log(`[STOCK-TEST] User: ${user.email}, business: ${businessId}`);

    const results = {
      step_1_product_create: null,
      step_2_entry_movement: null,
      step_3_exit_movement: null,
      step_4_quotation_create: null,
      step_5_quotation_convert: null,
      final_stock: null
    };

    // STEP 1: Create product with stock=0
    console.log(`[STOCK-TEST] Step 1: Create product...`);
    const product = await base44.entities.Product.create({
      name: `STOCK_TEST_${Date.now()}`,
      sale_price: 100.00,
      purchase_price: 50.00,
      business_id: businessId,
      stock: 0
    });
    results.step_1_product_create = {
      id: product.id,
      initial_stock: product.stock
    };
    console.log(`[STOCK-TEST] ✅ Product created: ${product.id}, stock: ${product.stock}`);

    // STEP 2: Entry movement (+20 units)
    console.log(`[STOCK-TEST] Step 2: Create entry movement (+20)...`);
    const entry = await base44.entities.Movement.create({
      product_id: product.id,
      product_name: product.name,
      type: 'entry',
      quantity: 20,
      unit_price: 50,
      total: 1000,
      reason: 'Initial stock',
      business_id: businessId
    });
    results.step_2_entry_movement = {
      id: entry.id,
      type: entry.type,
      quantity: entry.quantity
    };
    console.log(`[STOCK-TEST] ✅ Entry created: ${entry.id}, qty: ${entry.quantity}`);

    // Wait for automation to sync stock
    await new Promise(r => setTimeout(r, 500));

    // Check stock after entry
    const afterEntry = await base44.entities.Product.get(product.id);
    console.log(`[STOCK-TEST] Stock after entry: ${afterEntry.stock} (expected: 20)`);

    // STEP 3: Exit movement (-5 units)
    console.log(`[STOCK-TEST] Step 3: Create exit movement (-5)...`);
    const exit = await base44.entities.Movement.create({
      product_id: product.id,
      product_name: product.name,
      type: 'exit',
      quantity: 5,
      unit_price: 100,
      total: 500,
      reason: 'Sale',
      business_id: businessId
    });
    results.step_3_exit_movement = {
      id: exit.id,
      type: exit.type,
      quantity: exit.quantity
    };
    console.log(`[STOCK-TEST] ✅ Exit created: ${exit.id}, qty: ${exit.quantity}`);

    // Wait for automation to sync stock
    await new Promise(r => setTimeout(r, 500));

    // Check stock after exit
    const afterExit = await base44.entities.Product.get(product.id);
    console.log(`[STOCK-TEST] Stock after exit: ${afterExit.stock} (expected: 15)`);

    // STEP 4: Create quotation with this product
    console.log(`[STOCK-TEST] Step 4: Create quotation...`);
    const quotation = await base44.entities.Quotation.create({
      client_name: 'Test Client',
      items: [
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 10,
          unit_price: 100,
          total: 1000,
          tax_rate: 16
        }
      ],
      subtotal: 1000,
      tax: 160,
      total: 1160,
      status: 'draft',
      business_id: businessId
    });
    results.step_4_quotation_create = {
      id: quotation.id,
      status: quotation.status,
      items_count: quotation.items.length
    };
    console.log(`[STOCK-TEST] ✅ Quotation created: ${quotation.id}, items: ${quotation.items.length}`);

    // STEP 5: Convert quotation to sale (should create exit movement for 10 units)
    console.log(`[STOCK-TEST] Step 5: Convert quotation to sale...`);
    const updated = await base44.entities.Quotation.update(quotation.id, {
      status: 'converted'
    });
    results.step_5_quotation_convert = {
      id: updated.id,
      status: updated.status
    };
    console.log(`[STOCK-TEST] ✅ Quotation converted: ${updated.id}, status: ${updated.status}`);

    // Wait for stock sync automation
    await new Promise(r => setTimeout(r, 1000));

    // FINAL: Check final stock
    const finalProduct = await base44.entities.Product.get(product.id);
    results.final_stock = {
      actual: finalProduct.stock,
      expected: 5, // 0 + 20 (entry) - 5 (exit) - 10 (quotation conversion)
      match: finalProduct.stock === 5
    };
    console.log(`[STOCK-TEST] Final stock: ${finalProduct.stock} (expected: 5, match: ${finalProduct.stock === 5})`);

    return Response.json(results);

  } catch (error) {
    console.log(`[STOCK-TEST] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});