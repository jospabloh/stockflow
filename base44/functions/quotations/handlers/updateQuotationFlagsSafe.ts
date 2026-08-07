import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Whitelist for quotation flag updates
const ALLOWED_FLAG_FIELDS = ['invoice_status', 'invoice_number', 'in_route', 'delivered', 'paid', 'payment_method', 'payments', 'amount_paid', 'balance'];

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, updates } = body;

    if (!quotation_id) {
      return Response.json({ error: 'quotation_id is required' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return Response.json({ error: 'updates object is required' }, { status: 400 });
    }

    // Fetch quotation via service role (consistent with the other quotation
    // Safe functions: deliver/convert/cancel/update/partialReturn all read with
    // asServiceRole). A user-scoped read here depends on the entity read RLS
    // resolving correctly; when it doesn't, filter() returns [] and this
    // function silently 403s — the tracking-state change just "does nothing".
    // Tenant isolation is enforced by the explicit business_id check below.
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) {
      return Response.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const quotation = quotations[0];

    // CRITICAL: Validate business_id ownership
    if (quotation.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // CRITICAL: Mass-assignment protection - whitelist allowed fields
    const sanitizedUpdates: Record<string, unknown> = {};
    for (const key of ALLOWED_FLAG_FIELDS) {
      if (key in updates) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await base44.asServiceRole.entities.Quotation.update(quotation.id, sanitizedUpdates);

    // Tenant rule reconciliation for petty cash:
    // - Marking paid true
    // - Marking paid false
    // - Changing payment method while already paid
    //
    // IMPORTANT: this is the quick "Confirmar Pago Total" path (Quotations.jsx
    // handleConfirmPayment). It does NOT go through registerQuotationPayment.ts,
    // so it must not blindly reconcile petty cash with the full quotation.total —
    // a quotation can already carry partial payments (payments[]/amount_paid) from
    // the correct partial-payment flow. Bug fixed 2026-08-07: this used to pass
    // quotation.total unconditionally, double-counting whatever had already been
    // collected as partial payments (see stockflow/CLAUDE.md for the incident).
    const preUpdateAmountPaid = quotation.amount_paid != null ? quotation.amount_paid : 0;
    const effectivePaid = ('paid' in sanitizedUpdates) ? Boolean(sanitizedUpdates.paid) : Boolean(quotation.paid);
    const paymentMethodAfter = String(sanitizedUpdates.payment_method || quotation.payment_method || '');
    // Use business_id from the quotation itself (more reliable than user.business_id in service role context)
    const bizId = quotation.business_id || user.business_id;
    const shouldReconcilePettyCash = quotation.status === 'converted' && (quotation.paid || effectivePaid) && (
      'paid' in sanitizedUpdates || 'payment_method' in sanitizedUpdates
    );

    // What's actually newly collected right now = total minus whatever was already
    // tracked as paid before this call (real partial payments from registerQuotationPayment,
    // or an earlier "Confirmar Pago Total" that already synced amount_paid). Computed
    // unconditionally so it also covers the payment_method-only-change case below (an
    // already-paid quotation whose method gets corrected must NOT re-reconcile the full
    // total a second time).
    const newlyCollected = Math.max(0, (quotation.total || 0) - preUpdateAmountPaid);

    // If this call is newly marking the quotation paid, derive amount_paid/balance/payments
    // server-side rather than trusting the caller (handleConfirmPayment never sends them) —
    // keeps the same invariant registerQuotationPayment.ts already enforces:
    // balance = total - amount_paid, payments[] is the full audit trail of collections.
    const isNewlyMarkingPaid = 'paid' in sanitizedUpdates && sanitizedUpdates.paid === true && !quotation.paid;
    if (isNewlyMarkingPaid) {
      sanitizedUpdates.amount_paid = quotation.total || 0;
      sanitizedUpdates.balance = 0;
      if (newlyCollected > 0) {
        const existingPayments = Array.isArray(quotation.payments) ? quotation.payments : [];
        sanitizedUpdates.payments = [
          ...existingPayments,
          {
            id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            amount: newlyCollected,
            payment_method: paymentMethodAfter,
            paid_at: new Date().toISOString(),
            registered_by: user.id,
            petty_cash_movement_id: null,
            notes: 'Confirmado vía "Confirmar Pago Total"',
          },
        ];
      }
    }

    if (shouldReconcilePettyCash && bizId) {
      const isCashPayment = paymentMethodAfter.toLowerCase().includes('efectivo');
      try {
        if (effectivePaid && isCashPayment) {
          // Reconcile with what was actually newly collected by THIS confirmation,
          // not the quotation's full total — the remainder may already have been
          // collected (and recorded in petty cash) via prior partial payments. When
          // nothing new was collected (e.g. just correcting payment_method on an
          // already-fully-paid quotation), this is 0 and syncCashSaleToPettyCash
          // skips instead of re-recording the total.
          // Use quotation.id as origin_id so this single "full payment confirmed" entry is idempotent
          await base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
            'x-cron-secret': Deno.env.get('CRON_SECRET'),
            action: 'reconcile',
            origin_type: 'quotation',
            origin_id: quotation.id,
            amount: newlyCollected,
            payment_method: paymentMethodAfter,
            description: `Venta confirmada — ${quotation.folio} | ${quotation.client_name || ''}`,
            folio_or_ref: quotation.folio,
            movement_date: new Date().toLocaleDateString('en-CA'),
            business_id: bizId,
          });
        } else if (!effectivePaid || !isCashPayment) {
          // Reverse: payment undone or method changed away from cash
          await base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
            'x-cron-secret': Deno.env.get('CRON_SECRET'),
            action: 'reverse',
            origin_type: 'quotation',
            origin_id: quotation.id,
            amount: 0,
            payment_method: paymentMethodAfter,
            description: `Reverso — ${quotation.folio}`,
            folio_or_ref: quotation.folio,
            movement_date: new Date().toLocaleDateString('en-CA'),
            business_id: bizId,
          });
        }
      } catch (pettyCashError) {
        console.error('syncCashSaleToPettyCash failed:', pettyCashError?.message);
      }
    }

    return Response.json({
      success: true,
      quotation_id,
      updated_fields: Object.keys(sanitizedUpdates)
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}