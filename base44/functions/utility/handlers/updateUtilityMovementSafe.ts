import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Safe UtilityMovement update — mirrors the exact edit flow
 * UtilityMovementForm.jsx's handleSave() (isEdit branch) used to run
 * directly, including the three-way PettyCashMovement mirror transition
 * (update existing mirror / create new mirror / delete stale mirror).
 * Gated server-side by 'Utilidad:edit_withdrawal'.
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
      movement_id, amount, movement_date,
      rubro_id, rubro_name, rubro_kind,
      account_id, account_name, affects_petty_cash,
      description, taken_by, invoiced, reference, notes,
    } = body;

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

    const allowed = await hasPermission(base44.asServiceRole, user, 'Utilidad', 'edit_withdrawal');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Utilidad:edit_withdrawal' }, { status: 403 });
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

    const movementType = record.movement_type; // type doesn't change on edit, same as the client form
    const prevAffects = !!record.affects_petty_cash;
    const nextAffects = !!affects_petty_cash;
    const existingPcId = record.petty_cash_movement_id;
    let pettyCashId = existingPcId || '';

    const mirrorPayload = {
      business_id: record.business_id,
      movement_type: movementType,
      amount,
      description: (description || '').trim() || `${TYPE_LABELS[movementType]}: ${rubro_name || 'Utilidad'}`,
      category: rubro_name || '',
      movement_date,
      reference: (reference || '').trim(),
      notes: (notes || '').trim(),
      generated_by_system: true,
      origin_type: 'utility',
      origin_id: movement_id,
      payment_method_snapshot: account_name || '',
    };

    if (nextAffects && existingPcId) {
      await base44.asServiceRole.entities.PettyCashMovement.update(existingPcId, mirrorPayload).catch(() => {});
    } else if (nextAffects && !existingPcId) {
      const pc = await base44.asServiceRole.entities.PettyCashMovement.create(mirrorPayload);
      pettyCashId = pc?.id || '';
    } else if (!nextAffects && prevAffects && existingPcId) {
      await base44.asServiceRole.entities.PettyCashMovement.delete(existingPcId).catch(() => {});
      pettyCashId = '';
    }

    const updated = await base44.asServiceRole.entities.UtilityMovement.update(movement_id, {
      amount,
      movement_date,
      rubro_id: rubro_id || '',
      rubro_name: rubro_name || 'Retiro de utilidad',
      rubro_kind: rubro_kind || movementType,
      account_id,
      account_name: account_name || '',
      affects_petty_cash: nextAffects,
      description: (description || '').trim(),
      taken_by: (taken_by || '').trim(),
      invoiced: !!invoiced,
      reference: (reference || '').trim(),
      notes: (notes || '').trim(),
      petty_cash_movement_id: pettyCashId,
    });

    return Response.json({ success: true, movement: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
