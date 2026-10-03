import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { getAuthUser } from '../../../shared/authUser.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
    const user = await getAuthUser(base44);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }

    console.log(`[UPGRADE] Current user: ${user.email}, role: ${user.role}`);

    // `role` is locked to admin-only writes via field-level RLS, so a plain
    // user-scoped auth.updateMe() would be rejected (or silently dropped) once
    // the caller isn't already role:admin. Use the service role instead — this
    // endpoint is already gated to PLATFORM_OWNER_EMAIL above.
    try {
      await base44.asServiceRole.entities.User.update(user.id, { role: "admin" });
      console.log(`[UPGRADE] Attempted upgrade via asServiceRole.entities.User.update`);
    } catch (e) {
      console.log(`[UPGRADE] asServiceRole update failed: ${(e as Error).message}`);
    }

    // Verify current state
    const verify = (await getAuthUser(base44)) ?? user;
    return Response.json({
      success: true,
      user: {
        email: verify.email,
        role: verify.role,
        business_id: verify.business_id
      }
    });

  } catch (error) {
    console.error('[ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
