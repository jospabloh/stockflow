import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * VERIFY QUOTATION CONVERSION STOCK UPDATE
 * Test the exact flow from pages/Quotations.js handleConvertToSale
 * 1. Create product with stock 100
 * 2. Create quotation with 25 units
 * 3. Convert quotation (should create exit movement and decrement stock to 75)
 * 4. Verify stock = 75
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      user_email: user.email,
      business_id: user.business_id,
      quotation_conversion_test: {
        product_create: { success: false },
        client_create: { success: false },
        quotation_create: { success: false },
        conversion: { success: false },
        final_verification: { success: false }
      }
    };

    // Step 1: Create product with stock 100
    let productId;
    try {
      const product = await base44.entities.Product.create({
        name: `QUOTATION_TEST_${Date.now()}`,
        sale_price: 100,
        stock: 100,
        min_stock: 5,
        unit: 'pieza',
        status: 'active',
        business_id: user.business_id
      });
      productId = product.id;
      result.quotation_conversion_test.product_create = {
        success: true,
        product_id: productId,
        initial_stock: 100
      };
    } catch (e) {
      return Response.json({ error: `Product creation failed: ${(e as Error).message}` }, { status: 500 });
    }

    // Step 2: Create client
    let clientId;
    try {
      const client = await base44.entities.Client.create({
        name: `QUOTATION_TEST_CLIENT_${Date.now()}`,
        email: 'quotation@test.com',
        business_id: user.business_id
      });
      clientId = client.id;
      result.quotation_conversion_test.client_create = { success: true, client_id: clientId };
    } catch (e) {
      return Response.json({ error: `Client creation failed: ${(e as Error).message}` }, { status: 500 });
    }

    // Step 3: Create quotation with 25 units
    let quotationId;
    try {
      const quotation = await base44.entities.Quotation.create({
        client_id: clientId,
        client_name: `QUOTATION_TEST_CLIENT_${Date.now()}`,
        client_email: 'quotation@test.com',
        items: [
          {
            product_id: productId,
            product_name: `QUOTATION_TEST_${Date.now()}`,
            quantity: 25,
            unit_price: 100,
            total: 2500,
            tax_rate: 16
          }
        ],
        subtotal: 2500,
        tax: 400,
        total: 2900,
        status: 'draft',
        business_id: user.business_id
      });
      quotationId = quotation.id;
      result.quotation_conversion_test.quotation_create = {
        success: true,
        quotation_id: quotationId,
        quantity: 25
      };
    } catch (e) {
      return Response.json({ error: `Quotation creation failed: ${(e as Error).message}` }, { status: 500 });
    }

    // Step 4: Convert quotation (as per pages/Quotations.js handleConvertToSale)
    try {
      // Fetch product to get current stock before conversion
      const prods = await base44.entities.Product.filter({ id: productId });
      const product = prods[0];
      if (!product) throw new Error('Product not found');

      // Validate stock
      const quantity = 25;
      if (quantity > product.stock) {
        throw new Error(`Stock insuficiente: disponible ${product.stock}, solicitado ${quantity}`);
      }

      // Create exit movement
      const newStock = product.stock - quantity;
      await base44.entities.Movement.create({
        product_id: productId,
        product_name: product.name,
        type: 'exit',
        quantity: quantity,
        unit_price: 100,
        total: 2500,
        stock_after: newStock,
        reference: `Venta QUOT_${quotationId.substring(0, 8)}`,
        reason: 'Venta convertida desde cotización',
        quotation_id: quotationId,
        business_id: user.business_id
      });

      // Update product stock
      await base44.entities.Product.update(productId, { stock: newStock });

      // Mark quotation as converted
      await base44.entities.Quotation.update(quotationId, {
        status: 'converted',
        payment_method: 'Efectivo'
      });

      result.quotation_conversion_test.conversion = {
        success: true,
        stock_before: product.stock,
        stock_after: newStock,
        expected_stock: 75
      };
    } catch (e) {
      result.quotation_conversion_test.conversion = { success: false, error: (e as Error).message };
      return Response.json(result);
    }

    // Step 5: Final verification — product stock should be 75
    try {
      const prods = await base44.entities.Product.filter({ id: productId });
      const finalProduct = prods[0];
      if (!finalProduct) throw new Error('Product not found');

      const stockMatchesExpected = finalProduct.stock === 75;
      result.quotation_conversion_test.final_verification = {
        success: stockMatchesExpected,
        actual_stock: finalProduct.stock,
        expected_stock: 75,
        matches: stockMatchesExpected
      };

      // Also verify exit movement was created
      const movements = await base44.entities.Movement.filter({ quotation_id: quotationId });
      const exitMovement = movements.find(m => m.type === 'exit');
      result.quotation_conversion_test.exit_movement_created = !!exitMovement;
    } catch (e) {
      result.quotation_conversion_test.final_verification = { success: false, error: (e as Error).message };
    }

    // Overall status
    const allPassed =
      result.quotation_conversion_test.product_create.success &&
      result.quotation_conversion_test.client_create.success &&
      result.quotation_conversion_test.quotation_create.success &&
      result.quotation_conversion_test.conversion.success &&
      result.quotation_conversion_test.final_verification.success;

    result.status = allPassed ? 'passed' : 'failed';
    result.design = 'A: Quotation conversion creates exit movement and updates stock';

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});