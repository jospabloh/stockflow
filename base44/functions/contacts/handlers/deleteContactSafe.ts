import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';

// Compuerta por rol TEMPORAL (decision de JP pendiente). Los perfiles almacenista de prod fueron
// sembrados con estas claves en true (default viejo), y hasPermission() respeta el true explicito
// antes de ALMACENISTA_DENIED; quitar la compuerta daria a ese rol borrar/editar sin que nadie lo
// haya concedido. Con true se conserva el 403 previo para todo rol distinto de admin/owner.
// Ponerla en false solo tras migrar esos perfiles (ver descripcion del PR).
const DIRECTORY_ROLE_GATE = true;

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (DIRECTORY_ROLE_GATE && user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { contact_id } = body;

    if (!contact_id) {
      return Response.json({ error: 'contact_id is required' }, { status: 400 });
    }

    // Fetch record via service role to avoid silent 404 from RLS
    const records = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    // CRITICAL: Validate tenant ownership — prevent cross-tenant delete
    if (record.business_id !== user.business_id) {
      console.error(
        `[deleteContactSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to delete contact ${contact_id} (business ${record.business_id})`
      );
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PERMISSION CHECK — the granular registry key is enforced here, not just the role.
    if (!(await hasPermission(base44.asServiceRole, user, 'Contactos', 'delete'))) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Contactos:delete' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    await base44.asServiceRole.entities.Contact.delete(contact_id);

    return Response.json({ success: true, contact_id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
