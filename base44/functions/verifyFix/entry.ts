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

    // Read as service role
    const allCats = await base44.asServiceRole.entities.Category.list();
    console.log(`[VERIFY] Total categories: ${allCats.length}`);
    
    const result = {};
    for (const cat of allCats) {
      result[cat.id] = {
        name: cat.name,
        business_id: cat.business_id,
        created_by: cat.created_by
      };
      console.log(`[VERIFY] ${cat.name}: business_id=${cat.business_id}`);
    }

    return Response.json({ categories: result });

  } catch (error) {
    console.error('[VERIFY ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});