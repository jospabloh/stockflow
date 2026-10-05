/**
 * seedDefaultPermissionProfiles debe sembrar las MISMAS claves canonicas que
 * backfillPermissionDefaults / getPermissionProfiles (sin acentos), y la denylist de
 * almacenista debe cubrir 'Configuracion:*'. Antes tenia una copia manual con 142 claves
 * acentuadas ('Configuración:*') que dejaba a negocios nuevos sin esas claves.
 *
 * Run: deno test -A base44/tests/seed_permission_keys_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const read = (p: string) => Deno.readTextFile(new URL(`../../base44/functions/permissions/handlers/${p}`, import.meta.url));

function block(src: string): string {
  const m = src.match(/\/\/ AUTOGEN:CANONICAL_KEYS:BEGIN[\s\S]*?\/\/ AUTOGEN:CANONICAL_KEYS:END/);
  assert(m, "falta el bloque AUTOGEN:CANONICAL_KEYS");
  return m[0];
}
function keys(src: string): string[] {
  const b = block(src);
  const start = b.indexOf("CANONICAL_KEYS: string[] = [");
  const end = b.indexOf("];", start);
  return [...b.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}
function denied(src: string): string[] {
  const b = block(src);
  const start = b.indexOf("ALMACENISTA_DENIED");
  return [...b.slice(start).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

Deno.test("seed usa el bloque AUTOGEN y las mismas claves que backfill y getPermissionProfiles", async () => {
  const seed = await read("seedDefaultPermissionProfiles.ts");
  const backfill = await read("backfillPermissionDefaults.ts");
  const get = await read("getPermissionProfiles.ts");
  assertEquals(keys(seed), keys(backfill));
  assertEquals(keys(seed), keys(get));
  assertEquals(denied(seed), denied(backfill));
  assert(keys(seed).length >= 190);
});

Deno.test("seed: sin claves acentuadas y almacenista deniega Configuracion:*", async () => {
  const seed = await read("seedDefaultPermissionProfiles.ts");
  const ks = keys(seed);
  // Las canonicas no llevan vocales acentuadas (la n con tilde de Campanas si es canonica).
  assert(ks.every((k) => !/[áéíóúÁÉÍÓÚ]/.test(k)), "claves con acentos");
  const d = new Set(denied(seed));
  const conf = [
    "edit_company_name", "edit_company_rfc", "edit_company_contact", "edit_logo", "edit_colors",
    "edit_tax_rate", "edit_currency", "edit_quotation_footer", "import_products", "manage_team", "delete_account",
  ].map((k) => `Configuracion:${k}`);
  for (const k of conf) {
    assert(ks.includes(k), `falta la clave ${k}`);
    assert(d.has(k), `almacenista deberia tener ${k} denegada`);
  }
  // Borrar proveedores/clientes/contactos ya no se niega (decision de JP 2026-10-05, con aviso al admin).
  assert(!d.has("Proveedores:delete") && !d.has("Clientes:delete") && !d.has("Contactos:delete"));
});

// ── Decision de JP 2026-10-05: el almacenista de un negocio nuevo nace igual que el de
// Baristop Distribuidora (sin reportes, sin precios de cotizacion, sin pagos a proveedores). ──
// Excepcion: las 5 claves Proveedores:edit_* (editar proveedor sigue solo owner/admin).
const DIRECTORY_KEYS_PENDING = [
  "Proveedores:edit_name", "Proveedores:edit_contact", "Proveedores:edit_address",
  "Proveedores:edit_rfc", "Proveedores:edit_notes",
];

function seededAlmacenista(src: string): Record<string, boolean> {
  const d = new Set(denied(src));
  return Object.fromEntries(keys(src).map((k) => [k, !d.has(k)]));
}

Deno.test("seed: el almacenista nuevo niega Reportes:view, Cotizaciones:pricing y Pagos a Proveedores:view/create", async () => {
  const p = seededAlmacenista(await read("seedDefaultPermissionProfiles.ts"));
  for (const k of ["Reportes:view", "Cotizaciones:pricing", "Pagos a Proveedores:view", "Pagos a Proveedores:create"]) {
    assertEquals(p[k], false, `${k} debe nacer denegada`);
  }
});

Deno.test("seed: el almacenista nuevo coincide con la foto del de Baristop (salvo las 5 claves Proveedores:edit_*)", async () => {
  const fixture = JSON.parse(
    await Deno.readTextFile(new URL("./fixtures/baristop_almacenista_profile.json", import.meta.url)),
  ).permissions as Record<string, boolean>;
  const p = seededAlmacenista(await read("seedDefaultPermissionProfiles.ts"));
  const diffs = Object.keys(fixture)
    .filter((k) => !DIRECTORY_KEYS_PENDING.includes(k) && p[k] !== fixture[k])
    .map((k) => `${k}: sembrado=${p[k]} baristop=${fixture[k]}`);
  assertEquals(diffs, []);
  // Las claves que Baristop no tiene siguen existiendo en el perfil sembrado.
  for (const k of ["Configuracion:export_data", "Venta de Maquinaria:view", "Venta de Maquinaria:financials"]) {
    assert(k in p, `falta ${k}`);
  }
  // Editar proveedor sigue solo owner/admin: las 5 siguen denegadas. Borrar queda concedido como en Baristop.
  for (const k of DIRECTORY_KEYS_PENDING) assertEquals(p[k], false, k);
  for (const k of ["Proveedores:delete", "Clientes:delete", "Contactos:delete"]) assertEquals(p[k], true, k);
});

Deno.test("hasPermission (copia AUTOGEN) usa la misma lista de denegados que el seed", async () => {
  const seed = await read("seedDefaultPermissionProfiles.ts");
  const perm = await Deno.readTextFile(new URL("../../base44/functions/quotations/handlers/_permissions.ts", import.meta.url));
  assertEquals(denied(perm), denied(seed));
});
