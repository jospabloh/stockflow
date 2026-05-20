import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * FINAL CONSISTENCY TEST
 * Simulates each of the three users' complete UI flow:
 * 1. Load BusinessContext (sidebar)
 * 2. Load Settings
 * 3. Create Category (verify save target)
 * 4. Verify category only visible in correct business
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.email;
    const result = {
      user: userEmail,
      business_id: user.business_id,
      test_results: {
        sidebar_load: null,
        settings_load: null,
        category_create: null,
        category_isolation: null
      },
      issues: []
    };

    // Test 1: Sidebar load (BusinessContext simulation)
    try {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      const exactMatch = businesses.find(b => b.id === user.business_id);
      
      if (exactMatch) {
        result.test_results.sidebar_load = {
          success: true,
          business_name: exactMatch.name,
          business_id: exactMatch.id,
          matches_auth: exactMatch.id === user.business_id
        };
      } else {
        result.test_results.sidebar_load = {
          success: false,
          error: `No exact match found. Filter returned: ${businesses.map(b => b.id).join(', ')}`
        };
        result.issues.push('SIDEBAR: Cannot find exact business match');
      }
    } catch (e) {
      result.test_results.sidebar_load = { success: false, error: (e as Error).message };
      result.issues.push(`SIDEBAR: ${(e as Error).message}`);
    }

    // Test 2: Settings load
    try {
      const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
      result.test_results.settings_load = {
        success: true,
        settings_found: settings.length > 0,
        business_id: user.business_id
      };
    } catch (e) {
      result.test_results.settings_load = { success: false, error: (e as Error).message };
      result.issues.push(`SETTINGS: ${(e as Error).message}`);
    }

    // Test 3: Create category
    let categoryId;
    try {
      const category = await base44.entities.Category.create({
        name: `FINAL_TEST_${userEmail.split('@')[0]}_${Date.now()}`,
        description: 'Final consistency test',
        business_id: user.business_id
      });

      result.test_results.category_create = {
        success: true,
        category_id: category.id,
        category_business_id: category.business_id,
        correct_business: category.business_id === user.business_id
      };

      categoryId = category.id;

      if (category.business_id !== user.business_id) {
        result.issues.push(`CATEGORY CREATE: Saved to wrong business! Expected ${user.business_id}, got ${category.business_id}`);
      }
    } catch (e) {
      result.test_results.category_create = { success: false, error: (e as Error).message };
      result.issues.push(`CATEGORY CREATE: ${(e as Error).message}`);
    }

    // Test 4: Verify category isolation
    if (categoryId) {
      try {
        const categories = await base44.entities.Category.filter({});
        const userCategories = categories.filter(c => c.business_id === user.business_id);
        const ourCategory = categories.find(c => c.id === categoryId);

        result.test_results.category_isolation = {
          success: true,
          total_categories_visible: categories.length,
          categories_in_user_business: userCategories.length,
          our_category_found: !!ourCategory,
          our_category_business_id: ourCategory?.business_id,
          isolation_ok: ourCategory?.business_id === user.business_id
        };

        if (ourCategory?.business_id !== user.business_id) {
          result.issues.push(`CATEGORY ISOLATION: Created category shows different business_id!`);
        }
      } catch (e) {
        result.test_results.category_isolation = { success: false, error: (e as Error).message };
        result.issues.push(`CATEGORY ISOLATION: ${(e as Error).message}`);
      }
    }

    // Overall result
    const allPassed =
      result.test_results.sidebar_load?.success &&
      result.test_results.settings_load?.success &&
      result.test_results.category_create?.success &&
      result.test_results.category_create?.correct_business &&
      result.test_results.category_isolation?.success &&
      result.issues.length === 0;

    result.status = allPassed ? 'PASSED' : 'FAILED';

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});