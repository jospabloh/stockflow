import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }

    console.log(`[UPGRADE] Current user: ${user.email}, role: ${user.role}`);

    // Try to upgrade using auth.updateMe
    try {
      await base44.auth.updateMe({ role: "admin" });
      console.log(`[UPGRADE] Attempted upgrade via auth.updateMe`);
    } catch (e) {
      console.log(`[UPGRADE] auth.updateMe failed: ${(e as Error).message}`);
    }

    // Verify current state
    const verify = await base44.auth.me();
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
});