/**
 * Regresión 2-3: createProductSafe / updateProductSafe aceptaban stock negativo
 * (solo se validaban los precios). No importan el SDK ni llaman a producción.
 *
 * Run with: deno test -A base44/tests/product_stock_validation_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateProductStock } from "../shared/productStockValidation.ts";

const read = (p: string) => Deno.readTextFile(new URL(`../../${p}`, import.meta.url));

Deno.test("validateProductStock rechaza stock negativo (-5, -4, -0.5)", () => {
  for (const v of [-5, -4, -0.5, "-3"]) {
    assert(validateProductStock(v) !== null, `debió rechazar ${v}`);
  }
});

Deno.test("validateProductStock rechaza valores no numéricos", () => {
  for (const v of ["abc", NaN, Infinity, {}]) {
    assert(validateProductStock(v) !== null, `debió rechazar ${String(v)}`);
  }
});

Deno.test("validateProductStock acepta ausente, 0 y positivos", () => {
  for (const v of [undefined, null, 0, 1, 12.5, "7"]) {
    assertEquals(validateProductStock(v), null);
  }
});

Deno.test("createProductSafe y updateProductSafe validan stock y devuelven 400", async () => {
  for (const f of ["createProductSafe", "updateProductSafe"]) {
    const src = await read(`base44/functions/products/handlers/${f}.ts`);
    assert(src.includes("validateProductStock("), `${f}: no valida stock`);
    const i = src.indexOf("validateProductStock(");
    assert(src.slice(i, i + 300).includes("status: 400"), `${f}: no responde 400`);
    // La validación debe ir antes de cualquier escritura.
    assert(i < src.indexOf(".entities.Product.create(") || !src.includes(".entities.Product.create("));
    assert(i < src.indexOf(".entities.Product.update(") || !src.includes(".entities.Product.update("));
  }
});
