import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bId = user.business_id;
    const results = {};

    // 1. Create Category TEST
    const category = await base44.entities.Category.create({
      name: 'TEST-Electrónica',
      description: 'Categoría de prueba',
      color: '#FF5733',
      business_id: bId
    });
    results.category = { id: category.id, name: category.name, business_id: category.business_id };

    // 2. Create Client TEST
    const client = await base44.entities.Client.create({
      name: 'Cliente TEST',
      email: 'test@cliente.com',
      phone: '5551234567',
      address: 'Calle TEST 123',
      rfc: 'TST200101ABC',
      status: 'active',
      business_id: bId
    });
    results.client = { id: client.id, name: client.name, business_id: client.business_id };

    // 3. Create Product TEST
    const product = await base44.entities.Product.create({
      name: 'Producto TEST',
      sku: 'TEST-0001',
      barcode: 'TEST-BARCODE-001',
      description: 'Producto de prueba para ciclo 1',
      category: category.id,
      purchase_price: 100.00,
      sale_price: 150.00,
      stock: 0,
      min_stock: 5,
      unit: 'pieza',
      tax_rate: 16,
      status: 'active',
      business_id: bId
    });
    results.product = { 
      id: product.id, 
      name: product.name, 
      stock: product.stock, 
      business_id: product.business_id 
    };

    return Response.json({
      success: true,
      businessId: bId,
      data: results
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});