import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * DIAGNOSE ROSETA CONTEXT MISMATCH
 * Check what business_id is actually set for Roseta
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const result = {
      diagnostic_check: {},
      root_cause: null,
      action_needed: null
    };

    // Step 1: Get all users and their business assignments
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      result.diagnostic_check.all_users = allUsers.map(u => ({
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        business_id: u.business_id
      }));
    } catch (e) {
      return Response.json({ error: `Failed to list users: ${(e as Error).message}` }, { status: 500 });
    }

    // Step 2: Get all businesses
    try {
      const allBusinesses = await base44.asServiceRole.entities.Business.list();
      result.diagnostic_check.all_businesses = allBusinesses.map(b => ({
        id: b.id,
        name: b.name
      }));
    } catch (e) {
      return Response.json({ error: `Failed to list businesses: ${(e as Error).message}` }, { status: 500 });
    }

    // Step 3: Identify the issue
    const rosetaUser = result.diagnostic_check.all_users.find(u => u.email === 'roseta.cafeteria@gmail.com');
    const karlaUser = result.diagnostic_check.all_users.find(u => u.email === 'karla.baristop@gmail.com');
    const baristopBusiness = result.diagnostic_check.all_businesses.find(b => b.name === 'Baristop Distribuidora');
    const acaciaBusiness = result.diagnostic_check.all_businesses.find(b => b.name === 'ACACIA OWNER SANDBOX');

    result.diagnostic_check.roseta = rosetaUser;
    result.diagnostic_check.karla = karlaUser;
    result.diagnostic_check.baristop_id = baristopBusiness?.id;
    result.diagnostic_check.acacia_id = acaciaBusiness?.id;

    // Step 4: Identify mismatches
    if (rosetaUser && rosetaUser.business_id !== baristopBusiness?.id) {
      result.root_cause = `Roseta business_id is "${rosetaUser.business_id}", but should be Baristop ID "${baristopBusiness?.id}"`;
      result.action_needed = 'Fix Roseta business_id assignment';
    }

    if (karlaUser && karlaUser.business_id !== baristopBusiness?.id) {
      result.root_cause = `Karla business_id is "${karlaUser.business_id}", but should be Baristop ID "${baristopBusiness?.id}"`;
      result.action_needed = 'Fix Karla business_id assignment';
    }

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});