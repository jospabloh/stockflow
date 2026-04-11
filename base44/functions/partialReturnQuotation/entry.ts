import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Flujo de devolución parcial:
// 1. Recibe quotation_id y los items devueltos (product_id + quantity)
// 2. Valida ownership
// 3. Crea movimientos de tipo "return" para cada item devuelto
// 4. Actualiza el total de la cotización (quita los items devueltos)
// 5. Incrementa el stock de los productos devueltos

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { quotation_id, returned_items, reason } = body;
    // returned_items: [{ product_id, product_name, quantity, unit_price, tax_rate }]

    if (!quotation_id || !returned_items?.length) {
      return Response.json({ error: 'quotation_id y returned_items son requeridos' }, { status: 400 });
    }
    if (!reason?.trim()) {
      return Response.json({ error: 'Motivo de devolución es requerido' }, { status: 400 });
    }

    // Fetch quotation
    const quotations = await base44.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) return Response.json({ error: 'Cotización no encontrada' }, { status: 404 });
    const quotation = quotations[0];

    if (quotation.business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (quotation.status !== 'converted') return Response.json({ error: 'Solo se pueden hacer devoluciones de ventas concretadas' }, { status: 400 });

    // LICENSE CHECK — returns are allowed even in view_only (they correct existing data)
    // Intentionally not blocking here: returns protect business from stuck stock

    // Validate returned items exist in quotation
    for (const ri of returned_items) {
      const match = (quotation.items || []).find(i => i.product_id === ri.product_id);
      if (!match) return Response.json({ error: `Producto ${ri.product_name} no está en la cotización` }, { status: 400 });
      if (ri.quantity > match.quantity) return Response.json({ error: `Cantidad devuelta mayor a la vendida para ${ri.product_name}` }, { status: 400 });
    }

    // Create return movements and update stock
    for (const ri of returned_items) {
      const prods = await base44.asServiceRole.entities.Product.filter({ id: ri.product_id, business_id: user.business_id });
      if (prods.length === 0) continue;
      const product = prods[0];
      const newStock = (product.stock || 0) + ri.quantity;

      await base44.asServiceRole.entities.Movement.create({
        product_id: ri.product_id,
        product_name: ri.product_name,
        type: 'return',
        quantity: ri.quantity,
        unit_price: ri.unit_price,
        total: ri.quantity * ri.unit_price,
        stock_after: newStock,
        reference: `Devolución ${quotation.folio}`,
        reason: reason.trim(),
        quotation_id: quotation.id,
        business_id: user.business_id,
      });

      await base44.asServiceRole.entities.Product.update(ri.product_id, { stock: newStock });
    }

    // Recalculate quotation totals removing returned items
    const updatedItems = (quotation.items || []).map(item => {
      const returned = returned_items.find(r => r.product_id === item.product_id);
      if (!returned) return item;
      const newQty = item.quantity - returned.quantity;
      return newQty > 0
        ? { ...item, quantity: newQty, total: newQty * item.unit_price }
        : null;
    }).filter(Boolean);

    const newTotal = updatedItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const taxableTotal = updatedItems.reduce((sum, i) => (i.tax_rate > 0 ? sum + (i.total || 0) : sum), 0);
    const newTax = taxableTotal - (taxableTotal / 1.16);
    const newSubtotal = newTotal - newTax;

    await base44.asServiceRole.entities.Quotation.update(quotation.id, {
      items: updatedItems,
      total: newTotal,
      subtotal: newSubtotal,
      tax: newTax,
    });

    return Response.json({ success: true, quotation_id, returned_count: returned_items.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});