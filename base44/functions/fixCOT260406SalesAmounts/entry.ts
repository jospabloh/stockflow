import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the quotation COT-260406-0002
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ folio: "COT-260406-0002" });
    const quotation = quotations[0];
    if (!quotation) {
      return Response.json({ error: 'Quotation COT-260406-0002 not found' }, { status: 404 });
    }

    // Get all movements linked to this quotation
    const movements = await base44.asServiceRole.entities.Movement.filter({ quotation_id: quotation.id });
    
    // Build a map of products from quotation items: product_id -> unit_price (corrected)
    const quotationPrices = {};
    quotation.items.forEach(item => {
      quotationPrices[item.product_id] = item.unit_price;
    });

    // Update only "exit" type movements with correct prices
    const updates = [];
    for (const movement of movements) {
      if (movement.type === 'exit' && quotationPrices[movement.product_id]) {
        const correctUnitPrice = quotationPrices[movement.product_id];
        const correctTotal = movement.quantity * correctUnitPrice;
        
        await base44.asServiceRole.entities.Movement.update(movement.id, {
          unit_price: correctUnitPrice,
          total: correctTotal
        });
        
        updates.push({
          id: movement.id,
          product_name: movement.product_name,
          old_unit_price: movement.unit_price,
          new_unit_price: correctUnitPrice,
          old_total: movement.total,
          new_total: correctTotal
        });
      }
    }

    // Verify final state
    const finalMovements = await base44.asServiceRole.entities.Movement.filter({ quotation_id: quotation.id });
    const finalGrandTotal = finalMovements.reduce((sum, m) => sum + (m.total || 0), 0);

    return Response.json({
      success: true,
      message: `Fixed ${updates.length} exit movements`,
      updates: updates,
      finalState: {
        quotationTotal: quotation.total,
        movementsTotal: finalGrandTotal,
        isCongruent: Math.abs(quotation.total - finalGrandTotal) < 0.01
      }
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});