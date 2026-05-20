import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.business_id) {
      return Response.json({ error: 'Unauthorized or no business assigned' }, { status: 401 });
    }

    const { entity_name, record_id, operation } = await req.json();
    
    if (!entity_name || !record_id) {
      return Response.json({ error: 'entity_name and record_id required' }, { status: 400 });
    }

    // Fetch record using service role to bypass RLS
    const records = await base44.asServiceRole.entities[entity_name].filter({ id: record_id });
    
    if (records.length === 0) {
      return Response.json({ 
        valid: false, 
        reason: 'Record not found' 
      });
    }

    const record = records[0];

    // Validate record belongs to user's business
    if (record.business_id !== user.business_id) {
      console.error(`[validateBusinessOwnership] CROSS-BUSINESS ATTEMPT: User ${user.email} (business ${user.business_id}) tried ${operation} on ${entity_name} ${record_id} (business ${record.business_id})`);
      return Response.json({ 
        valid: false, 
        reason: `Record belongs to different business` 
      });
    }

    return Response.json({ 
      valid: true, 
      record_id,
      entity_name,
      operation
    });
    
  } catch (error) {
    console.error('[validateBusinessOwnership]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});