import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { business_id } = body;

    if (!business_id) {
      return Response.json({ error: 'business_id is required' }, { status: 400 });
    }

    // Find and delete erroneous $100 income entries that were auto-generated from quotation conversion
    // These are the ones mistakenly created before the fix to convertQuotationSafe
    const allMovements = await base44.asServiceRole.entities.PettyCashMovement.filter({
      business_id,
      movement_type: 'income',
      generated_by_system: true,
      origin_type: 'quotation',
    }, '-created_date', 1000);

    let deleted = 0;
    const toDelete = [];

    for (const mov of allMovements) {
      // Identify erroneous entries: $100 income entries with description "Pago efectivo — COT-260508-0008 | Roseta Fico"
      // or any $100 that don't have a matching payment in quotation.payments array
      if (mov.amount === 100 && mov.description && mov.description.includes('Pago efectivo')) {
        // Try to find if this has a valid payment link
        const quotFolio = mov.reference;
        if (quotFolio) {
          const quots = await base44.asServiceRole.entities.Quotation.filter({ 
            business_id, 
            folio: quotFolio 
          });
          
          if (quots.length > 0) {
            const q = quots[0];
            const payments = Array.isArray(q.payments) ? q.payments : [];
            const hasValidPayment = payments.some(p => 
              p.amount === 100 && p.petty_cash_movement_id === mov.id
            );
            
            // If no matching payment found, it's erroneous
            if (!hasValidPayment) {
              toDelete.push(mov.id);
            }
          } else {
            // Quotation doesn't exist or folio not found, likely orphaned
            toDelete.push(mov.id);
          }
        }
      }
    }

    // Delete identified erroneous entries
    for (const movId of toDelete) {
      try {
        await base44.asServiceRole.entities.PettyCashMovement.delete(movId);
        deleted++;
      } catch (e) {
        console.error(`Failed to delete movement ${movId}:`, e?.message);
      }
    }

    return Response.json({
      success: true,
      deleted,
      message: `Eliminados ${deleted} movimiento(s) de caja chica erróneo(s)`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});