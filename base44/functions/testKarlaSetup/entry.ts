import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized - cannot test without user context' }, { status: 401 });
    }

    console.log(`[KARLA-TEST] Current user: ${user.email}, business_id: ${user.business_id}`);

    const results = {};

    // Check if user has a business_id set
    if (!user.business_id) {
      console.log(`[KARLA-TEST] User has no business_id - in setup mode`);
      results.setup_status = 'requires_setup';
      results.can_create_business = 'testing';

      // Test if we can create a Business
      try {
        const newBiz = await base44.entities.Business.create({
          name: `Test Business for ${user.email}`,
          rfc: 'ABC123456XYZ'
        });
        console.log(`[KARLA-TEST] ✅ Business CREATE SUCCESS: ${newBiz.id}`);
        results.can_create_business = 'YES';
        results.created_business_id = newBiz.id;

        // Now update user with business_id
        await base44.auth.updateMe({ business_id: newBiz.id });
        console.log(`[KARLA-TEST] ✅ User updated with business_id: ${newBiz.id}`);

        // Verify update
        const updatedUser = await base44.auth.me();
        console.log(`[KARLA-TEST] User after update: business_id = ${updatedUser.business_id}`);
        results.user_updated = updatedUser.business_id === newBiz.id;

      } catch (e) {
        console.log(`[KARLA-TEST] ❌ Business CREATE FAILED: ${e.message}`);
        results.can_create_business = 'NO';
        results.error = e.message;
      }
    } else {
      console.log(`[KARLA-TEST] User already has business_id: ${user.business_id}`);
      results.setup_status = 'already_setup';
      results.user_business_id = user.business_id;

      // Get the business
      try {
        const biz = await base44.entities.Business.get(user.business_id);
        results.business_name = biz.name;
        results.business_exists = true;
      } catch (e) {
        console.log(`[KARLA-TEST] ❌ Could not fetch business: ${e.message}`);
        results.business_exists = false;
        results.error = e.message;
      }
    }

    return Response.json(results);

  } catch (error) {
    console.log(`[KARLA-TEST] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});