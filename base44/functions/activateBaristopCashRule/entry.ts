import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
const TARGET_BUSINESS_NAME = 'Baristop Distribuidora';
const RULE_KEY = 'cash_sales_to_petty_cash';

const BARISTOP_RULE_CONFIG = {
  payment_methods: ['Efectivo'],
  sources: ['quotation', 'movement'],
  create_on: 'cash_collection',
  reverse_on_source_reversal: true,
  reverse_on_payment_method_change: true,
  prevent_duplicates: true,
  generated_entry_lock_mode: 'source_controlled',
};

const BARISTOP_RULE_NOTES = 'Tenant-scoped operational rule: qualifying cash sales generate traceable petty cash income.';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ name: TARGET_BUSINESS_NAME });
    const target = businesses.find((b) => b.name === TARGET_BUSINESS_NAME);

    if (!target?.id) {
      return Response.json({
        error: `Business not found for exact name '${TARGET_BUSINESS_NAME}'`,
      }, { status: 404 });
    }

    const existing = await base44.asServiceRole.entities.TenantRule.filter({
      business_id: target.id,
      rule_key: RULE_KEY,
    });

    const payload = {
      business_id: target.id,
      rule_key: RULE_KEY,
      enabled: true,
      config_json: BARISTOP_RULE_CONFIG,
      notes: BARISTOP_RULE_NOTES,
      updated_by: user.email || 'platform-admin',
      rule_scope: 'tenant',
      source: 'platform_admin',
      archived: false,
    };

    const active = existing.find((r) => !r.archived);

    let rule;
    if (active) {
      rule = await base44.asServiceRole.entities.TenantRule.update(active.id, payload);
    } else if (existing.length > 0) {
      rule = await base44.asServiceRole.entities.TenantRule.update(existing[0].id, {
        ...payload,
        created_by: existing[0].created_by || user.email || 'platform-admin',
      });
    } else {
      rule = await base44.asServiceRole.entities.TenantRule.create({
        ...payload,
        created_by: user.email || 'platform-admin',
      });
    }

    return Response.json({
      success: true,
      activated: true,
      business_id: target.id,
      business_name: target.name,
      rule,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
