import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getEntityConfig, isProtectedSystemRecord } from './_entityConfig.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Safe delete for Rubro / PaymentMethod / FundAccount.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entity, record_id } = body;

    const config = getEntityConfig(entity);
    if (!config) {
      return Response.json({ success: false, error: `Invalid entity: ${entity}` }, { status: 400 });
    }
    if (!record_id) {
      return Response.json({ success: false, error: 'record_id is required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities[entity].filter({ id: record_id });
    const record = records[0];
    if (!record) {
      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (record.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (isProtectedSystemRecord(record)) {
      return Response.json({ success: false, error: 'system_record_protected' }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, config.module, config.deleteAction);
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: `${config.module}:${config.deleteAction}` }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    await base44.asServiceRole.entities[entity].delete(record_id);

    return Response.json({ success: true, record_id });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
