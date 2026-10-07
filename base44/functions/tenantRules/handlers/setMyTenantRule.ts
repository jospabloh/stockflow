import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAuthUser } from '../../../shared/authUser.ts';
import { TENANT_TOGGLEABLE_RULE_KEYS, DEFAULT_RULE_CONFIG, isBusinessAdminRole } from './_tenantToggle.ts';

/**
 * A business's admin switches one of its own rules on or off.
 * The business and the role come from the stored User row, never from the
 * body, so nobody can toggle another tenant's rule or act as admin by claim.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await getAuthUser(base44);
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { rule_key, enabled } = body || {};
    if (!TENANT_TOGGLEABLE_RULE_KEYS.includes(rule_key)) {
      return Response.json({ success: false, error: 'rule_key is not supported' }, { status: 400 });
    }
    if (typeof enabled !== 'boolean') {
      return Response.json({ success: false, error: 'enabled must be true or false' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const user = users[0];
    const businessId = user?.business_id;
    if (!businessId) return Response.json({ success: false, error: 'No business' }, { status: 403 });
    if (!isBusinessAdminRole(user?.role)) {
      return Response.json({ success: false, error: 'Forbidden: business admin only' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: businessId });
    const billingStatus = bizArr[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const existing = await base44.asServiceRole.entities.TenantRule.filter({ business_id: businessId, rule_key });
    const current = existing.find((r) => !r.archived) || existing[0];
    const payload = {
      business_id: businessId,
      rule_key,
      enabled,
      config_json: current?.config_json || DEFAULT_RULE_CONFIG[rule_key] || {},
      notes: current?.notes || '',
      updated_by: user.email || authUser.email || 'business-admin',
      rule_scope: 'tenant',
      source: current?.source || 'business_admin',
      archived: false,
    };

    const rule = current
      ? await base44.asServiceRole.entities.TenantRule.update(current.id, payload)
      : await base44.asServiceRole.entities.TenantRule.create({ ...payload, created_by: payload.updated_by });

    return Response.json({ success: true, rule });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
