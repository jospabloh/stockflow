import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

            // 'entry' type: suma qty al stock (reversión correcta de la venta).
            // Usar 'return' restaría qty — dirección equivocada.
            const mov = await base44.asServiceRole.entities.Movement.create({
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
            // Reintegro de stock síncrono y exactamente-una-vez (no depende del trigger).
            await base44.asServiceRole.functions.invoke('applyMovementStock', {
              movement_id: mov.id,
              business_id: user.business_id,
            });
          }
        }
      } catch (error) {
        return Response.json({ error: 'Stock reversion failed: ' + (error as Error).message }, { status: 500 });
      }
    }

    // PHASE 2: Reverse all registered payments from petty cash (if any)
      try {
        // CRITICAL FIX: Clean up ALL cash payments registered against this quotation
        // Each payment in quotation.payments may have generated a petty cash movement
        const payments = quotation.payments || [];
        for (const payment of payments) {
          const isCashPayment = payment.payment_method && payment.payment_method.toLowerCase().includes('efectivo');
          if (isCashPayment && payment.petty_cash_movement_id) {
            try {
              // Delete the linked petty cash movement
              await base44.asServiceRole.entities.PettyCashMovement.delete(payment.petty_cash_movement_id);
            } catch (e) {
              console.error(`Failed to delete petty cash movement ${payment.petty_cash_movement_id}:`, e?.message);
            }
          }
        }

        // ALSO: Clean up ANY orphaned petty cash movements that reference this quotation folio
        // These are remnants from before the fix (entries without matching payments)
        try {
          const orphanedMovements = await base44.asServiceRole.entities.PettyCashMovement.filter({
            business_id: quotation.business_id,
            reference: quotation.folio,
            generated_by_system: true,
            origin_type: 'quotation',
          });

          for (const mov of orphanedMovements) {
            // Check if this movement is linked to any payment
            const isLinked = payments.some(p => p.petty_cash_movement_id === mov.id);
            if (!isLinked) {
              // Orphaned entry - delete it
              try {
                await base44.asServiceRole.entities.PettyCashMovement.delete(mov.id);
                console.log(`Deleted orphaned petty cash movement ${mov.id} for ${quotation.folio}`);
              } catch (e) {
                console.error(`Failed to delete orphaned movement ${mov.id}:`, e?.message);
              }
            }
          }
        } catch (e) {
          console.warn('Could not clean up orphaned petty cash movements:', e?.message);
        }

        // Also use syncCashSaleToPettyCash to reverse any remaining system-generated income
        if (quotation.paid) {
          try {
            await base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
              action: 'reverse',
              origin_type: 'quotation',
              origin_id: quotation.id,
              business_id: user.business_id,
            });
          } catch (e) {
            console.error('syncCashSaleToPettyCash reverse error:', e?.message);
          }
        }
      } catch (err) {
        console.error('Payment cleanup error:', err?.message);
      }

     // Mark quotation as cancelled
     try {
       await base44.asServiceRole.entities.Quotation.update(quotation.id, {
         status: 'cancelled',
         cancellation_reason: cancellation_reason || '',
         payments: [], // Clear all payments on cancellation
         amount_paid: 0,
         balance: quotation.total || 0,
       });

      return Response.json({
        success: true,
        quotation_id
      });
    } catch (error) {
      return Response.json({ error: (error as Error).message || 'Cancellation failed' }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});