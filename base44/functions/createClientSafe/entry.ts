import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name, phone, business_id,
      business_name, giro, email, address, rfc, notes, status,
      force_wholesale_all_products, force_purchase_all_products
    } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }

    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: business_id mismatch' }, { status: 403 });
    }

    if (!name?.trim() || !business_name?.trim() || !phone?.trim()) {
      return Response.json({ success: false, error: 'Nombre de contacto, nombre de negocio y teléfono son requeridos' }, { status: 400 });
    }

    // VALIDATION: Mutually exclusive pricing flags
    if (force_wholesale_all_products && force_purchase_all_products) {
      return Response.json({
        success: false,
        error: 'No es posible activar "precio mayoreo" y "precio de compra" al mismo tiempo. Desactiva uno antes de activar el otro.'
      }, { status: 400 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const client = await base44.entities.Client.create({
      name,
      business_name: business_name || "",
      giro: giro || "",
      phone,
      business_id,
      email,
      address,
      rfc,
      notes,
      status,
      force_wholesale_all_products: force_wholesale_all_products || false,
      force_purchase_all_products: force_purchase_all_products || false
    });

    return Response.json({ success: true, client_id: client.id, client });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});