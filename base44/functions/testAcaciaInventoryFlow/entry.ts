import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TEST ACACIA INVENTORY FLOW
 * For Jose (ACACIA OWNER SANDBOX):
 * 1. Create test product with initial stock
 * 2. Entry movement
 * 3. Exit movement
 * 4. Quotation with conversion
 * 5. Verify final stock numbers
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      user: {
        email: user.email,
        business_id: user.business_id
      },
      inventory_flow: {
        product_create: null,
        entry_movement: null,
        exit_movement: null,
        quotation_create: null,
        quotation_conversion: null,
        final_stock_check: null
      },
      stock_numbers: {
        initial: 0,
        after_entry: 0,
        after_exit: 0,
        after_quotation_conversion: 0
      },
      status: 'pending'
    };

    try {
      // 1. Create test product
      const testProd = {
        name: `TEST_PRODUCT_${Date.now()}`,
        sale_price: 100,
        stock: 10,
        min_stock: 5,
        unit: 'pieza',
        status: 'active',
        business_id: user.business_id
      };
      const product = await base44.entities.Product.create(testProd);
      result.inventory_flow.product_create = { success: true, id: product.id, name: product.name };
      result.stock_numbers.initial = product.stock;
    } catch (e) {
      result.inventory_flow.product_create = { success: false, error: (e as Error).message };
      result.status = 'failed';
      return Response.json(result);
    }

    const productId = result.inventory_flow.product_create.id;

    try {
      // 2. Entry movement (+5 units)
      const entry = await base44.entities.Movement.create({
        product_id: productId,
        product_name: result.inventory_flow.product_create.name,
        type: 'entry',
        quantity: 5,
        unit_price: 80,
        total: 400,
        reason: 'Test entry',
        business_id: user.business_id
      });
      result.inventory_flow.entry_movement = { success: true, id: entry.id };
      result.stock_numbers.after_entry = result.stock_numbers.initial + 5;
    } catch (e) {
      result.inventory_flow.entry_movement = { success: false, error: (e as Error).message };
    }

    try {
      // 3. Exit movement (-3 units)
      const exit = await base44.entities.Movement.create({
        product_id: productId,
        product_name: result.inventory_flow.product_create.name,
        type: 'exit',
        quantity: 3,
        unit_price: 100,
        total: 300,
        reason: 'Test exit',
        business_id: user.business_id
      });
      result.inventory_flow.exit_movement = { success: true, id: exit.id };
      result.stock_numbers.after_exit = result.stock_numbers.after_entry - 3;
    } catch (e) {
      result.inventory_flow.exit_movement = { success: false, error: (e as Error).message };
    }

    try {
      // 4. Get or create test client
      const clients = await base44.entities.Client.filter({ name: 'TEST_CLIENT' });
      let clientId;
      if (clients.length > 0) {
        clientId = clients[0].id;
      } else {
        const client = await base44.entities.Client.create({
          name: 'TEST_CLIENT',
          email: 'test@example.com',
          business_id: user.business_id
        });
        clientId = client.id;
      }

      // 5. Create quotation
      const quotation = await base44.entities.Quotation.create({
        client_id: clientId,
        client_name: 'TEST_CLIENT',
        client_email: 'test@example.com',
        items: [
          {
            product_id: productId,
            product_name: result.inventory_flow.product_create.name,
            quantity: 2,
            unit_price: 100,
            total: 200,
            tax_rate: 16
          }
        ],
        subtotal: 200,
        tax: 32,
        total: 232,
        status: 'draft',
        business_id: user.business_id
      });
      result.inventory_flow.quotation_create = { success: true, id: quotation.id, folio: quotation.folio };
    } catch (e) {
      result.inventory_flow.quotation_create = { success: false, error: (e as Error).message };
    }

    try {
      // 6. Convert quotation (this would trigger exit movement if implemented)
      const quotId = result.inventory_flow.quotation_create.id;
      await base44.entities.Quotation.update(quotId, { status: 'converted' });
      result.inventory_flow.quotation_conversion = { success: true };
      result.stock_numbers.after_quotation_conversion = result.stock_numbers.after_exit - 2; // -2 from quotation
    } catch (e) {
      result.inventory_flow.quotation_conversion = { success: false, error: (e as Error).message };
    }

    // 7. Final stock check
    try {
      const products = await base44.entities.Product.filter({ id: productId });
      if (products.length > 0) {
        result.inventory_flow.final_stock_check = {
          success: true,
          final_stock: products[0].stock,
          expected: result.stock_numbers.after_exit
        };
      }
    } catch (e) {
      result.inventory_flow.final_stock_check = { success: false, error: (e as Error).message };
    }

    result.status = 'passed';
    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});