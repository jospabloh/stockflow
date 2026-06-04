# Utilidad Integral — Diseño y Fórmulas

> Estado: **decisiones cerradas** — listo para implementar por fases.
> Base contable elegida: **Devengado (accrual)**, con pagos a proveedores en base efectivo (línea propia).
> Objetivo: que la pestaña *Utilidad* deje de ser una libreta manual aislada y
> se convierta en el **Estado de Resultados real** del negocio, derivado de la
> operación, con capacidad de **proyección** a fin de día / semana / mes / año.

---

## 1. El problema actual

Hoy existen **dos "utilidades" que no se hablan**:

| | Qué es | Fuente | Síntoma |
|---|---|---|---|
| Pestaña `Utility.jsx` | Libreta manual | Tabla `UtilityMovement` (captura a mano) | Marca **$0.00** porque nadie teclea nada |
| Dashboard `salesData` | Motor real | `Quotation` + `Movement` + `SupplierPayment` | Sí calcula utilidad, pero vive solo en el dashboard |

El motor contable correcto **ya existe** en `src/pages/Dashboard.jsx` (`salesData`,
líneas ~212-287). El plan **no es construirlo de cero**, es:

1. Extraerlo a un módulo compartido reutilizable.
2. Fusionarlo con los gastos/ingresos operativos manuales.
3. Mostrarlo en la pestaña Utilidad como Estado de Resultados.
4. Añadir encima la capa de proyección.

---

## 2. Los dos estados financieros (no confundir)

| | Pregunta | Cómo se arma |
|---|---|---|
| **Estado de Resultados** (utilidad) | ¿Gané o perdí? | Ventas − COGS − Gastos operativos |
| **Flujo de efectivo** (caja) | ¿Cuánto dinero se movió? | Cobros − Pagos |

Elegimos **devengado** para la utilidad: la venta cuenta cuando **se hace**
(aunque no se haya cobrado), el costo cuando **se entrega**. Lo pendiente de
cobrar se reporta aparte como indicador de salud de caja, no afecta la utilidad.

---

## 3. Fórmula de Utilidad Real (devengado)

```
INGRESOS OPERATIVOS (Ventas devengadas)
    = Σ Quotation(status="converted", total>0, payment_method≠"Sin cargo").total
    + Σ Movement(type="exit", sin quotation_id).total          (ventas directas)
    − Σ Movement(type="return", de cotización no cancelada).total

COSTO DE VENTAS (COGS)
    = Σ Movement(type="exit" válida).quantity × costo_unitario
    − Σ Movement(type="return" válida).quantity × costo_unitario
      donde costo_unitario = m.cost_price  (o product.purchase_price como fallback)

UTILIDAD BRUTA = Ingresos operativos − COGS

GASTOS OPERATIVOS = Σ UtilityMovement(movement_type="expense").amount
                    (renta, luz, nómina, comisiones... lo que la app NO sabe)

OTROS INGRESOS    = Σ UtilityMovement(movement_type="income").amount
                    (intereses, reembolsos, etc.)

PAGOS A PROVEEDORES = Σ SupplierPayment.amount   (del periodo)
```

### Resultado final

```
UTILIDAD REAL (operativa)  = Utilidad Bruta − Gastos operativos + Otros ingresos
UTILIDAD NETA              = Utilidad Real − Pagos a proveedores
```

> ⚠️ **Doble conteo — decisión tomada:** los pagos a proveedores SÍ reducen el
> resultado (gasto del periodo en que se pagó), pero como **línea separada y
> etiquetada** (`Utilidad Neta`), nunca mezclados con el COGS en un solo número.
> Restar pagos a proveedores *además* del COGS cuenta el costo del inventario
> dos veces; por eso se presentan en dos renglones distintos: `Utilidad Real`
> es la utilidad contable limpia (devengado), y `Utilidad Neta` es la vista
> ajustada por la salida de caja a proveedores. Transparente para el usuario.

---

## 3.1 Mapeo de rubros — anti doble-conteo (decidido)

Se añade un campo **`pl_treatment`** a la entidad `Rubro` que define cómo entra
cada rubro al Estado de Resultados. Mapeo sobre el catálogo real (`DEFAULT_RUBROS`
en `src/lib/catalogDefaults.ts`):

| `pl_treatment` | Efecto | Rubros |
|---|---|---|
| `operating` (default) | Cuenta como gasto/ingreso operativo manual | Renta, Nómina, Servicios, Mantenimiento, Publicidad, Papelería, Limpieza, Transporte, Compras menores, Viáticos locales, Otros, Otros ingresos, Reposición, Reintegro, Ajuste positivo |
| `auto_sales` | Ya lo captura el motor de ventas → se **excluye** del manual | Ventas |
| `auto_cogs` | Ya lo cubren COGS / pagos a proveedores → se **excluye** | Compras de mercancía |
| `distribution` | Retiro de utilidad (no es gasto) → **excluido** del resultado, va "bajo la línea" | Retiro de utilidades |

Regla: al agregar gastos/ingresos manuales se suman **solo** los movimientos cuyo
rubro es `operating`. Los demás se ignoran (o se muestran informativos) para no
duplicar lo que la app ya calcula sola.

## 4. Capa de proyección (predicción estadística)

> **Toggle (decidido):** bandera `utility_forecast_enabled` en `AppSettings` por
> negocio, con switch en la pestaña Utilidad.
> - **OFF** → solo lo **real, al día y momento** (realizado hasta ahora, sin proyectar).
> - **ON** → agrega las tarjetas de proyección descritas abajo.


Tres técnicas que se suman. Los datos para las tres **ya existen** en la app.

### 4.1 Run-rate (proyección lineal con estacionalidad)

```
utilidad_proyectada_lineal = (utilidad_acumulada / días_transcurridos) × días_periodo
```

Mejora: ponderar por día de la semana usando promedio móvil de movimientos
históricos (ya hay series por hora/día/semana/mes en Dashboard, líneas ~320-390).

### 4.2 Pipeline ponderado por tasa de conversión

El activo más valioso: la **tasa de conversión histórica** (hoy ~90% en el
semáforo de cotizaciones).

```
tasa_conversion = cotizaciones_concretadas / cotizaciones_totales_periodo
ingreso_esperado_pipeline = Σ Quotation(status activo).total × tasa_conversion
cogs_esperado_pipeline    = Σ (items × costo) de esas cotizaciones × tasa_conversion
utilidad_esperada_pipeline = ingreso_esperado_pipeline − cogs_esperado_pipeline
```

### 4.3 Compromisos conocidos (gastos fijos recurrentes)

Requiere un campo nuevo en `UtilityMovement` (o entidad nueva `RecurringExpense`):
marcar gastos como recurrentes (renta día 1, nómina quincena). Se restan a la
proyección aunque aún no se hayan registrado en el periodo.

```
gastos_fijos_pendientes = Σ recurrentes del periodo aún no registrados
```

### Proyección combinada

```
UTILIDAD PROYECTADA (fin de periodo) ≈
      utilidad_realizada_hasta_hoy
    + utilidad_esperada_pipeline
    − gastos_fijos_pendientes
```

Con horizontes: **día / semana / mes / año** (mismo motor, distinto rango).

---

## 5. Arquitectura propuesta (cómo encaja en el código)

1. **`src/lib/finance/profitEngine.js`** (nuevo)
   - Extraer la lógica de `salesData` del Dashboard a funciones puras y testeables:
     `computeOperatingResult({ quotations, movements, products, utilityMovements, supplierPayments, period })`.
   - Devuelve el Estado de Resultados completo (ingresos, COGS, bruta, gastos, real, neta).
   - El Dashboard pasa a **consumir** este módulo (elimina duplicación).

2. **`src/lib/finance/forecast.js`** (nuevo)
   - Run-rate + estacionalidad + pipeline ponderado + recurrentes.
   - Entrada: resultado realizado + cotizaciones activas + tasa de conversión.

3. **`src/pages/Utility.jsx`** (refactor)
   - Deja de leer solo `UtilityMovement`.
   - Muestra el Estado de Resultados real (auto + manual fusionados).
   - Tarjetas: Utilidad Bruta / Real / Neta + Proyección del periodo.
   - El "Desglose por rubro" suma rubros automáticos (Ventas, COGS) + manuales.

4. **Datos nuevos (mínimos)**
   - Campo `recurring` / `recurrence` en `UtilityMovement` para gastos fijos.
   - Reglas anti-doble-conteo entre `UtilityMovement` y `SupplierPayment`.

5. **Reutilización**
   - Tasa de conversión y series temporales ya calculadas en Dashboard → mover
     también a `src/lib/finance/` para compartir entre Dashboard y Utilidad.

---

## 6. Decisiones (cerradas)

1. **Pagos a proveedores:** gasto del periodo en que se pagó, como línea
   separada `Utilidad Neta` (no mezclado con COGS). ✅
2. **Rubros operativos vs. ya-capturados:** campo `pl_treatment` en `Rubro`
   (ver §3.1). Solo `operating` suma al resultado. ✅
3. **Toggle de proyección:** `utility_forecast_enabled` en `AppSettings`. OFF =
   solo real; ON = proyección. ✅
4. **COGS de pipeline:** se estima con `purchase_price` actual de cada producto
   del item de la cotización activa. ✅

### Pendientes menores (a afinar durante la implementación)
- **Año/estacionalidad:** run-rate simple cuando no hay histórico suficiente;
  promedio móvil ponderado por día de semana cuando sí lo hay.
- **Gastos recurrentes:** campo `recurrence` en `UtilityMovement` (no entidad nueva).

---

## 7. Orden de implementación sugerido (cuando se apruebe)

1. Extraer `profitEngine.js` desde `salesData` (sin cambiar comportamiento del Dashboard).
2. Conectar Utilidad al motor → Estado de Resultados real (adiós libreta vacía).
3. Resolver doble conteo / mapeo de rubros.
4. Añadir `forecast.js` (run-rate + pipeline).
5. Añadir gastos recurrentes y proyección anual.
