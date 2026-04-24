import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.email === PLATFORM_OWNER_EMAIL) {
      return Response.json({ success: true, profiles: {}, featureEnabled: true });
    }

    if (!user.business_id) {
      return Response.json({ success: true, profiles: {}, featureEnabled: false });
    }

    const [profileRows, ruleRows] = await Promise.all([
      base44.asServiceRole.entities.PermissionProfile.filter({ business_id: user.business_id }),
      base44.asServiceRole.entities.TenantRule.filter({ business_id: user.business_id, rule_key: 'enable_granular_permissions' }),
    ]);

    const activeRule = ruleRows.find((r) => !r.archived);
    const featureEnabled = activeRule?.enabled === true;

    const profiles: Record<string, object> = {};
    for (const row of profileRows) {
      if (row.role_key) {
        profiles[row.role_key] = row.permissions || {};
      }
    }

    return Response.json({ success: true, profiles, featureEnabled });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
