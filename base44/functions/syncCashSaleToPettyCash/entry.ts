import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RULE_KEY = 'cash_sales_to_petty_cash';
const CASH_KEYWORDS = ['efectivo', 'cash'];

type SyncAction = 'create' | 'reverse' | 'reconcile';

function isCash(method: string) {
  if (!method) return false;
  const normalized = method.toLowerCase();
  return CASH_KEYWORDS.some((k) => normalized.includes(k));
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

    if (!business_id || business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden: business_id mismatch' }, { status: 403 });
    }

    const normalizedAction: SyncAction = ['create', 'reverse', 'reconcile'].includes(action) ? action : 'reconcile';

    if (!origin_type || !origin_id) {
      return Response.json({ error: 'origin_type and origin_id are required' }, { status: 400 });
    }

    const [ruleRows, allExisting] = await Promise.all([
      base44.asServiceRole.entities.TenantRule.filter({ business_id, rule_key: RULE_KEY }),
      base44.asServiceRole.entities.PettyCashMovement.filter({ business_id, origin_id }),
    ]);

    const rule = ruleRows.find((r) => !r.archived);
    const isRuleEnabled = Boolean(rule?.enabled);
    const existingRecord = allExisting.find((r) => r.origin_id === origin_id && r.generated_by_system === true);

    if (!isRuleEnabled) {
      // Rule disabled: ensure no stale auto-generated entries remain.
      if (existingRecord) {
        await base44.asServiceRole.entities.PettyCashMovement.delete(existingRecord.id);
      }
      return Response.json({ success: true, skipped: true, reason: 'rule_disabled', reversed: Boolean(existingRecord) });
    }

    const qualifiesForCashIncome = Boolean(amount && amount > 0 && isCash(payment_method || ''));

    const shouldReverse = normalizedAction === 'reverse' || !qualifiesForCashIncome;
    if (shouldReverse) {
      if (existingRecord) {
        await base44.asServiceRole.entities.PettyCashMovement.delete(existingRecord.id);
      }
      if (rule?.id) {
        await base44.asServiceRole.entities.TenantRule.update(rule.id, { last_applied_at: new Date().toISOString() });
      }
      return Response.json({ success: true, reversed: Boolean(existingRecord), reason: existingRecord ? 'reversed' : 'no_record_found' });
    }

    // action create/reconcile with valid cash payment
    if (!movement_date) {
      return Response.json({ error: 'movement_date is required' }, { status: 400 });
    }

    const payload = {
      business_id,
      movement_type: 'income',
      amount,
      description: description || `Venta en efectivo — ${folio_or_ref || origin_id}`,
      category: 'Venta efectivo',
      movement_date,
      reference: folio_or_ref || origin_id,
      notes: `Generado automáticamente por regla tenant '${RULE_KEY}'. Origen: ${origin_type} ${origin_id}.`,
      generated_by_system: true,
      origin_type,
      origin_id,
      payment_method_snapshot: payment_method,
    };

    if (existingRecord) {
      await base44.asServiceRole.entities.PettyCashMovement.update(existingRecord.id, payload);
      if (rule?.id) {
        await base44.asServiceRole.entities.TenantRule.update(rule.id, { last_applied_at: new Date().toISOString() });
      }
      return Response.json({ success: true, updated: true, petty_cash_id: existingRecord.id });
    }

    const created = await base44.asServiceRole.entities.PettyCashMovement.create(payload);
    if (rule?.id) {
      await base44.asServiceRole.entities.TenantRule.update(rule.id, { last_applied_at: new Date().toISOString() });
    }
    return Response.json({ success: true, created: true, petty_cash_id: created.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
