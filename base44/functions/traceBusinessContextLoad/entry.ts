import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TRACE BUSINESS CONTEXT LOAD
 * Simulate what BusinessContext.js does:
 * 1. Get user
 * 2. Extract business_id from user
 * 3. Call Business.filter({ id: business_id })
 * 4. Show what gets returned
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      current_user: {
        email: user.email,
        full_name: user.full_name,
        business_id: user.business_id
      },
      business_context_trace: {}
    };

    // Step 1: Call Business.filter({ id: user.business_id }) — simulating BusinessContext
    try {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      result.business_context_trace.filter_result = businesses;
      
      if (businesses.length === 0) {
        result.business_context_trace.issue = 'Business.filter returned empty array';
      } else {
        const business = businesses[0];
        result.business_context_trace.loaded_business = {
          id: business.id,
          name: business.name
        };
        
        // Check if it matches user business_id
        const matches = business.id === user.business_id;
        result.business_context_trace.id_match = matches;
        if (!matches) {
          result.business_context_trace.issue = `Loaded business ID "${business.id}" does not match user.business_id "${user.business_id}"`;
        }
      }
    } catch (e) {
      result.business_context_trace.filter_error = e.message;
    }

    // Step 2: Try exact match (as per the workaround in BusinessContext)
    try {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      const exactMatch = businesses.find(b => b.id === user.business_id);
      
      if (!exactMatch) {
        result.business_context_trace.exact_match_found = false;
      } else {
        result.business_context_trace.exact_match = {
          id: exactMatch.id,
          name: exactMatch.name
        };
        result.business_context_trace.exact_match_found = true;
      }
    } catch (e) {
      result.business_context_trace.exact_match_error = e.message;
    }

    // Step 3: Get ALL businesses to see if RLS is filtering
    try {
      const allBusinesses = await base44.asServiceRole.entities.Business.list();
      result.business_context_trace.all_businesses_via_service_role = allBusinesses.map(b => ({
        id: b.id,
        name: b.name
      }));
      
      // Find which one should be loaded for this user
      const expected = allBusinesses.find(b => b.id === user.business_id);
      if (expected) {
        result.business_context_trace.expected_business = {
          id: expected.id,
          name: expected.name
        };
      }
    } catch (e) {
      result.business_context_trace.list_error = e.message;
    }

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});