import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * APPLY CORRECT BUSINESS ASSIGNMENTS
 * Authoritative mapping:
 * - karla.baristop@gmail.com → Baristop Distribuidora
 * - roseta.cafeteria@gmail.com → Baristop Distribuidora
 * - h.josepablo@gmail.com → ACACIA OWNER SANDBOX
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = {
      timestamp: new Date().toISOString(),
      assignments: [],
      errors: []
    };

    const mappings = [
      { email: 'karla.baristop@gmail.com', business_name: 'Baristop Distribuidora' },
      { email: 'roseta.cafeteria@gmail.com', business_name: 'Baristop Distribuidora' },
      { email: 'h.josepablo@gmail.com', business_name: 'ACACIA OWNER SANDBOX' }
    ];

    for (const mapping of mappings) {
      try {
        // Find user
        const users = await base44.asServiceRole.entities.User.filter({ email: mapping.email });
        if (users.length === 0) {
          result.errors.push(`User not found: ${mapping.email}`);
          continue;
        }
        const targetUser = users[0];

        // Find business
        const businesses = await base44.asServiceRole.entities.Business.filter({ name: mapping.business_name });
        if (businesses.length === 0) {
          result.errors.push(`Business not found: ${mapping.business_name}`);
          continue;
        }
        const targetBusiness = businesses[0];

        // Apply assignment
        const before = targetUser.business_id;
        await base44.asServiceRole.entities.User.update(targetUser.id, { business_id: targetBusiness.id });

        result.assignments.push({
          email: mapping.email,
          business_name: mapping.business_name,
          business_id: targetBusiness.id,
          before,
          after: targetBusiness.id,
          status: 'applied'
        });

        console.log(`✓ ${mapping.email} → ${mapping.business_name} (${targetBusiness.id})`);
      } catch (e) {
        result.errors.push(`Error processing ${mapping.email}: ${(e as Error).message}`);
      }
    }

    result.success = result.errors.length === 0;
    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});