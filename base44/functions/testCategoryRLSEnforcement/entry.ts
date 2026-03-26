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
      test_create: {
        status: 'pending',
        id: null,
        error: null
      },
      test_read: {
        status: 'pending',
        found: false,
        error: null
      }
    };

    // TEST 1: CREATE a new category
    try {
      const newCat = await base44.entities.Category.create({
        name: `TEST_CAT_RLS_${Date.now()}`,
        description: 'Testing RLS enforcement',
        business_id: user.business_id
      });
      result.test_create.status = 'SUCCESS';
      result.test_create.id = newCat.id;
      console.log(`[TEST-CAT-RLS] ✓ Created category: ${newCat.id}`);
    } catch (e) {
      result.test_create.status = 'FAILED';
      result.test_create.error = e.message;
      console.log(`[TEST-CAT-RLS] ✗ CREATE failed: ${e.message}`);
    }

    // TEST 2: READ the created category by id
    if (result.test_create.id) {
      try {
        const cats = await base44.entities.Category.filter({ id: result.test_create.id });
        if (cats.length > 0) {
          result.test_read.status = 'SUCCESS';
          result.test_read.found = true;
          result.test_read.category_data = {
            id: cats[0].id,
            name: cats[0].name,
            business_id: cats[0].business_id
          };
          console.log(`[TEST-CAT-RLS] ✓ Read back category: ${cats[0].business_id}`);
        } else {
          result.test_read.status = 'FAILED';
          result.test_read.found = false;
          result.test_read.error = 'Category not found by filter';
        }
      } catch (e) {
        result.test_read.status = 'FAILED';
        result.test_read.error = e.message;
        console.log(`[TEST-CAT-RLS] ✗ READ failed: ${e.message}`);
      }
    }

    // TEST 3: Check isolation - count categories from OTHER businesses
    try {
      const allCats = await base44.entities.Category.list();
      const otherBusinessCats = allCats.filter(c => c.business_id !== user.business_id);
      result.test_isolation = {
        total_visible: allCats.length,
        from_user_business: allCats.filter(c => c.business_id === user.business_id).length,
        from_other_businesses: otherBusinessCats.length,
        leaked_categories: otherBusinessCats.map(c => ({
          id: c.id,
          name: c.name,
          business_id: c.business_id
        }))
      };
      
      if (otherBusinessCats.length > 0) {
        console.log(`[TEST-CAT-RLS] ✗ ISOLATION BROKEN: ${otherBusinessCats.length} categories from other businesses are visible!`);
      } else {
        console.log(`[TEST-CAT-RLS] ✓ ISOLATION OK: Only categories from user's business are visible`);
      }
    } catch (e) {
      result.test_isolation = { error: e.message };
    }

    return Response.json(result);

  } catch (error) {
    console.log(`[TEST-CAT-RLS] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});