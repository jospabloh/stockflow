import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find h.josepablo by email
    const users = await base44.asServiceRole.entities.User.list();
    const owner = users.find(u => u.email === "h.josepablo@gmail.com");

    if (!owner) {
      return Response.json({ error: 'Owner not found' }, { status: 404 });
    }

    console.log(`[FIX] Owner found: ${owner.email}`);
    console.log(`[FIX] Current business_id: ${owner.business_id}`);
    console.log(`[FIX] Current role: ${owner.role}`);

    // Get sandbox business
    const sandboxList = await base44.asServiceRole.entities.Business.filter({ name: "ACACIA OWNER SANDBOX" });
    const sandbox = sandboxList[0];

    if (!sandbox) {
      return Response.json({ error: 'Sandbox not found' }, { status: 404 });
    }

    console.log(`[FIX] Sandbox: ${sandbox.id}`);

    // Fix owner: business_id = sandbox, role = admin
    await base44.asServiceRole.entities.User.update(owner.id, {
      business_id: sandbox.id,
      role: "admin"
    });

    console.log(`[FIX] Owner restored: business=${sandbox.id}, role=admin`);

    // Verify
    const verify = await base44.asServiceRole.entities.User.filter({ id: owner.id });
    if (verify.length > 0) {
      return Response.json({
        success: true,
        owner: {
          email: verify[0].email,
          business_id: verify[0].business_id,
          role: verify[0].role
        },
        sandbox_id: sandbox.id
      });
    }

  } catch (error) {
    console.error('[ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});