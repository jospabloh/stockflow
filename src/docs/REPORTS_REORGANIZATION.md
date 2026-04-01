# Reorganización de Reportes - Capas Operacional y Predictiva

## Resumen Ejecutivo

La sección de Reportes ha sido reorganizada en **dos capas claramente separadas**:

1. **Reportes Operacionales** - para la ejecución diaria (todos los usuarios)
2. **Análisis Inteligente / Predictivos** - para análisis estratégico (solo admins)

Esto mantiene a los usuarios operacionales enfocados en tareas del día a día, mientras que los admins tienen acceso a análisis avanzados y herramientas de pivot dinámico.

---

## Estructura Actual

### 📊 CAPA OPERACIONAL (Visible para: Todos)

Reportes enfocados en la ejecución diaria, control y seguimiento operativo:

#### 1. **Cotizaciones/Ventas** (PROTEGIDO - No modificado)
- Tabla de cotizaciones concretadas con filtros por estado, cliente, forma de pago y pago
- Resumen de ventas totales, cobradas y pendientes
- Tabla de ventas directas (movimientos sin cotización)
- Exportación CSV
- **Usuarios**: Admin, Sales, Warehouse, Storekeeper

#### 2. **Movimientos de Stock**
- Historial de entradas, salidas, devoluciones y ajustes
- Filtro por tipo de movimiento
- Stock resultante después de cada movimiento
- Exportación CSV
- **Usuarios**: Admin, Sales, Warehouse, Storekeeper

---

### 🔮 CAPA PREDICTIVA / INTELIGENTE (Visible para: Solo Admins/Owners)

Reportes analíticos, predictivos y de inteligencia de negocios:

#### 1. **Análisis Dinámico (NUEVO - PIVOT Report)**
Reporte interactivo tipo pivot con capacidades completas:

**Dimensiones de Agrupación:**
- Por Producto
- Por Categoría
- Por Cliente

**Agrupación de Columnas:**
- Por Mes
- Por Semana
- Por Día

**Métricas Disponibles:**
- Valor ($)
- Cantidad (unidades)

**Agregaciones:**
- Suma (SUM)
- Contar (COUNT)
- Promedio (AVG)
- Mínimo (MIN)
- Máximo (MAX)

**Características:**
- Totales por fila y por columna
- Grand total general
- Exportación a CSV
- Filtrable por rango de fechas superior
- Interfaz responsive

#### 2. **Más Vendidos**
- Top 10 productos por valor de ventas
- Visualización con barras de progreso
- Período personalizable
- Exportación CSV

#### 3. **Baja Rotación**
- Productos con menor movimiento en el período
- Muestra últimas salidas y stock actual
- Identificación de productos candidatos a reposicionamiento
- Exportación CSV

#### 4. **Tendencia de Movimientos**
- Gráfico de líneas con entradas vs salidas
- Análisis de tendencias por período
- Identificación de patrones estacionales

---

## Clasificación de Reportes

### ✅ REPORTES CONSERVADOS EN OPERACIONAL

| Reporte | Propósito | Estado |
|---------|-----------|--------|
| Cotizaciones/Ventas | Control operativo de ventas y cobranza | ✅ Protegido |
| Movimientos de Stock | Historial de movimientos y trazabilidad | ✅ Operativo |

### ✅ REPORTES MOVIDOS A PREDICTIVO

| Reporte | Propósito | Reclasificación |
|---------|-----------|-----------------|
| Más Vendidos | Análisis de performance de productos | Moved to Predictive |
| Baja Rotación | Identificación de productos lentos | Moved to Predictive |
| Tendencia | Análisis de patrones de demanda | Moved to Predictive |

### 🆕 REPORTES NUEVOS

| Reporte | Propósito | Ubicación |
|---------|-----------|-----------|
| Análisis Dinámico (Pivot) | Análisis flexible y exploración de datos | Predictive |

### ❌ REPORTES ELIMINADOS

| Reporte | Razón |
|---------|-------|
| Mejor Margen | Datos no confiables - schema usa retail_sale_price/wholesale_sale_price |
| Inventario Actual | Funcionalidad redundante con control de productos |
| Predicción de Pedidos | Reemplazado por análisis más robusto en Pivot |

---

## Permisos y Acceso

### Usuarios Operacionales (Sales, Warehouse, Storekeeper)
```
✅ Reportes Operacionales
   ├─ Cotizaciones/Ventas
   └─ Movimientos de Stock

❌ Análisis Inteligente (No visible)
```

### Admins/Owners
```
✅ Reportes Operacionales
   ├─ Cotizaciones/Ventas
   └─ Movimientos de Stock

✅ Análisis Inteligente
   ├─ Análisis Dinámico (Pivot)
   ├─ Más Vendidos
   ├─ Baja Rotación
   └─ Tendencia de Movimientos
```

---

## Pivot Report - Guía Detallada

### Ejemplo de Uso 1: Ventas por Cliente y Mes
1. Agrupar Filas: **Por Cliente**
2. Agrupar Columnas: **Por Mes**
3. Métrica: **Valor ($)**
4. Agregación: **Suma**

Resultado: Una matriz que muestra cuánto compró cada cliente en cada mes.

### Ejemplo de Uso 2: Movimiento de Productos por Categoría y Semana
1. Agrupar Filas: **Por Categoría**
2. Agrupar Columnas: **Por Semana**
3. Métrica: **Cantidad**
4. Agregación: **Suma**

Resultado: Análisis de cantidad vendida por categoría en cada semana.

### Ejemplo de Uso 3: Promedio de Venta por Producto
1. Agrupar Filas: **Por Producto**
2. Agrupar Columnas: **Por Día**
3. Métrica: **Valor ($)**
4. Agregación: **Promedio**

Resultado: Valor promedio por día para cada producto.

---

## Datos de Referencia

### Entidades Utilizadas
- **Quotation**: Cotizaciones (estado, cliente, total, pago, entrega)
- **Movement**: Movimientos de stock (tipo, cantidad, valor, producto)
- **Product**: Productos (categoría, nombre, stock)
- **Category**: Categorías de productos

### Período Configurado por Defecto
- **Rango**: Últimos 30 días
- **Personalizable**: Sí, mediante controles de fecha superior

### Totales y Subtotales
- ✅ Por fila (suma de todas las columnas)
- ✅ Por columna (suma de todas las filas)
- ✅ Gran total (suma general)

---

## Limitaciones y Consideraciones

### Datos Disponibles
- ✅ Salidas de inventario (ventas)
- ✅ Entradas de inventario (compras)
- ✅ Devoluciones
- ✅ Ajustes manuales
- ✅ Datos de cotización (cliente, monto, forma de pago)

### No Disponibles (No en scope actual)
- Margen de ganancia (los datos de costo no están normalizados)
- Análisis de rentabilidad avanzado
- Predicción de demanda basada en ML
- Datos de competencia o mercado externo

### Performance
- Optimizado para ~500 productos, ~1000 movimientos por período
- Cálculos en memoria (sin llamadas API adicionales)
- Respuesta instantánea en pivots

---

## Cambios Técnicos

### Archivos Modificados
- `pages/Reports.jsx` - Página principal reorganizada
- `components/reports/OperationalReports.jsx` - Nuevo componente para capa operacional
- `components/reports/PredictiveReports.jsx` - Nuevo componente para capa predictiva + Pivot

### Arquitectura
```
Reports (página principal)
├─ Selector de fechas (global)
├─ Tabs (Operacional | Predictivo)
│
├─ TabsContent: Operacional
│  ├─ OperationalReports (componente)
│  │  ├─ Cotizaciones/Ventas
│  │  └─ Movimientos de Stock
│
└─ TabsContent: Predictivo (solo si isAdmin)
   ├─ PredictiveReports (componente)
   │  ├─ DynamicPivotReport (sub-componente)
   │  ├─ Más Vendidos
   │  ├─ Baja Rotación
   │  └─ Tendencia
```

### Reutilización de Código
- Lógica de filtrado compartida
- Funciones de exportación CSV centralizadas
- Cálculos de agregación eficientes

---

## Próximos Pasos y Mejoras Futuras

### Corto Plazo
- [ ] Pruebas de permisos por rol en todos los reportes
- [ ] Validación de datos vacíos/nulos
- [ ] Optimización de queries para períodos largos

### Mediano Plazo
- [ ] Guardar configuraciones de pivot favoritas
- [ ] Exportar a Excel con formato mejorado
- [ ] Gráficos interactivos en reportes predictivos

### Largo Plazo
- [ ] Alertas automáticas basadas en umbrales
- [ ] Análisis de discrepancias e inconsistencias
- [ ] Reporte de ingresos vs egresos

---

## Contacto y Soporte

Para preguntas sobre la reorganización de reportes o requests de mejora, contacta al equipo de desarrollo.