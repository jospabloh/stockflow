import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null); // sin sesion el SDK lanza: debe ser 401, no 500

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name, business_id,
      phone, email, tags, source, status, city, instagram, notes, client_id, client_name
    } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }

    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: business_id mismatch' }, { status: 403 });
    }

    if (!name?.trim()) {
      return Response.json({ success: false, error: 'El nombre del contacto es requerido' }, { status: 400 });
    }

    // PERMISSION CHECK — RLS/role only isolate tenants; the granular key is enforced here.
    if (!(await hasPermission(base44.asServiceRole, user, 'Contactos', 'create'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Contactos:create' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const contact = await base44.entities.Contact.create({
      name: name.trim(),
      business_id,
      phone: phone || "",
      email: email || "",
      tags: Array.isArray(tags) ? tags : [],
      source: source || "",
      status: status || "active",
      city: city || "",
      instagram: instagram || "",
      notes: notes || "",
      client_id: client_id || "",
      client_name: client_name || ""
    });

    return Response.json({ success: true, contact_id: contact.id, contact });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
