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
];