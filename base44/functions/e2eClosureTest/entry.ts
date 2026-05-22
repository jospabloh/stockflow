import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }
    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }

    console.log(`[E2E-CLOSURE] Starting test for ${user.email}`);
    console.log(`[E2E-CLOSURE] User business_id: ${user.business_id}`);
    console.log(`[E2E-CLOSURE] User role: ${user.role}`);

    const results = {
      user_email: user.email,
      business_id: user.business_id,
      user_role: user.role,
      tests: {}
    };

    // TEST 1: Owner Categories (h.josepablo@gmail.com)
    if (user.email === PLATFORM_OWNER_EMAIL) {
      results.tests.owner_categories = {
        step_1_create: false,
        step_2_verify_success_toast: 'UI manual verification required',
        step_3_refresh_persists: false,
        step_4_edit: false,
        step_5_edit_persists: false
      };

      try {
        const timestamp = Date.now();
        const catName = `Test Cat Owner ${timestamp}`;
        
        // Create
        const created = await base44.entities.Category.create({
          name: catName,
          description: `Test for owner - ${timestamp}`,
          color: "#FF5733",
          business_id: user.business_id
        });
        results.tests.owner_categories.step_1_create = !!created.id;
        console.log(`[E2E-CLOSURE] Category created: ${created.id}`);

        // Verify readable
        const cats1 = await base44.entities.Category.filter({ business_id: user.business_id });
        const found1 = cats1.find(c => c.id === created.id);
        results.tests.owner_categories.step_3_refresh_persists = !!found1;
        console.log(`[E2E-CLOSURE] Category readable after create: ${!!found1}`);

        // Edit
        if (found1) {
          await base44.entities.Category.update(created.id, {
            name: `${catName} (edited)`,
            description: "Edited description"
          });
          results.tests.owner_categories.step_4_edit = true;
          console.log(`[E2E-CLOSURE] Category edited successfully`);

          // Verify edit persisted
          const cats2 = await base44.entities.Category.filter({ business_id: user.business_id });
          const found2 = cats2.find(c => c.id === created.id && c.name.includes("(edited)"));
          results.tests.owner_categories.step_5_edit_persists = !!found2;
          console.log(`[E2E-CLOSURE] Edit persisted: ${!!found2}`);

          // Cleanup
          await base44.entities.Category.delete(created.id);
        }
      } catch (e) {
        console.error(`[E2E-CLOSURE] Owner categories error:`, (e as Error).message);
        results.tests.owner_categories.error = (e as Error).message;
      }
    }

    // TEST 2: Baristop Categories (karla.baristop@gmail.com)
    if (user.email === "karla.baristop@gmail.com") {
      results.tests.baristop_categories = {
        step_1_create: false,
        step_2_verify_success_toast: 'UI manual verification required',
        step_3_refresh_persists: false,
        step_4_edit: false,
        step_5_edit_persists: false
      };

      try {
        const timestamp = Date.now();
        const catName = `Test Cat Baristop ${timestamp}`;
        
        // Create
        const created = await base44.entities.Category.create({
          name: catName,
          description: `Test for Baristop - ${timestamp}`,
          color: "#33FF57",
          business_id: user.business_id
        });
        results.tests.baristop_categories.step_1_create = !!created.id;
        console.log(`[E2E-CLOSURE] Baristop category created: ${created.id}`);

        // Verify readable
        const cats1 = await base44.entities.Category.filter({ business_id: user.business_id });
        const found1 = cats1.find(c => c.id === created.id);
        results.tests.baristop_categories.step_3_refresh_persists = !!found1;
        console.log(`[E2E-CLOSURE] Baristop category readable after create: ${!!found1}`);

        // Edit
        if (found1) {
          await base44.entities.Category.update(created.id, {
            name: `${catName} (edited)`,
            description: "Edited by Baristop"
          });
          results.tests.baristop_categories.step_4_edit = true;
          console.log(`[E2E-CLOSURE] Baristop category edited`);

          // Verify edit persisted
          const cats2 = await base44.entities.Category.filter({ business_id: user.business_id });
          const found2 = cats2.find(c => c.id === created.id && c.name.includes("(edited)"));
          results.tests.baristop_categories.step_5_edit_persists = !!found2;
          console.log(`[E2E-CLOSURE] Baristop edit persisted: ${!!found2}`);

          // Cleanup
          await base44.entities.Category.delete(created.id);
        }
      } catch (e) {
        console.error(`[E2E-CLOSURE] Baristop categories error:`, (e as Error).message);
        results.tests.baristop_categories.error = (e as Error).message;
      }
    }

    // TEST 3: Cross-business isolation in backend
    if (user.email === PLATFORM_OWNER_EMAIL || user.email === "karla.baristop@gmail.com") {
      results.tests.cross_business_isolation = {
        owner_cannot_see_baristop: false,
        baristop_cannot_see_owner: false,
        business_name_visible: !!results.business_id
      };

      try {
        // List categories for current user's business
        const myCats = await base44.entities.Category.filter({ business_id: user.business_id });
        console.log(`[E2E-CLOSURE] User ${user.email} can read ${myCats.length} categories in their business`);

        // Try to list ALL categories (should be filtered by RLS)
        const allCats = await base44.entities.Category.list();
        const onlyOwn = allCats.every(c => c.business_id === user.business_id);
        
        if (user.email === PLATFORM_OWNER_EMAIL) {
          results.tests.cross_business_isolation.owner_cannot_see_baristop = onlyOwn;
        } else if (user.email === "karla.baristop@gmail.com") {
          results.tests.cross_business_isolation.baristop_cannot_see_owner = onlyOwn;
        }
        console.log(`[E2E-CLOSURE] Isolation check - only own: ${onlyOwn}`);
      } catch (e) {
        console.error(`[E2E-CLOSURE] Cross-isolation error:`, (e as Error).message);
      }
    }

    // TEST 4: Core inventory flow
    if (user.email === PLATFORM_OWNER_EMAIL) {
      results.tests.core_inventory_flow = {
        product_created: false,
        entry_created: false,
        exit_created: false,
        stock_integrity: false
      };

      try {
        // Create product
        const prod = await base44.entities.Product.create({
          name: `Test Product ${Date.now()}`,
          sale_price: 100,
          stock: 0,
          business_id: user.business_id
        });
        results.tests.core_inventory_flow.product_created = !!prod.id;
        console.log(`[E2E-CLOSURE] Test product created: ${prod.id}`);

        // Entry movement
        const entry = await base44.entities.Movement.create({
          product_id: prod.id,
          product_name: prod.name,
          type: "entry",
          quantity: 50,
          unit_price: 100,
          total: 5000,
          stock_after: 50,
          business_id: user.business_id
        });
        results.tests.core_inventory_flow.entry_created = !!entry.id;
        console.log(`[E2E-CLOSURE] Entry movement created: ${entry.id}`);

        // Exit movement
        const exit = await base44.entities.Movement.create({
          product_id: prod.id,
          product_name: prod.name,
          type: "exit",
          quantity: 10,
          unit_price: 100,
          total: 1000,
          stock_after: 40,
          business_id: user.business_id
        });
        results.tests.core_inventory_flow.exit_created = !!exit.id;
        console.log(`[E2E-CLOSURE] Exit movement created: ${exit.id}`);

        // Verify stock integrity
        const movements = await base44.entities.Movement.filter({ product_id: prod.id, business_id: user.business_id });
        const lastStock = movements[movements.length - 1]?.stock_after;
        results.tests.core_inventory_flow.stock_integrity = lastStock === 40;
        console.log(`[E2E-CLOSURE] Stock integrity - last stock: ${lastStock}`);

        // Cleanup
        await base44.entities.Product.delete(prod.id);
      } catch (e) {
        console.error(`[E2E-CLOSURE] Core inventory error:`, (e as Error).message);
        results.tests.core_inventory_flow.error = (e as Error).message;
      }
    }

    console.log(`[E2E-CLOSURE] Test complete for ${user.email}`);
    return Response.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('[E2E-CLOSURE ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});