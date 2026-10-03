import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAuthUser } from '../../../shared/authUser.ts';

// Reverts a payment confirmation on a converted quotation WITHOUT cancelling
// the sale. The quotation stays "converted" (stock already exited), but the
// `paid` flag and all registered payments are cleared. Any petty-cash income
// movements linked to those payments are reversed.
//
// ADMIN-ONLY: only tenant admins (user.role === 'admin') may invoke this.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin-only guard
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Forbidden — solo administradores pueden revertir pagos' }, { status: 403 });
    }

    const body = await req.json();
    const { quotation_id } = body;
    if (!quotation_id) return Response.json({ error: 'quotation_id is required' }, { status: 400 });

    let quotations: any[] = [];
    try {
      quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    } catch {
      return Response.json({ error: 'Quotation not found' }, { status: 404 });
    }
    if (quotations.length === 0) return Response.json({ error: 'Quotation not found' }, { status: 404 });

    const q = quotations[0];
    if (q.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (q.status !== 'converted') {
      return Response.json({ error: 'Solo se puede revertir el pago de ventas concretadas' }, { status: 400 });
    }

    if (!q.paid && !(Array.isArray(q.payments) && q.payments.length > 0)) {
      return Response.json({ error: 'La cotización no tiene pago confirmado que revertir' }, { status: 400 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const billingStatus = bizArr[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // 1. Reverse every petty-cash movement linked to individual payment records
    const existingPayments = Array.isArray(q.payments) ? q.payments : [];
    for (const payment of existingPayments) {
      if (payment.petty_cash_movement_id) {
        try {
          await base44.asServiceRole.entities.PettyCashMovement.delete(payment.petty_cash_movement_id);
        } catch (e) {
          console.error('PettyCash delete error (revertPayment):', e?.message);
        }
      }
    }

    // 2. Reset payment state on the quotation
    await base44.asServiceRole.entities.Quotation.update(q.id, {
      paid: false,
      payment_method: '',
      payments: [],
      amount_paid: 0,
      balance: q.total || 0,
    });

    // 3. Reverse the "full payment confirmed" petty-cash entry (origin_id = quotation.id)
    //    used by the quick "Confirmar Pago Total" flow via updateQuotationFlagsSafe.
    try {
      await base44.asServiceRole.functions.invoke('pettyCash', {
        'x-cron-secret': Deno.env.get('CRON_SECRET'),
        action: 'syncCashSaleToPettyCash',
        sync_action: 'reverse',
        origin_type: 'quotation',
        origin_id: quotation_id,
        amount: 0,
        payment_method: String(q.payment_method || ''),
        description: `Reverso de pago — ${q.folio}`,
        folio_or_ref: q.folio,
        movement_date: new Date().toLocaleDateString('en-CA'),
        business_id: q.business_id,
      });
    } catch (e) {
      console.error('syncCashSaleToPettyCash reverse error (revertPayment):', e?.message);
    }

    return Response.json({
      success: true,
      quotation_id,
      message: 'Pago revertido. La venta sigue siendo válida; el cobro puede registrarse nuevamente.',
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}