// Estado de Resultados para un rango de fechas arbitrario (base devengada).
//
// Reutiliza el motor de ventas (computeSalesData) para la utilidad GENERADA
// (Utilidad Total) y trata los movimientos manuales como RETIROS de utilidad
// (disposición): dinero que ya se dispuso —en efectivo o con tarjeta— y que
// resta a la utilidad disponible, no a la generada. Al ser parametrizable por
// rango, sirve tanto para el mes en curso como para meses históricos (proyección).

import { computeSalesData } from "./profitEngine";
import { getDateStringMexico } from "./period";
import { getRubroPlTreatment, PL_TREATMENT } from "./rubroTreatment";

/**
 * @param {Object} args
 * @param {Array}  args.quotations       Todas las cotizaciones del negocio.
 * @param {Array}  args.stockMovements   Todos los movimientos de stock.
 * @param {Array}  args.supplierPayments Todos los pagos a proveedores.
 * @param {Array}  args.products         Catálogo de productos.
 * @param {Array}  args.manualMovements  UtilityMovement (libreta manual).
 * @param {Object} args.rubrosById       Índice de rubros por id (tratamiento contable).
 * @param {string} args.rangeStart       Inicio inclusivo (YYYY-MM-DD).
 * @param {string} args.rangeEnd         Fin inclusivo (YYYY-MM-DD).
 * @returns {Object} Estado de Resultados del rango.
 */
export function computeIncomeStatement({
  quotations = [],
  stockMovements = [],
  supplierPayments = [],
  products = [],
  manualMovements = [],
  rubrosById = {},
  rangeStart,
  rangeEnd,
}) {
  const inRange = (d) => d >= rangeStart && d <= rangeEnd;

  const periodQuotations = quotations.filter((q) => inRange(getDateStringMexico(q.created_date)));
  const periodMovements = stockMovements.filter((m) => inRange(getDateStringMexico(m.created_date)));
  const periodSupplierPayments = supplierPayments.filter((p) => inRange(p.payment_date || ""));

  const op = computeSalesData({
    periodQuotations,
    periodMovements,
    periodSupplierPayments,
    products,
    quotations,
  });

  // Movimientos manuales = retiros de utilidad (disposición). Van "bajo la línea":
  // restan a la utilidad disponible, no a la generada. Se excluyen los rubros que
  // ya captura el motor automático (ventas/COGS) para no contar doble. Un eventual
  // ingreso manual heredado se trata como retiro negativo (devuelve disponibilidad).
  let withdrawals = 0;
  manualMovements.forEach((m) => {
    if (!inRange(m.movement_date || "")) return;
    const rubro = (m.rubro_id && rubrosById[m.rubro_id]) || {
      name: m.rubro_name,
      pl_treatment: m.rubro_pl_treatment,
    };
    const treatment = getRubroPlTreatment(rubro);
    if (treatment === PL_TREATMENT.AUTO_SALES || treatment === PL_TREATMENT.AUTO_COGS) return;
    const amount = Number(m.amount) || 0;
    withdrawals += m.movement_type === "income" ? -amount : amount;
  });

  const salesRevenue = op.salesRevenue;
  const cogs = op.salesCost;
  const grossProfit = salesRevenue - cogs;
  const supplierPaymentsTotal = op.supplierPaymentsTotal;
  // Utilidad Total = lo que el negocio GENERÓ en el periodo (provisional hasta el cierre).
  const totalProfit = grossProfit - supplierPaymentsTotal;
  // Utilidad Disponible = dinero sonante que queda tras los retiros ya dispuestos.
  const availableProfit = totalProfit - withdrawals;
  const pendingCollection = salesRevenue - op.realRevenue;

  return {
    salesRevenue,
    cogs,
    grossProfit,
    supplierPaymentsTotal,
    totalProfit,
    withdrawals,
    availableProfit,
    pendingCollection,
    hasOperations:
      salesRevenue !== 0 || cogs !== 0 || supplierPaymentsTotal !== 0 || withdrawals !== 0,
  };
}
