/**
 * Pruebas a nivel de handler (SDK simulado en memoria, sin red ni datos reales):
 *  - deleteCatalogItemSafe: un registro is_system NO se borra (403 system_record_protected).
 *  - createProductSafe / updateProductSafe: stock negativo => 400 y sin escrituras.
 *
 * El handler se reescribe a un archivo temporal junto al original (para que sus imports
 * relativos sigan resolviendo) cambiando solo el SDK y los permisos por dobles.
 * Run: deno test -A base44/tests/safe_handlers_behavior_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__sh.client(r); }");
const PERM = "data:application/typescript;base64," +
  btoa("export function hasPermission() { return Promise.resolve(true); }");

async function load(rel: string) {
  const url = new URL(`../functions/${rel}`, import.meta.url);
  const src = await Deno.readTextFile(url);
  const out = "// @ts-nocheck\n" + src
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
    .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM}'`);
  const dir = new URL("./", url).pathname;
  const tmp = await Deno.makeTempFile({ dir, prefix: ".__test_", suffix: ".ts" });
  try {
    await Deno.writeTextFile(tmp, out);
    return await import(new URL(`file://${tmp}`).href);
  } finally {
    await Deno.remove(tmp);
  }
}

function makeDb(seed: Record<string, Row[]>) {
  const t: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const calls: string[] = [];
  const entity = (name: string) => ({
    filter: (q: Row = {}) =>
      Promise.resolve((t[name] ?? []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    list: () => Promise.resolve((t[name] ?? []).map((r) => ({ ...r }))),
    create: (d: Row) => { calls.push(`${name}.create`); const row = { id: `${name}-n${calls.length}`, ...d }; (t[name] ??= []).push(row); return Promise.resolve({ ...row }); },
    update: (id: string, p: Row) => { calls.push(`${name}.update`); Object.assign((t[name] ?? []).find((r) => r.id === id)!, p); return Promise.resolve({}); },
    delete: (id: string) => { calls.push(`${name}.delete`); t[name] = (t[name] ?? []).filter((r) => r.id !== id); return Promise.resolve({}); },
  });
  return { t, calls, entity };
}

function install(db: ReturnType<typeof makeDb>, user: Row) {
  const entities = new Proxy({}, { get: (_x, n: string) => db.entity(n) });
  G.__sh = { client: () => ({ auth: { me: () => Promise.resolve(user) }, entities, asServiceRole: { entities } }) };
}

const post = (handle: (r: Request) => Promise<Response>, body: Row) =>
  handle(new Request("http://t/f", { method: "POST", body: JSON.stringify(body) }));

const USER = { id: "u1", email: "u@t", role: "admin", business_id: "b1" };

Deno.test("deleteCatalogItemSafe: registro is_system no se borra (403 system_record_protected)", async () => {
  const { handle } = await load("catalogSettings/handlers/deleteCatalogItemSafe.ts");
  for (const entity of ["Rubro", "FundAccount"]) {
    const db = makeDb({
      [entity]: [{ id: "r1", business_id: "b1", name: "Reintegro", is_system: true }],
      Business: [{ id: "b1", billing_status: "active" }],
    });
    install(db, USER);
    const res = await post(handle, { entity, record_id: "r1" });
    assertEquals(res.status, 403);
    assertEquals((await res.json()).error, "system_record_protected");
    assertEquals(db.t[entity].length, 1);
    assert(!db.calls.includes(`${entity}.delete`));
  }
});

Deno.test("deleteCatalogItemSafe: registro de usuario si se borra", async () => {
  const { handle } = await load("catalogSettings/handlers/deleteCatalogItemSafe.ts");
  const db = makeDb({
    Rubro: [{ id: "r2", business_id: "b1", name: "Propio", is_system: false }],
    Business: [{ id: "b1", billing_status: "active" }],
  });
  install(db, USER);
  const res = await post(handle, { entity: "Rubro", record_id: "r2" });
  assertEquals(res.status, 200);
  assertEquals(db.t.Rubro.length, 0);
});

Deno.test("createProductSafe: stock negativo => 400 sin crear producto ni movimiento", async () => {
  const { handle } = await load("products/handlers/createProductSafe.ts");
  const db = makeDb({ Product: [], Movement: [], Business: [{ id: "b1", billing_status: "active" }] });
  install(db, USER);
  const res = await post(handle, { business_id: "b1", name: "X", retail_sale_price: 10, stock: -5 });
  assertEquals(res.status, 400);
  assertEquals(db.t.Product.length, 0);
  assertEquals(db.t.Movement.length, 0);
  // control: stock valido si crea
  const ok = await post(handle, { business_id: "b1", name: "X", retail_sale_price: 10, stock: 5 });
  assertEquals(ok.status, 200);
  assertEquals(db.t.Product.length, 1);
});

Deno.test("updateProductSafe: stock negativo => 400 y el stock no cambia", async () => {
  const { handle } = await load("products/handlers/updateProductSafe.ts");
  const db = makeDb({
    Product: [{ id: "p1", business_id: "b1", name: "P", stock: 10 }],
    Business: [{ id: "b1", billing_status: "active" }],
  });
  install(db, USER);
  const res = await post(handle, { product_id: "p1", updates: { stock: -4 } });
  assertEquals(res.status, 400);
  assertEquals(db.t.Product[0].stock, 10);
  assert(!db.calls.includes("Product.update"));
  const ok = await post(handle, { product_id: "p1", updates: { stock: 7 } });
  assertEquals(ok.status, 200);
  assertEquals(db.t.Product[0].stock, 7);
});
