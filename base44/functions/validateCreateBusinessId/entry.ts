import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Middleware-style validation: rechaza create si business_id no coincide con user.business_id
 * Uso: llamar en frontend antes de base44.entities.*.create() 
 * o en backend functions que hagan create
 */
async function validateBusinessIdMatch(business_id, user_business_id) {
  if (!business_id) {
    throw new Error('business_id is required');
  }
  if (business_id !== user_business_id) {
    throw new Error(`Unauthorized: business_id mismatch. User: ${user_business_id}, Provided: ${business_id}`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { business_id } = body;

    await validateBusinessIdMatch(business_id, user.business_id);

    return Response.json({ valid: true });
  } catch (error) {
    return Response.json({ valid: false, error: (error as Error).message }, { status: 400 });
  }
});