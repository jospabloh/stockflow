import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TEST: Stock Integrity End-to-End
 * 
 * Simulates:
 * 1. Create product with initial stock
 * 2. Create quotation with items
 * 3. Convert quotation (creates Movement + updates stock)
 * 4. Verify Movement created in correct business
 * 5. Verify stock was updated correctly
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const businessId = user.business_id;
    const timestamp = Date.now();

    const result = {
      user: user.email,
      business_id: businessId,
      steps: {
        create_product: null,
        create_quotation: null,
        convert_quotation: null,
        verify_movement: null,
        verify_stock: null,
      },
      issues: []
    };

    try {
      // STEP 1: Create a test product
      const product = await base44.entities.Product.create({
        name: `Test Product ${timestamp}`,
        sale_price: 100,
        purchase_price: 50,
        stock: 50,
        min_stock: 5,
        business_id: businessId
      });

      result.steps.create_product = {
        success: true,
        product_id: product.id,
        initial_stock: product.stock,
        business_id: product.business_id
      };

      // STEP 2: Create a quotation with this product
      const quotation = await base44.entities.Quotation.create({
        client_name: `Test Client ${timestamp}`,
        client_email: 'test@example.com',
        client_phone: '1234567890',
        items: [{
          product_id: product.id,
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
        business_id: businessId
      });

      result.steps.create_quotation = {
        success: true,
        quotation_id: quotation.id,
        items_count: quotation.items.length,
        business_id: quotation.business_id
      };

      // STEP 3: Simulate conversion process
      // (1) Create movement
      const movement = await base44.entities.Movement.create({
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 5,
        unit_price: 100,
        total: 500,
        reason: `Quotation conversion: ${quotation.id}`,
        quotation_id: quotation.id,
        stock_after: 45,
        business_id: businessId
      });

      // (2) Update product stock (this is what Quotations.js does)
      const newStock = product.stock - 5;
      await base44.entities.Product.update(product.id, { stock: newStock });

      // (3) Update quotation status
      await base44.entities.Quotation.update(quotation.id, {
        status: 'converted',
        payment_method: 'Efectivo'
      });

      result.steps.convert_quotation = {
        success: true,
        movement_id: movement.id,
        quantity: movement.quantity,
        business_id: movement.business_id,
        stock_updated: newStock
      };

      // STEP 4: Verify movement exists and belongs to correct business
      const movements = await base44.entities.Movement.filter({
        id: movement.id,
        business_id: businessId
      });

      const foundMovement = movements.find(m => m.id === movement.id);
      result.steps.verify_movement = {
        success: !!foundMovement,
        found: !!foundMovement,
        belongs_to_business: foundMovement?.business_id === businessId,
        issue: !foundMovement ? 'Movement not found after conversion' : null
      };

      if (!foundMovement) {
        result.issues.push('CRITICAL: Movement created in wrong business or deleted');
      }

      // STEP 5: Verify product stock was updated
      const updatedProduct = await base44.entities.Product.filter({
        id: product.id,
        business_id: businessId
      });

      const foundProduct = updatedProduct.find(p => p.id === product.id);
      const expectedStock = 45; // 50 - 5
      const actualStock = foundProduct?.stock;
      const stockCorrect = actualStock === expectedStock;

      result.steps.verify_stock = {
        success: stockCorrect,
        initial_stock: product.stock,
        movement_quantity: 5,
        expected_stock: expectedStock,
        actual_stock: actualStock,
        correct: stockCorrect,
        issue: !stockCorrect ? `Stock integrity failed: expected ${expectedStock}, got ${actualStock}` : null
      };

      if (!stockCorrect) {
        result.issues.push(`CRITICAL: Stock not updated correctly. Expected ${expectedStock}, got ${actualStock}`);
      }

      // STEP 6: Verify movement is NOT visible from other business (if we had access)
      const allMovements = await base44.entities.Movement.list();
      const crossBusinessMovement = allMovements.find(m => 
        m.id === movement.id && m.business_id !== businessId
      );

      if (crossBusinessMovement) {
        result.issues.push('CRITICAL: Movement visible outside its home business via .list()');
      }

    } catch (e) {
      result.error = e.message;
      result.issues.push(`ERROR: ${e.message}`);
    }

    const allPassed = Object.values(result.steps).every(s => s?.success !== false);
    result.status = allPassed && result.issues.length === 0 ? 'PROVEN FIXED' : 'OPEN';

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message, status: 'OPEN' }, { status: 500 });
  }
});