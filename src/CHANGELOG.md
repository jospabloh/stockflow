# Changelog — StockFlow

## v2.5.5 (2026-04-07)

### ✨ Dashboard: Análisis Financiero Mejorado
- **Filtro de fechas personalizado**: Selecciona rango manual (Personalizar) además de períodos predefinidos
- **Indicadores de cobranza**: Ahora diferencia entre "Vendido" → "Pendiente de cobrar" → "Cobrado efectivamente"
- **Nuevo indicador**: "Vendido x entregar" muestra cotizaciones concretadas no entregadas ($ + cantidad de items)
- **Ganancia/Pérdida Real**: Calcula cobrado efectivamente − costo de lo entregado (puede ser negativa para mostrar pérdidas)
- **Explicación integrada**: Cada indicador incluye nota sobre cómo se calcula
- **Corrección técnica**: Se eliminó referencia circular de `salesData` dentro de `useMemo`

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