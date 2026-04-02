import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'No business_id associated with user' }, { status: 400 });
    }

    // 1. Obtener datos existentes
    const [products, movements, quotations] = await Promise.all([
      base44.entities.Product.filter({ business_id: businessId }, '-created_date', 100),
      base44.entities.Movement.filter({ business_id: businessId }, '-created_date', 100),
      base44.entities.Quotation.filter({ business_id: businessId }, '-created_date', 100),
    ]);

    // 2. Crear datos de prueba para hoy (si no existen)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verificar si ya existen movimientos de hoy
    const todayMovements = movements.filter(m => {
      const mDate = new Date(m.created_date);
      mDate.setHours(0, 0, 0, 0);
      return mDate.getTime() === today.getTime();
    });

    let testData = {
      user_email: user.email,
      business_id: businessId,
      total_products: products.length,
      total_movements: movements.length,
      total_quotations: quotations.length,
      movements_today: todayMovements.length,
      test_status: 'already_has_data',
      created_new_data: false,
    };

    // Si no hay datos de hoy, crear algunos
    if (todayMovements.length === 0 && products.length > 0) {
      const product = products[0];
      
      // Crear 3 movimientos de salida para hoy
      const newMovements = await base44.entities.Movement.bulkCreate([
        {
          product_id: product.id,
          product_name: product.name,
          type: 'exit',
          quantity: 5,
          unit_price: product.retail_sale_price || 100,
          cost_price: product.purchase_price || 50,
          total: (product.retail_sale_price || 100) * 5,
          reason: 'Cliente Test 1',
          reference: 'Efectivo',
          business_id: businessId,
          paid: true,
        },
        {
          product_id: product.id,
          product_name: product.name,
          type: 'exit',
          quantity: 3,
          unit_price: product.retail_sale_price || 100,
          cost_price: product.purchase_price || 50,
          total: (product.retail_sale_price || 100) * 3,
          reason: 'Cliente Test 2',
          reference: 'Tarjeta',
          business_id: businessId,
          paid: false,
        },
        {
          product_id: product.id,
          product_name: product.name,
          type: 'exit',
          quantity: 2,
          unit_price: product.retail_sale_price || 100,
          cost_price: product.purchase_price || 50,
          total: (product.retail_sale_price || 100) * 2,
          reason: 'Cliente Test 3',
          reference: 'Efectivo',
          business_id: businessId,
          paid: true,
        },
      ]);

      testData.created_new_data = true;
      testData.test_status = 'data_created';
      testData.new_movements_count = newMovements.length;
    }

    // 3. Test de filtrado por período
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const allMovements = await base44.entities.Movement.filter({ business_id: businessId }, '-created_date', 200);
    const todayFiltered = allMovements.filter(m => {
      const mDate = new Date(m.created_date);
      return mDate >= dayStart && mDate <= dayEnd;
    });

    const exitMovements = todayFiltered.filter(m => m.type === 'exit');
    const salesRevenue = exitMovements.reduce((sum, m) => sum + (m.total || 0), 0);
    const paidTotal = exitMovements.filter(m => m.paid).reduce((sum, m) => sum + (m.total || 0), 0);
    const unpaidTotal = exitMovements.filter(m => !m.paid).reduce((sum, m) => sum + (m.total || 0), 0);

    testData.filter_test = {
      day_start: dayStart.toISOString(),
      day_end: dayEnd.toISOString(),
      total_today: todayFiltered.length,
      exit_movements: exitMovements.length,
      sales_revenue: salesRevenue,
      paid_total: paidTotal,
      unpaid_total: unpaidTotal,
    };

    return Response.json(testData, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});