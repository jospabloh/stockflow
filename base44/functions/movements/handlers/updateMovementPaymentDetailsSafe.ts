import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { movement_id, reference, reason } = body;

    if (!movement_id) return Response.json({ error: 'movement_id is required' }, { status: 400 });

    const found = await base44.asServiceRole.entities.Movement.filter({ id: movement_id });
    const movement = found[0];

    if (!movement) return Response.json({ error: 'Movement not found' }, { status: 404 });
    if (movement.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    await base44.asServiceRole.entities.Movement.update(movement_id, {
      reference: reference ?? movement.reference,
      reason: reason ?? movement.reason,
    });

    const refreshed = await base44.asServiceRole.entities.Movement.filter({ id: movement_id });
    const updated = refreshed[0] || movement;

    // Reconcile for paid direct exits when payment method changes
    if (updated.type === 'exit' && !updated.quotation_id && updated.paid) {
      base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
        'x-cron-secret': Deno.env.get('CRON_SECRET'),
        action: 'reconcile',
        origin_type: 'movement',
        origin_id: updated.id,
        amount: (updated.quantity || 0) * (updated.unit_price || 0),
        payment_method: updated.reference || '',
        description: `Venta directa — ${updated.product_name || ''} (${updated.reason || ''})`,
        folio_or_ref: updated.reference || updated.id,
        movement_date: new Date().toLocaleDateString('en-CA'),
        business_id: user.business_id,
      }).catch(() => {});
    }

    return Response.json({ success: true, movement: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
