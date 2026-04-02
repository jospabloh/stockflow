import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;
    const movements = await base44.entities.Movement.filter({ business_id: businessId }, '-created_date', 100);
    const quotations = await base44.entities.Quotation.filter({ business_id: businessId }, '-created_date', 100);

    // Today in user's timezone
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const todayMovements = movements.filter(m => {
      const d = new Date(m.created_date);
      return d >= todayStart && d <= todayEnd;
    });

    const todayQuotations = quotations.filter(q => {
      const d = new Date(q.created_date);
      return d >= todayStart && d <= todayEnd;
    });

    const exits = todayMovements.filter(m => m.type === 'exit');
    const directExits = exits.filter(m => !m.quotation_id);
    const convertedQuots = todayQuotations.filter(q => q.status === 'converted');

    return Response.json({
      total_movements: movements.length,
      total_quotations: quotations.length,
      today: {
        movements: todayMovements.length,
        quotations: todayQuotations.length,
        exits: exits.length,
        direct_exits: directExits.length,
        converted_quotations: convertedQuots.length,
        direct_exits_details: directExits.map(m => ({
          id: m.id,
          quantity: m.quantity,
          unit_price: m.unit_price,
          total: m.total,
          paid: m.paid,
          reason: m.reason
        })),
        converted_quotations_details: convertedQuots.map(q => ({
          id: q.id,
          total: q.total,
          paid: q.paid,
          client_name: q.client_name
        }))
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});