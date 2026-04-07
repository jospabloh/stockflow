import { helpDataExtension } from './helpDataExtension.js';
import { newHelpArticles } from './helpDataNew';

export const localHelpData = {
  version: "2.5.5",
  last_updated: "2026-04-07",
  get articles() { return [..._baseArticles, ...helpDataExtension, ...newHelpArticles]; }
};

const _baseArticles = [

    // ═══════════════════════════════════════════════
    // PRIMEROS PASOS
    // ═══════════════════════════════════════════════
    {
      id: "glossary",
      category: "Primeros Pasos",
      role: "all",
      title: "📚 Glosario de Términos y Acrónimos",
      keywords: ["glosario", "términos", "acrónimos", "sku", "rfc", "iva", "csv", "pdf", "folio", "kpi", "stock", "margen", "definición", "significado"],
      related_ids: ["roles-overview", "welcome-admin", "welcome-almacenista"],
      content: `## 📚 Glosario de Términos Técnicos

Este glosario explica todos los términos, acrónimos y conceptos usados en StockFlow.

---

### 🔤 Acrónimos

| Acrónimo | Significado | Descripción breve |
|---|---|---|
| **SKU** | *Stock Keeping Unit* — Unidad de control de inventario | Código interno único que identifica cada producto en tu catálogo |
| **RFC** | *Registro Federal de Contribuyentes* | Clave fiscal mexicana obligatoria para documentos fiscales |
| **IVA** | *Impuesto al Valor Agregado* | Impuesto aplicado sobre ventas; en México es del 16% o 0% (exento) |
| **CSV** | *Comma-Separated Values* — Valores separados por comas | Formato de archivo de hoja de cálculo, aceptado por Excel |
| **PDF** | *Portable Document Format* | Formato de documento que se puede imprimir y compartir |
| **KPI** | *Key Performance Indicator* — Indicador clave de rendimiento | Métricas que miden el desempeño del negocio |
| **COT** | Cotización | Prefijo del folio de cotizaciones (ej: COT-260316-001) |

---

### 📦 Términos de Inventario

| Término | Definición |
|---|---|
| **Stock** | Cantidad de unidades disponibles de un producto en el almacén |
| **Stock mínimo** | Umbral de alerta: cuando el stock baja de este número, se activa una alerta de reabastecimiento |
| **Stock bajo** | Estado de un producto cuyo stock actual ≤ stock mínimo definido |
| **Movimiento** | Registro de cualquier cambio en el stock: entrada, salida, devolución o ajuste |
| **Entrada** | Movimiento que **aumenta** el stock (compra a proveedor, devolución de cliente) |
| **Salida** | Movimiento que **disminuye** el stock (venta, consumo interno) |
| **Devolución** | Reingreso de mercancía al inventario por devolución de cliente |
| **Ajuste** | Corrección manual del stock por diferencia en conteo físico |
| **Rotación** | Frecuencia con la que un producto se vende o reemplaza en un período |

---

### 💰 Términos Financieros

| Término | Definición |
|---|---|
| **Precio de compra** | Costo al que el negocio adquiere el producto del proveedor *(solo visible para Admin)* |
| **Precio de venta** | Precio al que se ofrece el producto al cliente final |
| **Margen de ganancia** | Diferencia entre precio de venta y precio de compra, expresada en % |
| **Subtotal** | Suma de productos sin incluir IVA |
| **Total** | Subtotal + IVA |
| **Ganancia bruta** | Ingresos totales de ventas menos el costo total de los productos vendidos |

---

### 📄 Términos de Cotizaciones

| Término | Definición |
|---|---|
| **Cotización** | Propuesta comercial formal que lista productos, precios y condiciones para un cliente |
| **Folio** | Número de identificación único de una cotización (formato: COT-AAAMMDD-NNN) |
| **Concretar** | Convertir una cotización aprobada en una venta real (descuenta el stock automáticamente) |
| **Vigencia** | Fecha límite hasta la cual la cotización es válida |
| **En ruta** | Estado de un pedido que ya salió del almacén hacia el cliente |
| **Factura** | Documento fiscal que certifica una transacción comercial |

---

### 👥 Términos del Sistema

| Término | Definición |
|---|---|
| **Rol** | Nivel de acceso de un usuario: *admin* (administrador) o *almacenista* |
| **Código de invitación** | Clave única del negocio para que nuevos usuarios se unan al equipo |
| **Sesión activa** | El dispositivo desde el que se está usando actualmente la app |
| **Sesión pasiva** | Dispositivo registrado pero sin actividad reciente (desplazado por otro login) |`
    },
    {
      id: "roles-overview",
      category: "Primeros Pasos",
      role: "all",
      title: "👥 Roles del Sistema: Admin vs Almacenista",
      keywords: ["roles", "permisos", "administrador", "almacenista", "acceso", "usuario", "rol", "diferencia"],
      related_ids: ["welcome-admin", "welcome-almacenista", "settings-team"],
      content: `## 👥 Roles en StockFlow

StockFlow tiene **dos roles** que determinan qué puede ver y hacer cada persona.

---

### 👑 Administrador — Acceso Total

El Administrador tiene **control completo** sobre el negocio, incluyendo datos financieros sensibles.

**Puede hacer TODO lo del Almacenista, más:**
- Ver **precios de compra** y **márgenes de ganancia**
- Acceder a reportes financieros: *Mejor Margen* y *Valor por Categoría*
- Ver el **Valor Total del Inventario** (calculado al precio de compra)
- **Eliminar** productos, movimientos, categorías, proveedores y clientes
- Gestionar toda la **Configuración** del negocio
- **Importar productos** masivamente por CSV/Excel
- Activar/desactivar el código de invitación del equipo
- Realizar **ajustes** en la Caja Chica

---

### 📦 Almacenista — Acceso Operativo

El Almacenista puede realizar todas las **operaciones del día a día** sin acceso a datos de costos ni configuración.

**Puede:**
- Crear, editar y consultar **productos**
- Registrar **movimientos** de inventario (entradas, salidas, devoluciones, ajustes)
- Crear, editar y dar seguimiento a **cotizaciones**
- Gestionar el directorio de **clientes**
- Ver **reportes** operativos: ventas, más vendidos, baja rotación, tendencia
- Registrar ingresos y egresos en **Caja Chica**

**No puede:**
- Ver precios de compra ni ganancias
- Acceder a la sección de Configuración
- Eliminar registros con historial asociado
- Realizar ajustes en Caja Chica

---

### 📊 Tabla Comparativa de Permisos

| Función | Admin | Almacenista |
|---|:---:|:---:|
| Ver catálogo de productos | ✅ | ✅ |
| Crear y editar productos | ✅ | ✅ |
| Ver precio de compra | ✅ | ❌ |
| Eliminar productos | ✅ | ❌ |
| Registrar movimientos | ✅ | ✅ |
| Crear cotizaciones | ✅ | ✅ |
| Convertir cotización en venta | ✅ | ✅ |
| Ver reportes de ventas | ✅ | ✅ |
| Ver margen de ganancia | ✅ | ❌ |
| Caja Chica — ingresos y egresos | ✅ | ✅ |
| Caja Chica — ajustes | ✅ | ❌ |
| Acceder a Configuración | ✅ | ❌ |
| Invitar usuarios al equipo | ✅ | ❌ |

> 💡 Para **cambiar el rol** de un usuario, contacta al administrador del sistema.`
    },
    {
      id: "welcome-admin",
      category: "Primeros Pasos",
      role: "admin",
      title: "🚀 Guía de Inicio — Administrador",
      keywords: ["bienvenida", "inicio", "admin", "administrador", "comenzar", "empezar", "setup", "configurar"],
      related_ids: ["roles-overview", "settings-business", "settings-team", "glossary"],
      content: `## 🚀 Guía de Inicio para Administradores

Bienvenido a StockFlow. Sigue esta guía para configurar tu negocio correctamente desde el primer día.

---

### ✅ Lista de Configuración Inicial

Completa estos pasos **en orden** para tener el sistema listo:

#### Paso 1 — Configura tu negocio
> 📍 *Configuración → Mi Negocio*

- ☐ Nombre del negocio
- ☐ RFC (necesario para cotizaciones fiscales)
- ☐ Teléfono y dirección
- ☐ Logo (imagen que aparece en los PDFs)
- ☐ Tasa de IVA predeterminada (generalmente 16%)
- ☐ Moneda (MXN por defecto)
- ☐ Email para alertas de stock bajo
- ☐ Pie de página de cotizaciones (condiciones, políticas)

#### Paso 2 — Crea categorías
> 📍 *Configuración → Categorías*

Agrupa tus productos en categorías lógicas.
Ejemplos: "Electrónica", "Herramientas", "Consumibles", "Papelería"

#### Paso 3 — Registra proveedores
> 📍 *Configuración → Proveedores*

Carga los datos de tus proveedores para vincularlos a productos y saber a quién contactar al reabastecer.

#### Paso 4 — Carga tu catálogo de productos
> 📍 *Productos → + Nuevo Producto* o *Configuración → Importar Productos*

- Para **pocos productos**: créalos uno a uno con el formulario
- Para **muchos productos**: usa la importación masiva por CSV/Excel

#### Paso 5 — Invita a tu equipo
> 📍 *Configuración → Equipo*

Comparte el código de invitación con tus almacenistas.

#### Paso 6 — Configura la Caja Chica
> 📍 *Caja Chica → Fondo Inicial*

Registra el fondo inicial de efectivo para comenzar a llevar el control de gastos menores del negocio.

---

### 🔑 Lo que solo tú puedes hacer

- Ver **precios de compra** y calcular **márgenes de ganancia**
- Acceder a reportes financieros avanzados
- Gestionar la **configuración completa** del negocio
- **Eliminar** cualquier registro del sistema
- **Importar** productos de forma masiva
- Realizar **ajustes** en la Caja Chica`
    },
    {
      id: "welcome-almacenista",
      category: "Primeros Pasos",
      role: "almacenista",
      title: "🚀 Guía de Inicio — Almacenista",
      keywords: ["bienvenida", "inicio", "almacenista", "comenzar", "empezar", "vendedor", "operaciones"],
      related_ids: ["roles-overview", "daily-workflow-almacenista", "movements-register", "glossary"],
      content: `## 🚀 Guía de Inicio para Almacenistas

Bienvenido a StockFlow. Este es tu centro de control para el inventario y las ventas del día a día.

---

### 📱 ¿Qué puedes hacer en StockFlow?

Como Almacenista tienes acceso completo a las **operaciones del negocio**:

| Sección | Para qué sirve |
|---|---|
| **Dashboard** | Ver el estado del inventario y alertas del día |
| **Productos** | Consultar, crear y editar el catálogo |
| **Movimientos** | Registrar entradas, salidas y ajustes de stock |
| **Cotizaciones** | Crear propuestas, convertirlas en ventas y hacer seguimiento |
| **Caja Chica** | Registrar ingresos y egresos del efectivo del negocio |
| **Reportes** | Consultar ventas, productos más vendidos y tendencias |

> 🔒 La sección de **Configuración** es exclusiva del Administrador.

---

### 📋 Tu Flujo de Trabajo Diario

**Al iniciar el día:**
1. Abre el **Dashboard** — revisa alertas de stock bajo y movimientos recientes
2. Si hay alertas de stock bajo, notifica al Administrador para que gestione una recompra

**Durante el día:**
3. **Registra entradas** cuando llegue mercancía al almacén
4. **Crea cotizaciones** para clientes que soliciten propuestas
5. **Convierte en venta** las cotizaciones que se aprueben
6. **Actualiza el seguimiento** de pedidos: En Ruta → Entregado → Pagado

**Al cerrar:**
7. Revisa la lista de cotizaciones activas con seguimiento pendiente

---

### ❌ Lo que NO verás en tu cuenta

Esto no es un error — es por diseño para proteger información financiera sensible:
- ❌ Precio de compra de los productos
- ❌ Márgenes de ganancia
- ❌ Valor total del inventario (calculado a precio de compra)
- ❌ Reportes de "Mejor Margen" y "Valor por Categoría"
- ❌ Sección de Configuración del negocio
- ❌ Ajustes en Caja Chica (solo puede ingresos y egresos)

> 💡 ¿Necesitas cambiar algo de configuración? Pídelo al Administrador.`
    },
    {
      id: "daily-workflow-almacenista",
      category: "Primeros Pasos",
      role: "almacenista",
      title: "📋 Flujo de Trabajo Diario del Almacenista",
      keywords: ["flujo", "diario", "rutina", "proceso", "día", "actividades", "checklist", "tareas"],
      related_ids: ["movements-register", "quotations-create", "quotations-convert", "products-inventory"],
      content: `## 📋 Flujo de Trabajo Diario

Una guía práctica para organizar tu jornada laboral con StockFlow.

---

### 🌅 Al Iniciar el Día

**1. Revisar el Dashboard**
- Identifica cuántos productos tienen **stock bajo** (tarjeta roja)
- Ve los **movimientos de ayer** para contexto
- Revisa las cotizaciones activas en el semáforo

**2. Atender alertas de stock bajo**
- Ve a *Productos → Filtro: Stock bajo*
- Anota los productos críticos
- Comunica al Administrador para gestionar recompras

---

### ☀️ Durante el Día

**3. Registrar entradas de mercancía**
Cuando llegue una entrega del proveedor:
1. Ve a *Movimientos → + Nuevo Movimiento*
2. Tipo: **Entrada**
3. Selecciona el producto (por nombre, SKU o código de barras)
4. Ingresa la cantidad recibida
5. Agrega el número de factura o referencia del proveedor
6. Guarda — el stock se actualiza inmediatamente

**4. Crear cotizaciones para clientes**
Cuando un cliente solicita una propuesta:
1. Ve a *Cotizaciones → + Nueva Cotización*
2. Selecciona o escribe el nombre del cliente
3. Agrega los productos solicitados
4. Ajusta cantidades y precios si es necesario
5. Establece la fecha de vigencia
6. Guarda como *Borrador* o *Enviada* según el estado

**5. Convertir cotizaciones en ventas**
Cuando el cliente apruebe:
1. Busca la cotización en la lista
2. Menú ⋯ → *Convertir en Venta*
3. Confirma la forma de pago
4. El stock se descuenta automáticamente

---

### 🌙 Al Cerrar el Día

**6. Actualizar seguimiento de pedidos**
Revisa las cotizaciones en estado *Concretada*:
- Marca **En Ruta** los pedidos que salieron hoy
- Marca **Entregado** los pedidos que llegaron al cliente
- Registra el **Pago** cuando el cliente haya pagado

**7. Revisar movimientos del día**
Ve a *Movimientos* y confirma que todas las entradas y salidas del día estén registradas.`
    },

    // ═══════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════
    {
      id: "dashboard-admin",
      category: "Dashboard",
      role: "admin",
      title: "📊 Dashboard — Vista del Administrador",
      keywords: ["dashboard", "panel", "inicio", "métricas", "ventas", "ganancia", "estadísticas", "kpi", "valor inventario", "cobranza", "filtro fechas"],
      related_ids: ["reports-admin", "products-inventory", "dashboard-almacenista"],
      content: `## 📊 Dashboard para Administradores

El Dashboard te da una visión **financiera y operativa completa** del negocio en tiempo real.

---

### 🗓️ Filtro de Período (v2.5.5)

En la parte superior del Dashboard puedes seleccionar el período de análisis:

**Opciones predefinidas:**
- **Día** — últimas 24 horas (desde medianoche)
- **Semana** — últimos 7 días
- **Mes** — mes actual
- **Año** — año actual

**Filtro personalizado:**
- Haz clic en **"Personalizar"** para seleccionar un rango manual de fechas
- Puedes especificar inicio y fin exactos
- El rango personalizado se mantiene activo hasta que lo desactives

> 💡 Todos los indicadores de ventas se recalculan automáticamente según el período seleccionado.

---

### 🗂️ Tarjetas de Métricas (fila superior)

| Tarjeta | Qué muestra | Cómo interpretarla |
|---|---|---|
| **Productos Activos** | Conteo de productos + unidades totales en stock | Número de referencias que manejas |
| **Valor Total** | Stock × precio de compra de todos los productos | Capital invertido en inventario *(solo Admin)* |
| **Movimientos Período** | Entradas + salidas en el período seleccionado | Volumen de actividad en el período |
| **Stock Bajo** | Productos con stock ≤ stock mínimo | Cuántos productos necesitan reabastecimiento |

> 💡 Haz clic en la tarjeta de **Stock Bajo** para ir directamente a la lista de productos críticos.

---

### 💰 Análisis de Ventas *(exclusivo Admin)* — Mejorado en v2.5.5

Desglose detallado del flujo de dinero y cobranza en el período:

#### 1️⃣ **Vendido** (Total de ventas)
Suma de precios finales de todos los movimientos de salida y cotizaciones convertidas.

#### 2️⃣ **Pendiente de cobrar** (Diferencia)
Automáticamente calculado: Vendido − Cobrado efectivamente.
Muestra cuánto dinero aún no ha entrado.

#### 3️⃣ **Cobrado efectivamente** (Dinero en caja)
Solo las ventas marcadas como pagadas. Esto es dinero real que entró al negocio.

#### 4️⃣ **Costo de lo entregado**
Suma de precios de compra de todos los productos vendidos en el período.

#### 5️⃣ **Ganancia/Pérdida Real** ⭐ *(nuevo)*
**Fórmula:** Cobrado efectivamente − Costo de lo entregado

**Interpretación:**
- 🟢 **Positiva** (verde) = Ganancia real en el período
- 🔴 **Negativa** (rojo) = Pérdida en el período (has cobrado menos de lo que te costó)

Incluye una explicación integrada de cómo se calcula.

---

### 📦 Vendido x Entregar ⭐ *(nuevo en v2.5.5)*

Muestra cotizaciones concretadas que aún **no han sido entregadas**:

- **Monto en $** — valor total de las cotizaciones por entregar
- **Cantidad de items** — número de productos en esas cotizaciones

Este indicador te ayuda a hacer seguimiento de pedidos en tránsito.

---

### 🚦 Semáforo de Cotizaciones

Resumen visual del estado de **todas las cotizaciones**:

| Color | Estado | Significado |
|---|---|---|
| 🟢 Verde | Concretadas | Ventas completadas |
| 🟡 Ámbar | Activas | En proceso (borrador, enviadas, aceptadas) |
| 🔴 Rojo | Canceladas | Anuladas o vencidas |

Haz clic en cualquier indicador para ir al módulo de Cotizaciones filtrado.

---

### 📈 Gráfica de Movimientos (7 días)

Barras comparativas de **entradas vs salidas** por día en la última semana. Te permite identificar:
- Días de mayor actividad
- Si las salidas superan a las entradas (posible desabasto próximo)
- Tendencias semanales de operación

---

### 🔔 Alertas de Stock Bajo

Lista de productos con stock crítico ordenados por urgencia. Cada alerta muestra:
- Nombre del producto y SKU
- Stock actual vs stock mínimo definido

---

### 🟠 Alerta de Cobro Pendiente *(nueva en v1.5.0)*

Si existen ventas sin cobrar, aparecerá una tarjeta naranja con el total acumulado. Incluye **dos fuentes**:

| Fuente | Qué incluye |
|---|---|
| **Cotizaciones** | Convertidas en venta pero con pago no confirmado |
| **Movimientos directos** | Salidas registradas sin cotización y sin marcar como cobradas |

Haz clic en la tarjeta para ir al módulo correspondiente y gestionar los cobros pendientes.`
    },
    {
      id: "dashboard-almacenista",
      category: "Dashboard",
      role: "almacenista",
      title: "📊 Dashboard — Vista del Almacenista",
      keywords: ["dashboard", "panel", "inicio", "métricas", "movimientos", "stock", "alertas", "semáforo"],
      related_ids: ["movements-overview", "products-inventory", "quotations-states"],
      content: `## 📊 Dashboard para Almacenistas

El Dashboard es tu **centro de control operativo** — ábrelo al iniciar el día para saber el estado del almacén.

---

### 🗂️ Tarjetas de Métricas que verás

| Tarjeta | Qué muestra |
|---|---|
| **Productos Activos** | Cuántos productos tiene el catálogo y cuántas unidades en total |
| **Movimientos Hoy** | Cuántas entradas y salidas se registraron hoy |
| **Stock Bajo** | Cuántos productos están por debajo de su nivel mínimo |

> 🔒 La tarjeta de **Valor Total del Inventario** no está disponible para Almacenistas (requiere datos de costos).

---

### 💼 Ventas del Día

Verás el **monto vendido** del día (suma de precios de venta de las salidas). 
No verás el costo ni la ganancia — son datos financieros del Administrador.

---

### 🚦 Semáforo de Cotizaciones

Muestra el estado de las cotizaciones de forma visual:

| Indicador | Qué significa |
|---|---|
| 🟢 Verde | Cotizaciones **concretadas** (ventas completadas) |
| 🟡 Ámbar | Cotizaciones **activas** (pendientes de cerrar) |
| 🔴 Rojo | Cotizaciones **canceladas** |

Haz clic en cualquier indicador para ir a la lista de cotizaciones.

---

### 🔔 Alertas de Stock Bajo — ¡Prioridad!

Esta es la sección más importante de tu día. Si hay alertas, significa que **se acabará el producto pronto**.

**Qué hacer cuando hay alertas:**
1. Anota los productos con stock crítico
2. Comunica al Administrador para que gestione una compra al proveedor
3. Si puedes registrar la entrada cuando llegue la mercancía, hazlo de inmediato

Haz clic en **"Ver todos"** para ir a la lista completa de productos con stock bajo.`
    },

    // ═══════════════════════════════════════════════
    // PRODUCTOS
    // ═══════════════════════════════════════════════
    {
      id: "products-create",
      category: "Productos",
      role: "all",
      title: "➕ Crear y Editar Productos",
      keywords: ["producto", "crear", "nuevo", "editar", "sku", "barcode", "código de barras", "precio", "categoría", "formulario"],
      related_ids: ["barcode-scanner", "products-inventory", "products-admin-exclusive"],
      content: `## ➕ Crear y Editar Productos

Ve a **Productos → + Nuevo Producto** para agregar un nuevo artículo al catálogo.

---

### 📋 Campos del Formulario

#### 📦 Datos Generales

| Campo | Obligatorio | Descripción |
|---|:---:|---|
| **Nombre** | ✅ | Nombre comercial del producto |
| **SKU** | — | Código interno único; puedes generarlo automáticamente con el botón ⚡ |
| **Código de barras** | — | Escanea con la cámara o escribe el código manualmente |
| **Descripción** | — | Información adicional del producto |
| **Categoría** | — | Grupo al que pertenece (creadas en Configuración) |
| **Proveedor** | — | Proveedor que suministra este producto |

#### 💰 Precios e Inventario

| Campo | Obligatorio | Descripción |
|---|:---:|---|
| **Precio de venta** | ✅ | Precio al cliente final |
| **Precio de compra** | — | Costo del proveedor *(solo visible para Admin)* |
| **Tasa de IVA** | — | 0% (exento) o 16% |
| **Stock inicial** | — | Existencias al momento de crear el producto |
| **Stock mínimo** | — | Umbral para activar alertas de stock bajo |
| **Unidad de medida** | — | Pieza, kg, litro, metro, caja o paquete |

> 💡 Si ingresas un **stock inicial** mayor a cero, el sistema crea automáticamente un movimiento de tipo **Entrada** en el historial.

---

### ✏️ Editar un Producto Existente

1. Ve a la tabla de **Productos**
2. Haz clic en el ícono de **lápiz** ✏️ del producto
3. Modifica los campos necesarios
4. Guarda los cambios

> ⚠️ Cambiar el precio de venta no afecta cotizaciones ya creadas — solo aplica a las nuevas.

---

### 🔍 Buscar y Filtrar Productos

En la página de Productos puedes:
- **Buscar** por nombre, SKU o código de barras
- **Filtrar** por categoría
- **Filtrar** por stock bajo (solo productos con alertas activas)
- **Exportar a CSV** la lista completa`
    },
    {
      id: "products-admin-exclusive",
      category: "Productos",
      role: "admin",
      title: "🔐 Funciones Exclusivas de Productos (Admin)",
      keywords: ["precio compra", "costo", "eliminar producto", "margen", "admin", "exclusivo", "importar", "csv", "masivo"],
      related_ids: ["products-create", "reports-admin", "products-inventory"],
      content: `## 🔐 Funciones de Productos Exclusivas para Administradores

---

### 💰 Precio de Compra

Como Administrador, el campo **Precio de Compra** es visible en el formulario de creación/edición de productos. Es fundamental para:

| Usa el precio de compra para... | Dónde se calcula |
|---|---|
| Calcular la **ganancia bruta diaria** | Dashboard |
| Reporte de **Mejor Margen** | Reportes |
| Calcular el **Valor Total del Inventario** | Dashboard |
| Analizar **Valor por Categoría** | Reportes |

> ⚠️ El Almacenista **no puede ver ni editar** el precio de compra. Configúralo correctamente al crear cada producto.

**Fórmula del margen:**
\`\`\`
Margen (%) = ((Precio Venta − Precio Compra) / Precio Compra) × 100
\`\`\`

---

### 🗑️ Eliminar Productos

Solo el Administrador puede eliminar productos. Para hacerlo:
1. Haz clic en el ícono de **basura** 🗑️ del producto en la tabla
2. Confirma la acción en el diálogo

**Protección de integridad:** Si el producto tiene **movimientos de inventario** registrados, el sistema **bloqueará la eliminación** para proteger el historial.

> 💡 En lugar de eliminar, marca el producto como **Inactivo** — dejará de aparecer en listas pero conservará su historial.

---

### 📥 Importación Masiva de Productos

Ve a **Configuración → Importar Productos** para cargar múltiples productos al mismo tiempo.

**Proceso:**
1. Descarga la **plantilla CSV** con el botón de descarga
2. Rellena la plantilla con tus productos en Excel o Google Sheets
3. Guarda como CSV y sube el archivo
4. Revisa la vista previa con los productos detectados
5. Confirma la importación

**Columnas de la plantilla (Productos):**

| Columna | Obligatorio |
|---|:---:|
| nombre | ✅ |
| precio_menudeo | — |
| precio_mayoreo | — |
| cantidad_minima_mayoreo | — |
| precio_compra | — |
| sku | — |
| codigo_barras | — |
| descripcion | — |
| stock | — |
| stock_minimo | — |
| unidad | — |
| categoria | — |

También puedes importar **Clientes** y **Categorías** desde la misma sección. Ver artículos de ayuda: "Importar Clientes" e "Importar Categorías".`
    },
    {
      id: "products-inventory",
      category: "Productos",
      role: "all",
      title: "📦 Control de Stock y Alertas de Inventario",
      keywords: ["stock", "inventario", "alerta", "mínimo", "bajo", "existencias", "agotado", "reabastecimiento", "cantidad"],
      related_ids: ["movements-register", "products-create", "barcode-scanner"],
      content: `## 📦 Control de Stock y Alertas

---

### ⚙️ Cómo Funciona el Stock Automático

El stock de cada producto se **actualiza automáticamente** con cada acción:

| Acción | Efecto en el stock |
|---|---|
| Registrar **Entrada** | ➕ Aumenta |
| Registrar **Salida** | ➖ Disminuye |
| Registrar **Devolución** | ➕ Aumenta |
| Registrar **Ajuste** | ➕ o ➖ según diferencia |
| **Convertir** cotización en venta | ➖ Disminuye automáticamente |
| **Anular** una venta concretada | ➕ Se revierte automáticamente |

> 💡 **Nunca** necesitas actualizar el stock manualmente — las acciones anteriores lo hacen por ti.

---

### 🔴 ¿Cuándo se activa una Alerta de Stock Bajo?

Cuando el stock de un producto cae **por debajo o igual al stock mínimo** definido.

**Ejemplo:**
- Producto: "Cable USB-C"
- Stock mínimo configurado: 10 unidades
- Stock actual: 8 unidades → **Alerta activa** 🔴

**Dónde aparece la alerta:**
- Tarjeta "Stock Bajo" en el **Dashboard**
- Indicador en el **menú lateral**
- El producto se resalta en la tabla de **Productos**
- Sección de alertas en la parte inferior del **Dashboard**

---

### 📏 ¿Cómo definir el Stock Mínimo correcto?

Usa esta fórmula como guía:

\`\`\`
Stock mínimo = Días de reabastecimiento × Ventas diarias promedio
\`\`\`

**Ejemplo:** Si el proveedor tarda 3 días en entregar y vendes 5 unidades/día:
\`\`\`
Stock mínimo = 3 × 5 = 15 unidades
\`\`\`

Esto garantiza que nunca te quedes sin stock mientras esperas la entrega.

---

### 🔍 Filtrar Productos con Stock Bajo

En la página de **Productos**, activa el filtro **"Stock bajo"** para ver únicamente los productos que necesitan reabastecimiento urgente.`
    },
    {
      id: "barcode-scanner",
      category: "Productos",
      role: "all",
      title: "📷 Uso del Escáner de Código de Barras",
      keywords: ["escáner", "código de barras", "barcode", "cámara", "escanear", "pistola", "lector"],
      related_ids: ["products-create", "movements-register", "quotations-create"],
      content: `## 📷 Escáner de Código de Barras

StockFlow soporta dos métodos para leer códigos de barras:

---

### 🔌 Escáner Físico (Pistola de Codes)

Compatible automáticamente. La mayoría de los escáneres USB y Bluetooth funcionan como teclado:

1. Coloca el cursor en el campo de búsqueda de producto
2. Escanea el código — el sistema lo detecta y busca el producto automáticamente
3. Si el producto existe en el catálogo, se selecciona al instante

> ✅ **Recomendado** para uso intensivo en mostrador o bodega.

---

### 📱 Escáner por Cámara (Dispositivo Móvil)

Disponible en el formulario de **Productos**, **Movimientos** y **Cotizaciones**:

1. Busca el botón **📷 Cámara** en el formulario
2. Toca el botón para activar la cámara
3. Apunta al código de barras del producto
4. El sistema lo detecta y completa el campo automáticamente

> 💡 Funciona mejor con buena iluminación y sin movimiento brusco.

---

### 🔢 Ingresar el Código Manualmente

Si el escáner no funciona o el código está dañado:
1. Escribe el código numérico directamente en el campo de búsqueda
2. El sistema buscará el producto por código de barras

---

### ⚠️ ¿Qué pasa si el código no existe en el catálogo?

- Al escanear en **Productos**: el campo se llena con el código para que lo registres en un nuevo producto
- Al escanear en **Movimientos** o **Cotizaciones**: el sistema mostrará un mensaje indicando que no se encontró el producto`
    },

    // ═══════════════════════════════════════════════
    // MOVIMIENTOS
    // ═══════════════════════════════════════════════
    {
      id: "movements-overview",
      category: "Movimientos",
      role: "all",
      title: "↕️ Tipos de Movimientos de Inventario",
      keywords: ["movimiento", "entrada", "salida", "devolución", "ajuste", "inventario", "historial", "tipos"],
      related_ids: ["movements-register", "products-inventory"],
      content: `## ↕️ Tipos de Movimientos de Inventario

Los movimientos son el **registro histórico** de cada cambio en tu inventario. Hay 4 tipos:

---

### 🟢 Entrada — Mercancía que entra al almacén

**Cuándo usar:** Cuando recibes mercancía de un proveedor u otra fuente.

- ➕ **Aumenta** el stock del producto
- Precio de referencia: **precio de compra**
- Ejemplos de uso:
  - Compra a proveedor con factura
  - Reposición de bodega central
  - Mercancía recuperada de otro almacén

---

### 🔴 Salida — Mercancía que sale del almacén

**Cuándo usar:** Ventas directas en mostrador o salidas sin cotización previa.

- ➖ **Disminuye** el stock del producto
- Precio de referencia: **precio de venta**
- Ejemplos de uso:
  - Venta de mostrador sin cotización
  - Consumo interno del negocio
  - Muestras o cortesías

> ⚠️ Las salidas por **cotizaciones convertidas** se registran automáticamente — no necesitas crearlas manualmente.

---

### 🔵 Devolución — Mercancía que regresa al almacén

**Cuándo usar:** Cuando un cliente regresa un producto.

- ➕ **Aumenta** el stock del producto
- Ejemplos de uso:
  - Devolución por producto en mal estado
  - Devolución por pedido incorrecto
  - Devolución parcial de un pedido

---

### 🟠 Ajuste — Corrección manual de stock

**Cuándo usar:** Cuando el stock del sistema no coincide con el conteo físico real.

- Puede ➕ aumentar o ➖ disminuir el stock
- **Siempre requiere un motivo documentado**
- Ejemplos de uso:
  - Corrección tras inventario físico
  - Pérdida, robo o merma detectada
  - Error en registro previo`
    },
    {
      id: "movements-register",
      category: "Movimientos",
      role: "all",
      title: "✍️ Cómo Registrar un Movimiento",
      keywords: ["registrar", "crear movimiento", "entrada", "salida", "escanear", "código de barras", "cantidad", "referencia", "factura"],
      related_ids: ["movements-overview", "products-inventory", "barcode-scanner", "quotations-convert"],
      content: `## ✍️ Registrar un Nuevo Movimiento

Ve a **Movimientos → + Nuevo Movimiento** para abrir el formulario.

---

### 📋 Paso a Paso

**Paso 1 — Selecciona el producto**
- 📷 Escanea el código de barras con escáner físico o cámara
- 🔍 O busca por nombre del producto o SKU

**Paso 2 — Elige el tipo de movimiento**

| Tipo | Icono | Cuándo usarlo |
|---|---|---|
| Entrada | 🟢 | Llegó mercancía al almacén |
| Salida | 🔴 | Sale mercancía (venta sin cotización) |
| Devolución | 🔵 | Cliente devuelve un producto |
| Ajuste | 🟠 | Corrección tras conteo físico |

**Paso 3 — Ingresa la cantidad**
- Para **Salidas**: el sistema verifica que haya stock suficiente y te avisa si la cantidad supera el disponible

**Paso 4 — Precio unitario**
- Se autocompleta automáticamente según el tipo:
  - Entradas → precio de compra
  - Salidas → precio de venta
- Puedes modificarlo si es necesario para el caso específico

**Paso 5 — Motivo y Referencia**
- **Motivo**: describe brevemente el movimiento (o selecciona el cliente)
- **Referencia**: número de factura, orden de compra, número de pedido, etc.

**Paso 6 — Estado de pago** *(solo para Salidas directas)*
Si el tipo de movimiento es **Salida**, verás el toggle **"Pago recibido"**:
- ✅ **Activo** → el cobro fue recibido en el momento (efectivo, transferencia inmediata)
- ❌ **Inactivo** → el pago queda pendiente y aparecerá en las alertas de cobranza del Dashboard

> 💡 Si olvidas marcarlo como cobrado en el momento, puedes actualizarlo después desde la lista de Movimientos.

**Paso 7 — Guardar**
- El stock del producto se actualiza **instantáneamente**
- El movimiento queda registrado en el historial con fecha y hora

---

### 📅 Consultar el Historial

En la página de **Movimientos**:
- Usa los filtros **Desde / Hasta** para ver un período específico
- Filtra por **tipo** de movimiento
- **Exporta a CSV** para análisis en Excel`
    },

    // ═══════════════════════════════════════════════
    // COTIZACIONES
    // ═══════════════════════════════════════════════
    {
      id: "quotations-create",
      category: "Cotizaciones",
      role: "all",
      title: "📝 Crear y Editar Cotizaciones",
      keywords: ["cotización", "crear", "nueva cotización", "cliente", "productos", "precio", "folio", "iva", "total", "pdf"],
      related_ids: ["quotations-states", "quotations-convert", "barcode-scanner"],
      content: `## 📝 Crear y Editar Cotizaciones

Ve a **Cotizaciones → + Nueva Cotización** para iniciar una nueva propuesta comercial.

> **v2.4.3**: Los precios del catálogo **ya incluyen IVA**. El total = suma directa de precios finales, sin sumar IVA adicional. Se muestra desglose informativo del IVA contenido por cada producto.

---

### 👤 Paso 1 — Información del Cliente

- **Busca** el cliente en el directorio escribiendo su nombre
- Si el cliente existe, sus datos (**email**, **teléfono**) se autocompletan
- Si es un cliente nuevo, escribe el nombre directamente — puedes añadir sus datos de contacto

---

### 🛒 Paso 2 — Agregar Productos

Tienes dos métodos para añadir productos a la cotización:

| Método | Cómo hacerlo |
|---|---|
| **Código de barras** | Usa un escáner físico o escribe el código |
| **Búsqueda** | Escribe el nombre del producto o SKU |

Por cada producto puedes ajustar:
- **Cantidad** — el sistema muestra el stock disponible y alerta si se supera
- **Precio unitario** — se toma del catálogo (precio final, con IVA incluido), pero es editable
- **Labels visuales** — cada producto muestra **IVA 16%** o **Excento** (0%), y si el cliente tiene configuración forzada muestra **Compra** o **Mayoreo**

---

### 💰 Cálculo Automático

| Concepto | Cómo se calcula |
|---|---|
| **Subtotal (Suma Directa)** | Suma de (cantidad × precio final) de todos los productos |
| **IVA (Desglose informativo)** | Se extrae del total solo para visibilidad — **nunca se suma** al total |
| **Total** | = Subtotal (suma directa, ya incluye IVA en los precios) |

**Nota importante:** Los precios de los productos **ya incluyen IVA** (16% o 0% según el producto). El desglose de IVA es solo informativo.

---

### 📋 Paso 3 — Datos Adicionales

| Campo | Para qué sirve |
|---|---|
| **Notas** | Condiciones especiales, observaciones para el cliente |
| **Vigencia** | Fecha límite de validez de la cotización |
| **Forma de pago** | Efectivo, transferencia, tarjeta, crédito, etc. |

---

### 📄 Folio Automático

El sistema genera un folio único con formato **COT-AAAMMDD-NNN**

> Ejemplo: *COT-260316-001* = Cotización #1 del 16 de marzo de 2026

---

### 📎 Descargar PDF

Desde cualquier cotización, haz clic en el botón **PDF** para descargar un documento profesional con el logo y datos de tu negocio.`
    },
    {
      id: "quotations-states",
      category: "Cotizaciones",
      role: "all",
      title: "🚦 Estados de una Cotización",
      keywords: ["estado", "borrador", "enviada", "aceptada", "concretada", "cancelada", "vencida", "status", "flujo"],
      related_ids: ["quotations-create", "quotations-convert", "quotations-cancel"],
      content: `## 🚦 Estados de una Cotización

Cada cotización avanza por etapas a lo largo de su ciclo de vida.

---

### Ciclo de Vida Normal

\`\`\`
Borrador → Enviada → Aceptada → Concretada → Entregada → Pagada
\`\`\`

---

### 🟡 Borrador
La cotización está en elaboración. Puedes **editarla libremente**.

- **Quién puede crearla:** Todos los roles
- **Siguiente paso:** Cambiar a *Enviada* cuando esté lista para el cliente

---

### 🟡 Enviada
La cotización fue compartida con el cliente, quien la está evaluando.

- El cliente puede aprobarla o rechazarla
- **Siguiente paso:** *Aceptada* (aprobó) o *Cancelada* (rechazó)

---

### 🟡 Aceptada
El cliente confirmó su interés. Lista para convertirse en venta.

- **Siguiente paso:** Convertir en Venta

---

### 🟢 Concretada — ¡Venta realizada!
La cotización se convirtió en una venta real.
- El stock se **descontó automáticamente**
- Ahora puedes gestionar la entrega y el pago con los botones de seguimiento

---

### 🔴 Cancelada
La cotización fue anulada.
- Si ya estaba **concretada** y se anula → el stock **se revierte automáticamente**
- Siempre requiere una **razón de cancelación** escrita

---

### ⏰ Vencida *(detección automática)*
La fecha de vigencia pasó sin que la cotización se concretara.
- **No puede** convertirse en venta
- Para reactivarla: edítala y actualiza la fecha de vigencia

---

### 📊 Semáforo del Dashboard

| Color | Estados incluidos |
|---|---|
| 🟢 Verde | Concretadas, Entregadas, Pagadas |
| 🟡 Ámbar | Borrador, Enviada, Aceptada |
| 🔴 Rojo | Canceladas, Vencidas |`
    },
    {
      id: "quotations-convert",
      category: "Cotizaciones",
      role: "all",
      title: "✅ Convertir en Venta y Seguimiento de Pedido",
      keywords: ["convertir", "venta", "pago", "entrega", "ruta", "cobrar", "seguimiento", "factura", "concretar"],
      related_ids: ["quotations-states", "quotations-cancel", "quotations-create"],
      content: `## ✅ Convertir una Cotización en Venta

---

### ▶️ Proceso de Conversión

1. Abre el **menú de acciones** (⋯) de la cotización
2. Selecciona **"Convertir en Venta"**
3. Elige o escribe la **forma de pago** (Efectivo, Transferencia, Tarjeta, etc.)
4. Confirma — el stock se descuenta automáticamente

> ⚠️ Si la cotización está **vencida**, no podrás convertirla. Edítala primero y actualiza la fecha de vigencia.

---

### 📦 Seguimiento del Pedido

Una vez concretada, aparece un botón de **Ruta** y un botón de **Pago** en la fila de la cotización.

**Botón Ruta (dropdown):** Toca el botón para desplegar las opciones de envío/entrega:

| Opción | Cuándo usarla |
|---|---|
| **🚚 En Ruta** | El pedido salió del almacén hacia el cliente |
| **✅ Entregado** | El cliente recibió físicamente el pedido |
| **Quitar estado** | Revertir si se marcó por error |

**Botón Pago:**

| Estado | Qué significa |
|---|---|
| Gris "Pago" | Sin confirmar todavía |
| 🔴 Rojo pulsante **"¡Cobrar!"** | Pedido entregado pero **sin cobrar** — requiere seguimiento urgente |
| 🟢 Verde (método de pago) | Pago confirmado y registrado |

> 💡 Cuando un pedido está **Entregado sin cobrar**, el botón se vuelve rojo y pulsante como alerta. También aparece resaltado en la sección de **Reportes → Cotizaciones**.

---

### 🧾 Estado de Factura

Para cada cotización concretada puedes registrar el estado de facturación:

| Estado | Descripción |
|---|---|
| **Pendiente** | Aún no se ha emitido factura |
| **Emitida** | Factura generada y entregada al cliente |
| **No Requerida** | El cliente no necesita factura |

---

### 📄 Descargar PDF de Cotización

Disponible en **cualquier estado** de la cotización. Genera un documento con:
- Logo y datos de tu negocio (RFC, teléfono, dirección)
- Datos del cliente
- Lista detallada de productos con precios e IVA
- Totales (subtotal, IVA, total)
- Pie de página personalizado (condiciones, vigencia)`
    },
    {
      id: "quotations-cancel",
      category: "Cotizaciones",
      role: "all",
      title: "❌ Cancelar o Anular una Cotización",
      keywords: ["cancelar", "anular", "cancelación", "razón", "motivo", "revertir", "stock", "devolución", "anulación", "rollback", "corrección"],
      related_ids: ["quotations-states", "quotations-convert"],
      content: `## ❌ Cancelar o Anular una Cotización

    ---

    ### Diferencia entre Cancelar y Anular

    | Acción | Cuándo usar | Efecto en el stock |
    |---|---|---|
    | **Cancelar** | La cotización NO se convirtió en venta | Sin efecto (el stock no se había descontado) |
    | **Anular Venta** | La cotización SÍ fue convertida en venta | El stock **se revierte automáticamente** |

    ---

    ### ❌ Cancelar una Cotización (no concretada)

    Si la cotización está en estado Borrador, Enviada o Aceptada:

    1. Menú de acciones (⋯) → **"Cancelar Cotización"**
    2. Escribe el **motivo de cancelación** (campo obligatorio)
    3. Confirma → la cotización queda en estado *Cancelada*

    ---

    ### 🔴 Anular una Venta (ya concretada)

    Si la cotización ya fue convertida en venta:

    1. Menú de acciones (⋯) → **"Anular Venta"**
    2. Escribe la **razón de anulación** (campo obligatorio)
    3. Confirma

    **Lo que ocurre automáticamente al anular:**
    - Se registran movimientos de **Devolución** por cada producto de la cotización
    - El stock regresa a los niveles previos a la venta
    - La cotización queda en estado *Cancelada* con la razón registrada

    ---

    ### 🔧 Corrección de Cotizaciones Erradas (Admin)

    **Situación:** Una cotización fue creada con error pero no se guardó, o necesita ser eliminada/revertida completamente.

    **Solución:** El Administrador puede usar la función backend *checkAndFixQuotation* para:

    | Estado de la Cotización | Acción automática |
    |---|---|
    | **Borrador** | Se elimina completamente de la base de datos |
    | **Concretada** | Se hace rollback: restaura stock, crea movimientos de devolución, marca como cancelada |

    **Cómo funciona:**
    - El Administrador proporciona el **folio exacto** de la cotización (ej: COT-260406-0001)
    - El sistema verifica que la cotización pertenezca al negocio
    - Ejecuta la corrección automáticamente
    - Reporte con los productos restaurados y movimientos creados

    > 💡 Esta función es útil cuando un cliente intenta guardar una cotización que no se guardó correctamente en la BD.

    ---

    ### 💡 Cuándo usar cada opción

    | Situación | Acción recomendada |
    |---|---|
    | El cliente no quiere el pedido antes de concretar | Cancelar |
    | Hubo un error en la cotización (productos, precios) | Cancelar y crear nueva |
    | La entrega no se realizó (ya estaba concretada) | Anular Venta |
    | Error en la conversión a venta | Anular Venta |
    | Cotización errada que debe ser eliminada completamente | Contactar Admin para usar checkAndFixQuotation |

    > ⚠️ La anulación de ventas es una operación seria. Úsala solo cuando sea estrictamente necesario y siempre documenta el motivo correctamente.`
    },

    // ═══════════════════════════════════════════════
    // REPORTES
    // ═══════════════════════════════════════════════
    {
      id: "reports-all",
      category: "Reportes",
      role: "all",
      title: "📈 Reportes Disponibles para Todos",
      keywords: ["reporte", "informe", "análisis", "ventas", "movimientos", "tendencia", "rotación", "csv", "exportar", "más vendidos"],
      related_ids: ["reports-admin", "quotations-states", "movements-overview"],
      content: `## 📈 Reportes para Todos los Roles

La sección de **Reportes** te ayuda a entender el comportamiento del negocio. Hay un **filtro de fechas global** (Desde / Hasta) que aplica a todos los reportes.

---

### 🗂️ Pestaña: Cotizaciones / Ventas

Análisis de las cotizaciones **convertidas en venta** en el período seleccionado.

**Tarjetas resumen:**

| Tarjeta | Qué muestra |
|---|---|
| **Total Ventas** | Suma de todos los totales de ventas concretadas |
| **Monto Cobrado** | Ventas marcadas como pagadas |
| **Pendiente de Pago** | Ventas concretadas pero aún no cobradas |

**Tabla detallada** con: folio, cliente, fecha, total, estado de entrega y pago

> 💾 Exportar a **CSV** disponible

---

### 🏆 Pestaña: Más Vendidos

Gráfico de barras horizontal con los **10 productos con más salidas** en el período.

- Muestra la cantidad de unidades vendidas por producto
- Útil para: identificar qué productos impulsar, priorizar reposición de stock

> 💾 Exportar a **CSV** disponible

---

### 🐢 Pestaña: Baja Rotación

Los **10 productos con menos salidas** en el período, con su stock actual.

- Detecta productos obsoletos o de lenta rotación
- Útil para: decisiones de liquidación, reducción de compras de ese producto

> 💾 Exportar a **CSV** disponible

---

### 📊 Pestaña: Tendencia

Gráfico de líneas con la evolución diaria de **entradas y salidas** en el período.

- Identifica picos de actividad
- Compara volumen de compras vs ventas
- Detecta tendencias semanales o estacionales`
    },
    {
      id: "reports-admin",
      category: "Reportes",
      role: "admin",
      title: "💰 Reportes Financieros Exclusivos (Admin)",
      keywords: ["margen", "ganancia", "costo", "categoría", "valor inventario", "rentabilidad", "reporte admin", "mejor margen", "donut"],
      related_ids: ["reports-all", "products-admin-exclusive"],
      content: `## 💰 Reportes Financieros para Administradores

Además de los reportes estándar, tienes acceso a dos análisis financieros avanzados:

---

### 📊 Pestaña: Mejor Margen

Los **10 productos con mayor porcentaje de margen de ganancia** de tu catálogo.

**Fórmula:**

Margen (%) = ((Precio Venta − Precio Compra) / Precio Compra) × 100

**Ejemplo práctico:**
- Producto: Cable HDMI
- Precio de compra: $50
- Precio de venta: $120
- Margen: ((120 − 50) / 50) × 100 = **140%**

**Útil para:**
- Decidir qué productos **promover prioritariamente** en ventas
- Comparar rentabilidad entre líneas de productos
- Identificar productos con margen insuficiente que necesiten ajuste de precio

> 💾 Exportar a **CSV** disponible

---

### 🥧 Pestaña: Por Categoría (Valor del Stock)

Gráfico circular *(donut)* que muestra cómo está distribuido el **valor de tu inventario** por categoría.

**Fórmula por categoría:**

Valor categoría = Suma de (Stock × Precio de Compra) de todos sus productos

**Ejemplo:**
| Categoría | Valor en inventario |
|---|---|
| Electrónica | $45,000 |
| Herramientas | $12,000 |
| Consumibles | $8,500 |

**Útil para:**
- Saber dónde está concentrado tu **capital invertido**
- Tomar decisiones de compra basadas en la inversión real
- Identificar categorías sobreinventariadas

---

### 📊 Barra de Resumen Financiero

En la barra de filtros de fechas de Reportes también verás:
- **Ventas totales** del período (suma de precios de venta)
- **Compras totales** del período (suma de precios de compra de entradas)`
    },

    // ═══════════════════════════════════════════════
    // CONFIGURACIÓN
    // ═══════════════════════════════════════════════
    {
      id: "settings-business",
      category: "Configuración",
      role: "admin",
      title: "⚙️ Configuración del Negocio",
      keywords: ["configuración", "negocio", "rfc", "logo", "iva", "moneda", "dirección", "teléfono", "pie de página", "color", "email alertas"],
      related_ids: ["settings-team", "settings-categories", "settings-clients"],
      content: `## ⚙️ Configuración del Negocio

> 🔒 Esta sección es **exclusiva para Administradores**.

Ve a **Configuración → Mi Negocio** para personalizar los datos de tu empresa.

---

### 🏢 Información General

| Campo | Para qué sirve |
|---|---|
| **Nombre del negocio** | Aparece en los encabezados de cotizaciones PDF |
| **RFC** | Requerido para documentos fiscalmente válidos |
| **Teléfono** | Datos de contacto del negocio en cotizaciones |
| **Dirección** | Dirección del negocio en cotizaciones |
| **Logo** | Imagen que aparece en el encabezado de PDFs (sube una imagen) |

> ⚠️ Si el RFC no está configurado, verás una advertencia en amarillo en el Dashboard.

---

### 💰 Configuración Financiera

| Campo | Descripción |
|---|---|
| **Tasa de IVA** | Porcentaje predeterminado para nuevos productos (16% en México) |
| **Moneda** | MXN por defecto; puedes cambiarla para negocios en otra moneda |

---

### 📧 Comunicaciones

| Campo | Descripción |
|---|---|
| **Email para alertas de stock** | Recibirás un correo cuando un producto baje del stock mínimo |
| **Pie de cotizaciones** | Texto de condiciones que aparece al final de cada PDF (políticas de devolución, vigencia de precios, etc.) |

---

### 🎨 Identidad Visual

| Campo | Descripción |
|---|---|
| **Color primario** | Personaliza el color principal de la aplicación para toda tu marca |

---

### 💡 Recomendaciones

1. **Configura el RFC primero** — es necesario para que las cotizaciones sean fiscalmente correctas
2. **Sube tu logo** — hace que los PDFs de cotizaciones se vean profesionales
3. **Define un pie de página** — incluye condiciones de pago, vigencia de precios y política de devoluciones`
    },
    {
      id: "settings-clients",
      category: "Configuración",
      role: "admin",
      title: "👥 Gestión de Clientes",
      keywords: ["clientes", "cliente", "rfc cliente", "directorio", "eliminar cliente", "editar cliente", "inactivo"],
      related_ids: ["catalog-navigation-menu", "settings-business", "quotations-create"],
      content: `## 👥 Gestión de Clientes

    Ve a **Catálogos → Clientes** (desde v2.5.0) para administrar el directorio de clientes del negocio.

---

### ➕ Crear un Cliente

| Campo | Obligatorio | Descripción |
|---|:---:|---|
| **Nombre** | ✅ | Nombre completo o razón social |
| **Email** | — | Correo electrónico de contacto |
| **Teléfono** | — | Número telefónico |
| **Dirección** | — | Dirección física del cliente |
| **RFC** | — | Para facturación (RFC del cliente) |
| **Notas** | — | Observaciones internas del equipo |
| **Estado** | — | Activo o Inactivo |

---

### ✏️ Editar un Cliente

Haz clic en el ícono de **lápiz** ✏️ para modificar los datos de cualquier cliente.

---

### 🗑️ Eliminar un Cliente

Solo puedes eliminar un cliente si **no tiene cotizaciones asociadas**. Si tiene historial de ventas, el sistema bloqueará la eliminación para proteger la integridad de los registros.

> 💡 En lugar de eliminar, cambia el estado del cliente a **Inactivo**. Así:
> - No aparecerá en las listas de selección al crear cotizaciones
> - Conservará su historial de transacciones

---

### 🔍 Búsqueda Rápida

La barra de búsqueda filtra el listado en tiempo real por **nombre** o **correo electrónico**.`
    },
    {
      id: "settings-team",
      category: "Configuración",
      role: "admin",
      title: "🔑 Equipo y Acceso — Invitar Usuarios",
      keywords: ["equipo", "invitar", "usuario", "código", "acceso", "rol", "almacenista", "administrador", "código de invitación"],
      related_ids: ["roles-overview", "settings-business"],
      content: `## 🔑 Equipo y Acceso

Ve a **Configuración → Equipo** para gestionar el acceso de tu personal.

---

### 📋 Código de Invitación

Tu negocio tiene un **código único** (ej: AB12CD) para que nuevos usuarios se unan a tu equipo.

**Cómo funciona el proceso de invitación:**

1. El nuevo colaborador se registra en la app
2. Selecciona **"Unirme a un equipo existente"**
3. Ingresa el **código de invitación** que le compartes
4. Queda vinculado a tu negocio automáticamente

Haz clic en el botón **📋 Copiar** para copiar el código al portapapeles.

---

### 🔐 Activar / Desactivar el Código

Puedes **activar o desactivar** el código de invitación:
- **Activo** ✅ — Cualquier persona con el código puede unirse
- **Inactivo** ❌ — Nadie nuevo puede unirse aunque tenga el código

> 💡 Desactiva el código cuando hayas terminado de incorporar a tu equipo para evitar accesos no autorizados.

También puedes **regenerar el código** para invalidar el anterior y generar uno nuevo.

---

### 👥 Roles Disponibles

| Rol | Acceso |
|---|---|
| **admin** | Control total del negocio, incluidos datos financieros y configuración |
| **almacenista** | Operaciones de inventario y ventas, sin acceso a datos de costos |

---

### 🔐 Buenas Prácticas de Seguridad

- Asigna **admin** solo a personas de confianza que necesiten ver datos financieros
- Usa el rol **almacenista** para personal operativo
- Desactiva el código de invitación cuando no estés incorporando a nadie nuevo
- Cambia el código si sospechas que fue compartido sin autorización`
    },
    {
      id: "catalog-navigation-menu",
      category: "Primeros Pasos",
      role: "all",
      title: "📂 Nuevo Menú Catálogos — Navegación Reorganizada",
      keywords: ["catálogos", "menú", "navegación", "productos", "categorías", "proveedores", "clientes", "tipo de pago", "restructuración"],
      related_ids: ["products-create", "settings-business"],
      content: `## 📂 Menú Catálogos — Cambios de v2.5.0

    En **StockFlow v2.5.0** hemos reorganizado la navegación para hacer más accesible la gestión de tu catálogo.

    ---

    ### 🎯 Nuevo Menú Parent: "Catálogos"

    En el sidebar izquierdo ahora encontrarás un nuevo menú expandible llamado **Catálogos** (icono: briefcase 💼) que agrupa 5 módulos operativos:

    | Módulo | Descripción | Anterior |
    |---|---|---|
    | **Productos** | Gestión del catálogo de productos | Productos (sin cambios) |
    | **Categorías** | Organizar productos por tipo/línea | Estaba en Configuración |
    | **Proveedores** | Directorio de proveedores | Estaba en Configuración |
    | **Clientes** | Directorio de clientes | Estaba en Configuración |
    | **Tipo de pago** | Formas de pago (Efectivo, Transferencia, etc.) | Estaba en Configuración como "Pagos" |

    ---

    ### ✅ ¿Qué cambió?

    **En el menú Catálogos:**
    - Cada módulo ahora es una página **independiente y autónoma**
    - Puedes acceder a cualquier módulo sin pasar por Configuración
    - Los datos y funciones CRUD son exactamente iguales a antes — **sin pérdida de funcionalidad**
    - Permisos, validaciones, y business_id isolation funcionan idénticos

    **En Configuración:**
    - Se eliminaron las pestañas duplicadas de Categorías, Proveedores, Clientes y Pagos
    - Ahora Configuración solo contiene:
    - **Mi Negocio** — datos fiscales, logo, RFC
    - **Facturación** — para futuras opciones de factura
    - **Equipo** — gestión de usuarios e invitaciones
    - **Importar Productos** — importación masiva CSV/Excel

    ---

    ### 📱 Acceso en Dispositivos Móviles

    El menú Catálogos funciona en iPhone y Android:
    - Toca el icono **≡** (hamburguesa) para abrir el menú en móvil
    - Toca **Catálogos** para expandir y ver las 5 opciones
    - Todas las páginas son completamente responsivas

    ---

    ### 💡 Beneficios de la Reorganización

    1. **Mejor acceso:** Menos clics para llegar a Categorías, Proveedores, etc.
    2. **Interfaz más clara:** Configuración ahora contiene solo opciones de negocio
    3. **Flujo más intuitivo:** Los datos del catálogo están agrupados juntos
    4. **Sin cambios funcionales:** Todo funciona exactamente igual que antes`
    },
    {
      id: "settings-categories",
      category: "Configuración",
      role: "admin",
      title: "🏷️ Categorías y Proveedores",
      keywords: ["categoría", "proveedor", "clasificar", "organizar", "color", "catálogo", "crear categoría"],
      related_ids: ["catalog-navigation-menu", "products-create", "settings-business"],
      content: `## 🏷️ Categorías y Proveedores

    > **v2.5.0**: Estas secciones se movieron de Configuración a menú Catálogos — ver **"Nuevo Menú Catálogos"** para detalles.

    ---

    ### 🎨 Categorías
    > 📍 *Catálogos → Categorías* (antes: *Configuración → Categorías*)

Organiza tu catálogo agrupando productos por tipo o línea de negocio.

**Campos para crear una categoría:**

| Campo | Obligatorio | Descripción |
|---|:---:|---|
| **Nombre** | ✅ | Nombre de la categoría (ej: "Electrónica") |
| **Descripción** | — | Explicación breve de qué incluye |
| **Color** | — | Color visual en formato hex (ej: #4F46E5) para identificación rápida |

**Eliminar categorías:**
Solo puedes eliminar una categoría si **no hay productos asignados** a ella.

**Ejemplos de categorías útiles:**

| Negocio | Categorías sugeridas |
|---|---|
| Ferretería | Herramientas, Construcción, Electricidad, Plomería |
| Papelería | Oficina, Escolares, Impresión, Tecnología |
| Distribuidora | Bebidas, Alimentos, Limpieza, Higiene |

---

### 🚛 Proveedores
> 📍 *Configuración → Proveedores*

Mantén un directorio de tus proveedores para vincularlos a los productos.

**Campos disponibles:**
- Nombre, persona de contacto, email, teléfono, dirección, RFC, notas

**Beneficio de registrar proveedores:**
- Al ver un producto con stock bajo, sabes **inmediatamente a quién llamar** para reabastecerlo
- Puedes filtrar productos por proveedor para gestionar compras

**Eliminar proveedores:**
Solo puedes eliminar un proveedor si **no hay productos vinculados** a él.`
    },

    // ═══════════════════════════════════════════════
    // CAJA CHICA
    // ═══════════════════════════════════════════════
    {
      id: "petty-cash-overview",
      category: "Caja Chica",
      role: "all",
      title: "🐷 Caja Chica — Guía Completa",
      keywords: ["caja chica", "efectivo", "gastos menores", "fondo", "ingreso", "egreso", "ajuste", "saldo", "caja", "dinero"],
      related_ids: ["petty-cash-movements", "roles-overview"],
      content: `## 🐷 Caja Chica

El módulo de Caja Chica permite llevar un control sencillo del dinero disponible para gastos menores del negocio. Cada movimiento queda asociado al negocio correspondiente, por lo que la información siempre se mantiene separada y ordenada.

---

### ¿Qué es la Caja Chica?

Es un fondo de dinero físico que se usa para cubrir gastos pequeños del día a día: papelería, limpieza, transporte, viáticos menores, etc. No es una cuenta bancaria ni un sistema contable — es el control del efectivo disponible para el negocio.

---

### Funciones Principales

| Función | Descripción |
|---|---|
| **Fondo Inicial** | Registra el dinero con el que empieza la caja |
| **Ingreso** | Cuando entra dinero a la caja (reposición, reintegro) |
| **Egreso** | Cuando sale dinero por un gasto menor |
| **Ajuste** | Corrección manual del saldo (solo Admin) |
| **Historial** | Consulta todos los movimientos con filtros |
| **Saldo actual** | Muestra el dinero disponible en todo momento |

---

### Cómo Usar la Caja Chica

**Paso 1 — Registrar el Fondo Inicial**
Si es la primera vez que usas la caja chica:
1. Ve a **Caja Chica** en el menú
2. Haz clic en **"Fondo Inicial"**
3. Ingresa el monto con el que inicias la caja
4. Agrega una descripción y la fecha
5. Guarda — el saldo se establece automáticamente

**Paso 2 — Registrar un Ingreso**
Cuando entra dinero a la caja (reposición de fondo, reintegro, etc.):
1. Haz clic en **"Ingreso"**
2. Ingresa el monto, descripción y fecha
3. Selecciona una categoría si aplica
4. Guarda — el saldo aumenta automáticamente

**Paso 3 — Registrar un Egreso**
Cuando se realiza un gasto con el dinero de la caja:
1. Haz clic en **"Egreso"**
2. Ingresa el monto, descripción y fecha
3. Selecciona la categoría del gasto (papelería, limpieza, transporte, etc.)
4. Agrega referencia o comprobante si tienes
5. Guarda — el saldo disminuye automáticamente

> ⚠️ Si el egreso deja el saldo en negativo, el sistema te avisará con una advertencia antes de guardar.

**Paso 4 — Realizar un Ajuste (solo Admin)**
Si hay una diferencia entre el saldo del sistema y el efectivo físico:
1. Haz clic en **"Ajuste"**
2. Ingresa el monto de la diferencia
3. Describe claramente el motivo del ajuste
4. Guarda — el ajuste queda registrado y distinguido en el historial

---

### Cómo se Calcula el Saldo

El saldo actual es la suma de todos los movimientos del negocio:

Saldo = Fondo Inicial + Ingresos − Egresos ± Ajustes

| Tipo de movimiento | Efecto |
|---|---|
| Fondo Inicial | ➕ Suma |
| Ingreso | ➕ Suma |
| Egreso | ➖ Resta |
| Ajuste | ➕ o ➖ según el monto |

---

### Historial de Movimientos

En la pestaña **"Historial completo"** puedes:
- Filtrar por **tipo** de movimiento
- Filtrar por **rango de fechas**
- Buscar por **descripción** o **categoría**
- **Exportar a CSV** para análisis externo

---

### Importante

- Todos los movimientos están ligados al **negocio actual** — cada negocio tiene su propia caja chica.
- El saldo se actualiza automáticamente con cada movimiento.
- Se recomienda capturar una **descripción clara** en cada movimiento para facilitar auditorías.
- Los **ajustes** son operaciones de corrección y solo están disponibles para Administradores.
- La caja chica está diseñada para **gastos menores del día a día**, no para contabilidad formal.

---

### Buenas Prácticas

1. Registra cada gasto al momento de realizarlo, no al final del día.
2. Siempre captura una referencia (ticket, folio, recibo) cuando exista comprobante.
3. Realiza un conteo físico periódico y usa **Ajuste** si hay diferencias.
4. Repone el fondo con un **Ingreso** cuando el saldo esté bajo.
5. Usa categorías consistentes para poder analizar en qué se gasta más.`
    },

    // ═══════════════════════════════════════════════
    // REFERENCIA RÁPIDA
    // ═══════════════════════════════════════════════
    {
      id: "quick-reference-admin",
      category: "Referencia Rápida",
      role: "admin",
      title: "⚡ Referencia Rápida — Administrador",
      keywords: ["referencia", "rápida", "atajos", "resumen", "guía rápida", "admin", "cheatsheet"],
      related_ids: ["welcome-admin", "glossary", "reports-admin"],
      content: `## ⚡ Referencia Rápida para Administradores

Una guía de bolsillo con las acciones más frecuentes.

---

### 🏃 Acciones Rápidas

| Quiero... | Voy a... |
|---|---|
| Crear un producto | Productos → + Nuevo Producto |
| Registrar entrada de mercancía | Movimientos → + Nuevo Movimiento → Entrada |
| Crear una cotización | Cotizaciones → + Nueva Cotización |
| Ver qué productos se venden más | Reportes → Más Vendidos |
| Ver mis productos más rentables | Reportes → Mejor Margen |
| Ver cuánto vale mi inventario | Dashboard → Tarjeta "Valor Total" |
| Registrar gasto de caja chica | Caja Chica → Egreso |
| Reponer el fondo de caja chica | Caja Chica → Ingreso |
| Ver saldo de caja chica | Caja Chica → Saldo Actual |
| Ajustar saldo de caja chica | Caja Chica → Ajuste |
| Invitar a un nuevo empleado | Configuración → Equipo |
| Importar productos en cantidad | Configuración → Importar Productos |
| Cambiar datos del negocio | Configuración → Mi Negocio |
| Agregar una categoría | Configuración → Categorías |

---

### 🚨 Situaciones Frecuentes

**"Un producto llegó al almacén"**
→ Movimientos → + Nuevo → **Entrada** → selecciona producto → ingresa cantidad → agrega número de factura → Guardar

**"Un cliente quiere una cotización"**
→ Cotizaciones → + Nueva → selecciona cliente → agrega productos → establece vigencia → Guardar

**"El cliente aprobó la cotización"**
→ Cotizaciones → Menú ⋯ → **Convertir en Venta** → selecciona forma de pago → Confirmar

**"El pedido salió al cliente"**
→ Cotizaciones → busca la venta → botón **En Ruta** ✅

**"Hay un error en el stock de un producto"**
→ Movimientos → + Nuevo → **Ajuste** → selecciona producto → ingresa cantidad correcta → documenta el motivo

**"Hice un gasto menor con efectivo"**
→ Caja Chica → **Egreso** → monto → descripción → categoría → Guardar

**"Necesito reponer el fondo de caja chica"**
→ Caja Chica → **Ingreso** → monto → descripción → Guardar

**"El saldo físico no coincide con el sistema"**
→ Caja Chica → **Ajuste** → monto de la diferencia → documenta el motivo → Guardar

---

### 📊 Fórmulas Útiles

| Cálculo | Fórmula |
|---|---|
| Margen de ganancia | ((Venta − Compra) / Compra) × 100 |
| Valor de inventario | Stock × Precio de compra |
| Stock mínimo sugerido | Días entrega × Ventas diarias promedio |`
    },
    {
      id: "quick-reference-almacenista",
      category: "Referencia Rápida",
      role: "almacenista",
      title: "⚡ Referencia Rápida — Almacenista",
      keywords: ["referencia", "rápida", "atajos", "resumen", "guía rápida", "almacenista", "cheatsheet"],
      related_ids: ["welcome-almacenista", "daily-workflow-almacenista", "glossary"],
      content: `## ⚡ Referencia Rápida para Almacenistas

Una guía de bolsillo con las acciones más frecuentes de tu día a día.

---

### 🏃 Acciones Rápidas

| Quiero... | Voy a... |
|---|---|
| Ver el estado del almacén | Dashboard (inicio) |
| Ver qué productos tienen stock bajo | Dashboard → sección "Alertas de Stock" |
| Registrar mercancía que llegó | Movimientos → + Nuevo → Entrada |
| Registrar una venta directa | Movimientos → + Nuevo → Salida |
| Crear una cotización | Cotizaciones → + Nueva Cotización |
| Convertir cotización en venta | Cotizaciones → Menú ⋯ → Convertir en Venta |
| Marcar pedido como enviado | Cotizaciones → busca la venta → botón Ruta → "En Ruta" |
| Marcar pedido como entregado | Cotizaciones → busca la venta → botón Ruta → "Entregado" |
| Registrar pago del cliente | Cotizaciones → busca la venta → botón Pago |
| Buscar un producto específico | Productos → escribe nombre o SKU en búsqueda |
| Ver historial de movimientos | Movimientos → filtra por fecha |
| Ver qué se vendió más este mes | Reportes → Más Vendidos |
| Registrar un gasto con efectivo | Caja Chica → Egreso |
| Ver cuánto hay en caja chica | Caja Chica → Saldo Actual |

---

### 🚨 Situaciones Frecuentes

**"Llegó mercancía del proveedor"**
→ Movimientos → + Nuevo → **Entrada** → selecciona producto → cantidad → número de factura del proveedor → Guardar

**"Un cliente quiere una cotización"**
→ Cotizaciones → + Nueva → escribe el nombre del cliente → agrega los productos → establece vigencia → Guardar como *Enviada*

**"El cliente aprobó la cotización"**
→ Cotizaciones → Menú ⋯ → **Convertir en Venta** → forma de pago → Confirmar

**"No hay stock suficiente de un producto"**
→ Anota el producto y avisa al Administrador para gestionar la compra

**"Un cliente devolvió un producto"**
→ Movimientos → + Nuevo → **Devolución** → selecciona producto → cantidad → motivo → Guardar

**"El conteo físico no coincide con el sistema"**
→ Movimientos → + Nuevo → **Ajuste** → selecciona producto → cantidad real → documenta el motivo → Guardar

**"Hice un gasto menor con dinero de la caja"**
→ Caja Chica → **Egreso** → monto → descripción → categoría (ej: Papelería, Transporte) → Guardar

**"Entró dinero para reponer la caja chica"**
→ Caja Chica → **Ingreso** → monto → descripción → Guardar

---

### ❓ Preguntas Frecuentes

**¿Por qué no veo el precio de compra?**
→ Es información financiera restringida al Administrador. Esto es por diseño para proteger datos sensibles del negocio.

**¿Por qué no puedo entrar a Configuración?**
→ La sección de Configuración es exclusiva para Administradores. Si necesitas cambiar algo, pídelo al Admin.

**¿Cómo sé si una cotización ya fue pagada?**
→ En la lista de Cotizaciones, busca el ícono de pago en la columna de seguimiento. Verde = pagado, gris = pendiente.`
    },
];

/**
 * Carga los datos de ayuda — primero intenta desde URL remota, fallback al JSON local.
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