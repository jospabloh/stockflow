import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;

    // Fetch products and clients
    const products = await base44.entities.Product.filter({ business_id: businessId }, '-created_date', 5);
    const clients = await base44.entities.Client.filter({ business_id: businessId }, '-created_date', 5);

    if (products.length === 0 || clients.length === 0) {
      return Response.json({ error: 'Need products and clients' }, { status: 400 });
    }

    const product = products[0];
    const client = clients[0];

    // Create TODAY data
    const movements = [];
    const quotations = [];

    // 2 Direct sales (salidas directas sin cotización)
    movements.push(
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 3,
        unit_price: product.retail_sale_price || 150,
        cost_price: product.purchase_price || 100,
        total: 3 * (product.retail_sale_price || 150),
        reason: client.name,
        reference: 'Efectivo',
        stock_after: 100,
        paid: false,
        business_id: businessId
      },
      {
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 2,
        unit_price: product.retail_sale_price || 150,
        cost_price: product.purchase_price || 100,
        total: 2 * (product.retail_sale_price || 150),
        reason: 'Otro cliente',
        reference: 'Tarjeta',
        stock_after: 98,
        paid: true,
        business_id: businessId
      }
    );

    // 1 Quotation converted (cotización concretada)
    const totalQuot = 5 * (product.retail_sale_price || 150);
    quotations.push({
      folio: 'Q-001',
      client_id: client.id,
      client_name: client.name,
      client_email: client.email || '',
      client_phone: client.phone || '',
      items: [
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 5,
          unit_price: product.retail_sale_price || 150,
          total: totalQuot,
          tax_rate: product.tax_rate || 16
        }
      ],
      subtotal: totalQuot,
      tax: Math.round(totalQuot * ((product.tax_rate || 16) / 100) * 100) / 100,
      total: totalQuot + Math.round(totalQuot * ((product.tax_rate || 16) / 100) * 100) / 100,
      status: 'converted',
      invoice_status: 'pendiente',
      payment_method: 'Efectivo',
      delivered: true,
      paid: false,
      business_id: businessId
    });

    await base44.entities.Movement.bulkCreate(movements);
    await base44.entities.Quotation.bulkCreate(quotations);

    return Response.json({
      status: 'success',
      movements_created: movements.length,
      quotations_created: quotations.length,
      details: {
        direct_exits: 2,
        converted_quotations: 1,
        unpaid_direct: 1,
        unpaid_quotations: 1
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});