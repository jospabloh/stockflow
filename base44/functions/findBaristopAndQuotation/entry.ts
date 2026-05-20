import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar todos los negocios
    const allBusinesses = await base44.asServiceRole.entities.Business.list();
    const baristop = allBusinesses.find(b => b.name && b.name.toLowerCase().includes('baristop'));

    if (!baristop) {
      return Response.json({
        error: 'Baristop business not found',
        businesses: allBusinesses.map(b => ({ id: b.id, name: b.name }))
      }, { status: 404 });
    }

    // Buscar todas las cotizaciones de Baristop
    const allQuotations = await base44.asServiceRole.entities.Quotation.list();
    const baristopQuotations = allQuotations.filter(q => q.business_id === baristop.id);

    // Filtrar Roseta Fico
    const rosetaQuotations = baristopQuotations.filter(q => 
      q.client_name && q.client_name.toLowerCase().includes('roseta')
    );

    return Response.json({
      success: true,
      baristop: { id: baristop.id, name: baristop.name },
      totalQuotations: baristopQuotations.length,
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