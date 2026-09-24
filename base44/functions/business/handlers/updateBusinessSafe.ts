import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Whitelist — only invite-code-related fields allowed from Settings UI
const ALLOWED_FIELDS = ['invite_code', 'invite_code_active'];

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
    const { business_id, updates } = body;

    if (!business_id) {
      return Response.json({ error: 'business_id is required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return Response.json({ error: 'updates object is required' }, { status: 400 });
    }

    // CRITICAL: Validate user owns this business
    if (business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify business exists (use service role to bypass RLS on read)
    const records = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    if (records.length === 0) {
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

    // Ownership already validated above (business_id === user.business_id)
    // Use user-scoped update — Business RLS `update: {id: user.business_id}` will match
    await base44.entities.Business.update(business_id, sanitized);

    return Response.json({ success: true, business_id, updated_fields: Object.keys(sanitized) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}