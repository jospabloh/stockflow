import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { hasPermission } from './_permissions.ts';

// Flujo de devolución parcial:
// 1. Recibe quotation_id y los items devueltos (product_id + quantity)
// 2. Valida ownership
// 3. Crea movimientos de tipo "return" para cada item devuelto
// 4. Actualiza el total de la cotización (quita los items devueltos)
// 5. Incrementa el stock de los productos devueltos
// 6. [Baristop / cash_sales_to_petty_cash] Si petty_cash_deduction=true y la venta fue en efectivo,
//    registra un egreso en caja chica por el monto devuelto

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
     if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

     if (!user.business_id) {
       return Response.json({ error: 'User has no business assigned' }, { status: 403 });
     }

     const body = await req.json();
    const { quotation_id, returned_items, reason, petty_cash_deduction } = body;
    // returned_items: [{ product_id, product_name, quantity, unit_price, tax_rate }]
    // petty_cash_deduction: boolean — si true y la venta fue en efectivo, deduce de caja chica

    if (!quotation_id || !returned_items?.length) {
      return Response.json({ error: 'quotation_id y returned_items son requeridos' }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return Response.json({ error: 'Comentario obligatorio requerido' }, { status: 400 });
    }

    // Fetch quotation — use asServiceRole to avoid RLS blocking
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) return Response.json({ error: 'Cotización no encontrada' }, { status: 404 });
    const quotation = quotations[0];

    if (quotation.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (quotation.status !== 'converted') return Response.json({ error: 'Solo se pueden hacer devoluciones de ventas concretadas' }, { status: 400 });

    // PERMISSION CHECK — the granular key is re-checked server-side (the UI gate alone is bypassable).
    if (!(await hasPermission(base44.asServiceRole, user, 'Cotizaciones', 'return'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Cotizaciones:return' }, { status: 403 });
    }

    // LICENSE CHECK — returns are allowed even in view_only (they correct existing data)
    // Intentionally not blocking here: returns protect business from stuck stock

    // Validate returned items exist in quotation.
    // quantity debe ser entero > 0 (una cantidad negativa bajaba stock y subía el total);
    // el acumulado por producto no puede exceder lo vendido; el precio se toma de la
    // cotización (el unit_price del cliente se ignora).
    const requested: Record<string, number> = {};
    for (const ri of returned_items) {
      const match = (quotation.items || []).find(i => i.product_id === ri.product_id);
      if (!match) return Response.json({ error: `Producto ${ri.product_name} no está en la cotización` }, { status: 400 });
      if (typeof ri.quantity !== 'number' || !Number.isInteger(ri.quantity) || ri.quantity <= 0) {
        return Response.json({ error: `Cantidad inválida para ${ri.product_name}: debe ser un entero mayor a 0` }, { status: 400 });
      }
      requested[ri.product_id] = (requested[ri.product_id] || 0) + ri.quantity;
      if (requested[ri.product_id] > match.quantity) return Response.json({ error: `Cantidad devuelta mayor a la vendida para ${ri.product_name}` }, { status: 400 });
      ri.unit_price = match.unit_price;
    }

    // Create return movements and update stock
    for (const ri of returned_items) {
      const prods = await base44.asServiceRole.entities.Product.filter({ id: ri.product_id, business_id: user.business_id });
      if (prods.length === 0) continue;
      const product = prods[0];
      const newStock = (product.stock || 0) + ri.quantity;

      // 'entry' type: suma qty al stock (correcto para una devolución de cliente).
      // Usar 'return' restaría qty — dirección equivocada.
      const mov = await base44.asServiceRole.entities.Movement.create({
        product_id: ri.product_id,
        product_name: ri.product_name,
        type: 'entry',
        quantity: ri.quantity,
        unit_price: ri.unit_price,
        total: ri.quantity * ri.unit_price,
        stock_after: newStock,
        reference: `Devolución ${quotation.folio}`,
        reason: reason.trim(),
        quotation_id: quotation.id,
        business_id: user.business_id,
      });
      // Reintegro de stock síncrono y exactamente-una-vez (no depende del trigger).
      // Best-effort: automatización + dailyStockReconcile son respaldo.
      try {
        await base44.asServiceRole.functions.invoke('movements', {
          action: 'applyMovementStock',
          movement_id: mov.id,
          business_id: user.business_id,
          'x-cron-secret': Deno.env.get('CRON_SECRET'),
        });
      } catch (e) {
        console.log(`[partialReturnQuotation] applyMovementStock failed for ${mov.id}: ${(e as Error).message}`);
      }
    }

    // Recalculate quotation totals removing returned items
    const updatedItems = (quotation.items || []).map(item => {
      const returned = returned_items.find(r => r.product_id === item.product_id);
      if (!returned) return item;
      const newQty = item.quantity - returned.quantity;
      return newQty > 0
        ? { ...item, quantity: newQty, total: newQty * item.unit_price }
        : null;
    }).filter(Boolean);

    const newTotal = updatedItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const taxableTotal = updatedItems.reduce((sum, i) => (i.tax_rate > 0 ? sum + (i.total || 0) : sum), 0);
    const newTax = taxableTotal - (taxableTotal / 1.16);
    const newSubtotal = newTotal - newTax;

    // Mantener consistentes amount_paid / balance / payments con el nuevo total.
    // Cobrado hasta ahora (legacy: venta pagada sin amount_paid => se asume el total anterior).
    const oldAmountPaid = quotation.amount_paid > 0
      ? quotation.amount_paid
      : (quotation.paid ? (quotation.total || 0) : 0);
    const excess = Math.max(0, Math.round((oldAmountPaid - newTotal) * 100) / 100);
    const paymentUpdate: Record<string, unknown> = {};
    let newAmountPaid = oldAmountPaid;
    if (excess > 0) {
      // Excedente cobrado por encima del nuevo total: ajuste negativo (devolución) en el historial.
      newAmountPaid = oldAmountPaid - excess;
      const existing = Array.isArray(quotation.payments) ? quotation.payments : [];
      // Legacy (paid=true, amount_paid=0, payments=[]): sembrar primero el cobro previo para que
      // sum(payments) = amount_paid y el frontend (que prefiere payments[]) no reporte cobro negativo.
      const base = (existing.length === 0 && oldAmountPaid > 0)
        ? [{
            id: crypto.randomUUID(),
            amount: oldAmountPaid,
            payment_method: quotation.payment_method || '',
            paid_at: quotation.updated_date || new Date().toISOString(),
            registered_by: user.id,
            notes: 'Pago previo consolidado (legacy)',
          }]
        : [];
      paymentUpdate.payments = [
        ...base,
        ...existing,
        {
          id: crypto.randomUUID(),
          amount: -excess,
          paid_at: new Date().toISOString(),
          payment_method: quotation.payment_method || '',
          notes: `Ajuste por devolución parcial — ${reason.trim()}`,
          registered_by: user.id,
        },
      ];
    }
    const newBalance = Math.max(0, newTotal - newAmountPaid);

    await base44.asServiceRole.entities.Quotation.update(quotation.id, {
      items: updatedItems,
      total: newTotal,
      subtotal: newSubtotal,
      tax: newTax,
      amount_paid: newAmountPaid,
      balance: newBalance,
      paid: quotation.paid === true || (newAmountPaid > 0 && newBalance <= 0),
      ...paymentUpdate,
    });

    // TENANT-SCOPED: Caja chica — egreso por devolución de venta en efectivo
    // Solo aplica si: el usuario confirmó deducir, la venta fue pagada en efectivo,
    // y el tenant tiene activa la regla cash_sales_to_petty_cash.
    if (petty_cash_deduction === true && quotation.paid && isCashMethod(quotation.payment_method)) {
      try {
        const ruleRows = await base44.asServiceRole.entities.TenantRule.filter({
          business_id: user.business_id,
          rule_key: CASH_RULE_KEY,
        });
        const rule = ruleRows.find((r) => !r.archived && r.enabled);

        if (rule) {
          const allowedMethods: string[] =
            Array.isArray(rule.config_json?.payment_methods) && rule.config_json.payment_methods.length > 0
              ? rule.config_json.payment_methods
              : DEFAULT_CASH_METHODS;

          const returnAmount = returned_items.reduce(
            (sum: number, ri: { quantity: number; unit_price: number }) => sum + ri.quantity * ri.unit_price,
            0,
          );

          if (returnAmount > 0 && isCashMethod(quotation.payment_method, allowedMethods)) {
            await base44.asServiceRole.entities.PettyCashMovement.create({
              business_id: user.business_id,
              movement_type: 'expense',
              amount: returnAmount,
              description: `Devolución en efectivo — ${quotation.folio} — ${reason.trim()}`,
              category: 'Devolución efectivo',
              movement_date: new Date().toLocaleDateString('en-CA'),
              reference: quotation.folio,
              notes: `Generado automáticamente por devolución de venta en efectivo. Cotización: ${quotation.id}. Regla: ${CASH_RULE_KEY}.`,
              generated_by_system: true,
              origin_type: 'quotation_return',
              origin_id: quotation.id,
              payment_method_snapshot: quotation.payment_method,
            });

            if (rule.id) {
              await base44.asServiceRole.entities.TenantRule.update(rule.id, {
                last_applied_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (_err) {
        // Fire-and-forget: un fallo en caja chica no bloquea la devolución de inventario
      }
    }

    return Response.json({ success: true, quotation_id, returned_count: returned_items.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}