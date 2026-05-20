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

    // Obtener productos
    const products = await base44.entities.Product.filter({ business_id: businessId }, '-created_date', 10);
    
    if (products.length === 0) {
      return Response.json({ error: 'No products found for business' }, { status: 400 });
    }

    const product = products[0];
    const now = new Date();
    const movements = [];

    // Crear movimientos con fechas variadas para prueba
    // 3 movimientos de HOY
    movements.push({
      product_id: product.id,
      product_name: product.name,
      type: 'exit',
      quantity: 5,
      unit_price: product.retail_sale_price || 100,
      cost_price: product.purchase_price || 50,
      total: (product.retail_sale_price || 100) * 5,
      reason: 'Hoy - Venta 1',
      reference: 'Efectivo',
      business_id: businessId,
      paid: true,
    });
    movements.push({
      product_id: product.id,
      product_name: product.name,
      type: 'exit',
      quantity: 3,
      unit_price: product.retail_sale_price || 100,
      cost_price: product.purchase_price || 50,
      total: (product.retail_sale_price || 100) * 3,
      reason: 'Hoy - Venta 2',
      reference: 'Tarjeta',
      business_id: businessId,
      paid: false,
    });

    // 2 movimientos de HACE 3 DÍAS (misma semana pero distinto día)
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    movements.push({
      product_id: product.id,
      product_name: product.name,
      type: 'exit',
      quantity: 7,
      unit_price: product.retail_sale_price || 100,
      cost_price: product.purchase_price || 50,
      total: (product.retail_sale_price || 100) * 7,
      reason: 'Hace 3 días - Venta',
      reference: 'Efectivo',
      business_id: businessId,
      paid: true,
    });

    // 2 movimientos de HACE 8 DÍAS (semana pasada)
    const eightDaysAgo = new Date(now);
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    movements.push({
      product_id: product.id,
      product_name: product.name,
      type: 'exit',
      quantity: 4,
      unit_price: product.retail_sale_price || 100,
      cost_price: product.purchase_price || 50,
      total: (product.retail_sale_price || 100) * 4,
      reason: 'Hace 8 días - Venta',
      reference: 'Tarjeta',
      business_id: businessId,
      paid: true,
    });

    // 2 movimientos de HACE 35 DÍAS (mes pasado)
    const thirtyFiveDaysAgo = new Date(now);
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);
    movements.push({
      product_id: product.id,
      product_name: product.name,
      type: 'exit',
      quantity: 6,
      unit_price: product.retail_sale_price || 100,
      cost_price: product.purchase_price || 50,
      total: (product.retail_sale_price || 100) * 6,
      reason: 'Hace 35 días - Venta',
      reference: 'Efectivo',
      business_id: businessId,
      paid: true,
    });

    // Bulk crear todos los movimientos
    const created = await base44.entities.Movement.bulkCreate(movements);

    // Verificar filtrado
    const allMovs = await base44.entities.Movement.filter({ business_id: businessId }, '-created_date', 200);
    
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now);
    monthEnd.setHours(23, 59, 59, 999);

    // Convertir UTC a local timezone para comparación correcta
    // Helper para convertir timestamp UTC a fecha local (México City es UTC-6)
    const convertUTCToLocalDate = (isoString) => {
      const utcDate = new Date(isoString);
      // México City timezone offset: UTC-6 hours = -360 minutes
      const mexicoCityOffset = -6 * 60; // en minutos
      const localTime = new Date(utcDate.getTime() + (mexicoCityOffset + utcDate.getTimezoneOffset()) * 60000);
      return localTime;
    };

    const todayMovs = allMovs.filter(m => {
      const localDate = convertUTCToLocalDate(m.created_date);
      return localDate >= dayStart && localDate <= dayEnd;
    });
    const weekMovs = allMovs.filter(m => {
      const localDate = convertUTCToLocalDate(m.created_date);
      return localDate >= weekStart && localDate <= weekEnd;
    });
    const monthMovs = allMovs.filter(m => {
      const localDate = convertUTCToLocalDate(m.created_date);
      return localDate >= monthStart && localDate <= monthEnd;
    });

    return Response.json({
      status: 'success',
      created_movements: created.length,
      total_movements: allMovs.length,
      filter_test: {
        day: { count: todayMovs.length, revenue: todayMovs.reduce((s, m) => s + (m.total || 0), 0) },
        week: { count: weekMovs.length, revenue: weekMovs.reduce((s, m) => s + (m.total || 0), 0) },
        month: { count: monthMovs.length, revenue: monthMovs.reduce((s, m) => s + (m.total || 0), 0) },
      }
    }, { status: 200 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});