// Motor de proyección/pronóstico de utilidad (estadística básica).
//
// Combina tres señales, todas con datos que la app ya tiene:
//   1. Run-rate: ritmo de la utilidad realizada extrapolado al mes completo.
//   2. Pipeline ponderado: cotizaciones activas × tasa de conversión histórica.
//   3. (pendiente) compromisos fijos recurrentes.
//
// Funciones puras y testeables. La preferencia de mostrar esto vive en
// AppSettings.utility_forecast_enabled (toggle por negocio).

const ACTIVE_STATUSES = ["draft", "sent", "accepted"];

/** Cuenta días inclusivos entre dos fechas YYYY-MM-DD. */
function daysBetweenInclusive(startStr, endStr) {
  const start = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff) + 1;
}

/**
 * Tasa de conversión histórica = concretadas / total, sobre las cotizaciones
 * de la ventana entregada (ya filtradas por fecha).
 * @returns {{ rate:number, converted:number, total:number }}
 */
export function computeConversionRate(quotationsInWindow = []) {
  const total = quotationsInWindow.length;
  const converted = quotationsInWindow.filter((q) => q.status === "converted").length;
  const rate = total > 0 ? converted / total : 0;
  return { rate, converted, total };
}

/** Cotizaciones activas (sin concretar ni canceladas) con monto positivo. */
export function getActiveQuotations(quotations = []) {
  return quotations.filter(
    (q) => ACTIVE_STATUSES.includes(q.status) && (q.total || 0) > 0 && q.payment_method !== "Sin cargo"
  );
}

/**
 * Proyección de utilidad para el mes seleccionado.
 *
 * @param {Object} args
 * @param {number} args.realizedNetProfit  Utilidad Neta realizada hasta hoy.
 * @param {string} args.monthStart  Inicio de mes (YYYY-MM-DD).
 * @param {string} args.monthEnd    Fin de mes (YYYY-MM-DD).
 * @param {string} args.todayStr    Hoy (YYYY-MM-DD, zona del negocio).
 * @param {Array}  args.activeQuotations  Cotizaciones activas (getActiveQuotations).
 * @param {number} args.conversionRate     Tasa 0..1.
 * @param {Array}  args.products           Catálogo (para costo estimado).
 * @returns {Object} Proyección y sus componentes.
 */
export function computeForecast({
  realizedNetProfit = 0,
  monthStart,
  monthEnd,
  todayStr,
  activeQuotations = [],
  conversionRate = 0,
  products = [],
}) {
  const daysInMonth = daysBetweenInclusive(monthStart, monthEnd);

  // Días transcurridos del mes (0 si el mes es futuro; completo si ya cerró).
  let daysElapsed;
  if (todayStr < monthStart) daysElapsed = 0;
  else if (todayStr > monthEnd) daysElapsed = daysInMonth;
  else daysElapsed = daysBetweenInclusive(monthStart, todayStr);

  const isClosed = todayStr > monthEnd; // mes pasado: no se proyecta
  const isFuture = todayStr < monthStart;

  // 1. Run-rate sobre lo realizado
  const runRateNet = daysElapsed > 0 ? (realizedNetProfit / daysElapsed) * daysInMonth : 0;

  // 2. Pipeline ponderado por tasa de conversión
  const productLookup = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  let pipelineRevenue = 0;
  let pipelineCost = 0;
  activeQuotations.forEach((q) => {
    pipelineRevenue += q.total || 0;
    (q.items || []).forEach((it) => {
      const cost = productLookup[it.product_id]?.purchase_price ?? 0;
      pipelineCost += (it.quantity || 0) * cost;
    });
  });
  const pipelineProfit = pipelineRevenue - pipelineCost;
  const expectedPipelineRevenue = pipelineRevenue * conversionRate;
  const expectedPipelineProfit = pipelineProfit * conversionRate;

  // Proyección combinada: lo realizado + lo que el pipeline abierto debería aportar.
  // En mes cerrado no hay nada que proyectar; en mes futuro solo cuenta el pipeline.
  const projectedNetProfit = isClosed
    ? realizedNetProfit
    : (isFuture ? 0 : realizedNetProfit) + expectedPipelineProfit;

  return {
    daysInMonth,
    daysElapsed,
    isClosed,
    isFuture,
    runRateNet,
    pipelineRevenue,
    pipelineProfit,
    expectedPipelineRevenue,
    expectedPipelineProfit,
    activeCount: activeQuotations.length,
    conversionRate,
    projectedNetProfit,
  };
}
