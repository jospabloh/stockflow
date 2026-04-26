# Changelog — StockFlow

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