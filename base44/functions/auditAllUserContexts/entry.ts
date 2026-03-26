import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[AUDIT-ALL-USERS] Auditing from user: ${currentUser.email}`);

    const results = {
      current_user: {
        email: currentUser.email,
        full_name: currentUser.full_name,
        business_id: currentUser.business_id,
        role: currentUser.role
      },
      all_users: [],
      all_businesses: []
    };

    // Get all users (only works if current user is admin)
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      console.log(`[AUDIT-ALL-USERS] Found ${allUsers.length} users`);
      
      results.all_users = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        business_id: u.business_id,
        role: u.role
      }));
    } catch (e) {
      console.log(`[AUDIT-ALL-USERS] Could not list all users: ${e.message}`);
      results.error_users = e.message;
    }

    // Get all businesses (service role)
    try {
      const allBiz = await base44.asServiceRole.entities.Business.list();
      console.log(`[AUDIT-ALL-USERS] Found ${allBiz.length} businesses`);
      
      results.all_businesses = allBiz.map(b => ({
        id: b.id,
        name: b.name,
        rfc: b.rfc
      }));
    } catch (e) {
      console.log(`[AUDIT-ALL-USERS] Could not list all businesses: ${e.message}`);
      results.error_businesses = e.message;
    }

    // Get all products (service role) 
    try {
      const allProducts = await base44.asServiceRole.entities.Product.list();
      const productsByBusiness = {};
      allProducts.forEach(p => {
        if (!productsByBusiness[p.business_id]) {
          productsByBusiness[p.business_id] = 0;
        }
        productsByBusiness[p.business_id]++;
      });
      results.products_by_business = productsByBusiness;
    } catch (e) {
      console.log(`[AUDIT-ALL-USERS] Could not list all products: ${e.message}`);
    }

    return Response.json(results);

  } catch (error) {
    console.log(`[AUDIT-ALL-USERS] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});