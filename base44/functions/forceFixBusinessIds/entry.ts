import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log(`[FORCE FIX] Starting...`);

    // Get all businesses first
    const businesses = await base44.asServiceRole.entities.Business.list();
    console.log(`[FORCE FIX] Found ${businesses.length} businesses`);

    // Map of created_by email -> business_id
    const emailToBusiness = {};
    for (const biz of businesses) {
      // Get users for this business
      const bizUsers = await base44.asServiceRole.entities.User.filter({ business_id: biz.id });
      for (const u of bizUsers) {
        emailToBusiness[u.email] = biz.id;
        console.log(`[FORCE FIX] Email ${u.email} -> Business ${biz.id}`);
      }
    }

    const results = {};

    // Fix Categories
    const allCats = await base44.asServiceRole.entities.Category.list();
    let catFixed = 0;
    for (const cat of allCats) {
      if (!cat.business_id && emailToBusiness[cat.created_by]) {
        await base44.asServiceRole.entities.Category.update(cat.id, { business_id: emailToBusiness[cat.created_by] });
        console.log(`[FORCE FIX] Category ${cat.id} fixed`);
        catFixed++;
      }
    }
    results.categories = catFixed;

    // Fix Clients
    const allClients = await base44.asServiceRole.entities.Client.list();
    let clientFixed = 0;
    for (const client of allClients) {
      if (!client.business_id && emailToBusiness[client.created_by]) {
        await base44.asServiceRole.entities.Client.update(client.id, { business_id: emailToBusiness[client.created_by] });
        console.log(`[FORCE FIX] Client ${client.id} fixed`);
        clientFixed++;
      }
    }
    results.clients = clientFixed;

    return Response.json({
      success: true,
      email_to_business_map: emailToBusiness,
      results
    });

  } catch (error) {
    console.error('[FORCE FIX ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});