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

    const { 
      source_entity,      // e.g., "Product"
      source_record_id,   // product ID being created/updated
      ref_entity,         // e.g., "Category"
      ref_record_id       // category ID being referenced
    } = await req.json();
    
    if (!source_entity || !source_record_id || !ref_entity || !ref_record_id) {
      return Response.json({ 
        error: 'source_entity, source_record_id, ref_entity, ref_record_id required' 
      }, { status: 400 });
    }

    // Fetch both records using service role
    const sourceRecords = await base44.asServiceRole.entities[source_entity].filter({ id: source_record_id });
    const refRecords = await base44.asServiceRole.entities[ref_entity].filter({ id: ref_record_id });
    
    if (sourceRecords.length === 0) {
      return Response.json({ valid: false, reason: 'Source record not found' });
    }
    
    if (refRecords.length === 0) {
      return Response.json({ valid: false, reason: 'Referenced record not found' });
    }

    const sourceRecord = sourceRecords[0];
    const refRecord = refRecords[0];

    // Validate BOTH records belong to user's business
    if (sourceRecord.business_id !== user.business_id) {
      console.error(`[validateCrossBusinessReference] INVALID SOURCE: ${source_entity} ${source_record_id} belongs to business ${sourceRecord.business_id}, not ${user.business_id}`);
      return Response.json({ valid: false, reason: 'Source record not owned by current business' });
    }

    if (refRecord.business_id !== user.business_id) {
      console.error(`[validateCrossBusinessReference] CROSS-BUSINESS REF: User ${user.email} (business ${user.business_id}) tried to reference ${ref_entity} ${ref_record_id} from business ${refRecord.business_id}`);
      return Response.json({ valid: false, reason: 'Referenced record belongs to different business' });
    }

    return Response.json({ 
      valid: true, 
      source_entity,
      source_record_id,
      ref_entity,
      ref_record_id
    });
    
  } catch (error) {
    console.error('[validateCrossBusinessReference]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});