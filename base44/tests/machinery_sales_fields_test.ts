/**
 * Tests para la normalización de campos de MachinerySale
 * (base44/functions/machinerySales/handlers/_fields.ts).
 *
 * Lo que de verdad se está fijando aquí es `applyCost`: el costo es el único
 * campo que la UI esconde tras 'Venta de Maquinaria:financials', así que quien
 * no tenga ese permiso guarda el formulario SIN costo. Si el handler tomara
 * ese hueco como un cero, un almacenista corrigiendo el nombre del cliente
 * borraría el costo de la venta —y con él la utilidad y la comisión— sin ver
 * jamás el campo que destruyó. Es un fallo silencioso: el guardado responde
 * éxito y la cifra se pierde.
 *
 * Sin `import` externo a propósito: `deno.land` y `jsr.io` están bloqueados en
 * el sandbox de desarrollo, y una prueba que no se puede correr donde se
 * escribe es una prueba que se escribe a ciegas. Ver CLAUDE.md, módulo 15.
 *
 * Correr con: deno test base44/tests/machinery_sales_fields_test.ts
 */

import { applyCost, normalizeFields, validate } from "../functions/machinerySales/handlers/_fields.ts";

function assertEquals(actual: unknown, expected: unknown, msg?: string) {
  if (actual !== expected) {
    throw new Error(`${msg ? msg + ": " : ""}esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`);
  }
}

// ── applyCost: el permiso decide si el cuerpo manda ────────────────────────

Deno.test("applyCost: sin 'financials' conserva el costo almacenado", () => {
  // El cliente no envió `cost` porque la UI no le mostró el campo.
  assertEquals(applyCost({}, false, 40800), 40800);
});

Deno.test("applyCost: sin 'financials' ignora un costo enviado a mano", () => {
  // Un cuerpo manipulado desde devtools tampoco puede tocar el costo.
  assertEquals(applyCost({ cost: 0 }, false, 40800), 40800);
  assertEquals(applyCost({ cost: 999999 }, false, 40800), 40800);
});

Deno.test("applyCost: con 'financials' el cuerpo manda, incluido el cero", () => {
  assertEquals(applyCost({ cost: 52590 }, true, 40800), 52590);
  // Poner el costo en cero es una edición legítima de quien sí ve el campo.
  assertEquals(applyCost({ cost: 0 }, true, 40800), 0);
});

Deno.test("applyCost: con 'financials' pero sin campo, el alta arranca en cero", () => {
  assertEquals(applyCost({}, true, 0), 0);
});

// ── normalizeFields ───────────────────────────────────────────────────────

Deno.test("normalizeFields: recorta texto y tolera importes vacíos", () => {
  const f = normalizeFields({
    client_name: "  Mauricio  ",
    machine_type: " Ruby Negra 1 grupo ",
    sale_price: "",
  });
  assertEquals(f.client_name, "Mauricio");
  assertEquals(f.machine_type, "Ruby Negra 1 grupo");
  // Una venta en trámite (renglones 2 y 3 del Excel original) se guarda sin
  // importe, no se rechaza.
  assertEquals(f.sale_price, 0);
  assertEquals(f.sale_date, "");
});

Deno.test("normalizeFields: acepta el importe como número o como cadena", () => {
  assertEquals(normalizeFields({ sale_price: 49458 }).sale_price, 49458);
  assertEquals(normalizeFields({ sale_price: "60367.50" }).sale_price, 60367.5);
  // Basura no se convierte en NaN dentro del registro.
  assertEquals(normalizeFields({ sale_price: "abc" }).sale_price, 0);
});

// ── validate ──────────────────────────────────────────────────────────────

Deno.test("validate: el tipo de máquina es lo único obligatorio", () => {
  assertEquals(validate(normalizeFields({ machine_type: "Molino G6" }), 0), null);
  assertEquals(
    validate(normalizeFields({ machine_type: "   " }), 0),
    "El tipo de máquina es obligatorio",
  );
});

Deno.test("validate: la fecha, si viene, debe ser YYYY-MM-DD", () => {
  const ok = normalizeFields({ machine_type: "Ruby", sale_date: "2026-07-14" });
  assertEquals(validate(ok, 0), null);
  const bad = normalizeFields({ machine_type: "Ruby", sale_date: "14/07/2026" });
  assertEquals(validate(bad, 0), "La fecha debe tener formato YYYY-MM-DD");
  // Vacía es válida: es el estado "en trámite".
  assertEquals(validate(normalizeFields({ machine_type: "Ruby" }), 0), null);
});

Deno.test("validate: rechaza importes negativos", () => {
  const f = normalizeFields({ machine_type: "Ruby", sale_price: -1 });
  assertEquals(validate(f, 0), "El precio de venta no puede ser negativo");
  assertEquals(
    validate(normalizeFields({ machine_type: "Ruby" }), -5),
    "El costo no puede ser negativo",
  );
});
