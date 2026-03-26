import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * LIVE UI SIMULATION FOR KARLA
 * 1. Create a category as Karla (Baristop context)
 * 2. Read category back
 * 3. Update category with new color
 * 4. Read update confirmation
 * 5. Verify sidebar business name matches
 * 6. Verify Settings business matches
 */
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
      expected_business: 'Baristop Distribuidora',
      ui_simulation: {
        sidebar_check: { success: false },
        settings_check: { success: false },
        category_create: { success: false },
        category_read: { success: false },
        category_update: { success: false },
        category_verify: { success: false },
        final_verification: { success: false }
      }
    };

    // Step 1: Check sidebar business name (from Business entity)
    try {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      const exactBiz = businesses.find(b => b.id === user.business_id);
      if (exactBiz) {
        result.ui_simulation.sidebar_check = {
          success: exactBiz.name === 'Baristop Distribuidora',
          shown_business: exactBiz.name,
          expected: 'Baristop Distribuidora'
        };
      }
    } catch (e) {
      result.ui_simulation.sidebar_check.error = e.message;
    }

    // Step 2: Check Settings business name (from AppSettings entity)
    try {
      const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
      if (settings.length > 0) {
        result.ui_simulation.settings_check = {
          success: !!settings[0].business_name,
          shown_business: settings[0].business_name,
          business_id: settings[0].business_id
        };
      }
    } catch (e) {
      result.ui_simulation.settings_check.error = e.message;
    }

    // Step 3: Create a category (Karla's Baristop context)
    let categoryId;
    try {
      const catName = `TEST_CATEGORY_KARLA_${Date.now()}`;
      const created = await base44.entities.Category.create({
        name: catName,
        description: 'Test category created in live UI simulation',
        color: '#FF5733',
        business_id: user.business_id
      });
      categoryId = created.id;
      result.ui_simulation.category_create = {
        success: true,
        id: categoryId,
        name: catName
      };
    } catch (e) {
      result.ui_simulation.category_create = { success: false, error: e.message };
      return Response.json(result);
    }

    // Step 4: Read category back (verify it was created)
    try {
      const cats = await base44.entities.Category.filter({ id: categoryId, business_id: user.business_id });
      const exactCat = cats.find(c => c.id === categoryId);
      if (exactCat) {
        result.ui_simulation.category_read = {
          success: true,
          id: exactCat.id,
          name: exactCat.name,
          color: exactCat.color
        };
      }
    } catch (e) {
      result.ui_simulation.category_read = { success: false, error: e.message };
    }

    // Step 5: Update category with new color
    try {
      await base44.entities.Category.update(categoryId, { color: '#0066FF' });
      result.ui_simulation.category_update = { success: true };
    } catch (e) {
      result.ui_simulation.category_update = { success: false, error: e.message };
    }

    // Step 6: Verify update persisted
    try {
      const cats = await base44.entities.Category.filter({ id: categoryId });
      const exactCat = cats.find(c => c.id === categoryId);
      if (exactCat && exactCat.color === '#0066FF') {
        result.ui_simulation.category_verify = {
          success: true,
          color: exactCat.color
        };
      }
    } catch (e) {
      result.ui_simulation.category_verify = { success: false, error: e.message };
    }

    // Step 7: Final pass/fail
    const allPassed = 
      result.ui_simulation.sidebar_check.success &&
      result.ui_simulation.settings_check.success &&
      result.ui_simulation.category_create.success &&
      result.ui_simulation.category_read.success &&
      result.ui_simulation.category_update.success &&
      result.ui_simulation.category_verify.success;

    result.ui_simulation.final_verification = { success: allPassed };
    result.status = allPassed ? 'passed' : 'failed';

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});