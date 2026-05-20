import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'No user authenticated' }, { status: 401 });
    }

    // Get the User entity directly from DB
    const userEntity = await base44.asServiceRole.entities.User.filter({ email: user.email });

    return Response.json({
      authMeResult: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        business_id: user.business_id,
      },
      userEntityResult: userEntity.length > 0 ? {
        id: userEntity[0].id,
        email: userEntity[0].email,
        full_name: userEntity[0].full_name,
        role: userEntity[0].role,
        business_id: userEntity[0].business_id,
      } : null,
      match: userEntity.length > 0 && userEntity[0].role === user.role,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});