import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

function normalizePaymentMethod(method) {
  return String(method || '').trim().toLowerCase().includes('efectivo');
}

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

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, amount, payment_method, paid_at, notes } = body;

    if (!quotation_id) return Response.json({ error: 'quotation_id is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return Response.json({ error: 'amount must be > 0' }, { status: 400 });
    if (!payment_method) return Response.json({ error: 'payment_method is required' }, { status: 400 });

    // Fetch quotation via service role (consistent with the other quotation
    // Safe functions; avoids silent no-ops when the user-scoped read RLS does
    // not resolve). Tenant isolation enforced by the business_id check below.
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) return Response.json({ error: 'Quotation not found' }, { status: 404 });

    const q = quotations[0];
    if (q.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const allowed = await hasPermission(base44.asServiceRole, user, 'Cotizaciones', 'confirm_payment');
    if (!allowed) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Cotizaciones:confirm_payment' }, { status: 403 });
    }

    // LICENSE CHECK
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const billingStatus = businesses[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

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

    // Auto-register in petty cash if payment method is cash (efectivo)
    // Each payment gets its own petty cash entry using paymentId as origin_id (avoids duplicate prevention issues)
    let pettyCashMovementId = null;
    const isCash = normalizePaymentMethod(payment_method);
    if (isCash) {
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
          origin_id: paymentId,
          payment_method_snapshot: payment_method,
        });
        pettyCashMovementId = pcm.id;
      } catch (e) {
        console.error('PettyCash auto-create error:', e?.message);
      }

      if (pettyCashMovementId) {
        const patchedPayments = updatedPayments.map(p =>
          p.id === paymentId ? { ...p, petty_cash_movement_id: pettyCashMovementId } : p
        );
        await base44.asServiceRole.entities.Quotation.update(q.id, { payments: patchedPayments });
      }
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
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}