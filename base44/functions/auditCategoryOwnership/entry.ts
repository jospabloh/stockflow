import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      user_email: user.email,
      user_business_id: user.business_id,
      categories_visible_count: 0,
      categories_data: [],
      categories_business_ids: [],
      isolation_status: 'unknown'
    };

    // Get all categories visible to user
    try {
      const categories = await base44.entities.Category.list();
      result.categories_visible_count = categories.length;
      result.categories_data = categories.map(c => ({
        id: c.id,
        name: c.name,
        business_id: c.business_id
      }));

      // Check which business_ids are represented
      const uniqueBusinessIds = [...new Set(categories.map(c => c.business_id))];
      result.categories_business_ids = uniqueBusinessIds;

      // Verify isolation
      if (uniqueBusinessIds.length === 1 && uniqueBusinessIds[0] === user.business_id) {
        result.isolation_status = 'CORRECT - all categories belong to user\'s business';
      } else if (uniqueBusinessIds.length === 1) {
        result.isolation_status = 'WRONG - categories belong to different business';
      } else {
        result.isolation_status = 'CRITICAL - categories from multiple businesses!';
      }

    } catch (e) {
      result.error = e.message;
    }

    return Response.json(result);

  } catch (error) {
    console.log(`[AUDIT-CATS] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});