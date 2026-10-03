import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getEntityConfig } from './_entityConfig.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Safe update for Rubro / PaymentMethod / FundAccount. Checks a permission
 * per touched field (config.fieldAction) so PaymentMethod's split between
 * 'edit_name' and 'edit_status' — an almacenista can be granted one without
 * the other — is enforced the same way here as it already is client-side.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entity, record_id, updates } = body;

    const config = getEntityConfig(entity);
    if (!config) {
      return Response.json({ success: false, error: `Invalid entity: ${entity}` }, { status: 400 });
    }
    if (!record_id) {
      return Response.json({ success: false, error: 'record_id is required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return Response.json({ success: false, error: 'updates object is required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities[entity].filter({ id: record_id });
    const record = records[0];
    if (!record) {
      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (record.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sanitized: Record<string, unknown> = {};
    for (const key of config.allowedFields) {
      if (key in updates) sanitized[key] = updates[key];
    }
    if (Object.keys(sanitized).length === 0) {
      return Response.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }
    if (typeof sanitized.name === 'string') {
      if (!sanitized.name.trim()) {
        return Response.json({ success: false, error: 'El nombre es requerido' }, { status: 400 });
      }
      sanitized.name = sanitized.name.trim();
    }

    const requiredActions = new Set(Object.keys(sanitized).map((key) => config.fieldAction[key]).filter(Boolean));
    for (const actionId of requiredActions) {
      const allowed = await hasPermission(base44.asServiceRole, user, config.module, actionId);
      if (!allowed) {
        return Response.json({ success: false, error: 'Forbidden: missing permission', permission: `${config.module}:${actionId}` }, { status: 403 });
      }
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const updated = await base44.asServiceRole.entities[entity].update(record_id, sanitized);

    return Response.json({ success: true, record: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
