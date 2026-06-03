# Utilidad Integral — Diseño y Fórmulas

> Estado: **propuesta para revisión** (sin implementar).
> Base contable elegida: **Devengado (accrual)**.
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

> ⚠️ **Riesgo de doble conteo (decisión clave a validar):**
> Hoy `UtilityMovement` y `SupplierPayment` pueden representar lo mismo
> (un egreso por pago a proveedor capturado en ambos lados). Y los pagos a
> proveedores en devengado **no son un gasto del periodo** — el costo ya está
> en el COGS cuando entregaste. Por eso se muestran como línea informativa
> (impacto en caja), no se restan dos veces. Hay que definir reglas claras de
> qué `rubro` de `UtilityMovement` es operativo vs. cuál ya está capturado en
> otro módulo, para no contar gastos por duplicado.

---

## 4. Capa de proyección (predicción estadística)

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

## 6. Decisiones abiertas (a resolver antes de implementar)

1. **Doble conteo proveedores:** ¿`SupplierPayment` es línea informativa (caja)
   o gasto que afecta utilidad? En devengado → informativa. Confirmar.
2. **Rubros operativos vs. ya-capturados:** mapear qué `Rubro` de `UtilityMovement`
   cuenta como gasto operativo nuevo y cuál duplica otro módulo.
3. **COGS de pipeline:** ¿estimamos costo de cotizaciones activas con `purchase_price`
   actual de cada producto del item? (Sí, recomendado.)
4. **Año/estacionalidad:** ¿proyección anual con los 12 meses o run-rate simple
   al inicio cuando no hay histórico suficiente?
5. **Gastos recurrentes:** ¿campo en `UtilityMovement` o entidad nueva dedicada?

---

## 7. Orden de implementación sugerido (cuando se apruebe)

1. Extraer `profitEngine.js` desde `salesData` (sin cambiar comportamiento del Dashboard).
2. Conectar Utilidad al motor → Estado de Resultados real (adiós libreta vacía).
3. Resolver doble conteo / mapeo de rubros.
4. Añadir `forecast.js` (run-rate + pipeline).
5. Añadir gastos recurrentes y proyección anual.
