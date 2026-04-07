import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Baristop business ID
    const baristop = { id: '69c575fa1beaf2c90214d3ee', name: 'Baristop Distribuidora' };

    // Find quotation COT-260406-0002
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ business_id: baristop.id });
    const quotation = quotations.find(q => q.folio === 'COT-260406-0002');
    if (!quotation) {
      return Response.json({ error: 'Quotation COT-260406-0002 not found' }, { status: 404 });
    }

    // Get the client to check force_purchase_all_products flag
    const client = await base44.asServiceRole.entities.Client.list().then(cs => cs.find(c => c.id === quotation.client_id));
    const isForcePrice = client?.force_purchase_all_products === true;

    // Get all products to access purchase_price
    const products = await base44.asServiceRole.entities.Product.filter({ business_id: baristop.id });
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    // Recalculate items: price is purchase_price (which includes VAT)
    // Transport is applied to total only, not to unit price
    const recalcedItems = quotation.items.map(item => {
      const product = productMap[item.product_id];
      if (!product) {
        return item;
      }
      const newUnitPrice = product.purchase_price || 0;
      const newTotal = item.quantity * newUnitPrice;
      return { ...item, unit_price: newUnitPrice, total: newTotal };
    });

    // Recalculate totals (VAT extraction from included IVA)
    let subtotal = 0;
    let tax = 0;
    recalcedItems.forEach(item => {
      if (item.tax_rate === 16) {
        // Extract VAT from inclusive price: base = total / 1.16, tax = total - base
        const netBase = Math.round((item.total / 1.16) * 100) / 100;
        const itemTax = Math.round((item.total - netBase) * 100) / 100;
        subtotal += netBase;
        tax += itemTax;
      } else {
        subtotal += item.total;
      }
    });

    // Final rounding with precision
    subtotal = Math.round(subtotal * 100) / 100;
    tax = Math.round(tax * 100) / 100;
    
    // Transport fee: $20 per item only for purchase price clients (force_purchase_all_products = true)
    const transportFee = isForcePrice ? 20 * recalcedItems.length : 0;
    const total = Math.round((subtotal + tax + transportFee) * 100) / 100;

    // Update quotation
    const updated = await base44.asServiceRole.entities.Quotation.update(quotation.id, {
      items: recalcedItems,
      subtotal,
      tax,
      total
    });

    // Get movements from same day to verify consistency
    const movementsAll = await base44.asServiceRole.entities.Movement.filter({ business_id: baristop.id });
    const quotationDate = new Date(quotation.created_date).toISOString().split('T')[0];
    const dayMovements = movementsAll.filter(m => {
      const mDate = new Date(m.created_date).toISOString().split('T')[0];
      return mDate === quotationDate && m.quotation_id === quotation.id;
    });

    return Response.json({
      success: true,
      quotation: updated,
      totals: { subtotal, tax, total },
      dayMovements: dayMovements.length,
      movementsTotalFromQuotation: dayMovements.reduce((sum, m) => sum + (m.total || 0), 0),
      congruent: Math.abs(total - dayMovements.reduce((sum, m) => sum + (m.total || 0), 0)) < 0.01
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});