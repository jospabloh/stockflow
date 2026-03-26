import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * This simulates exactly what BusinessContext does on mount:
 * 1. Call base44.auth.me() to get user
 * 2. Get user.business_id
 * 3. Lookup business name by business_id
 * 4. Return what the UI would display
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // STEP 1: Get current user (this is what AuthContext does)
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        error: 'Unauthorized',
        step: 'auth.me()',
        result: 'user is null'
      }, { status: 401 });
    }

    console.log(`[SIM-UI] Step 1 - Got user: ${user.email}`);
    console.log(`[SIM-UI] Step 2 - User.business_id: ${user.business_id}`);

    const result = {
      user_email: user.email,
      user_full_name: user.full_name,
      user_role: user.role,
      user_business_id: user.business_id,
      business_name_loaded: null,
      business_rfc: null,
      error: null
    };

    // STEP 2: Load business name (this is what BusinessContext.loadUser() does)
    if (user.business_id) {
      try {
        console.log(`[SIM-UI] Step 3 - Filtering Business by id: ${user.business_id}`);
        const businesses = await base44.entities.Business.filter({ id: user.business_id });
        
        if (businesses.length === 0) {
          console.log(`[SIM-UI] ✗ Business NOT FOUND`);
          result.error = `Business ID ${user.business_id} not found in database`;
        } else {
          const biz = businesses[0];
          console.log(`[SIM-UI] ✓ Business found: ${biz.name}`);
          result.business_name_loaded = biz.name;
          result.business_rfc = biz.rfc;
        }
      } catch (e) {
        console.log(`[SIM-UI] ✗ Error loading business: ${e.message}`);
        result.error = e.message;
      }
    } else {
      console.log(`[SIM-UI] ✗ User has NO business_id`);
      result.error = 'User has no business_id assigned';
    }

    // STEP 3: What would the UI show?
    result.ui_sidebar_business_name = result.business_name_loaded || "(No business)";
    
    console.log(`[SIM-UI] FINAL - UI would show: "${result.ui_sidebar_business_name}"`);

    return Response.json(result);

  } catch (error) {
    console.log(`[SIM-UI] FATAL ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});