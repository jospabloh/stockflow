import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Whitelist — excludes id, business_id, metadata fields
const ALLOWED_FIELDS = ['name', 'description', 'color'];

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
    const { category_id, updates } = body;

    if (!category_id) {
      return Response.json({ error: 'category_id is required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return Response.json({ error: 'updates object is required' }, { status: 400 });
    }

    // Fetch record to validate ownership
    const records = await base44.entities.Category.filter({ id: category_id });
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

    await base44.asServiceRole.entities.Category.update(category_id, sanitized);

    return Response.json({ success: true, category_id, updated_fields: Object.keys(sanitized) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});