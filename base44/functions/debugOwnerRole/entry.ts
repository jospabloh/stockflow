import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`[DEBUG-ROLE] User object full:`, JSON.stringify(user, null, 2));
    console.log(`[DEBUG-ROLE] user.role: "${user.role}" (type: ${typeof user.role})`);
    console.log(`[DEBUG-ROLE] user.role === "admin": ${user.role === "admin"}`);
    console.log(`[DEBUG-ROLE] user.data:`, JSON.stringify(user.data || {}, null, 2));

    // Try to list users (as service role to see all)
    const allUsers = await base44.asServiceRole.entities.User.list();
    const thisUser = allUsers.find(u => u.email === user.email);
    console.log(`[DEBUG-ROLE] User from list:`, JSON.stringify(thisUser, null, 2));

    return Response.json({
      user_from_me: user,
      user_from_list: thisUser,
      role_match: user.role === "admin"
    });

  } catch (error) {
    console.error('[DEBUG-ROLE ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});