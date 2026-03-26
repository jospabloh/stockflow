import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can run this audit
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = {
      current_user: {
        email: user.email,
        full_name: user.full_name,
        business_id: user.business_id
      },
      all_users: []
    };

    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      
      for (const u of allUsers) {
        const userRecord = {
          email: u.email,
          full_name: u.full_name,
          role: u.role,
          business_id: u.business_id,
          business_name: null
        };

        // Try to get the business name
        if (u.business_id) {
          try {
            const businesses = await base44.asServiceRole.entities.Business.filter({ id: u.business_id });
            if (businesses.length > 0) {
              userRecord.business_name = businesses[0].name;
            }
          } catch (e) {
            userRecord.business_name = `[Error: ${e.message}]`;
          }
        }

        result.all_users.push(userRecord);
      }
    } catch (e) {
      result.error = e.message;
    }

    return Response.json(result);

  } catch (error) {
    console.log(`[AUDIT-THREE] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});