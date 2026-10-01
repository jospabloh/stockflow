import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Safe toggle for AppSettings.utility_forecast_enabled — Utility.jsx's
 * handleToggleForecast() used to call base44.entities.AppSettings.create/
 * update() directly, with no permission or billing gate, even though the
 * client already gates the switch itself behind 'Utilidad:manage_forecast'
 * (see Utility.jsx). Idempotent create-or-update like createAppSettingsSafe,
 * scoped to this single field only.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null); // sin sesion el SDK lanza: debe ser 401, no 500

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { business_id, enabled } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }
    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Utilidad', 'manage_forecast');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Utilidad:manage_forecast' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const existing = await base44.asServiceRole.entities.AppSettings.filter({ business_id });
    let settings;
    if (existing.length > 0) {
      settings = await base44.asServiceRole.entities.AppSettings.update(existing[0].id, { utility_forecast_enabled: !!enabled });
    } else {
      settings = await base44.asServiceRole.entities.AppSettings.create({ business_id, utility_forecast_enabled: !!enabled });
    }

    return Response.json({ success: true, settings });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
