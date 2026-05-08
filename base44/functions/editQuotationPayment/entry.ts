import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizeIsCash(method) {
  return String(method || '').trim().toLowerCase().includes('efectivo');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { quotation_id, payment_id, amount, payment_method, paid_at, notes } = await req.json();
    if (!quotation_id || !payment_id) return Response.json({ error: 'quotation_id and payment_id are required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return Response.json({ error: 'amount must be > 0' }, { status: 400 });
    if (!payment_method) return Response.json({ error: 'payment_method is required' }, { status: 400 });

    // Verify role
    if (user.role !== 'admin' && user.role !== 'almacenista') {
      return Response.json({ error: 'Forbidden: solo admin o almacenista' }, { status: 403 });
    }

    const q = await base44.asServiceRole.entities.Quotation.get(quotation_id);
    if (!q) return Response.json({ error: 'Quotation not found' }, { status: 404 });
    if (q.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payments = Array.isArray(q.payments) ? q.payments : [];
    const paymentIndex = payments.findIndex(p => p.id === payment_id);
    if (paymentIndex === -1) return Response.json({ error: 'Payment not found' }, { status: 404 });

    const oldPayment = payments[paymentIndex];

    // Validate new amount: balance excluding this payment + new amount <= total
    const otherPaid = payments.filter(p => p.id !== payment_id).reduce((sum, p) => sum + (p.amount || 0), 0);
    const maxAllowed = (q.total || 0) - otherPaid;
    if (Number(amount) > maxAllowed + 0.01) {
      return Response.json({ error: `El monto ($${amount}) supera el máximo permitido ($${maxAllowed.toFixed(2)})` }, { status: 400 });
    }

    // Update payment in array
    const updatedPayment = {
      ...oldPayment,
      amount: Number(amount),
      payment_method,
      paid_at: paid_at || oldPayment.paid_at,
      notes: notes ?? oldPayment.notes,
    };

    const updatedPayments = payments.map((p, i) => i === paymentIndex ? updatedPayment : p);
    const newAmountPaid = updatedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const newBalance = Math.max(0, (q.total || 0) - newAmountPaid);
    const isPaidFull = newBalance <= 0.01;

    // Handle petty cash changes
    const wasCache = normalizeIsCash(oldPayment.payment_method);
    const isCash = normalizeIsCash(payment_method);

    let pettyCashMovementId = updatedPayment.petty_cash_movement_id || null;

    if (wasCache && oldPayment.petty_cash_movement_id) {
      if (isCash) {
        // Update existing petty cash movement
        const movDate = paid_at ? paid_at.split('T')[0] : (oldPayment.paid_at ? oldPayment.paid_at.split('T')[0] : new Date().toLocaleDateString('en-CA'));
        try {
          await base44.asServiceRole.entities.PettyCashMovement.update(oldPayment.petty_cash_movement_id, {
            amount: Number(amount),
            movement_date: movDate,
            notes: `Cotización ${q.folio} · Cliente: ${q.client_name} · Editado por sistema`,
          });
        } catch (e) {
          console.error('PettyCash update error:', e?.message);
        }
      } else {
        // Payment changed from cash to non-cash: delete petty cash entry
        try {
          await base44.asServiceRole.entities.PettyCashMovement.delete(oldPayment.petty_cash_movement_id);
          pettyCashMovementId = null;
        } catch (e) {
          console.error('PettyCash delete on method change error:', e?.message);
        }
      }
    } else if (!wasCache && isCash) {
      // Payment changed from non-cash to cash: create petty cash entry
      const movDate = paid_at ? paid_at.split('T')[0] : new Date().toLocaleDateString('en-CA');
      try {
        const pcm = await base44.asServiceRole.entities.PettyCashMovement.create({
          business_id: q.business_id,
          movement_type: 'income',
          amount: Number(amount),
          description: `Pago efectivo — ${q.folio} | ${q.client_name}`,
          category: 'Venta efectivo',
          movement_date: movDate,
          reference: q.folio,
          notes: `Cotización ${q.folio} · Cliente: ${q.client_name} · Registrado por sistema`,
          generated_by_system: true,
          origin_type: 'quotation',
          origin_id: payment_id,
          payment_method_snapshot: payment_method,
        });
        pettyCashMovementId = pcm.id;
      } catch (e) {
        console.error('PettyCash create on method change error:', e?.message);
      }
    }

    // Apply petty_cash_movement_id update to the payment record
    const finalPayments = updatedPayments.map((p, i) =>
      i === paymentIndex ? { ...p, petty_cash_movement_id: pettyCashMovementId } : p
    );

    await base44.asServiceRole.entities.Quotation.update(q.id, {
      payments: finalPayments,
      amount_paid: newAmountPaid,
      balance: newBalance,
      paid: isPaidFull,
    });

    return Response.json({ success: true, new_amount_paid: newAmountPaid, new_balance: newBalance, is_paid_full: isPaidFull });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});