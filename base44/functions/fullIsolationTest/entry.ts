import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`[FULL TEST] Starting for ${user.email} (business: ${user.business_id})`);

    // Test 1: Load AppSettings for own business
    const mySettings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
    console.log(`[FULL TEST] Own business AppSettings: ${mySettings.length}`);

    // Test 2: Load Categories for own business
    const myCategories = await base44.entities.Category.filter({ business_id: user.business_id });
    console.log(`[FULL TEST] Own business Categories: ${myCategories.length}`);

    // Test 3: Load Products for own business
    const myProducts = await base44.entities.Product.filter({ business_id: user.business_id });
    console.log(`[FULL TEST] Own business Products: ${myProducts.length}`);

    // Test 4: Try to list all AppSettings (should return only own business due to RLS)
    const allSettings = await base44.entities.AppSettings.list();
    console.log(`[FULL TEST] AppSettings.list() returned: ${allSettings.length}`);
    
    const settingsFromOtherBusiness = allSettings.filter(s => s.business_id !== user.business_id);
    console.log(`[FULL TEST] Settings from other businesses: ${settingsFromOtherBusiness.length}`);

    // Test 5: Try to list all Categories (should return only own business due to RLS)
    const allCategories = await base44.entities.Category.list();
    console.log(`[FULL TEST] Category.list() returned: ${allCategories.length}`);

    const categoriesFromOtherBusiness = allCategories.filter(c => c.business_id !== user.business_id);
    console.log(`[FULL TEST] Categories from other businesses: ${categoriesFromOtherBusiness.length}`);

    // Test 6: Try to list Products (should return only own business due to RLS)
    const allProducts = await base44.entities.Product.list();
    console.log(`[FULL TEST] Product.list() returned: ${allProducts.length}`);

    const productsFromOtherBusiness = allProducts.filter(p => p.business_id !== user.business_id);
    console.log(`[FULL TEST] Products from other businesses: ${productsFromOtherBusiness.length}`);

    const hasLeakage = settingsFromOtherBusiness.length > 0 || 
                       categoriesFromOtherBusiness.length > 0 || 
                       productsFromOtherBusiness.length > 0;

    return Response.json({
      success: true,
      user: {
        email: user.email,
        business_id: user.business_id,
        role: user.role
      },
      results: {
        own_business: {
          settings_count: mySettings.length,
          categories_count: myCategories.length,
          products_count: myProducts.length
        },
        list_operations: {
          settings_list_total: allSettings.length,
          categories_list_total: allCategories.length,
          products_list_total: allProducts.length
        },
        leakage_check: {
          settings_from_other: settingsFromOtherBusiness.length,
          categories_from_other: categoriesFromOtherBusiness.length,
          products_from_other: productsFromOtherBusiness.length,
          has_leakage: hasLeakage
        }
      },
      status: !hasLeakage ? "✓ PASSED — RLS is working correctly" : "✗ FAILED — Cross-business leakage detected"
    });

  } catch (error) {
    console.error('[FULL TEST ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});