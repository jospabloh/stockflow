/**
 * Artículos de ayuda adicionales — v1.1.0
 * Precios, Importación y Versión
 */
export const helpDataExtension = [
  // ─── PRECIOS ──────────────────────────────────────────────────────────────
  {
    id: "pricing-products",
    category: "Precios",
    role: "admin",
    title: "💲 Precios por Producto: Menudeo, Mayoreo y Mínimos",
    keywords: ["precio menudeo", "precio mayoreo", "cantidad mínima", "precio venta", "wholesale", "retail", "precio por cantidad", "descuento cantidad"],
    related_ids: ["pricing-clients", "products-create", "products-admin-exclusive"],
    content: `## 💲 Esquema de Precios por Producto

Cada producto en StockFlow puede tener **tres precios** configurados:

---

### 📋 Los tres precios

| Campo | Nombre en pantalla | Descripción |
|---|---|---|
| \`precio_menudeo\` | Precio de menudeo | Precio estándar al cliente final, venta individual |
| \`precio_mayoreo\` | Precio de mayoreo | Precio reducido para compras en volumen |
| \`cantidad_minima_mayoreo\` | Cantidad mínima para mayoreo | Número de unidades a partir del cual aplica el precio de mayoreo |

---

### ⚙️ Cómo funciona la jerarquía de precios

Cuando se crea una cotización, el sistema aplica el precio siguiendo este orden de prioridad:

\`\`\`
1. ¿El cliente tiene "precio de compra en todos los productos"? → Usa precio_compra
2. ¿El cliente tiene "precio mayoreo en todos los productos"? → Usa precio_mayoreo
3. ¿La cantidad supera la cantidad_minima_mayoreo del producto? → Usa precio_mayoreo
4. En cualquier otro caso → Usa precio_menudeo
\`\`\`

---

### 🧮 Ejemplo práctico

| Producto | P. Menudeo | P. Mayoreo | Mín. Mayoreo |
|---|---|---|---|
| Caja de Tornillos | $120.00 | $85.00 | 10 unidades |

| Cantidad del cliente | Precio aplicado | Motivo |
|---|---|---|
| 5 unidades | $120.00 | Menor al mínimo de mayoreo |
| 10 unidades | $85.00 | Igual al mínimo → aplica mayoreo |
| 25 unidades | $85.00 | Mayor al mínimo → aplica mayoreo |

---

### 📝 Configurar precios en el formulario

Ve a **Productos → Editar Producto** y busca la sección de precios:

- **Precio de menudeo** *(obligatorio)* — el precio base
- **Precio de mayoreo** — déjalo en 0 si no ofreces precio por volumen
- **Cantidad mínima para mayoreo** — déjalo en 0 si no aplica

> 💡 Si el precio de mayoreo o la cantidad mínima son 0, el sistema ignora esa configuración y usa siempre el precio de menudeo.`
  },
  {
    id: "pricing-clients",
    category: "Precios",
    role: "admin",
    title: "👥 Precios Especiales por Cliente",
    keywords: ["precio cliente", "mayoreo cliente", "precio compra cliente", "descuento especial", "force_wholesale", "force_purchase", "precio fijo cliente"],
    related_ids: ["pricing-products", "settings-clients"],
    content: `## 👥 Precios Especiales por Cliente

Puedes configurar excepciones de precio a nivel de cliente individual. Estas opciones **anulan la lógica de cantidad del producto**.

---

### 🔧 Opciones disponibles en el perfil del cliente

#### Opción 1 — "Aplicar precio mayoreo en todos los productos y en cualquier cantidad"

Cuando esta opción está **activa**:
- El cliente siempre recibe el **precio de mayoreo** de cada producto
- No importa la cantidad que compre — ni siquiera si es solo 1 unidad
- Si el producto no tiene precio de mayoreo configurado, se usa el precio de menudeo

**Cuándo usar:** Clientes frecuentes, distribuidores, socios comerciales que siempre compran a precio de volumen.

---

#### Opción 2 — "Aplicar precio de compra en todos los productos y en cualquier cantidad"

Cuando esta opción está **activa**:
- El cliente siempre recibe el **precio de compra** (costo del proveedor) de cada producto
- Esto es típicamente el precio mínimo posible — representa el costo sin margen

**Cuándo usar:** Clientes internos, traspasos entre sucursales, o acuerdos especiales sin margen de ganancia.

> ⚠️ **Importante:** Las dos opciones son **mutuamente excluyentes** — no puedes activar ambas al mismo tiempo para el mismo cliente. El sistema lo rechazará.

---

### 📊 Tabla de jerarquía completa

| Configuración del cliente | Precio aplicado en cotización |
|---|---|
| Sin opciones especiales + cantidad < mínimo | Precio menudeo |
| Sin opciones especiales + cantidad ≥ mínimo | Precio mayoreo |
| "Precio mayoreo en todos" = ✅ | Precio mayoreo (siempre, cualquier cantidad) |
| "Precio de compra en todos" = ✅ | Precio de compra (siempre, cualquier cantidad) |

---

### ✏️ Cómo configurar

1. Ve a **Configuración → Clientes**
2. Edita el cliente deseado (ícono ✏️)
3. En la sección "Configuración de Precios", activa el switch correspondiente
4. Guarda los cambios

> 💡 Si activas accidentalmente ambas opciones, el sistema te mostrará un error de validación antes de guardar.`
  },

  // ─── IMPORTACIÓN ──────────────────────────────────────────────────────────
  {
    id: "import-overview",
    category: "Importación",
    role: "admin",
    title: "📥 Importación Masiva: Guía Completa",
    keywords: ["importar", "csv", "masivo", "plantilla", "productos importar", "clientes importar", "categorías importar", "carga masiva", "excel"],
    related_ids: ["import-products", "import-clients", "import-categories", "products-admin-exclusive"],
    content: `## 📥 Importación Masiva desde CSV

> 📍 *Configuración → Importar*

La sección de importación te permite cargar múltiples registros al mismo tiempo usando archivos CSV.

---

### 📦 ¿Qué puedes importar?

| Tipo | Descripción |
|---|---|
| **Productos** | Carga tu catálogo completo con precios, stock y categorías |
| **Clientes** | Importa tu directorio de clientes con configuración de precios |
| **Categorías** | Crea categorías en bloque antes de importar productos |

---

### 🔄 Flujo de importación (igual para todos los tipos)

**Paso 1 — Selecciona el tipo:** Elige entre Productos, Clientes o Categorías.

**Paso 2 — Descarga la plantilla:** Haz clic en "Descargar plantilla" para obtener el CSV con las columnas exactas. Incluye filas de ejemplo.

**Paso 3 — Llena tus datos:** Abre en Excel o Google Sheets. Rellena desde la fila 2 (fila 1 = encabezado). Guarda como CSV.

**Paso 4 — Sube el CSV:** Haz clic en "Subir CSV" y selecciona el archivo.

**Paso 5 — Vista previa:** Revisa los registros detectados antes de confirmar.

**Paso 6 — Confirma:** El backend valida cada fila e informa errores por fila.

---

### ⚠️ Errores comunes de validación

| Error | Causa | Solución |
|---|---|---|
| "El campo nombre es obligatorio" | La columna nombre está vacía | Llena el nombre en esa fila |
| "La categoría X no existe" | Categoría no creada aún | Crea la categoría primero |
| "No se puede activar mayoreo y compra al mismo tiempo" | Ambas banderas en true | Deja solo una en true |
| "Unidad inválida" | Unidad no reconocida | Usa: pieza, kg, litro, metro, caja, paquete |

---

### 💡 Orden recomendado

Si importas productos con categorías:
1. **Primero**: Importa las categorías (o créalas manualmente)
2. **Después**: Importa productos usando los nombres exactos de las categorías`
  },
  {
    id: "import-products",
    category: "Importación",
    role: "admin",
    title: "📦 Importar Productos — Columnas y Validaciones",
    keywords: ["importar productos", "columnas productos", "csv productos", "precio menudeo importar", "precio mayoreo importar", "stock importar"],
    related_ids: ["import-overview", "pricing-products", "products-admin-exclusive"],
    content: `## 📦 Importar Productos

> 📍 *Configuración → Importar → Productos*

---

### 📋 Columnas de la plantilla

| Columna | Obligatorio | Descripción |
|---|:---:|---|
| \`nombre\` | ✅ | Nombre del producto |
| \`sku\` | — | Código interno único |
| \`codigo_barras\` | — | Código de barras |
| \`descripcion\` | — | Descripción del producto |
| \`precio_compra\` | — | Costo del proveedor |
| \`precio_menudeo\` | — | Precio de venta estándar |
| \`precio_mayoreo\` | — | Precio para compras en volumen (0 = sin mayoreo) |
| \`cantidad_minima_mayoreo\` | — | Unidades mínimas para precio mayoreo |
| \`stock\` | — | Existencias iniciales |
| \`stock_minimo\` | — | Umbral de alerta (default: 5) |
| \`unidad\` | — | Unidad de medida |
| \`categoria\` | — | Nombre exacto de categoría existente |

---

### 🔒 Validaciones

- **nombre** vacío → fila rechazada
- **unidad** inválida → fila rechazada (valores: pieza, kg, litro, metro, caja, paquete)
- **categoria** no encontrada → fila rechazada con mensaje explicativo
- Si **stock** > 0, se crea automáticamente un movimiento de entrada "Stock inicial"`
  },
  {
    id: "import-clients",
    category: "Importación",
    role: "admin",
    title: "👥 Importar Clientes — Columnas y Validaciones",
    keywords: ["importar clientes", "csv clientes", "carga clientes", "force_wholesale importar", "mayoreo clientes importar"],
    related_ids: ["import-overview", "pricing-clients", "settings-clients"],
    content: `## 👥 Importar Clientes

> 📍 *Configuración → Importar → Clientes*

---

### 📋 Columnas de la plantilla

| Columna | Obligatorio | Descripción |
|---|:---:|---|
| \`nombre\` | ✅ | Nombre del cliente o razón social |
| \`telefono\` | — | Número telefónico |
| \`email\` | — | Correo electrónico |
| \`direccion\` | — | Dirección física |
| \`force_wholesale_all_products\` | — | Precio mayoreo en todos los productos |
| \`force_purchase_all_products\` | — | Precio de compra en todos los productos |

---

### 📝 Valores booleanos aceptados

Los campos de precio aceptan: **true/false**, **1/0**, **sí/no**, **si/no**, **yes/no**

---

### 🔒 Validaciones

- **nombre** vacío → fila rechazada
- Ambas banderas **true** simultáneamente → fila rechazada con error explicativo
- Se crea con estado **Activo** por default`
  },
  {
    id: "import-categories",
    category: "Importación",
    role: "admin",
    title: "🏷️ Importar Categorías — Columnas y Validaciones",
    keywords: ["importar categorías", "csv categorías", "carga categorías", "categorías masivo"],
    related_ids: ["import-overview", "import-products", "settings-categories"],
    content: `## 🏷️ Importar Categorías

> 📍 *Configuración → Importar → Categorías*

---

### 📋 Columnas de la plantilla

| Columna | Obligatorio | Descripción |
|---|:---:|---|
| \`nombre\` | ✅ | Nombre de la categoría |
| \`descripcion\` | — | Descripción breve |

---

### 🔒 Validaciones

- **nombre** vacío → fila rechazada
- Se crea con color predeterminado índigo. Edítalo después en Configuración → Categorías.

---

### 💡 Flujo recomendado

1. Importa categorías primero
2. Verifica los nombres exactos
3. Usa esos mismos nombres en la columna \`categoria\` al importar productos`
  },

  // ─── COBROS PENDIENTES ────────────────────────────────────────────────────
  {
    id: "pending-payments",
    category: "Movimientos",
    role: "all",
    title: "💰 Control de Cobros Pendientes en Salidas Directas",
    keywords: ["cobro pendiente", "pago pendiente", "salida sin cobrar", "movimiento sin pagar", "cobrar", "pendiente pago", "alerta cobro"],
    related_ids: ["movements-register", "quotations-convert", "dashboard-admin"],
    content: `## 💰 Control de Cobros Pendientes — Salidas Directas

Cuando registras una **salida directa** (sin cotización), puedes indicar si el pago fue recibido en el momento o si quedó pendiente.

---

### ✅ Marcar como cobrado al registrar

Al crear un movimiento de tipo **Salida**, verás el toggle **"Pago recibido"**:

| Estado del toggle | Significado |
|---|---|
| ✅ **Activo** | El dinero fue recibido al momento (efectivo, pago inmediato) |
| ❌ **Inactivo** (default) | El cobro queda pendiente — aparecerá en las alertas |

---

### 📋 Ver y gestionar cobros pendientes

En la página de **Movimientos**, la columna **"Pago"** muestra:

| Badge | Significado | Acción disponible |
|---|---|---|
| 🟠 **Pendiente** | Salida sin cobrar | Toca para confirmar el cobro |
| 🟢 **Cobrado** | Pago ya registrado | Sin acción (solo informativo) |
| — | No aplica | Entradas, devoluciones, ajustes o salidas vinculadas a cotización |

> 💡 Al tocar el badge **Pendiente**, se abre un diálogo de confirmación antes de marcarlo como cobrado.

---

### 🟠 Alerta en el Dashboard

Si hay cobros pendientes (cotizaciones o movimientos directos), el Dashboard muestra una tarjeta naranja con:
- El **total de ventas sin cobrar** (suma acumulada)
- El **desglose**: cuántas son de cotizaciones y cuántas de movimientos directos

---

### ⚠️ Importante

- Una salida vinculada a una **cotización** gestiona su pago desde el módulo de **Cotizaciones**, no desde Movimientos.
- Solo las salidas **directas** (sin quotation_id) muestran el badge de pago en la tabla de Movimientos.`
  },

  // ─── AUDITORÍA DE INVENTARIO ─────────────────────────────────────────────
  {
    id: "inventory-audit",
    category: "Configuración",
    role: "admin",
    title: "🔍 Auditoría de Inventario — Detectar y Resolver Discrepancias",
    keywords: ["auditoría", "inventario", "discrepancia", "stock", "reconciliación", "direct_edit", "sync_error", "legacy_bug", "corrección"],
    related_ids: ["products-inventory", "movements-overview", "settings-business"],
    content: `## 🔍 Auditoría de Inventario

> 📍 *Configuración → Auditoría*

La pestaña **Audit Inventario** compara el stock actual de cada producto con su historial de movimientos registrados y detecta discrepancias automáticamente.

---

### 🎯 ¿Para qué sirve?

El stock de un producto puede desincronizarse del historial de movimientos por múltiples razones (edición directa, bugs anteriores, operaciones fuera de flujo). Esta herramienta identifica y permite resolver esas discrepancias de forma controlada.

---

### 🗂️ Clasificación de Discrepancias

| Tipo | Ícono | Descripción |
|---|---|---|
| \`direct_edit\` | 🟠 | El stock fue modificado directamente sin registrar un movimiento |
| \`sync_error\` | 🔴 | Desincronización entre el campo de stock y el resultado del historial |
| \`no_movements\` | 🔵 | Producto sin historial de movimientos — stock no es verificable |
| \`legacy_bug\` | 🟡 | Discrepancia originada por un bug anterior ya corregido |

---

### ✅ Resolver una Discrepancia

Para cada producto con discrepancia, el administrador tiene dos opciones:

| Opción | Resultado |
|---|---|
| **Aceptar stock actual** | Se registra que el valor actual es correcto y se cierra la discrepancia |
| **Revertir al valor calculado** | El stock se actualiza al valor resultante del historial; se crea un movimiento de reconciliación trazable |

> 💡 El movimiento de reconciliación queda registrado en el historial con el tipo "Ajuste" y una nota indicando que fue generado por auditoría.

---

### 📋 Historial de Auditorías

Cada resolución queda guardada en \`InventoryAuditLog\` con:
- Fecha y hora de la auditoría
- Tipo de discrepancia detectada
- Valor previo y valor corregido
- Usuario que realizó la acción

---

### 💡 Cuándo usar la Auditoría

- Después de una importación masiva de productos
- Si un proveedor reporta una diferencia de stock
- Al sospechar que un movimiento se registró incorrectamente
- Como rutina mensual de control de inventario`
  },

  // ─── PAGOS A PROVEEDORES ──────────────────────────────────────────────────
  {
    id: "supplier-payments-guide",
    category: "Pagos a Proveedores",
    role: "admin",
    title: "💳 Pagos a Proveedores — Guía Completa",
    keywords: ["pagos proveedores", "desembolso", "supplier payment", "utilidad neta", "caja chica egreso", "proveedor pago", "reportes proveedores"],
    related_ids: ["petty-cash-overview", "settings-categories", "reports-admin"],
    content: `## 💳 Pagos a Proveedores

> 📍 *Menú lateral → Pagos a Proveedores*

El módulo de Pagos a Proveedores permite registrar y dar seguimiento a los desembolsos realizados a tus proveedores. Es fundamental para calcular la **utilidad neta real** de tu negocio.

---

### 🎯 ¿Por qué registrar pagos a proveedores?

Sin registrar lo que pagas a tus proveedores, el Dashboard solo muestra ingresos — no la ganancia real. Al registrar cada pago:

- El Dashboard muestra la **Utilidad Neta** = Ingresos − Pagos a proveedores
- Puedes ver qué proveedores consumen más de tu flujo de efectivo
- Los reportes comparan pagos vs período anterior

---

### ➕ Registrar un Pago

1. Ve a **Pagos a Proveedores** en el menú lateral
2. Haz clic en **"+ Nuevo Pago"**
3. Completa:
   - **Proveedor** — busca por nombre de negocio o contacto
   - **Monto** — importe del pago
   - **Fecha** — fecha del desembolso
   - **Método de pago** — forma en que se realizó el pago
   - **Concepto** — descripción breve (ej: "Factura #1234", "Pago parcial")
   - **Notas** — información adicional opcional
4. Guarda el pago

---

### 💵 Toggle Caja Chica

Si el pago se realizó con efectivo de la caja chica, activa el toggle **"Descontar de Caja Chica"**:

- Solo aparece cuando el método de pago es **Efectivo**
- Al activarlo, se crea automáticamente un egreso en Caja Chica vinculado al pago
- El egreso queda marcado como \`generated_by_system\` — no es editable directamente

> 💡 El toggle se resetea automáticamente si cambias el método de pago a uno que no sea efectivo.

---

### 📊 Dashboard — Sección Pagos a Proveedores

El Dashboard ahora incluye:

| Elemento | Descripción |
|---|---|
| **Gráfico de barras** | Pagos por período seleccionado |
| **Top 5 proveedores** | Los que más recibieron pagos en el período |
| **Análisis de Ventas** | Nueva línea "Pagos a Proveedores" y línea "Utilidad Neta" |
| **Badge de impacto** | 🟢 Bajo / 🟡 Medio / 🔴 Alto (>80% de ingresos) |

---

### 📈 Reportes — Pestaña Pagos a Proveedores

En el módulo de Reportes encontrarás la pestaña **Pagos a Proveedores** con:

- Gráfico acumulativo de pagos en el período
- KPIs de monto total y cantidad de pagos
- Comparativo vs período anterior (delta en $ y %)

---

### 🔍 Filtros Disponibles

| Filtro | Para qué sirve |
|---|---|
| **Proveedor** | Ver solo pagos a un proveedor específico |
| **Período** | Hoy, Esta semana, Este mes, Rango personalizado |
| **Método de pago** | Filtrar por forma de pago usada |`
  },

  // ─── LICENCIAS / CICLO DE VIDA ────────────────────────────────────────────
  {
    id: "account-lifecycle",
    category: "Licencias",
    role: "admin",
    title: "🔄 Ciclo de Vida de la Cuenta — Emails y Transiciones Automáticas",
    keywords: ["ciclo de vida", "email", "trial", "expiración", "renovación", "auto-renovación", "view_only", "archived", "notificación"],
    related_ids: ["license-overview", "platform-tenant-rules"],
    content: `## 🔄 Ciclo de Vida de la Cuenta

StockFlow gestiona automáticamente el estado de cada negocio y envía notificaciones por email en cada transición importante.

---

### 📊 Estados de la Cuenta

\`\`\`
Trial activo → Trial por expirar → Modo Solo Lectura → Archivado → Eliminado
\`\`\`

| Estado | Descripción | Acceso |
|---|---|---|
| **Trial activo** | Período de prueba de 30 días | Acceso completo |
| **Trial por expirar** | Últimos días del trial | Acceso completo + avisos |
| **Solo Lectura** | Trial vencido sin licencia | Solo consulta, sin escritura |
| **Archivado** | Cuenta inactiva prolongada | Solo consulta |
| **Eliminado** | Datos programados para borrado | Sin acceso |

---

### 📧 Emails Automáticos

El sistema envía notificaciones en español en los siguientes momentos:

| Evento | Destinatario |
|---|---|
| Inicio de trial | Administrador del negocio (bienvenida) |
| 30 días antes de expirar | Administrador del negocio |
| 15, 7, 3 y 1 días antes | Recordatorios escalonados |
| Al pasar a Modo Solo Lectura | Notificación + instrucciones de activación |
| Al archivarse | Aviso de archivado |
| Renovación mensual | Confirmación de renovación |

---

### ☑️ Auto-Renovación

Los negocios con licencia activa pueden configurar la **auto-renovación mensual**:

- El administrador de plataforma activa el checkbox en el panel de licencias
- El proceso de renovación se ejecuta automáticamente el día 1 de cada mes
- Se envía un email de confirmación al renovar

---

### ⏰ Scheduler Diario

Un proceso automático se ejecuta cada día y:
1. Revisa todos los tenants con trial próximo a vencer
2. Transiciona automáticamente al estado correspondiente
3. Activa el envío de los emails de notificación

---

### 🛡️ Modo Solo Lectura

Cuando una cuenta entra en Modo Solo Lectura:
- Los usuarios pueden iniciar sesión y consultar datos normalmente
- No es posible crear, editar ni eliminar registros (protegido en frontend y backend)
- Un banner visible explica la situación con enlace para activar licencia

> Para reactivar el acceso completo, contacta al equipo de StockFlow para confirmar el pago de licencia.`
  },

  // ─── PROVEEDORES — MÚLTIPLES CONTACTOS ───────────────────────────────────
  {
    id: "supplier-multiple-contacts",
    category: "Configuración",
    role: "admin",
    title: "👥 Múltiples Contactos por Proveedor",
    keywords: ["proveedor", "contacto", "múltiples contactos", "extra_contacts", "contacto adicional", "proveedor contacto"],
    related_ids: ["settings-categories", "supplier-payments-guide"],
    content: `## 👥 Múltiples Contactos por Proveedor

> 📍 *Catálogos → Proveedores → Editar proveedor*

Cada proveedor puede tener un **contacto principal** (obligatorio) y cualquier número de **contactos adicionales** opcionales.

---

### 🎯 ¿Para qué sirve?

Antes, si un proveedor tenía varios contactos (gerente de ventas, logística, cobranza), era necesario crear registros duplicados del mismo proveedor. Ahora todos los contactos viven en un único registro.

---

### 📋 Estructura de Contactos

**Contacto Principal** *(obligatorio)*
- Nombre de contacto
- Teléfono
- Email

**Contactos Adicionales** *(opcionales)*
- Se pueden agregar con el botón **"+ Agregar contacto"**
- Cada contacto adicional tiene: nombre, teléfono, email y rol/cargo
- Se pueden eliminar individualmente

---

### ✏️ Cómo Agregar Contactos

1. Ve a **Catálogos → Proveedores**
2. Edita el proveedor (ícono ✏️)
3. En la sección **Contactos**, el primer bloque es el contacto principal
4. Haz clic en **"+ Agregar contacto"** para cada contacto adicional
5. Llena los datos y guarda

---

### 💡 Buenas Prácticas

- Usa el campo **Rol/Cargo** para identificar rápidamente a quién contactar según la necesidad (Ventas, Logística, Cobranza)
- Mantén el contacto principal actualizado — es el que aparece en las vistas de lista
- Los contactos adicionales se guardan en el campo \`extra_contacts\` del proveedor`
  },

  // ─── VERSIÓN ──────────────────────────────────────────────────────────────
  {
    id: "version-about",
    category: "Versión y Actualizaciones",
    role: "all",
    title: "📋 Versión de la App y Últimos Cambios",
    keywords: ["versión", "actualización", "changelog", "acerca de", "about", "novedades", "cambios", "release", "1.5.0"],
    related_ids: ["welcome-admin", "pending-payments", "movements-register"],
    content: `## 📋 Versión de la App y Registro de Cambios

StockFlow muestra la versión actual y el historial de cambios en la pestaña **Acerca de**.

---

### 📍 ¿Dónde ver la versión?

Ve a **Acerca de** en el menú lateral.

Verás:
- **Versión actual** — número de versión y fecha de lanzamiento
- **Últimos cambios** — lista de mejoras de esta versión
- **Historial de versiones** — cambios de versiones anteriores

---

### 🆕 Versión 1.5.0 — Últimos cambios *(1 de abril 2026)*

| Área | Novedad |
|---|---|
| **Movimientos** | Toggle "Pago recibido" al registrar salidas directas |
| **Movimientos** | Columna "Pago" en tabla con badge Pendiente/Cobrado y confirmación con un toque |
| **Dashboard** | Alerta naranja unificada de cobros pendientes: cotizaciones + movimientos directos |
| **Dashboard** | Desglose en la alerta: cuántas son cotizaciones vs movimientos directos |

---

### 📌 Versión 1.4.0 *(31 de marzo 2026)*

| Área | Novedad |
|---|---|
| **Cotizaciones** | Botón "Ruta" unificado con opciones En Ruta / Entregado / Quitar estado |
| **Cotizaciones** | Indicador rojo pulsante "¡Cobrar!" para pedidos entregados sin cobrar |
| **Reportes** | Filas resaltadas en rojo para ventas entregadas sin cobrar |

---

### 💡 ¿Cómo saber si tengo la versión más reciente?

La versión siempre está visible en la pestaña **Acerca de**. Contacta al equipo de soporte si tienes dudas.`
  },
  // ─── REPORTES OPERACIONALES (movido desde Novedades) ─────────────────────
  {
    id: "reports-movement-stock",
    category: "Reportes",
    role: "almacenista",
    title: "📊 Reporte de Movimientos de Stock",
    keywords: ["movimientos", "stock", "entrada", "salida", "historial", "almacenista", "reporte operacional"],
    related_ids: ["movements-overview", "reports-all"],
    content: `## 📊 Reporte de Movimientos de Stock

La pestaña **Movimientos de Stock** muestra el historial detallado de entradas, salidas, devoluciones y ajustes del período seleccionado.

---

### 📋 Columnas

| Columna | Descripción |
|---|---|
| **Fecha** | Cuándo ocurrió el movimiento |
| **Producto** | Producto movido |
| **Tipo** | Entrada, Salida, Devolución o Ajuste |
| **Cantidad** | Unidades |
| **Total** | Monto asociado |
| **Stock Resultante** | Unidades tras el movimiento |

---

### 🎯 Casos de Uso

- **Reconciliar inventario**: filtra por rango de fechas y verifica movimiento por movimiento
- **Auditoría de entradas**: filtra por tipo "Entrada" para revisar mercancías del proveedor
- **Análisis de ventas**: filtra por "Salida" para ver volumen sin cotizaciones

Haz clic en **CSV** para descargar el período seleccionado.`
  },
  {
    id: "reports-pending-payment",
    category: "Reportes",
    role: "almacenista",
    title: "💰 Reporte de Pendientes de Cobro",
    keywords: ["cobranza", "pendiente", "pago", "venta sin cobro", "almacenista", "operación diaria"],
    related_ids: ["quotations-convert", "reports-all", "quotations-states"],
    content: `## 💰 Pendientes de Cobro

Muestra todas las ventas sin cobrar para gestionar la cobranza del día a día.

---

### 📊 Tarjetas Resumen

| Tarjeta | Qué muestra |
|---|---|
| **Total Ventas** | Cotizaciones convertidas en venta del período |
| **Cobrado** | Monto ya pagado |
| **Pendiente de Pago** | Dinero que falta cobrar |

---

### 🔴 Alerta — Entregado sin Cobrar

- El botón de Pago se vuelve **🔴 rojo y pulsante**
- El folio aparece con la etiqueta **"¡COBRAR!"**

---

### 💡 Consejos

1. Revisa este reporte diariamente
2. Prioriza los "Entregado sin Cobrar" — son los más urgentes
3. Registra el pago en el momento para mantener la cobranza al día`
  },
  {
    id: "reports-predictive-intro",
    category: "Reportes",
    role: "admin",
    title: "🔮 Capa Predictiva/Inteligente de Reportes — Introducción",
    keywords: ["predictivo", "inteligente", "análisis", "admin", "owner", "determinístico", "8 reportes"],
    related_ids: ["reports-admin", "reports-all", "dashboard-admin"],
    content: `## 🔮 Capa Predictiva/Inteligente de Reportes

**Disponible solo para Administradores.**

Conjunto de **8 reportes avanzados** con lógica determinística interna, sin APIs externas ni créditos de integración.

---

### 📋 Los 8 Reportes

1. **Análisis Dinámico (Pivot)** — Cruza múltiples dimensiones de datos
2. **Más Vendidos** — Productos por valor de ventas
3. **Baja Rotación** — Productos con poco movimiento
4. **Tendencia** — Evolución diaria de entradas/salidas
5. **Riesgo de Agotamiento** — Proyección de días para desabasto
6. **Sugerencia de Resurtido** — Cantidades recomendadas a pedir
7. **Riesgo de Cobranza** — Scoring de deudas problemáticas
8. **Discrepancias/Anomalías** — Detección de irregularidades

---

### 🔒 Acceso

- ✅ Admin / Owner
- ❌ Almacenista / Sales / Storekeeper

Ve a **Reportes → Análisis Inteligente**.`
  },
  {
    id: "reports-prediction-admin",
    category: "Reportes",
    role: "admin",
    title: "🔮 Predicción Inteligente de Pedidos",
    keywords: ["predicción", "tendencia", "pedidos", "semanas", "stock", "admin", "alerta"],
    related_ids: ["reports-predictive-intro", "products-inventory", "dashboard-admin"],
    content: `## 🔮 Predicción Inteligente de Pedidos

Analiza los últimos 60 días de movimientos para indicarte cuándo pedir a cada proveedor sin quedarte sin stock.

---

### 📊 Cálculo

\`\`\`
Semanas disponibles = Stock actual ÷ (Promedio por venta × Ventas por semana)
\`\`\`

---

### 🎯 Niveles de Alerta

| Alerta | Rango | Acción |
|---|---|---|
| 🔴 **URGENTE** | < 2 semanas | Pedir YA |
| 🟡 **PRONTO** | 2-4 semanas | Preparar solicitud |
| 🟢 **OK** | > 4 semanas | Monitorear |

---

### 💡 Rutina Semanal

1. Revisa los 🔴 URGENTE — llama al proveedor hoy
2. Prepara solicitudes para los 🟡 PRONTO — esta semana
3. Los 🟢 OK no necesitan atención`
  },
  {
    id: "reports-pivot-analysis",
    category: "Reportes",
    role: "admin",
    title: "📊 Análisis Dinámico (Pivot) — Cruza Tus Datos",
    keywords: ["pivot", "dinámico", "análisis", "cruzado", "producto", "categoría", "cliente", "mes", "semana"],
    related_ids: ["reports-predictive-intro", "reports-admin", "movements-overview"],
    content: `## 📊 Análisis Dinámico (Pivot Table)

Cruza datos de movimientos desde múltiples ángulos sin exportar a Excel.

---

### 🎮 Controles

| Control | Opciones |
|---|---|
| **Agrupar Filas** | Producto, Categoría, Cliente |
| **Agrupar Columnas** | Mes, Semana, Día |
| **Métrica** | Valor ($), Cantidad (u) |
| **Agregación** | Suma, Promedio, Mín, Máx, Contar |

---

### 💡 Ejemplos

- Ventas por Categoría × Mes → Filas: Categoría / Columnas: Mes / Valor: Suma
- Unidades por Producto × Semana → Filas: Producto / Columnas: Semana / Cantidad: Suma
- Clientes más rentables → Filas: Cliente / Columnas: Mes / Valor: Suma

Haz clic en **CSV** para descargar en Excel.`
  },
  {
    id: "reports-depletion-risk",
    category: "Reportes",
    role: "admin",
    title: "⚠️ Riesgo de Agotamiento — Proyección de Stock",
    keywords: ["agotamiento", "proyección", "riesgo", "desabasto", "días", "criticidad"],
    related_ids: ["reports-predictive-intro", "products-inventory", "reports-reorder-suggestion"],
    content: `## ⚠️ Riesgo de Agotamiento

Predice cuántos días le quedan a cada producto antes de agotarse, basado en el promedio de ventas de los últimos 30 días.

---

### 📊 Cálculo

\`\`\`
Días restantes = Stock actual ÷ Promedio diario de salidas (30 días)
\`\`\`

---

### 🎯 Niveles

| Nivel | Rango | Acción |
|---|---|---|
| 🔴 **Crítico** | < 7 días | Pedir YA |
| 🟠 **Alto** | 7-15 días | Preparar orden |
| 🟡 **Medio** | 15-30 días | Monitorear |
| 🟢 **Bajo** | > 30 días | Sin urgencia |`
  },
  {
    id: "reports-reorder-suggestion",
    category: "Reportes",
    role: "admin",
    title: "📦 Sugerencia de Resurtido — Cantidades Automáticas",
    keywords: ["resurtido", "sugerencia", "cantidad", "orden", "compra", "cálculo automático"],
    related_ids: ["reports-predictive-intro", "reports-depletion-risk", "products-inventory"],
    content: `## 📦 Sugerencia de Resurtido

Calcula cuántas unidades pedir basándose en consumo histórico y stock actual.

---

### 🧮 Fórmula

\`\`\`
Sugerencia = Máx(0, Promedio diario × 45 días − Stock actual)
\`\`\`

---

### 🎯 Urgencias

| Urgencia | Acción |
|---|---|
| 🔴 **Crítica** | Llama al proveedor HOY |
| 🟠 **Alta** | Prepara solicitud esta semana |
| 🟡 **Media** | Avisa al proveedor pronto |

---

### 💡 Cómo Usar

Abre el reporte cada lunes, copia los productos con urgencia Crítica y Alta, y contacta a tus proveedores con los números sugeridos.`
  },
  {
    id: "reports-collections-risk",
    category: "Reportes",
    role: "admin",
    title: "💳 Riesgo de Cobranza — Scoring de Deudas",
    keywords: ["cobranza", "deuda", "riesgo", "antigüedad", "scoring", "seguimiento"],
    related_ids: ["reports-predictive-intro", "quotations-convert", "quotations-states"],
    content: `## 💳 Riesgo de Cobranza

Puntúa el riesgo de cada deuda pendiente (0-100) considerando antigüedad, monto y estado de entrega.

---

### 🎯 Niveles

| Nivel | Rango | Acción |
|---|---|---|
| 🔴 **Crítico** | > 80 | Llamar hoy |
| 🟠 **Alto** | 60-80 | Seguimiento esta semana |
| 🟡 **Medio** | 40-60 | Monitorear |

---

### 💡 Estrategia de Cobranza

1. Semana 1: Cobra los Críticos
2. Semana 2: Sigue con los Altos
3. Semana 3+: Monitorea los Medios

Exporta a CSV para tu lista de seguimiento en Excel.`
  },
  {
    id: "reports-anomalies",
    category: "Reportes",
    role: "admin",
    title: "🔍 Discrepancias/Anomalías — Detección de Irregularidades",
    keywords: ["anomalía", "discrepancia", "irregular", "error", "inconsistencia", "auditoría"],
    related_ids: ["reports-predictive-intro", "movements-overview", "quotations-states"],
    content: `## 🔍 Discrepancias y Anomalías

Detector automático de irregularidades basado en 5 reglas determinísticas.

---

### 🎯 Las 5 Reglas

| # | Anomalía | Acción |
|---|---|---|
| 1️⃣ | Salida sin cotización documentada | Verifica que la venta esté documentada |
| 2️⃣ | Throughput excesivo en un día | Revisa movimientos del día |
| 3️⃣ | Producto estancado 90+ días | Evalúa descontinuar o promover |
| 4️⃣ | Stock muy superior al mínimo | Reduce recompras |
| 5️⃣ | Cotización vencida sin cancelar | Cancela explícitamente |

---

### 💡 Rutina Recomendada

1. Revisa anomalías por severidad — primero rojos y naranjas
2. Documenta las correcciones realizadas
3. Vuelve a ejecutar el reporte en 2 semanas`
  },

  // ─── CONFIGURACIÓN — ELIMINACIÓN CON RAZÓN (movido desde Novedades) ──────
  {
    id: "settings-delete-reason",
    category: "Configuración",
    role: "almacenista",
    title: "🗑️ Eliminar Catálogos — Razón Obligatoria",
    keywords: ["eliminar", "categoría", "proveedor", "razón", "motivo", "auditoría", "almacenista"],
    related_ids: ["settings-categories", "settings-business"],
    content: `## 🗑️ Eliminar Catálogos — Registro de Razón

Cuando un **Almacenista** elimina una categoría, proveedor u otro catálogo, el sistema requiere una razón escrita.

---

### ✅ Por Qué es Obligatorio

- **Auditoría:** Administradores pueden ver quién eliminó qué y por qué
- **Prevención de errores:** Obliga a reflexionar antes de eliminar
- **Trazabilidad:** Cada acción queda registrada con su motivo

---

### 📋 Flujo

1. Clic en 🗑️ junto al elemento a eliminar
2. El diálogo pide **confirmación** + **razón** (campo obligatorio)
3. Escribe un motivo claro y confirma

---

### 💡 Ejemplos de Razones Válidas

✅ "Categoría obsoleta, descontinuamos esta línea"
✅ "Proveedor ya no trabaja con nosotros"
✅ "Producto duplicado — merge con otra categoría"

❌ Evita: frases vacías o sin contexto`
  },

  // ─── CAJA CHICA — VENTAS EN EFECTIVO (movido desde Novedades) ────────────
  {
    id: "tenant-cash-sales-to-petty-cash",
    category: "Caja Chica",
    role: "all",
    visibility_scope: "tenant_rule",
    required_rule_key: "cash_sales_to_petty_cash",
    title: "💵 Ventas en efectivo se reflejan automáticamente en Caja Chica",
    keywords: ["caja chica", "efectivo", "venta", "automático", "ingreso", "cotización", "movimiento", "reconciliación"],
    related_ids: ["petty-cash-overview", "quotations-convert", "movements-register"],
    content: `## 💵 Ventas en Efectivo → Caja Chica (Automático)

En este negocio, las ventas cobradas en efectivo se registran automáticamente como ingresos en Caja Chica. **No necesitas hacerlo manualmente.**

---

### ¿Cuándo se genera el ingreso?

| Situación | Resultado |
|---|---|
| Cotización convertida con pago en efectivo | ➕ Ingreso automático |
| Movimiento directo cobrado en efectivo | ➕ Ingreso automático |

---

### ¿Puedo editar o eliminar esos ingresos?

**No directamente.** Están marcados como entradas del sistema para proteger la integridad de la información.

---

### Reconciliación Automática

| Evento | Resultado en Caja Chica |
|---|---|
| Cotización cancelada o anulada | ➖ Ingreso eliminado automáticamente |
| Pago revertido | ➖ Ingreso eliminado automáticamente |
| Forma de pago cambiada a no-efectivo | ➖ Ingreso eliminado automáticamente |
| Movimiento directo eliminado | ➖ Ingreso eliminado automáticamente |

---

### 💡 Tip

Los ingresos automáticos aparecen marcados como **"Sistema"** en el historial de Caja Chica para distinguirlos de los manuales.`
  },

  // ─── PERMISOS GRANULARES ─────────────────────────────────────────────────
  {
    id: "granular-permissions",
    category: "Configuración",
    role: "admin",
    title: "🔐 Permisos Granulares — Control de Acceso por Módulo y Rol",
    keywords: ["permisos", "granular", "acceso", "rol", "módulo", "matrix", "admin", "almacenista", "visibility", "escritura", "eliminar"],
    related_ids: ["settings-team", "roles-overview", "platform-tenant-rules"],
    content: `## 🔐 Permisos Granulares

> 📍 *Menú lateral → Permisos* (visible solo para Administradores)

El sistema de Permisos Granulares permite controlar exactamente qué puede hacer cada rol en cada módulo de StockFlow, con granularidad a nivel de acción.

---

### ⚠️ Activación

Los permisos granulares están **desactivados por defecto**. Para activarlos, el administrador de plataforma debe habilitar la regla \`enable_granular_permissions\` para el tenant.

> Mientras esté desactivada, el comportamiento de la app es exactamente igual al anterior — sin impacto en los usuarios.

---

### 🎯 ¿Qué se puede controlar?

Para cada módulo y para cada rol (Admin, Almacenista/Member), puedes configurar accesos de visualización y operación.

**Módulos activos cubiertos por la matriz:**
- Dashboard
- Productos
- Categorías
- Proveedores
- Clientes
- Tipo de Pago
- Movimientos
- Cotizaciones
- Caja Chica
- Pagos a Proveedores
- Reportes
- Configuración

| Acción estándar | Descripción |
|---|---|
| **View** | Ver página, tarjetas, tablas y visuales del módulo |
| **Add** | Crear nuevos registros |
| **Modify** | Editar registros existentes |
| **Delete** | Eliminar registros |

---

### 🧭 Política de Defaults por Rol

- **Admin:** todos los permisos inician en **true** por defecto.
- **Member/Almacenista:** mantiene acceso operativo; los permisos sensibles y cualquier permiso **nuevo** inician en **false**.
- **Regla de crecimiento:** cuando se crea un módulo, visual o acción nueva, el default para member queda en **false** hasta que un admin lo otorgue explícitamente.

---

### 🛡️ Golden Rule

Los permisos granulares son **capas aditivas** sobre los controles de acceso existentes. Nunca los reemplazan.

- Un bug en los datos de permisos solo puede **reducir** el acceso — nunca ampliarlo
- Los controles \`isAdmin\` originales permanecen intactos como guardia de seguridad

---

### 📋 Cómo Configurar

1. Ve a **Permisos** en el menú lateral
2. Selecciona el rol a configurar (Admin o Almacenista)
3. En la matriz, activa o desactiva las acciones por módulo
4. Haz clic en **Guardar perfil**
5. Los cambios aplican inmediatamente para todos los usuarios de ese rol

---

### 🔍 Visibilidad de Campos

Además de controlar el acceso a páginas y acciones, el sistema puede ocultar campos sensibles según el rol:

| Campo | Admin | Almacenista |
|---|---|---|
| Precio de compra | ✅ Visible | ❌ Oculto |
| Margen de ganancia | ✅ Visible | ❌ Oculto |
| Costo de lo vendido | ✅ Visible | ❌ Oculto |

> Esta configuración es automática cuando los permisos granulares están activos.`
  },

  // ─── CLIENTES — PRECIO CERO / MUESTRAS / INTERNOS ────────────────────────
  {
    id: "client-force-zero-price",
    category: "Clientes",
    role: "admin",
    title: "🎁 Clientes con Precio $0 — Transferencias Internas y Muestras",
    keywords: ["precio cero", "force_zero_price", "muestra", "sample", "transferencia interna", "sin cargo", "gratis", "caja chica", "interno", "sucursal"],
    related_ids: ["pricing-clients", "settings-clients", "quotations-convert"],
    content: `## 🎁 Clientes con Precio $0 — Transferencias Internas y Muestras

Algunos clientes representan **destinatarios internos o de cortesía** que reciben mercancía sin costo: otra sucursal del negocio, un empleado que recibe muestras, o un cliente especial con acuerdo de cortesía.

---

### ⚙️ La opción "Forzar precio $0"

En el perfil del cliente, existe la bandera **"Forzar precio $0 en todas las ventas"** (\`force_zero_price\`).

Cuando está activada:

| Comportamiento | Resultado |
|---|---|
| **Total de cualquier cotización** | Siempre $0.00 — sin importar los productos o cantidades |
| **Conversión a venta** | Se registra automáticamente como **pagada** y con método "Sin cargo" — sin necesidad de confirmar pago |
| **Caja Chica** | **No genera ningún movimiento** — el sistema no registra ingresos de $0 |
| **Seguimiento de cobranza** | La cotización queda excluida de todas las alertas de cobro pendiente |
| **Reportes de ventas** | La cotización NO aparece en los reportes de ventas ni en los totales de ingresos |

---

### 🎯 Casos de uso típicos

| Situación | Ejemplo |
|---|---|
| **Transferencia interna entre sucursales** | Enviar mercancía del almacén central a una sucursal propia |
| **Muestras de producto** | Entregar muestras a clientes potenciales o a un promotor |
| **Consumo interno del negocio** | Productos usados por el equipo (papelería, herramientas propias) |
| **Cortesía acordada** | Cliente VIP con acuerdo especial de costo cero en ciertas líneas |

---

### 🔒 Diferencias con otras opciones de precio

| Opción del cliente | Precio aplicado | Genera caja chica | Aparece en reportes |
|---|---|---|---|
| Sin configuración | Menudeo / Mayoreo | Sí (si es efectivo) | Sí |
| Forzar precio mayoreo | Precio mayoreo | Sí (si es efectivo) | Sí |
| Forzar precio de compra | Precio de compra | Sí (si es efectivo) | Sí |
| **Forzar precio $0** | **$0.00 siempre** | **No — nunca** | **No — excluida** |

---

### ✏️ Cómo configurar

1. Ve a **Catálogos → Clientes**
2. Edita el cliente (ícono ✏️)
3. En la sección "Configuración de Precios", activa **"Forzar precio $0 (transferencias / muestras)"**
4. Guarda los cambios

> ⚠️ Esta opción es **mutuamente excluyente** con "Forzar precio mayoreo" y "Forzar precio de compra". Solo una puede estar activa a la vez.

---

### 📋 Identificación en cotizaciones

Las cotizaciones de clientes con \`force_zero_price\` muestran un chip especial:

**🎁 Muestra / Interno · Sin cargo**

En lugar del botón de pago habitual — confirma visualmente que la operación es no comercial.`,
  },

  // ─── COTIZACIONES ON-DEMAND ───────────────────────────────────────────────
  {
    id: "quotations-on-demand",
    category: "Cotizaciones",
    role: "all",
    title: "📋 Cotizaciones por Demanda (On-Demand)",
    keywords: ["on-demand", "demanda", "cotización", "solicitud", "pendiente", "aprobación", "sin stock", "pedido especial"],
    related_ids: ["quotations-create", "quotations-states", "quotations-convert"],
    content: `## 📋 Cotizaciones por Demanda (On-Demand)

El flujo **On-Demand** permite registrar productos solicitados por un cliente antes de que estén en el catálogo o cuando el stock no es relevante en el momento de la solicitud.

---

### 🎯 ¿Para qué sirve?

- Registrar solicitudes de clientes que piden productos fuera de catálogo
- Capturar pedidos especiales sin necesidad de crear el producto primero
- Gestionar solicitudes en cola antes de confirmar disponibilidad

---

### 📋 Flujo On-Demand

1. **Registrar solicitud**: en el módulo de Cotizaciones, usa el botón **"+ On-Demand"** para capturar la solicitud del cliente
2. **Panel de Pendientes**: las solicitudes quedan en el panel **"Pendientes On-Demand"** esperando revisión
3. **Revisar y aprobar**: el administrador revisa la solicitud y puede:
   - **Convertir a cotización formal** — genera una cotización con los productos solicitados
   - **Rechazar** — descarta la solicitud con una nota

---

### 🗂️ Panel de Pendientes

El panel de Pendientes On-Demand muestra:
- Cliente solicitante
- Productos solicitados y cantidades
- Fecha de solicitud
- Acciones disponibles (Convertir / Rechazar)

---

### 💡 Diferencia con una Cotización Normal

| Aspecto | Cotización Normal | On-Demand |
|---|---|---|
| Stock requerido | Sí (valida disponibilidad) | No (solo registra la solicitud) |
| Efecto en inventario | Inmediato al convertir | Ninguno hasta convertir a cotización |
| Flujo de aprobación | Directo | Requiere revisión previa |`
  },

  {
    id: "quotation-payments",
    category: "Cotizaciones",
    role: "all",
    title: "Pagos Parciales y Saldo en Cotizaciones",
    keywords: ["pagos", "abonos", "saldo", "pendiente", "cobro", "cotización", "parcial", "historial", "caja chica"],
    related_ids: ["quotations-on-demand", "pending-payments", "release-2-11-0"],
    content: `## Pagos Parciales en Cotizaciones

StockFlow permite registrar **abonos parciales o totales** en cualquier cotización convertida o entregada, con historial completo de pagos y saldo en tiempo real.

---

### ¿Cómo registrar un pago?

1. Abre la cotización desde la página **Cotizaciones**
2. En la sección **Pagos** (parte inferior del detalle), haz clic en **Registrar Pago**
3. Completa los campos:
   - **Monto**: ingresa el importe del abono (no puede superar el saldo pendiente)
   - **Método de pago**: selecciona el método configurado para tu negocio
   - **Fecha**: por defecto el día de hoy, editable
   - **Notas**: campo opcional para referencia interna
4. Si el método es **Efectivo**, activa el toggle **Registrar en Caja Chica** para crear un ingreso automático
5. Haz clic en **Guardar Pago**

El sistema actualiza inmediatamente \`amount_paid\`, \`balance\` y, si el saldo llega a 0, marca la cotización como **pagada**.

---

### Historial de Pagos

Cada abono registrado aparece en la lista de pagos con:
- Monto cobrado
- Método de pago
- Fecha del pago
- Notas (si se ingresaron)

El resumen siempre muestra **Total**, **Cobrado** y **Saldo Pendiente**.

---

### Alerta de Saldo Pendiente — Dashboard

El **Dashboard** incluye una alerta roja automática cuando existen cotizaciones **entregadas con saldo sin cobrar**. La alerta muestra cuántas cotizaciones tienen deuda pendiente y el monto total. Haz clic en **Ver Cotizaciones** para ir directo a gestionarlas.

---

### Permisos

| Acción | Admin | Almacenista |
|---|---|---|
| Ver historial de pagos | ✅ | ✅ |
| Registrar pago | ✅ | ✅ |

Los vendedores sin acceso al panel de pagos ven el saldo pero no pueden registrar abonos.

---

### Compatibilidad con cotizaciones anteriores

Las cotizaciones creadas antes de v2.11.0 (que tenían solo \`paid: true/false\`) son compatibles automáticamente. El sistema calcula \`balance\` y \`amount_paid\` a partir del estado anterior sin necesidad de migración.`
  },
];