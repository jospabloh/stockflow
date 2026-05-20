import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[INSPECT] User: ${user.email}, business_id: ${user.business_id}`);

    const results = {};

    // Inspect existing Product
    try {
      const products = await base44.entities.Product.list();
      console.log(`[INSPECT] Found ${products.length} products`);
      if (products.length > 0) {
        const p = products[0];
        console.log(`[INSPECT] First product keys:`, Object.keys(p));
        console.log(`[INSPECT] First product has 'business_id'?:`, 'business_id' in p);
        console.log(`[INSPECT] First product has 'data.business_id'?:`, 'data.business_id' in p);
        console.log(`[INSPECT] First product sample:`, JSON.stringify(p, null, 2).slice(0, 500));
        results.Product = {
          count: products.length,
          sample: {
            id: p.id,
            name: p.name,
            business_id: p.business_id,
            keys: Object.keys(p)
          }
        };
      }
    } catch (e) {
      console.log(`[INSPECT] Product list error:`, (e as Error).message);
      results.Product = { error: (e as Error).message };
    }

    // Inspect existing Category
    try {
      const cats = await base44.entities.Category.list();
      console.log(`[INSPECT] Found ${cats.length} categories`);
      if (cats.length > 0) {
        const c = cats[0];
        console.log(`[INSPECT] First category keys:`, Object.keys(c));
        console.log(`[INSPECT] First category has 'business_id'?:`, 'business_id' in c);
        console.log(`[INSPECT] First category sample:`, JSON.stringify(c, null, 2).slice(0, 500));
        results.Category = {
          count: cats.length,
          sample: {
            id: c.id,
            name: c.name,
            business_id: c.business_id,
            keys: Object.keys(c)
          }
        };
      }
    } catch (e) {
      console.log(`[INSPECT] Category list error:`, (e as Error).message);
      results.Category = { error: (e as Error).message };
    }

    // Inspect existing Client
    try {
      const clients = await base44.entities.Client.list();
      console.log(`[INSPECT] Found ${clients.length} clients`);
      if (clients.length > 0) {
        const cl = clients[0];
        console.log(`[INSPECT] First client keys:`, Object.keys(cl));
        console.log(`[INSPECT] First client has 'business_id'?:`, 'business_id' in cl);
        console.log(`[INSPECT] First client sample:`, JSON.stringify(cl, null, 2).slice(0, 500));
        results.Client = {
          count: clients.length,
          sample: {
            id: cl.id,
            name: cl.name,
            business_id: cl.business_id,
            keys: Object.keys(cl)
          }
        };
      }
    } catch (e) {
      console.log(`[INSPECT] Client list error:`, (e as Error).message);
      results.Client = { error: (e as Error).message };
    }

    return Response.json(results, { status: 200 });

  } catch (error) {
    console.log(`[INSPECT] FATAL: ${(error as Error).message}`);
    return Response.json({ fatal_error: (error as Error).message }, { status: 500 });
  }
});