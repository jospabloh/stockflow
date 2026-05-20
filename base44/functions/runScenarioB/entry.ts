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
    const clientId = '69c59176ff16c53b64131d3e';
    const results = {
      steps: [],
      movements: []
    };

    // Get current product state
    const prods = await base44.entities.Product.filter({ id: productId, business_id: bId });
    const product = prods[0];
    results.stockBeforeQuotation = product.stock;
    results.steps.push({ step: 'Before quotation', stock: product.stock });

    // STEP 1: Create Quotation
    const quotation = await base44.entities.Quotation.create({
      folio: `COT-TEST-001`,
      client_id: clientId,
      client_name: 'Cliente TEST',
      client_email: 'test@cliente.com',
      client_phone: '5551234567',
      items: [{
        product_id: productId,
        product_name: product.name,
        quantity: 20,
        unit_price: 150.00,
        total: 3000.00,
        tax_rate: 16
      }],
      subtotal: 3000.00,
      tax: 480.00,
      total: 3480.00,
      status: 'draft',
      payment_method: 'Efectivo',
      business_id: bId
    });
    results.quotationId = quotation.id;
    results.steps.push({ step: 'Created quotation', quotationId: quotation.id, status: quotation.status });

    // STEP 2: Convert Quotation to Sale
    // Validate stock
    if (20 > (product.stock || 0)) {
      return Response.json({ error: `Insufficient stock: have ${product.stock}, need 20` }, { status: 400 });
    }

    // Create EXIT movement for conversion
    const exitMovement = await base44.entities.Movement.create({
      product_id: productId,
      product_name: product.name,
      type: 'exit',
      quantity: 20,
      unit_price: 150.00,
      total: 3000.00,
      stock_after: (product.stock || 0) - 20,
      reference: `Venta ${quotation.folio}`,
      reason: `Venta a Cliente TEST`,
      quotation_id: quotation.id,
      business_id: bId
    });
    results.movements.push(exitMovement.id);
    
    // Update product stock
    const newStock = (product.stock || 0) - 20;
    await base44.entities.Product.update(productId, { stock: newStock });
    
    // Mark quotation as converted
    await base44.entities.Quotation.update(quotation.id, {
      status: 'converted',
      payment_method: 'Efectivo'
    });
    
    results.stockAfterConversion = newStock;
    results.steps.push({ step: 'Converted to sale', stock: newStock, exitMovement: exitMovement.id });

    // STEP 3: Cancel converted quotation (reverse stock)
    const exitMovements = await base44.entities.Movement.filter({
      quotation_id: quotation.id,
      type: 'exit',
      business_id: bId
    });

    for (const exitMov of exitMovements) {
      const prods2 = await base44.entities.Product.filter({ id: exitMov.product_id, business_id: bId });
      const prod = prods2[0];

      if (prod) {
        const restoredStock = (prod.stock || 0) + exitMov.quantity;

        // Create RETURN movement
        const returnMovement = await base44.entities.Movement.create({
          product_id: exitMov.product_id,
          product_name: exitMov.product_name,
          type: 'return',
          quantity: exitMov.quantity,
          unit_price: exitMov.unit_price,
          total: exitMov.total,
          stock_after: restoredStock,
          reference: `Cancelación ${quotation.folio}`,
          reason: `Cancelación: TEST-SCENARIO-B`,
          quotation_id: quotation.id,
          business_id: bId
        });
        results.movements.push(returnMovement.id);

        // Update product stock
        await base44.entities.Product.update(prod.id, { stock: restoredStock });
        results.stockAfterCancellation = restoredStock;
      }
    }

    // Mark quotation as cancelled
    await base44.entities.Quotation.update(quotation.id, {
      status: 'cancelled',
      cancellation_reason: 'TEST-SCENARIO-B'
    });

    results.steps.push({ step: 'Cancelled quotation', stock: results.stockAfterCancellation });

    // Verify final state
    const finalProds = await base44.entities.Product.filter({ id: productId, business_id: bId });
    const finalProduct = finalProds[0];
    results.finalStock = finalProduct.stock;
    results.success = results.finalStock === results.stockBeforeQuotation;

    // Verify movements are isolated to business
    const allMovements = await base44.entities.Movement.filter({ business_id: bId }, '-created_date', 1000);
    const quotationMovements = allMovements.filter(m => m.quotation_id === quotation.id);
    results.quotationMovementsCount = quotationMovements.length;

    return Response.json({
      success: results.success,
      businessId: bId,
      results
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message, stack: error.stack }, { status: 500 });
  }
});