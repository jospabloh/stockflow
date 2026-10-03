import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * confirmMovementPaymentSafe
 *
 * Marks a direct inventory exit movement as paid (paid: true).
 * After marking, triggers the tenant-scoped petty cash income if applicable.
 *
 * Payload:
 *   movement_id: string
 *   business_id: string
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { movement_id, business_id } = body;
    const resolvedBusinessId = business_id || user.business_id;

    if (!movement_id) {
      return Response.json({ error: 'movement_id is required' }, { status: 400 });
    }

    // Validate business_id ownership
    if (!resolvedBusinessId || resolvedBusinessId !== user.business_id) {
      return Response.json({ error: 'Forbidden: business_id mismatch' }, { status: 403 });
    }

    if (!(await hasPermission(base44.asServiceRole, user, 'Movimientos', 'confirm_payment'))) {
      return Response.json({ error: 'Forbidden: missing Movimientos:confirm_payment permission' }, { status: 403 });
    }

    // Fetch the movement as service role
    const movements = await base44.asServiceRole.entities.Movement.filter({ id: movement_id });
    const movement = movements[0];

    if (!movement) {
      return Response.json({ error: 'Movement not found' }, { status: 404 });
    }

    // Cross-tenant guard
    if (movement.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only direct exit movements can be confirmed as paid here
    if (movement.type !== 'exit' || movement.quotation_id) {
      return Response.json({ error: 'Only direct exit movements can be confirmed as paid' }, { status: 400 });
    }

    // Idempotency: already paid
    if (movement.paid) {
      return Response.json({ success: true, skipped: true, reason: 'already_paid' });
    }

    // Mark as paid
    await base44.asServiceRole.entities.Movement.update(movement_id, { paid: true });

    // TENANT-SCOPED: Trigger petty cash income for cash payments
    // Fire-and-forget — failure must NOT block the payment confirmation
    base44.asServiceRole.functions.invoke('pettyCash', {
      'x-cron-secret': Deno.env.get('CRON_SECRET'),
      action: 'syncCashSaleToPettyCash',
      sync_action: 'reconcile',
      origin_type: 'movement',
      origin_id: movement_id,
      amount: (movement.quantity || 0) * (movement.unit_price || 0),
      payment_method: movement.reference || '', // reference field stores payment method in direct movements
      description: `Venta directa — ${movement.product_name || ''} (${movement.reason || ''})`,
      folio_or_ref: movement.reference || movement_id,
      movement_date: new Date().toLocaleDateString('en-CA'),
      business_id: resolvedBusinessId,
    }).catch(() => {});

    return Response.json({ success: true, movement_id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}