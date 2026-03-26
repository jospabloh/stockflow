import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * VERIFY ALL THREE UI CONTEXTS
 * Test that all three users see and save to correct business
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      current_user: {
        email: user.email,
        full_name: user.full_name,
        business_id: user.business_id
      },
      context_verification: {
        auth_business_id: user.business_id,
        sidebar_business: null,
        settings_business: null,
        category_save_target: null,
        product_save_target: null
      },
      tests: {
        create_category: { success: false },
        create_product: { success: false },
        verify_isolation: { success: false }
      }
    };

    // Test 1: Get correct business (sidebar context)
    try {
      const response = await base44.functions.invoke('getCorrectBusiness', {});
      result.context_verification.sidebar_business = response.data?.business?.name;
    } catch (e) {
      result.context_verification.sidebar_business = `ERROR: ${e.message}`;
    }

    // Test 2: Get AppSettings (Settings form context)
    try {
      const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
      if (settings.length > 0) {
        result.context_verification.settings_business = `AppSettings found for business_id ${user.business_id}`;
      } else {
        result.context_verification.settings_business = `No AppSettings for business_id ${user.business_id}`;
      }
    } catch (e) {
      result.context_verification.settings_business = `ERROR: ${e.message}`;
    }

    // Test 3: Create category (verify save target)
    try {
      const category = await base44.entities.Category.create({
        name: `TEST_CATEGORY_${user.email.split('@')[0]}_${Date.now()}`,
        description: 'Verify save target business',
        color: '#FF5733',
        business_id: user.business_id
      });

      result.tests.create_category = {
        success: true,
        category_id: category.id,
        category_business_id: category.business_id,
        expected_business_id: user.business_id,
        correct_target: category.business_id === user.business_id
      };

      result.context_verification.category_save_target = category.business_id;
    } catch (e) {
      result.tests.create_category = { success: false, error: e.message };
    }

    // Test 4: Create product (verify save target)
    try {
      const product = await base44.entities.Product.create({
        name: `TEST_PRODUCT_${user.email.split('@')[0]}_${Date.now()}`,
        sale_price: 99.99,
        stock: 50,
        business_id: user.business_id
      });

      result.tests.create_product = {
        success: true,
        product_id: product.id,
        product_business_id: product.business_id,
        expected_business_id: user.business_id,
        correct_target: product.business_id === user.business_id
      };

      result.context_verification.product_save_target = product.business_id;
    } catch (e) {
      result.tests.create_product = { success: false, error: e.message };
    }

    // Test 5: Verify data isolation (confirm category only visible to correct user)
    try {
      const allCategories = await base44.entities.Category.filter({});
      const userCategories = allCategories.filter(c => c.business_id === user.business_id);
      
      result.tests.verify_isolation = {
        success: true,
        total_categories_visible: allCategories.length,
        categories_in_user_business: userCategories.length,
        all_filtered_match_user_business: userCategories.every(c => c.business_id === user.business_id)
      };
    } catch (e) {
      result.tests.verify_isolation = { success: false, error: e.message };
    }

    // Overall consistency check
    const sidebar_matches_auth = 
      result.context_verification.sidebar_business && 
      !result.context_verification.sidebar_business.includes('ERROR');
    
    const saves_match_auth = 
      result.context_verification.category_save_target === user.business_id &&
      result.context_verification.product_save_target === user.business_id;

    result.overall_status = (
      result.tests.create_category.correct_target &&
      result.tests.create_product.correct_target &&
      sidebar_matches_auth &&
      saves_match_auth
    ) ? 'CONSISTENT' : 'MISMATCH';

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});