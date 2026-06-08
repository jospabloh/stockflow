# Inventario: aplicación de stock exactamente-una-vez (single source of truth en código)

> Estado: **diseño + implementación** · Fecha: 2026-06-08
> Origen: reporte de Baristop Distribuidora — "el inventario no se actualiza
> después de usar un cliente de tipo precio cero".

Este documento explica **por qué el inventario se desincroniza**, con evidencia
real de producción, y define la **solución escalable** (no un parche): el efecto
de cada `Movement` sobre el stock se aplica **exactamente una vez**, de forma
**síncrona y determinista en el código**, sin depender de una automatización
oculta del panel.

---

## 1. Síntoma reportado

Al registrar una salida con un cliente `force_zero_price` (precio cero /
transferencia interna), el movimiento se crea correctamente en $0 pero **el
stock del producto no cambia de forma confiable**.

## 2. Causa raíz: el stock se aplica por caminos inconsistentes y no-determinista

`Product.stock` se modifica hoy por **tres caminos distintos que no concuerdan**,
y ninguno garantiza que el efecto de un movimiento se aplique **una y solo una vez**:

### Camino A — Automatización asíncrona (`syncProductStock`)
La mayoría de funciones **solo crean el `Movement`** y delegan el ajuste a una
automatización de Base44 que se dispara con los eventos de `Movement` y aplica un
**delta relativo** (`stock ± quantity`):

- `createMovementSafe`, `convertQuotationSafe`, `partialReturnQuotation`,
  `cancelQuotationSafe` — crean el `Movement` y **nunca** tocan `Product.stock`.

Lo llevan comentado: *"No explicit stock update: automation is the sole stock authority."*

Problemas:
- Es **asíncrona y best-effort**: si el evento no se dispara, se pierde, se
  duplica o llega tarde, el stock queda mal y **nadie se entera**.
- El **trigger vive en el panel de Base44**, fuera del repo y sin versionar.
  Cualquier condición de filtro ahí (p. ej. sobre `total`/`unit_price`) hace que
  los movimientos en **$0** no apliquen — exactamente el caso de precio cero.
- Aplica **deltas relativos** ⇒ sensible a **carreras** y **eventos duplicados**.

### Camino B — Escritura directa `Product.update({ stock })`
- `deliverQuotationSafe` — **crea el `Movement` Y ADEMÁS** escribe `Product.stock`.
  Si la automatización del Camino A también dispara ⇒ **doble descuento**.
- `deleteMovementSafe` — escribe stock explícitamente para compensar el delta.
- `updateProductStockSafe` — fija `stock` sin registrar movimiento.

### Camino C — Stock inicial / edición manual
- `createProductSafe` — fija `stock` inicial **sin** crear un movimiento ⇒ **el
  ledger de `Movement` está incompleto**: no contiene el stock inicial.

### Consecuencia
- No se puede "recalcular el stock sumando movimientos", porque el ledger no
  contiene el stock inicial ni las ediciones manuales.
- El efecto de cada movimiento puede aplicarse **0, 1 o 2 veces** según el camino
  y el azar del trigger ⇒ deriva rutinaria. Tan conocido es esto que **ya existe**
  `applyInventoryAuditCorrection` para reconciliar a mano.

El "no se actualiza con precio cero" es **una manifestación** de este problema
estructural, no un bug aislado.

---

## 3. Evidencia en producción (Baristop Distribuidora)

`business_id = 69c575fa1beaf2c90214d3ee` — reconciliando dos productos con venta
de precio cero el 2026-06-04:

| Producto | Esperado (último movimiento) | `Product.stock` real | Δ |
|---|---|---|---|
| Tisana Frutos Rojos (`…7544`) | 9 | **11** | +2 |
| Tisana Irimbo Moras (`…94b`) | 10 | **11** | +1 |

El stock real **no coincide** con el resultado esperado del último movimiento.
Hay deriva real entre el historial y `Product.stock` (no es un problema de
cálculo de precio: el precio sí sale en $0 correctamente).

---

## 4. Solución escalable: aplicar el efecto de cada movimiento exactamente una vez

Principio: **`Product.stock` sigue siendo el valor canónico** (ya refleja
correctamente el stock inicial y las ediciones manuales), pero el efecto de cada
`Movement` se aplica **exactamente una vez**, de forma **síncrona en el código**
y de manera **idempotente**.

### 4.1 Marca de idempotencia en `Movement`
Se agrega el campo `stock_applied: boolean` (default `false`). Marca si el efecto
de ese movimiento sobre el stock **ya fue aplicado**. Es la garantía de
exactamente-una-vez y permite auditar anomalías (movimientos viejos sin aplicar).

### 4.2 Función canónica `applyMovementStock`
Único lugar con la lógica de delta. Dado `{ movement_id }`:
1. Carga el movimiento (valida tenant).
2. Si `stock_applied === true` ⇒ **no hace nada** (idempotente).
3. Calcula el nuevo stock a partir de `Product.stock`:
   - `entry`  → `stock + quantity`
   - `exit` / `return` → `stock − quantity`
   - `adjustment` → `quantity` (valor **absoluto**, como indica la UI)
   (nunca por debajo de 0)
4. Escribe `Product.stock` y marca `stock_applied = true` (+ `stock_after`).

Es **O(1)** (no escanea el ledger) ⇒ escalable a cualquier volumen.

### 4.3 Los escritores aplican de forma síncrona
Cada función que registra inventario crea el/los `Movement` y **a continuación
invoca `applyMovementStock` de forma síncrona** (`await`). Así el stock queda
correcto **antes de responder**, sin depender de que un trigger dispare ni de su
condición (resuelve el caso de precio cero, independientemente del filtro del
panel). Afecta: `createMovementSafe`, `convertQuotationSafe`,
`partialReturnQuotation`, `cancelQuotationSafe`, `deliverQuotationSafe`.

### 4.4 La automatización deja de ser autoridad (create = NO-OP, sin carrera)
`syncProductStock` se reescribe para que el evento `create` sea un **no-op**.
Motivo: como **todos** los caminos de creación ya aplican el efecto ellos mismos
(síncronamente vía `applyMovementStock`, o creando con `stock_applied=true`),
tener a la automatización como **segundo aplicador** abriría una **condición de
carrera**: el escritor síncrono y la automatización podrían leer
`stock_applied=false` a la vez —antes de que cualquiera marque la bandera— y
aplicar el delta **dos veces**. Con un **único aplicador por movimiento**, la
carrera es imposible. Cualquier movimiento que quedara sin aplicar (un camino
futuro no contemplado) lo detecta `dailyStockReconcile` (`stock_applied=false`).

El trigger del panel puede además **deshabilitarse** cuando se quiera; con el
`create` en no-op ya no interfiere. (El `delete` se sigue revirtiendo en
`deleteMovementSafe`, que no depende del trigger.)

### 4.5 Doble descuento eliminado
`deliverQuotationSafe` deja de escribir `Product.stock` a mano y pasa por
`applyMovementStock` (con la marca), por lo que la automatización ya no puede
volver a descontar.

### 4.6 Red de seguridad: auditoría nocturna
Cron diario `dailyStockReconcile` que detecta y reporta:
- Movimientos recientes con `stock_applied = false` (efectos no aplicados).
- Discrepancias entre `Product.stock` y el efecto acumulado de sus movimientos
  aplicados desde el último checkpoint.
No corrige en silencio: deja reporte para revisión vía
`applyInventoryAuditCorrection`.

---

## 5. Plan de despliegue seguro para producción

> Cada fase es independiente, verificable y reversible.

**Fase 0 — Diagnóstico y diseño.** ✅ (este documento)

**Fase 1 — Esquema + primitiva (sin cambio de comportamiento observable).**
- Agregar `stock_applied` a `Movement` (default `false`).
- Desplegar `applyMovementStock` (idempotente).
- Reescribir `syncProductStock` para delegar en ella.
- Riesgo bajo: para movimientos existentes/nuevos, el resultado es el mismo o más
  correcto; la marca evita duplicar. Reversible revirtiendo el deploy.

**Fase 2 — Aplicación síncrona en los escritores.**
- `createMovementSafe`, `convertQuotationSafe`, `partialReturnQuotation`,
  `cancelQuotationSafe`, `deliverQuotationSafe`: invocar `applyMovementStock`
  tras crear el/los movimiento(s). Quitar el `Product.update` duplicado de
  `deliverQuotationSafe`.
- A partir de aquí el stock es correcto **sin depender del trigger** (incluye
  precio cero).

**Fase 3 — Apagar el trigger del panel.**
- Tras 1–2 días sin anomalías en `dailyStockReconcile`, deshabilitar el trigger
  de `syncProductStock` en Base44. La aplicación síncrona ya es suficiente.

**Fase 4 — Corrección de la deriva existente.**
- Revisar el reporte de `dailyStockReconcile` y corregir los productos
  desincronizados (Baristop incluido) vía `applyInventoryAuditCorrection`.

---

## 6. Verificación

- **Idempotencia:** invocar `applyMovementStock` 2× sobre el mismo movimiento no
  cambia el stock la segunda vez.
- **Precio cero:** una venta `force_zero_price` descuenta stock igual que una
  venta normal.
- **Sin doble descuento:** crear un movimiento con el trigger activo + la llamada
  síncrona deja el stock correcto (no duplicado).
- **Devolución/cancelación:** restauran stock exactamente una vez.
- **Producción:** tras Fase 4, `Product.stock` consistente con los movimientos
  aplicados; `dailyStockReconcile` sin anomalías.

---

## 7. Rollback

- Fases 1–2 son cambios de código: revertir el deploy. La marca `stock_applied`
  es additiva y no rompe el camino anterior.
- Fase 3: reactivar el trigger en el panel en cualquier momento (es idempotente
  junto con la aplicación síncrona).
- Fase 4: las correcciones quedan registradas como movimientos de auditoría
  (`applyInventoryAuditCorrection`), trazables y reversibles.
