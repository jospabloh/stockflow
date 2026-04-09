/**
 * StockFlow — Fuente única de verdad para la versión de la aplicación.
 * Actualiza APP_VERSION aquí y se reflejará automáticamente en la pestaña "Acerca de".
 */
export const APP_VERSION = "2.5.7";

export const RELEASE_DATE = "2026-04-09";

export const CHANGELOG = [
  {
    version: "2.5.7",
    date: "2026-04-09",
    changes: [
      "🔧 Corrección de precios en formulario de movimientos: el precio ahora aplica correctamente las reglas del cliente seleccionado (forzar precio compra o mayoreo), en lugar de ignorarlas siempre",
      "🔧 Corrección de stock inconsistente: 'Café de Coatepec en Grano' (Baristop) corregido de 100 a 50 unidades, alineado con el historial de movimientos",
      "📱 Corrección de accesibilidad del botón Guardar en formulario de movimientos: el footer ahora siempre visible en pantallas pequeñas (max-h-[90dvh] en diálogo)",
      "📱 Corrección de zoom involuntario en iOS: viewport actualizado con maximum-scale=1.0 para evitar zoom por pellizco que causaba recarga de página en modo PWA",
    ],
  },
  {
    version: "2.5.6",
    date: "2026-04-08",
    changes: [
      "🔒 Gestión de sesión basada en inactividad real (Idle Timeout): la sesión ya no expira mientras el usuario esté navegando o trabajando activamente",
      "⏱️ Aviso de inactividad: tras 20 minutos sin actividad aparece un aviso con cuenta regresiva de 2 minutos antes de cerrar la sesión",
      "✅ El usuario puede retomar la sesión con un clic — si ignora el aviso, se muestra el diálogo de sesión expirada con opción de renovar o salir",
      "🛡️ Heartbeat de sesión inteligente: solo se envía mientras el usuario está activo — sin llamadas innecesarias cuando la app está en segundo plano",
    ],
  },
  {
    version: "2.5.5",
    date: "2026-04-07",
    changes: [
      "🔄 Semáforo de cotizaciones ahora filtra a últimos 30 días: muestra conteo actualizado de cotizaciones concretadas, en ruta y entregadas de este período",
      "🚨 Nueva alerta de Cobranza Vencida: identifica cotizaciones concretadas sin cobrar que están fuera de los 30 días y requieren seguimiento urgente",
      "📊 Etiqueta añadida al semáforo: especifica 'En los últimos 30 días' para claridad en los datos mostrados",
    ],
  },
  {
    version: "2.5.4",
    date: "2026-04-07",
    changes: [
      "✨ Corrección crítica de navegación en mobile: la barra inferior de navegación ahora es siempre clickeable, incluso con preview de cotización abierto (z-index 70 + pointer-events-auto)",
      "Dialog de cotización mejorado: scroll interno sin bloquear página, permite navegar a otros módulos sin cerrar manualmente",
      "Navegación fluida: usuario puede cambiar entre Dashboard, Productos, Movimientos y Cotizaciones sin trabarse en preview",
    ],
  },
  {
    version: "2.5.3",
    date: "2026-04-07",
    changes: [
      "🔧 Corrección de scroll en tablas de Cotizaciones y Productos: el contenedor ahora permite hacer scroll correctamente en desktop (max-h 70vh con overflow-y-auto)",
      "Header fijo en tablas: el encabezado de columnas permanece visible al hacer scroll gracias a sticky top-0 funcionando correctamente",
    ],
  },
  {
    version: "2.5.2",
    date: "2026-04-07",
    changes: [
      "🗓️ Corrección del filtro de período 'Semana' en Dashboard: ahora muestra correctamente el rango desde el lunes de la semana actual hasta hoy (ej. 01/04/2026 – 07/04/2026)",
      "🌍 Zona horaria corregida: el cálculo de semana usa Intl.DateTimeFormat con America/Mexico_City respetando horario de verano (CDT = UTC-5 en verano, CST = UTC-6 en invierno)",
      "El indicador de rango de fechas en el toggle de período ahora siempre refleja el rango correcto para cada período seleccionado",
    ],
  },
  {
    version: "2.5.1",
    date: "2026-04-07",
    changes: [
      "🔧 Corrección de navegación post-guardado: guardar un producto, movimiento o cotización ya no redirige al dashboard — el usuario regresa a la pantalla anterior con contexto, filtros y posición de scroll preservados",
      "🌍 Configuración regional y zona horaria: nueva sección 'Región y Zona Horaria' en Configuración → Negocio para seleccionar tu país/zona horaria",
      "Zona horaria configurable: 14 opciones incluyendo México (CDMx, Monterrey, Tijuana, Cancún), EE.UU., Colombia, Perú, Chile, Argentina, Brasil, España y UTC",
      "Formato regional configurable: 8 opciones de idioma/fecha (es-MX, es-CO, es-AR, pt-BR, en-US, etc.)",
      "Nueva librería dateUtils.js: todas las fechas del sistema (filtros 'hoy', semana, mes, rangos) se calculan usando la zona horaria configurada",
      "Botones de diálogo mobile mejorados: corregido safe area en iOS para que acciones de formularios nunca queden ocultas bajo la barra de navegación inferior",
    ],
  },
  {
    version: "2.5.0",
    date: "2026-04-06",
    changes: [
      "🎯 Restructuración de navegación: nuevo menú padre 'Catálogos' en sidebar que agrupa 5 catálogos operativos",
      "Catálogos submenu: Productos, Categorías, Proveedores, Clientes, Tipo de pago — cada uno como página independiente",
      "Extracción de gestión de catálogos desde Configuración: Categorías, Proveedores, Clientes, Tipo de pago ahora son módulos autónomos y accesibles",
      "Configuración simplificada: eliminadas pestañas de catálogos duplicadas, solo opciones de negocio, fiscales, equipo, importación e informes",
      "Menú Acerca de renombrado correctamente: label en sidebar es 'Acerca de' (no StockFlow), página interna muestra 'StockFlow' como nombre de producto",
      "Protección de layout en cotizaciones PDF: corrección de espacio de dirección larga para evitar colisiones con código de folio",
      "Text wrapping mejorado: direcciones largas en cotizaciones se desglosan correctamente sin superponer números de folio",
      "Responsive integrity validado: todas las nuevas páginas de catálogos funcionales en iPhone y Android sin botones ocultos",
      "Integridad de datos preservada: CRUD de catálogos, permisos, business_id isolation, y tenant aislamiento completamente intactos",
    ],
  },
  {
    version: "2.4.4",
    date: "2026-04-06",
    changes: [
      "Nueva configuración de transporte para clientes con precio de compra forzado: +20 MXN por producto automáticamente",
      "En formulario de cliente: mostrar '20 MXN transporte/producto' cuando force_purchase_all_products = true",
      "En cotización: icono 🚚 en cada línea de producto cuando el cliente tiene transporte aplicado",
      "Actualizado pricing engine: suma de +20 MXN por producto SOLO para clientes con force_purchase = true",
      "Campo en UI cliente mejorado con alerta visual del transporte aplicado",
    ],
  },
  {
    version: "2.4.3",
    date: "2026-04-06",
    changes: [
      "Corrección definitiva de cálculo de IVA en cotizaciones: productos con IVA 16% desglosan el impuesto contenido (÷1.16), productos Excento (IVA 0%) no se desglosan",
      "Mejora de visibilidad: labels actualizados de 'IVA' a 'IVA 16%' y '0%' a 'Excento' para claridad",
      "Indicador de configuración cliente: ahora muestra badge pequeño 'Compra' o 'Mayoreo' debajo del label de IVA cuando el cliente tiene configuración forzada",
      "Total a pagar = suma directa (sin modificaciones), IVA desglosado solo para información, nunca se suma al total",
    ],
  },
  {
    version: "2.4.2",
    date: "2026-04-06",
    changes: [
      "🔥 Corrección crítica: los precios del catálogo son precios finales (con o sin IVA según aplique) — NO se suma IVA adicional en cotización",
      "Cambio importante: el sistema solo muestra un desglose informativo del IVA incluido para visibilidad, pero el total = suma directa de precios sin añadir nada más",
      "Mejora de contraste: total en cotizaciones ahora visible correctamente en tema claro y oscuro",
    ],
  },
  {
    version: "2.4.1",
    date: "2026-04-06",
    changes: [
      "Intento anterior: cálculo de IVA en cotizaciones — causó doble conteo de impuestos en Baristop",
      "Raíz del problema identificada: asumimos que los precios eran SIN IVA, cuando en realidad el cliente proporciona precios YA finales",
    ],
  },
  {
    version: "2.4.0",
    date: "2026-04-06",
    changes: [
      "Función de corrección de cotizaciones: nueva función backend checkAndFixQuotation para anular o eliminar cotizaciones erradas",
      "Si la cotización está en Borrador → se elimina; si está Concretada → se hace rollback automático (restaura stock, crea movimientos de devolución)",
      "Función lista para producción tras identificar que COT-260406-0002 no existía en BD (cliente no la había guardado)",
    ],
  },
  {
    version: "2.3.0",
    date: "2026-04-03",
    changes: [
      "Nueva función: Devolución Parcial en cotizaciones concretadas — selecciona productos y cantidades devueltas, restaura stock automáticamente y ajusta el total de la cotización",
      "Flujo corregido: ya no es necesario cancelar + recrear cotizaciones para devoluciones parciales; para devolución total se usa 'Cancelar' con razón",
      "Opción 'Devolución parcial' disponible en el menú ⋯ de cualquier cotización con estado Concretada",
    ],
  },
  {
    version: "2.2.0",
    date: "2026-04-03",
    changes: [
      "Corrección crítica de IVA en cotizaciones: los precios ya incluyen IVA — ahora el sistema extrae el impuesto del total en lugar de sumarlo (evita doble conteo)",
      "Corrección de folio: la secuencia de folios ahora comienza correctamente desde 0001 (antes empezaba en 0000)",
      "Corrección manual aplicada a COT-260403-0000 para reflejar los valores correctos de IVA",
    ],
  },
  {
    version: "2.1.0",
    date: "2026-04-02",
    changes: [
      "Corrección: nombre del negocio ahora se muestra correctamente en la barra lateral (se resolvía con SDK autenticado en lugar de backend function)",
      "Eliminado duplicado del nombre del negocio en el sidebar — ahora aparece una sola vez bajo 'StockFlow'",
      "Reset y carga de datos de prueba para ACACIA OWNER SANDBOX: 10 productos, 4 categorías, 2 proveedores, 4 clientes, 12 movimientos, 4 cotizaciones y 4 movimientos de caja chica",
    ],
  },
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