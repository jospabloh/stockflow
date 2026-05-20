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

    // Create data for last 7 days (including today)
    const movements = [];
    const quotations = [];

    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      // 2 movements per day: 1 entry, 1 exit (direct)
      // Entry
      movements.push({
        product_id: product.id,
        product_name: product.name,
        type: 'entry',
        quantity: 10,
        unit_price: product.purchase_price || 100,
        cost_price: product.purchase_price || 100,
        total: 10 * (product.purchase_price || 100),
        reason: `Entrada de ${product.name}`,
        reference: 'Proveedor',
        stock_after: 100 + (10 * daysAgo),
        paid: true,
        business_id: businessId
      });

      // Exit (direct sale)
      const salePrice = product.retail_sale_price || 150;
      movements.push({
        product_id: product.id,
        product_name: product.name,
        type: 'exit',
        quantity: 5,
        unit_price: salePrice,
        cost_price: product.purchase_price || 100,
        total: 5 * salePrice,
        reason: client.name,
        reference: 'Efectivo',
        stock_after: 95 + (10 * daysAgo),
        paid: daysAgo > 3, // Recent 3 days are unpaid
        business_id: businessId
      });

      // 1 Quotation every other day
      if (daysAgo % 2 === 0) {
        const totalQuot = 5 * salePrice;
        quotations.push({
          folio: `Q-${daysAgo}`,
          client_id: client.id,
          client_name: client.name,
          client_email: client.email || '',
          client_phone: client.phone || '',
          items: [
            {
              product_id: product.id,
              product_name: product.name,
              quantity: 5,
              unit_price: salePrice,
              total: totalQuot,
              tax_rate: product.tax_rate || 16
            }
          ],
          subtotal: totalQuot,
          tax: Math.round(totalQuot * ((product.tax_rate || 16) / 100) * 100) / 100,
          total: totalQuot + Math.round(totalQuot * ((product.tax_rate || 16) / 100) * 100) / 100,
          status: daysAgo > 2 ? 'converted' : 'draft',
          invoice_status: 'pendiente',
          notes: 'Datos de prueba',
          payment_method: 'Efectivo',
          in_route: false,
          delivered: daysAgo > 2,
          paid: daysAgo > 4, // Only older ones are paid
          business_id: businessId
        });
      }
    }

    // Bulk insert
    await base44.entities.Movement.bulkCreate(movements);
    await base44.entities.Quotation.bulkCreate(quotations);

    return Response.json({
      status: 'success',
      created_movements: movements.length,
      created_quotations: quotations.length,
      days_covered: 7,
      message: 'Weekly test data generated'
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});