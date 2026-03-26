import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.email !== "karla.baristop@gmail.com") {
      return Response.json({ error: 'Only Karla can run this' }, { status: 403 });
    }

    console.log(`[KARLA TEST] Starting join flow for ${user.email}`);
    console.log(`[KARLA TEST] Current business_id: ${user.business_id}`);

    // Get Baristop business
    const baristops = await base44.asServiceRole.entities.Business.filter({ name: "Baristop Distribuidora" });
    const baristop = baristops[0];

    if (!baristop) {
      return Response.json({ error: 'Baristop not found' }, { status: 404 });
    }

    console.log(`[KARLA TEST] Baristop invite code: ${baristop.invite_code}`);
    console.log(`[KARLA TEST] Baristop invite active: ${baristop.invite_code_active}`);
    console.log(`[KARLA TEST] Baristop status: ${baristop.status}`);

    // Simulate the join flow: validate + link
    if (!baristop.invite_code_active || baristop.status !== "active") {
      return Response.json({
        success: false,
        error: "Cannot join: business not active or code not active"
      }, { status: 400 });
    }

    // Link Karla to Baristop
    console.log(`[KARLA TEST] Linking Karla to Baristop...`);
    await base44.auth.updateMe({ business_id: baristop.id, role: "almacenista" });

    // Verify
    const verify = await base44.auth.me();
    console.log(`[KARLA TEST] Karla now linked to: ${verify.business_id}`);

    // Check if can load Baristop's settings
    const settings = await base44.entities.AppSettings.filter({ business_id: baristop.id });
    console.log(`[KARLA TEST] Baristop settings found: ${settings.length > 0}`);

    return Response.json({
      success: true,
      karla: {
        email: verify.email,
        business_id: verify.business_id,
        business_name: baristop.name,
        role: verify.role
      },
      business_ready: {
        invite_code: baristop.invite_code,
        invite_active: baristop.invite_code_active,
        status: baristop.status
      },
      settings_accessible: settings.length > 0
    });

  } catch (error) {
    console.error('[KARLA ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});