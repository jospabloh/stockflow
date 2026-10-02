import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';

// Whitelist — excludes id, business_id, metadata fields
const ALLOWED_FIELDS = ['name', 'contact_name', 'email', 'phone', 'address', 'rfc', 'notes', 'extra_contacts'];

// Permission key required to change each field (permissionRegistry.js › Proveedores).
const FIELD_PERMISSION: Record<string, string> = {
  name: 'edit_name',
  contact_name: 'edit_contact',
  email: 'edit_contact',
  phone: 'edit_contact',
  extra_contacts: 'edit_contact',
  address: 'edit_address',
  rfc: 'edit_rfc',
  notes: 'edit_notes',
};

// The form resubmits the whole record; only a value that actually changes needs its key.
const norm = (v: unknown) => (v === undefined || v === null || v === '' || v === false ? '' : JSON.stringify(v));

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
    const { supplier_id, updates } = body;

    if (!supplier_id) {
      return Response.json({ error: 'supplier_id is required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return Response.json({ error: 'updates object is required' }, { status: 400 });
    }

    // Fetch record to validate ownership — use asServiceRole to avoid RLS blocking
    const records = await base44.asServiceRole.entities.Supplier.filter({ id: supplier_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    // CRITICAL: Validate business_id ownership
    if (record.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // CRITICAL: Mass-assignment protection — whitelist
    const sanitized = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) sanitized[key] = updates[key];
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // PERMISSION CHECK — every changed field needs its own granular key.
    const neededKeys = new Set<string>();
    for (const key of Object.keys(sanitized)) {
      if (norm(sanitized[key]) !== norm(record[key])) neededKeys.add(FIELD_PERMISSION[key]);
    }
    for (const action of neededKeys) {
      if (!(await hasPermission(base44.asServiceRole, user, 'Proveedores', action))) {
        return Response.json({ error: 'Forbidden: missing permission', permission: `Proveedores:${action}` }, { status: 403 });
      }
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz2 = bizArr[0];
    const billingStatus2 = biz2?.billing_status || 'active';
    if (billingStatus2 === 'view_only' || billingStatus2 === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus2 }, { status: 403 });
    }

    await base44.asServiceRole.entities.Supplier.update(supplier_id, sanitized);

    return Response.json({ success: true, supplier_id, updated_fields: Object.keys(sanitized) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}