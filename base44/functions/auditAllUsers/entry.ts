import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Audit all users
    const allUsers = await base44.asServiceRole.entities.User.list();
    console.log(`[AUDIT] Total users: ${allUsers.length}`);

    const users = allUsers.map(u => ({
      email: u.email,
      full_name: u.full_name,
      business_id: u.business_id,
      role: u.role
    }));

    users.forEach(u => {
      console.log(`${u.email} -> business: ${u.business_id}, role: ${u.role}`);
    });

    // Audit all businesses
    const allBusinesses = await base44.asServiceRole.entities.Business.list();
    const businesses = allBusinesses.map(b => ({
      name: b.name,
      id: b.id,
      invite_code: b.invite_code,
      invite_code_active: b.invite_code_active
    }));

    console.log(`[AUDIT] Total businesses: ${allBusinesses.length}`);
    businesses.forEach(b => {
      console.log(`${b.name} (${b.id}): code=${b.invite_code}, active=${b.invite_code_active}`);
    });

    return Response.json({ users, businesses });
  } catch (error) {
    console.error('[ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});