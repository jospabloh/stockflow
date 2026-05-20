import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TEST BARISTOP CATEGORY FLOW
 * For Karla or Roseta (both in Baristop):
 * 1. Verify context all_match = true
 * 2. Create a test category
 * 3. Read it back
 * 4. Update it
 * 5. Read it again to verify persistence
 * 6. Delete it
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      user: {
        email: user.email,
        full_name: user.full_name,
        business_id: user.business_id
      },
      context_check: {
        all_match: false,
        mismatches: []
      },
      category_flow: {
        create: null,
        read_after_create: null,
        update: null,
        read_after_update: null,
        delete: null,
        final_check: null
      },
      status: 'pending'
    };

    // 1. Verify context
    try {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
      
      const visibleId = businesses[0]?.id;
      const settingsId = settings[0]?.business_id;
      
      if (user.business_id === visibleId && user.business_id === settingsId) {
        result.context_check.all_match = true;
      } else {
        result.context_check.mismatches.push(`Context mismatch: auth=${user.business_id}, visible=${visibleId}, settings=${settingsId}`);
      }
    } catch (e) {
      result.context_check.mismatches.push(`Context check error: ${(e as Error).message}`);
    }

    if (!result.context_check.all_match) {
      result.status = 'failed';
      return Response.json(result);
    }

    // 2. Create category
    try {
      const testCat = {
        name: `TEST_CATEGORY_${Date.now()}`,
        description: 'Test category for context verification',
        color: '#FF5733',
        business_id: user.business_id
      };
      const created = await base44.entities.Category.create(testCat);
      result.category_flow.create = {
        success: true,
        id: created.id,
        name: created.name
      };
    } catch (e) {
      result.category_flow.create = { success: false, error: (e as Error).message };
      result.status = 'failed';
      return Response.json(result);
    }

    const catId = result.category_flow.create.id;

    // 3. Read after create
    try {
      const cats = await base44.entities.Category.filter({ id: catId });
      if (cats.length > 0) {
        result.category_flow.read_after_create = {
          success: true,
          id: cats[0].id,
          name: cats[0].name,
          color: cats[0].color
        };
      }
    } catch (e) {
      result.category_flow.read_after_create = { success: false, error: (e as Error).message };
    }

    // 4. Update
    try {
      await base44.entities.Category.update(catId, {
        description: 'Updated description',
        color: '#0066FF'
      });
      result.category_flow.update = { success: true };
    } catch (e) {
      result.category_flow.update = { success: false, error: (e as Error).message };
    }

    // 5. Read after update
    try {
      const cats = await base44.entities.Category.filter({ id: catId });
      if (cats.length > 0) {
        result.category_flow.read_after_update = {
          success: true,
          color: cats[0].color,
          description: cats[0].description
        };
      }
    } catch (e) {
      result.category_flow.read_after_update = { success: false, error: (e as Error).message };
    }

    // 6. Delete
    try {
      await base44.entities.Category.delete(catId);
      result.category_flow.delete = { success: true };
    } catch (e) {
      result.category_flow.delete = { success: false, error: (e as Error).message };
    }

    // 7. Final check (should be gone)
    try {
      const cats = await base44.entities.Category.filter({ id: catId });
      result.category_flow.final_check = {
        success: cats.length === 0,
        deleted: cats.length === 0
      };
    } catch (e) {
      result.category_flow.final_check = { success: false, error: (e as Error).message };
    }

    // Determine overall status
    const allSuccess = Object.values(result.category_flow).every(v => v?.success !== false);
    result.status = allSuccess ? 'passed' : 'failed';

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});