import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

// Whitelist for quotation flag updates
const ALLOWED_FLAG_FIELDS = ['invoice_status', 'invoice_number', 'in_route', 'delivered', 'paid', 'payment_method', 'payments', 'amount_paid', 'balance'];

// Permission key required to change each flag (permissionRegistry.js › Cotizaciones).
// in_route / delivered have no granular key of their own.
const FIELD_PERMISSION: Record<string, string> = {
  invoice_status: 'edit_invoice_status', invoice_number: 'edit_invoice_status',
  paid: 'confirm_payment', payments: 'confirm_payment', amount_paid: 'confirm_payment', balance: 'confirm_payment',
  payment_method: 'edit_payment_method',
};

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null); // me() throws when there is no valid session -> 401, not 500

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

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const billingStatus = bizArr[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
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

    // PERMISSION CHECK — each CHANGED field needs its own granular key. The form
    // resubmits the whole record, so an unchanged value never demands a key.
    const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const neededKeys = new Set<string>();
    for (const [key, value] of Object.entries(sanitizedUpdates)) {
      const action = FIELD_PERMISSION[key];
      if (!action || same(value, (quotation as Record<string, unknown>)[key])) continue;
      neededKeys.add(key === 'status' && value !== 'cancelled' ? '' : action);
    }
    neededKeys.delete('');
    for (const action of neededKeys) {
      if (!(await hasPermission(base44.asServiceRole, user, 'Cotizaciones', action))) {
        return Response.json({ success: false, error: 'Forbidden: missing permission', permission: `Cotizaciones:${action}` }, { status: 403 });
      }
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
        // Reverse FIRST when un-paying or switching away from cash — those are
        // unconditional regardless of newlyCollected.
        if (!effectivePaid || !isCashPayment) {
          await base44.asServiceRole.functions.invoke('pettyCash', {
            'x-cron-secret': Deno.env.get('CRON_SECRET'),
            action: 'syncCashSaleToPettyCash',
            sync_action: 'reverse',
            origin_type: 'quotation',
            origin_id: quotation.id,
            amount: 0,
            payment_method: paymentMethodAfter,
            description: `Reverso — ${quotation.folio}`,
            folio_or_ref: quotation.folio,
            movement_date: new Date().toLocaleDateString('en-CA'),
            business_id: bizId,
          });
        } else if (newlyCollected > 0) {
          // Reconcile with what was actually newly collected by THIS confirmation,
          // not the quotation's full total — the remainder may already have been
          // collected (and recorded in petty cash) via prior partial payments.
          // Use quotation.id as origin_id so this single "full payment confirmed" entry is idempotent.
          // Guard newlyCollected > 0: when nothing new was collected (e.g. correcting
          // payment_method on an already-fully-paid quotation), skip the reconcile
          // call entirely — calling syncCashSaleToPettyCash with amount 0 would
          // trigger shouldReverseForPaymentChange inside that function and DELETE
          // the existing cash entry, which is wrong (the quotation is still paid).
          await base44.asServiceRole.functions.invoke('pettyCash', {
            'x-cron-secret': Deno.env.get('CRON_SECRET'),
            action: 'syncCashSaleToPettyCash',
            sync_action: 'reconcile',
            origin_type: 'quotation',
            origin_id: quotation.id,
            amount: newlyCollected,
            payment_method: paymentMethodAfter,
            description: `Venta confirmada — ${quotation.folio} | ${quotation.client_name || ''}`,
            folio_or_ref: quotation.folio,
            movement_date: new Date().toLocaleDateString('en-CA'),
            business_id: bizId,
          });
        }
        // else: effectivePaid && isCashPayment && newlyCollected === 0 → skip
        // entirely (nothing new to record, no reversal needed — still paid in cash).
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