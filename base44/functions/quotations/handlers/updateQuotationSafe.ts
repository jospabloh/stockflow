import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

// SECURITY: Explicit whitelist of updatable Quotation fields
const ALLOWED_UPDATE_FIELDS = new Set([
  // Content fields — edited via QuotationFormDialog
  'folio',
  'client_id',
  'client_name',
  'client_email',
  'client_phone',
  'items',
  'subtotal',
  'tax',
  'total',
  // Status / workflow fields
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

export async function handle(req: Request): Promise<Response> {
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

    // Fetch quotation to validate ownership — use asServiceRole to avoid RLS blocking
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
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

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const billingStatus = bizArr[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
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

    // Use asServiceRole for the update — ownership already validated above
    const updated = await base44.asServiceRole.entities.Quotation.update(quotation_id, sanitized);

    return Response.json({
      success: true,
      quotation_id,
      quotation: updated
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}