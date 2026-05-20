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
    
    // Find and delete return movements
    const returnsToDelete = movements.filter(m => m.type === 'return');
    const deletedReturns = [];

    for (const returnMovement of returnsToDelete) {
      await base44.asServiceRole.entities.Movement.delete(returnMovement.id);
      deletedReturns.push({
        id: returnMovement.id,
        product_name: returnMovement.product_name,
        quantity: returnMovement.quantity,
        total: returnMovement.total
      });
    }

    // Verify final state
    const finalMovements = await base44.asServiceRole.entities.Movement.filter({ quotation_id: quotation.id });
    const finalGrandTotal = finalMovements.reduce((sum, m) => sum + (m.total || 0), 0);

    return Response.json({
      success: true,
      message: `Deleted ${deletedReturns.length} return movement(s)`,
      deletedReturns: deletedReturns,
      finalState: {
        movementCount: finalMovements.length,
        quotationTotal: quotation.total,
        movementsTotal: finalGrandTotal,
        isCongruent: Math.abs(quotation.total - finalGrandTotal) < 0.01
      }
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});