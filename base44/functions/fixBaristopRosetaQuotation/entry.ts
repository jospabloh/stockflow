import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar Baristop
    const allBusinesses = await base44.asServiceRole.entities.Business.list();
    const baristop = allBusinesses.find(b => b.name && b.name.toLowerCase().includes('baristop'));

    if (!baristop) {
      return Response.json({ error: 'Baristop business not found' }, { status: 404 });
    }

    // Buscar la cotización COT-260406-0002
    const allQuotations = await base44.asServiceRole.entities.Quotation.list();
    const quotation = allQuotations.find(q => 
      q.folio === 'COT-260406-0002' && q.business_id === baristop.id
    );

    if (!quotation) {
      return Response.json({ error: 'Quotation COT-260406-0002 not found' }, { status: 404 });
    }

    // Valores correctos según screenshot
    const correctSubtotal = 251.67;
    const correctTax = 40.27;
    const correctTotal = 291.94;

    // Actualizar la cotización
    await base44.asServiceRole.entities.Quotation.update(quotation.id, {
      subtotal: correctSubtotal,
      tax: correctTax,
      total: correctTotal
    });

    // Buscar movimientos de salida asociados a esta cotización
    const allMovements = await base44.asServiceRole.entities.Movement.list();
    const relatedMovements = allMovements.filter(m => 
      m.quotation_id === quotation.id && m.business_id === baristop.id && m.type === 'exit'
    );

    // Actualizar movimientos si existen
    let movementsUpdated = 0;
    if (relatedMovements.length > 0) {
      for (const movement of relatedMovements) {
        const newTotal = movement.quantity * movement.unit_price;
        await base44.asServiceRole.entities.Movement.update(movement.id, {
          total: newTotal
        });
        movementsUpdated++;
      }
    }

    return Response.json({
      success: true,
      message: 'Quotation fixed successfully',
      quotation: {
        id: quotation.id,
        folio: quotation.folio,
        client: quotation.client_name,
        oldTotal: quotation.total,
        newTotal: correctTotal,
        subtotal: correctSubtotal,
        tax: correctTax
      },
      movementsUpdated: movementsUpdated
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});