import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { business_id, quotation_folio } = body;

    if (!business_id) {
      return Response.json({ error: 'business_id is required' }, { status: 400 });
    }

    // Find and delete the erroneous $100 cash entry for this quotation
    const movements = await base44.asServiceRole.entities.PettyCashMovement.filter({
      business_id,
      movement_type: 'income',
      amount: 100,
      generated_by_system: true,
      origin_type: 'quotation',
    });

    let deleted = 0;
    for (const mov of movements) {
      // If quotation_folio is provided, only delete if it matches
      if (quotation_folio && mov.reference !== quotation_folio) {
        continue;
      }

      try {
        await base44.asServiceRole.entities.PettyCashMovement.delete(mov.id);
        deleted++;
      } catch (e) {
        console.error(`Failed to delete movement ${mov.id}:`, e?.message);
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