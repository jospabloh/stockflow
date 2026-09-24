import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

// Whitelist — excludes id, business_id, metadata fields
const ALLOWED_FIELDS = ['name', 'contact_name', 'email', 'phone', 'address', 'rfc', 'notes', 'extra_contacts'];

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
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