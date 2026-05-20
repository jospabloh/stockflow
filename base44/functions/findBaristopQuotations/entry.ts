import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;

    // Buscar todas las cotizaciones del negocio Baristop
    const quotations = await base44.entities.Quotation.filter({
      business_id: businessId
    });

    // Filtrar las que contienen "Roseta" en el nombre del cliente
    const rosetaQuotations = quotations.filter(q => 
      q.client_name && q.client_name.toLowerCase().includes('roseta')
    );

    return Response.json({
      success: true,
      total: quotations.length,
      rosetaCount: rosetaQuotations.length,
      rosetaQuotations: rosetaQuotations.map(q => ({
        id: q.id,
        folio: q.folio,
        client_name: q.client_name,
        total: q.total,
        subtotal: q.subtotal,
        tax: q.tax,
        status: q.status,
        created_date: q.created_date
      }))
    });

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});