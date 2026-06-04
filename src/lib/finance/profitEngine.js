// Motor de cálculo del Estado de Resultados (utilidad operativa).
//
// Funciones puras y testeables extraídas desde Dashboard.jsx (`salesData`) para
// ser la única fuente de verdad de la utilidad. Las consume tanto el Dashboard
// como el módulo Utilidad, evitando dos cálculos divergentes.
//
// Base contable: devengado (la venta cuenta al hacerse, el costo al entregar),
// con pagos a proveedores como línea de caja separada (Utilidad Neta).

/**
 * Calcula los indicadores de ventas/utilidad de un periodo.
 *
 * Comportamiento idéntico al `salesData` original del Dashboard; no cambiar la
 * semántica sin actualizar también las pruebas/Dashboard que dependen de ella.
 *
 * @param {Object} args
 * @param {Array} args.periodQuotations   Cotizaciones del periodo.
 * @param {Array} args.periodMovements    Movimientos de stock del periodo.
 * @param {Array} args.periodSupplierPayments Pagos a proveedores del periodo.
 * @param {Array} args.products           Catálogo de productos (para costo fallback).
 * @param {Array} args.quotations         Todas las cotizaciones (para detectar canceladas).
 * @returns {Object} Indicadores de ventas, costo y utilidad del periodo.
 */
export function computeSalesData({
  periodQuotations = [],
  periodMovements = [],
  periodSupplierPayments = [],
  products = [],
  quotations = [],
} = {}) {
  // Excluir precio cero / internas (force_zero_price / "Sin cargo") de métricas comerciales
  const periodConvertedQuotations = periodQuotations.filter(
    (q) => q.status === "converted" && (q.total || 0) > 0 && q.payment_method !== "Sin cargo"
  );
  const periodExits = periodMovements.filter((m) => m.type === "exit");
  const periodDirectExits = periodExits.filter((m) => m && !m.quotation_id);

  const salesFromQuotations = periodConvertedQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
  const salesFromDirectExits = periodDirectExits.reduce((sum, m) => sum + (m.total || 0), 0);
  const cancelledQuotationIds = new Set(
    quotations.filter((q) => q.status === "cancelled").map((q) => q.id)
  );

  const periodReturnsRevenue = periodMovements
    .filter((m) => m.type === "return" && m.quotation_id && !cancelledQuotationIds.has(m.quotation_id))
    .reduce((sum, m) => sum + (m.total || 0), 0);
  const salesRevenue = salesFromQuotations + salesFromDirectExits - periodReturnsRevenue;

  const unpaidQuotations = periodConvertedQuotations
    .filter((q) => !q.paid)
    .reduce((sum, q) => sum + (q.total || 0), 0);
  const unpaidDirectExits = periodDirectExits
    .filter((m) => !m.paid)
    .reduce((sum, m) => sum + (m.total || 0), 0);
  const unpaidTotal = unpaidQuotations + unpaidDirectExits;
  const realRevenue = salesRevenue - unpaidTotal;

  const undeliveredQuotations = periodConvertedQuotations.filter((q) => !q.delivered);
  const undeliveredTotal = undeliveredQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
  const undeliveredItems = undeliveredQuotations.reduce((sum, q) => sum + (q.items?.length || 0), 0);

  const productLookup = products.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  const validExits = periodExits.filter(
    (m) => !m.quotation_id || !cancelledQuotationIds.has(m.quotation_id)
  );
  const periodReturns = periodMovements.filter(
    (m) => m.type === "return" && m.quotation_id && !cancelledQuotationIds.has(m.quotation_id)
  );

  const costOf = (m) => {
    const costUnit =
      m.cost_price != null && m.cost_price > 0
        ? m.cost_price
        : productLookup[m.product_id]?.purchase_price ?? 0;
    return (m.quantity || 0) * costUnit;
  };

  const salesCost =
    validExits.reduce((sum, m) => sum + costOf(m), 0) -
    periodReturns.reduce((sum, m) => sum + costOf(m), 0);

  const actualProfit = realRevenue - salesCost;
  const actualMargin = realRevenue > 0 ? (actualProfit / realRevenue) * 100 : 0;

  const potentialProfit = salesRevenue - salesCost;
  const potentialMargin = salesRevenue > 0 ? (potentialProfit / salesRevenue) * 100 : 0;
  const salesCount = periodConvertedQuotations.length + periodDirectExits.length;

  const supplierPaymentsTotal = periodSupplierPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const netProfit = actualProfit - supplierPaymentsTotal;
  const netMargin = realRevenue > 0 ? (netProfit / realRevenue) * 100 : 0;
  // % de utilidad real consumida por pagos a proveedores (solo cuando hay utilidad positiva)
  const supplierImpactPct = actualProfit > 0 ? (supplierPaymentsTotal / actualProfit) * 100 : 0;

  return {
    salesRevenue,
    realRevenue,
    salesCost,
    actualProfit,
    actualMargin,
    potentialProfit,
    potentialMargin,
    salesCount,
    periodExits,
    periodDirectExits,
    periodConvertedQuotations,
    undeliveredTotal,
    undeliveredItems,
    supplierPaymentsTotal,
    netProfit,
    netMargin,
    supplierImpactPct,
  };
}
