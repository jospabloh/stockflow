import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

// Whitelist — wholesale_min_qty added as Category is now the source of truth for this threshold
const ALLOWED_FIELDS = ['name', 'description', 'color', 'wholesale_min_qty'];

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

    // Fetch record to validate ownership — use asServiceRole to avoid RLS blocking
    const records = await base44.asServiceRole.entities.Category.filter({ id: category_id });
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

    // Validate wholesale_min_qty
    if (sanitized.wholesale_min_qty != null && Number(sanitized.wholesale_min_qty) < 0) {
      return Response.json({ error: 'La cantidad mínima mayoreo no puede ser negativa' }, { status: 400 });
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