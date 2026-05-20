import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const businessId = user.business_id;

    // Buscar la cotización COT-200406-0002 directamente
    const allQuotations = await base44.asServiceRole.entities.Quotation.list();
    const quotation = allQuotations.find(q => 
      q.folio === 'COT-200406-0002' && q.business_id === businessId
    );

    if (!quotation) {
      return Response.json({ 
        error: 'Quotation not found',
        folioSearched: 'COT-200406-0002',
        businessId: businessId,
        totalQuotationsInDB: allQuotations.length
      }, { status: 404 });
    }

    // Valores correctos según screenshot
    const correctSubtotal = 251.67;
    const correctTax = 40.27;
    const correctTotal = 291.94;

    // Actualizar la cotización con los totales correctos
    const updated = await base44.asServiceRole.entities.Quotation.update(quotation.id, {
      subtotal: correctSubtotal,
      tax: correctTax,
      total: correctTotal
    });

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
      }
    });

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});