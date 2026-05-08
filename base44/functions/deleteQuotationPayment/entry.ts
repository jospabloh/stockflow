import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizeIsCash(method) {
  return String(method || '').trim().toLowerCase().includes('efectivo');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { quotation_id, payment_id } = await req.json();
    if (!quotation_id || !payment_id) return Response.json({ error: 'quotation_id and payment_id are required' }, { status: 400 });

    // Verify role
    if (user.role !== 'admin' && user.role !== 'almacenista') {
      return Response.json({ error: 'Forbidden: solo admin o almacenista' }, { status: 403 });
    }

    const q = await base44.asServiceRole.entities.Quotation.get(quotation_id);
    if (!q) return Response.json({ error: 'Quotation not found' }, { status: 404 });
    if (q.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payments = Array.isArray(q.payments) ? q.payments : [];
    const payment = payments.find(p => p.id === payment_id);
    if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });

    // Remove payment from array
    const updatedPayments = payments.filter(p => p.id !== payment_id);
    const newAmountPaid = updatedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const newBalance = Math.max(0, (q.total || 0) - newAmountPaid);
    const isPaidFull = newBalance <= 0.01;

    await base44.asServiceRole.entities.Quotation.update(q.id, {
      payments: updatedPayments,
      amount_paid: newAmountPaid,
      balance: newBalance,
      paid: isPaidFull,
    });

    // Delete petty cash movement if exists
    if (payment.petty_cash_movement_id) {
      try {
        await base44.asServiceRole.entities.PettyCashMovement.delete(payment.petty_cash_movement_id);
      } catch (e) {
        console.error('PettyCash delete error:', e?.message);
      }
    } else if (normalizeIsCash(payment.payment_method)) {
      // Fallback: find by origin_id
      try {
        const pcms = await base44.asServiceRole.entities.PettyCashMovement.filter({
          business_id: q.business_id,
          origin_id: payment_id,
        });
        for (const pcm of pcms) {
          await base44.asServiceRole.entities.PettyCashMovement.delete(pcm.id);
        }
      } catch (e) {
        console.error('PettyCash fallback delete error:', e?.message);
      }
    }

    return Response.json({ success: true, new_amount_paid: newAmountPaid, new_balance: newBalance, is_paid_full: isPaidFull });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});