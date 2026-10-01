/**
 * partialReturnQuotation debe mantener consistentes amount_paid / balance / payments
 * cuando se devuelve parte de una venta ya pagada (amount_paid no puede quedar > total).
 * SDK simulado en memoria (sin red, sin datos reales).
 * Run: deno test --allow-env --allow-read base44/tests/partial_return_payments_test.ts
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


async function ret(db: ReturnType<typeof makeDb>, qty = 1) {
  install(db);
  const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify({
    quotation_id: "q1", reason: "t",
    returned_items: [{ product_id: "p1", product_name: "P", quantity: qty, unit_price: 100 }],
  }) }));
  return { status: res.status, json: await res.json() };
}

const sale = (q: Row) => makeDb({
  Quotation: [{ id: "q1", business_id: "b1", folio: "COT-1", status: "converted", tax: 0, subtotal: 500, total: 500,
    items: [{ product_id: "p1", quantity: 5, unit_price: 100, total: 500, tax_rate: 0 }], ...q }],
  Product: [{ id: "p1", business_id: "b1", stock: 0 }],
  Movement: [],
  TenantRule: [],
});

Deno.test("venta pagada 500, devolver 100: amount_paid no excede total y payments cuadran", async () => {
  const db = sale({ paid: true, amount_paid: 500, balance: 0, payment_method: "Transferencia",
    payments: [{ id: "pay1", amount: 500, payment_method: "Transferencia" }] });
  const r = await ret(db);
  assertEquals(r.status, 200);
  const q = db.t.Quotation[0];
  assertEquals(q.total, 400);
  assertEquals(q.amount_paid, 400);
  assertEquals(q.balance, 0);
  assertEquals(q.paid, true);
  assertEquals(q.payments.reduce((s: number, p: Row) => s + p.amount, 0), q.amount_paid);
  assertEquals(q.payments[1].amount, -100);
});

Deno.test("venta sin pagar: balance sigue al nuevo total", async () => {
  const db = sale({ paid: false, amount_paid: 0, balance: 500, payments: [] });
  await ret(db);
  const q = db.t.Quotation[0];
  assertEquals([q.total, q.amount_paid, q.balance, q.paid, q.payments.length], [400, 0, 400, false, 0]);
});

Deno.test("pago parcial 200 de 500, devolver 100: balance 200, no pagada, sin ajuste", async () => {
  const db = sale({ paid: false, amount_paid: 200, balance: 300, payments: [{ id: "pay1", amount: 200 }] });
  await ret(db);
  const q = db.t.Quotation[0];
  assertEquals([q.amount_paid, q.balance, q.paid, q.payments.length], [200, 200, false, 1]);
});

Deno.test("pago parcial 450 de 500, devolver 100: excedente 50 se ajusta y queda pagada", async () => {
  const db = sale({ paid: false, amount_paid: 450, balance: 50, payments: [{ id: "pay1", amount: 450 }] });
  await ret(db);
  const q = db.t.Quotation[0];
  assertEquals([q.amount_paid, q.balance, q.paid, q.payments[1].amount], [400, 0, true, -50]);
});
