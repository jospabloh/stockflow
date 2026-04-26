import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getBalance(q) {
  const total = q.total || 0;
  if (q.balance != null) return q.balance;
  if (q.paid) return 0;
  const amountPaid = q.amount_paid != null ? q.amount_paid : 0;
  return total - amountPaid;
}

function getAmountPaid(q) {
  if (q.amount_paid != null) return q.amount_paid;
  return q.paid ? (q.total || 0) : 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, amount, payment_method, paid_at, notes, register_in_petty_cash } = body;

    if (!quotation_id) return Response.json({ error: 'quotation_id is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return Response.json({ error: 'amount must be > 0' }, { status: 400 });
    if (!payment_method) return Response.json({ error: 'payment_method is required' }, { status: 400 });

    // Fetch quotation
    const quotations = await base44.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) return Response.json({ error: 'Quotation not found' }, { status: 404 });

    const q = quotations[0];
    if (q.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const currentBalance = getBalance(q);
    const currentAmountPaid = getAmountPaid(q);

    if (Number(amount) > currentBalance + 0.01) {
      return Response.json({ error: `El monto ($${amount}) supera el saldo pendiente ($${currentBalance.toFixed(2)})` }, { status: 400 });
    }

    // Build payment record
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newPayment = {
      id: paymentId,
      amount: Number(amount),
      payment_method,
      paid_at: paid_at || new Date().toISOString(),
      registered_by: user.id,
      petty_cash_movement_id: null,
      notes: notes || '',
    };

    const existingPayments = Array.isArray(q.payments) ? q.payments : [];
    const updatedPayments = [...existingPayments, newPayment];
    const newAmountPaid = currentAmountPaid + Number(amount);
    const newBalance = Math.max(0, (q.total || 0) - newAmountPaid);
    const isPaidFull = newBalance <= 0.01;

    // Update quotation
    await base44.asServiceRole.entities.Quotation.update(q.id, {
      payments: updatedPayments,
      amount_paid: newAmountPaid,
      balance: newBalance,
      paid: isPaidFull,
    });

    // Optionally register in petty cash
    let pettyCashMovementId = null;
    if (register_in_petty_cash) {
      const movDate = paid_at ? paid_at.split('T')[0] : new Date().toLocaleDateString('en-CA');
      const pcm = await base44.asServiceRole.entities.PettyCashMovement.create({
        business_id: user.business_id,
        movement_type: 'income',
        amount: Number(amount),
        description: `Pago de cotización #${q.folio} - ${q.client_name}`,
        category: 'Ventas',
        movement_date: movDate,
        reference: q.folio,
        generated_by_system: false,
        origin_type: 'quotation',
        origin_id: q.id,
        payment_method_snapshot: payment_method,
      });
      pettyCashMovementId = pcm.id;

      // Patch payment record with petty_cash_movement_id
      const patchedPayments = updatedPayments.map(p =>
        p.id === paymentId ? { ...p, petty_cash_movement_id: pettyCashMovementId } : p
      );
      await base44.asServiceRole.entities.Quotation.update(q.id, { payments: patchedPayments });
    }

    return Response.json({
      success: true,
      payment_id: paymentId,
      new_amount_paid: newAmountPaid,
      new_balance: newBalance,
      is_paid_full: isPaidFull,
      petty_cash_movement_id: pettyCashMovementId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});