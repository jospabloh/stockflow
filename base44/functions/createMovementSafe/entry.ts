import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Safe Movement creation with business_id validation
 */

const CASH_RULE_KEY = 'cash_sales_to_petty_cash';
const DEFAULT_CASH_METHODS = ['Efectivo'];

function isCashMethod(method: string, allowed: string[] = DEFAULT_CASH_METHODS): boolean {
  if (!method) return false;
  const norm = (s: string) => String(s || '').trim().toLowerCase();
  return allowed.some((m) => norm(m) === norm(method));
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
      product_id, product_name, type, quantity, unit_price, cost_price,
      total, reason, reference, stock_after, quotation_id, business_id,
      paid, petty_cash_deduction,
    } = body;
    // petty_cash_deduction: boolean — solo aplica en type='return' en efectivo con regla activa

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }

    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const movement = await base44.asServiceRole.entities.Movement.create({
      product_id,
      product_name,
      type,
      quantity,
      unit_price,
      cost_price: cost_price ?? null,
      total,
      reason,
      reference,
      stock_after,
      quotation_id,
      business_id,
      paid: paid ?? false
    });

    // If this is a paid direct exit, reconcile petty cash based on tenant rule + payment method
    // Skip when total is 0 (force_zero_price / internal transfer)
    const movementTotal = (movement.quantity || 0) * (movement.unit_price || 0);
    if (movement.type === 'exit' && !movement.quotation_id && movement.paid && movementTotal > 0) {
      base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
        action: 'reconcile',
        origin_type: 'movement',
        origin_id: movement.id,
        amount: movementTotal,
        payment_method: movement.reference || '',
        description: `Venta directa — ${movement.product_name || ''} (${movement.reason || ''})`,
        folio_or_ref: movement.reference || movement.id,
        movement_date: new Date().toLocaleDateString('en-CA'),
        business_id,
      }).catch(() => {});
    }

    // TENANT-SCOPED: Caja chica — egreso por devolución de movimiento en efectivo
    // Solo aplica si: type='return', el usuario confirmó deducir, el método de reembolso es efectivo
    // y el tenant tiene activa la regla cash_sales_to_petty_cash.
    if (movement.type === 'return' && petty_cash_deduction === true && isCashMethod(movement.reference || '')) {
      base44.asServiceRole.entities.TenantRule.filter({ business_id, rule_key: CASH_RULE_KEY })
        .then(async (ruleRows) => {
          const rule = ruleRows.find((r) => !r.archived && r.enabled);
          if (!rule) return;

          const allowedMethods: string[] =
            Array.isArray(rule.config_json?.payment_methods) && rule.config_json.payment_methods.length > 0
              ? rule.config_json.payment_methods
              : DEFAULT_CASH_METHODS;

          if (!isCashMethod(movement.reference || '', allowedMethods)) return;

          const refundAmount = (movement.quantity || 0) * (movement.unit_price || 0);
          if (refundAmount <= 0) return;

          await base44.asServiceRole.entities.PettyCashMovement.create({
            business_id,
            movement_type: 'expense',
            amount: refundAmount,
            description: `Devolución en efectivo — ${movement.product_name || ''} (${movement.reason || ''})`,
            category: 'Devolución efectivo',
            movement_date: new Date().toLocaleDateString('en-CA'),
            reference: movement.reference || '',
            notes: `Generado automáticamente por devolución de movimiento en efectivo. Movimiento: ${movement.id}. Regla: ${CASH_RULE_KEY}.`,
            generated_by_system: true,
            origin_type: 'movement_return',
            origin_id: movement.id,
            payment_method_snapshot: movement.reference || '',
          });

          if (rule.id) {
            await base44.asServiceRole.entities.TenantRule.update(rule.id, {
              last_applied_at: new Date().toISOString(),
            });
          }
        })
        .catch(() => {});
    }

    return Response.json({ success: true, movement_id: movement.id, movement });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});