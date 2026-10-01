/**
 * Cancelar una cotizacion concretada despues de una devolucion parcial no debe
 * restaurar de mas el stock. partialReturnQuotation registra la devolucion como
 * Movement type 'entry' con reference "Devolución <folio>"; cancelQuotationSafe
 * debe descontarla del neto a restaurar.
 *
 * SDK simulado en memoria (sin red, sin datos reales).
 * Run: deno test --allow-env --allow-read base44/tests/cancel_after_partial_return_test.ts
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

const src = await Deno.readTextFile(new URL("../functions/quotations/handlers/cancelQuotationSafe.ts", import.meta.url));
const rewritten = "// @ts-nocheck\n" + src
  .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
  .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM}'`);
const { handle } = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));
Deno.env.set("CRON_SECRET", "x");

async function cancel(db: ReturnType<typeof makeDb>) {
  install(db);
  const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify({ quotation_id: "q1", cancellation_reason: "t" }) }));
  return { status: res.status, json: await res.json() };
}

const base = (movs: Row[], stock: number) => makeDb({
  Quotation: [{ id: "q1", business_id: "b1", folio: "COT-1", status: "converted", total: 100, payments: [] }],
  Business: [{ id: "b1", billing_status: "active" }],
  Product: [{ id: "p1", business_id: "b1", stock }],
  Movement: movs.map((m, i) => ({ id: `m${i}`, business_id: "b1", quotation_id: "q1", product_id: "p1", product_name: "P", unit_price: 10, ...m })),
});

Deno.test("cancelar tras devolucion parcial 'entry' restaura solo el neto (100, no 104)", async () => {
  // Stock inicial 100, venta de 10 -> 90, devolucion parcial de 4 -> 94.
  const db = base([
    { type: "exit", quantity: 10, reference: "COT-1" },
    { type: "entry", quantity: 4, reference: "Devolución COT-1" },
  ], 94);
  const r = await cancel(db);
  assertEquals(r.status, 200);
  assertEquals(db.t.Product[0].stock, 100);
  assertEquals(db.t.Quotation[0].status, "cancelled");
});

Deno.test("cancelar sin devoluciones restaura la venta completa", async () => {
  const db = base([{ type: "exit", quantity: 10, reference: "COT-1" }], 90);
  await cancel(db);
  assertEquals(db.t.Product[0].stock, 100);
});

Deno.test("devolucion total previa: cancelar no restaura nada mas", async () => {
  const db = base([
    { type: "exit", quantity: 10, reference: "COT-1" },
    { type: "entry", quantity: 10, reference: "Devolución COT-1" },
  ], 100);
  await cancel(db);
  assertEquals(db.t.Product[0].stock, 100);
});

Deno.test("movimientos 'return' heredados siguen descontandose", async () => {
  const db = base([
    { type: "exit", quantity: 10, reference: "COT-1" },
    { type: "return", quantity: 4, reference: "x" },
  ], 94);
  await cancel(db);
  assertEquals(db.t.Product[0].stock, 100);
});

Deno.test("referencia exacta: 'entry' con prefijo de otro folio no se descuenta", async () => {
  const db = base([
    { type: "exit", quantity: 10, reference: "COT-1" },
    { type: "entry", quantity: 4, reference: "Devolución COT-10" },
  ], 90);
  await cancel(db);
  assertEquals(db.t.Product[0].stock, 100);
});
