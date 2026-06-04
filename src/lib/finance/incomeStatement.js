// Estado de Resultados para un rango de fechas arbitrario (base devengada).
//
// Reutiliza el motor de ventas (computeSalesData) y le suma los movimientos
// manuales operativos. Al ser parametrizable por rango, sirve tanto para el mes
// en curso como para meses históricos (usado por la proyección por pacing).

import { computeSalesData } from "./profitEngine";
import { getDateStringMexico } from "./period";
import { isOperatingMovement } from "./rubroTreatment";

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

  // Manuales: solo rubros operativos suman al resultado (anti doble conteo)
  let manualIncome = 0, manualExpense = 0;
  manualMovements.forEach((m) => {
    if (!inRange(m.movement_date || "")) return;
    if (!isOperatingMovement(m, rubrosById)) return;
    if (m.movement_type === "income") manualIncome += Number(m.amount) || 0;
    else manualExpense += Number(m.amount) || 0;
  });

  const salesRevenue = op.salesRevenue;
  const cogs = op.salesCost;
  const grossProfit = salesRevenue - cogs;
  const realProfit = grossProfit + manualIncome - manualExpense;
  const supplierPaymentsTotal = op.supplierPaymentsTotal;
  const netProfit = realProfit - supplierPaymentsTotal;
  const pendingCollection = salesRevenue - op.realRevenue;

  return {
    salesRevenue,
    cogs,
    grossProfit,
    manualIncome,
    manualExpense,
    realProfit,
    supplierPaymentsTotal,
    netProfit,
    pendingCollection,
    hasOperations:
      salesRevenue !== 0 || cogs !== 0 || supplierPaymentsTotal !== 0 || manualIncome !== 0 || manualExpense !== 0,
  };
}
