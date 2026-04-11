import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== DEBUG Business.filter() ===');
    console.log('User business_id:', user.business_id);
    console.log('Searching with filter:', { id: user.business_id });

    // Try the exact query
    const result = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    console.log('Filter result count:', result.length);
    console.log('Filter result:', result);

    // Try getting ALL businesses to compare
    const allBusinesses = await base44.asServiceRole.entities.Business.list();
    console.log('All businesses count:', allBusinesses.length);
    console.log('All businesses:', allBusinesses.map(b => ({ id: b.id, name: b.name })));

    return Response.json({
      debug: 'filter_query_test',
      user_business_id: user.business_id,
      filter_query: { id: user.business_id },
      filter_result: {
        count: result.length,
        businesses: result.map(b => ({ id: b.id, name: b.name })),
      },
      all_businesses: allBusinesses.map(b => ({ id: b.id, name: b.name })),
    });
  } catch (error) {
    console.error('debugBusinessFilter error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});