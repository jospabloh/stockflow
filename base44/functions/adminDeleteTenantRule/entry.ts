import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.email !== PLATFORM_OWNER_EMAIL) return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });

    const body = await req.json();
    const { tenant_rule_id } = body;
    if (!tenant_rule_id) return Response.json({ error: 'tenant_rule_id is required' }, { status: 400 });

    const found = await base44.asServiceRole.entities.TenantRule.filter({ id: tenant_rule_id });
    const rule = found[0];
    if (!rule) return Response.json({ error: 'TenantRule not found' }, { status: 404 });

    const archived = await base44.asServiceRole.entities.TenantRule.update(tenant_rule_id, {
      archived: true,
      enabled: false,
      updated_by: user.email || 'platform-admin',
      notes: `${rule.notes || ''}\n[Archivado ${new Date().toISOString()} por ${user.email || 'platform-admin'}]`.trim(),
    });

    return Response.json({ success: true, rule: archived });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
