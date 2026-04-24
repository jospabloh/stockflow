# Field Visibility - Guía de Implementación

## Descripción

Sistema granular de visibilidad de campos por rol. Permite ocultar información sensible (costos, ganancias, márgenes) a roles específicos mientras mantienen acceso a funcionalidades.

## Configuración

### Archivo: `lib/fieldVisibilityConfig.js`

Define qué campos ve cada rol en cada módulo:

```javascript
Dashboard: {
  admin: {
    stats: ['total_sales', 'total_revenue', 'net_profit', 'actual_profit', 'profit_margin', 'total_costs'],
    charts: ['sales_trend', 'profit_trend', 'cost_breakdown', 'margin_analysis'],
    alerts: ['low_stock', 'unpaid_invoices', 'high_costs', 'low_margins'],
  },
  almacenista: {
    stats: ['total_sales', 'total_revenue'], // Solo ingresos
    charts: ['sales_trend'], // Solo tendencia
    alerts: ['low_stock'],
  },
  vendedor: {
    stats: ['total_sales', 'total_revenue'],
    charts: ['sales_trend'],
    alerts: [],
  },
}
```

## Uso en Componentes

### Hook: `useFieldVisibility`

```javascript
import { useFieldVisibility } from '@/hooks/useFieldVisibility';

function MyComponent() {
  const { canSee, conditionalRender } = useFieldVisibility('Dashboard');

  return (
    <div>
      {/* Método 1: Verificación simple */}
      {canSee('net_profit') && (
        <div>Mostrar ganancia neta</div>
      )}

      {/* Método 2: Renderizado condicional */}
      {conditionalRender('profit_margin', 
        <div>Margen visible</div>, 
        <div>Margen oculto</div>
      )}
    </div>
  );
}
```

### Uso en Products

```javascript
import { useFieldVisibility } from '@/hooks/useFieldVisibility';

function ProductTable() {
  const { canSee } = useFieldVisibility('Products');

  return (
    <table>
      <tr>
        <td>Nombre</td>
        {canSee('retail_sale_price') && <td>Precio Venta</td>}
        {canSee('purchase_price') && <td>Precio Compra</td>} {/* Solo admin */}
        {canSee('margin') && <td>Margen</td>} {/* Solo admin */}
      </tr>
    </table>
  );
}
```

### Uso en Quotations

```javascript
function QuotationRow({ quotation }) {
  const { canSee } = useFieldVisibility('Quotations');

  return (
    <div>
      <span>${quotation.total}</span>
      {canSee('margin') && <span>Margen: {quotation.margin}%</span>}
      {canSee('cost_price') && <span>Costo: ${quotation.cost_price}</span>}
    </div>
  );
}
```

### Uso en Reports

```javascript
function ReportsPage() {
  const { canSee, getVisibleFieldList } = useFieldVisibility('Reports');

  const visibleSections = getVisibleFieldList();

  return (
    <div>
      {visibleSections.sections?.includes('operational') && <OperationalReports />}
      {visibleSections.sections?.includes('financial') && <FinancialReports />}
      {canSee('profit_margin') && <MarginAnalysis />} {/* Solo admin */}
    </div>
  );
}
```

## Campos Sensibles por Módulo

### Dashboard
- `total_costs` - Valor total de inventario al costo
- `net_profit` - Utilidad neta (ganancia - pagos a proveedores)
- `actual_profit` - Utilidad real (ganancia - costos)
- `profit_margin` - % de margen de ganancia
- `profit_trend` - Gráfico de tendencia de ganancias
- `cost_breakdown` - Desglose de costos

### Products
- `purchase_price` - Precio de compra (admin solo)
- `margin` - Margen de ganancia (admin solo)
- `markup` - Margen sobre costo (admin solo)
- `inventory_value` - Valor total de stock (admin solo)
- `cost_per_unit` - Costo unitario (admin solo)

### Quotations
- `cost_price` - Precio de costo (admin solo)
- `margin` - Margen unitario (admin solo)
- `total_cost` - Costo total (admin solo)
- `total_margin` - Margen total (admin solo)
- `profit_margin_percent` - % de rentabilidad (admin solo)

### Reports
- `cost_analysis` - Análisis de costos (admin solo)
- `margin_analysis` - Análisis de márgenes (admin solo)
- `profit_margin` - Vista de márgenes (admin solo)

### Caja Chica
- `profit_impact` - Impacto en ganancia (admin solo)

### Pagos a Proveedores
- `petty_cash_impact` - Impacto en caja chica (admin solo)
- `total_spent` - Total gastado (admin solo)
- `payment_trends` - Tendencias de pago (admin solo)

## Agregar Nueva Visibilidad de Campo

1. **Editar `lib/fieldVisibilityConfig.js`**:
```javascript
MyNewModule: {
  admin: {
    view: ['all_fields'],
    edit: ['all_fields'],
  },
  almacenista: {
    view: ['safe_fields_only'],
    edit: ['inventory_fields'],
  },
}
```

2. **Usar en componente**:
```javascript
const { canSee } = useFieldVisibility('MyNewModule');
{canSee('sensitive_field') && <SensitiveComponent />}
```

## Notas de Implementación

- **No bloquea acciones**, solo visibilidad
- El rol se obtiene automáticamente del usuario actual
- Loading state incluido en el hook
- Compatible con todos los roles personalizados

## Testing

Verificar visibilidad con diferentes roles:

```javascript
// En PermissionAdmin, cambiar rol y verificar que Dashboard oculta:
// - Costo de inventario
// - Utilidad Real/Neta
// - Márgenes
// - Detalles de costos
``