import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';

/**
 * Safe Movement creation with business_id validation
 */

// Movements.jsx only checks `Movimientos:create` to show the "+" button, and
// MovementFormDialog.jsx separately hides the "Ajuste (solo admin)" option
// unless `Movimientos:adjustment` is granted — that second check was
// client-only until now, and `adjustment` is denied to almacenista BY
// DEFAULT (no admin override needed), unlike entry/exit/return which default
// to granted. See CLAUDE.md's granular-permissions sections for the pattern.
const TYPE_TO_ACTION: Record<string, string> = {
  entry: 'entry',
  exit: 'exit',
  return: 'return',
  adjustment: 'adjustment',
};

const CASH_RULE_KEY = 'cash_sales_to_petty_cash';
const DEFAULT_CASH_METHODS = ['Efectivo'];

function isCashMethod(method: string, allowed: string[] = DEFAULT_CASH_METHODS): boolean {
  if (!method) return false;
  const norm = (s: string) => String(s || '').trim().toLowerCase();
  return allowed.some((m) => norm(m) === norm(method));
}

export async function handle(req: Request): Promise<Response> {
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

    if (!(await hasPermission(base44.asServiceRole, user, 'Movimientos', 'create'))) {
      return Response.json({ success: false, error: 'Forbidden: missing Movimientos:create permission' }, { status: 403 });
    }
    const typeAction = TYPE_TO_ACTION[type];
    if (typeAction && !(await hasPermission(base44.asServiceRole, user, 'Movimientos', typeAction))) {
      return Response.json({ success: false, error: `Forbidden: missing Movimientos:${typeAction} permission` }, { status: 403 });
    }

    // Server-side ownership check for the referenced product. The frontend
    // (validateBusinessOwnership) only pre-validates the first item and is
    // bypassable; enforce here so a crafted product_id from another tenant
    // can't be attached to this business's movement.
    if (product_id) {
      const products = await base44.asServiceRole.entities.Product.filter({ id: product_id });
      const product = products[0];
      if (!product) {
        return Response.json({ success: false, error: 'Product not found' }, { status: 404 });
      }
      if (product.business_id !== user.business_id) {
        return Response.json({ success: false, error: 'Unauthorized: product belongs to a different business' }, { status: 403 });
      }
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

    // Aplicar el efecto sobre el stock de forma SÍNCRONA y exactamente-una-vez.
    // No depende del trigger del panel (resuelve precio cero); idempotente vía
    // stock_applied, por lo que la automatización no lo duplica.
    // Best-effort: si fallara, la automatización (idempotente) y dailyStockReconcile
    // actúan como respaldo; no se rompe el registro del movimiento.
    try {
      await base44.asServiceRole.functions.invoke('applyMovementStock', {
        movement_id: movement.id,
        business_id,
        'x-cron-secret': Deno.env.get('CRON_SECRET'),
      });
    } catch (e) {
      console.log(`[createMovementSafe] applyMovementStock failed for ${movement.id}: ${(e as Error).message}`);
    }

    // If this is a paid direct exit, reconcile petty cash based on tenant rule + payment method
    // Skip when total is 0 (force_zero_price / internal transfer)
    const movementTotal = (movement.quantity || 0) * (movement.unit_price || 0);
    if (movement.type === 'exit' && !movement.quotation_id && movement.paid && movementTotal > 0) {
      base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
        'x-cron-secret': Deno.env.get('CRON_SECRET'),
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
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}