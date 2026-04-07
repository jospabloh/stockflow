/**
 * Pricing Engine — StockFlow
 *
 * Pricing priority (explicit, top wins):
 * 1. client.force_purchase_all_products  => purchase_price
 * 2. client.force_wholesale_all_products => wholesale_sale_price
 * 3. category.wholesale_min_qty > 0 AND categoryQty >= threshold => wholesale_sale_price
 *    (categoryQty = sum of quantities of ALL items in the same category in the quotation)
 * 4. default => retail_sale_price
 *
 * IMPORTANT: Rule 3 now evaluates category-level quantity, NOT per-item quantity.
 * Pass categoryQty = total qty of this product's category across the whole quotation.
 * If categoryQty is omitted, falls back to the item's own quantity (safe default).
 *
 * Fallbacks:
 * - If required price is missing, falls back to retail_sale_price
 * - If retail_sale_price missing but legacy sale_price exists, uses sale_price
 * - Never returns negative price
 *
 * Returns: { price: number, rule: string, origin: string, warning: string|null }
 */
export function calculatePrice({ product, client, quantity, category, categoryQty }) {
  const qty = Number(quantity) || 1;
  // categoryQty: total qty of this category across the quotation (for wholesale threshold check)
  const catQty = categoryQty != null ? Number(categoryQty) : qty;

  const retail = product.retail_sale_price ?? product.sale_price ?? 0;
  const wholesale = product.wholesale_sale_price ?? null;
  const purchase = product.purchase_price ?? null;

  // Read threshold from Category (new source of truth)
  const minQty = category?.wholesale_min_qty;
  const wholesaleConfigured = minQty != null && Number(minQty) > 0;

  let price = retail;
  let rule = "retail";
  let origin = "Precio menudeo";
  let warning = null;

  // Rule 1: client force purchase price (+ 20 MXN transport)
  if (client?.force_purchase_all_products) {
    if (purchase != null && purchase >= 0) {
      // Suma $20 MXN y aplica IVA 16% (igual que otros precios que ya incluyen IVA)
      price = (purchase + 20) * 1.16;
      rule = "client_purchase";
      origin = "Se aplicó precio de compra + $20 MXN transporte (cliente), con IVA 16% incluido";
    } else {
      price = retail;
      rule = "retail";
      origin = "Se aplicó precio menudeo";
      warning = "El cliente tiene configurado precio de compra, pero este producto no tiene precio de compra definido. Se usó precio menudeo.";
    }
    return { price: Math.max(0, price), rule, origin, warning };
  }

  // Rule 2: client force wholesale price
  if (client?.force_wholesale_all_products) {
    if (wholesale != null && wholesale >= 0) {
      price = wholesale;
      rule = "client_wholesale";
      origin = "Se aplicó precio mayoreo por configuración del cliente";
    } else {
      price = retail;
      rule = "retail";
      origin = "Se aplicó precio menudeo";
      warning = "El cliente tiene configurado precio mayoreo, pero este producto no tiene precio mayoreo definido. Se usó precio menudeo.";
    }
    return { price: Math.max(0, price), rule, origin, warning };
  }

  // Rule 3: category wholesale threshold (uses categoryQty, not per-item qty)
  if (wholesaleConfigured && catQty >= Number(minQty)) {
    if (wholesale != null && wholesale >= 0) {
      price = wholesale;
      rule = "wholesale_qty";
      origin = `Se aplicó precio mayoreo por cantidad mínima de categoría (mín. ${minQty} en categoría)`;
    } else {
      price = retail;
      rule = "retail";
      origin = "Se aplicó precio menudeo";
      warning = "La cantidad de categoría alcanza el mínimo para mayoreo, pero este producto no tiene precio mayoreo definido. Se usó precio menudeo.";
    }
    return { price: Math.max(0, price), rule, origin, warning };
  }

  // Rule 4: default retail
  price = retail;
  rule = "retail";
  origin = "Se aplicó precio menudeo";

  if (!product.retail_sale_price && product.sale_price) {
    warning = "Se usó precio heredado por compatibilidad.";
  }

  return { price: Math.max(0, price), rule, origin, warning };
}

/**
 * Returns a human-readable label for the rule
 */
export function getRuleLabel(rule) {
  const labels = {
    client_purchase: "Se aplicó precio de compra por configuración del cliente",
    client_wholesale: "Se aplicó precio mayoreo por configuración del cliente",
    wholesale_qty: "Se aplicó precio mayoreo por cantidad mínima de categoría",
    retail: "Se aplicó precio menudeo",
  };
  return labels[rule] || rule;
}

/**
 * Compute category quantity totals from a list of quotation items and a product map.
 * Returns a map: { [category_id]: totalQty }
 */
export function computeCategoryQtyMap(items, productMap) {
  const map = {};
  for (const item of items) {
    const product = productMap[item.product_id];
    const catId = product?.category || "__none__";
    map[catId] = (map[catId] || 0) + (Number(item.quantity) || 0);
  }
  return map;
}