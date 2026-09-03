// Venta de maquinaria — la aritmética de la tabla, en un solo lugar.
//
// La utilidad y la comisión NO se guardan en `MachinerySale`: se derivan de
// `cost` y `sale_price`, que sí. Guardar un total calculable es como se
// desincronizan las cifras (misma razón por la que la cotización guarda
// `amount_paid` pero no su propio margen).

/**
 * Porcentaje de la UTILIDAD que se paga como comisión.
 *
 * El Excel del que viene este módulo encabezaba la columna "Comisión 4%", pero
 * la petición (Silvita, 2026-09-03) fue explícita: 5% de la utilidad. Si el
 * porcentaje vuelve a cambiar, se cambia aquí y las filas ya registradas pasan
 * a mostrar el nuevo cálculo — la comisión no se congela por venta, porque
 * ninguna de las dos versiones de la tabla la guardaba.
 */
export const MACHINERY_COMMISSION_RATE = 0.05;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Deriva utilidad y comisión de una venta.
 *
 * Una venta sin precio de venta está en trámite (los renglones 2 y 3 del Excel
 * original: cliente y tipo capturados, importes todavía no), así que devuelve
 * `null` en vez de un cero que se leería como "no dejó utilidad".
 */
export function machinerySaleFinancials(sale) {
  const cost = num(sale?.cost);
  const salePrice = num(sale?.sale_price);

  if (salePrice <= 0) {
    return { cost, salePrice, profit: null, commission: null, settled: false };
  }

  const profit = salePrice - cost;
  // Una venta a pérdida no genera comisión negativa: no se le cobra al
  // vendedor, simplemente no hay comisión.
  const commission = profit > 0 ? profit * MACHINERY_COMMISSION_RATE : 0;

  return { cost, salePrice, profit, commission, settled: true };
}

/** Totales de un conjunto de ventas, saltando las que siguen en trámite. */
export function machinerySalesTotals(sales) {
  return (sales || []).reduce(
    (acc, sale) => {
      const { cost, salePrice, profit, commission, settled } = machinerySaleFinancials(sale);
      if (!settled) return { ...acc, pending: acc.pending + 1 };
      return {
        count: acc.count + 1,
        pending: acc.pending,
        cost: acc.cost + cost,
        salePrice: acc.salePrice + salePrice,
        profit: acc.profit + profit,
        commission: acc.commission + commission,
      };
    },
    { count: 0, pending: 0, cost: 0, salePrice: 0, profit: 0, commission: 0 },
  );
}
