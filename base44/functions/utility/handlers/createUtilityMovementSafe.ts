import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Safe UtilityMovement creation — mirrors the exact create flow
 * src/components/utility/UtilityMovementForm.jsx's handleSave() used to run
 * directly against base44.entities, including the PettyCashMovement mirror
 * write when the chosen account affects_petty_cash. Gated server-side by
 * 'Utilidad:add_withdrawal' (matches the only create entry point today,
 * Utility.jsx's "Retiro de utilidad" button).
 */

const TYPE_LABELS: Record<string, string> = { income: 'Ingreso', expense: 'Retiro de utilidad' };

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      business_id, movement_type, amount, movement_date,
      rubro_id, rubro_name, rubro_kind,
      account_id, account_name, affects_petty_cash,
      description, taken_by, invoiced, reference, notes,
    } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }
    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` }, { status: 403 });
    }
    if (movement_type !== 'income' && movement_type !== 'expense') {
      return Response.json({ success: false, error: `Invalid movement_type: ${movement_type}` }, { status: 400 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Utilidad', 'add_withdrawal');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Utilidad:add_withdrawal' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    if (!amount || amount <= 0) {
      return Response.json({ success: false, error: 'El monto debe ser mayor a cero' }, { status: 400 });
    }
    if (!account_id) {
      return Response.json({ success: false, error: 'Indica de dónde se tomó el dinero' }, { status: 400 });
    }
    if (!movement_date) {
      return Response.json({ success: false, error: 'La fecha es obligatoria' }, { status: 400 });
    }

    const created = await base44.asServiceRole.entities.UtilityMovement.create({
      business_id,
      movement_type,
      amount,
      movement_date,
      rubro_id: rubro_id || '',
      rubro_name: rubro_name || 'Retiro de utilidad',
      rubro_kind: rubro_kind || movement_type,
      account_id,
      account_name: account_name || '',
      affects_petty_cash: !!affects_petty_cash,
      description: (description || '').trim(),
      taken_by: (taken_by || '').trim(),
      invoiced: !!invoiced,
      reference: (reference || '').trim(),
      notes: (notes || '').trim(),
      registered_by: user.email || '',
      petty_cash_movement_id: '',
    });

    let pettyCashId = '';
    if (affects_petty_cash) {
      const pc = await base44.asServiceRole.entities.PettyCashMovement.create({
        business_id,
        movement_type,
        amount,
        description: (description || '').trim() || `${TYPE_LABELS[movement_type]}: ${rubro_name || 'Utilidad'}`,
        category: rubro_name || '',
        movement_date,
        reference: (reference || '').trim(),
        notes: (notes || '').trim(),
        generated_by_system: true,
        origin_type: 'utility',
        origin_id: created.id,
        payment_method_snapshot: account_name || '',
      });
      pettyCashId = pc?.id || '';
      await base44.asServiceRole.entities.UtilityMovement.update(created.id, { petty_cash_movement_id: pettyCashId });
    }

    return Response.json({ success: true, movement_id: created.id, movement: { ...created, petty_cash_movement_id: pettyCashId } });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
