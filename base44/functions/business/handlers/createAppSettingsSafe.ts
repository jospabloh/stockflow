import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Whitelist mirrors updateAppSettingsSafe.ts's — excludes id, business_id,
// created_date, updated_date, created_by.
const ALLOWED_FIELDS = [
  'business_name', 'logo_url', 'primary_color', 'secondary_color',
  'tax_rate', 'currency', 'low_stock_email', 'quotation_footer',
  'address', 'phone', 'rfc'
];

/**
 * Safe AppSettings creation — Settings.jsx used to call
 * base44.entities.AppSettings.create() directly the first time a business
 * saves its settings (no row exists yet), with no server-side gate at all —
 * the only reason this wasn't already caught by updateAppSettingsSafe is
 * that update path only runs once a row already exists. Same admin-only
 * check as updateAppSettingsSafe (this app has no granular permission key
 * finer than admin for AppSettings — see CLAUDE.md's "Known gap" note on
 * Configuracion) plus the write_blocked billing gate the update path was
 * still missing too.
 */
export async function handle(req: Request): Promise<Response> {
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
    const { business_id, settings } = body;

    if (!business_id) {
      return Response.json({ error: 'business_id is required' }, { status: 400 });
    }
    if (business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // Idempotency: a row may already exist (race with another tab, or a
    // retry) — update it instead of creating a duplicate for this business.
    const existing = await base44.asServiceRole.entities.AppSettings.filter({ business_id });
    if (existing.length > 0) {
      const sanitized = {};
      for (const key of ALLOWED_FIELDS) {
        if (settings && key in settings) sanitized[key] = settings[key];
      }
      const updated = await base44.asServiceRole.entities.AppSettings.update(existing[0].id, sanitized);
      return Response.json({ success: true, settings_id: existing[0].id, settings: updated });
    }

    const sanitized = { business_id };
    for (const key of ALLOWED_FIELDS) {
      if (settings && key in settings) sanitized[key] = settings[key];
    }

    const created = await base44.asServiceRole.entities.AppSettings.create(sanitized);

    return Response.json({ success: true, settings_id: created.id, settings: created });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
