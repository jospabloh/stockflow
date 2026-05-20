import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { quotation_id, target_date } = await req.json();
    
    if (!quotation_id || !target_date) {
      return Response.json({ error: 'quotation_id and target_date required' }, { status: 400 });
    }

    // Fetch all movements for this quotation
    const movements = await base44.asServiceRole.entities.Movement.filter({ quotation_id });
    
    if (movements.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }

    // Update each movement with the target date
    let updated = 0;
    for (const movement of movements) {
      try {
        await base44.asServiceRole.entities.Movement.update(movement.id, {
          created_date: target_date
        });
        updated++;
      } catch (err) {
        console.error(`Failed to update movement ${movement.id}:`, err);
      }
    }

    return Response.json({ 
      success: true, 
      updated,
      total: movements.length,
      message: `Updated ${updated} movements to ${target_date}`
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});