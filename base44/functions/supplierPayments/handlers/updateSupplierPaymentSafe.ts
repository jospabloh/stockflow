import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

const PETTY_CASH_CATEGORY = 'Pago a proveedor';

/**
 * Safe SupplierPayment full edit — mirrors SupplierPayments.jsx's
 * handleSave() edit branch (three-way PettyCashMovement mirror transition
 * included). Gated server-side by 'Pagos a Proveedores:edit_amount' (matches
 * the edit button's client-side gate — this is the full-edit dialog, not the
 * quick invoice-status toggle, which is a separate action/permission).
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      payment_id, supplier_id, supplier_name, amount, payment_date,
      payment_method, concept, reference, notes, invoice_status,
      affects_petty_cash,
    } = body;

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

    const allowed = await hasPermission(base44.asServiceRole, user, 'Pagos a Proveedores', 'edit_amount');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Pagos a Proveedores:edit_amount' }, { status: 403 });
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

    if (supplier_id !== record.supplier_id) {
      const suppliers = await base44.asServiceRole.entities.Supplier.filter({ id: supplier_id });
      const supplier = suppliers[0];
      if (!supplier || supplier.business_id !== user.business_id) {
        return Response.json({ success: false, error: 'Unauthorized: supplier belongs to a different business' }, { status: 403 });
      }
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const canAffectPettyCash = await hasPermission(base44.asServiceRole, user, 'Pagos a Proveedores', 'affect_petty_cash');
    const prevAffects = !!record.affects_petty_cash;
    // Keep the existing value unless the caller can actually change it —
    // mirrors the switch being hidden client-side without this permission.
    const nextAffects = canAffectPettyCash ? !!affects_petty_cash : prevAffects;
    const existingPcId = record.petty_cash_movement_id;
    let pettyCashId = existingPcId || '';

    const payload = {
      business_id: record.business_id,
      supplier_id,
      supplier_name: supplier_name || record.supplier_name || '',
      amount,
      payment_date,
      payment_method: payment_method || '',
      concept: (concept || '').trim(),
      reference: (reference || '').trim(),
      notes: (notes || '').trim(),
      invoice_status: invoice_status || '',
    };

    const mirrorPayload = {
      amount,
      description: payload.concept || `Pago a ${payload.supplier_name}`,
      category: PETTY_CASH_CATEGORY,
      movement_date: payload.payment_date,
      reference: payload.reference,
      notes: payload.notes,
      payment_method_snapshot: payload.payment_method,
    };

    if (nextAffects && existingPcId) {
      await base44.asServiceRole.entities.PettyCashMovement.update(existingPcId, mirrorPayload).catch(() => {});
    } else if (nextAffects && !existingPcId) {
      const pc = await base44.asServiceRole.entities.PettyCashMovement.create({
        business_id: record.business_id,
        movement_type: 'expense',
        generated_by_system: true,
        ...mirrorPayload,
      });
      pettyCashId = pc?.id || '';
    } else if (!nextAffects && prevAffects && existingPcId) {
      await base44.asServiceRole.entities.PettyCashMovement.delete(existingPcId).catch(() => {});
      pettyCashId = '';
    }

    const updated = await base44.asServiceRole.entities.SupplierPayment.update(payment_id, {
      ...payload,
      affects_petty_cash: nextAffects,
      petty_cash_movement_id: pettyCashId,
    });

    return Response.json({ success: true, payment: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
