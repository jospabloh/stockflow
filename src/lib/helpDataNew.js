// Artículos de ayuda — última versión: v2.9.2
// Solo contiene notas de versión (release notes). Los artículos de manual permanente están en helpDataExtension.js
// v2.9.2: Fixes panel licencias (auto_renewal, dropdown dark mode, boolean partition) + fixes catálogos Pagos a Proveedores
// v2.9.1: Módulo Pagos a Proveedores, búsqueda mejorada, optimizaciones dashboard + dark mode
// v2.9.0: Auditoría de inventario, ciclo de vida de cuentas + emails automáticos, múltiples contactos por proveedor
// v2.8.2: Centro de Ayuda sensible al tenant

export const newHelpArticles = [
    {
      id: "release-2-9-2",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.9.2 — Fixes Panel de Licencias y Carga de Catálogos",
      keywords: ["versión", "2.9.2", "licencias", "auto_renewal", "renovación", "pagos proveedores", "catálogo", "dropdown", "dark mode"],
      related_ids: ["release-2-9-1", "license-overview", "supplier-payments-guide"],
      content: `## 🆕 Versión 2.9.2 — 24 de abril de 2026

### 🐛 Correcciones de esta versión

---

#### 💳 Pagos a Proveedores — Carga de Catálogos

Se corrigieron múltiples problemas que causaban que los dropdowns de Proveedor y Método de Pago aparecieran vacíos al entrar al módulo.

| Fix | Descripción |
|---|---|
| Carga via serviceRole | Proveedores y Métodos de Pago ahora se cargan con el mismo patrón que QuotationFormDialog |
| Errores visibles | Los fallos de carga muestran un toast explicativo en lugar de fallar silenciosamente |
| Parámetro sort | Removido parámetro incompatible que causaba rechazo en ciertos filtros |

---

#### 🔑 Panel de Licencias

Se corrigieron varios problemas relacionados con el checkbox de auto-renovación y la usabilidad en modo oscuro.

| Fix | Descripción |
|---|---|
| auto_renewal persistence | El checkbox ahora persiste correctamente al aprobar o actualizar una licencia |
| Dark mode dropdowns | Los selects del panel de licencias son ahora visibles en modo oscuro (migrados a Radix UI Select) |
| Boolean partition | \`adminUpdateTenantLicense\` reintenta campos booleanos si el SDK los descarta en update multi-campo |
| UX tolerante | Los errores de guardado muestran qué campos específicos fallaron — nunca más éxito silencioso |

---

### 📚 Manual Reorganizado

Los artículos de Reportes, Configuración y Caja Chica que estaban en la sección **Novedades** fueron movidos a sus secciones permanentes en el manual. Ahora son más fáciles de encontrar por categoría.

**Nuevos artículos permanentes:**
- 🔍 Auditoría de Inventario (Configuración)
- 💳 Pagos a Proveedores — Guía Completa (nueva categoría)
- 🔄 Ciclo de Vida de la Cuenta (Licencias)
- 👥 Múltiples Contactos por Proveedor (Configuración)

---

### 📦 Versión Anterior — v2.9.1 (22 de abril de 2026)

Módulo Pagos a Proveedores, búsqueda mejorada con SearchableSelect, Dashboard optimizado y dark mode reactivo.
`
    },
    {
      id: "release-2-9-1",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.9.1 — Módulo Pagos a Proveedores y Optimizaciones Dashboard",
      keywords: ["versión", "2.9.1", "pagos", "proveedores", "supplier payments", "dashboard", "dark mode", "búsqueda"],
      related_ids: ["release-2-9-0", "dashboard-overview", "supplier-overview"],
      content: `## 🆕 Versión 2.9.1 — 22 de abril de 2026

### ✅ Novedades de esta versión

---

#### 💳 Nuevo Módulo: Pagos a Proveedores

Registra y da seguimiento a los desembolsos realizados a proveedores — clave para reflejar la utilidad neta real.

- **Nueva página "Pagos a Proveedores"**: CRUD completo (crear, editar, eliminar) con filtros y resumen de KPIs
- **Perfil por proveedor**: acceso rápido a histórico de pagos desde la tarjeta del proveedor
- **Toggle Caja Chica**: cada pago puede sincronizarse con un egreso de Caja Chica (marcado como \`generated_by_system\`)
- **Nueva entidad SupplierPayment** con multi-tenant RLS para aislamiento de datos

---

#### 📊 Dashboard Mejorado

- **Nueva sección Pagos a Proveedores**: gráfico de barras de pagos en el período + ranking de top 5 proveedores
- **Análisis de Ventas actualizado**: nueva línea de "Pagos a Proveedores" + línea "Utilidad Neta" con badge de impacto (%)
- **Badge de impacto**: emerald (bajo impacto), amber (medio), rose (alto — más del 80% consumido)
- **Semáforo de Cotizaciones mejorado**: ahora muestra tasa de conversión %, barra de progreso proporcional y enlace "Ver todas"

---

#### 🔍 Búsqueda Mejorada en Formularios

- **Select de Proveedor**: reemplazado con \`SearchableSelect\` que filtra en tiempo real sobre nombre de negocio y contacto principal
- **Select de Método de Pago**: reemplazado con \`SearchableSelect\` mejorado; botón X reemplaza la opción "— Ninguno —"
- **Comportamiento inteligente**: toggle de Caja Chica solo aparece cuando el método es "Efectivo" y se resetea al cambiar método

---

#### 🌓 Dark Mode Mejorado

- **Sincronización reactiva**: los gráficos ahora reaccionan al cambio de tema en tiempo real
- **Elementos gráficos**: colores de CartesianGrid, ejes (XAxis/YAxis), y tooltip adaptan automáticamente
- **Observador de tema**: \`MutationObserver\` detecta cambios en la clase \`dark\` y re-renderiza gráficos sin recargar

---

#### 🎨 Optimizaciones de Layout

- **Grid responsivo**: activado 2-col desde \`md\` (768px) — tablets ahora ven layout side-by-side
- **Eliminación de whitespace**: todos los grids usan \`items-start\` para evitar estiramiento forzado a altura máxima
- **Espaciado optimizado**: \`space-y-6\` → \`space-y-5\`, \`gap-6\` → \`gap-4\` en secciones de gráficos
- **Padding responsivo**: \`p-4 md:p-5\` en todas las tarjetas, \`p-3 md:p-4\` en barra de filtros
- **Limpieza visual**: removida explicación de fórmula en Análisis de Ventas (~100px de espacio recuperado)
- **Filtro mobile-friendly**: subtitle oculto en móvil (\`hidden sm:block\`)

---

#### 🧹 Limpieza de Código

- **ESLint**: resuelto 31 warnings \`no-unused-vars\` en toda la aplicación
- **Imports**: removidos 54 imports no utilizados en 18 archivos

---

#### 📈 Reports

- **Nueva pestaña Pagos a Proveedores**: gráfico acumulativo de pagos + KPIs vs período anterior
- **Análisis comparativo**: delta de monto y cantidad respecto al período previo

---

### 📦 Versión Anterior — v2.9.0 (21 de abril de 2026)

Auditoría de Inventario, ciclo de vida de cuentas con emails automáticos, múltiples contactos por proveedor y campos requeridos en cliente.
`
    },
    {
      id: "release-2-9-0",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.9.0 — Auditoría de Inventario y Ciclo de Vida de Cuentas",
      keywords: ["versión", "2.9.0", "auditoría", "inventario", "ciclo de vida", "emails", "proveedor", "contactos", "cliente", "campos requeridos"],
      related_ids: ["release-2-8-2", "inventory-overview", "petty-cash-overview"],
      content: `## 🆕 Versión 2.9.0 — 21 de abril de 2026

### ✅ Novedades de esta versión

---

#### 🔍 Sistema de Auditoría de Inventario

Nueva pestaña **"Audit Inventario"** en Configuración → Auditoría.

- Compara el stock actual de cada producto con su historial de movimientos registrados
- Clasifica discrepancias con badges visuales:
  - \`direct_edit\` — el stock fue editado directamente sin movimiento
  - \`sync_error\` — desincronización entre campo de stock y movimientos
  - \`no_movements\` — producto sin historial de movimientos
  - \`legacy_bug\` — discrepancia originada por un bug anterior
- El administrador puede **aceptar el stock actual** o **revertirlo al valor calculado** con un movimiento de reconciliación trazable

---

#### 📧 Ciclo de Vida de Cuentas y Emails Automáticos

Gestión automatizada del estado de los tenants con notificaciones en español.

- **Transiciones automáticas** gestionadas por scheduler diario: trial → view_only → archived → deleted
- **17 plantillas de email en español**: bienvenida, aviso de expiración (30/15/7/3/1 días), modo solo-lectura, archivo y renovación mensual
- **Auto-renovación configurable**: nuevo checkbox por tenant en el panel de administración de licencias
- **Integración nativa**: emails enviados via \`Core.SendEmail\` de base44 — sin dependencias externas

---

#### 👥 Múltiples Contactos por Proveedor

- Nuevo campo **\`extra_contacts\`** en la entidad Proveedor: permite registrar N contactos adicionales
- El formulario de proveedor ahora tiene una sección de contactos con contacto principal obligatorio y extras opcionales
- Elimina la necesidad de crear registros duplicados del mismo proveedor por cada contacto

---

#### 🔒 Campos Obligatorios en Formulario de Cliente

Los siguientes campos son ahora requeridos al crear o editar un cliente:
- **Nombre de Contacto**
- **Nombre de Negocio**
- **Teléfono**

---

### 🐛 Correcciones

| Área | Descripción |
|---|---|
| Licencias | Diálogo "Editar Licencia" ahora tiene scroll y max-height — el footer con botones siempre es accesible |
| Sidebar | Badge de stock bajo se refresca correctamente al navegar entre páginas |
| Emails | Reemplazado Resend con \`Core.SendEmail\` nativo de base44 para mayor fiabilidad |

---

### 📦 Versión Anterior — v2.8.2 (15 de abril de 2026)

Centro de Ayuda sensible al tenant: filtra artículos según las reglas activas del negocio en tiempo de ejecución.
`
    },
    {
      id: "release-2-8-2",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.8.2 — Centro de Ayuda Sensible al Tenant",
      keywords: ["versión", "2.8.2", "ayuda", "help center", "tenant", "reglas", "visibilidad", "filtrado"],
      related_ids: ["platform-tenant-rules", "tenant-cash-sales-to-petty-cash", "petty-cash-overview"],
      content: `## 🆕 Versión 2.8.2 — 15 de abril de 2026

### ✅ Cambios de esta versión

#### 🎯 Centro de Ayuda con Visibilidad por Tenant

El Centro de Ayuda ahora filtra los artículos visibles según las reglas activas para cada negocio.

---

### 🔍 Cómo Funciona

| Tipo de artículo | Visible para |
|---|---|
| Artículos generales | Todos los usuarios |
| Artículos administrativos de plataforma | Solo administradores de plataforma |
| Artículos con \`visibility_scope: "tenant_rule"\` | Solo tenants con esa regla habilitada |

---

### 💡 Por Qué

- Los tenants no deben ver documentación técnica de administración de plataforma
- Los tenants no deben ver artículos de funciones que no aplican a su negocio
- El filtrado es dinámico — usa el mapa de reglas en tiempo de ejecución, no hardcodes

---

### 📦 Versión Anterior — v2.8.1 (15 de abril de 2026)

Módulo de administración de Reglas por Tenant con gestión completa (listar, crear, editar, habilitar/deshabilitar y archivar).
`
    },
    {
      id: "release-2-8-1",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.8.1 — Reglas por Tenant: Administración de Excepciones Operativas",
      keywords: ["versión", "2.8.1", "tenant rules", "reglas", "plataforma", "sistema", "admin", "TenantRule", "cash_sales_to_petty_cash", "excepciones"],
      related_ids: ["platform-tenant-rules", "petty-cash-overview"],
      content: `## 🆕 Versión 2.8.1 — 15 de abril de 2026

### ✅ Cambios de esta versión

#### 🛡️ Nuevo Módulo: Reglas por Tenant (Solo Plataforma)

Se implementó el módulo completo de administración de **Reglas por Tenant**, accesible únicamente para administradores de la plataforma StockFlow desde el menú **Sistema → Reglas por Tenant**.

---

### 🎯 ¿Qué son las Reglas por Tenant?

Son excepciones operativas específicas para un negocio (tenant) en particular. Permiten activar comportamientos avanzados sin afectar a ningún otro negocio.

**Reglas disponibles en esta versión:**

| Rule Key | Descripción |
|---|---|
| \`cash_sales_to_petty_cash\` | Ventas en efectivo cobradas generan ingresos automáticos en Caja Chica |
| \`allow_manual_petty_cash_edit_delete\` | Permite editar/eliminar movimientos manuales de Caja Chica |
| \`special_delivery_flow\` | Flujo especial de entrega (reservado) |
| \`custom_pricing_override\` | Override de precios personalizado (reservado) |

---

### 🏛️ Navegación

El menú lateral ahora muestra la sección **Sistema** (exclusiva para plataforma):
- **Licencias** — Gestión de licencias por tenant
- **Reglas por Tenant** — Gestión de excepciones operativas

---

### 🔐 Funciones Backend Platform-Admin-Only

Se agregaron 4 nuevas funciones backend, todas restringidas al email del administrador de plataforma:

- \`adminListTenantRules\` — Lista todas las reglas con filtros
- \`adminUpsertTenantRule\` — Crea o actualiza una regla (upsert por business_id + rule_key)
- \`adminDeleteTenantRule\` — Archiva una regla (soft delete)
- \`getCurrentTenantRuleMap\` — Retorna el mapa de reglas activas para un tenant

---

### 📋 Entidad TenantRule

Nueva entidad con los campos:
- \`business_id\`, \`rule_key\`, \`enabled\`, \`config_json\`, \`notes\`
- \`created_by\`, \`updated_by\`, \`archived\`, \`last_applied_at\`

---

### 🔄 Garantías

- **Idempotencia:** Upsert basado en business_id + rule_key — nunca se crean duplicados activos
- **Soft delete:** Las reglas se archivan, no se eliminan, para mantener trazabilidad
- **Aislamiento:** Cada regla está estrictamente vinculada a un \`business_id\`
- **Sin hardcodes:** El motor de reglas resuelve por \`business_id\`, nunca por nombre visible del tenant

---

### 📦 Versión Anterior — v2.8.0 (15 de abril de 2026)

Función opcional por tenant: ventas en efectivo cobradas se registran automáticamente como ingresos en Caja Chica. Ver artículo completo: "v2.8.0 — Caja Chica: Ingresos Automáticos por Ventas en Efectivo".
`
    },
    {
      id: "release-2-8-0",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.8.0 — Caja Chica: Ingresos Automáticos por Ventas en Efectivo",
      keywords: ["versión", "2.8.0", "caja chica", "ingreso automático", "efectivo", "venta", "cash", "cotización", "movimiento", "trazable", "sistema"],
      related_ids: ["petty-cash-auto-income", "petty-cash-overview", "quotations-convert"],
      content: `## 🆕 Versión 2.8.0 — 15 de abril de 2026

### ✅ Cambios de esta versión

#### ⚡ Función Opcional: Ingresos Automáticos en Caja Chica por Ventas en Efectivo

Se implementó una función **activable por negocio** que registra automáticamente como ingreso en Caja Chica las ventas cobradas en efectivo.

---

### 🎯 ¿Cómo Funciona?

Cuando la función está activada para un negocio:

1. **Cotización en efectivo cobrada** → Se crea automáticamente un ingreso en Caja Chica por el total de la cotización
2. **Movimiento directo en efectivo cobrado** → Se crea automáticamente un ingreso en Caja Chica por el monto de la venta

**Condiciones requeridas:**
- La forma de pago debe ser **Efectivo**
- La venta debe estar **efectivamente cobrada** (flag \`paid: true\`)
- Solo aplica al negocio que tiene la bandera habilitada

---

### 🔄 Ciclo de Vida Completo

| Evento | Resultado en Caja Chica |
|---|---|
| Venta en efectivo marcada como cobrada | ➕ Ingreso automático creado |
| Pago revertido (desmarcado) | ➖ Ingreso eliminado automáticamente |
| Cotización cancelada/anulada | ➖ Ingreso eliminado automáticamente |
| Movimiento eliminado | ➖ Ingreso eliminado automáticamente |

---

### 🛡️ Garantías de Integridad

- **Sin duplicados:** Nunca se genera más de un ingreso por la misma transacción de origen
- **Trazabilidad:** Cada ingreso automático está vinculado a su cotización o movimiento de origen
- **Protección:** Los ingresos automáticos no se pueden editar ni eliminar manualmente

---

### 🔒 Aislamiento por Negocio

Esta función está desactivada por defecto para todos los negocios. Solo se activa individualmente mediante una bandera de configuración. No afecta a ningún otro negocio.

---

### 📦 Versión Anterior — v2.7.3 (13 de abril de 2026)

Corrección de regla de stock bajo unificada en los 3 puntos de visualización (campana, Dashboard, Products?filter=low_stock).
`
    },
    {
      id: "release-2-7-0",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.7.0 — Sistema de Licencias por Tenant: Trial 30 Días + Planes + Modo Solo Lectura",
      keywords: ["versión", "2.7.0", "licencia", "trial", "prueba", "plan", "start", "growth", "pro", "solo lectura", "view_only", "activar", "pago", "suspender"],
      related_ids: [],
      content: `## 🆕 Versión 2.7.0 — 11 de abril de 2026

### ✅ Cambios de esta versión

#### 🌟 Sistema Completo de Licencias por Tenant

StockFlow ahora opera con un modelo de licencias **por negocio (tenant)**, no por usuario individual.

---

### ⏳ Prueba de 30 Días

Cuando un nuevo negocio se crea en StockFlow:
- Se inicia automáticamente un período de prueba de **30 días**
- La fecha de inicio y fin es calculada en el servidor (no en el dispositivo del usuario)
- Durante la prueba tienes acceso completo a todas las funciones
- Un banner visible indica los días restantes

---

### 📊 Planes Disponibles

| Plan | Usuarios máximos |
|------|------------------|
| **Start** | 4 usuarios |
| **Growth** | 10 usuarios |
| **Pro** | 20 usuarios |

> Los planes difieren en capacidad de usuarios, no en funcionalidades disponibles.

---

### 🔒 Modo Solo Lectura (Trial Expirado)

Cuando el período de prueba termina sin una licencia activa:
- El tenant pasa automáticamente a modo **Solo Lectura**
- Los usuarios pueden iniciar sesión normalmente
- Todos los datos existentes siguen siendo visibles (dashboard, productos, movimientos, cotizaciones, reportes)
- **No es posible crear, editar ni eliminar registros**
- Un banner permanente explica la situación y ofrece opciones de activación
- La protección es doble: frontend (UI bloqueada) + backend (funciones rechazan escrituras con HTTP 403)

---

### 🛍️ Activar Licencia

Para activar una licencia comercial:
1. Haz clic en el botón **\"Activar Licencia\"** del banner o ve a la página de planes
2. Contacta al equipo de StockFlow para confirmar el pago
3. El administrador de plataforma activará tu licencia manualmente después de confirmar el pago
4. Tu negocio volverá a tener acceso completo de escritura

---

### 🔐 Panel de Administración de Licencias

Exclusivo para el administrador de la plataforma StockFlow (no disponible para administradores de negocio).

**Funciones disponibles:**
- Ver todos los tenants con su estado de licencia
- Activar o cambiar plan de licencia
- Registrar referencia de pago y notas de activación
- Suspender o reactivar un tenant
- Ver el conteo de usuarios activos vs. límite del plan

---

### 🏛️ Tenants Existentes (Grandfather)

Los negocios existentes en producción antes de v2.7.0 **no son afectados**:
- Se tratan automáticamente como **activos** hasta que el administrador de plataforma los revise manualmente
- No se les fuerza un trial ni se les bloquea el acceso

---

### ⏰ Job Automático Diario

Un proceso automático se ejecuta cada día y:
- Busca todos los tenants con trial expirado
- Los transiciona a modo solo lectura
- Nunca elimina datos ni bloquea el login

---

### 🛡️ Alcance de Protección Backend

Las siguientes funciones bloquean escrituras para tenants en modo solo lectura o suspendidos:
\`createMovementSafe\`, \`createQuotationSafe\`, \`convertQuotationSafe\`, \`cancelQuotationSafe\`, \`createProductSafe\`, \`updateProductSafe\`, \`deleteProductSafe\`, \`createClientSafe\`, \`updateClientSafe\`, \`createCategorySafe\`, \`updateCategorySafe\`, \`deleteCategorySafe\`, \`createSupplierSafe\`, \`updateSupplierSafe\`, \`deleteSupplierSafe\`.

---

### 📦 Versión Anterior — v2.6.2 (9 de abril de 2026)

Caja Chica: editar y eliminar movimientos para administradores.
`
    },
    {
      id: "release-2-6-2",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.6.2 — Caja Chica: Editar y Eliminar Movimientos",
      keywords: ["versión", "2.6.2", "caja chica", "editar", "eliminar", "movimiento", "administrador", "historial"],
      related_ids: ["petty-cash-overview"],
      content: `## 🆕 Versión 2.6.2 — 9 de abril de 2026

### ✅ Cambios de esta versión

#### ✏️ Caja Chica — Editar y Eliminar Movimientos (Administradores)

**Problema resuelto:** Los administradores no podían corregir ni eliminar movimientos de caja chica creados por error, ya que la pantalla no exponía acciones de edición ni eliminación.

**Solución implementada:**
- Los usuarios con rol **administrador** ahora ven botones de ✏️ editar y 🗑️ eliminar directamente en el historial completo y en la lista de últimos movimientos.
- Al editar, se abre el mismo formulario precargado con los datos actuales (monto, fecha, descripción, categoría, referencia, notas).
- Al eliminar, aparece un **diálogo de confirmación** antes de proceder.
- El saldo de caja chica se **recalcula automáticamente** tras cualquier edición o eliminación.
- Los usuarios sin rol administrador no ven estas acciones.

**Alcance de seguridad:** Solo aplica a movimientos manuales. Todos los movimientos de caja chica son entradas directas, por lo que la edición directa es segura y no rompe integridad contable.

---

### 📦 Versión Anterior — v2.6.1 (9 de abril de 2026)

Corrección crítica de navegación al guardar una cotización nueva (página en blanco por doble \`navigate(-1)\`).
`
    },
    {
      id: "release-2-6-1",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.6.1 — Corrección Crítica: Página en Blanco al Guardar Cotización",
      keywords: ["versión", "2.6.1", "cotización", "guardar", "navegación", "página en blanco", "historial", "confetti"],
      related_ids: ["quotations-overview", "quotations-create"],
      content: `## 🆕 Versión 2.6.1 — 9 de abril de 2026

### ✅ Cambio de esta versión

#### 🧭 Corrección Crítica: Página en Blanco al Guardar una Cotización Nueva

**Problema resuelto:** Al guardar exitosamente una cotización nueva, la app cerraba el formulario y guardaba correctamente en la base de datos ✅, pero luego **navegaba a una página en blanco** sin feedback visible y sin forma de regresar.

**Causa raíz:** El flujo post-guardado ejecutaba **dos** \`navigate(-1)\` encadenados — uno al cerrar el diálogo y otro al ejecutar \`onSaved()\`. El segundo regresaba un paso más atrás del esperado, llegando a una pantalla inválida.

**Solución:** Navegación explícita a \`/Quotations\` con \`replace: true\`, eliminando el segundo navigate redundante. El usuario siempre termina en la lista de cotizaciones con confetti y toast visibles.

---

### 📦 Versión Anterior — v2.6.0 (9 de abril de 2026)

#### 🔒 Errores 403 ya no cierran la sesión
Los errores de validación de permisos en el backend ya no se clasifican erróneamente como expiración de sesión.
`
    },
    {
      id: "release-2-5-9",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.5.9 — Corrección Crítica de Guardado + Confirmación Visual de Éxito",
      keywords: ["versión", "2.5.9", "guardado", "guardar", "fallo", "silencioso", "error", "persistencia", "confetti", "éxito", "confirmación"],
      related_ids: ["products-inventory", "movements-overview", "quotations-overview"],
      content: `## 🆕 Versión 2.5.9 — 9 de abril de 2026

### ✅ Cambios de esta versión

#### 🔧 Corrección Crítica: Guardado Silencioso en Formularios

**Problema resuelto:** En ciertos dispositivos y condiciones de sesión (token vencido o en proceso de renovación), las acciones de **guardar en formularios de edición** podían fallar silenciosamente — la pantalla parecía completar la operación normalmente, pero los cambios no eran persistidos en la base de datos.

**Áreas afectadas:**
- Edición y creación de **Productos**
- Edición y creación de **Clientes**
- Creación y edición de **Cotizaciones**
- Registro de **Movimientos**
- Edición de **Categorías** y **Proveedores**

**Causa raíz:** Las funciones de backend que ejecutaban las escrituras dependían de tokens de sesión del usuario para la operación final de persistencia. En condiciones de token expirado o sesión bajo renovación, la autenticación fallaba antes de llegar a guardar.

**Solución:** Las funciones de backend ahora:
1. Validan la identidad y permisos del usuario al inicio (sin cambios)
2. Realizan la escritura final usando **operaciones de servicio** independientes del estado de la sesión del usuario
3. SDK de backend actualizado a versión 0.8.24

---

#### 🎉 Nueva Confirmación Visual de Éxito

Al completar exitosamente una operación de guardado, ahora aparece una **animación de celebración** que confirma de forma inequívoca que los cambios fueron persistidos en la base de datos.

**¿Por qué?** Para eliminar la ambigüedad de "¿sí guardó o no?". Si ves la celebración, el registro fue guardado correctamente.

---

### 📦 Versión Anterior — v2.5.8 (9 de abril de 2026)

#### 📱 Corrección iOS: Botones de Guardar Siempre Visibles
En iPhone (iOS), los botones "Guardar" y "Cancelar" en formularios ahora siempre están visibles y accesibles, sin quedar ocultos debajo del home indicator.
`
    },
    {
      id: "release-2-5-8",
      category: "Novedades",
      role: "admin",
      title: "🆕 v2.5.8 — Corrección iOS: Botones de Guardar Siempre Visibles",
      keywords: ["versión", "2.5.8", "ios", "iphone", "botón", "guardar", "cancelar", "dialog", "mobile", "accesibilidad"],
      related_ids: ["movements-overview", "products-inventory"],
      content: `## 🆕 Versión 2.5.8 — 9 de abril de 2026

### ✅ Cambios de esta versión

#### 📱 Corrección iOS: Botones de Acción Siempre Visibles en Formularios

**Problema resuelto:** En iPhone (iOS), al abrir formularios de edición de productos, cotizaciones o clientes, los botones **"Guardar"** y **"Cancelar"** podían quedar ocultos debajo del área visible de la pantalla. El usuario no podía guardar o cerrar el formulario sin hacer scroll manual, y en algunos casos los botones eran completamente inaccesibles.

**Causa:** Los diálogos calculaban su altura máxima usando la unidad CSS \`vh\` (viewport height), que en iOS Safari y modo PWA no considera correctamente la barra de navegación del sistema ni la barra inferior de home indicator. Además, el padding inferior del footer no compensaba la zona de exclusión del home indicator.

**Solución:** Se migraron los diálogos afectados a la unidad CSS \`dvh\` (dynamic viewport height), que en iOS calcula correctamente la altura disponible real. Se agregó también \`env(safe-area-inset-bottom)\` en el footer de los diálogos para garantizar separación respecto al home indicator del dispositivo.

**Diálogos corregidos:**
- Formulario de edición/creación de productos
- Formulario de cotizaciones (nueva y edición)
- Formulario de clientes (nuevo y edición)

> Esta corrección aplica a todos los iPhones con iOS y a cualquier dispositivo que use SafeArea en la parte inferior (notch, home indicator).

---

### 📦 Versión Anterior — v2.5.7 (9 de abril de 2026)

#### 💰 Corrección de Precios por Cliente en Movimientos
El formulario de movimientos ahora aplica correctamente las reglas de precio configuradas para cada cliente.

#### 📦 Corrección de Consistencia de Inventario
Sincronización mejorada entre el campo de stock y el historial de movimientos.
`
    },
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
];
