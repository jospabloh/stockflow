import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;

    // Fetch a product and clients for test data
    const products = await base44.entities.Product.filter({ business_id: businessId }, '-created_date', 5);
    const clients = await base44.entities.Client.filter({ business_id: businessId }, '-created_date', 5);

    if (products.length === 0) {
      return Response.json({ error: 'No products found' }, { status: 400 });
    }

    if (clients.length === 0) {
      return Response.json({ error: 'No clients found' }, { status: 400 });
    }

    const product = products[0];
    const client = clients[0];

    // Timezone: México City (UTC-6 fixed, no daylight saving)
    const now = new Date();
    const movements = [];
    const quotations = [];

    // Generate data for last 30 days (including today)
    for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);

      // 2 movements per day: 1 entry, 1 exit
      // Movement 1: Entry
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
        stock_after: (product.stock || 0) + 10,
        paid: true,
        business_id: businessId,
        created_date: date.toISOString()
      });

      // Movement 2: Exit (direct sale, not linked to quotation)
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
        stock_after: (product.stock || 0) + 10 - 5,
        paid: daysAgo > 5, // Older sales are paid, recent ones are unpaid
        business_id: businessId,
        created_date: new Date(date.getTime() + 3600000).toISOString() // 1 hour after entry
      });

      // Quotation every other day
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
          status: daysAgo > 10 ? 'converted' : 'draft',
          invoice_status: 'pendiente',
          notes: 'Datos de prueba',
          payment_method: 'Efectivo',
          in_route: false,
          delivered: daysAgo > 10,
          paid: daysAgo > 15, // Only older quotations are paid
          business_id: businessId,
          created_date: new Date(date.getTime() + 7200000).toISOString() // 2 hours after entry
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
      message: 'Monthly test data generated (30 days)'
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});