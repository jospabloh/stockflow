// Artículos de ayuda — última versión: v2.5.7
// Correcciones: resolución de precios por cliente, consistencia de inventario, accesibilidad móvil, viewport iOS

export const newHelpArticles = [
    {
      id: "release-2-5-7",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.5.7 — Correcciones: Precios por Cliente, Stock, Mobile",
      keywords: ["versión", "2.5.7", "precio", "cliente", "mayoreo", "compra", "stock", "mobile", "ios", "zoom", "formulario"],
      related_ids: ["movements-overview", "products-inventory", "dashboard-admin"],
      content: `## 🆕 Versión 2.5.7 — 9 de abril de 2026

### ✅ Cambios de esta versión

#### 💰 Corrección: Precios por Cliente en Formulario de Movimientos

**Problema resuelto:** Al registrar una salida directa en Movimientos, el precio mostrado y guardado **ignoraba las reglas especiales del cliente** (forzar precio de compra o precio de mayoreo). El precio siempre usaba el precio menudeo sin importar qué cliente se seleccionara.

**Ahora:** Al seleccionar un cliente en el formulario de movimientos, el precio **se recalcula inmediatamente** aplicando las reglas configuradas:

| Configuración del cliente | Precio aplicado |
|---|---|
| **Forzar precio de compra** (+ transporte) | Precio de compra del producto |
| **Forzar precio de mayoreo** | Precio mayoreo del producto |
| **Sin configuración especial** | Precio menudeo (o mayoreo si supera cantidad mínima) |

> **Importante:** Esta corrección aplica tanto al precio visible en pantalla como al precio que se guarda en el movimiento.

---

#### 📦 Corrección de Consistencia de Inventario

Se mejoró la sincronización entre el campo de stock de un producto y el historial de movimientos registrados.

**Comportamiento anterior:** En ciertos casos, el stock visible de un producto podía mostrar un valor diferente al que resultaba del historial de movimientos, causando confusión sobre el inventario real.

**Ahora:** El sistema detecta y corrige discrepancias entre el stock almacenado y el valor resultante del último movimiento registrado (\`stock_after\`), asegurando que el inventario mostrado sea consistente con el historial.

> Si notas en tu negocio que el stock de un producto no coincide con el historial de movimientos, contacta al administrador del sistema para revisión.

---

#### 📱 Corrección Mobile: Botón "Registrar" Siempre Visible

**Problema resuelto:** En pantallas pequeñas o móviles, al abrir el formulario de registro de movimientos, el botón **"Registrar"** quedaba oculto debajo del área visible y era difícil o imposible alcanzarlo.

**Ahora:** El diálogo de movimientos tiene una altura máxima ajustada al viewport del dispositivo. El contenido del formulario hace scroll internamente y el botón de guardar **siempre está visible y accesible** en la parte inferior.

---

#### 📱 Corrección iOS: Zoom Involuntario / Recarga de Página

**Problema resuelto:** En iPhones y iPads, al hacer un gesto de "pellizco para acercar" (pinch-to-zoom) la pantalla se ampliaba, y al soltar el gesto en modo PWA instalada parecía recargar la página o perder la vista.

**Ahora:** El viewport está configurado para **desactivar el zoom de usuario** (\`maximum-scale=1.0\`), comportamiento estándar en aplicaciones nativas y PWA. La app se comporta como una app nativa sin zoom accidental.

---

### 📦 Versión Anterior — v2.5.6 (8 de abril de 2026)

#### 🔒 Gestión de Sesión por Inactividad Real (Idle Timeout)
La sesión ya no expira mientras el usuario está navegando activamente. El conteo solo inicia tras 20 minutos de inactividad total, con aviso previo de 2 minutos.
`
    },
    {
      id: "release-2-5-6",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.5.6 — Sesión Inteligente: Timeout Solo por Inactividad",
      keywords: ["versión", "2.5.6", "sesión", "inactividad", "timeout", "idle", "seguridad", "expirar"],
      related_ids: ["dashboard-admin"],
      content: `## 🆕 Versión 2.5.6 — 8 de abril de 2026

### ✅ Cambios de esta versión

#### 🔒 Gestión de Sesión por Inactividad Real (Idle Timeout)

**Problema resuelto:** Antes, la sesión podía cerrarse inesperadamente mientras el usuario estaba trabajando activamente en la app.

**Ahora:** La sesión **nunca expira mientras estés navegando o usando la app**. El conteo de inactividad solo inicia cuando dejas de interactuar completamente.

---

#### ⏱️ Cómo Funciona el Nuevo Sistema

| Acción | Resultado |
|---|---|
| El usuario hace click, escribe, hace scroll | Timer de inactividad se **reinicia** — sesión segura |
| El usuario deja la app abierta sin usar por **20 minutos** | Aparece aviso de inactividad |
| El usuario hace click en "Seguir trabajando" | Sesión renovada, timer reiniciado |
| El usuario ignora el aviso por **2 minutos más** | Se muestra pantalla de sesión expirada |

---

#### 🛡️ Heartbeat Inteligente

El sistema ya no envía actualizaciones de sesión cuando la app está inactiva. Solo mantiene la sesión viva mientras el usuario está trabajando activamente.

**Beneficio:** Menos llamadas innecesarias al servidor y mayor precisión en el cierre de sesión.

---

#### 🔔 Los Dos Avisos de Sesión

**1. Aviso de inactividad (20 min):**
- Aparece un modal con cuenta regresiva de 2 minutos
- Botón "Seguir trabajando" para renovar la sesión inmediatamente
- Si se ignora, se cierra la sesión automáticamente

**2. Sesión expirada:**
- Aparece cuando se agota el tiempo tras el aviso
- Opciones: "Seguir trabajando" (redirige al login y regresa) o "Salir"
- Todos los datos guardados están seguros

---

### 📦 Versión Anterior — v2.5.5 (7 de abril de 2026)

#### 📊 Semáforo de Cotizaciones a 30 Días
El semáforo en el Dashboard ahora muestra solo las cotizaciones de los últimos 30 días para mayor relevancia.

#### 🚨 Alerta de Cobranza Vencida
Nueva alerta que detecta automáticamente cotizaciones convertidas sin cobrar fuera del período de 30 días.
`
    },
    {
      id: "release-2-5-5",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.5.5 — Semáforo de Cotizaciones a 30 días + Alerta de Cobranza Vencida",
      keywords: ["versión", "2.5.5", "semáforo", "cotizaciones", "cobranza", "vencida", "30 días", "dashboard"],
      related_ids: ["quotations-overview", "dashboard-admin", "quotations-states"],
      content: `## 🆕 Versión 2.5.5 — 7 de abril de 2026

### ✅ Cambios de esta versión

#### 📊 Semáforo de Cotizaciones — Filtro a Últimos 30 Días

El semáforo en el Dashboard ahora muestra **solo las cotizaciones de los últimos 30 días**, no todo el histórico.

**Qué ves:**
- 🟢 **Concretadas en venta** — Cotizaciones convertidas en los últimos 30 días
- 🟡 **Sin concretar (activas)** — Borradores, enviadas o aceptadas del período
- 🔴 **Canceladas** — Cotizaciones canceladas del período

**Etiqueta visible:** "En los últimos 30 días" para que siempre sepas el rango de datos.

---

#### 🚨 Nueva Alerta: Cobranza Vencida

Alerta roja en el Dashboard para cotizaciones concretadas sin cobrar fuera de los 30 días.

**Dónde aparece:** Justo arriba del "Análisis de Ventas", solo si existen deudas vencidas.

---

### 📦 Versión Anterior — v2.5.4 (7 de abril de 2026)

#### 🎯 Corrección Crítica de Navegación Mobile
Se corrigió la barra inferior de navegación para que sea siempre clickeable en dispositivos móviles.

#### 📜 Dialog Mejorado
El dialog de cotización ahora permite scroll interno sin bloquear la navegación de la app.
`
    },
    {
      id: "release-2-2-0",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.2.0 — Corrección de IVA y Folios en Cotizaciones",
      keywords: ["versión", "2.2.0", "iva", "impuesto", "cotización", "folio", "precio", "subtotal"],
      related_ids: ["quotations-create", "quotations-states"],
      content: `## 🆕 Versión 2.2.0 — 3 de abril de 2026

### ✅ Cambios de esta versión

#### 🧾 Corrección de Cálculo de IVA (Precio IVA-Inclusive)

Se corrigió un error crítico en el cálculo de impuestos en cotizaciones.

**Problema:** El sistema calculaba el IVA sumándolo encima del precio del producto, lo que resultaba en un total incorrecto más alto al esperado.

**Causa raíz:** Los precios de los productos en Baristop **ya incluyen IVA**. El sistema estaba tratándolos como precios sin IVA y aplicando el 16% adicional (doble conteo).

**Solución:** Ahora el IVA se **extrae** del precio inclusive:
\`\`\`
IVA = Precio × (tasa / (1 + tasa))
Subtotal sin IVA = Precio − IVA
Total = Precio (sin cambio)
\`\`\`

**Ejemplo COT-260403-0000:**
| Producto | Precio | IVA (extraído) |
|---|---|---|
| Base Neutra 2kg | $550.00 | $0.00 (exento) |
| Jarabe Crema Irlandesa 750ml | $239.00 | $32.97 (16%) |
| **Total** | **$789.00** | **$32.97** |

---

#### 🔢 Corrección de Folio — Secuencia desde 0001

Se corrigió un error donde el primer folio del día se generaba como \`COT-YYMMDD-0000\`.

**Solución:** La secuencia ahora comienza correctamente desde \`0001\`.

---

### 📦 Versión Anterior — v2.1.0 (2 de abril de 2026)

#### 🏢 Nombre del Negocio en el Sidebar
Se corrigió que el nombre del negocio no aparecía debajo de "StockFlow" en la barra lateral.

#### 🗄️ Datos de Prueba ACACIA OWNER SANDBOX

| Entidad | Cantidad |
|---|---|
| Categorías | 4 (Electrónica, Abarrotes, Papelería, Herramientas) |
| Proveedores | 2 |
| Clientes | 4 |
| Productos | 10 con SKU, barcode EAN-13, precios menudeo/mayoreo |
| Movimientos | 12 (entradas y salidas, 3 productos en stock bajo) |
| Cotizaciones | 4 (draft, sent, accepted, converted) |
| Caja Chica | 4 movimientos (fondo inicial + ingresos + egreso) |
`
    },
    {
      id: "reports-movement-stock",
      category: "Reportes",
      role: "almacenista",
      title: "📊 Reporte de Movimientos de Stock",
      keywords: ["movimientos", "stock", "entrada", "salida", "historial", "almacenista", "reporte operacional"],
      related_ids: ["movements-overview", "reports-all"],
      content: `## 📊 Reporte de Movimientos de Stock

La pestaña **Movimientos de Stock** está diseñada especialmente para Almacenistas, mostrando el **historial detallado de todas las entradas, salidas, devoluciones y ajustes** del período seleccionado.

---

### 📋 Qué verás en este reporte

| Columna | Descripción |
|---|---|
| **Fecha** | Cuándo ocurrió el movimiento |
| **Producto** | Nombre del producto que fue movido |
| **Tipo** | Entrada, Salida, Devolución o Ajuste |
| **Cantidad** | Unidades que entraron o salieron |
| **Total** | Monto asociado al movimiento |
| **Stock Resultante** | Cuántas unidades quedaron después del movimiento |

---

### 🎯 Casos de Uso

**Reconciliar inventario:**
Filtra el reporte por rango de fechas y verifica cada movimiento para asegurar que el stock del sistema es correcto.

**Auditoría de entradas:**
Filtra por tipo "Entrada" para revisar todas las mercancías que llegaron del proveedor.

**Análisis de ventas:**
Filtra por tipo "Salida" para ver el volumen de ventas del período sin conversiones a cotización.

**Búsqueda de errores:**
Si sospechas que un movimiento fue registrado incorrectamente, usa el filtro de fechas para localizarlo.

---

### 📥 Exportar Datos

Haz clic en el botón **CSV** para descargar todos los movimientos del período seleccionado en una hoja de cálculo. Útil para análisis detallado en Excel.`
    },
    {
      id: "reports-pending-payment",
      category: "Reportes",
      role: "almacenista",
      title: "💰 Reporte de Pendientes de Cobro",
      keywords: ["cobranza", "pendiente", "pago", "venta sin cobro", "almacenista", "operación diaria"],
      related_ids: ["quotations-convert", "reports-all", "quotations-states"],
      content: `## 💰 Pendientes de Cobro

Este reporte muestra **todas las ventas que aún no han sido cobradas**, ayudándote a gestionar la cobranza del día a día.

---

### 🎯 A Quién Va

Este reporte es **ideal para Almacenistas** que necesitan saber qué clientes aún deben dinero.

---

### 📊 Tarjetas Resumen

| Tarjeta | Qué muestra |
|---|---|
| **Total Ventas** | Suma de todas las cotizaciones convertidas en venta en el período |
| **Cobrado** | Monto total ya pagado |
| **Pendiente de Pago** | **Dinero que aún falta cobrar** — esto es lo importante para tu gestión |

---

### 🔴 Situación de Riesgo: "Entregado sin Cobrar"

Una de las alertas más importantes en el reporte es cuando un **pedido ya fue entregado al cliente pero aún no se ha cobrado**.

En este caso:
- El botón de **Pago** se vuelve **🔴 ROJO y PULSANTE** como advertencia
- El folio de la cotización se resalta con la etiqueta **"¡COBRAR!"**

**Acción inmediata:** Contacta al cliente para gestionar el pago pendiente.

---

### 📋 Filtros Disponibles

| Filtro | Para qué sirve |
|---|---|
| **Estado** | Filtra por estado de la cotización (Todas, Concretadas, etc.) |
| **Cliente** | Busca pedidos de un cliente específico |
| **Forma de Pago** | Filtra por método de pago (Efectivo, Transferencia, Tarjeta) |
| **Pago** | Muestra solo Pagadas, Pendientes, o Todas |

---

### 💡 Consejos de Cobranza

1. **Revisa este reporte diariamente** — identifica rápidamente qué pedidos están listos para cobrar
2. **Prioriza los "Entregado sin Cobrar"** — son los más urgentes
3. **Registra el pago en el mismo momento** — no dejes pendientes para después
4. **Exporta a CSV** si necesitas hacer seguimiento con más detalle`
    },
    {
      id: "reports-prediction-admin",
      category: "Reportes",
      role: "admin",
      title: "🔮 Predicción Inteligente de Pedidos (Admin)",
      keywords: ["predicción", "tendencia", "pedidos", "semanas", "stock", "admin", "inteligente", "alerta"],
      related_ids: ["reports-admin", "products-inventory", "dashboard-admin"],
      content: `## 🔮 Predicción Inteligente de Pedidos

**Disponible solo para Administradores.**

Esta es una herramienta **inteligente de análisis predictivo** basada en los últimos 60 días de movimientos de tu negocio. Te ayuda a **saber exactamente cuándo pedir a los proveedores** sin dejar de stock.

---

### 📊 Cómo Funciona

El sistema analiza automáticamente:

1. **Frecuencia de ventas** — Cuántas veces por semana se vende cada producto
2. **Cantidad promedio** — Cuántas unidades se venden en cada transacción
3. **Stock actual** — Cuántas unidades tienes ahora
4. **Proyección** — Cuántas semanas faltan para que se agote el stock

\`\`\`
Fórmula:
Semanas disponibles = Stock actual ÷ (Promedio por venta × Ventas por semana)
\`\`\`

---

### 🎯 Tres Niveles de Alerta

| Alerta | Significado | Acción recomendada |
|---|---|---|
| 🔴 **URGENTE** (< 2 semanas) | Stock se agotará **muy pronto** | **Pedir YA** — riesgo de desabasto inminente |
| 🟡 **PRONTO** (2-4 semanas) | Stock se agotará en las próximas semanas | **Preparar solicitud** en los próximos días |
| 🟢 **OK** (> 4 semanas) | Stock suficiente por ahora | **Monitorear** sin urgencia |

---

### 📋 Ejemplo Práctico

Supongamos que analizamos un producto "Cable HDMI":

- **Stock actual:** 50 unidades
- **Ventas en últimos 60 días:** 40 unidades en 8 transacciones
- **Promedio por transacción:** 5 unidades
- **Frecuencia:** 1.3 transacciones por semana
- **Proyección:** 50 ÷ (5 × 1.3) = **7.7 semanas** → 🟢 OK

Si ese mismo producto tuviera solo 10 unidades:
- **Proyección:** 10 ÷ (5 × 1.3) = **1.5 semanas** → 🔴 URGENTE

---

### 🎯 Ventajas de la Predicción

✅ **No vuelves a quedarte sin stock** — sabes exactamente cuándo pedir
✅ **Evitas sobrestocks** — no compras productos que no se venden
✅ **Optimizas el cash flow** — ordenas en el momento justo
✅ **Reduce el estrés operativo** — todo es automático y basado en datos

---

### 💡 Cómo Usar Este Reporte

**Cada lunes o cuando abras el reporte:**

1. Revisa la lista de productos con alerta 🔴 **URGENTE** — llama al proveedor HOY
2. Revisa la lista con alerta 🟡 **PRONTO** — prepara la solicitud para esta semana
3. Los productos 🟢 **OK** no necesitan atención inmediata

**Si un producto no aparece en la lista:**
- No tuvo ventas en los últimos 60 días — probablemente sea de baja demanda, no lo ordenes hasta que haya movimiento

---

### ⚠️ Excepciones

Esta predicción funciona mejor para **productos con ventas regulares**. 

Para productos con ventas **muy esporádicas** o **estacionales**, úsala como guía pero confía también en tu experiencia del negocio.`
    },
    {
      id: "settings-delete-reason",
      category: "Configuración",
      role: "almacenista",
      title: "🗑️ Eliminar Catalogos — Razón Obligatoria",
      keywords: ["eliminar", "categoría", "proveedor", "razón", "motivo", "auditoría", "almacenista"],
      related_ids: ["settings-categories", "settings-business"],
      content: `## 🗑️ Eliminar Catálogos — Registro de Razón

Cuando un **Almacenista** intenta eliminar una categoría, proveedor u otro catálogo, el sistema **requiere que registre una razón** de por qué desea eliminarlo.

---

### ✅ Por Qué se Solicita una Razón

Esta medida protege la integridad de tu negocio:

- **Auditoría:** Los Administradores pueden ver quién eliminó qué y por qué
- **Prevención de errores:** Obliga a pensar antes de eliminar
- **Responsabilidad:** Cada acción deja un rastro identificable

---

### 📋 Cómo Funciona

1. Haz clic en el ícono de **🗑️ Basura** junto al elemento que deseas eliminar
2. Aparecerá un diálogo que pide:
   - **Confirmación** de la acción
   - **Razón de eliminación** (campo obligatorio)
3. Escribe una **descripción clara** del motivo (ejemplo: "Categoría discontinuada, no vendemos más estos productos")
4. Confirma — el elemento se elimina y la razón queda registrada

---

### 💡 Ejemplos de Buenas Razones

✅ "Categoría obsoleta, descontinuamos esta línea de negocio"
✅ "Proveedor ya no trabaja con nosotros, cambió de dirección"
✅ "Producto duplicado, merge con otra categoría"
✅ "Error administrativo, se creó por accidente"

❌ **Evita:** "no sé", "porque sí", o dejar el campo vacío

---

### 🔐 Quién Puede Ver las Razones

- ✅ **Administradores** — ven todas las razones de eliminación
- ❌ **Almacenistas** — solo la suya propia

---

### 💡 Nota Importante

Si el Administrador **NO quiere que se elimine** nada, puede:
- Desactivar el elemento (cambiar estado a "Inactivo")
- En lugar de eliminar, esto conserva el historial y la integridad de la auditoría`
    },
    {
      id: "reports-predictive-intro",
      category: "Reportes",
      role: "admin",
      title: "🔮 Capa Predictiva/Inteligente de Reportes — Introducción",
      keywords: ["predictivo", "inteligente", "análisis", "admin", "owner", "determinístico", "8 reportes", "v2.0.0"],
      related_ids: ["reports-admin", "reports-all", "dashboard-admin"],
      content: `## 🔮 Capa Predictiva/Inteligente de Reportes (v2.0.0)

**Disponible solo para Administradores y Owners.**

---

### 🎯 ¿Qué es la Capa Predictiva?

Es un **conjunto de 8 reportes avanzados e inteligentes** diseñados para proporcionar análisis estratégico del negocio usando **lógica determinística interna** (sin depender de APIs externas).

Los reportes te ayudan a:
- Identificar productos en riesgo de agotamiento
- Optimizar órdenes de reabastecimiento
- Detectar patrones de cobranza problemática
- Encontrar anomalías operativas
- Analizar dinámicamente el negocio por múltiples dimensiones

---

### 📋 Los 8 Reportes Disponibles

1. **Análisis Dinámico (Pivot)** — Cruza múltiples dimensiones de datos
2. **Más Vendidos** — Productos por valor de ventas
3. **Baja Rotación** — Productos con poco movimiento
4. **Tendencia** — Evolución diaria de entradas/salidas
5. **Riesgo de Agotamiento** — Proyección de días para desabasto
6. **Sugerencia de Resurtido** — Cantidades recomendadas a pedir
7. **Riesgo de Cobranza** — Scoring de deudas problemáticas
8. **Discrepancias/Anomalías** — Detección de irregularidades

---

### 🔒 Acceso Restringido

- ✅ **Visible para:** Admin, Owner
- ❌ **Invisible para:** Sales, Warehouse, Storekeeper

Los usuarios operacionales ven únicamente los **Reportes Operacionales** estándar.

---

### 🚀 Cómo Acceder

Ve a **Reportes** en el menú lateral. Si tienes rol Admin/Owner, verás una pestaña **"Análisis Inteligente"** con los 8 reportes agrupados.

---

### ⚡ Características Técnicas

✅ **Determinístico** — Basado en reglas de negocio internas, no en IA externa
✅ **Offline-capable** — Funciona completamente local sin depender de APIs
✅ **Sin créditos de integración** — No consume créditos de Base44
✅ **Aislamiento multi-tenant** — Cada negocio ve solo sus datos
✅ **Memoizado** — Optimizado para rendimiento`
    },
    {
      id: "reports-pivot-analysis",
      category: "Reportes",
      role: "admin",
      title: "📊 Análisis Dinámico (Pivot) — Cruza Tus Datos",
      keywords: ["pivot", "dinámico", "análisis", "cruzado", "producto", "categoría", "cliente", "mes", "semana", "agregación"],
      related_ids: ["reports-predictive-intro", "reports-admin", "movements-overview"],
      content: `## 📊 Análisis Dinámico (Pivot Table)

Una herramienta **poderosa y flexible** para analizar tus movimientos desde múltiples ángulos.

---

### 🎯 ¿Para Qué Sirve?

Cruza datos de forma dinámica:
- **Por qué agrupar** → Producto, Categoría, o Cliente
- **Cuándo agrupar** → Mes, Semana, o Día
- **Qué métrica** → Valor ($) o Cantidad (u)
- **Cómo agregar** → Suma, Promedio, Mín, Máx, Conteo

**Resultado:** Una tabla que muestra exactamente lo que buscas sin necesidad de exportar a Excel.

---

### 🎮 Controles

| Control | Opciones |
|---|---|
| **Agrupar Filas** | Producto, Categoría, Cliente |
| **Agrupar Columnas** | Mes, Semana, Día |
| **Métrica** | Valor ($), Cantidad (u) |
| **Agregación** | Suma, Promedio, Mín, Máx, Contar |

---

### 💡 Ejemplos de Análisis

**Ejemplo 1: Ventas por Categoría por Mes**
- Filas: Categoría
- Columnas: Mes
- Métrica: Valor
- Agregación: Suma
→ Sabes qué categoría vendió más en cada mes

**Ejemplo 2: Unidades vendidas por Producto por Semana**
- Filas: Producto
- Columnas: Semana
- Métrica: Cantidad
- Agregación: Suma
→ Ves la evolución semanal de cada producto

**Ejemplo 3: Clientes más rentables**
- Filas: Cliente
- Columnas: Mes
- Métrica: Valor
- Agregación: Suma
→ Identifica tus clientes top por mes

---

### 📥 Exportar

Haz clic en **CSV** para descargar la tabla y continuar el análisis en Excel o Google Sheets.`
    },
    {
      id: "reports-depletion-risk",
      category: "Reportes",
      role: "admin",
      title: "⚠️ Riesgo de Agotamiento — Proyección de Stock",
      keywords: ["agotamiento", "proyección", "riesgo", "desabasto", "días", "semanas", "criticidad", "alerta"],
      related_ids: ["reports-predictive-intro", "products-inventory", "reports-reorder"],
      content: `## ⚠️ Riesgo de Agotamiento

Un análisis que **predice cuántos días le quedan a cada producto** antes de que se agote, basado en el promedio de ventas de los últimos 30 días.

---

### 📊 Cómo Funciona

Para cada producto activo, el sistema calcula:

\`\`\`
Días restantes = Stock actual ÷ (Promedio diario de salidas últimos 30 días)
\`\`\`

---

### 🎯 Niveles de Riesgo

| Nivel | Rango | Color | Acción |
|---|---|---|---|
| **Crítico** | < 7 días | 🔴 Rojo | **Pedir YA** |
| **Alto** | 7-15 días | 🟠 Naranja | Preparar orden inmediatamente |
| **Medio** | 15-30 días | 🟡 Amarillo | Monitorear próxima semana |
| **Bajo** | > 30 días | 🟢 Verde | Sin urgencia |

---

### 📋 Ejemplo

| Producto | Stock | Promedio/día | Días Restantes | Riesgo |
|---|---|---|---|---|
| Cable HDMI | 50 | 2.5 | 20 | 🟡 Medio |
| Mouse | 8 | 3 | 2.7 | 🔴 Crítico |
| Teclado | 120 | 1 | 120 | 🟢 Bajo |

---

### 💡 Cómo Usarlo

1. **Enfócate en los rojos** (críticos) — necesitan acción inmediata
2. **Prepara órdenes para los naranjas** — ordena esta semana
3. **Monitorea los amarillos** — quizá necesites ordenar pronto
4. **Ignora los verdes** — tienen stock suficiente`
    },
    {
      id: "reports-reorder-suggestion",
      category: "Reportes",
      role: "admin",
      title: "📦 Sugerencia de Resurtido — Cantidades Automáticas",
      keywords: ["resurtido", "sugerencia", "cantidad", "orden", "compra", "proveedor", "cálculo automático"],
      related_ids: ["reports-predictive-intro", "reports-depletion-risk", "products-inventory"],
      content: `## 📦 Sugerencia de Resurtido

Calcula **automáticamente cuántas unidades debes pedir** a cada proveedor, basado en consumo histórico y stock actual.

---

### 🧮 Fórmula

\`\`\`
Sugerencia = Máx(0, Stock recomendado − Stock actual)

Stock recomendado = Promedio diario × 45 días (buffer de 1.5 meses)
\`\`\`

**En otras palabras:** El sistema sugiere que mantengas un buffer de 45 días de consumo promedio.

---

### 🎯 Niveles de Urgencia

| Urgencia | Significado | Acción |
|---|---|---|
| 🔴 **Crítica** | Necesita resurtido INMEDIATO | Llama al proveedor HOY |
| 🟠 **Alta** | Será necesario resurtido esta semana | Prepara solicitud ahora |
| 🟡 **Media** | Resurtido en próximas 2 semanas | Avisa al proveedor |

---

### 📊 Ejemplo

| Producto | Stock Act. | Stock Rec. | Sugerencia | Urgencia |
|---|---|---|---|---|
| Cable HDMI | 50 | 112 | 62 u | 🟠 Alta |
| Mouse | 8 | 135 | 127 u | 🔴 Crítica |
| Teclado | 120 | 45 | 0 u | 🟢 OK |

**Interpretación:**
- Mouse: **Solicita 127 unidades** al proveedor ahora
- Cable HDMI: Solicita 62 unidades esta semana
- Teclado: No necesita orden en este momento

---

### 💡 Cómo Usar Este Reporte

1. Abre el reporte cada lunes o cuando necesites planificar compras
2. Copia la lista de productos con **urgencia Crítica y Alta**
3. Contacta a tus proveedores con los números sugeridos
4. Optimiza entregas agrupando órdenes del mismo proveedor`
    },
    {
      id: "reports-collections-risk",
      category: "Reportes",
      role: "admin",
      title: "💳 Riesgo de Cobranza — Scoring de Deudas",
      keywords: ["cobranza", "deuda", "riesgo", "antigüedad", "scoring", "crítico", "seguimiento", "cobrar"],
      related_ids: ["reports-predictive-intro", "quotations-convert", "quotations-states"],
      content: `## 💳 Riesgo de Cobranza

Un análisis determinístico que **puntúa el riesgo de cada deuda pendiente** y te ayuda a priorizar el cobro.

---

### 🎯 Cómo se Calcula el Riesgo

Para cada cotización convertida en venta pero sin pagar:

1. **Antigüedad** — Cuántos días lleva sin cobrar
2. **Monto** — Valor total de la deuda
3. **Estado de entrega** — ¿Fue entregada o no?

La fórmula asigna un **riesgo de 0 a 100** considerando todos estos factores.

---

### 🎯 Niveles de Riesgo

| Nivel | Rango | Significado | Acción |
|---|---|---|---|
| 🔴 **Crítico** | > 80 | Deuda antigua, alto riesgo de no cobro | **Llamar hoy** |
| 🟠 **Alto** | 60-80 | Deuda moderada, sin justificación para esperar | Seguimiento esta semana |
| 🟡 **Medio** | 40-60 | Deuda reciente o de monto bajo | Monitorear |

---

### 📊 Ejemplo de Tabla

| Folio | Cliente | Monto | Antigüedad | Entrega | Riesgo | Estado |
|---|---|---|---|---|---|---|
| COT-001 | Empresa A | $5,000 | 45 días | ✅ Sí | 92 | 🔴 Crítico |
| COT-002 | Empresa B | $2,000 | 20 días | ✅ Sí | 65 | 🟠 Alto |
| COT-003 | Empresa C | $800 | 5 días | ❌ No | 25 | 🟡 Medio |

---

### 💡 Estrategia de Cobranza

1. **Semana 1:** Cobra los "Críticos" — son de alto riesgo
2. **Semana 2:** Sigue con los "Altos" — son los próximos en prioridad
3. **Semana 3+:** Monitorea los "Medios" — aún hay tiempo

---

### 📥 Exportar

Descarga a CSV y crea tu lista de seguimiento en Excel.`
    },
    {
      id: "reports-anomalies",
      category: "Reportes",
      role: "admin",
      title: "🔍 Discrepancias/Anomalías — Detección de Irregularidades",
      keywords: ["anomalía", "discrepancia", "irregular", "error", "inconsistencia", "auditoría", "5 reglas"],
      related_ids: ["reports-predictive-intro", "movements-overview", "quotations-states"],
      content: `## 🔍 Discrepancias y Anomalías

Un **detector automático de irregularidades** basado en 5 reglas determinísticas que analiza tu operación.

---

### 🎯 Las 5 Reglas de Anomalía

#### 1️⃣ Salida sin Cotización Documentada
**Qué es:** Una salida de inventario sin referencia clara de cotización.
**Por qué es anomalía:** Dificulta el seguimiento de ingresos.
**Acción:** Verifica que la venta esté documentada correctamente.

#### 2️⃣ Throughput Excesivo en un Día
**Qué es:** Un volumen de movimientos inusualmente alto en 24 horas.
**Por qué es anomalía:** Podría indicar un error masivo de registro.
**Acción:** Revisa los movimientos del día para confirmar su validez.

#### 3️⃣ Producto Estancado sin Movimiento
**Qué es:** Producto sin salidas en 90+ días.
**Por qué es anomalía:** Posible obsolescencia o error de catálogo.
**Acción:** Revisa si debe descontinuarse o si hay un error.

#### 4️⃣ Stock Bajo vs Mínimo Invertido
**Qué es:** Stock actual supera significativamente el mínimo (sobrecargado).
**Por qué es anomalía:** Capital inmovilizado innecesariamente.
**Acción:** Considera reducir recompras de este producto.

#### 5️⃣ Cotización Vencida Sin Cancelar
**Qué es:** Cotización pasó su fecha de vigencia pero no está cancelada.
**Por qué es anomalía:** Confusión en estado de órdenes.
**Acción:** Cancela explícitamente las vencidas.

---

### 📊 Tabla de Anomalías

| Tipo | Producto | Detalle | Severidad | Acción |
|---|---|---|---|---|
| Estancado | Tornillo M4 | 180 días sin venta | 🟠 Alta | Discontinuar o promover |
| Exceso Stock | Caja | 2,000 u vs mín 200 | 🟡 Media | Revisar cantidad mínima |
| Cotización vencida | — | 3 cotizaciones vencidas | 🟡 Media | Cancelar explícitamente |

---

### 💡 Cómo Usar Este Reporte

1. **Revisa cada anomalía** — entiende qué está pasando
2. **Clasifica por severidad** — enfócate en los rojos y naranjas
3. **Documenta tus acciones** — correcciones, cancelaciones, etc.
4. **Monitorea cambios** — ejecuta el reporte nuevamente en 2 semanas

---

### 🔐 Propósito

Este reporte es una **herramienta de auditoría interna** para mantener la integridad operacional de tu negocio.`
    },
];