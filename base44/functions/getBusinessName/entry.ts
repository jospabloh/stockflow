import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { business_id } = await req.json();

    if (!business_id) {
      return Response.json({ error: 'business_id required' }, { status: 400 });
    }

    // CRITICAL: tenant isolation. A user may only look up the name of their OWN
    // business. Without this check, passing another tenant's business_id would
    // leak that business's name across tenants (the asServiceRole filter below
    // bypasses RLS, so the request must be authorized here).
    if (business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use asServiceRole to bypass RLS restrictions.
    // Access is already constrained to the caller's own business by the check
    // above; this allows users to see their own business name even if they don't
    // "own" the Business record.
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    
    if (businesses.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Business not found' 
      }, { status: 404 });
    }

    const business = businesses.find(b => b.id === business_id);
    
    if (!business) {
      return Response.json({ 
        success: false, 
        error: 'Business ID mismatch' 
      }, { status: 404 });
    }

    return Response.json({ 
      success: true, 
      business_name: business.name,
      business_id: business.id
    });
    
  } catch (error) {
    console.error('[getBusinessName] Error:', (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});