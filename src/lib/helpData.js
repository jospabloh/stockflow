export const localHelpData = {
  version: "1.0",
  last_updated: "2026-03-16",
  articles: [
    // ─── PRIMEROS PASOS ───
    {
      id: "roles-overview",
      category: "Primeros Pasos",
      role: "all",
      title: "Entendiendo los Roles del Sistema",
      keywords: ["roles", "permisos", "administrador", "almacenista", "acceso", "usuario", "rol"],
      related_ids: ["welcome-admin", "welcome-almacenista"],
      content: `## Roles en StockFlow

StockFlow maneja **dos roles** principales que determinan qué puede ver y hacer cada usuario:

### 👑 Administrador
Acceso **total y sin restricciones**. Ve y controla todo: productos, movimientos, cotizaciones, reportes financieros (costos, ganancias, márgenes) y la configuración completa del negocio.

### 📦 Almacenista
Acceso **operativo completo**. Puede gestionar inventario, productos, cotizaciones y clientes. La única restricción es que **no ve información de ganancias ni precios de compra** — pero sí puede ver las ventas para dar seguimiento a los pedidos.

> 💡 **¿Cómo cambiar el rol de un usuario?** Desde el Panel de Administración de Base44 → Users. El código de invitación del negocio se encuentra en Configuración → Equipo.`
    },
    {
      id: "welcome-admin",
      category: "Primeros Pasos",
      role: "admin",
      title: "Bienvenido, Administrador",
      keywords: ["bienvenida", "inicio", "admin", "administrador", "comenzar", "empezar"],
      related_ids: ["dashboard-admin", "roles-overview", "settings-business"],
      content: `## Guía de Inicio para Administradores

Como **Administrador** en StockFlow tienes **control total** sobre el negocio. Aquí está tu flujo de trabajo recomendado al iniciar:

### ✅ Lista de verificación inicial

1. **Configura tu negocio** → Ve a *Configuración → Mi Negocio* y completa: nombre, RFC, logo y tasa de IVA.
2. **Crea categorías** → *Configuración → Categorías* para organizar tu catálogo.
3. **Agrega proveedores** → *Configuración → Proveedores* para vincularlos a productos.
4. **Importa o crea productos** → *Productos → + Nuevo Producto* o usa *Configuración → Importar*.
5. **Invita a tu equipo** → Comparte el código en *Configuración → Equipo*.

### 🔑 Lo que solo tú puedes hacer
- Ver **precios de compra** y **márgenes de ganancia**
- Acceder a reportes de **Mejor Margen** y **Valor por Categoría**
- Gestionar la **configuración** completa del negocio
- **Eliminar** productos, movimientos y categorías`
    },
    {
      id: "welcome-almacenista",
      category: "Primeros Pasos",
      role: "almacenista",
      title: "Bienvenido, Almacenista",
      keywords: ["bienvenida", "inicio", "almacenista", "comenzar", "empezar", "vendedor"],
      related_ids: ["dashboard-almacenista", "roles-overview", "movements-register"],
      content: `## Guía de Inicio para Almacenistas

Como **Almacenista** en StockFlow, eres responsable de las operaciones diarias: inventario, ventas y atención al cliente. Tu flujo de trabajo habitual será:

### 📋 Operaciones del Día a Día

1. **Revisar el Dashboard** → Verifica alertas de stock bajo y movimientos recientes.
2. **Registrar entradas** → Cuando llegue mercancía, crea un movimiento de tipo *Entrada*.
3. **Gestionar cotizaciones** → Crea cotizaciones para clientes, conviértelas en venta y da seguimiento.
4. **Actualizar clientes** → Mantén el directorio actualizado con datos correctos.
5. **Revisar reportes** → Consulta los reportes de ventas y productos más vendidos.

### ✅ Lo que puedes hacer
- **Crear y editar** productos, cotizaciones y clientes
- **Registrar** entradas, salidas, devoluciones y ajustes de inventario
- **Convertir** cotizaciones en ventas y hacer seguimiento de entrega/pago
- **Cancelar** cotizaciones (requiere justificación escrita)
- **Ver reportes** operativos de ventas y movimientos

### ❌ Lo que NO verás
- Precios de compra ni márgenes de ganancia
- Reportes de *Mejor Margen* y *Valor por Categoría*
- La sección de *Configuración* (es exclusiva del Administrador)`
    },

    // ─── DASHBOARD ───
    {
      id: "dashboard-admin",
      category: "Dashboard",
      role: "admin",
      title: "Dashboard — Vista del Administrador",
      keywords: ["dashboard", "panel", "inicio", "métricas", "ventas", "ganancia", "estadísticas", "kpi"],
      related_ids: ["reports-admin", "products-inventory", "dashboard-almacenista"],
      content: `## Dashboard para Administradores

El Dashboard te da una visión **financiera y operativa completa** del negocio.

### 📊 Tarjetas de Métricas (fila superior)

| Tarjeta | Qué muestra |
|---|---|
| **Productos Activos** | Conteo de productos + total de unidades en stock |
| **Valor Total** | Valor del inventario calculado al **precio de compra** |
| **Movimientos Hoy** | Número de entradas y salidas registradas hoy |
| **Stock Bajo** | Productos por debajo de su stock mínimo |

### 💰 Ventas del Día
Muestra el desglose completo de las salidas de inventario del día:
- **Monto vendido** — suma de precios de venta
- **Costo de lo vendido** — suma de precios de compra *(solo Admin)*
- **Ganancia bruta** — diferencia + porcentaje de margen *(solo Admin)*

### 🚦 Semáforo de Cotizaciones
Resumen visual del estado de todas las cotizaciones: concretadas (verde), activas (ámbar) y canceladas (rojo). Haz clic en cualquier indicador para ir al módulo de Cotizaciones.

### 📈 Gráfica de Movimientos
Barras comparativas de entradas vs salidas por día en los últimos 7 días.`
    },
    {
      id: "dashboard-almacenista",
      category: "Dashboard",
      role: "almacenista",
      title: "Dashboard — Vista del Almacenista",
      keywords: ["dashboard", "panel", "inicio", "métricas", "movimientos", "stock", "alertas"],
      related_ids: ["movements-overview", "products-inventory", "dashboard-admin"],
      content: `## Dashboard para Almacenistas

El Dashboard te muestra el **estado operativo** del inventario y las ventas activas.

### 📊 Tarjetas de Métricas que verás

| Tarjeta | Qué muestra |
|---|---|
| **Productos Activos** | Conteo de productos + total de unidades en stock |
| **Movimientos Hoy** | Número de entradas y salidas registradas hoy |
| **Stock Bajo** | Productos por debajo de su stock mínimo |

> 🔒 La tarjeta de **Valor Total del Inventario** no está disponible para tu rol, ya que requiere datos de precios de compra.

### 💼 Ventas del Día
Verás el **Monto vendido** del día (suma de precios de venta de las salidas). No verás el costo ni la ganancia — esos son datos financieros del Administrador.

### 🚦 Semáforo de Cotizaciones
Muestra cuántas cotizaciones están concretadas, activas o canceladas. Muy útil para saber cuántos pedidos tienes en proceso.

### 🔔 Alertas de Stock Bajo
Revisa esta sección diariamente — te indica qué productos necesitan reabastecerse. Haz clic en "Ver todos" para ir directamente a la lista filtrada.`
    },

    // ─── PRODUCTOS ───
    {
      id: "products-create",
      category: "Productos",
      role: "all",
      title: "Cómo Crear y Editar Productos",
      keywords: ["producto", "crear", "nuevo", "editar", "sku", "barcode", "código de barras", "precio", "categoría"],
      related_ids: ["products-admin-exclusive", "products-inventory", "movements-register"],
      content: `## Crear y Editar Productos

Ambos roles pueden crear y editar productos. Para crear uno nuevo, ve a **Productos → + Nuevo Producto**.

### 📝 Campos del Formulario

**Datos Generales:**
- **Nombre** *(requerido)* — nombre comercial del producto
- **SKU** — código interno; puedes generarlo automáticamente o escribir uno manualmente
- **Código de barras** — escanea con la cámara del dispositivo o escríbelo manualmente
- **Descripción** — información adicional del producto
- **Categoría** — selecciona de las categorías creadas en Configuración
- **Proveedor** — proveedor vinculado al producto

**Precios e Inventario:**
- **Precio de Venta** *(requerido)* — lo que paga el cliente
- **Tasa de IVA** — 0% o 16%
- **Stock inicial** — existencias al momento de creación
- **Stock mínimo** — umbral para activar alertas de stock bajo
- **Unidad de medida** — pieza, kg, litro, metro, caja, paquete

> 💡 Al guardar un producto con stock inicial mayor a cero, el sistema crea automáticamente un movimiento de tipo **Entrada** en el historial.

### ✏️ Editar un Producto
Haz clic en el ícono de lápiz en la tabla de productos. Todos los campos son modificables.`
    },
    {
      id: "products-admin-exclusive",
      category: "Productos",
      role: "admin",
      title: "Funciones Exclusivas de Productos (Admin)",
      keywords: ["precio compra", "costo", "eliminar producto", "margen", "admin", "exclusivo"],
      related_ids: ["products-create", "reports-admin"],
      content: `## Funciones de Productos Exclusivas para Administradores

### 💰 Precio de Compra
Como Administrador, verás el campo **Precio de Compra** en el formulario de productos. Este campo es fundamental para:
- Calcular la **ganancia bruta** en el Dashboard
- Generar el reporte de **Mejor Margen**
- Calcular el **Valor Total del Inventario**

> ⚠️ El Almacenista no puede ver ni editar el precio de compra. Asegúrate de configurarlo correctamente al crear cada producto.

### 🗑️ Eliminar Productos
Solo el Administrador puede eliminar productos. Para hacerlo:
1. Busca el producto en la tabla
2. Haz clic en el ícono de eliminar
3. Confirma la acción

**Protección importante:** Si el producto tiene movimientos de inventario registrados (entradas, salidas, etc.), el sistema **bloqueará la eliminación** para proteger la integridad del historial. En ese caso, se recomienda marcar el producto como *Inactivo* en lugar de eliminarlo.

### 📥 Importación Masiva
Ve a **Configuración → Importar Productos** para cargar un CSV o Excel con múltiples productos al mismo tiempo.`
    },
    {
      id: "products-inventory",
      category: "Productos",
      role: "all",
      title: "Control de Stock y Alertas de Inventario",
      keywords: ["stock", "inventario", "alerta", "mínimo", "bajo", "existencias", "agotado"],
      related_ids: ["movements-register", "products-create", "dashboard-admin"],
      content: `## Control de Stock y Alertas

### 📦 Cómo Funciona el Stock
El stock de cada producto se actualiza automáticamente con cada movimiento registrado:
- **Entrada** → suma al stock
- **Salida** → resta del stock
- **Devolución** → suma al stock
- **Ajuste** → puede sumar o restar según la diferencia

### 🔴 Alerta de Stock Bajo
Cuando el stock de un producto cae **por debajo o igual al stock mínimo** definido, aparece:
- Una alerta en el **Dashboard** (tarjeta "Stock Bajo" y sección de alertas)
- Un indicador en el **menú lateral** del sistema
- El producto se resalta en la tabla de **Productos**

### 🔍 Filtrar Productos con Stock Bajo
En la página de Productos, usa el filtro **"Stock bajo"** para ver únicamente los productos que necesitan reabastecimiento.

> 💡 **Recomendación:** Define un stock mínimo realista para cada producto. Por ejemplo, si tarda 3 días en llegar del proveedor y vendes 5 unidades por día, configura el mínimo en **15 unidades**.`
    },

    // ─── MOVIMIENTOS ───
    {
      id: "movements-overview",
      category: "Movimientos",
      role: "all",
      title: "Tipos de Movimientos de Inventario",
      keywords: ["movimiento", "entrada", "salida", "devolución", "ajuste", "inventario", "historial"],
      related_ids: ["movements-register", "products-inventory"],
      content: `## Tipos de Movimientos en StockFlow

Los movimientos son el **registro histórico** de cada cambio en tu inventario. Hay 4 tipos:

### ⬇️ Entrada (Verde)
Registra la **recepción de mercancía** de un proveedor u otra fuente.
- Aumenta el stock del producto
- Usa el **precio de compra** como referencia
- Ejemplo: "Compra a proveedor XYZ — Factura #1234"

### ⬆️ Salida (Rojo)
Registra el **despacho de productos** (ventas directas sin cotización, consumo interno, etc.).
- Reduce el stock del producto
- Usa el **precio de venta** como referencia
- Ejemplo: "Venta directa en mostrador"

> ⚠️ Las salidas por cotizaciones convertidas se registran **automáticamente** — no necesitas crearlas manualmente.

### 🔄 Devolución (Azul)
Registra el **reingreso de productos** al inventario.
- Aumenta el stock
- Ejemplo: "Devolución del cliente — mal estado"

### ⚡ Ajuste (Naranja)
Correcciones manuales de stock por conteo físico o errores.
- Puede aumentar o reducir el stock
- Siempre requiere un motivo documentado`
    },
    {
      id: "movements-register",
      category: "Movimientos",
      role: "all",
      title: "Cómo Registrar un Movimiento",
      keywords: ["registrar", "crear movimiento", "entrada", "salida", "escanear", "código de barras", "cantidad"],
      related_ids: ["movements-overview", "products-inventory", "quotations-convert"],
      content: `## Registrar un Nuevo Movimiento

Ve a **Movimientos → + Nuevo Movimiento** para abrir el formulario.

### 📋 Pasos para Registrar

1. **Selecciona el producto:**
   - Escanea el código de barras con un escáner físico (detección automática) o con la cámara
   - O busca el producto escribiendo su nombre o SKU

2. **Elige el tipo de movimiento:** Entrada, Salida, Devolución o Ajuste

3. **Ingresa la cantidad:**
   - Para **salidas**, el sistema verifica que haya stock suficiente
   - Si la cantidad supera el stock disponible, recibirás una **advertencia**

4. **Precio unitario:** Se autocompleta según el tipo (compra para entradas, venta para salidas). Puedes modificarlo si es necesario.

5. **Motivo y Referencia:** Describe el motivo y agrega un número de referencia (factura, orden, etc.)

6. **Guardar:** El stock del producto se actualiza **instantáneamente**.

### 📅 Filtrar el Historial
Usa los filtros de **fecha** (Desde / Hasta) en la página de Movimientos para ver el historial de un período específico. También puedes **exportar a CSV**.`
    },

    // ─── COTIZACIONES ───
    {
      id: "quotations-create",
      category: "Cotizaciones",
      role: "all",
      title: "Crear y Editar Cotizaciones",
      keywords: ["cotización", "crear", "nueva cotización", "cliente", "productos", "precio", "folio", "iva", "total"],
      related_ids: ["quotations-states", "quotations-convert", "quotations-cancel"],
      content: `## Crear y Editar Cotizaciones

Ve a **Cotizaciones → + Nueva Cotización** para iniciar una nueva propuesta comercial.

### 👤 Información del Cliente
- Selecciona un cliente del directorio o escribe el nombre directamente
- Si el cliente existe, sus datos de contacto se autocompletan
- Puedes añadir email y teléfono manualmente si es necesario

### 🛒 Agregar Productos
- **Por código de barras:** Usa un escáner físico o escribe el código manualmente
- **Por búsqueda:** Escribe el nombre o SKU del producto
- El sistema valida el **stock disponible** en tiempo real

Para cada producto puedes ajustar:
- **Cantidad** — el sistema alerta si supera el stock disponible
- **Precio unitario** — se toma del catálogo pero es editable

### 💰 Cálculo Automático
- **Subtotal** — suma sin IVA
- **IVA** — calculado según la tasa de cada producto (0% o 16%)
- **Total** — subtotal + IVA

### 📝 Otros Campos
- **Notas** — condiciones especiales, observaciones para el cliente
- **Vigencia** — fecha límite de validez de la cotización
- **Forma de pago** — efectivo, transferencia, tarjeta, etc.

### 📄 Folio Automático
El sistema genera un folio único con formato **COT-AAAMMDD-NNN** (ej: COT-260316-001).`
    },
    {
      id: "quotations-states",
      category: "Cotizaciones",
      role: "all",
      title: "Estados de una Cotización",
      keywords: ["estado", "borrador", "enviada", "aceptada", "concretada", "cancelada", "vencida", "status"],
      related_ids: ["quotations-create", "quotations-convert", "quotations-cancel"],
      content: `## Estados de una Cotización

Cada cotización pasa por diferentes etapas a lo largo de su ciclo de vida:

### 🟡 Borrador
La cotización está en elaboración y aún no ha sido enviada al cliente. Puedes editarla libremente.

### 🟡 Enviada
La cotización fue compartida con el cliente, quien está evaluándola.

### 🟡 Aceptada
El cliente confirmó su interés. Puedes proceder a convertirla en venta.

### 🟢 Concretada (Venta)
La cotización fue convertida en una venta real. El stock de los productos fue **descontado automáticamente**. Desde aquí puedes gestionar la entrega y el pago.

### 🔴 Cancelada
La cotización fue anulada. Siempre requiere una **razón de cancelación** por escrito. Si la cotización ya estaba concretada y se anula, el stock **se revierte automáticamente**.

### 🔴 Vencida *(detección automática)*
La fecha de vigencia ha pasado sin que la cotización se haya concretado. **No puede convertirse en venta** en este estado.

> 💡 El flujo normal es: Borrador → Enviada → Aceptada → Concretada → Entregada → Pagada`
    },
    {
      id: "quotations-convert",
      category: "Cotizaciones",
      role: "all",
      title: "Convertir en Venta y Seguimiento de Pedido",
      keywords: ["convertir", "venta", "pago", "entrega", "ruta", "cobrar", "seguimiento", "factura"],
      related_ids: ["quotations-states", "quotations-cancel", "quotations-create"],
      content: `## Convertir una Cotización en Venta

### ▶️ Proceso de Conversión
1. Abre el menú de acciones (⋯) de la cotización
2. Selecciona **"Convertir en Venta"**
3. Elige o escribe la **forma de pago** (Efectivo, Transferencia, Tarjeta, etc.)
4. Confirma — el stock se descuenta automáticamente

> ⚠️ Si una cotización está **vencida**, no podrás convertirla. Edítala y actualiza la fecha de vigencia primero.

### 📦 Seguimiento del Pedido
Una vez concretada, aparece una columna de **Seguimiento** con tres botones:

- **🚚 En Ruta** — el pedido salió para entrega al cliente
- **✅ Entregado** — el cliente recibió el pedido *(al marcar, se te pide confirmar el pago)*
- **💲 Pago** — confirma que el pago fue recibido con el método definitivo

### 🧾 Estado de Factura
Para cada cotización puedes registrar el estado de facturación:
- **Pendiente** — aún no se emite factura
- **Emitida** — factura generada y entregada al cliente
- **No Requerida** — el cliente no necesita factura

### 📄 Descargar PDF
Disponible en cualquier estado. Genera un documento profesional con el logo de tu negocio.`
    },
    {
      id: "quotations-cancel",
      category: "Cotizaciones",
      role: "all",
      title: "Cancelar o Anular una Cotización",
      keywords: ["cancelar", "anular", "cancelación", "razón", "motivo", "revertir", "stock", "devolución"],
      related_ids: ["quotations-states", "quotations-convert"],
      content: `## Cancelar o Anular una Cotización

### ❌ Cancelar una Cotización (no concretada)
Si la cotización aún no ha sido convertida en venta:
1. Menú de acciones (⋯) → **"Cancelar Cotización"**
2. Escribe el **motivo de cancelación** (campo obligatorio)
3. Confirma — la cotización queda en estado *Cancelada*

### 🔴 Anular una Venta (ya concretada)
Si la cotización ya fue convertida en venta:
1. Menú de acciones (⋯) → **"Anular Venta"**
2. Escribe la **razón de anulación** (campo obligatorio)
3. Confirma — StockFlow **revierte automáticamente el stock** de todos los productos

> ⚠️ **Importante:** La anulación de ventas es una operación seria. Al anular:
> - Se registran movimientos de **Devolución** por cada producto
> - El stock regresa a los niveles previos a la venta
> - La cotización queda marcada como *Cancelada* con la razón registrada

### 💡 Cuándo usar cada opción
- **Cancelar** → El cliente no quiere el pedido, hubo un error en la cotización
- **Anular venta** → La entrega no se realizó, hubo un error en la conversión`
    },

    // ─── REPORTES ───
    {
      id: "reports-all",
      category: "Reportes",
      role: "all",
      title: "Reportes Disponibles para Todos",
      keywords: ["reporte", "informe", "análisis", "ventas", "movimientos", "tendencia", "rotación", "csv", "exportar"],
      related_ids: ["reports-admin", "quotations-states"],
      content: `## Reportes Disponibles para Todos los Roles

La sección de **Reportes** cuenta con un filtro de fechas global (Desde / Hasta) que aplica a todos los gráficos y tablas.

### 📑 Cotizaciones/Ventas
Análisis de las cotizaciones **convertidas en venta** en el período.
- **Filtros adicionales:** por cliente y forma de pago
- **Tarjetas resumen:** Total Ventas, Monto Cobrado, Pendiente de Pago
- **Tabla detallada** con folio, cliente, fecha, total, estado de entrega y pago
- Exportar a **CSV**

### 🏆 Más Vendidos
Gráfico de barras horizontal con los **10 productos con más salidas** en el período.
- Muestra la cantidad vendida por producto
- Útil para identificar qué productos impulsar o reponer con prioridad
- Exportar a **CSV**

### 🐢 Baja Rotación
Los **10 productos con menos salidas** en el período, con su stock actual.
- Detecta productos obsoletos o de lenta rotación
- Exportar a **CSV**

### 📈 Tendencia
Gráfico de líneas con la evolución diaria de **entradas y salidas** de inventario.
- Identifica picos de actividad y tendencias semanales`
    },
    {
      id: "reports-admin",
      category: "Reportes",
      role: "admin",
      title: "Reportes Exclusivos para Administradores",
      keywords: ["margen", "ganancia", "costo", "categoría", "valor inventario", "rentabilidad", "reporte admin"],
      related_ids: ["reports-all", "products-admin-exclusive"],
      content: `## Reportes Exclusivos para Administradores

Además de los reportes disponibles para todos, tienes acceso a dos análisis financieros avanzados:

### 💰 Mejor Margen
Los **10 productos con mayor porcentaje de margen de ganancia** en tu catálogo.

**Cálculo:** \`((Precio Venta − Precio Compra) / Precio Compra) × 100\`

> Ejemplo: Producto A con costo $50 y precio de venta $95 → margen del **90%**

Útil para:
- Decidir qué productos promover prioritariamente
- Comparar rentabilidad entre categorías
- Identificar productos con margen insuficiente

Exportar a **CSV**

---

### 🥧 Por Categoría (Valor del Stock)
Gráfico circular *(donut)* que muestra cómo está distribuido el **valor de tu inventario** por categoría.

**Cálculo:** \`Stock × Precio de Compra\` agrupado por categoría

> Ejemplo: "Electrónica" = $45,000 en inventario | "Herramientas" = $12,000

Útil para:
- Saber dónde está concentrado tu capital
- Tomar decisiones de compra basadas en inversión real
- Identificar categorías sobreinventariadas

---

### 📊 Resumen Financiero (barra superior de Reportes)
En la barra de filtros de fechas también verás:
- **Ventas totales** del período (precio de venta)
- **Compras totales** del período (precio de compra)`
    },

    // ─── CONFIGURACIÓN ───
    {
      id: "settings-business",
      category: "Configuración",
      role: "admin",
      title: "Configuración del Negocio",
      keywords: ["configuración", "negocio", "rfc", "logo", "iva", "moneda", "dirección", "teléfono", "pie de página"],
      related_ids: ["settings-clients", "settings-team", "settings-categories"],
      content: `## Configuración del Negocio

> 🔒 Esta sección es **exclusiva para Administradores**.

Ve a **Configuración → Mi Negocio** para personalizar los datos de tu empresa.

### 🏢 Información General
- **Nombre del negocio** — aparece en cotizaciones PDF
- **RFC** — requerido para documentos fiscalmente válidos
- **Teléfono y Dirección** — datos de contacto del negocio
- **Logo** — se muestra en los PDFs de cotizaciones (sube una imagen)

### 💰 Configuración Financiera
- **Tasa de IVA** — porcentaje predeterminado (ej: 16%)
- **Moneda** — MXN por defecto, personalizable

### 📧 Comunicaciones
- **Email para alertas de stock** — recibe notificaciones cuando un producto cae por debajo del mínimo
- **Pie de cotizaciones** — texto de condiciones que aparece al final de cada PDF (vigencia, políticas, etc.)

### 🎨 Identidad Visual
- **Color primario** — personaliza el color principal de la aplicación

> 💡 **Importante:** Completa el RFC para que tus cotizaciones sean fiscalmente correctas. Si no está configurado, verás una advertencia en amarillo en el Dashboard.`
    },
    {
      id: "settings-clients",
      category: "Configuración",
      role: "admin",
      title: "Gestión de Clientes",
      keywords: ["clientes", "cliente", "rfc cliente", "directorio", "eliminar cliente", "editar cliente"],
      related_ids: ["settings-business", "quotations-create"],
      content: `## Gestión de Clientes

Ve a **Configuración → Clientes** para administrar el directorio de clientes.

### ➕ Crear un Cliente
Campos disponibles:
- **Nombre** *(requerido)*
- **Email** y **Teléfono**
- **Dirección**
- **RFC** — para facturación del cliente
- **Notas** — observaciones internas
- **Estado** — Activo o Inactivo

### ✏️ Editar
Haz clic en el ícono de lápiz para modificar los datos de cualquier cliente.

### 🗑️ Eliminar
Solo puedes eliminar un cliente si **no tiene cotizaciones asociadas**. Si tiene historial de ventas, el sistema bloqueará la eliminación para proteger la integridad de los registros.

> 💡 En lugar de eliminar un cliente con historial, cambia su estado a **Inactivo**. Así no aparecerá en las listas de selección pero conservará su historial.

### 🔍 Búsqueda Rápida
La barra de búsqueda filtra el listado en tiempo real por nombre o correo electrónico.`
    },
    {
      id: "settings-team",
      category: "Configuración",
      role: "admin",
      title: "Equipo y Acceso — Invitar Usuarios",
      keywords: ["equipo", "invitar", "usuario", "código", "acceso", "rol", "almacenista", "administrador"],
      related_ids: ["roles-overview", "settings-business"],
      content: `## Equipo y Acceso

Ve a **Configuración → Equipo** para gestionar el acceso de tu personal.

### 🔑 Código de Invitación
Tu negocio tiene un **código único** (ej: \`AB12CD\`) que debes compartir con cada nuevo usuario que se una a tu equipo.

**Cómo funciona:**
1. El nuevo usuario descarga la app y se registra
2. Selecciona la opción **"Unirme a un equipo"**
3. Ingresa el código de invitación
4. Queda vinculado a tu negocio

Haz clic en el botón 📋 para copiar el código al portapapeles.

### 👥 Asignación de Roles
Los roles disponibles son:
- **admin** — Administrador con acceso total
- **almacenista** — Operaciones de inventario y ventas

> 💡 Para **cambiar el rol** de un usuario existente, ve al **Panel de Administración de Base44** (dashboard → Users). Desde la app solo puedes ver los roles, no modificarlos directamente.

### 🔐 Buenas Prácticas
- Asigna **admin** solo a personas de confianza con acceso a información financiera
- Los almacenistas pueden gestionar todo lo operativo sin ver datos de costo/ganancia`
    },
    {
      id: "settings-categories",
      category: "Configuración",
      role: "admin",
      title: "Categorías y Proveedores",
      keywords: ["categoría", "proveedor", "clasificar", "organizar", "color", "catálogo"],
      related_ids: ["products-create", "settings-business"],
      content: `## Categorías y Proveedores

### 🎨 Categorías (Configuración → Categorías)
Organiza tu catálogo agrupando productos por tipo.

**Crear una categoría:**
- **Nombre** *(requerido)*
- **Descripción** — explicación breve
- **Color** — color visual representativo (hex) que se muestra en la app

**Eliminar categorías:**
Solo puedes eliminar una categoría si **no hay productos asignados** a ella.

> 💡 Ejemplos de categorías útiles: "Electrónica", "Herramientas", "Papelería", "Consumibles"

---

### 🚛 Proveedores (Configuración → Proveedores)
Mantén un directorio de tus proveedores para vincularlos a los productos.

**Campos:**
- Nombre, persona de contacto, email, teléfono

**Eliminar proveedores:**
Solo puedes eliminar un proveedor si **no hay productos** vinculados a él.

> 💡 Vincular un proveedor a cada producto te permite saber a quién contactar cuando necesitas reabastecerte.`
    },
  ]
};

/**
 * Carga los datos de ayuda — primero intenta desde URL remota, fallback al JSON local.
 * @param {string|null} remoteUrl - URL opcional para actualizaciones dinámicas
 */
export async function loadHelpData(remoteUrl = null) {
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.articles?.length) return data;
      }
    } catch {}
  }
  return localHelpData;
}

/** Retorna las categorías únicas del dataset */
export function getCategories(articles) {
  return [...new Set(articles.map(a => a.category))];
}