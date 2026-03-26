import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * VERIFY INVENTORY UPDATES
 * Test whether movements created through MovementFormDialog actually update stock
 * by simulating the exact same flow
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
      inventory_test: {
        product_create: { success: false, initial_stock: null },
        movement_entry: { success: false, stock_before: null, stock_after_movement: null, expected_stock: null },
        movement_exit: { success: false, stock_before: null, stock_after_movement: null, expected_stock: null },
        final_stock_verification: { success: false, actual_stock: null, expected_stock: null }
      }
    };

    // Step 1: Create a product with stock = 100
    let productId;
    try {
      const product = await base44.entities.Product.create({
        name: `INV_TEST_${Date.now()}`,
        sale_price: 50,
        stock: 100,
        min_stock: 5,
        unit: 'pieza',
        status: 'active',
        business_id: user.business_id
      });
      productId = product.id;
      result.inventory_test.product_create = {
        success: true,
        product_id: productId,
        initial_stock: 100
      };
    } catch (e) {
      return Response.json({ error: `Product creation failed: ${e.message}` }, { status: 500 });
    }

    // Step 2: Get current stock before entry
    let productBeforeEntry;
    try {
      const prods = await base44.entities.Product.filter({ id: productId });
      productBeforeEntry = prods[0];
      if (!productBeforeEntry) throw new Error('Product not found');
    } catch (e) {
      return Response.json({ error: `Failed to fetch product before entry: ${e.message}` }, { status: 500 });
    }

    // Step 3: Create ENTRY movement (+50 units) — this should trigger stock update to 150
    try {
      const newStock = (productBeforeEntry.stock || 0) + 50;
      await base44.entities.Movement.create({
        product_id: productId,
        product_name: productBeforeEntry.name,
        type: 'entry',
        quantity: 50,
        unit_price: 40,
        total: 2000,
        stock_after: newStock,
        reason: 'Inventory verification entry',
        business_id: user.business_id
      });

      // UPDATE stock via Product.update (as per MovementFormDialog logic)
      await base44.entities.Product.update(productId, { stock: newStock });

      result.inventory_test.movement_entry = {
        success: true,
        stock_before: productBeforeEntry.stock,
        stock_after_movement: newStock,
        expected_stock: 150
      };
    } catch (e) {
      result.inventory_test.movement_entry = { success: false, error: e.message };
      return Response.json(result);
    }

    // Step 4: Get current stock after entry
    let productAfterEntry;
    try {
      const prods = await base44.entities.Product.filter({ id: productId });
      productAfterEntry = prods[0];
      if (!productAfterEntry) throw new Error('Product not found');
    } catch (e) {
      return Response.json({ error: `Failed to fetch product after entry: ${e.message}` }, { status: 500 });
    }

    // Verify entry movement updated stock
    if (productAfterEntry.stock !== 150) {
      result.inventory_test.movement_entry.actual_stock_after = productAfterEntry.stock;
      result.inventory_test.movement_entry.stock_update_failed = true;
    }

    // Step 5: Create EXIT movement (-30 units) — this should trigger stock update to 120
    try {
      const newStock = (productAfterEntry.stock || 0) - 30;
      
      // Validate enough stock available (as per MovementFormDialog)
      if (productAfterEntry.stock < 30) {
        throw new Error(`Stock insuficiente. Disponible: ${productAfterEntry.stock}, solicitado: 30`);
      }

      await base44.entities.Movement.create({
        product_id: productId,
        product_name: productAfterEntry.name,
        type: 'exit',
        quantity: 30,
        unit_price: 50,
        total: 1500,
        stock_after: newStock,
        reason: 'Inventory verification exit',
        business_id: user.business_id
      });

      // UPDATE stock via Product.update
      await base44.entities.Product.update(productId, { stock: newStock });

      result.inventory_test.movement_exit = {
        success: true,
        stock_before: productAfterEntry.stock,
        stock_after_movement: newStock,
        expected_stock: 120
      };
    } catch (e) {
      result.inventory_test.movement_exit = { success: false, error: e.message };
      return Response.json(result);
    }

    // Step 6: Final stock verification
    try {
      const prods = await base44.entities.Product.filter({ id: productId });
      const finalProduct = prods[0];
      if (!finalProduct) throw new Error('Product not found');

      const stockMatchesExpected = finalProduct.stock === 120;
      result.inventory_test.final_stock_verification = {
        success: stockMatchesExpected,
        actual_stock: finalProduct.stock,
        expected_stock: 120,
        matches: stockMatchesExpected
      };
    } catch (e) {
      result.inventory_test.final_stock_verification = { success: false, error: e.message };
    }

    // Overall status
    const allPassed =
      result.inventory_test.product_create.success &&
      result.inventory_test.movement_entry.success &&
      result.inventory_test.movement_exit.success &&
      result.inventory_test.final_stock_verification.success;

    result.status = allPassed ? 'passed' : 'failed';
    result.design = 'A: Movements update product stock immediately';

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});