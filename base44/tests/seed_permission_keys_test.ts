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
  assert(d.has("Proveedores:delete") && d.has("Clientes:delete") && d.has("Contactos:delete"));
});
