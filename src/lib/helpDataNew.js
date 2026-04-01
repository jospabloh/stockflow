// Nuevos artículos de ayuda para v1.8.0
// RBAC mejorado, Reportes operacionales para almacenistas, Predicción inteligente para admin

export const newHelpArticles = [
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
];