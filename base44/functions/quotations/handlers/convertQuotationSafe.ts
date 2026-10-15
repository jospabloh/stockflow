import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { applyStockForMovement, stockWarning } from '../../../shared/applyStock.ts';
import { hasPermission } from './_permissions.ts';
import { CONVERSION_STALE_MS, lastActivityMs, planConversion } from './_convertPlan.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const stockFailures: Array<{ movement_id: string; product_name?: string; error?: string }> = [];
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, payment_method } = body;

    if (!quotation_id) {
      return Response.json({ error: 'quotation_id is required' }, { status: 400 });
    }

    if (!payment_method || !payment_method.trim()) {
      return Response.json({ error: 'payment_method is required' }, { status: 400 });
    }

    // Fetch quotation to validate ownership — use asServiceRole to avoid RLS blocking almacenista users
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const quotation = quotations[0];

    // CRITICAL: Validate business_id ownership
    if (quotation.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate quotation status
    if (quotation.status === 'converted') {
      return Response.json({ error: 'Quotation already converted' }, { status: 400 });
    }

    // IDEMPOTENCY GUARD (P1 — duplicate movements) + REANUDACIÓN:
    // convertQuotationSafe is NOT atomic and was being invoked multiple times for
    // the same quotation (impatient double/triple-click while the multi-second
    // conversion was in flight, or client retries on a slow network). Each call
    // passed the status check above and created a FULL extra set of exit
    // movements, over-deducting stock.
    // Regla actual: si ya existen salidas de esta cotización y hubo actividad
    // reciente (< CONVERSION_STALE_MS), puede haber una corrida en vuelo → 409,
    // no se crea nada. Si las salidas son viejas y la cotización no quedó
    // `converted`, la conversión se cortó a medias (incidente Baristop
    // COT-261013-0004, 2026-10-15: 4 de 11 renglones, y el guardia anterior
    // bloqueaba la cotización para siempre) → se REANUDA: sólo se crean los
    // renglones que faltan (planConversion) y se termina de marcar `converted`.
    const existingMovements = await base44.asServiceRole.entities.Movement.filter({
      quotation_id: quotation.id,
      type: 'exit',
    });
    // Sólo se reanuda desde un estado previo a la venta: una cotización cancelada
    // también conserva sus salidas y NUNCA debe volver a `converted` por esta vía.
    // Y si alguna salida existente no corresponde a ningún renglón (se editó la
    // cotización después del corte), no se adivina: queda para revisión.
    const { matched, missing } = planConversion(quotation.items || [], existingMovements);
    let resumed = false;
    if (existingMovements.length > 0) {
      if (!['draft', 'sent', 'accepted'].includes(quotation.status || 'draft')) {
        return Response.json({ error: 'Quotation already converted', already_converted: true }, { status: 400 });
      }
      if (Date.now() - lastActivityMs(existingMovements) < CONVERSION_STALE_MS) {
        return Response.json({ error: 'Conversión en curso: espera unos minutos y vuelve a intentar.', conversion_in_progress: true }, { status: 409 });
      }
      if (matched.length !== existingMovements.length) {
        return Response.json({
          error: 'La conversión quedó a medias y sus salidas ya no coinciden con los renglones de la cotización; requiere revisión manual.',
          needs_review: true,
        }, { status: 409 });
      }
      resumed = true;
    }

    // PERMISSION CHECK — the granular key is re-checked server-side (the UI gate alone is bypassable).
    if (!(await hasPermission(base44.asServiceRole, user, 'Cotizaciones', 'convert'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Cotizaciones:convert' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const tenantBiz = bizArr[0];
    const billingStatus = tenantBiz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // PHASE 1: Validate stock BEFORE any operations — skip on-demand items
    // Sólo se validan los renglones que faltan (los ya registrados ya descontaron stock).
    const itemsWithStock = [];
    for (const item of missing) {
      let prods;
      try {
        prods = await base44.asServiceRole.entities.Product.filter({ id: item.product_id, business_id: user.business_id });
      } catch (err) {
        return Response.json({ error: `Error fetching product: ${err.message}` }, { status: 500 });
      }
      if (prods.length === 0) {
        return Response.json({ error: `Product ${item.product_id} not found` }, { status: 404 });
      }
      const product = prods[0];
      if (item.quantity > (product.stock || 0)) {
        return Response.json({ error: `Insufficient stock for ${item.product_name}: available ${product.stock}, requested ${item.quantity}` }, { status: 400 });
      }
      itemsWithStock.push({ ...item, product });
    }

    // PHASE 2: Create movements for catalog items only — on-demand items stay pending
    try {
      for (const item of itemsWithStock) {
        const mov = await base44.asServiceRole.entities.Movement.create({
          product_id: item.product_id,
          product_name: item.product_name,
          type: 'exit',
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.product.purchase_price ?? 0,
          total: item.total,
          stock_after: (item.product.stock || 0) - item.quantity,
          reference: `Venta ${quotation.folio}`,
          reason: `Venta a ${quotation.client_name}`,
          quotation_id: quotation.id,
          business_id: user.business_id,
        });
        // Descuento de stock síncrono y exactamente-una-vez (no depende del trigger).
        // Best-effort: automatización + dailyStockReconcile son respaldo.
        const r = await applyStockForMovement(base44, { movement_id: mov.id, business_id: user.business_id, product_id: mov.product_id, product_name: item.product_name, caller: 'convertQuotationSafe' });
        if (!r.ok) stockFailures.push({ movement_id: mov.id, product_name: item.product_name, error: r.error });
      }

      // Al reanudar: las salidas ya registradas cuyo stock no se aplicó se reintentan (idempotente).
      if (resumed) {
        for (const { item, movement } of matched) {
          if (movement.stock_applied === true) continue;
          const r = await applyStockForMovement(base44, { movement_id: movement.id, business_id: user.business_id, product_id: movement.product_id, product_name: item.product_name, caller: 'convertQuotationSafe' });
          if (!r.ok) stockFailures.push({ movement_id: movement.id, product_name: item.product_name, error: r.error });
        }
      }

      // Check if client has force_zero_price — if so, mark as paid automatically with "Sin cargo"
      const clientId = quotation.client_id;
      let isZeroPrice = (quotation.total || 0) === 0;
      if (!isZeroPrice && clientId) {
        const clients = await base44.asServiceRole.entities.Client.filter({ id: clientId, business_id: user.business_id });
        if (clients[0]?.force_zero_price) isZeroPrice = true;
      }

      const finalPaymentMethod = isZeroPrice ? 'Sin cargo' : payment_method.trim();

      // Update quotation status
       // CRITICAL FIX: DO NOT auto-register petty cash on conversion
       // Petty cash income is only registered when payments are actually confirmed
       // This prevents the bug where the FULL amount was registered as cash when only partial payment was cash
       // Preserve anticipos already registered (accepted/sent): amount_paid must equal
       // sum(payments[]) — never reset it to 0 while keeping payments[].
       const existingPayments = Array.isArray(quotation.payments) ? quotation.payments : [];
       const paidSoFar = existingPayments.reduce((s, p) => s + (Number(p?.amount) || 0), 0);
       const convTotal = quotation.total || 0;
       const convAmountPaid = isZeroPrice ? convTotal : paidSoFar;
       const convBalance = isZeroPrice ? 0 : Math.max(0, convTotal - paidSoFar);
       await base44.asServiceRole.entities.Quotation.update(quotation.id, {
         status: 'converted',
         payment_method: finalPaymentMethod,
         paid: isZeroPrice ? true : convBalance <= 0.01,
         amount_paid: convAmountPaid,
         balance: convBalance,
         payments: existingPayments,
       });

      return Response.json({ success: true, quotation_id, resumed, stock_warning: stockWarning(stockFailures) });
    } catch (error) {
      return Response.json({ error: error.message || 'Conversion failed' }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}