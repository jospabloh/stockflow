/**
 * partialReturnQuotation debe rechazar cantidades no positivas / no enteras,
 * duplicados y devoluciones acumuladas mayores a lo vendido, y tomar el precio
 * de la cotizacion (no del cliente).
 *
 * SDK simulado en memoria (sin red, sin datos reales).
 * Run: deno test --allow-env --allow-read base44/tests/partial_return_validation_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

function makeDb(seed: Record<string, Row[]>) {
  const t: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  let seq = 0;
  const entity = (name: string) => ({
    filter: (q: Row = {}) =>
      Promise.resolve((t[name] ?? []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    create: (d: Row) => {
      const row = { id: `${name}-n${++seq}`, ...d };
      (t[name] ??= []).push(row);
      return Promise.resolve({ ...row });
    },
    update: (id: string, p: Row) => {
      Object.assign((t[name] ?? []).find((r) => r.id === id)!, p);
      return Promise.resolve({});
    },
    delete: () => Promise.resolve({}),
  });
  return { t, entity };
}

function install(db: ReturnType<typeof makeDb>) {
  const entities = new Proxy({}, { get: (_x, n: string) => db.entity(n) });
  G.__cq = {
    client: () => ({
      auth: { me: () => Promise.resolve({ id: "u1", business_id: "b1" }) },
      entities,
      asServiceRole: {
        entities,
        functions: {
          invoke: (_fn: string, p: Row) => {
            // Simula applyMovementStock: entry suma, exit/return resta.
            const m = db.t.Movement.find((x) => x.id === p.movement_id)!;
            const prod = db.t.Product.find((x) => x.id === m.product_id)!;
            prod.stock += m.type === "entry" ? m.quantity : -m.quantity;
            m.stock_applied = true;
            return Promise.resolve({});
          },
        },
      },
    }),
    hasPermission: () => Promise.resolve(true),
  };
}

const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__cq.client(r); }");
const PERM = "data:application/typescript;base64," +
  btoa("export function hasPermission() { return (globalThis as any).__cq.hasPermission(); }");

const src = await Deno.readTextFile(new URL("../functions/quotations/handlers/partialReturnQuotation.ts", import.meta.url));
const rewritten = "// @ts-nocheck\n" + src
  .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
  .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM}'`);
const { handle } = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));
Deno.env.set("CRON_SECRET", "x");

const mk = () => makeDb({
  Quotation: [{
    id: "q1", business_id: "b1", folio: "COT-1", status: "converted", total: 300,
    items: [{ product_id: "p1", product_name: "P1", quantity: 3, unit_price: 100, total: 300, tax_rate: 0 }],
  }],
  Product: [{ id: "p1", business_id: "b1", stock: 93 }],
  Movement: [],
});

async function ret(db: ReturnType<typeof makeDb>, items: Row[]) {
  install(db);
  const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify({ quotation_id: "q1", reason: "t", returned_items: items }) }));
  return { status: res.status, json: await res.json() };
}
const item = (quantity: unknown, unit_price = 100) => ({ product_id: "p1", product_name: "P1", quantity, unit_price });

for (const [name, q] of [["negativa", -3], ["cero", 0], ["fraccion", 1.5], ["string", "2"], ["NaN-null", null]] as const) {
  Deno.test(`rechaza cantidad ${name} sin tocar stock ni total`, async () => {
    const db = mk();
    const r = await ret(db, [item(q)]);
    assertEquals(r.status, 400);
    assertEquals(db.t.Product[0].stock, 93);
    assertEquals(db.t.Movement.length, 0);
    assertEquals(db.t.Quotation[0].total, 300);
    assertEquals(db.t.Quotation[0].items[0].quantity, 3);
  });
}

Deno.test("rechaza product_id duplicado que excede lo vendido", async () => {
  const db = mk();
  const r = await ret(db, [item(2), item(2)]);
  assertEquals(r.status, 400);
  assertEquals(db.t.Product[0].stock, 93);
  assertEquals(db.t.Movement.length, 0);
});

Deno.test("usa el precio de la cotizacion, no el del cliente", async () => {
  const db = mk();
  const r = await ret(db, [item(1, 1)]);
  assertEquals(r.status, 200);
  assertEquals(db.t.Movement[0].unit_price, 100);
  assertEquals(db.t.Movement[0].total, 100);
});

Deno.test("devolucion valida sigue funcionando", async () => {
  const db = mk();
  const r = await ret(db, [item(2)]);
  assertEquals(r.status, 200);
  assertEquals(db.t.Product[0].stock, 95);
  assertEquals(db.t.Quotation[0].items[0].quantity, 1);
  assertEquals(db.t.Quotation[0].total, 100);
});
