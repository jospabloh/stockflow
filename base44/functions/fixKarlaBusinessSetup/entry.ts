import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get current state
    const currentBusinessId = user.business_id;
    console.log(`[KARLA AUDIT] Email: ${user.email}`);
    console.log(`[KARLA AUDIT] Current business_id: ${currentBusinessId}`);
    console.log(`[KARLA AUDIT] Current role: ${user.role}`);

    // Try to find the business to join (Baristop)
    const baristopList = await base44.asServiceRole.entities.Business.filter({ name: "Baristop Distribuidora" });
    if (baristopList.length === 0) {
      return Response.json({ error: 'Baristop business not found' }, { status: 404 });
    }

    const baristop = baristopList[0];
    console.log(`[KARLA AUDIT] Baristop invite code: ${baristop.invite_code}`);
    console.log(`[KARLA AUDIT] Baristop invite active: ${baristop.invite_code_active}`);
    console.log(`[KARLA AUDIT] Baristop status: ${baristop.status}`);

    // If Karla has no business, or is in wrong business, or stuck with wrong role
    if (!currentBusinessId || currentBusinessId !== baristop.id) {
      console.log(`[KARLA FIX] Attempting to link Karla to Baristop...`);
      
      // Validate business is ready
      if (baristop.status !== "active") {
        return Response.json({ error: 'Baristop business is not active' }, { status: 400 });
      }

      if (!baristop.invite_code_active) {
        return Response.json({ error: 'Baristop invite code is inactive' }, { status: 400 });
      }

      // Update user
      await base44.auth.updateMe({ 
        business_id: baristop.id,
        role: "almacenista"
      });

      console.log(`[KARLA FIX] Karla linked to Baristop`);

      // Verify
      const verify = await base44.auth.me();
      return Response.json({
        success: true,
        action: "linked_to_baristop",
        previous_business_id: currentBusinessId,
        new_business_id: verify.business_id,
        business_name: baristop.name,
        role: verify.role
      });
    }

    return Response.json({
      success: true,
      action: "already_linked",
      business_id: baristop.id,
      business_name: baristop.name,
      role: user.role
    });

  } catch (error) {
    console.error('[KARLA ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});