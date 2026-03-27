import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Whitelist — excludes id, business_id, created_date, updated_date, created_by
const ALLOWED_FIELDS = [
  'business_name', 'logo_url', 'primary_color', 'secondary_color',
  'tax_rate', 'currency', 'low_stock_email', 'quotation_footer',
  'address', 'phone', 'rfc'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { settings_id, updates } = body;

    if (!settings_id) {
      return Response.json({ error: 'settings_id is required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return Response.json({ error: 'updates object is required' }, { status: 400 });
    }

    // Fetch record to validate ownership
    const records = await base44.entities.AppSettings.filter({ id: settings_id });
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

    await base44.asServiceRole.entities.AppSettings.update(settings_id, sanitized);

    return Response.json({ success: true, settings_id, updated_fields: Object.keys(sanitized) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});