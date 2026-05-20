import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const allCats = await base44.asServiceRole.entities.Category.list();
    
    if (allCats.length > 0) {
      const cat = allCats[0];
      console.log(`[CHECK] Category: ${cat.name}`);
      console.log(`[CHECK] created_by: ${cat.created_by}`);
      console.log(`[CHECK] created_by_id: ${cat.created_by_id}`);
      console.log(`[CHECK] business_id: ${cat.business_id}`);

      // Try to find the user by email
      const users = await base44.asServiceRole.entities.User.filter({ email: cat.created_by });
      console.log(`[CHECK] Found users by email: ${users.length}`);
      if (users.length > 0) {
        console.log(`[CHECK] User business_id: ${users[0].business_id}`);
      }
    }

    return Response.json({ ok: true });

  } catch (error) {
    console.error('[CHECK ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});