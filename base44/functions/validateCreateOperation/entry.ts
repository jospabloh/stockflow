import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SERVER-SIDE VALIDATION FOR CREATE OPERATIONS
 * 
 * CRITICAL: All create operations MUST validate that:
 * 1. User has a business_id
 * 2. business_id in payload matches user's business_id
 * 3. Record type is valid
 * 
 * This prevents malicious or accidental cross-tenant creates.
 * 
 * Usage in backend functions:
 *   const validation = await base44.functions.invoke('validateCreateOperation', {
 *     entity_name: 'Client',
 *     payload: { name: 'Foo', business_id: 'xyz' }
 *   });
 *   if (!validation.valid) {
 *     throw new Error(validation.reason);
 *   }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        valid: false, 
        reason: 'User not authenticated'
      }, { status: 401 });
    }

    const body = await req.json();
    const { entity_name, payload } = body;

    if (!entity_name || !payload) {
      return Response.json({ 
        valid: false,
        reason: 'Missing entity_name or payload'
      }, { status: 400 });
    }

    // Business-scoped entities that MUST be validated
    const scopedEntities = [
      'Client', 'Product', 'Quotation', 'Movement',
      'Supplier', 'Category', 'AppSettings', 'PettyCashMovement'
    ];

    // If entity is not in scoped list, it doesn't require business validation
    if (!scopedEntities.includes(entity_name)) {
      return Response.json({ 
        valid: true,
        note: `${entity_name} is not business-scoped`
      });
    }

    const result = {
      valid: false,
      entity_name,
      user_email: user.email,
      user_business_id: user.business_id,
      payload_business_id: payload.business_id,
      checks: {
        user_has_business_id: !!user.business_id,
        payload_has_business_id: !!payload.business_id,
        business_ids_match: user.business_id === payload.business_id,
      },
      reason: null
    };

    // CHECK 1: User must have business_id
    if (!user.business_id) {
      result.reason = 'User is not assigned to a business (orphaned)';
      return Response.json(result, { status: 403 });
    }

    // CHECK 2: Payload must include business_id
    if (!payload.business_id) {
      result.reason = 'Payload is missing business_id field';
      return Response.json(result, { status: 400 });
    }

    // CHECK 3: Payload business_id must match user's business_id
    if (payload.business_id !== user.business_id) {
      result.reason = `Payload business_id (${payload.business_id}) does not match user's business_id (${user.business_id})`;
      return Response.json(result, { status: 403 });
    }

    // All checks passed
    result.valid = true;
    result.reason = 'Validation passed - user can create this record';
    return Response.json(result);

  } catch (error) {
    return Response.json({ 
      valid: false,
      reason: (error as Error).message
    }, { status: 500 });
  }
});