import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * FINAL INVENTORY CLOSURE TEST
 * Complete end-to-end test with exact stock numbers:
 * 1. Create product with initial stock 100
 * 2. Entry: +50 = 150
 * 3. Exit: -30 = 120
 * 4. Create quotation with 25 units
 * 5. Convert quotation = -25 = 95
 * 6. Verify final stock = 95
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const testResults = {
      user_email: user.email,
      business_id: user.business_id,
      operations: {
        product_create: { success: false, stock: null },
        entry_movement: { success: false, quantity: 50 },
        exit_movement: { success: false, quantity: 30 },
        quotation_create: { success: false, quantity: 25 },
        quotation_conversion: { success: false },
        final_verification: { success: false, expected: 95, actual: null }
      },
      expected_stock_flow: [
        { step: 'initial', stock: 100 },
        { step: 'after_entry', stock: 150 },
        { step: 'after_exit', stock: 120 },
        { step: 'after_quotation', stock: 95 }
      ],
      status: 'pending'
    };

    try {
      // 1. Create product
      const product = await base44.entities.Product.create({
        name: `FINAL_TEST_${Date.now()}`,
        sale_price: 50,
        stock: 100,
        min_stock: 10,
        unit: 'pieza',
        status: 'active',
        business_id: user.business_id
      });
      testResults.operations.product_create = { success: true, stock: 100, product_id: product.id };
      const productId = product.id;

      // 2. Entry: +50
      await base44.entities.Movement.create({
        product_id: productId,
        product_name: product.name,
        type: 'entry',
        quantity: 50,
        unit_price: 40,
        total: 2000,
        reason: 'Final test entry',
        business_id: user.business_id
      });
      testResults.operations.entry_movement.success = true;

      // 3. Exit: -30
      await base44.entities.Movement.create({
        product_id: productId,
        product_name: product.name,
        type: 'exit',
        quantity: 30,
        unit_price: 50,
        total: 1500,
        reason: 'Final test exit',
        business_id: user.business_id
      });
      testResults.operations.exit_movement.success = true;

      // 4. Get client
      let clientId;
      const existingClients = await base44.entities.Client.filter({ name: 'FINAL_TEST_CLIENT' });
      if (existingClients.length > 0) {
        clientId = existingClients[0].id;
      } else {
        const client = await base44.entities.Client.create({
          name: 'FINAL_TEST_CLIENT',
          email: 'final@test.com',
          business_id: user.business_id
        });
        clientId = client.id;
      }

      // 5. Create quotation with 25 units
      const quotation = await base44.entities.Quotation.create({
        client_id: clientId,
        client_name: 'FINAL_TEST_CLIENT',
        client_email: 'final@test.com',
        items: [
          {
            product_id: productId,
            product_name: product.name,
            quantity: 25,
            unit_price: 50,
            total: 1250,
            tax_rate: 16
          }
        ],
        subtotal: 1250,
        tax: 200,
        total: 1450,
        status: 'draft',
        business_id: user.business_id
      });
      testResults.operations.quotation_create = { success: true, quotation_id: quotation.id, quantity: 25 };

      // 6. Convert quotation
      await base44.entities.Quotation.update(quotation.id, { status: 'converted' });
      testResults.operations.quotation_conversion.success = true;

      // 7. Verify final stock
      const finalProduct = await base44.entities.Product.filter({ id: productId });
      if (finalProduct.length > 0) {
        testResults.operations.final_verification = {
          success: finalProduct[0].stock === 95,
          expected: 95,
          actual: finalProduct[0].stock
        };
      }

      // Determine overall status
      testResults.status = (
        testResults.operations.product_create.success &&
        testResults.operations.entry_movement.success &&
        testResults.operations.exit_movement.success &&
        testResults.operations.quotation_create.success &&
        testResults.operations.quotation_conversion.success &&
        testResults.operations.final_verification.success
      ) ? 'passed' : 'failed';

    } catch (e) {
      testResults.error = (e as Error).message;
      testResults.status = 'failed';
    }

    return Response.json(testResults);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});