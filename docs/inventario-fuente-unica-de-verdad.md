# Inventario: una sola fuente de verdad para el stock

> Estado: **propuesta de diseño** · Autor: equipo StockFlow · Fecha: 2026-06-08
> Origen: reporte de Baristop Distribuidora — "el inventario no se actualiza
> después de usar un cliente de tipo precio cero".

Este documento explica **por qué el inventario se desincroniza**, con evidencia
real de producción, y define la **solución escalable** (no un parche) con un
plan de migración seguro para producción.

---

## 1. Síntoma reportado

Al registrar una salida con un cliente `force_zero_price` (precio cero /
transferencia interna), el movimiento se crea correctamente en $0 pero **el
stock del producto no refleja el cambio de forma confiable**.

## 2. Causa raíz: NO existe una única fuente de verdad para el stock

El stock de un producto (`Product.stock`) se modifica hoy por **tres caminos
distintos e inconsistentes entre sí**. No hay un contrato único, y ninguno es
transaccional con la creación del `Movement`.

### Camino A — Automatización asíncrona (`syncProductStock`)
La mayoría de las funciones **solo crean el `Movement`** y delegan el ajuste de
stock a una automatización de Base44 que se dispara con los eventos de
`Movement` y aplica un **delta relativo** (`stock ± quantity`):

- `createMovementSafe` — crea el `Movement`, nunca toca `Product.stock`.
- `convertQuotationSafe` — crea movimientos `exit`, nunca toca `Product.stock`.
- `partialReturnQuotation` — crea movimientos `entry`, nunca toca `Product.stock`.
- `cancelQuotationSafe` — crea movimientos `entry`, nunca toca `Product.stock`.

Estas funciones llevan comentarios explícitos como:
> *"No explicit stock update: automation is the sole stock authority."*

Problemas de este camino:
- Es **asíncrono y best-effort**: si el evento no se dispara, se pierde, se
  duplica o llega con retraso, el stock queda mal y **nadie se entera**.
- El **trigger vive en el panel de Base44**, fuera del repositorio y sin
  versionar. Cualquier condición de filtro ahí (por ejemplo sobre `total` o
  `unit_price`) hace que los movimientos en **$0** no disparen el ajuste — que
  es exactamente el caso del cliente de precio cero.
- Aplica **deltas relativos**, por lo que es sensible a **condiciones de
  carrera** (dos movimientos simultáneos sobre el mismo producto) y a **eventos
  duplicados**.

### Camino B — Escritura directa `Product.update({ stock })`
Otras funciones **sí** escriben el stock directamente:

- `deliverQuotationSafe` — **crea el `Movement` Y ADEMÁS** hace
  `Product.update({ stock })`. Si la automatización del Camino A también se
  dispara para ese movimiento, el stock se **descuenta dos veces**.
- `deleteMovementSafe` — para `adjustment` escribe stock explícitamente para
  compensar el delta de la automatización (lógica frágil, dependiente del orden).
- `updateProductStockSafe` — fija `stock` directamente, **sin** registrar un
  `Movement`. El historial (ledger) no se entera de ese cambio.
- `createProductSafe` — fija el `stock` inicial directamente, **sin** crear un
  movimiento inicial. ⇒ el stock inicial **no está en el ledger**.

### Camino C — Edición manual / importación
- `importItemsSafe` — sí crea un movimiento inicial (consistente).
- Edición manual de producto — puede fijar `stock` sin movimiento.

### Consecuencia
- El **ledger de `Movement` está incompleto**: el stock inicial creado por UI y
  las ediciones manuales no están registrados como movimientos.
- `Product.stock` y "el stock calculado por el historial de movimientos" **se
  desincronizan** de forma rutinaria. Tan conocido es el problema que **ya
  existe una función dedicada a reconciliarlo manualmente**:
  `applyInventoryAuditCorrection` (acciones `accept_current` /
  `revert_to_calculated`). Es decir: el sistema ya convive con la deriva en
  lugar de prevenirla.

El "no se actualiza con precio cero" es **una manifestación visible** de este
problema estructural, no un bug aislado.

---

## 3. Evidencia en producción (Baristop Distribuidora)

`business_id = 69c575fa1beaf2c90214d3ee`

Reconciliando el ledger de dos productos con venta de precio cero el 2026-06-04:

| Producto | Último `Movement.stock_after` | `Product.stock` real | Δ |
|---|---|---|---|
| Tisana Frutos Rojos (`…7544`) | 9 (salida 06-05) | **11** | +2 |
| Tisana Irimbo Moras (`…94b`) | 10 (salida 06-05) | **11** | +1 |

En ambos casos el stock real **no coincide** con el resultado esperado del
último movimiento: hay deriva real entre el ledger y `Product.stock`. La
magnitud (+2 y +1) corresponde exactamente a cantidades de movimientos recientes
que no se aplicaron / se aplicaron de forma inconsistente. Esto confirma que el
problema es de **sincronización de stock**, no de cálculo de precio (el precio
sí sale en $0 correctamente).

---

## 4. Solución escalable: el ledger es la única fuente de verdad

Principio: **`Product.stock` deja de ser un valor mutado por deltas y pasa a ser
una proyección determinista del ledger de `Movement`.**

```
stock(producto) = (último checkpoint de adjustment) 
                  + Σ entradas posteriores 
                  − Σ salidas/devoluciones posteriores
                  (nunca por debajo de 0)
```

### 4.1 Función canónica `reconcileProductStock`
Una sola función backend, **idempotente y absoluta**, que:
1. Lee todos los `Movement` del producto en orden cronológico.
2. Toma como base el último movimiento `adjustment` (checkpoint absoluto) o 0 si
   no hay.
3. Aplica entradas/salidas/devoluciones posteriores.
4. Escribe `Product.stock` con el valor calculado.

Por ser **absoluta e idempotente**, es segura de ejecutar cuantas veces sea:
ejecutarla N veces da el mismo resultado. No puede causar doble descuento.

> ⚠️ **Auto-baseline obligatorio.** El ledger actual está **incompleto**: el
> stock inicial creado por `createProductSafe` y las ediciones manuales de
> `updateProductStockSafe` **no** existen como `Movement`. Por eso un recompute
> "ingenuo" (solo suma de movimientos) **subestimaría** el stock real en
> producción. Para que `reconcileProductStock` sea seguro de desplegar **antes**
> del backfill, en su primera ejecución sobre un producto **sin checkpoint** debe
> crear un `Movement` `adjustment = Product.stock actual` (no-op visible) y usar
> ese valor como base. Así nunca corrompe datos: la primera reconciliación deja
> el stock igual, y las siguientes ya son correctas.

### 4.2 Todos los caminos pasan por el ledger
- Cada función que cambie inventario **crea el/los `Movement` correspondiente(s)**
  y luego llama a `reconcileProductStock(product_id)` de forma **síncrona**.
- Las ediciones manuales de stock (`updateProductStockSafe`) y el stock inicial
  (`createProductSafe`) pasan a **registrar un `Movement` de tipo `adjustment`**
  (checkpoint absoluto) en vez de escribir `Product.stock` a mano. Así el ledger
  queda **completo** y la reconciliación siempre es correcta.
- `deliverQuotationSafe` deja de hacer el `Product.update` manual (lo reemplaza
  la reconciliación) ⇒ se elimina el doble descuento.

### 4.3 La automatización deja de ser autoridad
- `syncProductStock` se reescribe para **delegar en `reconcileProductStock`**
  (recompute absoluto) en lugar de aplicar deltas. Así, si el trigger se dispara,
  produce el mismo resultado idempotente; si no se dispara (p. ej. filtrado por
  `total = 0`), la llamada síncrona del paso 4.2 ya dejó el stock correcto.
- Una vez validado, el trigger del panel puede **deshabilitarse**: la autoridad
  del stock vive 100% en el código y versionada.

### 4.4 Red de seguridad: reconciliación nocturna
- Cron diario `dailyStockReconcile` que recorre los productos por negocio y
  ejecuta `reconcileProductStock`. Garantiza convergencia ante cualquier evento
  perdido o carrera, y deja un reporte de derivas corregidas.

### 4.5 Escalabilidad
- El recompute por producto es O(nº movimientos del producto). Para volúmenes
  altos se optimiza con el **checkpoint de `adjustment`**: solo se suman los
  movimientos posteriores al último checkpoint. La reconciliación nocturna puede
  además "compactar" creando checkpoints periódicos.

---

## 5. Plan de migración seguro para producción

> Cada fase es independiente, verificable y reversible. Nada destructivo se
> ejecuta sin checkpoint previo.

**Fase 0 — Diagnóstico y diseño (este documento).** ✅

**Fase 1 — Primitiva idempotente con auto-baseline (sin cambio de comportamiento).**
- Desplegar `reconcileProductStock` con **auto-baseline** (ver 4.1): seguro aun
  con el ledger incompleto, porque sobre un producto sin checkpoint fija la base
  = stock actual antes de recalcular.
- Reescribir `syncProductStock` para delegar en ella.
- Riesgo: bajo. La primera reconciliación por producto es un no-op visible (crea
  el checkpoint base); las siguientes son idempotentes. Reversible revirtiendo
  la función y borrando los checkpoints generados.

**Fase 2 — Completar el ledger (backfill explícito, opcional).**
- Ejecutar `reconcileProductStock` una vez por producto para materializar todos
  los checkpoints base de golpe (en vez de hacerlo perezosamente al primer
  movimiento). `reason = "Checkpoint de migración"`. No cambia el stock visible.
- ⚠️ Aunque el auto-baseline lo hace seguro, sigue siendo una mutación de datos
  en producción: se ejecuta por negocio y con respaldo previo (export de
  `Product` + `Movement`).

**Fase 3 — Conectar los escritores.**
- `createMovementSafe`, `convertQuotationSafe`, `partialReturnQuotation`,
  `cancelQuotationSafe`, `deliverQuotationSafe`: llamar a
  `reconcileProductStock` de forma síncrona tras crear/borrar movimientos.
- `createProductSafe` / `updateProductStockSafe`: registrar `adjustment` en vez
  de escribir stock directo.
- Eliminar el `Product.update` duplicado de `deliverQuotationSafe` y la
  compensación de `adjustment` en `deleteMovementSafe`.

**Fase 4 — Red de seguridad y apagado del trigger.**
- Desplegar `dailyStockReconcile`.
- Tras 1–2 ciclos sin derivas, deshabilitar el trigger de `syncProductStock` en
  el panel de Base44.

**Fase 5 — Corrección de la deriva existente.**
- Ejecutar `reconcileProductStock` para todos los productos de Baristop y
  cualquier tenant afectado, dejando reporte de antes/después.

---

## 6. Verificación

- **Unitario:** dado un set de movimientos conocido, `reconcileProductStock`
  produce el stock esperado (incluye casos: solo salidas, checkpoint intermedio,
  precio cero, devoluciones).
- **Idempotencia:** ejecutar la reconciliación 2× no cambia el resultado.
- **Sin doble descuento:** una venta con la automatización activa + llamada
  síncrona deja el stock correcto (no duplicado).
- **Precio cero:** una venta `force_zero_price` descuenta stock igual que una
  venta normal.
- **Producción:** tras Fase 5, `Product.stock == stock calculado por ledger`
  para todos los productos (la diferencia que hoy detecta
  `applyInventoryAuditCorrection` debe ser 0).

---

## 7. Rollback

- Fases 1, 3, 4 son cambios de código: revertir el deploy.
- Fase 2 (backfill) es reversible borrando los `Movement` con
  `reason = "Checkpoint de migración"` (idempotentes e identificables).
- El trigger del panel se puede reactivar en cualquier momento mientras la
  reconciliación síncrona siga activa (ambos convergen al mismo valor).
