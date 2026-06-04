// Motor de proyección/pronóstico de utilidad.
//
// Método principal: PACING HISTÓRICO. Comparamos cuánto se había acumulado al
// mismo día del mes en meses anteriores contra cómo cerró cada uno, y aplicamos
// esa curva real (estacionalidad incluida) a lo realizado este mes. Si no hay
// histórico utilizable, caemos a un run-rate lineal.
//
// Funciones puras y testeables.

const ACTIVE_STATUSES = ["draft", "sent", "accepted"];

/** Días inclusivos entre dos fechas YYYY-MM-DD. */
function daysBetweenInclusive(startStr, endStr) {
  const start = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff) + 1;
}

/** Mediana de un arreglo de números. */
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Tasa de conversión histórica = concretadas / total, sobre la ventana entregada.
 * @returns {{ rate:number, converted:number, total:number }}
 */
export function computeConversionRate(quotationsInWindow = []) {
  const total = quotationsInWindow.length;
  const converted = quotationsInWindow.filter((q) => q.status === "converted").length;
  const rate = total > 0 ? converted / total : 0;
  return { rate, converted, total };
}

/** Cotizaciones sin concretar (pipeline abierto) con monto positivo. */
export function getActiveQuotations(quotations = []) {
  return quotations.filter(
    (q) => ACTIVE_STATUSES.includes(q.status) && (q.total || 0) > 0 && q.payment_method !== "Sin cargo"
  );
}

/**
 * Factor de pacing a partir de muestras históricas {partial, full} del mismo
 * recorte de día. Devuelve la mediana de full/partial para muestras válidas.
 * @returns {{ factor:number|null, samples:number }}
 */
export function computePacingFactor(historicalSamples = []) {
  const ratios = historicalSamples
    .filter((s) => Number.isFinite(s.partial) && Number.isFinite(s.full) && s.partial > 0 && s.full > 0)
    .map((s) => s.full / s.partial)
    // descartar curvas absurdas (p.ej. un solo día atípico)
    .filter((r) => r >= 1 && r <= 60);
  const factor = median(ratios);
  return { factor, samples: ratios.length };
}

/**
 * Proyección de Utilidad Neta para el mes seleccionado.
 *
 * @param {Object} args
 * @param {number} args.realizedNetProfit  Utilidad Neta realizada hasta hoy.
 * @param {string} args.monthStart  Inicio de mes (YYYY-MM-DD).
 * @param {string} args.monthEnd    Fin de mes (YYYY-MM-DD).
 * @param {string} args.todayStr    Hoy (YYYY-MM-DD).
 * @param {Array}  args.historicalSamples  [{ partial, full }] del mismo recorte de día.
 * @param {Array}  args.activeQuotations   Pipeline abierto (informativo).
 * @param {number} args.conversionRate     Tasa 0..1 (informativo).
 * @param {Array}  args.products           Catálogo (para costo estimado del pipeline).
 * @returns {Object}
 */
export function computeForecast({
  realizedNetProfit = 0,
  monthStart,
  monthEnd,
  todayStr,
  historicalSamples = [],
  activeQuotations = [],
  conversionRate = 0,
  products = [],
}) {
  const daysInMonth = daysBetweenInclusive(monthStart, monthEnd);

  let daysElapsed;
  if (todayStr < monthStart) daysElapsed = 0;
  else if (todayStr > monthEnd) daysElapsed = daysInMonth;
  else daysElapsed = daysBetweenInclusive(monthStart, todayStr);

  const isClosed = todayStr > monthEnd;
  const isFuture = todayStr < monthStart;

  // Pacing lineal (run-rate): asume días uniformes.
  const linearFactor = daysElapsed > 0 ? daysInMonth / daysElapsed : 1;
  const runRateNet = realizedNetProfit * linearFactor;

  // Pacing histórico (preferido): curva real del mismo recorte de día.
  const { factor: historicalFactor, samples: historicalMonths } = computePacingFactor(historicalSamples);
  const usesHistorical = historicalFactor != null && daysElapsed > 0;
  const pacingFactor = usesHistorical ? historicalFactor : linearFactor;

  // Pipeline abierto — informativo (no se suma: el pacing ya incluye las
  // conversiones normales del negocio para no contar doble).
  const productLookup = products.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  let pipelineRevenue = 0, pipelineCost = 0;
  activeQuotations.forEach((q) => {
    pipelineRevenue += q.total || 0;
    (q.items || []).forEach((it) => {
      pipelineCost += (it.quantity || 0) * (productLookup[it.product_id]?.purchase_price ?? 0);
    });
  });
  const expectedPipelineProfit = (pipelineRevenue - pipelineCost) * conversionRate;

  let projectedNetProfit;
  if (isClosed) projectedNetProfit = realizedNetProfit;
  else if (isFuture) projectedNetProfit = 0;
  else projectedNetProfit = realizedNetProfit * pacingFactor;

  return {
    daysInMonth,
    daysElapsed,
    isClosed,
    isFuture,
    method: usesHistorical ? "historical" : "linear",
    historicalMonths,
    pacingFactor,
    runRateNet,
    projectedNetProfit,
    activeCount: activeQuotations.length,
    expectedPipelineProfit,
    conversionRate,
  };
}
