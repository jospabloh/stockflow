import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Baristop business ID
    const businessId = user.business_id;

    // Buscar la cotización COT-200406-0002
    const quotations = await base44.entities.Quotation.filter({
      folio: 'COT-200406-0002',
      business_id: businessId
    });

    if (quotations.length === 0) {
      return Response.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const quotation = quotations[0];

    // Valores correctos según screenshot
    const correctSubtotal = 251.67;
    const correctTax = 40.27;
    const correctTotal = 291.94;

    // Actualizar la cotización con los totales correctos
    await base44.entities.Quotation.update(quotation.id, {
      subtotal: correctSubtotal,
      tax: correctTax,
      total: correctTotal
    });

    // Buscar los movimientos de salida asociados a esta cotización en la fecha 06/04/26
    const movements = await base44.entities.Movement.filter({
      quotation_id: quotation.id,
      business_id: businessId,
      type: 'exit'
    });

    // Actualizar movimientos si existen
    if (movements.length > 0) {
      for (const movement of movements) {
        // Recalcular el total del movimiento basado en el nuevo precio
        const newTotal = movement.quantity * movement.unit_price;
        await base44.entities.Movement.update(movement.id, {
          total: newTotal
        });
      }
    }

    return Response.json({
      success: true,
      message: 'Quotation COT-200406-0002 fixed',
      quotation: {
        id: quotation.id,
        folio: quotation.folio,
        subtotal: correctSubtotal,
        tax: correctTax,
        total: correctTotal
      },
      movementsUpdated: movements.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});