/**
 * createCategorySafe: rechaza nombre vacío/solo espacios (400) y nombre duplicado
 * dentro del mismo tenant (409, sin distinguir mayúsculas ni espacios extremos).
 * Usa el handler REAL con un cliente SDK simulado en memoria. No toca red ni datos reales.
 *
 * Run: deno test -A base44/tests/create_category_validation_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

const tables: Record<string, Row[]> = {};
let seq = 0;
let currentUser: Row | null = null;

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
  };
}
G.__sf = {
  client() {
    const entities = new Proxy({}, { get: (_t, name: string) => entity(name) });
    return {
      auth: { me: () => Promise.resolve(currentUser) },
      entities,
      asServiceRole: { entities },
    };
  },
};

const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__sf.client(req); }");

const ROOT = new URL("../../", import.meta.url);
const tmp = await Deno.makeTempDir();
const abs = new URL("base44/functions/categories/handlers/createCategorySafe.ts", ROOT);
const src = await Deno.readTextFile(abs);
const rewritten = "// @ts-nocheck\n" +
  src
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
    .replace(/from\s+'\.\/(\w+\.ts)'/g, (_m, f) => `from '${new URL(f, abs).href}'`);
const file = `${tmp}/createCategorySafe.ts`;
await Deno.writeTextFile(file, rewritten);
const { handle } = await import(`file://${file}`);

const OWNER = { id: "u1", email: "dueno@b1.com", role: "owner", business_id: "b1" };

async function create(body: Row, user: Row = OWNER) {
  currentUser = user;
  const res = await handle(
    new Request("http://local.test/fn", { method: "POST", body: JSON.stringify({ business_id: user.business_id, ...body }) }),
  );
  return { status: res.status, json: await res.json() as Row };
}
function reset() {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.Business = [{ id: "b1", billing_status: "active" }, { id: "b2", billing_status: "active" }];
}
const cats = (biz = "b1") => (tables.Category ?? []).filter((c) => c.business_id === biz);

Deno.test("createCategorySafe: nombre válido se crea (y se guarda recortado)", async () => {
  reset();
  const r = await create({ name: "  Bebidas  " });
  assertEquals(r.status, 200);
  assertEquals(cats().length, 1);
  assertEquals(cats()[0].name, "Bebidas");
});

Deno.test("createCategorySafe: nombre vacío o solo espacios -> 400 y no crea", async () => {
  for (const name of ["  ", "", undefined, null, 5]) {
    reset();
    const r = await create({ name });
    assertEquals(r.status, 400, `name=${JSON.stringify(name)}`);
    assertEquals(r.json.success, false);
    assertEquals(cats().length, 0);
  }
});

Deno.test("createCategorySafe: nombre duplicado en el mismo tenant -> 409 y no crea la segunda", async () => {
  reset();
  assertEquals((await create({ name: "Bebidas" })).status, 200);
  for (const dup of ["Bebidas", "  bebidas ", "BEBIDAS"]) {
    const r = await create({ name: dup });
    assertEquals(r.status, 409, dup);
    assertEquals(r.json.success, false);
  }
  assertEquals(cats().length, 1);
});

Deno.test("createCategorySafe: el mismo nombre en OTRO tenant sí se permite", async () => {
  reset();
  assertEquals((await create({ name: "Bebidas" })).status, 200);
  const r = await create({ name: "Bebidas" }, { ...OWNER, business_id: "b2" });
  assertEquals(r.status, 200);
  assertEquals(cats("b1").length, 1);
  assertEquals(cats("b2").length, 1);
});
