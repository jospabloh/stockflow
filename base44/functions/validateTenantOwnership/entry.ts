import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * DEFENSIVE TENANT OWNERSHIP VALIDATION
 * 
 * Since platform RLS does not enforce delete/update restrictions,
 * this function provides a secondary validation layer.
 * 
 * All delete/update operations for business-scoped entities MUST:
 * 1. Verify the record belongs to the current user's business
 * 2. Reject the operation if business_id doesn't match
 * 3. Return detailed error information
 * 
 * Usage in other functions:
 *   const isOwner = await base44.functions.invoke('validateTenantOwnership', {
 *     entity_name: 'Client',
 *     record_id: clientId,
 *   });
 *   if (!isOwner.owner) {
 *     throw new Error("Not authorized");
 *   }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized', owner: false }, { status: 401 });
    }

    const body = await req.json();
    const { entity_name, record_id } = body;

    if (!entity_name || !record_id) {
      return Response.json({ 
        error: 'Missing entity_name or record_id', 
        owner: false 
      }, { status: 400 });
    }

    // Fetch the record using service role to bypass RLS
    let record;
    try {
      const records = await base44.asServiceRole.entities[entity_name].filter({ id: record_id });
      record = records[0] || null;
    } catch (e) {
      return Response.json({ 
        error: `Entity not found: ${entity_name}`, 
        owner: false 
      }, { status: 404 });
    }

    if (!record) {
      return Response.json({ 
        error: 'Record not found', 
        owner: false,
        record_id,
        entity_name
      }, { status: 404 });
    }

    // Check if record belongs to user's business
    const isOwner = record.business_id === user.business_id;

    const response = {
      owner: isOwner,
      record_id,
      entity_name,
      user_business_id: user.business_id,
      record_business_id: record.business_id,
      user_email: user.email,
    };

    if (!isOwner) {
      response.error = `SECURITY: Record belongs to business ${record.business_id}, user is in business ${user.business_id}`;
      return Response.json(response, { status: 403 });
    }

    return Response.json(response);

  } catch (error) {
    return Response.json({ 
      error: (error as Error).message, 
      owner: false 
    }, { status: 500 });
  }
});