# Baristop Distribuidora — Conteo físico y corrección de deriva

**Negocio:** Baristop Distribuidora (`business_id: 69c575fa1beaf2c90214d3ee`)
**Fecha de preparación:** 2026-06-08
**Motivo:** Las ventas a clientes con **precio cero** no descontaban stock (bug ya
corregido en producción). Eso dejó el stock del sistema **probablemente más alto**
que el físico en los productos vendidos a $0. El stock calculado no es confiable
(historial incompleto), por eso la verdad la da el **conteo físico**.

> ⚠️ **NO es necesario contar todo el inventario.** Solo los **7 productos** de
> abajo, que son los que tuvieron ventas a precio cero.

---

## 1. Hoja de conteo (cuenta físicamente solo estos 7)

| # | Producto | Stock en sistema | Sospecha (mínimo) | **Conteo físico real** |
|---|----------|:---:|:---:|:---:|
| 1 | Tisana Frutos Rojos | **11** | ~10 o menos¹ | ____ |
| 2 | Tisana Irimbo Moras | **11** | ~10 | ____ |
| 3 | Té Verde Matcha Ceremonial 250gr | **3** | ~2 | ____ |
| 4 | 1 Kg Café Coatepec en Grano | **24** | ~23 | ____ |
| 5 | Knock Box / Gabazera | **1** | ~0 | ____ |
| 6 | Cuchara Bailarina | **2** | ~1 | ____ |
| 7 | Jarabe Caramelo 750ml | **15** | ~14 | ____ |

¹ En *Tisana Frutos Rojos* se detectaron indicios de deriva mayor a 1 unidad
(una venta normal posterior registró stock 9 pero el sistema quedó en 11).
Cuéntala con cuidado.

- **"Stock en sistema"**: lo que el sistema cree hoy.
- **"Sospecha (mínimo)"**: solo una pista (system − 1 por la venta a $0 no aplicada).
  **No la uses como valor final** — usa siempre el conteo físico real.
- Si el **conteo físico = stock en sistema**, ese producto está bien: no lo corrijas.
- Si **conteo físico < stock en sistema** (lo más probable), corrígelo (paso 2).

---

## 2. Cómo corregir cada producto

Para cada producto donde el conteo físico **difiera** del sistema, fija el stock al
valor físico real. Esto crea automáticamente un movimiento de auditoría (`adjustment`)
con `stock_applied: true`, así que **no se duplica ni vuelve a moverse solo**.

### Opción A — desde la app (recomendada)
Entra como **admin de Baristop** y usa la función de **reconciliación / auditoría de
inventario** del producto, ingresando el conteo físico real. (Internamente llama a
`applyInventoryAuditCorrection`.)

### Opción B — invocando la función directamente
Como **admin de Baristop**, invoca `applyInventoryAuditCorrection` una vez por
producto a corregir:

```json
{
  "product_id": "<ID del producto>",
  "action": "revert_to_calculated",
  "expected_stock": <CONTEO FÍSICO REAL>,
  "notes": "Corrección por ventas a precio cero que no descontaron stock (auditoría 2026-06-08)"
}
```

**IDs de producto (para el payload):**

| Producto | product_id |
|----------|-----------|
| Tisana Frutos Rojos | `69cc08809d1c9ff8c9757544` |
| Tisana Irimbo Moras | `69cc0880583d87d79730a94b` |
| Té Verde Matcha Ceremonial 250gr | `69cc0881a8a01dc4ca72b18e` |
| 1 Kg Café Coatepec en Grano | `69cc088da719f8d650067a61` |
| Knock Box / Gabazera | `69cc0887583d87d79730a94e` |
| Cuchara Bailarina | `69cc0886399997dd2b2835d1` |
| Jarabe Caramelo 750ml | `69cc086bdd2f27ccce201c91` |

> `action: "revert_to_calculated"` fija el stock al valor que pongas en
> `expected_stock` (tu conteo físico) y registra el ajuste. Debe ejecutarlo un
> usuario admin de Baristop (la función valida `business_id`).

---

## 3. Verificación final
Tras corregir, vuelve a abrir cada producto y confirma que el stock muestra tu
conteo físico. A partir de aquí, como el bug ya está corregido, **futuras ventas
(incluidas las de precio cero) descontarán stock correctamente** y no se volverá
a generar esta deriva.

---

## Origen de los datos (ventas a precio cero detectadas)
7 movimientos `exit` con `unit_price = 0` en Baristop, 1 unidad cada uno:

| Fecha | Producto | Cant. | Cliente (reason) |
|-------|----------|:---:|------|
| 2026-06-04 | Tisana Frutos Rojos | 1 | Venta a Baristop Distribuidora |
| 2026-06-04 | Tisana Irimbo Moras | 1 | Venta a Baristop Distribuidora |
| 2026-06-02 | Té Verde Matcha Ceremonial 250gr | 1 | Venta a Baristop Distribuidora |
| 2026-05-29 | 1 Kg Café Coatepec en Grano | 1 | Baristop Distribuidora |
| 2026-05-08 | Knock Box / Gabazera | 1 | Venta a Baristop Distribuidora |
| 2026-05-08 | Cuchara Bailarina | 1 | Venta a Baristop Distribuidora |
| 2026-05-05 | Jarabe Caramelo 750ml | 1 | Venta a Baristop Distribuidora |
