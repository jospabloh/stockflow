/**
 * StockFlow — Fuente única de verdad para la versión de la aplicación.
 * Actualiza APP_VERSION aquí y se reflejará automáticamente en la pestaña "Acerca de".
 */
export const APP_VERSION = "1.1.0";

export const RELEASE_DATE = "2026-03-27";

export const CHANGELOG = [
  {
    version: "1.1.0",
    date: "2026-03-27",
    changes: [
      "Nuevo esquema de precios por producto: precio menudeo, mayoreo y cantidad mínima para mayoreo",
      "Jerarquía de precios por cliente: opciones para aplicar precio mayoreo o precio de compra en todos los productos",
      "Importación actualizada de productos con nuevas columnas de precios",
      "Nueva importación masiva de clientes desde CSV",
      "Nueva importación masiva de categorías desde CSV",
      "Corrección de visibilidad y contraste en la sección de importación (tema oscuro)",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-15",
    changes: [
      "Lanzamiento inicial de StockFlow",
      "Módulos de productos, movimientos, cotizaciones, caja chica y reportes",
      "Control multi-tenant con aislamiento por negocio",
      "Soporte para tema oscuro y modo PWA",
    ],
  },
];