/**
 * updateProductBarcodeSafe debe rechazar (409) un codigo de barras que ya usa
 * otro producto del mismo tenant, igual que createProductSafe / updateProductSafe.
 *
 * SDK simulado en memoria (sin red, sin datos reales).
 * Run: deno test --allow-env --allow-read base44/tests/update_product_barcode_duplicate_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

function makeDb(seed: Record<string, Row[]>) {
  const t: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const entity = (name: string) => ({
    filter: (q: Row = {}) =>
      Promise.resolve((t[name] ?? []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    update: (id: string, p: Row) => {
      const row = (t[name] ?? []).find((r) => r.id === id)!;
      Object.assign(row, p);
      return Promise.resolve({ ...row });
    },
  });
  return { t, entity };
}

function install(db: ReturnType<typeof makeDb>) {
  const entities = new Proxy({}, { get: (_x, n: string) => db.entity(n) });
  G.__ub = {
    client: () => ({
      auth: { me: () => Promise.resolve({ id: "u1", email: "u@t", role: "admin", business_id: "b1" }) },
      entities,
      asServiceRole: { entities },
    }),
  };
}

const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__ub.client(r); }");
const PERM = "data:application/typescript;base64," +
  btoa("export function hasPermission() { return Promise.resolve(true); }");
const sharedSrc = await Deno.readTextFile(new URL("../shared/productDuplicateCheck.ts", import.meta.url));
const DUP = "data:application/typescript;base64," + btoa(unescape(encodeURIComponent(sharedSrc)));

const src = await Deno.readTextFile(new URL("../functions/products/handlers/updateProductBarcodeSafe.ts", import.meta.url));
const rewritten = "// @ts-nocheck\n" + src
  .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
  .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM}'`)
  .replace(/from\s+['"]\.\.\/\.\.\/\.\.\/shared\/productDuplicateCheck\.ts['"]/, `from '${DUP}'`);
const { handle } = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));

const seed = () => makeDb({
  Business: [{ id: "b1", billing_status: "active" }, { id: "b2", billing_status: "active" }],
  Product: [
    { id: "A", business_id: "b1", name: "A", barcode: "X" },
    { id: "C", business_id: "b1", name: "C", barcode: "" },
    { id: "Z", business_id: "b2", name: "Z", barcode: "Y" },
  ],
});

async function call(db: ReturnType<typeof makeDb>, product_id: string, barcode: string) {
  install(db);
  const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify({ product_id, barcode }) }));
  return { status: res.status, json: await res.json() };
}

Deno.test("barcode ya usado por otro producto del tenant -> 409 y no se escribe", async () => {
  const db = seed();
  const r = await call(db, "C", "X");
  assertEquals(r.status, 409);
  assertEquals(r.json.success, false);
  assertEquals(db.t.Product.find((p) => p.id === "C")!.barcode, "");
});

Deno.test("duplicado se detecta ignorando espacios", async () => {
  const db = seed();
  assertEquals((await call(db, "C", "  X ")).status, 409);
});

Deno.test("barcode libre se guarda", async () => {
  const db = seed();
  const r = await call(db, "C", "NEW1");
  assertEquals(r.status, 200);
  assertEquals(db.t.Product.find((p) => p.id === "C")!.barcode, "NEW1");
});

Deno.test("re-guardar el mismo barcode del propio producto no es duplicado", async () => {
  const db = seed();
  assertEquals((await call(db, "A", "X")).status, 200);
});

Deno.test("mismo barcode en otro tenant no cuenta como duplicado", async () => {
  const db = seed();
  assertEquals((await call(db, "C", "Y")).status, 200);
});
