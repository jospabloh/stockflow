import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Entity automation: runs on Product create events
 * Validates that business_id matches user's business_id
 * If validation fails, rejects the operation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
    const { event, data } = payload;

    // This runs AFTER create, but we can still validate
    // For now, just log if there's a mismatch (proof of concept)
    // In a real scenario, we'd need to rollback on validation failure

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (data?.business_id && data.business_id !== user.business_id) {
      // VALIDATION FAILED: business_id mismatch
      // Try to delete the record that was just created
      try {
        await base44.entities.Product.delete(data.id);
        return Response.json({ 
          action: 'rejected',
          reason: 'business_id mismatch - record deleted',
          user_business: user.business_id,
          provided_business: data.business_id
        });
      } catch (deleteErr) {
        return Response.json({ 
          action: 'rejected_but_cleanup_failed',
          reason: 'business_id mismatch',
          cleanup_error: deleteErr.message
        }, { status: 500 });
      }
    }

    return Response.json({ action: 'allowed' });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});