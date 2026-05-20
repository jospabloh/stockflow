import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;

    // Fetch all movements and quotations for this business
    const movements = await base44.entities.Movement.filter({ business_id: businessId }, null, 1000);
    const quotations = await base44.entities.Quotation.filter({ business_id: businessId }, null, 1000);

    // Delete all movements
    for (const m of movements) {
      await base44.entities.Movement.delete(m.id);
    }

    // Delete all quotations
    for (const q of quotations) {
      await base44.entities.Quotation.delete(q.id);
    }

    return Response.json({
      status: 'success',
      deleted_movements: movements.length,
      deleted_quotations: quotations.length,
      message: 'All test data cleaned'
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});