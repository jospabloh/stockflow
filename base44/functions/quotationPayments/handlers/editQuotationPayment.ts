import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

function isCash(method) {
  return String(method || '').trim().toLowerCase().includes('efectivo');
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { quotation_id, payment_id, amount, payment_method, paid_at, notes } = await req.json();
    if (!quotation_id || !payment_id) return Response.json({ error: 'quotation_id and payment_id are required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return Response.json({ error: 'amount must be > 0' }, { status: 400 });
    if (!payment_method) return Response.json({ error: 'payment_method is required' }, { status: 400 });

    const q = await base44.asServiceRole.entities.Quotation.get(quotation_id);
    if (!q) return Response.json({ error: 'Quotation not found' }, { status: 404 });
    if (q.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const allowed = await hasPermission(base44.asServiceRole, user, 'Cotizaciones', 'edit_payment_record');
    if (!allowed) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Cotizaciones:edit_payment_record' }, { status: 403 });
    }

    // LICENSE CHECK
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const billingStatus = businesses[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const payments = Array.isArray(q.payments) ? q.payments : [];
    const idx = payments.findIndex(p => p.id === payment_id);
    if (idx === -1) return Response.json({ error: 'Payment not found' }, { status: 404 });

    const oldPayment = payments[idx];

    // Validate new amount doesn't exceed remaining balance (excluding this payment)
    const otherPaid = payments.filter(p => p.id !== payment_id).reduce((s, p) => s + (p.amount || 0), 0);
    const maxAllowed = (q.total || 0) - otherPaid;
    if (Number(amount) > maxAllowed + 0.01) {
      return Response.json({ error: `El monto ($${amount}) supera el máximo permitido ($${maxAllowed.toFixed(2)})` }, { status: 400 });
    }

    const updatedPayment = {
      ...oldPayment,
      amount: Number(amount),
      payment_method,
      paid_at: paid_at || oldPayment.paid_at,
      notes: notes || '',
    };

    const updatedPayments = payments.map((p, i) => i === idx ? updatedPayment : p);
    const newAmountPaid = updatedPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const newBalance = Math.max(0, (q.total || 0) - newAmountPaid);
    const isPaidFull = newBalance <= 0.01;

    await base44.asServiceRole.entities.Quotation.update(q.id, {
      payments: updatedPayments,
      amount_paid: newAmountPaid,
      balance: newBalance,
      paid: isPaidFull,
    });

    // Update petty cash if exists and it's still cash, or delete if method changed away from cash
    if (oldPayment.petty_cash_movement_id) {
      if (isCash(payment_method)) {
        const movDate = paid_at ? paid_at.split('T')[0] : new Date().toLocaleDateString('en-CA');
        try {
          await base44.asServiceRole.entities.PettyCashMovement.update(oldPayment.petty_cash_movement_id, {
            amount: Number(amount),
            movement_date: movDate,
            notes: notes || '',
          });
        } catch (e) {
          console.error('PettyCash update error:', e?.message);
        }
      } else {
        // Method changed from cash to non-cash: delete petty cash entry
        try {
          await base44.asServiceRole.entities.PettyCashMovement.delete(oldPayment.petty_cash_movement_id);
          // Remove petty_cash_movement_id from payment
          const cleanedPayments = updatedPayments.map(p =>
            p.id === payment_id ? { ...p, petty_cash_movement_id: null } : p
          );
          await base44.asServiceRole.entities.Quotation.update(q.id, { payments: cleanedPayments });
        } catch (e) {
          console.error('PettyCash delete error:', e?.message);
        }
      }
    } else if (isCash(payment_method) && !oldPayment.petty_cash_movement_id) {
      // Was not cash before, now it is — create petty cash entry
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
        const patchedPayments = updatedPayments.map(p =>
          p.id === payment_id ? { ...p, petty_cash_movement_id: pcm.id } : p
        );
        await base44.asServiceRole.entities.Quotation.update(q.id, { payments: patchedPayments });
      } catch (e) {
        console.error('PettyCash create error:', e?.message);
      }
    }

    return Response.json({ success: true, new_amount_paid: newAmountPaid, new_balance: newBalance, is_paid_full: isPaidFull });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}