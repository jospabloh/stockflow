import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();



    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'No business_id associated with user' }, { status: 400 });
    }

    // FIRST: Delete all existing movements and quotations for CLEAN test
    const existingMovements = await base44.entities.Movement.filter({ business_id: businessId }, '-created_date', 10000);
    const existingQuotations = await base44.entities.Quotation.filter({ business_id: businessId }, '-created_date', 10000);
    
    for (const mov of existingMovements) {
      await base44.entities.Movement.delete(mov.id);
    }
    for (const quot of existingQuotations) {
      await base44.entities.Quotation.delete(quot.id);
    }

    // Get a product to use for test data
    const products = await base44.entities.Product.filter({ business_id: businessId }, '-created_date', 1);
    if (!products.length) {
      return Response.json({ error: 'No products found' }, { status: 400 });
    }

    const product = products[0];
    // HOY en México = 2026-04-02 (desde 00:00 a 23:59 hora México = UTC-6)
    // UTC timestamps para hoy: 2026-04-02 06:00 UTC a 2026-04-03 05:59 UTC
    const baseDate = new Date(Date.UTC(2026, 3, 2, 12, 0, 0)); // 2026-04-02 12:00 UTC = 2026-04-02 06:00 México

    // Generate varied data: 
    // TODAY (2026-04-02): 3 movements = $450
    // 3 DAYS AGO (2026-03-30): 2 movements = $300  
    // 8 DAYS AGO (2026-03-25): 4 movements = $600
    // 35 DAYS AGO (2026-02-26): 5 movements = $750
    // GOAL: day < week < month < year

    const testMovements = [
      // TODAY: 3 movements
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 3,
        unit_price: 150,
        cost_price: 75,
        total: 450,
        reason: 'Cliente A Hoy',
        reference: 'Efectivo',
        business_id: businessId,
        paid: true,
        created_date: new Date(baseDate.getTime()).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 2,
        unit_price: 150,
        cost_price: 75,
        total: 300,
        reason: 'Cliente B Hoy',
        reference: 'Tarjeta',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() + 3600000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'entry',
        quantity: 10,
        unit_price: 75,
        cost_price: 75,
        total: 750,
        reason: 'Entrada de proveedor',
        reference: 'Crédito',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() + 7200000).toISOString(),
      },

      // 3 DAYS AGO: 2 movements
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 2,
        unit_price: 150,
        cost_price: 75,
        total: 300,
        reason: 'Cliente C hace 3 días',
        reference: 'Efectivo',
        business_id: businessId,
        paid: true,
        created_date: new Date(baseDate.getTime() - 3 * 24 * 3600000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 1,
        unit_price: 150,
        cost_price: 75,
        total: 150,
        reason: 'Cliente D hace 3 días',
        reference: 'Tarjeta',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() - 3 * 24 * 3600000 + 3600000).toISOString(),
      },

      // 8 DAYS AGO: 4 movements
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 2,
        unit_price: 150,
        cost_price: 75,
        total: 300,
        reason: 'Cliente E hace 8 días',
        reference: 'Efectivo',
        business_id: businessId,
        paid: true,
        created_date: new Date(baseDate.getTime() - 8 * 24 * 3600000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 1,
        unit_price: 150,
        cost_price: 75,
        total: 150,
        reason: 'Cliente F hace 8 días',
        reference: 'Tarjeta',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() - 8 * 24 * 3600000 + 3600000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 1,
        unit_price: 150,
        cost_price: 75,
        total: 150,
        reason: 'Cliente G hace 8 días',
        reference: 'Crédito',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() - 8 * 24 * 3600000 + 7200000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'entry',
        quantity: 5,
        unit_price: 75,
        cost_price: 75,
        total: 375,
        reason: 'Entrada hace 8 días',
        reference: 'Crédito',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() - 8 * 24 * 3600000 + 10800000).toISOString(),
      },

      // 35 DAYS AGO: 5 movements
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 2,
        unit_price: 150,
        cost_price: 75,
        total: 300,
        reason: 'Cliente H hace 35 días',
        reference: 'Efectivo',
        business_id: businessId,
        paid: true,
        created_date: new Date(baseDate.getTime() - 35 * 24 * 3600000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 1,
        unit_price: 150,
        cost_price: 75,
        total: 150,
        reason: 'Cliente I hace 35 días',
        reference: 'Tarjeta',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() - 35 * 24 * 3600000 + 3600000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 2,
        unit_price: 150,
        cost_price: 75,
        total: 300,
        reason: 'Cliente J hace 35 días',
        reference: 'Crédito',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() - 35 * 24 * 3600000 + 7200000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 1,
        unit_price: 150,
        cost_price: 75,
        total: 150,
        reason: 'Cliente K hace 35 días',
        reference: 'Efectivo',
        business_id: businessId,
        paid: true,
        created_date: new Date(baseDate.getTime() - 35 * 24 * 3600000 + 10800000).toISOString(),
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'entry',
        quantity: 10,
        unit_price: 75,
        cost_price: 75,
        total: 750,
        reason: 'Entrada hace 35 días',
        reference: 'Crédito',
        business_id: businessId,
        paid: false,
        created_date: new Date(baseDate.getTime() - 35 * 24 * 3600000 + 14400000).toISOString(),
      },
    ];

    // Create all movements
    const created = await base44.entities.Movement.bulkCreate(testMovements);

    // Calculate expected totals
    const dayRevenue = 450 + 300; // 750
    const weekRevenue = dayRevenue + 300 + 150; // 1200
    const monthRevenue = weekRevenue + 300 + 150 + 150 + 150; // 1950
    const yearRevenue = monthRevenue + 300 + 150 + 300 + 150 + 750; // 3600

    return Response.json({
      status: 'success',
      created_count: created.length,
      expected_revenues: {
        day: dayRevenue,
        week: weekRevenue,
        month: monthRevenue,
        year: yearRevenue,
      },
      message: 'Test data created: día < semana < mes < año',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});