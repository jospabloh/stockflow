import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Safe UtilityMovement delete — mirrors Utility.jsx's handleDeleteConfirm(),
 * including deleting the mirrored PettyCashMovement when present. Gated
 * server-side by 'Utilidad:delete_withdrawal'.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { movement_id } = body;

    if (!movement_id) {
      return Response.json({ success: false, error: 'movement_id is required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.UtilityMovement.filter({ id: movement_id });
    const record = records[0];
    if (!record) {
      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (record.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Utilidad', 'delete_withdrawal');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Utilidad:delete_withdrawal' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    if (record.affects_petty_cash && record.petty_cash_movement_id) {
      await base44.asServiceRole.entities.PettyCashMovement.delete(record.petty_cash_movement_id).catch(() => {});
    }
    await base44.asServiceRole.entities.UtilityMovement.delete(movement_id);

    return Response.json({ success: true, movement_id });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
