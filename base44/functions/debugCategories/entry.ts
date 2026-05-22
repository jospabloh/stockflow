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

    console.log(`[DEBUG] User: ${user.email}, business_id: ${user.business_id}`);

    const allCats = await base44.entities.Category.list();
    console.log(`[DEBUG] Total categories returned: ${allCats.length}`);
    
    allCats.forEach((cat, i) => {
      console.log(`[DEBUG] Cat ${i}: id=${cat.id}, name=${cat.name}, business_id=${cat.business_id}`);
    });

    return Response.json({ allCats });

  } catch (error) {
    console.error('[DEBUG ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});