import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, cancellation_reason } = body;

    if (!quotation_id) {
      return Response.json({ error: 'quotation_id is required' }, { status: 400 });
    }

    // Fetch quotation to validate ownership
    const quotations = await base44.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const quotation = quotations[0];

    // CRITICAL: Validate business_id ownership
    if (quotation.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PHASE 1: If converted, revert stock
    if (quotation.status === 'converted') {
      try {
        const exitMovements = await base44.entities.Movement.filter({
          quotation_id: quotation.id,
          type: 'exit',
          business_id: user.business_id,
        });

        for (const exitMov of exitMovements) {
          const prods = await base44.entities.Product.filter({ id: exitMov.product_id, business_id: user.business_id });
          const product = prods[0];

          if (product) {
            const restoredStock = (product.stock || 0) + exitMov.quantity;

            // Create return movement
            await base44.entities.Movement.create({
              product_id: exitMov.product_id,
              product_name: exitMov.product_name,
              type: 'return',
              quantity: exitMov.quantity,
              unit_price: exitMov.unit_price,
              total: exitMov.total,
              stock_after: restoredStock,
              reference: `Cancelación ${quotation.folio}`,
              reason: `Cancelación: ${cancellation_reason || 'Sin motivo especificado'}`,
              quotation_id: quotation.id,
              business_id: user.business_id,
            });

            // Update product stock using safe function
            await base44.asServiceRole.functions.invoke('updateProductStockSafe', {
              product_id: product.id,
              new_stock: restoredStock,
              business_id: user.business_id
            });
          }
        }
      } catch (error) {
        return Response.json({ error: 'Stock reversion failed' }, { status: 500 });
      }
    }

    // PHASE 2: Mark quotation as cancelled with whitelist
    try {
      await base44.asServiceRole.entities.Quotation.update(quotation.id, {
        status: 'cancelled',
        cancellation_reason: cancellation_reason || ''
      });

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