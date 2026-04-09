import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Safe Movement creation with business_id validation
 * Rejects if:
 * 1. business_id is missing
 * 2. business_id doesn't match user's business_id
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { product_id, product_name, type, quantity, unit_price, cost_price, total, reason, reference, stock_after, quotation_id, business_id, paid } = body;

    // VALIDATION: business_id required
    if (!business_id) {
      return Response.json({ 
        success: false, 
        error: 'business_id is required' 
      }, { status: 400 });
    }

    // VALIDATION: business_id must match user's business
    if (business_id !== user.business_id) {
      return Response.json({ 
        success: false, 
        error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` 
      }, { status: 403 });
    }

    // All validations passed — use asServiceRole for resilient write
    const movement = await base44.asServiceRole.entities.Movement.create({
      product_id,
      product_name,
      type,
      quantity,
      unit_price,
      cost_price: cost_price ?? null,
      total,
      reason,
      reference,
      stock_after,
      quotation_id,
      business_id,
      paid: paid ?? false
    });

    return Response.json({ 
      success: true, 
      movement_id: movement.id,
      movement
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});