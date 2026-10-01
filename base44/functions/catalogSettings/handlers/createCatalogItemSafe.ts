import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getEntityConfig } from './_entityConfig.ts';

/**
 * Safe create for Rubro / PaymentMethod / FundAccount — see _entityConfig.ts
 * for why these three share one handler. Replaces the previous direct
 * base44.entities.X.create() calls from Rubros.jsx / PaymentMethods.jsx /
 * FundAccounts.jsx, which had no server-side permission or billing gate.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entity, business_id, ...fields } = body;

    const config = getEntityConfig(entity);
    if (!config) {
      return Response.json({ success: false, error: `Invalid entity: ${entity}` }, { status: 400 });
    }

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }
    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, config.module, config.createAction);
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: `${config.module}:${config.createAction}` }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    for (const required of config.requiredOnCreate) {
      const value = fields[required];
      if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
        return Response.json({ success: false, error: `${required} is required` }, { status: 400 });
      }
    }

    const sanitized: Record<string, unknown> = {};
    for (const key of config.allowedFields) {
      if (key in fields) sanitized[key] = fields[key];
    }
    if (typeof sanitized.name === 'string') sanitized.name = sanitized.name.trim();

    const payload = { ...sanitized, ...config.createDefaults(business_id) };

    const created = await base44.asServiceRole.entities[entity].create(payload);

    return Response.json({ success: true, record: created });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
