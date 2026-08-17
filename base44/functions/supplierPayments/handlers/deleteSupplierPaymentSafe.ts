import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Safe SupplierPayment delete — mirrors SupplierPayments.jsx's handleDelete(),
 * including deleting the mirrored PettyCashMovement when present. Gated
 * server-side by 'Pagos a Proveedores:delete'.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { payment_id } = body;

    if (!payment_id) {
      return Response.json({ success: false, error: 'payment_id is required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.SupplierPayment.filter({ id: payment_id });
    const record = records[0];
    if (!record) {
      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (record.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Pagos a Proveedores', 'delete');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Pagos a Proveedores:delete' }, { status: 403 });
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
    await base44.asServiceRole.entities.SupplierPayment.delete(payment_id);

    return Response.json({ success: true, payment_id });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
