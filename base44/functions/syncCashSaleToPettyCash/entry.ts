import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * syncCashSaleToPettyCash
 *
 * Tenant-scoped helper that creates or reverses a system-generated petty cash income
 * for cash sales, only for tenants that have auto_cash_income_to_petty_cash = true.
 *
 * Payload:
 *   action: "create" | "reverse"
 *   origin_type: "quotation" | "movement"
 *   origin_id: string (quotation.id or movement.id)
 *   amount: number (required for "create")
 *   payment_method: string (required for "create")
 *   description: string (required for "create")
 *   folio_or_ref: string (label for reference field)
 *   movement_date: string YYYY-MM-DD (required for "create")
 *   business_id: string (must match authenticated user's business_id)
 *
 * Idempotency:
 *   - create: checks if a record with the same origin_id already exists → skips if found
 *   - reverse: deletes any record with the same origin_id if found
 */

const CASH_KEYWORDS = ['efectivo'];

function isCash(method) {
  if (!method) return false;
  return CASH_KEYWORDS.some(k => method.toLowerCase().includes(k));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      action,
      origin_type,
      origin_id,
      amount,
      payment_method,
      description,
      folio_or_ref,
      movement_date,
      business_id,
    } = body;

    // Validate business_id ownership
    if (!business_id || business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden: business_id mismatch' }, { status: 403 });
    }

    if (!['create', 'reverse'].includes(action)) {
      return Response.json({ error: 'action must be create or reverse' }, { status: 400 });
    }

    if (!origin_type || !origin_id) {
      return Response.json({ error: 'origin_type and origin_id are required' }, { status: 400 });
    }

    // Resolve the tenant's business and check feature flag
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const biz = bizArr[0];

    if (!biz) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // TENANT FEATURE FLAG — only proceed if enabled for this tenant
    if (!biz.auto_cash_income_to_petty_cash) {
      return Response.json({ success: true, skipped: true, reason: 'feature_not_enabled' });
    }

    // Find existing derived petty cash record for this origin
    const existing = await base44.asServiceRole.entities.PettyCashMovement.filter({
      business_id,
      origin_id,
    });
    const existingRecord = existing.find(r => r.origin_id === origin_id && r.generated_by_system === true);

    if (action === 'reverse') {
      if (existingRecord) {
        await base44.asServiceRole.entities.PettyCashMovement.delete(existingRecord.id);
        return Response.json({ success: true, reversed: true, deleted_id: existingRecord.id });
      }
      // Nothing to reverse
      return Response.json({ success: true, reversed: false, reason: 'no_record_found' });
    }

    // action === 'create'
    if (!amount || amount <= 0) {
      return Response.json({ error: 'amount must be > 0' }, { status: 400 });
    }
    if (!movement_date) {
      return Response.json({ error: 'movement_date is required' }, { status: 400 });
    }

    // Only create for cash payments
    if (!isCash(payment_method)) {
      return Response.json({ success: true, skipped: true, reason: 'not_cash_payment' });
    }

    // Idempotency: skip if already exists
    if (existingRecord) {
      return Response.json({ success: true, skipped: true, reason: 'already_exists', id: existingRecord.id });
    }

    // Create the system-generated petty cash income
    const created = await base44.asServiceRole.entities.PettyCashMovement.create({
      business_id,
      movement_type: 'income',
      amount,
      description: description || `Venta en efectivo — ${folio_or_ref || origin_id}`,
      category: 'Venta efectivo',
      movement_date,
      reference: folio_or_ref || origin_id,
      notes: `Generado automáticamente por venta en efectivo cobrada. Origen: ${origin_type} ${origin_id}.`,
      generated_by_system: true,
      origin_type,
      origin_id,
      payment_method_snapshot: payment_method,
    });

    return Response.json({ success: true, created: true, petty_cash_id: created.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});