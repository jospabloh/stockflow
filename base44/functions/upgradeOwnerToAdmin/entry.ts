import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.email !== "h.josepablo@gmail.com") {
      return Response.json({ error: 'Only owner can run this' }, { status: 403 });
    }

    console.log(`[UPGRADE] Current user: ${user.email}, role: ${user.role}`);

    // Try to upgrade using auth.updateMe
    try {
      await base44.auth.updateMe({ role: "admin" });
      console.log(`[UPGRADE] Attempted upgrade via auth.updateMe`);
    } catch (e) {
      console.log(`[UPGRADE] auth.updateMe failed: ${e.message}`);
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});