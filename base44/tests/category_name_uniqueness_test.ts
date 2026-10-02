/**
 * updateCategorySafe e importItemsSafe (categories) deben aplicar las mismas reglas que
 * createCategorySafe: nombre obligatorio (400) y unico por tenant sin distinguir
 * mayusculas ni espacios extremos (409 / error por fila).
 * Usa los handlers REALES con un SDK simulado en memoria. No toca red ni datos reales.
 *
 * Run: deno test -A base44/tests/category_name_uniqueness_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

const tables: Record<string, Row[]> = {};
let seq = 0;
const OWNER = { id: "u1", email: "dueno@b1.com", role: "owner", business_id: "b1" };

function entity(table: string) {
  return {
    filter: (q: Row = {}) =>
      Promise.resolve(
        (tables[table] ??= []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r })),
      ),
    create: (data: Row) => {
      const row = { id: `${table}-${++seq}`, ...data };
      (tables[table] ??= []).push(row);
      return Promise.resolve({ ...row });
    },
    update: (id: string, p: Row) => {
      const row = (tables[table] ?? []).find((r) => r.id === id)!;
      Object.assign(row, p);
      return Promise.resolve({ ...row });
    },
  };
}
G.__sf = {
  client() {
    const entities = new Proxy({}, { get: (_t, name: string) => entity(name) });
    return { auth: { me: () => Promise.resolve(OWNER) }, entities, asServiceRole: { entities } };
  },
};
const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__sf.client(r); }");

async function load(rel: string) {
  const abs = new URL(`../../${rel}`, import.meta.url);
  const src = await Deno.readTextFile(abs);
  const out = "// @ts-nocheck\n" + src
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
    .replace(/from\s+'(\.[^']+\.ts)'/g, (_m, f) => `from '${new URL(f, abs).href}'`);
  const file = `${await Deno.makeTempDir()}/h.ts`;
  await Deno.writeTextFile(file, out);
  return (await import(`file://${file}`)).handle as (r: Request) => Promise<Response>;
}
const update = await load("base44/functions/categories/handlers/updateCategorySafe.ts");
const importItems = await load("base44/functions/products/handlers/importItemsSafe.ts");

const post = async (h: (r: Request) => Promise<Response>, body: Row) => {
  const res = await h(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() as Row };
};
function reset() {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.Business = [{ id: "b1", billing_status: "active" }, { id: "b2", billing_status: "active" }];
  tables.Category = [
    { id: "A", business_id: "b1", name: "CatA" },
    { id: "B", business_id: "b1", name: "CatB" },
    { id: "X", business_id: "b2", name: "Otra" },
  ];
}
const names = (biz = "b1") => tables.Category.filter((c) => c.business_id === biz).map((c) => c.name);

Deno.test("updateCategorySafe: renombrar a un nombre existente -> 409 y no cambia", async () => {
  for (const dup of ["CatB", "  catb ", "CATB"]) {
    reset();
    const r = await post(update, { category_id: "A", updates: { name: dup } });
    assertEquals(r.status, 409, dup);
    assertEquals(r.json.code, "duplicate_name");
    assertEquals(names(), ["CatA", "CatB"]);
  }
});

Deno.test("updateCategorySafe: nombre vacio o solo espacios -> 400 y no cambia", async () => {
  for (const name of ["   ", "", null, 5]) {
    reset();
    const r = await post(update, { category_id: "A", updates: { name } });
    assertEquals(r.status, 400, JSON.stringify(name));
    assertEquals(names(), ["CatA", "CatB"]);
  }
});

Deno.test("updateCategorySafe: nombre nuevo se guarda recortado; mismo nombre propio y otros campos siguen OK", async () => {
  reset();
  assertEquals((await post(update, { category_id: "A", updates: { name: "  Nueva  " } })).status, 200);
  assertEquals(names(), ["Nueva", "CatB"]);
  assertEquals((await post(update, { category_id: "A", updates: { name: "nueva" } })).status, 200); // solo cambia mayusculas
  assertEquals((await post(update, { category_id: "A", updates: { color: "#fff" } })).status, 200);
  assertEquals((await post(update, { category_id: "A", updates: { name: "Otra" } })).status, 200); // existe solo en OTRO tenant
});

Deno.test("importItemsSafe(categories): rechaza nombres existentes y repetidos dentro del archivo", async () => {
  reset();
  const r = await post(importItems, {
    import_type: "categories",
    rows: [{ nombre: "CatA" }, { nombre: " catb " }, { nombre: "ZZ Cat" }, { nombre: "zz cat" }, { nombre: "Otra" }],
  });
  assertEquals(r.status, 200);
  assertEquals(r.json.successCount, 2); // ZZ Cat y Otra (existe solo en otro tenant)
  assertEquals(r.json.errorCount, 3);
  assertEquals(names(), ["CatA", "CatB", "ZZ Cat", "Otra"]);
  const again = await post(importItems, { import_type: "categories", rows: [{ nombre: "zz cat" }] });
  assertEquals(again.json.successCount, 0);
  assertEquals(names().length, 4);
});
