import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Enforces that create operations include user's business_id.
 * This is a guard that should be called BEFORE attempting any entity.create()
 */
async function enforceBusinessIdCreate(entity_name, payload, user) {
  if (!payload.business_id) {
    throw new Error(`Create ${entity_name}: business_id is required`);
  }
  
  if (payload.business_id !== user.business_id) {
    throw new Error(`Create ${entity_name}: Unauthorized. business_id mismatch (user: ${user.business_id}, provided: ${payload.business_id})`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test: create Product with mismatched business_id but with prior enforcement
    const testPayload = {
      name: 'Test Product',
      sale_price: 100,
      business_id: 'wrong-business-id'
    };

    try {
      await enforceBusinessIdCreate('Product', testPayload, user);
      return Response.json({ rejected: false, error: 'Enforcement failed' });
    } catch (enforcementErr) {
      return Response.json({ 
        rejected: true, 
        enforcement_error: enforcementErr.message,
        explanation: 'Business ID enforcement worked - create would be blocked'
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});