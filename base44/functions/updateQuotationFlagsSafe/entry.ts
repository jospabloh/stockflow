import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Whitelist for quotation flag updates
const ALLOWED_FLAG_FIELDS = ['invoice_status', 'in_route', 'delivered', 'paid', 'payment_method'];

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
    const sanitizedUpdates = {};
    for (const key of ALLOWED_FLAG_FIELDS) {
      if (key in updates) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // LICENSE CHECK (flag updates like marking paid/delivered allowed in view_only — they don't create data)
    // Only block writes that create or structurally mutate data. Flag updates are permitted.

    // Update quotation with whitelisted fields only
    await base44.asServiceRole.entities.Quotation.update(quotation.id, sanitizedUpdates);

    // TENANT-SCOPED: Auto petty cash income for cash sales
    // Trigger only when marking a converted quotation as paid
    const isMarkingPaid = sanitizedUpdates.paid === true && quotation.status === 'converted' && !quotation.paid;
    if (isMarkingPaid) {
      const effectivePaymentMethod = sanitizedUpdates.payment_method || quotation.payment_method || '';
      // Fire-and-forget: failure here must NOT block the flag update that already succeeded
      base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
        action: 'create',
        origin_type: 'quotation',
        origin_id: quotation.id,
        amount: quotation.total || 0,
        payment_method: effectivePaymentMethod,
        description: `Venta cotización ${quotation.folio} — ${quotation.client_name || ''}`,
        folio_or_ref: quotation.folio,
        movement_date: new Date().toLocaleDateString('en-CA'),
        business_id: user.business_id,
      }).catch(() => {});
    }

    // Reverse petty cash if payment is being un-marked (paid explicitly set to false)
    const isUnmarkingPaid = sanitizedUpdates.paid === false && quotation.paid === true;
    if (isUnmarkingPaid) {
      base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
        action: 'reverse',
        origin_type: 'quotation',
        origin_id: quotation.id,
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