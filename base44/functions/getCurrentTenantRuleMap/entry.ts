import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedBusinessId = body?.business_id;
    const isPlatformAdmin = user.email === PLATFORM_OWNER_EMAIL;

    const businessId = requestedBusinessId
      ? (isPlatformAdmin ? requestedBusinessId : user.business_id)
      : user.business_id;

    if (!businessId) {
      return Response.json({ success: true, business_id: null, rules: {} });
    }

    const rules = await base44.asServiceRole.entities.TenantRule.filter({ business_id: businessId });

    const map = {} as Record<string, { enabled: boolean; config: Record<string, unknown>; notes: string; id: string }>;

    for (const rule of rules) {
      if (rule.archived) continue;
      map[rule.rule_key] = {
        enabled: Boolean(rule.enabled),
        config: (rule.config_json && typeof rule.config_json === 'object' && !Array.isArray(rule.config_json)) ? rule.config_json : {},
        notes: rule.notes || '',
        id: rule.id,
      };
    }

    return Response.json({
      success: true,
      business_id: businessId,
      rules: map,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
