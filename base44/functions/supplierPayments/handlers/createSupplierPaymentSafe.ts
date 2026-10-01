import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

const PETTY_CASH_CATEGORY = 'Pago a proveedor';

/**
 * Safe SupplierPayment creation — mirrors SupplierPayments.jsx's handleSave()
 * create branch, including the PettyCashMovement mirror write. Gated
 * server-side by 'Pagos a Proveedores:create'; the affects_petty_cash toggle
 * additionally requires 'Pagos a Proveedores:affect_petty_cash' (forced off
 * otherwise, matching the switch being hidden client-side without it).
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null); // sin sesion el SDK lanza: debe ser 401, no 500

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      business_id, supplier_id, supplier_name, amount, payment_date,
      payment_method, concept, reference, notes, invoice_status,
      affects_petty_cash,
    } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }
    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Pagos a Proveedores', 'create');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Pagos a Proveedores:create' }, { status: 403 });
    }

    if (!supplier_id) {
      return Response.json({ success: false, error: 'supplier_id is required' }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return Response.json({ success: false, error: 'El monto debe ser mayor a cero' }, { status: 400 });
    }
    if (!payment_date) {
      return Response.json({ success: false, error: 'payment_date is required' }, { status: 400 });
    }

    // Server-side tenant-ownership check for the referenced supplier.
    const suppliers = await base44.asServiceRole.entities.Supplier.filter({ id: supplier_id });
    const supplier = suppliers[0];
    if (!supplier) {
      return Response.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }
    if (supplier.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: supplier belongs to a different business' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const canAffectPettyCash = await hasPermission(base44.asServiceRole, user, 'Pagos a Proveedores', 'affect_petty_cash');
    const wantsPettyCash = !!affects_petty_cash && canAffectPettyCash;

    const payload = {
      business_id,
      supplier_id,
      supplier_name: supplier_name || supplier.name || '',
      amount,
      payment_date,
      payment_method: payment_method || '',
      concept: (concept || '').trim(),
      reference: (reference || '').trim(),
      notes: (notes || '').trim(),
      invoice_status: invoice_status || '',
      affects_petty_cash: wantsPettyCash,
    };

    let pettyCashId = '';
    if (wantsPettyCash) {
      const pc = await base44.asServiceRole.entities.PettyCashMovement.create({
        business_id,
        movement_type: 'expense',
        amount,
        description: payload.concept || `Pago a ${payload.supplier_name}`,
        category: PETTY_CASH_CATEGORY,
        movement_date: payload.payment_date,
        reference: payload.reference,
        notes: payload.notes,
        generated_by_system: true,
        payment_method_snapshot: payload.payment_method,
      });
      pettyCashId = pc?.id || '';
    }

    const created = await base44.asServiceRole.entities.SupplierPayment.create({
      ...payload,
      petty_cash_movement_id: pettyCashId,
    });

    return Response.json({ success: true, payment_id: created.id, payment: created });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
