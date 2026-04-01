/**
 * StockFlow — Fuente única de verdad para la versión de la aplicación.
 * Actualiza APP_VERSION aquí y se reflejará automáticamente en la pestaña "Acerca de".
 */
export const APP_VERSION = "1.5.0";

export const RELEASE_DATE = "2026-04-01";

export const CHANGELOG = [
  {
    version: "1.5.0",
    date: "2026-04-01",
    changes: [
      "Toggle 'Pago recibido' en el formulario de salidas directas para registrar el cobro en el momento",
      "Columna 'Pago' en la tabla de Movimientos: badge Pendiente (clickeable) y Cobrado para salidas directas",
      "Alerta de cobros pendientes en el Dashboard unificada: suma cotizaciones concretadas sin pagar + salidas directas sin cobrar",
      "Desglose de la alerta: indica cuántas son de cotizaciones y cuántas de movimientos directos",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-03-31",
    changes: [
      "Botón de seguimiento unificado en cotizaciones: un solo dropdown 'Ruta' con opciones En Ruta / Entregado / Quitar estado",
      "Indicador visual de alerta (rojo pulsante '¡Cobrar!') para pedidos entregados sin cobrar en la tabla de cotizaciones",
      "Reportes: filas 'Entregado sin cobrar' resaltadas en rojo con etiqueta de alerta para facilitar seguimiento de cobranza",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-03-31",
    changes: [
      "Campo 'Giro' agregado a clientes: visible en tabla, formulario e importación CSV",
      "Dropdowns de Cliente y Forma de Pago con búsqueda en tiempo real en formulario de movimientos",
      "Nuevo componente SearchableSelect reutilizable para selects buscables en toda la app",
      "Mejoras de visibilidad en botón de eliminar movimientos para administradores",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-03-28",
    changes: [
      "Formas de pago configurables desde Configuración (Pagos), compartidas en movimientos y cotizaciones",
      "Eliminación segura de movimientos con reversión automática de stock",
      "Mejoras de contraste y legibilidad en el formulario de movimientos (total visible en modo oscuro)",
    ],
  },
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