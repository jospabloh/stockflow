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

    console.log(`[OWNER CATEGORY] Testing category save for ${user.email}`);
    console.log(`[OWNER CATEGORY] Business ID: ${user.business_id}`);

    // Create a category
    const catData = {
      name: `Test Category ${Date.now()}`,
      description: "Test category for owner",
      color: "#FF5733",
      business_id: user.business_id
    };

    const created = await base44.entities.Category.create(catData);
    console.log(`[OWNER CATEGORY] Category created: ${created.id}`);

    // Verify it's readable
    const cats = await base44.entities.Category.filter({ business_id: user.business_id });
    console.log(`[OWNER CATEGORY] Owner can read ${cats.length} categories`);

    // Verify owner's categories are isolated
    const filteredBySelf = cats.find(c => c.id === created.id);
    console.log(`[OWNER CATEGORY] Created category is visible: ${!!filteredBySelf}`);

    return Response.json({
      success: true,
      category_created: created.id,
      owner_business_id: user.business_id,
      readable_categories: cats.length,
      category_is_owned: !!filteredBySelf
    });

  } catch (error) {
    console.error('[OWNER CATEGORY ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});