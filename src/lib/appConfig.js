/**
 * StockFlow — Fuente única de verdad para la versión de la aplicación.
 * Actualiza APP_VERSION aquí y se reflejará automáticamente en la pestaña "Acerca de".
 */
export const APP_VERSION = "2.0.0";

export const RELEASE_DATE = "2026-04-01";

export const CHANGELOG = [
  {
    version: "2.0.0",
    date: "2026-04-01",
    changes: [
      "🔮 Capa Predictiva/Inteligente de Reportes (solo Admin/Owner): 8 reportes con lógica determinística interna",
      "Análisis Dinámico/Pivot: agrupación multi-dimensional (producto/categoría/cliente × mes/semana/día) con múltiples agregaciones",
      "Más Vendidos: ranking de productos por valor de ventas con barras de progreso",
      "Baja Rotación: productos con menor movimiento en período seleccionado",
      "Tendencia: gráfico dual de entradas/salidas con líneas de evolución diaria",
      "Riesgo de Agotamiento: predicción de días restantes de stock basada en promedio de 30 días",
      "Sugerencia de Resurtido: cálculo automático de cantidades recomendadas con urgencia (crítica/alta/media)",
      "Riesgo de Cobranza: puntuación determinística de riesgo por edad, monto y estado de entrega",
      "Discrepancias/Anomalías: 5 reglas determinísticas para detectar irregularidades operativas",
      "Acceso restringido: capa predictiva invisible para Sales/Warehouse/Storekeeper",
      "Sin integraciones externas: todo cálculo es interno, sin uso de créditos de integración",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-04-01",
    changes: [
      "Nueva pestaña 'Movimientos de Stock' en Reportes disponible para Almacenistas: historial detallado con filtro por tipo",
      "Nueva pestaña 'Predicción Inteligente de Pedidos' (solo Admin): alerta 🔴/🟡/🟢 por semanas de stock disponibles según historial de ventas",
      "Almacenistas requieren razón obligatoria al eliminar categorías de catálogo",
      "Settings ahora carga catálogos operativos para Almacenistas (no solo Admin)",
      "Reportes: la pestaña por defecto para Almacenista ahora abre 'Movimientos de Stock'",
      "Centro de Ayuda actualizado v2.4: artículos sobre reportes operativos, predicción de pedidos y eliminación con razón",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-04-01",
    changes: [
      "Auditoría y mejora de sección Reports para operaciones de distribuidor",
      "Pestaña 'Más Vendidos' rediseñada: ahora ordena por valor de ventas (no solo cantidad) con barra de progreso",
      "Pestaña 'Baja Rotación' mejorada: tabla con contexto de stock actual, mínimo y fecha de última salida",
      "Nueva pestaña 'Inventario Actual' (admin): listado completo de stock con valor unitario y valor total por producto",
      "Pestaña 'Mejor Margen' removida: datos infiables (schema usa retail_sale_price/wholesale_sale_price, no sale_price)",
      "Pestaña 'Por Categoría' removida: bajo valor operativo (reemplazada por Inventario Actual más útil)",
      "Mejora de contraste en modo oscuro: números y valores ahora más visibles en Dashboard y Reports",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-04-01",
    changes: [
      "Cálculo automático de impuestos en movimientos: el total incluye el IVA (tax_rate) del producto",
      "Etiqueta actualizada en Dashboard: 'Cobrado' en lugar de 'Venta real (menos pendiente)'",
      "Visibilidad por rol en Dashboard: almacenista ve 'Monto vendido' y 'Cobrado'; admin ve además 'Costo de lo vendido' y 'Ganancia bruta'",
    ],
  },
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