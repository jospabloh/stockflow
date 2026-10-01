import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Safe PettyCashMovement update — same edits src/components/petty-cash/
 * PettyCashMovementForm.jsx's handleSave() used to send directly, now
 * gated by 'Caja Chica:edit_amount' server-side (matches the edit button's
 * client-side gate) and blocked for system-generated records, mirroring
 * the guard PettyCash.jsx already applies before opening the edit form.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null); // me() throws when there is no valid session -> 401, not 500

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { movement_id, amount, description, category, movement_date, reference, notes } = body;

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
      return Response.json({ success: false, error: 'Este movimiento fue generado automáticamente por una venta y no puede editarse aquí.' }, { status: 409 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Caja Chica', 'edit_amount');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Caja Chica:edit_amount' }, { status: 403 });
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
    if (!description || !String(description).trim()) {
      return Response.json({ success: false, error: 'Debes capturar una descripción' }, { status: 400 });
    }
    if (!movement_date) {
      return Response.json({ success: false, error: 'La fecha es obligatoria' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.PettyCashMovement.update(movement_id, {
      amount,
      description: String(description).trim(),
      category: category || '',
      movement_date,
      reference: reference || '',
      notes: notes || '',
    });

    return Response.json({ success: true, movement: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
