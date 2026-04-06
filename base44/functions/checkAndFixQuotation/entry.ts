import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { folio } = body;

    if (!folio) {
      return Response.json({ error: 'folio is required' }, { status: 400 });
    }

    // Find quotation by folio
    const quotations = await base44.entities.Quotation.filter({
      folio: folio,
      business_id: user.business_id
    });

    if (quotations.length === 0) {
      return Response.json({
        success: false,
        error: `Cotización ${folio} no encontrada`,
        status: null
      });
    }

    const quotation = quotations[0];

    // Si está en borrador, solo delete
    if (quotation.status === 'draft') {
      await base44.asServiceRole.entities.Quotation.delete(quotation.id);
      return Response.json({
        success: true,
        message: `Cotización ${folio} en estado BORRADOR fue eliminada.`,
        status: 'draft',
        action: 'deleted'
      });
    }

    // Si está concretada, hacer rollback
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
            netByProduct[mov.product_id].quantity -= mov.quantity;
          }
        }

        // Restore stock for each product
        const restoredProducts = [];
        for (const [product_id, data] of Object.entries(netByProduct)) {
          if (data.quantity <= 0) continue;

          const prods = await base44.entities.Product.filter({ id: product_id, business_id: user.business_id });
          const product = prods[0];

          if (product) {
            const restoredStock = (product.stock || 0) + data.quantity;

            // Create return movement
            await base44.entities.Movement.create({
              product_id: product_id,
              product_name: data.product_name,
              type: 'return',
              quantity: data.quantity,
              unit_price: data.unit_price,
              total: data.unit_price * data.quantity,
              stock_after: restoredStock,
              reference: `Rollback ${quotation.folio}`,
              reason: `Rollback/Anulación: Cotización concretada fue revertida`,
              quotation_id: quotation.id,
              business_id: user.business_id,
              cost_price: data.unit_price, // Ensure cost_price is set
            });

            // Update product stock
            await base44.asServiceRole.functions.invoke('updateProductStockSafe', {
              product_id: product.id,
              new_stock: restoredStock,
              business_id: user.business_id
            });

            restoredProducts.push({
              product_name: data.product_name,
              quantity: data.quantity,
              newStock: restoredStock
            });
          }
        }

        // Mark quotation as cancelled
        await base44.asServiceRole.entities.Quotation.update(quotation.id, {
          status: 'cancelled',
          cancellation_reason: 'Rollback automático - Cotización revertida'
        });

        return Response.json({
          success: true,
          message: `Cotización ${folio} en estado CONCRETADA - Rollback completado.`,
          status: 'converted',
          action: 'rolled_back',
          restored_products: restoredProducts,
          movements_created: restoredProducts.length
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: `Rollback fallido: ${error.message}`,
          status: 'converted'
        }, { status: 500 });
      }
    }

    // Para otros estados
    return Response.json({
      success: false,
      error: `Cotización ${folio} tiene estado ${quotation.status}. Solo se puede corregir si está en BORRADOR o CONCRETADA.`,
      status: quotation.status
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});