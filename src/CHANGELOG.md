# Changelog — StockFlow

## v2.18.2 (2026-06-29)

### 🔒 Auditoría de Seguridad y Calidad

Auditoría automatizada completa del repositorio. Sin hallazgos Críticos ni Altos. Sin cambios en lógica de negocio, datos ni permisos de tenant.

#### Correcciones de backend

- **Función `resolveLicenseState` eliminada** — función de utilidad que rompía el deploy por dependencia circular; la resolución de estado de licencia quedó inlineada directamente en `adminGetAllLicenses` (PR #220).
- **`adminGetAllLicenses`** — hereda la resolución de estado de licencia inline; el estado `archived` se evalúa correctamente como solo-lectura.

#### Correcciones de frontend

- **`console.log` de depuración eliminado en `Settings.jsx`** — sentencia que registraba `businessId` y `user.business_id` en la consola del navegador durante la carga de la página de Configuración.

#### Dependencias

- **`react-quill` removida** — paquete no utilizado en el código fuente (eliminado en v2.16.15). Su presencia en `package.json` mantenía una vulnerabilidad moderada (CVE en Quill ≤1.3.7). Removido y `package-lock.json` actualizado.
- **Vulnerabilidades residuales aceptadas** (sin corrección disponible en npm):
  - `xlsx` — Prototype Pollution (GHSA-4r6h-8v6p-xvw6) y ReDoS (GHSA-5pgg-2g8v-p4x9). Dependencia directa usada en exportación. Riesgo aceptado: la exportación XLS no procesa input externo no controlado; sin fix upstream disponible.
  - `ws` / `engine.io-client` — alta severidad, transitividad desde `@base44/sdk`. No resoluble sin actualizar el SDK.
  - `dompurify` ≤3.4.10 — moderada, vía `jspdf` (generación de PDF). No resoluble sin actualizar jspdf.
  - `js-yaml` ≤4.1.1 — moderada, vía `eslint` (dev-only). Sin riesgo en producción.

#### Validaciones completadas

- Validación RLS: 24 entidades, 17 con alcance de tenant — sin hallazgos.
- Lint: sin advertencias.
- Matriz de permisos: 16 módulos, 159 claves — sin brechas nuevas.
- Aislamiento de tenant: todos los endpoints de backend verificados.

> Nota: ningún cambio modifica entidades de Base44, RLS, lógica de negocio ni permisos.

---

## v2.18.1 (2026-06-22)

### 🔒 Auditoría de Seguridad y Calidad

Auditoría automatizada completa del repositorio. Sin hallazgos Críticos ni Altos. Sin cambios en lógica de negocio, datos ni permisos.

#### Hallazgos y correcciones

| Severidad | Descripción | Estado |
|---|---|---|
| Bajo | 2 `console.log` de depuración en `BarcodeGenerator.jsx` — exponían ID de producto y objeto completo en la consola del navegador | ✅ Corregido |
| Bajo | Cadena de versión en `helpData.js` mostraba v2.15.0 en lugar de la versión actual | ✅ Corregido |

#### Validaciones completadas

- Validación RLS: 22 entidades, 15 con alcance de tenant — sin hallazgos.
- Matriz de permisos: 15+ módulos, 155 claves — sin brechas nuevas.
- Funciones de backend: endpoints de admin de plataforma verifican identidad en servidor.
- Lint: sin advertencias.
- Build: sin errores.
- PR #190 (automatizado de liberación, sin cambios reales): cerrado y reemplazado por esta revisión.

> Nota: ningún cambio modifica entidades de Base44, RLS, lógica de negocio ni permisos.

---

## v2.18.0 (2026-06-19)

### 🎨 Identidad Visual — Iniciativa "Subir de Nivel"

Esta versión consolida una renovación visual de toda la aplicación, ejecutada en cuatro entregas (rediseño del dashboard + 3 sub-proyectos), sin tocar datos, lógica de negocio ni el aislamiento por tenant. Todos los cambios son de presentación.

#### Tipografía y cifras
- Sistema tipográfico nuevo: **Space Grotesk** (títulos), **IBM Plex Sans** (cuerpo) e **IBM Plex Mono** (cifras).
- Las cantidades de dinero y stock usan **figuras tabulares monoespaciadas** y se alinean en columnas en tablas, totales y reportes (regla de dos niveles: `tabular` en celdas, `font-mono tabular` en totales/KPIs y encabezados).

#### Paleta de marca centralizada
- La marca (índigo/cian) vive ahora en un **único sistema de tokens** (`brand`/`accent`) en lugar de ~500 literales de color repartidos por el código.
- Se añadió una **regla de lint** que impide reintroducir literales `indigo-`/`cyan-` crudos, evitando que la marca se vuelva a fragmentar.

#### Dashboard
- Nuevo encabezado **"Inventario en vivo"** que abre el dashboard con el **stock total**, el **flujo de entradas/salidas del día** y una **alerta de reposición**.
- El valor del inventario al costo respeta el permiso `Dashboard:stat_total_value` (no se expone a quien no debe verlo).

#### Cotización pública (cara al cliente)
- La página de cotización compartida pasó de una tarjeta genérica a un **documento profesional con la marca del negocio**: usa el `primary_color` del tenant como acento, con **texto legible en cualquier color de marca** (cálculo de luminancia) y cifras monoespaciadas.
- Estados rediseñados: aviso de vencimiento, **confirmación de aprobación**, rechazo y "no encontrada", todos con dirección clara.

#### Accesibilidad
- Se respeta `prefers-reduced-motion` (transiciones y animaciones) y se mejoró el contraste de color en superficies de marca.

> **Nota:** ningún cambio de esta versión modifica entidades de Base44, RLS ni permisos. La matriz de permisos permanece en 15 módulos / 155 claves.

---

## v2.17.0 (2026-06-15)

### 🛡️ Auditoría de Permisos — Módulo Cuentas de Fondos

El módulo **Cuentas de Fondos** (`FundAccounts`) fue identificado durante la auditoría de seguridad como la única página del sistema sin cobertura en la matriz de permisos granulares. Esta versión cierra esa brecha.

#### Cambios aplicados

- **Nuevo módulo `CuentasFondo`** registrado en `permissionRegistry.js` con 4 claves:
  - `CuentasFondo:view` — ver la lista de cuentas (almacenista: **true** por defecto)
  - `CuentasFondo:create` — crear nuevas cuentas (almacenista: **false** por defecto)
  - `CuentasFondo:edit` — editar nombre, estado activo y si afecta caja chica (almacenista: **false**)
  - `CuentasFondo:delete` — eliminar cuentas (almacenista: **false**)
- **Mapa de permisos**: `FundAccounts → CuentasFondo` añadido a `permissionModuleMap.js`
- **Defaults de rol**:
  - Admin: todas las claves = `true` (comportamiento existente)
  - Almacenista: `view = true`, `create/edit/delete = false` (operaciones de configuración reservadas para admin)
- **`FundAccounts.jsx`**: añade `usePermissions()`, muestra "Acceso Restringido" si falta `view`, oculta botones de acción según permiso individual
- **Manifiestos generados** actualizados: `permissionManifests.ts`, `permissionArtifacts.js`
- **Matriz de permisos**: 15 módulos, 152 claves

#### Clasificación del hallazgo

| Severidad | Hallazgo | Estado |
|---|---|---|
| Medium | FundAccounts sin cobertura de permisos | ✅ Fixed |

> **Nota:** El aislamiento de tenant (business_id) ya estaba garantizado en el backend. Este fix añade la capa de control de roles en el frontend, consistente con el resto de módulos.

---

## v2.16.16 (2026-06-08)

### 🛡️ Permisos granulares aplicados en el frontend — Utilidad y Rubros

Los módulos **Utilidad** y **Rubros** ya estaban registrados en la matriz de permisos (v2.16.15), pero las páginas aún no aplicaban esas restricciones en la interfaz. Esta versión cierra esa brecha: los permisos ahora se respetan en el cliente.

#### Módulo Utilidad
- **`Utilidad:view`** — sin este permiso la página muestra *Acceso Restringido* en lugar del Estado de Resultados (información financiera confidencial)
- **`Utilidad:add_withdrawal`** — controla el botón *Retiro de utilidad* y las acciones de editar/eliminar movimientos del historial
- **`Utilidad:manage_forecast`** — controla el interruptor de *Proyección* de fin de mes

#### Módulo Rubros
- **`Rubros:view`** — sin este permiso la página muestra *Acceso Restringido*
- **`Rubros:create`** — controla el botón *Nuevo*
- **`Rubros:edit`** — controla la edición y el interruptor de *Activo*
- **`Rubros:delete`** — controla la eliminación de rubros

#### Mapa de permisos
- La página `Utility` ahora se mapea explícitamente al módulo `Utilidad` en `permissionModuleMap.js`. Antes caía al nombre por defecto (`Utility`), por lo que `Utilidad:view` no resolvía y la visibilidad del ítem en el menú lateral no respetaba el permiso de vista.

> **Nota:** el aislamiento de tenant y la autoridad de datos siguen garantizados en el backend; estos cambios refuerzan la capa de UX para que cada rol vea solo lo que le corresponde.

---

## v2.16.15 (2026-06-08)

### 🔧 Fix Crítico de Inventario — Stock Fuente Única de Verdad

#### Causa raíz resuelta
El stock de productos no tenía una única autoridad: la automatización asíncrona del panel, las escrituras directas y el ledger de movimientos podían aplicar el mismo delta 0, 1 o 2 veces según condiciones de carrera. Esto causaba desincronización visible al usar clientes de precio cero.

#### Cambios en el motor de inventario
- **`Movement.stock_applied`** — nuevo campo de idempotencia: garantiza que el efecto de cada movimiento se aplica exactamente una vez
- **`applyMovementStock`** — nueva función canónica y única autoridad del delta de stock; idempotente, con aislamiento de tenant en profundidad
- **`syncProductStock`** — el evento `create` ahora es no-op (el escritor síncrono ya aplicó el efecto); mantiene ajuste relativo en `update`/`delete`
- **`dailyStockReconcile`** — auditoría nocturna de solo lectura que detecta movimientos sin aplicar como red de seguridad

#### Flujos actualizados
- `createMovementSafe`, `convertQuotationSafe`, `partialReturnQuotation`, `cancelQuotationSafe`, `deliverQuotationSafe`: aplican stock de forma síncrona tras crear el movimiento
- `deliverQuotationSafe`: elimina el `Product.update` manual que causaba doble descuento
- `importItemsSafe`, `applyInventoryAuditCorrection`: marcan `stock_applied=true` (ya fijan el stock directamente)

---

### 💰 Módulo Utilidad — Retiro y Estado de Resultados

#### Modal de Retiro simplificado
- Solo pide: **Monto**, **Fecha**, **Fuente** (Efectivo/Caja Chica o AFIRME), **¿Quién lo tomó?** y **Concepto**
- Eliminados: selección de Rubro, Referencia y Notas (el retiro siempre se clasifica como distribución)
- Nuevo campo **¿Facturado?** con toggle Sí/No e insignia de color en el historial

#### Estado de Resultados refactorizado
- Tres cifras claras: **Utilidad Total** (generada por operación) → **Utilidad Retirada** (disposiciones ya realizadas) → **Utilidad Disponible**
- Los retiros manuales ya no se mezclan con gastos operativos — se tratan como disposiciones, bajo la línea

---

### 📋 Estado de Factura en Pagos a Proveedores

- Nuevo campo `invoice_status` en `SupplierPayment`: **Pendiente** / **Recibida** / **No requerida**
- Toggle rápido en la tabla (Pte / Rec / N/R) con colores
- Filtro por estado de factura
- Consistent con el patrón de estados de cotizaciones

---

### 🛡️ Permisos — Módulos Registrados (sin cambio de comportamiento actual)

- Módulo **Utilidad** añadido a la matriz: `view` (admin=true, almacenista=false — sensible), `add_withdrawal` (almacenista=false), `manage_forecast` (sensible)
- Módulo **Rubros** añadido a la matriz: `view`, `create`, `edit`, `delete` (almacenista=true — operativo)
- El acceso actual **no cambia**: la aplicación de estos permisos requiere activar `enable_granular_permissions` y añadir `PermissionGate` a los componentes en una futura iteración

---

## v2.16.0 (2026-06-02)

### 🔒 Auditoría de Seguridad, Calidad de Código y Mantenimiento

#### Correcciones de Seguridad — Dependencias (17 CVEs adicionales)
- `package-lock.json` actualizado resolviendo 17 CVEs adicionales en dependencias transitivas detectadas post-v2.15.0

#### Limpieza de CI/CD
- **`deno.yml` eliminado** — workflow Deno CI redundante. El pipeline `ci.yml` ya cubre deno lint + deno test en todos los pushes y pull requests. Unificado a un solo pipeline.

#### Código Muerto Eliminado
- **`ProtectedRoute.jsx` eliminado** — componente referenciaba `authChecked` y `checkUserAuth` que no son parte del contrato público de `AuthContext`. El componente no estaba importado en ninguna parte del árbol de rutas (`App.jsx` usa `AuthenticatedApp` directamente). Eliminación segura sin impacto funcional.

#### Auditoría de Permisos
- Matriz de permisos revisada: 13 módulos, 144 claves, Admin=true / Almacenista=false por defecto confirmados
- Sin gaps de permisos nuevos identificados

#### Aislamiento de Tenant
- RLS activo en lectura confirmado
- Funciones backend con ownership check (`deleteClientSafe`, `getCurrentTenantLicenseState`) activas
- Sin exposición de datos entre tenants identificada en esta auditoría

#### Documentación
- Manual de usuario revisado al 2 de junio de 2026
- Changelog y versión actualizados a v2.16.0

---

## v2.15.0 (2026-06-01)

### 🔒 Auditoría de Seguridad y Calidad de Código

#### Vulnerabilidades de Dependencias Resueltas (19 CVEs)
- **Crítica**: `jspdf` — PDF Object Injection y HTML Injection corregidos
- **Alta**: `axios` — SSRF, Prototype Pollution, Header Injection y CRLF Injection corregidos
- **Alta**: `lodash` — Code Injection via `_.template` y Prototype Pollution corregidos
- **Alta**: `flatted` — DoS por recursión no acotada y Prototype Pollution corregidos
- **Alta**: `minimatch` — ReDoS (denegación de servicio) corregido
- **Alta**: `vite` — Path Traversal en deps optimizadas y lectura arbitraria via WebSocket corregidos
- **Moderada**: `ajv`, `brace-expansion`, `dompurify`, `follow-redirects`, `uuid`, `ws` — múltiples CVEs moderados corregidos

#### Permisos — Cobertura para Features v2.14.0
- **`Cotizaciones:share`** — permiso granular para Compartir Enlace Público: admin=`true`, almacenista=`false` por defecto
- **`Configuracion:manage_referral`** — permiso para gestionar el Programa de Referidos: admin=`true`, almacenista=`false` por defecto
- Manifiestos de permisos regenerados con claves nuevas

#### Hallazgos Arquitectónicos
- `ProtectedRoute.jsx` referenciaba `authChecked`/`checkUserAuth` inexistentes en `AuthContext` (rutas protegidas operan correctamente vía `AuthenticatedApp` — sin impacto funcional, stale code documentado)
- Dos workflows de CI redundantes (`ci.yml` y `deno.yml`) unificados en `ci.yml`
- deno.json excluye reglas de lint relevantes (`no-unused-vars`, `no-explicit-any`) — trade-off documentado
- `SUPPORT_EMAIL` hardcodeado como fallback en 3 funciones backend — riesgo bajo, uso de env var recomendado

#### Documentación
- Manual de usuario actualizado con artículos de Compartir Cotización, Programa de Referidos y Onboarding Wizard
- Versión de manual de ayuda corregida (2.12.0 → 2.14.0)

---

## v2.14.0 (2026-06-01)

### 🔐 Seguridad Reforzada, Compartir Cotización y Programa de Referidos
- Auditoría de seguridad completa: eliminación de emails hardcodeados en 36+ archivos del frontend y 25 funciones backend
- Guards de autenticación añadidos a 11 funciones sin auth (platform-owner-only y user-only)
- RLS fix: regla de creación de Business ahora abierta para cualquier usuario autenticado (primer tenant)
- PLATFORM_OWNER_EMAIL ahora se lee exclusivamente de variable de entorno — nunca del código fuente
- Eliminadas 102 funciones scaffold/debug del codebase de producción
- HelpCenter: admin de plataforma resuelto por isPlatformAdmin del backend, no por email hardcodeado
- Compartir Cotización (Public Link): enlace seguro por token UUID para que clientes acepten/rechacen sin login
- Wizard de Onboarding: guía paso a paso para nuevos negocios (Bienvenida → Primer producto → Invitar equipo)
- Programa de Referidos: código único por negocio, +15 días de trial para referente y referido al activar
- Panel de Referidos en Configuración: código con botones de copiar y WhatsApp, estadísticas y progreso

---

## v2.13.0 (2026-05-14)

### 🔐 Permisos Granulares — Política de Defaults y Matriz Completa
- **Admin por defecto con acceso total**: todos los permisos de módulos, visuales y acciones quedan en `true` para el rol admin por diseño
- **Member/Almacenista con acceso operativo**: conserva su acceso actual para operar el negocio sin elevar permisos sensibles automáticamente
- **Nuevos permisos en falso para member**: cuando se crea un módulo, visual o acción nueva, su default para member queda en `false` hasta autorización explícita del admin
- **Acciones estándar consolidadas**: matriz documentada con las 4 acciones base `view`, `add`, `modify`, `delete` para asegurar criterio uniforme
- **Cobertura actualizada de módulos activos**: Dashboard, Productos, Categorías, Proveedores, Clientes, Tipo de Pago, Movimientos, Cotizaciones, Caja Chica, Pagos a Proveedores, Reportes y Configuración

### 📚 Manual Actualizado
- Se actualizó la guía de Permisos Granulares con la política oficial de defaults por rol
- Se añadió listado completo de módulos activos y su alcance (visual + acción)
- Se aclaró el flujo de gobernanza: nuevos accesos no se habilitan para member hasta aprobación del admin

---

## v2.12.0 (2026-04-28)

### 📧 Reactivación Automática de Trial (nueva feature)
- **`processTrialReactivationEmails`**: job diario que detecta usuarios con trial activo e inactivos >24 h y les envía un email amigable de reactivación
- **Email bilingüe**: plantilla en español (es-MX) e inglés (en-US) según locale del tenant; sin hardcoding de un solo idioma
- **Reglas anti-spam**: máximo 3 emails por trial, mínimo 48 h entre envíos, no envía si el usuario estuvo activo recientemente
- **Idempotencia**: clave única `trial_reactivation:user_id:business_id:YYYY-MM-DD` previene duplicados aunque el cron corra dos veces
- **`trackUserActivity`**: función backend con throttle de 15 min; actualiza `last_active_at` del usuario autenticado sin tocar otros campos
- **`useActivityTracker`**: hook React que dispara el tracker en cada carga de página/navegación (máx. 1 vez cada 15 min por sesión)
- **Entidad User**: 3 nuevos campos — `last_active_at`, `last_trial_reactivation_email_at`, `trial_reactivation_email_count` (sin romper campos existentes)
- **Entidad EmailNotification**: nuevo tipo `trial_reactivation` + campos `idempotency_key`, `user_id`, `skip_reason` para auditoría
- **Tenant isolation preservada**: el job solo lee usuarios filtrados por `business_id`; no hay leaks entre tenants
- **Cron**: diario a las 10:00 CDMX (16:00 UTC)

### 📧 Emails de Ciclo de Vida — Expansión MercadoPago
- **5 nuevos tipos de email** en entidad `EmailNotification`: `license_activated`, `renewal_charge_reminder_3/2/1`, `payment_received`
- **`sendLifecycleEmails`**: 5 nuevas plantillas HTML en español — activación de licencia, recordatorios de cobro (3/2/1 día), confirmación de pago recibido
- **`adminUpdateTenantLicense`**: dispara automáticamente email `license_activated` al cambiar `billing_status` a `active`
- **`checkAccountLifecycle`**: envía `renewal_charge_reminder_3/2/1` para tenants `active + auto_renewal` con 3, 2 y 1 días antes del vencimiento
- **`confirmRenewalPayment`**: nueva función para confirmar pago de MP manualmente — envía `payment_received` a todos los admins del tenant
- **Panel de Licencias**: botón ✅ "Confirmar pago recibido" en filas de tenants `active + auto_renewal`

### ⏰ Automatizaciones Diarias
- **Cron `checkAccountLifecycle`**: corre diario a las 08:00 CDMX (14:00 UTC)
- **Cron `processMonthlyRenewal`**: corre diario a las 09:00 CDMX (15:00 UTC), actúa solo el día 1 del mes
- **Cron `processTrialReactivationEmails`**: corre diario a las 10:00 CDMX (16:00 UTC)

---

## v2.11.0 (2026-04-26)

### 💳 Pagos Parciales en Cotizaciones
- **QuotationPaymentsSection**: nuevo componente para registrar abonos (parcial o total) con método de pago, fecha y notas
- **Historial de pagos**: cada abono queda en el array `payments` con id único, monto, método, fecha y autor
- **Saldo en tiempo real**: campos `amount_paid` y `balance` reflejan el estado exacto de cobro por cotización
- **Opcional Caja Chica**: toggle para registrar el abono también como ingreso de Caja Chica (método Efectivo)

### 🚨 Alerta de Saldo Pendiente — Dashboard
- **PendingBalanceAlert**: alerta roja en el Dashboard cuando existen cotizaciones entregadas con saldo sin cobrar
- **Acceso directo**: enlace desde la alerta a la página de Cotizaciones para gestionar cobros pendientes

### 📦 Mejoras al Flujo On-Demand
- **Búsqueda de catálogo**: `OnDemandItemForm` permite buscar y vincular un producto existente al registrar solicitud
- **Recepción en almacén**: `CreateFromOnDemandModal` rediseñado para registrar cantidad recibida y actualizar stock
- **Entrega segura**: `deliverQuotationSafe` verifica que todos los ítems on-demand estén recibidos antes de marcar entregado

### 🐛 Correcciones
- **Entidad User**: `role` y `business_id` formalizados en `User.jsonc` (admin / almacenista)
- **updateQuotationFlagsSafe**: corrección en el manejo de flags de entrega/ruta

---

## v2.10.0 (2026-04-26)

### 🔐 Sistema de Permisos Granulares
- **Panel de Permisos** (`/PermissionAdmin`): matriz visual de permisos por rol y módulo, exclusivo para administradores
- **Acciones configurables**: ver, leer, escribir, modificar, eliminar — por módulo y por rol
- **Activación por tenant**: regla `enable_granular_permissions` desactivada por defecto — cero impacto hasta habilitarse
- **Golden Rule**: los permisos granulares son capas aditivas sobre los controles existentes — un bug solo puede reducir acceso, nunca ampliarlo
- **PermissionGate** y **PermissionContext**: componentes para control de acceso a páginas y estado global de permisos

### 📋 Cotizaciones por Demanda (On-Demand)
- **Nuevo flujo On-Demand**: registra productos solicitados por un cliente sin necesidad de stock previo
- **Panel de Pendientes**: lista de solicitudes On-Demand en espera de aprobación o conversión a cotización
- **Conversión directa**: un clic para convertir una solicitud on-demand en cotización formal

### 👥 Gestión de Equipo Mejorada
- **TeamMembersManager**: nuevo componente con cambio de rol, búsqueda y estado de cada miembro
- **Visibilidad de campos por rol**: precio de compra, márgenes y datos sensibles se ocultan automáticamente según el rol del usuario

### 🐛 Correcciones — Cotizaciones
- **Fallos silenciosos**: errores en el guardado de cotizaciones ahora siempre muestran detalle — nunca más éxito silencioso
- **Botón bloqueado**: el botón "Guardar" ya no se bloquea cuando el stock de un producto es 0
- **Whitelist campos**: `updateQuotationSafe` ya no descarta campos de contenido al actualizar

---

## v2.9.2 (2026-04-24)

### 🐛 Correcciones — Pagos a Proveedores
- **Carga de catálogos**: Proveedores y Métodos de Pago ahora cargan via serviceRole — dropdowns ya no quedan vacíos
- **Errores visibles**: fallos de carga muestran toast en lugar de fallar silenciosamente
- **Parámetro sort**: removido parámetro incompatible en filtros de Proveedor y Método de Pago

### 🐛 Correcciones — Panel de Licencias
- **auto_renewal**: el checkbox ahora persiste correctamente al aprobar o actualizar una licencia
- **Contraste dark mode**: dropdowns del panel de licencias visibles correctamente en modo oscuro
- **Partición booleana**: `adminUpdateTenantLicense` reintenta campos booleanos si el SDK los descarta en update multi-campo
- **UX tolerante**: errores de guardado muestran qué campos específicos fallaron en lugar de éxito silencioso

### 📚 Manual Reorganizado
- Artículos de Reportes, Configuración y Caja Chica movidos de "Novedades" a sus secciones permanentes
- Nuevos artículos: Pagos a Proveedores, Auditoría de Inventario, Ciclo de Vida de Cuentas, Múltiples Contactos por Proveedor

---

## v2.9.1 (2026-04-22)

### 💳 Módulo Pagos a Proveedores
- **Nueva página "Pagos a Proveedores"**: CRUD completo con filtros y resumen de KPIs para registrar desembolsos a proveedores
- **Perfil por proveedor**: acceso rápido al histórico de pagos desde la tarjeta del proveedor
- **Toggle Caja Chica**: cada pago puede sincronizarse con un egreso de Caja Chica (marcado como \`generated_by_system\`)
- **Dashboard integrado**: nueva sección con gráfico de período + ranking de top 5 proveedores
- **Reports**: nueva pestaña con gráfico acumulativo + KPIs vs período anterior

### 📊 Dashboard Optimizado
- **Análisis de Ventas**: nueva línea "Pagos a Proveedores" + línea "Utilidad Neta" con badge de impacto (emerald/amber/rose)
- **Semáforo mejorado**: tasa de conversión % + barra de progreso proporcional + enlace "Ver todas"
- **Layout responsive**: grid 2-col desde `md` (tablets ven side-by-side), eliminado whitespace innecesario
- **Espaciado optimizado**: reducción de `space-y-6` → `space-y-5`, `gap-6` → `gap-4`

### 🔍 Búsqueda Mejorada
- **Select de Proveedor**: ahora usa `SearchableSelect` con filtro en tiempo real sobre nombre de negocio y contacto
- **Select de Método de Pago**: reemplazado con `SearchableSelect`; botón X reemplaza "— Ninguno —"
- **Comportamiento inteligente**: toggle Caja Chica solo aparece con método "Efectivo", se resetea al cambiar

### 🌓 Dark Mode Reactivo
- **Sincronización de gráficos**: CartesianGrid, ejes (XAxis/YAxis) y tooltip adaptan al cambio de tema en tiempo real
- **MutationObserver**: detecta cambios en clase `dark` y re-renderiza gráficos sin recargar

### 🧹 Limpieza de Código
- **ESLint**: resuelto 31 warnings `no-unused-vars`
- **Imports**: removidos 54 imports no utilizados en 18 archivos

---

## v2.9.0 (2026-04-21)

### 🔍 Sistema de Auditoría de Inventario
- **Nueva pestaña "Audit Inventario"** en Configuración: compara el stock actual de cada producto con su historial de movimientos
- **Clasificación de discrepancias**: `direct_edit` (edición directa), `sync_error` (desincronización), `no_movements` (sin historial), `legacy_bug` (bug anterior)
- **Resolución asistida**: el administrador puede aceptar el stock actual o revertirlo al valor calculado; se genera un movimiento de reconciliación trazable

### 📧 Ciclo de Vida de Cuentas y Emails Automáticos
- **Transiciones automáticas**: scheduler diario gestiona trial → view_only → archived → deleted según fecha de expiración
- **17 plantillas de email en español**: bienvenida, aviso de expiración, modo solo-lectura, archivo, renovación mensual
- **Auto-renovación configurable**: checkbox por tenant en panel de administración de licencias
- **Integración nativa**: emails enviados via `Core.SendEmail` de base44 (sin dependencias externas)

### 👥 Múltiples Contactos por Proveedor
- **Campo `extra_contacts`** en entidad Supplier: permite registrar N contactos adicionales por proveedor
- **Formulario actualizado**: sección de contactos con contacto principal obligatorio y extras opcionales
- **Elimina duplicados**: ya no es necesario crear múltiples registros del mismo proveedor por contacto

### 🔒 Validaciones en Formulario de Cliente
- **Campos obligatorios**: Nombre de Contacto, Nombre de Negocio y Teléfono ahora se validan al guardar

### 🐛 Correcciones
- **Diálogo Editar Licencia**: añadido scroll y max-height para que el footer con botones siempre sea accesible
- **Badge de stock bajo**: el contador en la barra lateral se refresca correctamente al navegar entre páginas
- **Emails de ciclo de vida**: reemplazado Resend con integración nativa `Core.SendEmail` de base44

---

## v2.5.5 (2026-04-07)

### 🎯 Dashboard: Semáforo de Cotizaciones Mejorado
- **Semáforo filtrado a 30 días**: Muestra solo cotizaciones de los últimos 30 días (más relevante y actualizado)
  - 🟢 Concretadas en venta
  - 🟡 Sin concretar (activas)
  - 🔴 Canceladas
- **Etiqueta visible**: "En los últimos 30 días" para claridad de período mostrado

### 🚨 Nueva Alerta: Cobranza Vencida
- **Detecta cotizaciones vencidas**: Identifica automáticamente cotizaciones concretadas sin cobrar fuera del rango de 30 días
- **Monto total visible**: Muestra dinero pendiente de cobranza vencida
- **Acceso directo**: Enlace para navegar a cotizaciones y tomar acciones de cobro
- **Solo cuando es necesario**: La alerta solo aparece si existen deudas vencidas

### 📝 Documentación Actualizada
- Centro de Ayuda: Nuevo artículo sobre semáforo de cotizaciones a 30 días y alertas de cobranza

---

## v2.5.4 (2026-04-07)

### 🐛 Correcciones críticas
- **Precios en catálogo**: Ahora se respeta que los precios en el catálogo son **precios finales (incluyen IVA)**
  - Cotizaciones: Se usa correctamente `purchase_price` sin sumarle transporte al precio unitario
  - Movimientos: Se eliminó duplicación de IVA — ahora muestra el precio final correcto
  - Se removió columna "Precio Unit." en Movimientos, dejando solo "Total"

### ✨ Mejoras
- **Transporte de clientes**: $20 MXN por producto se suma al total final, no al precio unitario
  - Visible solo para clientes con `force_purchase_all_products = true`
  - Se aplica correctamente en cotizaciones y preview PDF

### 📋 Detalles técnicos
- `pricingEngine.js`: Removido +20 del precio unitario (línea 43)
- `calculateQuotationWithTransport`: Transporte se suma al total, no al subtotal
- `pages/Movements`: Función `getFinalTotal()` calcula correctamente sin IVA duplicado
- Sincronización perfecta entre QuotationFormDialog y QuotationPreviewDialog

---

## v2.5.3 (2026-04-07)
Corrección de scroll en tablas de Cotizaciones y Productos (desktop)

## v2.5.2
Mejoras de virtualization en tablas

---

_Para consultas de funcionamiento, ver Manual de Usuario en HelpCenter_