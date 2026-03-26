import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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
    return Response.json({ error: error.message }, { status: 500 });
  }
});