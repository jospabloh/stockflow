import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentBusinessId = user.business_id;

    // Fetch the current business record using service role
    let currentBusiness = null;
    if (currentBusinessId) {
      try {
        const businesses = await base44.asServiceRole.entities.Business.filter({
          id: currentBusinessId,
        });
        if (businesses.length > 0) {
          currentBusiness = businesses[0];
        }
      } catch (e) {
        console.log('Could not fetch current business:', (e as Error).message);
      }
    }

    // List all AppSettings to see what's created
    let allSettings = [];
    try {
      allSettings = await base44.asServiceRole.entities.AppSettings.list();
    } catch (e) {
      console.log('Could not list all settings:', (e as Error).message);
    }

    // List all users to understand structure
    let allUsers = [];
    try {
      allUsers = await base44.asServiceRole.entities.User.list();
    } catch (e) {
      console.log('Could not list users:', (e as Error).message);
    }

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        business_id: currentBusinessId,
      },
      currentBusiness,
      appSettingsCount: allSettings.length,
      allSettings: allSettings.map(s => ({
        id: s.id,
        business_id: s.business_id,
        business_name: s.business_name,
      })),
      usersCount: allUsers.length,
      allUsers: allUsers.map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        business_id: u.business_id,
      })),
    });
  } catch (error) {
    console.error('Audit error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});