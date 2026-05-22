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

    // Get all users and businesses as service role (no auth needed)
    const users = await base44.asServiceRole.entities.User.list();
    const businesses = await base44.asServiceRole.entities.Business.list();

    const owner = users.find(u => u.email === "h.josepablo@gmail.com");
    const sandbox = businesses.find(b => b.name === "ACACIA OWNER SANDBOX");
    const baristop = businesses.find(b => b.name === "Baristop Distribuidora");

    if (!owner || !sandbox || !baristop) {
      return Response.json({ 
        error: 'Required entities not found',
        owner: !!owner,
        sandbox: !!sandbox,
        baristop: !!baristop
      }, { status: 404 });
    }

    // Find Karla  
    const karla = users.find(u => u.email && u.email.includes("karla"));

    console.log(`[FORCE] Owner (${owner.email}): current business=${owner.business_id}`);
    console.log(`[FORCE] Sandbox: ${sandbox.id}`);
    console.log(`[FORCE] Baristop: ${baristop.id}`);
    console.log(`[FORCE] Karla: ${karla?.email || 'NOT FOUND'}, business=${karla?.business_id || 'NONE'}`);

    // Step 1: Link owner to sandbox (role cannot be changed for app owner)
    await base44.asServiceRole.entities.User.update(owner.id, {
      business_id: sandbox.id
    });
    console.log(`[FORCE] Owner => Sandbox`);

    // Step 2: If Karla exists and is in wrong business, link to Baristop
    if (karla && karla.business_id !== baristop.id) {
      await base44.asServiceRole.entities.User.update(karla.id, {
        business_id: baristop.id,
        role: "almacenista"
      });
      console.log(`[FORCE] Karla => Baristop (almacenista)`);
    } else if (karla) {
      console.log(`[FORCE] Karla already in Baristop`);
    }

    // Verify
    const verifyOwner = await base44.asServiceRole.entities.User.filter({ id: owner.id });
    const verifyKarla = karla ? await base44.asServiceRole.entities.User.filter({ id: karla.id }) : null;

    return Response.json({
      success: true,
      owner: verifyOwner[0] ? {
        email: verifyOwner[0].email,
        business_id: verifyOwner[0].business_id,
        role: verifyOwner[0].role
      } : null,
      karla: verifyKarla && verifyKarla[0] ? {
        email: verifyKarla[0].email,
        business_id: verifyKarla[0].business_id,
        role: verifyKarla[0].role
      } : null
    });

  } catch (error) {
    console.error('[ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});