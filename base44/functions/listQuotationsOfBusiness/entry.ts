import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quotations = await base44.entities.Quotation.filter({ 
      business_id: user.business_id 
    }, '-created_date', 50);

    const list = quotations.map(q => ({
      id: q.id,
      folio: q.folio,
      status: q.status,
      client_name: q.client_name,
      total: q.total,
      created_date: q.created_date,
      items_count: q.items?.length || 0
    }));

    return Response.json({
      success: true,
      count: quotations.length,
      quotations: list
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});