import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';

// Permission key required to change each field (permissionRegistry.js › Cotizaciones).
const FIELD_PERMISSION: Record<string, string> = {
  folio: 'edit_items', client_id: 'edit_client', client_name: 'edit_client', client_email: 'edit_client', client_phone: 'edit_client',
  items: 'edit_items', subtotal: 'edit_items', tax: 'edit_items', total: 'edit_items',
  notes: 'edit_notes', valid_until: 'edit_validity', payment_method: 'edit_payment_method',
  invoice_status: 'edit_invoice_status', paid: 'confirm_payment', status: 'cancel', cancellation_reason: 'cancel',
};

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

    // PERMISSION CHECK — each CHANGED field needs its own granular key. The form
    // resubmits the whole record, so an unchanged value never demands a key.
    const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const neededKeys = new Set<string>();
    for (const [key, value] of Object.entries(sanitized)) {
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