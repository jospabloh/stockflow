import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { folio } = body;

    if (!folio) {
      return Response.json({ error: 'folio is required' }, { status: 400 });
    }

    // Find the quotation
    const quots = await base44.asServiceRole.entities.Quotation.filter({ folio });
    if (quots.length === 0) {
      return Response.json({ error: `Quotation ${folio} not found` }, { status: 404 });
    }

    const quotation = quots[0];
    console.log(`Found quotation: ${folio}, status: ${quotation.status}, business_id: ${quotation.business_id}`);

    // Find orphaned petty cash movements for this quotation
    const movements = await base44.asServiceRole.entities.PettyCashMovement.filter({
      business_id: quotation.business_id,
      reference: folio,
      generated_by_system: true,
      origin_type: 'quotation',
    });

    console.log(`Found ${movements.length} petty cash movements for ${folio}`);

    let deleted = 0;
    const payments = Array.isArray(quotation.payments) ? quotation.payments : [];

    for (const mov of movements) {
      // Check if this movement is linked to any payment
      const isLinked = payments.some(p => p.petty_cash_movement_id === mov.id);
      
      console.log(`Movement ${mov.id}: amount=$${mov.amount}, origin_id=${mov.origin_id}, linked=${isLinked}`);
      console.log(`Payments array: ${JSON.stringify(payments.map(p => ({ id: p.id, amount: p.amount, petty_cash_movement_id: p.petty_cash_movement_id })))}`);

      // If quotation is cancelled and this movement is a remnant, delete it regardless
      if (quotation.status === 'cancelled') {
        try {
          await base44.asServiceRole.entities.PettyCashMovement.delete(mov.id);
          deleted++;
          console.log(`Deleted movement ${mov.id} (quotation is cancelled)`);
        } catch (e) {
          console.error(`Failed to delete ${mov.id}:`, e?.message);
        }
      } else if (!isLinked) {
        // For non-cancelled quotations, only delete if truly orphaned
        try {
          await base44.asServiceRole.entities.PettyCashMovement.delete(mov.id);
          deleted++;
          console.log(`Deleted orphaned movement ${mov.id}`);
        } catch (e) {
          console.error(`Failed to delete ${mov.id}:`, e?.message);
        }
      }
    }

    return Response.json({
      success: true,
      folio,
      quotation_status: quotation.status,
      total_movements_found: movements.length,
      orphaned_deleted: deleted,
      message: `Cleaned up ${deleted} orphaned petty cash movement(s) for ${folio}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});