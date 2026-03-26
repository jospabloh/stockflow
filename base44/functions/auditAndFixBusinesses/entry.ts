import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // AUDIT 1: Check current user's business
    console.log(`[AUDIT] User: ${user.full_name} (${user.email})`);
    console.log(`[AUDIT] Current business_id: ${user.business_id}`);

    // AUDIT 2: Fetch all businesses to see what exists
    const allBusinesses = await base44.asServiceRole.entities.Business.list();
    console.log(`[AUDIT] Total businesses in system: ${allBusinesses.length}`);
    allBusinesses.forEach(b => {
      console.log(`  - ${b.name} (id: ${b.id})`);
    });

    // AUDIT 3: Check Baristop (the real client business)
    const baristopList = await base44.asServiceRole.entities.Business.filter({ name: "Baristop Distribuidora" });
    const baristop = baristopList[0];
    if (baristop) {
      console.log(`[AUDIT] Baristop found: ${baristop.id}`);
      console.log(`[AUDIT] Baristop invite code: ${baristop.invite_code}`);
    }

    // ACTION 1: Create sandbox business for owner if not exists
    const ownerSandboxList = await base44.asServiceRole.entities.Business.filter({ name: "ACACIA OWNER SANDBOX" });
    let sandbox = ownerSandboxList[0];

    if (!sandbox) {
      console.log(`[ACTION] Creating ACACIA OWNER SANDBOX...`);
      const code = `OWNER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      sandbox = await base44.asServiceRole.entities.Business.create({
        name: "ACACIA OWNER SANDBOX",
        phone: "",
        address: "",
        invite_code: code,
        invite_code_active: false,
        status: "active",
        tax_rate: 16,
        currency: "MXN"
      });
      console.log(`[ACTION] Sandbox created: ${sandbox.id} with code: ${code}`);
    } else {
      console.log(`[ACTION] Sandbox already exists: ${sandbox.id}`);
    }

    // ACTION 2: Link owner to sandbox
    console.log(`[ACTION] Linking ${user.email} to sandbox...`);
    await base44.auth.updateMe({ business_id: sandbox.id });
    console.log(`[ACTION] Owner linked to sandbox`);

    // ACTION 3: Create AppSettings for sandbox if not exists
    const sandboxSettingsList = await base44.asServiceRole.entities.AppSettings.filter({ business_id: sandbox.id });
    if (sandboxSettingsList.length === 0) {
      console.log(`[ACTION] Creating AppSettings for sandbox...`);
      await base44.asServiceRole.entities.AppSettings.create({
        business_id: sandbox.id,
        business_name: "ACACIA OWNER SANDBOX",
        primary_color: "#4F46E5",
        secondary_color: "#06B6D4",
        tax_rate: 16,
        currency: "MXN"
      });
      console.log(`[ACTION] AppSettings created for sandbox`);
    }

    // VERIFY: Check owner is now isolated
    const verifyUser = await base44.auth.me();
    console.log(`[VERIFY] Owner now linked to business: ${verifyUser.business_id}`);

    return Response.json({
      success: true,
      audit: {
        user: user.email,
        previous_business_id: user.business_id,
        all_businesses: allBusinesses.map(b => ({ name: b.name, id: b.id }))
      },
      actions: {
        sandbox_created: !ownerSandboxList[0],
        sandbox_id: sandbox.id,
        owner_linked: true,
        app_settings_created: sandboxSettingsList.length === 0
      },
      verification: {
        new_business_id: verifyUser.business_id,
        isolated: verifyUser.business_id === sandbox.id
      }
    });
  } catch (error) {
    console.error('[ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});