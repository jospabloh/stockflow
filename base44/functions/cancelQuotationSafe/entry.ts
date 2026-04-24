import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
       return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
     }

     if (!user.business_id) {
       return Response.json({ error: 'User has no business assigned' }, { status: 403 });
     }

     const body = await req.json();
     const { quotation_id, cancellation_reason } = body;

     if (!quotation_id) {
       return Response.json({ error: 'quotation_id is required' }, { status: 400 });
     }

     // Fetch quotation to validate ownership — use asServiceRole to avoid RLS blocking
     const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const quotation = quotations[0];

    // CRITICAL: Validate business_id ownership
    if (quotation.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const tenantBiz = bizArr[0];
    const billingStatus = tenantBiz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // PHASE 1: If converted, revert stock — net balance approach
    // This handles cases where partial returns were already processed:
    // We calculate net exits (exits - existing returns) per product and only restore that net amount.
    if (quotation.status === 'converted') {
      try {
        // Fetch ALL movements linked to this quotation (exits AND existing returns)
        const allMovements = await base44.entities.Movement.filter({
          quotation_id: quotation.id,
          business_id: user.business_id,
        });

        // Build net quantity to restore per product
        const netByProduct = {};
        for (const mov of allMovements) {
          if (!netByProduct[mov.product_id]) {
            netByProduct[mov.product_id] = { quantity: 0, product_name: mov.product_name, unit_price: mov.unit_price };
          }
          if (mov.type === 'exit') {
            netByProduct[mov.product_id].quantity += mov.quantity;
          } else if (mov.type === 'return') {
            // Already returned — subtract from what needs to be restored
            netByProduct[mov.product_id].quantity -= mov.quantity;
          }
        }

        // Restore only the net pending quantity per product
        for (const [product_id, data] of Object.entries(netByProduct)) {
          if (data.quantity <= 0) continue; // Already fully returned, skip

          const prods = await base44.entities.Product.filter({ id: product_id, business_id: user.business_id });
          const product = prods[0];

          if (product) {
            const restoredStock = (product.stock || 0) + data.quantity;

            // 'entry' type: syncProductStock automation adds qty to stock (correct reversion).
            // Using 'return' would cause automation to SUBTRACT qty — wrong direction.
            // No explicit stock update: automation is the sole stock authority.
            await base44.entities.Movement.create({
              product_id: product_id,
              product_name: data.product_name,
              type: 'entry',
              quantity: data.quantity,
              unit_price: data.unit_price,
              total: data.unit_price * data.quantity,
              stock_after: restoredStock,
              reference: `Cancelación ${quotation.folio}`,
              reason: `Cancelación: ${cancellation_reason || 'Sin motivo especificado'}`,
              quotation_id: quotation.id,
              business_id: user.business_id,
            });
          }
        }
      } catch (error) {
        return Response.json({ error: 'Stock reversion failed: ' + error.message }, { status: 500 });
      }
    }

    // PHASE 2: Mark quotation as cancelled
    try {
      await base44.asServiceRole.entities.Quotation.update(quotation.id, {
        status: 'cancelled',
        cancellation_reason: cancellation_reason || ''
      });

      // TENANT-SCOPED: Reverse any system-generated petty cash income linked to this quotation
      // Only relevant if the quotation was previously paid (cash income already recorded)
      if (quotation.paid) {
        base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
          action: 'reverse',
          origin_type: 'quotation',
          origin_id: quotation.id,
          business_id: user.business_id,
        }).catch(() => {});
      }

      return Response.json({
        success: true,
        quotation_id
      });
    } catch (error) {
      return Response.json({ error: error.message || 'Cancellation failed' }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});