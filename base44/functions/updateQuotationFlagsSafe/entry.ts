import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Whitelist for quotation flag updates
const ALLOWED_FLAG_FIELDS = ['invoice_status', 'in_route', 'delivered', 'paid', 'payment_method', 'payments', 'amount_paid', 'balance'];

Deno.serve(async (req) => {
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

    // Fetch quotation to validate ownership
    const quotations = await base44.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
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
    const effectivePaid = ('paid' in sanitizedUpdates) ? Boolean(sanitizedUpdates.paid) : Boolean(quotation.paid);
    const paymentMethodAfter = String(sanitizedUpdates.payment_method || quotation.payment_method || '');
    const shouldReconcilePettyCash = quotation.status === 'converted' && (quotation.paid || effectivePaid) && (
      'paid' in sanitizedUpdates || 'payment_method' in sanitizedUpdates
    );

    if (shouldReconcilePettyCash) {
      base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
        action: 'reconcile',
        origin_type: 'quotation',
        origin_id: quotation.id,
        amount: effectivePaid ? (quotation.total || 0) : 0,
        payment_method: paymentMethodAfter,
        description: `Venta cotización ${quotation.folio} — ${quotation.client_name || ''}`,
        folio_or_ref: quotation.folio,
        movement_date: new Date().toLocaleDateString('en-CA'),
        business_id: user.business_id,
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      quotation_id,
      updated_fields: Object.keys(sanitizedUpdates)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});