import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get Roseta's user record
    const users = await base44.asServiceRole.entities.User.filter({ email: 'roseta.cafeteria@gmail.com' });
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    
    // Create clean data object without _app_role
    const cleanData = {
      role: 'admin',
      business_id: '69c575fa1beaf2c90214d3ee',
      is_service: false,
      app_id: '69af971d0fdb362c9ae52ed3',
      is_verified: true
    };

    // Update with clean data
    await base44.asServiceRole.entities.User.update(user.id, { data: cleanData });

    // Verify
    const updated = await base44.asServiceRole.entities.User.filter({ email: 'roseta.cafeteria@gmail.com' });
    
    return Response.json({
      success: true,
      before_app_role: user.data?._app_role,
      after_app_role: updated[0]?.data?._app_role,
      user_role: updated[0]?.role,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});