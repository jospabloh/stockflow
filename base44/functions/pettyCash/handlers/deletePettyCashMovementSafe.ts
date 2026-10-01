import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Safe PettyCashMovement delete — gated by 'Caja Chica:delete' server-side
 * (matches the delete button's client-side gate) and blocked for
 * system-generated records, mirroring the guard PettyCash.jsx already
 * applies client-side before calling delete.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { movement_id } = body;

    if (!movement_id) {
      return Response.json({ success: false, error: 'movement_id is required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.PettyCashMovement.filter({ id: movement_id });
    const record = records[0];
    if (!record) {
      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (record.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (record.generated_by_system) {
      return Response.json({ success: false, error: 'Este movimiento fue generado automáticamente por una venta. Para eliminarlo, cancela o revierte la venta original.' }, { status: 409 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Caja Chica', 'delete');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Caja Chica:delete' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    await base44.asServiceRole.entities.PettyCashMovement.delete(movement_id);

    return Response.json({ success: true, movement_id });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
