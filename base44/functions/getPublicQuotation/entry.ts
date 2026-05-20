import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'token is required' }, { status: 400 });
    }

    const results = await base44.asServiceRole.entities.Quotation.filter({
      public_token: token,
      public_link_enabled: true,
    });

    if (!results || results.length === 0) {
      return Response.json({ error: 'Quotation not found or link is disabled' }, { status: 404 });
    }

    const q = results[0];

    // Fetch business info for branding
    let business = null;
    try {
      business = await base44.asServiceRole.entities.Business.get(q.business_id);
    } catch (_) {}

    // Return only safe public fields — never expose cost prices, payments, or internal IDs
    const safeItems = (q.items || []).map((item: any) => ({
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      tax_rate: item.tax_rate ?? 0,
      is_on_demand: item.is_on_demand ?? false,
      product_description: item.product_description ?? null,
    }));

    return Response.json({
      folio: q.folio,
      client_name: q.client_name,
      client_email: q.client_email ?? null,
      client_phone: q.client_phone ?? null,
      items: safeItems,
      subtotal: q.subtotal ?? 0,
      tax: q.tax ?? 0,
      total: q.total ?? 0,
      status: q.status,
      valid_until: q.valid_until ?? null,
      notes: q.notes ?? null,
      payment_method: q.payment_method ?? null,
      created_date: q.created_date ?? null,
      business: business ? {
        name: business.name,
        logo_url: business.logo_url ?? null,
        primary_color: business.primary_color ?? '#4F46E5',
        address: business.address ?? null,
        phone: business.phone ?? null,
        quotation_footer: business.quotation_footer ?? null,
      } : null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
