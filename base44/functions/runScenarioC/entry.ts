import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bId = user.business_id;
    const results = {
      checks: []
    };

    // 1. Dashboard data isolation
    const products = await base44.entities.Product.filter({ business_id: bId });
    const movements = await base44.entities.Movement.filter({ business_id: bId }, '-created_date', 200);
    const quotations = await base44.entities.Quotation.filter({ business_id: bId }, '-created_date', 200);
    
    results.checks.push({
      check: 'Products filtered by business_id',
      count: products.length,
      allBelongToBusiness: products.every(p => p.business_id === bId),
      businessId: bId
    });

    results.checks.push({
      check: 'Movements filtered by business_id',
      count: movements.length,
      allBelongToBusiness: movements.every(m => m.business_id === bId),
      businessId: bId
    });

    results.checks.push({
      check: 'Quotations filtered by business_id',
      count: quotations.length,
      allBelongToBusiness: quotations.every(q => q.business_id === bId),
      businessId: bId
    });

    // 2. Calculate dashboard metrics
    const activeProducts = products.filter(p => p.status === 'active');
    const totalStock = activeProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalValue = activeProducts.reduce((sum, p) => sum + (p.stock || 0) * (p.purchase_price || 0), 0);
    
    results.checks.push({
      check: 'Dashboard metrics',
      activeProducts: activeProducts.length,
      totalStock,
      totalValue,
      lowStockProducts: activeProducts.filter(p => p.stock <= (p.min_stock || 5)).length
    });

    // 3. Today's sales calculation
    const today = new Date().toDateString();
    const todayMovements = movements.filter(m => new Date(m.created_date).toDateString() === today);
    const todayExits = todayMovements.filter(m => m.type === 'exit');
    const todayRevenue = todayExits.reduce((sum, m) => sum + (m.total || 0), 0);
    const todayCost = todayExits.reduce((sum, m) => sum + ((m.quantity || 0) * (m.unit_price || 0)), 0);
    
    results.checks.push({
      check: 'Today sales metrics',
      todayMovementsCount: todayMovements.length,
      todayExitsCount: todayExits.length,
      todayRevenue,
      todayCost,
      todayProfit: todayRevenue - todayCost
    });

    // 4. CSV Export validation
    const csvData = [];
    csvData.push(['Producto', 'SKU', 'Stock', 'Precio Compra', 'Valor Total'].join(','));
    products.forEach(p => {
      csvData.push([
        p.name,
        p.sku || '',
        p.stock || 0,
        p.purchase_price || 0,
        ((p.stock || 0) * (p.purchase_price || 0)).toFixed(2)
      ].join(','));
    });
    
    results.checks.push({
      check: 'CSV Export generation',
      csvRowsCount: csvData.length,
      csvValid: csvData.length > 1
    });

    // 5. Verify no cross-business contamination
    const allProductsGlobal = await base44.entities.Product.list('-created_date', 1000);
    const allMovementsGlobal = await base44.entities.Movement.list('-created_date', 1000);
    const allQuotationsGlobal = await base44.entities.Quotation.list('-created_date', 1000);

    results.checks.push({
      check: 'Global data safety (LIST should NOT be used, but verifying isolation)',
      globalProducts: allProductsGlobal.length,
      productsForThisBusiness: products.length,
      allProductsFilteredCorrectly: allProductsGlobal.every(p => p.business_id === bId || p.business_id === null),
      globalMovements: allMovementsGlobal.length,
      movementsForThisBusiness: movements.length,
      allMovementsFilteredCorrectly: allMovementsGlobal.every(m => m.business_id === bId || m.business_id === null),
      globalQuotations: allQuotationsGlobal.length,
      quotationsForThisBusiness: quotations.length,
      allQuotationsFilteredCorrectly: allQuotationsGlobal.every(q => q.business_id === bId || q.business_id === null)
    });

    const success = results.checks.every(c => {
      if (c.allBelongToBusiness !== undefined) return c.allBelongToBusiness;
      if (c.csvValid !== undefined) return c.csvValid;
      if (c.allProductsFilteredCorrectly !== undefined) return c.allProductsFilteredCorrectly;
      return true;
    });

    return Response.json({
      success,
      businessId: bId,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});