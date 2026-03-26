import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * INSPECT BUSINESS RECORDS
 * Admin-only: directly inspect what's in the Business table
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = {
      current_user: {
        email: user.email,
        business_id: user.business_id
      },
      all_businesses: [],
      baristop_record: null,
      acacia_record: null
    };

    try {
      // Get all businesses (admin)
      const businesses = await base44.asServiceRole.entities.Business.list();
      result.all_businesses = businesses.map(b => ({
        id: b.id,
        name: b.name,
        status: b.status
      }));

      // Find specific ones
      const baristop = businesses.find(b => b.name === 'Baristop Distribuidora');
      const acacia = businesses.find(b => b.name === 'ACACIA OWNER SANDBOX');

      if (baristop) {
        result.baristop_record = { id: baristop.id, name: baristop.name };
      }
      if (acacia) {
        result.acacia_record = { id: acacia.id, name: acacia.name };
      }
    } catch (e) {
      result.error = e.message;
    }

    // Now test: can Karla read her own business via filter?
    const testResults = {
      karla_read_baristop: null,
      karla_read_acacia: null
    };

    try {
      if (result.baristop_record) {
        const filtered = await base44.entities.Business.filter({ id: result.baristop_record.id });
        testResults.karla_read_baristop = {
          requested_id: result.baristop_record.id,
          results: filtered.length,
          name: filtered[0]?.name
        };
      }
    } catch (e) {
      testResults.karla_read_baristop = { error: e.message };
    }

    try {
      if (result.acacia_record) {
        const filtered = await base44.entities.Business.filter({ id: result.acacia_record.id });
        testResults.karla_read_acacia = {
          requested_id: result.acacia_record.id,
          results: filtered.length,
          should_be_empty: 'YES',
          actual: filtered.length > 0 ? 'VIOLATION' : 'BLOCKED'
        };
      }
    } catch (e) {
      testResults.karla_read_acacia = { error: e.message };
    }

    result.test_results = testResults;

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});