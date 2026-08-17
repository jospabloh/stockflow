import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Safe SupplierPayment invoice-status toggle — mirrors the semáforo quick
 * toggle in SupplierPayments.jsx's handleInvoiceStatusChange(). This is a
 * separate, narrower action from the full edit dialog: the client only
 * requires 'edit_invoice_status' to flip the semáforo, not 'edit_amount'.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { payment_id, invoice_status } = body;

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

    const allowed = await hasPermission(base44.asServiceRole, user, 'Pagos a Proveedores', 'edit_invoice_status');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Pagos a Proveedores:edit_invoice_status' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const updated = await base44.asServiceRole.entities.SupplierPayment.update(payment_id, {
      invoice_status: invoice_status || '',
    });

    return Response.json({ success: true, payment: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
