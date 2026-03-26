import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// SECURITY: Explicit whitelist of updatable Quotation fields
const ALLOWED_UPDATE_FIELDS = new Set([
  'status',
  'invoice_status',
  'in_route',
  'delivered',
  'paid',
  'cancellation_reason',
  'notes',
  'payment_method',
  'valid_until'
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, updates } = body;

    if (!quotation_id || !updates) {
      return Response.json({ error: 'quotation_id and updates are required' }, { status: 400 });
    }

    // Fetch quotation to validate ownership
    const quotations = await base44.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) {
      return Response.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const quotation = quotations[0];

    // CRITICAL: Validate business_id ownership
    if (quotation.business_id !== user.business_id) {
      return Response.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // SECURITY: Filter updates through whitelist (mass assignment protection)
    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json({
        success: true,
        quotation_id,
        quotation: quotation,
        message: 'No valid fields to update'
      });
    }

    // Update quotation with sanitized data only
    const updated = await base44.entities.Quotation.update(quotation_id, sanitized);

    return Response.json({
      success: true,
      quotation_id,
      quotation: updated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});