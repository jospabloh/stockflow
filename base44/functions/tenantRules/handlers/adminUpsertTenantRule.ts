import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
const KNOWN_RULE_KEYS = new Set([
  'cash_sales_to_petty_cash',
  'allow_manual_petty_cash_edit_delete',
  'special_delivery_flow',
  'custom_pricing_override',
  'enable_granular_permissions',
]);

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });

    const body = await req.json();
    const {
      business_id,
      rule_key,
      enabled = false,
      config_json = {},
      notes = '',
    } = body;

    if (!business_id) return Response.json({ error: 'business_id is required' }, { status: 400 });
    if (!rule_key) return Response.json({ error: 'rule_key is required' }, { status: 400 });
    if (!KNOWN_RULE_KEYS.has(rule_key)) {
      return Response.json({ error: 'rule_key is not supported' }, { status: 400 });
    }

    let normalizedConfig = config_json;
    if (typeof config_json === 'string') {
      try {
        normalizedConfig = JSON.parse(config_json || '{}');
      } catch {
        return Response.json({ error: 'config_json must be valid JSON' }, { status: 400 });
      }
    }
    if (!normalizedConfig || typeof normalizedConfig !== 'object' || Array.isArray(normalizedConfig)) {
      return Response.json({ error: 'config_json must be a JSON object' }, { status: 400 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    if (businesses.length === 0) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    const existing = await base44.asServiceRole.entities.TenantRule.filter({ business_id, rule_key });
    const active = existing.filter((r) => !r.archived);

    if (active.length > 1) {
      return Response.json({ error: 'Integrity error: duplicate active rules found for business_id + rule_key' }, { status: 409 });
    }

    const payload = {
      business_id,
      rule_key,
      enabled: Boolean(enabled),
      config_json: normalizedConfig,
      notes,
      updated_by: user.email || 'platform-admin',
      rule_scope: 'tenant',
      source: 'platform_admin',
      archived: false,
    };

    let result;
    if (active.length === 1) {
      result = await base44.asServiceRole.entities.TenantRule.update(active[0].id, payload);
    } else if (existing.length > 0) {
      result = await base44.asServiceRole.entities.TenantRule.update(existing[0].id, {
        ...payload,
        created_by: existing[0].created_by || user.email || 'platform-admin',
      });
    } else {
      result = await base44.asServiceRole.entities.TenantRule.create({
        ...payload,
        created_by: user.email || 'platform-admin',
      });
    }

    return Response.json({ success: true, rule: result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
