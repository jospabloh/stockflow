// Rules the platform owner can switch per business from "Reglas por negocio".
// Only rules some code actually reads belong here: a switch that changes
// nothing is worse than no switch. Every key must also be in
// KNOWN_RULE_KEYS (adminUpsertTenantRule.ts) — base44/tests/tenant_rule_catalog_test.ts
// fails otherwise.
export const TENANT_RULE_CATALOG = [
  {
    key: "require_catalog_client_for_quotations",
    title: "Cotizar solo a clientes del catálogo",
    description:
      "No permite escribir el nombre del cliente a mano: hay que elegirlo de la lista de Clientes. Si el cliente es nuevo, primero se da de alta.",
    affects: [
      "Cotizaciones nuevas",
      "Cambiar el cliente de una cotización (las anteriores se pueden seguir editando)",
    ],
  },
  {
    key: "cash_sales_to_petty_cash",
    title: "Ventas en efectivo entran a Caja Chica",
    description:
      "Cada cobro en efectivo genera solo un ingreso en Caja Chica, sin capturarlo a mano y sin duplicados.",
    affects: [
      "Pagos en efectivo de cotizaciones",
      "Salidas de inventario cobradas en efectivo",
      "Devoluciones parciales (descuentan de Caja Chica)",
    ],
    // Same default activateBaristopCashRule writes; kept when toggling.
    defaultConfig: { prevent_duplicates: true },
  },
];
