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

    const createdCount = { movements: 0, quotations: 0 };

    // Create one movement per day for the past 7 days using individual create calls
    // This allows us to control the created_date per record
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - daysAgo);
      baseDate.setHours(10, 30, 0, 0); // 10:30 UTC

      const entryDate = new Date(baseDate);
      const exitDate = new Date(baseDate);
      exitDate.setHours(11, 0, 0, 0);

      // Use raw database insert via asServiceRole if possible
      // Otherwise create one at a time to set timestamps

      // For now: create individual movements with explicit timestamps
      // Note: The base44 SDK might not support created_date override.
      // As a workaround, we'll create them with a small artificial time spread

      const salePrice = product.retail_sale_price || 150;

      // Create entry
      await base44.entities.Movement.create({
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
      createdCount.movements++;

      // Create exit (direct sale)
      await base44.entities.Movement.create({
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
        paid: daysAgo > 3,
        business_id: businessId
      });
      createdCount.movements++;

      // Create quotation every other day
      if (daysAgo % 2 === 0) {
        const totalQuot = 5 * salePrice;
        await base44.entities.Quotation.create({
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
          paid: daysAgo > 4,
          business_id: businessId
        });
        createdCount.quotations++;
      }
    }

    return Response.json({
      status: 'success',
      created_movements: createdCount.movements,
      created_quotations: createdCount.quotations,
      message: 'Weekly test data generated (note: all created today - timestamp override not supported by SDK)'
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});