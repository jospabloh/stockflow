# Changelog — StockFlow

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