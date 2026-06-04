// Tratamiento de cada rubro dentro del Estado de Resultados.
//
// Evita el doble conteo entre la libreta manual (UtilityMovement) y lo que la
// app ya calcula sola (ventas, COGS, pagos a proveedores). Solo los rubros
// `operating` suman al resultado como gasto/ingreso manual.
//
// Mientras el campo persistido `pl_treatment` en `Rubro` no exista (fase
// posterior), se infiere por nombre desde el catálogo predeterminado.

export const PL_TREATMENT = {
  OPERATING: "operating", // gasto/ingreso operativo manual → cuenta
  AUTO_SALES: "auto_sales", // ya lo captura el motor de ventas → excluir
  AUTO_COGS: "auto_cogs", // ya lo cubren COGS / pagos a proveedores → excluir
  DISTRIBUTION: "distribution", // retiro de utilidad, va "bajo la línea" → excluir
};

// Mapeo por nombre (normalizado) para los rubros del catálogo que NO son operativos.
const NAME_OVERRIDES = {
  ventas: PL_TREATMENT.AUTO_SALES,
  "compras de mercancia": PL_TREATMENT.AUTO_COGS,
  "retiro de utilidades": PL_TREATMENT.DISTRIBUTION,
};

const normalize = (s) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // quitar acentos

/**
 * Devuelve el tratamiento de un rubro en el Estado de Resultados.
 * Prioriza el campo persistido `pl_treatment`; si no existe, lo infiere por nombre.
 * @param {Object} rubro objeto Rubro (o un movimiento con rubro_name).
 * @returns {string} uno de PL_TREATMENT.
 */
export function getRubroPlTreatment(rubro) {
  if (!rubro) return PL_TREATMENT.OPERATING;
  if (rubro.pl_treatment && Object.values(PL_TREATMENT).includes(rubro.pl_treatment)) {
    return rubro.pl_treatment;
  }
  const name = rubro.name ?? rubro.rubro_name;
  return NAME_OVERRIDES[normalize(name)] || PL_TREATMENT.OPERATING;
}

/** True si el movimiento manual debe sumar al resultado (rubro operativo). */
export function isOperatingMovement(movement, rubrosById = {}) {
  const rubro = (movement.rubro_id && rubrosById[movement.rubro_id]) || {
    name: movement.rubro_name,
    pl_treatment: movement.rubro_pl_treatment,
  };
  return getRubroPlTreatment(rubro) === PL_TREATMENT.OPERATING;
}
