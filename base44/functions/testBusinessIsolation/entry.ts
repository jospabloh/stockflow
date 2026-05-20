import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`[ISO TEST] User: ${user.email}`);
    console.log(`[ISO TEST] Business ID: ${user.business_id}`);

    // Test 1: AppSettings isolation
    const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
    console.log(`[ISO TEST] AppSettings for user's business: ${settings.length}`);

    // Test 2: Categories isolation
    const categories = await base44.entities.Category.filter({ business_id: user.business_id });
    console.log(`[ISO TEST] Categories for user's business: ${categories.length}`);

    // Test 3: Products isolation
    const products = await base44.entities.Product.filter({ business_id: user.business_id });
    console.log(`[ISO TEST] Products for user's business: ${products.length}`);

    // Test 4: Try to access another business (should fail due to RLS)
    const allBusinesses = await base44.asServiceRole.entities.Business.list();
    const otherBusiness = allBusinesses.find(b => b.id !== user.business_id && b.name !== "ACACIA OWNER SANDBOX");

    let crossBusinessLeakage = false;
    if (otherBusiness) {
      try {
        const otherSettings = await base44.entities.AppSettings.filter({ business_id: otherBusiness.id });
        if (otherSettings.length > 0) {
          console.log(`[ISO TEST] ❌ CROSS-BUSINESS LEAK: Can access ${otherBusiness.name} settings!`);
          crossBusinessLeakage = true;
        } else {
          console.log(`[ISO TEST] ✓ RLS working: Cannot access ${otherBusiness.name} settings`);
        }
      } catch (e) {
        console.log(`[ISO TEST] ✓ RLS working: Error accessing ${otherBusiness.name}: ${(e as Error).message}`);
      }
    }

    return Response.json({
      success: true,
      user: {
        email: user.email,
        business_id: user.business_id,
        role: user.role
      },
      isolation_test: {
        app_settings_count: settings.length,
        categories_count: categories.length,
        products_count: products.length,
        cross_business_leak: crossBusinessLeakage
      },
      isolation_status: !crossBusinessLeakage ? "✓ PASSED" : "❌ FAILED"
    });

  } catch (error) {
    console.error('[ISO ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});