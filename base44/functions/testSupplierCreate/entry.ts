import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    console.log(`[TEST-SUP] User: ${user.email}, Role: ${user.role}, Business: ${user.business_id}`);

    // Try to create a supplier
    const sup = await base44.entities.Supplier.create({
      name: `Test Supplier ${Date.now()}`,
      business_id: user.business_id
    });

    console.log(`[TEST-SUP] Supplier created: ${sup.id}`);
    return Response.json({ success: true, supplier_id: sup.id });

  } catch (error) {
    console.error('[TEST-SUP ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});