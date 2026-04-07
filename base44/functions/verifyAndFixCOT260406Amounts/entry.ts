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
    
    const quotationTotal = quotation.total || 0;
    const movementsTotals = movements.map(m => ({
      id: m.id,
      product_name: m.product_name,
      quantity: m.quantity,
      unit_price: m.unit_price,
      total: m.total,
      cost_price: m.cost_price,
      type: m.type
    }));

    const movementsGrandTotal = movements.reduce((sum, m) => sum + (m.total || 0), 0);

    return Response.json({
      success: true,
      quotation: {
        folio: quotation.folio,
        total: quotationTotal,
        items: quotation.items.length,
        itemsList: quotation.items
      },
      movements: {
        count: movements.length,
        grandTotal: movementsGrandTotal,
        details: movementsTotals
      },
      discrepancy: {
        difference: Math.abs(quotationTotal - movementsGrandTotal),
        quotationTotal,
        movementsTotal: movementsGrandTotal,
        isCongruent: Math.abs(quotationTotal - movementsGrandTotal) < 0.01
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});