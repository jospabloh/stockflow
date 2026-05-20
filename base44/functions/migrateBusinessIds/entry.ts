import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log(`[MIGRATE] Starting migration for admin ${user.email}`);

    const results = {};

    // Migrate Categories
    console.log(`[MIGRATE] Fixing Categories...`);
    const allCategories = await base44.asServiceRole.entities.Category.list();
    let catFixed = 0;
    for (const cat of allCategories) {
      if (!cat.business_id) {
        // Get the user who created it
        const creator = await base44.asServiceRole.entities.User.filter({ email: cat.created_by });
        if (creator.length > 0 && creator[0].business_id) {
          await base44.asServiceRole.entities.Category.update(cat.id, { business_id: creator[0].business_id });
          console.log(`[MIGRATE] Category ${cat.id} → business ${creator[0].business_id}`);
          catFixed++;
        }
      }
    }
    results.categories = { total: allCategories.length, fixed: catFixed };

    // Migrate Suppliers
    console.log(`[MIGRATE] Fixing Suppliers...`);
    const allSuppliers = await base44.asServiceRole.entities.Supplier.list();
    let suppFixed = 0;
    for (const supp of allSuppliers) {
      if (!supp.business_id) {
        const creator = await base44.asServiceRole.entities.User.filter({ email: supp.created_by });
        if (creator.length > 0 && creator[0].business_id) {
          await base44.asServiceRole.entities.Supplier.update(supp.id, { business_id: creator[0].business_id });
          console.log(`[MIGRATE] Supplier ${supp.id} → business ${creator[0].business_id}`);
          suppFixed++;
        }
      }
    }
    results.suppliers = { total: allSuppliers.length, fixed: suppFixed };

    // Migrate Clients
    console.log(`[MIGRATE] Fixing Clients...`);
    const allClients = await base44.asServiceRole.entities.Client.list();
    let clientFixed = 0;
    for (const client of allClients) {
      if (!client.business_id) {
        const creator = await base44.asServiceRole.entities.User.filter({ email: client.created_by });
        if (creator.length > 0 && creator[0].business_id) {
          await base44.asServiceRole.entities.Client.update(client.id, { business_id: creator[0].business_id });
          console.log(`[MIGRATE] Client ${client.id} → business ${creator[0].business_id}`);
          clientFixed++;
        }
      }
    }
    results.clients = { total: allClients.length, fixed: clientFixed };

    // Migrate Products
    console.log(`[MIGRATE] Fixing Products...`);
    const allProducts = await base44.asServiceRole.entities.Product.list();
    let prodFixed = 0;
    for (const prod of allProducts) {
      if (!prod.business_id) {
        const creator = await base44.asServiceRole.entities.User.filter({ email: prod.created_by });
        if (creator.length > 0 && creator[0].business_id) {
          await base44.asServiceRole.entities.Product.update(prod.id, { business_id: creator[0].business_id });
          console.log(`[MIGRATE] Product ${prod.id} → business ${creator[0].business_id}`);
          prodFixed++;
        }
      }
    }
    results.products = { total: allProducts.length, fixed: prodFixed };

    // Migrate Movements
    console.log(`[MIGRATE] Fixing Movements...`);
    const allMovements = await base44.asServiceRole.entities.Movement.list();
    let movFixed = 0;
    for (const mov of allMovements) {
      if (!mov.business_id) {
        const creator = await base44.asServiceRole.entities.User.filter({ email: mov.created_by });
        if (creator.length > 0 && creator[0].business_id) {
          await base44.asServiceRole.entities.Movement.update(mov.id, { business_id: creator[0].business_id });
          console.log(`[MIGRATE] Movement ${mov.id} → business ${creator[0].business_id}`);
          movFixed++;
        }
      }
    }
    results.movements = { total: allMovements.length, fixed: movFixed };

    // Migrate Quotations
    console.log(`[MIGRATE] Fixing Quotations...`);
    const allQuotations = await base44.asServiceRole.entities.Quotation.list();
    let quotFixed = 0;
    for (const quot of allQuotations) {
      if (!quot.business_id) {
        const creator = await base44.asServiceRole.entities.User.filter({ email: quot.created_by });
        if (creator.length > 0 && creator[0].business_id) {
          await base44.asServiceRole.entities.Quotation.update(quot.id, { business_id: creator[0].business_id });
          console.log(`[MIGRATE] Quotation ${quot.id} → business ${creator[0].business_id}`);
          quotFixed++;
        }
      }
    }
    results.quotations = { total: allQuotations.length, fixed: quotFixed };

    // Migrate PettyCashMovements
    console.log(`[MIGRATE] Fixing PettyCashMovements...`);
    const allPettyCash = await base44.asServiceRole.entities.PettyCashMovement.list();
    let pettyFixed = 0;
    for (const pc of allPettyCash) {
      if (!pc.business_id) {
        const creator = await base44.asServiceRole.entities.User.filter({ email: pc.created_by });
        if (creator.length > 0 && creator[0].business_id) {
          await base44.asServiceRole.entities.PettyCashMovement.update(pc.id, { business_id: creator[0].business_id });
          console.log(`[MIGRATE] PettyCash ${pc.id} → business ${creator[0].business_id}`);
          pettyFixed++;
        }
      }
    }
    results.pettyCash = { total: allPettyCash.length, fixed: pettyFixed };

    return Response.json({
      success: true,
      message: 'Migration complete',
      results
    });

  } catch (error) {
    console.error('[MIGRATE ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});