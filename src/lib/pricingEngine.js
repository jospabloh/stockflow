/**
 * Pricing Engine — StockFlow
 * 
 * Hierarchy (mandatory, client overrides product):
 * 1. client.force_purchase_all_products  => purchase_price
 * 2. client.force_wholesale_all_products => wholesale_sale_price
 * 3. quantity >= product.wholesale_min_qty (and min_qty > 0) => wholesale_sale_price
 * 4. default => retail_sale_price
 * 
 * Fallbacks:
 * - If required price is missing, falls back to retail_sale_price
 * - If retail_sale_price missing but legacy sale_price exists, uses sale_price
 * - Never returns negative price
 * 
 * Returns: { price: number, rule: string, origin: string, warning: string|null }
 */
export function calculatePrice({ product, client, quantity }) {
  const qty = Number(quantity) || 1;

  const retail = product.retail_sale_price ?? product.sale_price ?? 0;
  const wholesale = product.wholesale_sale_price ?? null;
  const purchase = product.purchase_price ?? null;
  const minQty = product.wholesale_min_qty;
  const wholesaleConfigured = minQty != null && minQty > 0;

  let price = retail;
  let rule = "retail";
  let origin = "Precio menudeo";
  let warning = null;

  // Rule 1: client force purchase price
  if (client?.force_purchase_all_products) {
    if (purchase != null && purchase >= 0) {
      price = purchase;
      rule = "client_purchase";
      origin = "Se aplicó precio de compra por configuración del cliente";
    } else {
      // Fallback
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

  // Rule 3: quantity >= wholesale_min_qty (only if configured)
  if (wholesaleConfigured && qty >= minQty) {
    if (wholesale != null && wholesale >= 0) {
      price = wholesale;
      rule = "wholesale_qty";
      origin = `Se aplicó precio mayoreo por cantidad mínima del producto (mín. ${minQty})`;
    } else {
      price = retail;
      rule = "retail";
      origin = "Se aplicó precio menudeo";
      warning = "La cantidad alcanza el mínimo para mayoreo, pero este producto no tiene precio mayoreo definido. Se usó precio menudeo.";
    }
    return { price: Math.max(0, price), rule, origin, warning };
  }

  // Rule 4: default retail
  price = retail;
  rule = "retail";
  origin = "Se aplicó precio menudeo";

  // Legacy compatibility warning
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
    wholesale_qty: "Se aplicó precio mayoreo por cantidad mínima del producto",
    retail: "Se aplicó precio menudeo",
  };
  return labels[rule] || rule;
}