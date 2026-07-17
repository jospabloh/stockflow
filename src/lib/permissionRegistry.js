// Single source of truth for the permission registry.
// Each action has a category: 'visual' | 'actionable' | 'report'

export const PERMISSION_REGISTRY = {
  Dashboard: {
    label: "Dashboard",
    actions: [
      { id: "view", label: "Ver página", category: "visual", icon: "👁️", description: "Acceso a la página principal del dashboard" },
      { id: "summary", label: "Ver tarjeta resumen", category: "visual", icon: "📊", description: "Ver resumen rápido de inventario y ventas" },
      { id: "period_filter", label: "Filtro de período", category: "visual", icon: "📅", description: "Filtrar datos del dashboard por período de tiempo" },
      { id: "stat_products", label: "Tarjeta Productos", category: "visual", icon: "📦", description: "Ver tarjeta con cantidad de productos activos" },
      { id: "stat_total_value", label: "Tarjeta Valor Total", category: "visual", icon: "💵", sensitive: true, description: "Ver valor total del inventario al costo (confidencial)" },
      { id: "stat_movements", label: "Tarjeta Movimientos", category: "visual", icon: "🔄", description: "Ver tarjeta con cantidad de movimientos del período" },
      { id: "stat_low_stock", label: "Tarjeta Stock Bajo", category: "visual", icon: "⚠️", description: "Ver tarjeta con productos con stock bajo" },
      { id: "unpaid_alert", label: "Alerta ventas sin cobrar", category: "visual", icon: "🔔", description: "Ver alerta de ventas pendientes de cobro" },
      { id: "overdue_alert", label: "Alerta cobranza vencida", category: "visual", icon: "🚨", description: "Ver alerta de cobranza vencida (+30 días)" },
      { id: "quotation_semaphore", label: "Semáforo cotizaciones", category: "visual", icon: "🚦", description: "Ver semáforo de estado de cotizaciones (últimos 30 días)" },
      { id: "sales_breakdown", label: "Análisis de ventas", category: "visual", icon: "📈", description: "Ver tarjeta de análisis de ventas del período" },
      { id: "sales_cost", label: "Ver costo de lo entregado", category: "report", icon: "💲", sensitive: true, description: "Ver costo de ventas entregadas (confidencial)" },
      { id: "sales_actual_profit", label: "Ver utilidad real", category: "report", icon: "📊", sensitive: true, description: "Ver utilidad real después de cobros (confidencial)" },
      { id: "sales_net_profit", label: "Ver utilidad neta y pagos prov.", category: "report", icon: "💰", sensitive: true, description: "Ver utilidad neta y pagos a proveedores (confidencial)" },
      { id: "movements_chart", label: "Gráfico de movimientos", category: "visual", icon: "📉", description: "Ver gráfico de barras de entradas y salidas" },
      { id: "low_stock", label: "Ver alerta stock bajo", category: "visual", icon: "⚠️", description: "Ver productos con stock bajo o agotado" },
      { id: "pending_balance", label: "Alerta saldo pendiente", category: "visual", icon: "💳", description: "Ver alerta de cotizaciones entregadas sin cobrar" },
      { id: "recent_movements", label: "Ver movimientos recientes", category: "visual", icon: "📈", description: "Ver últimos movimientos de inventario" },
      { id: "supplier_payments_section", label: "Sección pagos proveedores", category: "visual", icon: "🏢", sensitive: true, description: "Ver gráfico y top de pagos a proveedores (confidencial)" },
      { id: "sales_report", label: "Ver reporte ventas", category: "report", icon: "💰", description: "Ver reporte de ventas y cotizaciones" },
      { id: "unpaid_detail", label: "Ver deudas pendientes", category: "report", icon: "💳", description: "Ver detalles de ventas no pagadas" },
      { id: "financial", label: "Ver resumen financiero", category: "report", icon: "💵", sensitive: true, description: "Ver resumen financiero y caja chica" },
    ]
  },
  Productos: {
    label: "Productos",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso a la lista de productos" },
      { id: "create", label: "Crear producto", category: "actionable", icon: "➕", description: "Crear nuevos productos en el catálogo" },
      { id: "edit_name", label: "Editar nombre", category: "actionable", icon: "✏️", description: "Modificar nombre del producto" },
      { id: "edit_description", label: "Editar descripción", category: "actionable", icon: "📝", description: "Modificar descripción y categoría" },
      { id: "edit_stock_quantity", label: "Editar cantidad stock", category: "actionable", icon: "📦", description: "Modificar cantidad actual de stock" },
      { id: "edit_min_stock", label: "Editar stock mínimo", category: "actionable", icon: "⚠️", description: "Establecer nivel mínimo de alerta" },
      { id: "edit_sku", label: "Editar SKU", category: "actionable", icon: "🏷️", description: "Modificar código SKU interno" },
      { id: "edit_barcode", label: "Editar código de barras", category: "actionable", icon: "🔖", description: "Modificar código de barras/EAN" },
      { id: "edit_unit", label: "Editar unidad medida", category: "actionable", icon: "⚙️", description: "Cambiar unidad (pieza, kg, litro, etc.)" },
      { id: "edit_supplier", label: "Editar proveedor", category: "actionable", icon: "🏢", description: "Asignar o cambiar proveedor" },
      { id: "edit_retail_price", label: "Editar precio menudeo", category: "actionable", icon: "💵", description: "Modificar precio de venta al menudeo" },
      { id: "edit_wholesale_price", label: "Editar precio mayoreo", category: "actionable", icon: "📦", description: "Modificar precio de venta mayorista" },
      { id: "edit_cost_price", label: "Editar precio costo", category: "actionable", icon: "💲", sensitive: true, description: "Modificar precio de compra (confidencial)" },
      { id: "edit_tax", label: "Editar IVA", category: "actionable", icon: "📊", description: "Cambiar tasa de impuesto (0% o 16%)" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar productos del catálogo" },
      { id: "import", label: "Importar", category: "actionable", icon: "📥", description: "Importar productos desde archivo CSV/Excel" },
      { id: "barcode", label: "Generar códigos", category: "actionable", icon: "📱", description: "Generar y descargar códigos de barras" },
      { id: "cost_price", label: "Ver costo", category: "report", icon: "💲", sensitive: true, description: "Ver precio de costo en listados (confidencial)" },
    ]
  },
  Categorias: {
    label: "Categorías",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso a la lista de categorías de productos" },
      { id: "create", label: "Crear", category: "actionable", icon: "➕", description: "Crear nuevas categorías de productos" },
      { id: "edit_name", label: "Editar nombre", category: "actionable", icon: "✏️", description: "Modificar nombre de categoría" },
      { id: "edit_description", label: "Editar descripción", category: "actionable", icon: "📝", description: "Modificar descripción" },
      { id: "edit_color", label: "Editar color", category: "actionable", icon: "🎨", description: "Cambiar color representativo" },
      { id: "edit_wholesale_min", label: "Editar mín. mayoreo", category: "actionable", icon: "📦", description: "Configurar cantidad mínima para precio mayoreo" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar categorías del sistema" },
    ]
  },
  Proveedores: {
    label: "Proveedores",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso a la lista de proveedores" },
      { id: "create", label: "Crear", category: "actionable", icon: "➕", description: "Agregar nuevos proveedores al catálogo" },
      { id: "edit_name", label: "Editar nombre", category: "actionable", icon: "✏️", description: "Modificar nombre del proveedor" },
      { id: "edit_contact", label: "Editar contacto", category: "actionable", icon: "📞", description: "Cambiar nombre, teléfono y email de contacto" },
      { id: "edit_address", label: "Editar dirección", category: "actionable", icon: "📍", description: "Modificar dirección del proveedor" },
      { id: "edit_rfc", label: "Editar RFC", category: "actionable", icon: "📋", description: "Cambiar RFC del proveedor (confidencial)" },
      { id: "edit_notes", label: "Editar notas", category: "actionable", icon: "📝", description: "Agregar o modificar notas adicionales" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar proveedores del sistema" },
    ]
  },
  Clientes: {
    label: "Clientes",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso a la lista de clientes" },
      { id: "create", label: "Crear", category: "actionable", icon: "➕", description: "Registrar nuevos clientes" },
      { id: "edit_name", label: "Editar nombre", category: "actionable", icon: "✏️", description: "Modificar nombre del cliente" },
      { id: "edit_business", label: "Editar negocio", category: "actionable", icon: "🏢", description: "Cambiar nombre y giro del negocio" },
      { id: "edit_contact", label: "Editar contacto", category: "actionable", icon: "📞", description: "Modificar teléfono y email" },
      { id: "edit_address", label: "Editar dirección", category: "actionable", icon: "📍", description: "Cambiar dirección de entrega" },
      { id: "edit_rfc", label: "Editar RFC", category: "actionable", icon: "📋", description: "Modificar RFC del cliente" },
      { id: "edit_notes", label: "Editar notas", category: "actionable", icon: "📝", description: "Agregar observaciones adicionales" },
      { id: "edit_status", label: "Cambiar estado", category: "actionable", icon: "✓", description: "Activar o desactivar cliente" },
      { id: "edit_force_wholesale", label: "Forzar mayoreo", category: "actionable", icon: "💲", description: "Aplicar precios mayoristas automáticamente" },
      { id: "edit_force_purchase", label: "Forzar precio compra", category: "actionable", icon: "💲", sensitive: true, description: "Aplicar precios de compra (confidencial)" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar clientes del sistema" },
    ]
  },
  Cursos: {
    label: "Cursos",
    actions: [
      { id: "view", label: "Ver cursos y calendario", category: "visual", icon: "👁️", description: "Acceso al catálogo de cursos y al calendario" },
      { id: "create", label: "Crear", category: "actionable", icon: "➕", description: "Crear nuevos cursos y talleres" },
      { id: "edit", label: "Editar", category: "actionable", icon: "✏️", description: "Modificar datos, sesiones, precios y estado del curso" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar cursos del sistema" },
    ]
  },
  Inscripciones: {
    label: "Inscripciones",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso a las inscripciones de cursos" },
      { id: "create", label: "Crear", category: "actionable", icon: "➕", description: "Inscribir contactos a cursos" },
      { id: "edit", label: "Editar", category: "actionable", icon: "✏️", description: "Cambiar estatus, pago y detalles de la inscripción" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar inscripciones" },
    ]
  },
  "Campañas": {
    label: "Campañas",
    actions: [
      { id: "view", label: "Ver campañas", category: "visual", icon: "👁️", description: "Acceso a campañas y avisos y su historial" },
      { id: "send", label: "Enviar", category: "actionable", icon: "📣", sensitive: true, description: "Enviar campañas/avisos por correo o WhatsApp a contactos e inscritos" },
    ]
  },
  Contactos: {
    label: "Contactos",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso a la lista de contactos" },
      { id: "create", label: "Crear", category: "actionable", icon: "➕", description: "Registrar nuevos contactos" },
      { id: "edit", label: "Editar", category: "actionable", icon: "✏️", description: "Modificar datos, etiquetas y estado del contacto" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar contactos del sistema" },
    ]
  },
  "Tipo de Pago": {
    label: "Tipo de Pago",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Ver métodos de pago configurados" },
      { id: "create", label: "Crear", category: "actionable", icon: "➕", description: "Crear nuevos métodos de pago" },
      { id: "edit_name", label: "Editar nombre", category: "actionable", icon: "✏️", description: "Cambiar nombre del método de pago" },
      { id: "edit_status", label: "Cambiar estado", category: "actionable", icon: "✓", description: "Activar o desactivar método de pago" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar métodos de pago" },
    ]
  },
  Movimientos: {
    label: "Movimientos",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso al registro de movimientos de inventario" },
      { id: "create", label: "Crear movimiento", category: "actionable", icon: "➕", description: "Crear nuevos movimientos de inventario" },
      { id: "entry", label: "Entrada de stock", category: "actionable", icon: "⬆️", description: "Registrar entrada de productos al almacén" },
      { id: "exit", label: "Salida de stock", category: "actionable", icon: "⬇️", description: "Registrar salida de productos del almacén" },
      { id: "return", label: "Devolución", category: "actionable", icon: "↩️", description: "Procesar devoluciones de productos" },
      { id: "adjustment", label: "Ajuste de inventario", category: "actionable", icon: "⚙️", description: "Realizar ajustes manuales de stock" },
      { id: "edit_quantity", label: "Editar cantidad", category: "actionable", icon: "📦", description: "Modificar cantidad del movimiento" },
      { id: "edit_reason", label: "Editar motivo", category: "actionable", icon: "📝", description: "Cambiar razón o cliente asociado" },
      { id: "edit_payment", label: "Editar forma pago", category: "actionable", icon: "💳", description: "Modificar método de pago" },
      { id: "confirm_payment", label: "Confirmar pago", category: "actionable", icon: "✓", description: "Marcar movimientos como pagados" },
      { id: "edit_status", label: "Cambiar estado pago", category: "actionable", icon: "⚙️", description: "Marcar como pagado o pendiente" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar movimientos del registro" },
    ]
  },
  Cotizaciones: {
    label: "Cotizaciones",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso al listado de cotizaciones" },
      { id: "create", label: "Crear", category: "actionable", icon: "➕", description: "Crear nuevas cotizaciones para clientes" },
      { id: "edit_items", label: "Editar productos", category: "actionable", icon: "📦", description: "Agregar, quitar o modificar productos" },
      { id: "edit_quantities", label: "Editar cantidades", category: "actionable", icon: "🔢", description: "Cambiar cantidades de productos" },
      { id: "edit_prices", label: "Editar precios", category: "actionable", icon: "💵", description: "Modificar precios unitarios" },
      { id: "edit_client", label: "Editar cliente", category: "actionable", icon: "👤", description: "Cambiar cliente de la cotización" },
      { id: "edit_notes", label: "Editar notas", category: "actionable", icon: "📝", description: "Agregar condiciones y observaciones" },
      { id: "edit_validity", label: "Editar vigencia", category: "actionable", icon: "📅", description: "Cambiar fecha de validez" },
      { id: "edit_payment_method", label: "Editar pago", category: "actionable", icon: "💳", description: "Modificar forma de pago" },
      { id: "confirm_payment", label: "Confirmar pago", category: "actionable", icon: "✓", description: "Marcar cotización como pagada" },
      { id: "revert_payment", label: "Revertir pago", category: "actionable", icon: "↩️", sensitive: true, description: "Revertir confirmación de pago en ventas concretadas (reabre el cobro sin anular la venta). Requiere admin en backend." },
      { id: "convert", label: "Convertir a venta", category: "actionable", icon: "✓", description: "Convertir cotización a venta confirmada" },
      { id: "cancel", label: "Cancelar", category: "actionable", icon: "❌", description: "Cancelar cotizaciones" },
      { id: "return", label: "Procesar devolución", category: "actionable", icon: "↩️", description: "Procesar devoluciones parciales de ventas" },
      { id: "send", label: "Enviar cotización", category: "actionable", icon: "📧", description: "Enviar cotizaciones por correo a clientes" },
      { id: "export", label: "Exportar PDF", category: "actionable", icon: "📄", description: "Exportar cotizaciones en formato PDF" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar cotizaciones" },
      { id: "share", label: "Compartir enlace público", category: "actionable", icon: "🔗", description: "Generar y gestionar enlace público de cotizaciones para clientes" },
      { id: "pricing", label: "Ver detalles precio", category: "report", icon: "💲", sensitive: true, description: "Ver cálculo detallado de precios (confidencial)" },
    ]
  },
  "Caja Chica": {
    label: "Caja Chica",
    actions: [
      { id: "view", label: "Ver saldo", category: "visual", icon: "👁️", description: "Ver saldo actual de caja chica" },
      { id: "view_history", label: "Ver historial", category: "visual", icon: "📋", description: "Acceso al historial completo de movimientos" },
      { id: "add_fund", label: "Agregar fondo", category: "actionable", icon: "➕", description: "Agregar fondos iniciales o adicionales a caja" },
      { id: "expense", label: "Registrar egreso", category: "actionable", icon: "➖", description: "Registrar gastos o egresos de caja chica" },
      { id: "income", label: "Registrar ingreso", category: "actionable", icon: "⬆️", description: "Registrar ingresos a caja chica" },
      { id: "edit_amount", label: "Editar monto", category: "actionable", icon: "💵", description: "Modificar cantidad del movimiento" },
      { id: "edit_description", label: "Editar descripción", category: "actionable", icon: "📝", description: "Cambiar descripción del movimiento" },
      { id: "edit_category", label: "Editar categoría", category: "actionable", icon: "🏷️", description: "Cambiar categoría del movimiento" },
      { id: "edit_date", label: "Editar fecha", category: "actionable", icon: "📅", description: "Modificar fecha del movimiento" },
      { id: "edit_notes", label: "Editar notas", category: "actionable", icon: "📋", description: "Agregar o cambiar notas adicionales" },
      { id: "delete", label: "Eliminar movimiento", category: "actionable", icon: "🗑️", description: "Eliminar movimientos de caja" },
    ]
  },
  "Pagos a Proveedores": {
    label: "Pagos a Proveedores",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso al registro de pagos a proveedores" },
      { id: "create", label: "Crear pago", category: "actionable", icon: "➕", description: "Registrar nuevos pagos a proveedores" },
      { id: "edit_supplier", label: "Editar proveedor", category: "actionable", icon: "🏢", description: "Cambiar proveedor del pago" },
      { id: "edit_amount", label: "Editar monto", category: "actionable", icon: "💵", description: "Modificar cantidad pagada" },
      { id: "edit_date", label: "Editar fecha", category: "actionable", icon: "📅", description: "Cambiar fecha del pago" },
      { id: "edit_payment_method", label: "Editar forma pago", category: "actionable", icon: "💳", description: "Cambiar método de pago" },
      { id: "edit_concept", label: "Editar concepto", category: "actionable", icon: "📝", description: "Modificar descripción del pago" },
      { id: "edit_reference", label: "Editar referencia", category: "actionable", icon: "🔗", description: "Cambiar número de transacción/recibo" },
      { id: "edit_notes", label: "Editar notas", category: "actionable", icon: "📋", description: "Agregar observaciones adicionales" },
      { id: "affect_petty_cash", label: "Afectar caja chica", category: "actionable", icon: "💰", description: "Registrar egreso automático en caja" },
      { id: "delete", label: "Eliminar", category: "actionable", icon: "🗑️", description: "Eliminar registro de pagos" },
    ]
  },
  Reportes: {
    label: "Reportes",
    actions: [
      { id: "view", label: "Ver reportes", category: "visual", icon: "👁️", description: "Acceso a visualización de reportes" },
      { id: "operational", label: "Ver operacionales", category: "report", icon: "📊", description: "Reportes de operaciones, inventario y ventas" },
      { id: "supplier", label: "Ver pagos proveedores", category: "report", icon: "🏢", description: "Reportes de pagos a proveedores" },
      { id: "predictive", label: "Ver predictivos", category: "report", icon: "🔮", description: "Análisis predictivo y tendencias" },
      { id: "cost_view", label: "Ver costos", category: "report", icon: "💲", sensitive: true, description: "Acceso a reportes con información de costos (confidencial)" },
      { id: "profit_margin", label: "Ver márgenes", category: "report", icon: "📈", sensitive: true, description: "Ver cálculos de rentabilidad y márgenes (confidencial)" },
      { id: "export", label: "Exportar datos", category: "report", icon: "📥", description: "Exportar reportes y datos en Excel/CSV" },
    ]
  },
  Configuracion: {
    label: "Configuración",
    actions: [
      { id: "view", label: "Ver configuración", category: "visual", icon: "⚙️", description: "Acceso a configuración general del sistema" },
      { id: "edit_company_name", label: "Editar nombre empresa", category: "actionable", icon: "🏢", description: "Cambiar nombre y razón social" },
      { id: "edit_company_rfc", label: "Editar RFC", category: "actionable", icon: "📋", description: "Modificar RFC de la empresa" },
      { id: "edit_company_contact", label: "Editar contacto", category: "actionable", icon: "📞", description: "Cambiar teléfono y dirección" },
      { id: "edit_logo", label: "Cambiar logo", category: "actionable", icon: "🖼️", description: "Actualizar logotipo de la empresa" },
      { id: "edit_colors", label: "Editar colores", category: "actionable", icon: "🎨", description: "Personalizar colores de la app" },
      { id: "edit_tax_rate", label: "Editar IVA", category: "actionable", icon: "📊", description: "Cambiar tasa de impuesto" },
      { id: "edit_currency", label: "Editar moneda", category: "actionable", icon: "💱", description: "Cambiar moneda de operación" },
      { id: "edit_quotation_footer", label: "Editar pie cotizaciones", category: "actionable", icon: "📄", description: "Personalizar texto al pie de cotizaciones" },
      { id: "import_products", label: "Importar productos", category: "actionable", icon: "📥", description: "Importar catálogo de productos desde archivo" },
      { id: "manage_team", label: "Gestionar equipo", category: "actionable", icon: "👥", description: "Invitar y gestionar miembros del equipo" },
      { id: "manage_referral", label: "Gestionar referidos", category: "actionable", icon: "🎁", description: "Ver código de referido, estadísticas y gestionar el programa de referidos" },
      { id: "delete_account", label: "Eliminar cuenta", category: "actionable", icon: "🗑️", description: "Eliminar cuenta del sistema (irreversible)" },
    ]
  },
  Utilidad: {
    label: "Utilidad",
    actions: [
      { id: "view", label: "Ver Estado de Resultados", category: "report", icon: "📊", sensitive: true, description: "Ver Estado de Resultados, retiros de utilidad y proyección de fin de mes (confidencial)" },
      { id: "add_withdrawal", label: "Registrar Retiro de Utilidad", category: "actionable", icon: "💸", description: "Registrar un retiro de utilidad del negocio" },
      { id: "manage_forecast", label: "Gestionar proyección", category: "actionable", icon: "📈", sensitive: true, description: "Activar/desactivar la proyección de utilidad a fin de mes (confidencial)" },
    ]
  },
  Rubros: {
    label: "Rubros",
    actions: [
      { id: "view", label: "Ver lista de rubros", category: "visual", icon: "🏷️", description: "Ver categorías de ingresos y egresos de caja" },
      { id: "create", label: "Crear rubro", category: "actionable", icon: "➕", description: "Crear nuevas categorías de ingresos o egresos" },
      { id: "edit", label: "Editar rubro", category: "actionable", icon: "✏️", description: "Modificar nombre, tipo y tratamiento contable de rubros" },
      { id: "delete", label: "Eliminar rubro", category: "actionable", icon: "🗑️", description: "Eliminar categorías de ingresos o egresos" },
    ]
  },
  CuentasFondo: {
    label: "Cuentas de Fondos",
    actions: [
      { id: "view", label: "Ver lista", category: "visual", icon: "👁️", description: "Acceso a la lista de cuentas de fondos (efectivo, tarjetas, etc.)" },
      { id: "create", label: "Crear cuenta", category: "actionable", icon: "➕", description: "Crear nuevas cuentas de fondos" },
      { id: "edit", label: "Editar cuenta", category: "actionable", icon: "✏️", description: "Editar nombre, estado activo y si afecta caja chica" },
      { id: "delete", label: "Eliminar cuenta", category: "actionable", icon: "🗑️", description: "Eliminar cuentas de fondos" },
    ]
  },
};

export const ALL_PERMISSION_KEYS = Object.entries(PERMISSION_REGISTRY)
  .flatMap(([module, def]) => def.actions.map(a => `${module}:${a.id}`));

export function getDefaultsForRole(role) {
  if (role === 'admin') {
    return ALL_PERMISSION_KEYS.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
  }

  if (role === 'almacenista') {
    const defaults = {};
    for (const [module, def] of Object.entries(PERMISSION_REGISTRY)) {
      for (const action of def.actions) {
        const key = `${module}:${action.id}`;
        if (action.sensitive) {
          defaults[key] = false;
        } else if (action.category === 'visual') {
          // Visual non-sensitive: most granted, except financial ones
          const financialVisual = [
            'Dashboard:stat_total_value',
            'Dashboard:supplier_payments_section',
            'Dashboard:financial',
          ];
          defaults[key] = !financialVisual.includes(key);
        } else if (action.category === 'actionable') {
          // Actionable: conservative on sensitive ops
          const deniedActionable = [
            'Dashboard:*',
            'Productos:edit_stock_quantity',
            'Productos:import',
            'Caja Chica:add_fund',
            'Caja Chica:delete',
            'Movimientos:adjustment',
            'Pagos a Proveedores:view',
            'Pagos a Proveedores:create',
            'Pagos a Proveedores:edit_supplier',
            'Pagos a Proveedores:edit_amount',
            'Pagos a Proveedores:edit_date',
            'Pagos a Proveedores:edit_payment_method',
            'Pagos a Proveedores:edit_concept',
            'Pagos a Proveedores:edit_reference',
            'Pagos a Proveedores:edit_notes',
            'Pagos a Proveedores:affect_petty_cash',
            'Pagos a Proveedores:delete',
            'Configuracion:view',
            'Configuracion:edit_company_name',
            'Configuracion:edit_company_rfc',
            'Configuracion:edit_company_contact',
            'Configuracion:edit_logo',
            'Configuracion:edit_colors',
            'Configuracion:edit_tax_rate',
            'Configuracion:edit_currency',
            'Configuracion:edit_quotation_footer',
            'Configuracion:import_products',
            'Configuracion:manage_team',
            'Configuracion:delete_account',
            'Clientes:edit_force_wholesale',
            'Clientes:edit_force_purchase',
            'Utilidad:add_withdrawal',
            'CuentasFondo:create',
            'CuentasFondo:edit',
            'CuentasFondo:delete',
          ];
          defaults[key] = !deniedActionable.includes(key);
        } else if (action.category === 'report') {
          // Reports: deny financial ones for almacenista
          const deniedReports = [
            'Dashboard:sales_cost',
            'Dashboard:sales_actual_profit',
            'Dashboard:sales_net_profit',
            'Dashboard:financial',
            'Dashboard:unpaid_detail',
            'Productos:cost_price',
            'Cotizaciones:pricing',
            'Reportes:view',
            'Reportes:operational',
            'Reportes:supplier',
            'Reportes:predictive',
            'Reportes:cost_view',
            'Reportes:profit_margin',
            'Reportes:export',
          ];
          defaults[key] = !deniedReports.includes(key);
        } else {
          defaults[key] = false;
        }
      }
    }
    return defaults;
  }

  return {};
}

export function getActionsByCategory(moduleName, category) {
  const module = PERMISSION_REGISTRY[moduleName];
  if (!module) return [];
  return module.actions.filter(a => a.category === category);
}