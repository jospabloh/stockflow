import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[AUDIT-BIZ-CONTEXT] User: ${user.email}`);
    console.log(`[AUDIT-BIZ-CONTEXT] User.business_id: ${user.business_id}`);

    const results = {
      user_email: user.email,
      user_business_id: user.business_id,
      business_lookup: null,
      error: null
    };

    if (!user.business_id) {
      results.error = 'User has NO business_id set';
      return Response.json(results);
    }

    // Try to fetch the actual business record
    try {
      console.log(`[AUDIT-BIZ-CONTEXT] Fetching business with ID: ${user.business_id}`);
      const businesses = await base44.entities.Business.filter({ 
        id: user.business_id 
      });

      if (businesses.length === 0) {
        console.log(`[AUDIT-BIZ-CONTEXT] ❌ NO BUSINESS FOUND for ID ${user.business_id}`);
        results.error = `Business not found for ID ${user.business_id}`;
      } else {
        const biz = businesses[0];
        console.log(`[AUDIT-BIZ-CONTEXT] ✅ Business found: ${biz.name}`);
        results.business_lookup = {
          id: biz.id,
          name: biz.name,
          rfc: biz.rfc
        };
      }
    } catch (e) {
      console.log(`[AUDIT-BIZ-CONTEXT] ❌ Error fetching business: ${e.message}`);
      results.error = e.message;
    }

    // Also check all businesses for this user to see if there are multiple
    try {
      console.log(`[AUDIT-BIZ-CONTEXT] Fetching ALL businesses...`);
      const allBusinesses = await base44.entities.Business.list();
      console.log(`[AUDIT-BIZ-CONTEXT] Total businesses in system: ${allBusinesses.length}`);
      
      results.all_businesses = allBusinesses.map(b => ({
        id: b.id,
        name: b.name,
        rfc: b.rfc
      }));
    } catch (e) {
      console.log(`[AUDIT-BIZ-CONTEXT] ❌ Error listing all businesses: ${e.message}`);
    }

    return Response.json(results);

  } catch (error) {
    console.log(`[AUDIT-BIZ-CONTEXT] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});