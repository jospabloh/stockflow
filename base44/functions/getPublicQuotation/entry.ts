import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token } = body;

    if (!token) return Response.json({ error: 'token is required' }, { status: 400 });

    const quotations = await base44.asServiceRole.entities.Quotation.filter({
      public_token: token,
      public_link_enabled: true,
    });

    if (quotations.length === 0) {
      return Response.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const q = quotations[0];

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: q.business_id });
    const biz = businesses[0] ?? {};

    const safeItems = (q.items || []).map((item: any) => ({
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      tax_rate: item.tax_rate,
      product_description: item.product_description,
    }));

    return Response.json({
      folio: q.folio,
      client_name: q.client_name,
      items: safeItems,
      subtotal: q.subtotal,
      tax: q.tax,
      total: q.total,
      status: q.status,
      valid_until: q.valid_until,
      notes: q.notes,
      payment_method: q.payment_method,
      business: {
        name: biz.name,
        logo_url: biz.logo_url,
        primary_color: biz.primary_color,
        address: biz.address,
        phone: biz.phone,
        quotation_footer: biz.quotation_footer,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
