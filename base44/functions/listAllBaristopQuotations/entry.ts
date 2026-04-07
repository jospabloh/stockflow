import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;

    // Buscar todas las cotizaciones del negocio
    const allQuotations = await base44.asServiceRole.entities.Quotation.list();
    const baristopQuotations = allQuotations.filter(q => q.business_id === businessId);

    // Filtrar las que contienen "Roseta" en el nombre del cliente
    const rosetaQuotations = baristopQuotations.filter(q => 
      q.client_name && q.client_name.toLowerCase().includes('roseta')
    );

    return Response.json({
      success: true,
      total: baristopQuotations.length,
      rosetaQuotations: rosetaQuotations.map(q => ({
        id: q.id,
        folio: q.folio,
        client_name: q.client_name,
        total: q.total,
        subtotal: q.subtotal,
        tax: q.tax,
        status: q.status,
        created_date: q.created_date
      })),
      // Mostrar también las del 04/06 (abril 6 o junio 4 dependiendo del formato)
      quotationsByDate: baristopQuotations
        .filter(q => q.created_date && (q.created_date.includes('2026-04-06') || q.created_date.includes('2026-06-04')))
        .map(q => ({
          id: q.id,
          folio: q.folio,
          client_name: q.client_name,
          total: q.total,
          created_date: q.created_date
        }))
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});