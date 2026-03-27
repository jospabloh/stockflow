import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // Update quotation with whitelisted fields only
    await base44.asServiceRole.entities.Quotation.update(quotation.id, sanitizedUpdates);

    return Response.json({
      success: true,
      quotation_id,
      updated_fields: Object.keys(sanitizedUpdates)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});