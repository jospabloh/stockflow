import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { quotation_id, target_timestamp } = await req.json();
    
    if (!quotation_id || !target_timestamp) {
      return Response.json({ error: 'quotation_id and target_timestamp required' }, { status: 400 });
    }

    // Parse target timestamp to Date object
    const targetDate = new Date(target_timestamp);

    // Fetch all movements for this quotation using service role
    const movements = await base44.asServiceRole.entities.Movement.filter({ quotation_id });
    
    if (movements.length === 0) {
      return Response.json({ success: true, updated: 0, message: 'No movements found' });
    }

    let updated = 0;
    const results = [];

    // For each movement, we need to update it by deleting and recreating with correct date
    // But first, let's try updating with the raw API
    for (const movement of movements) {
      try {
        // Get movement data
        const movementData = movement.data || {};
        
        // Update the movement with the target date in the data
        const updateResult = await base44.asServiceRole.entities.Movement.update(movement.id, {
          ...movementData,
          created_date: target_timestamp
        });
        
        results.push({
          id: movement.id,
          product: movementData.product_name,
          updated: true
        });
        updated++;
      } catch (err) {
        console.error(`Failed to update movement ${movement.id}:`, err);
        results.push({
          id: movement.id,
          product: movement.data?.product_name,
          updated: false,
          error: err.message
        });
      }
    }

    return Response.json({ 
      success: true, 
      updated,
      total: movements.length,
      targetDate: target_timestamp,
      results
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});