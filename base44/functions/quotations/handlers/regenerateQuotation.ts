import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Precise VAT calculation - extract VAT from included amounts
 */
function calculateLineVAT(lineTotal, taxRate) {
  if (taxRate !== 16) return { netBase: lineTotal, vat: 0 };
  const netBase = lineTotal / 1.16;
  return { netBase, vat: lineTotal - netBase };
}

/**
 * Calculate totals with reconciliation adjustment on last taxable line
 */
function calculateTotalsWithReconciliation(items) {
  if (!items || items.length === 0) {
    return { subtotal: 0, tax: 0, total: 0 };
  }
  
  const lineBreakdowns = items.map((item, idx) => {
    const { netBase, vat } = calculateLineVAT(item.total || 0, item.tax_rate);
    return { idx, netBase, vat, isTaxable: item.tax_rate === 16 };
  });
  
  let sumNetBase = 0, sumVAT = 0;
  for (const bd of lineBreakdowns) {
    sumNetBase += bd.netBase;
    sumVAT += bd.vat;
  }
  
  const subtotal = sumNetBase;
  const total = subtotal + sumVAT;
  
  const subtotalRounded = Math.round(subtotal * 100) / 100;
  const vatRounded = Math.round(sumVAT * 100) / 100;
  const totalRounded = subtotalRounded + vatRounded;
  
  return { subtotal: subtotalRounded, tax: vatRounded, total: totalRounded };
}

/**
 * Recalcula precios y totales de una cotización en borrador
 * usando el pricing engine actual y catálogos actualizados
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id } = body;

    if (!quotation_id) {
      return Response.json({ error: 'quotation_id is required' }, { status: 400 });
    }

    // Fetch quotation
    const quotations = await base44.entities.Quotation.filter({ id: quotation_id });
    if (quotations.length === 0) {
      return Response.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const quotation = quotations[0];

    // Validate ownership
    if (quotation.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow regeneration of draft quotations
    if (quotation.status !== 'draft') {
      return Response.json({ error: 'Only draft quotations can be regenerated' }, { status: 400 });
    }

    // Fetch client
    const clients = await base44.entities.Client.filter({ id: quotation.client_id });
    const client = clients.length > 0 ? clients[0] : null;

    // Fetch all products and categories for this business
    const [products, categories] = await Promise.all([
      base44.entities.Product.filter({ business_id: user.business_id }),
      base44.entities.Category.filter({ business_id: user.business_id })
    ]);

    // Build maps for quick lookup
    const productMap = {};
    const categoryMap = {};
    for (const p of products) productMap[p.id] = p;
    for (const c of categories) categoryMap[c.id] = c;

    // Compute category qty totals from original items
    const categoryQtyMap = {};
    for (const item of quotation.items) {
      const product = productMap[item.product_id];
      const catId = product?.category || '__none__';
      categoryQtyMap[catId] = (categoryQtyMap[catId] || 0) + (Number(item.quantity) || 0);
    }

    // Recalculate each item's price using pricingEngine logic
    const recalcedItems = [];
    for (const item of quotation.items) {
      const product = productMap[item.product_id];

      if (!product) {
        return Response.json({ error: `Product ${item.product_id} not found in catalog` }, { status: 404 });
      }

      const category = categoryMap[product.category];
      const categoryQty = categoryQtyMap[product.category || '__none__'] || 0;
      const quantity = Number(item.quantity) || 1;

      // Apply pricing engine logic
      let price = product.retail_sale_price ?? product.sale_price ?? 0;
      let rule = 'retail';

      // Rule 1: client force purchase price
      if (client?.force_purchase_all_products) {
        if (product.purchase_price != null && product.purchase_price >= 0) {
          price = product.purchase_price + 20;
          rule = 'client_purchase';
        }
      }
      // Rule 2: client force wholesale price
      else if (client?.force_wholesale_all_products) {
        if (product.wholesale_sale_price != null && product.wholesale_sale_price >= 0) {
          price = product.wholesale_sale_price;
          rule = 'client_wholesale';
        }
      }
      // Rule 3: category wholesale threshold
      else if (category?.wholesale_min_qty > 0 && categoryQty >= category.wholesale_min_qty) {
        if (product.wholesale_sale_price != null && product.wholesale_sale_price >= 0) {
          price = product.wholesale_sale_price;
          rule = 'wholesale_qty';
        }
      }

      const total = quantity * Math.max(0, price);

      recalcedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        quantity: quantity,
        unit_price: Math.max(0, price),
        total: total,
        tax_rate: product.tax_rate ?? 16
      });
    }

    // Calculate totals with precise VAT handling and reconciliation
    const { subtotal, tax: taxAmount, total } = calculateTotalsWithReconciliation(recalcedItems);

    // Update quotation with recalculated data
    const updated = await base44.entities.Quotation.update(quotation_id, {
      items: recalcedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100
    });

    return Response.json({
      success: true,
      quotation_id,
      quotation: updated,
      message: 'Quotation regenerated successfully'
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}