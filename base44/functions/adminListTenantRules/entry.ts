import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const KNOWN_RULE_KEYS = [
  'cash_sales_to_petty_cash',
  'allow_manual_petty_cash_edit_delete',
  'special_delivery_flow',
  'custom_pricing_override',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.email !== PLATFORM_OWNER_EMAIL) return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { search = '', business_id = '', rule_key = '', enabled } = body || {};

    const [rules, businesses] = await Promise.all([
      base44.asServiceRole.entities.TenantRule.filter({}),
      base44.asServiceRole.entities.Business.filter({}),
    ]);

    const businessMap = new Map(businesses.map((b) => [b.id, b]));

    const normalizedSearch = String(search || '').trim().toLowerCase();

    const filtered = rules
      .filter((rule) => !rule.archived)
      .filter((rule) => !business_id || rule.business_id === business_id)
      .filter((rule) => !rule_key || rule.rule_key === rule_key)
      .filter((rule) => {
        if (enabled === undefined || enabled === null || enabled === '') return true;
        return rule.enabled === Boolean(enabled);
      })
      .map((rule) => {
        const biz = businessMap.get(rule.business_id);
        return {
          ...rule,
          business_name: biz?.name || 'Negocio no encontrado',
          business_status: biz?.status || null,
        };
      })
      .filter((rule) => {
        if (!normalizedSearch) return true;
        return (
          String(rule.business_name || '').toLowerCase().includes(normalizedSearch) ||
          String(rule.rule_key || '').toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => new Date(b.updated_date || b.created_date || 0).getTime() - new Date(a.updated_date || a.created_date || 0).getTime());

    return Response.json({
      success: true,
      rules: filtered,
      known_rule_keys: KNOWN_RULE_KEYS,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
