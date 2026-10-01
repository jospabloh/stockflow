import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';

// SECURITY: Explicit whitelist of updatable Contact fields (mass assignment protection)
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'phone',
  'email',
  'tags',
  'source',
  'status',
  'city',
  'instagram',
  'notes',
  'client_id',
  'client_name'
]);

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null); // sin sesion el SDK lanza: debe ser 401, no 500

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { contact_id, updates } = body;

    if (!contact_id || !updates) {
      return Response.json({ success: false, error: 'contact_id and updates are required' }, { status: 400 });
    }

    // Fetch contact to validate ownership — use asServiceRole to avoid RLS blocking
    const contacts = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    if (contacts.length === 0) {
      return Response.json({ success: false, error: 'Contact not found' }, { status: 404 });
    }

    const contact = contacts[0];

    // CRITICAL: Validate business_id ownership (cross-tenant protection)
    if (contact.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // SECURITY: Filter updates through whitelist
    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json({ success: true, contact_id, contact, message: 'No valid fields to update' });
    }

    // VALIDATION: Required field cannot be blanked out
    const newName = 'name' in sanitized ? sanitized.name : contact.name;
    if (!newName?.trim()) {
      return Response.json({ success: false, error: 'El nombre del contacto es requerido' }, { status: 400 });
    }

    // PERMISSION CHECK — RLS/role only isolate tenants; the granular key is enforced here.
    if (!(await hasPermission(base44.asServiceRole, user, 'Contactos', 'edit'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Contactos:edit' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz2 = bizArr[0];
    const billingStatus2 = biz2?.billing_status || 'active';
    if (billingStatus2 === 'view_only' || billingStatus2 === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus2 }, { status: 403 });
    }

    // Use asServiceRole for the update — ownership already validated above
    const updated = await base44.asServiceRole.entities.Contact.update(contact_id, sanitized);

    return Response.json({ success: true, contact_id, contact: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
