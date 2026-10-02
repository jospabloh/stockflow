/**
 * Regresion: "Confirmar pago total" (updateQuotationFlagsSafe {paid:true}) debe
 * PERSISTIR amount_paid, balance y payments. Antes se derivaban en
 * sanitizedUpdates despues del Quotation.update y nunca se guardaban.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

function makeDb(seed: Record<string, Row[]>) {
  const t: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const invokes: Row[] = [];
  const entity = (name: string) => ({
    filter: (q: Row = {}) =>
      Promise.resolve((t[name] ?? []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    update: (id: string, p: Row) => {
      Object.assign((t[name] ?? []).find((r) => r.id === id)!, p);
      return Promise.resolve({});
    },
  });
  return { t, invokes, entity };
}

function install(db: ReturnType<typeof makeDb>) {
  const entities = new Proxy({}, { get: (_x, n: string) => db.entity(n) });
  G.__fq = {
    client: () => ({
      auth: { me: () => Promise.resolve({ id: "u1", business_id: "b1" }) },
      entities,
      asServiceRole: {
        entities,
        functions: { invoke: (fn: string, p: Row) => { db.invokes.push({ fn, ...p }); return Promise.resolve({}); } },
      },
    }),
  };
}

const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__fq.client(r); }");
const PERM = "data:application/typescript;base64," +
  btoa("export function hasPermission() { return Promise.resolve(true); }");

const src = await Deno.readTextFile(new URL("../functions/quotations/handlers/updateQuotationFlagsSafe.ts", import.meta.url));
const rewritten = "// @ts-nocheck\n" + src
  .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
  // Reescribe TODOS los imports relativos: _permissions.ts va al stub; el resto, a URL de archivo.
  .replace(/from\s+['"]\.\/([\w-]+\.ts)['"]/g, (_m, f) =>
    f === "_permissions.ts"
      ? `from '${PERM}'`
      : `from '${new URL("../functions/quotations/handlers/" + f, import.meta.url).href}'`);
const { handle } = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));
Deno.env.set("CRON_SECRET", "x");

const mk = (q: Row) => makeDb({
  Quotation: [{ id: "q1", business_id: "b1", folio: "COT-1", status: "converted", total: 300, payment_method: "Efectivo", paid: false, amount_paid: 0, balance: 300, payments: [], ...q }],
  Business: [{ id: "b1", billing_status: "active" }],
});

async function flags(db: ReturnType<typeof makeDb>, updates: Row) {
  install(db);
  const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify({ quotation_id: "q1", updates }) }));
  return { status: res.status, json: await res.json() };
}

Deno.test("paid:true en venta sin pagos persiste amount_paid=total, balance=0 y un pago", async () => {
  const db = mk({});
  const r = await flags(db, { paid: true, payment_method: "Efectivo" });
  assertEquals(r.status, 200);
  const q = db.t.Quotation[0];
  assertEquals(q.paid, true);
  assertEquals(q.amount_paid, 300);
  assertEquals(q.balance, 0);
  assertEquals(q.payments.length, 1);
  assertEquals(q.payments[0].amount, 300);
  assertEquals(db.invokes.filter((i) => i.sync_action === "reconcile")[0].amount, 300);
});

Deno.test("paid:true con pago parcial previo agrega solo el restante", async () => {
  const db = mk({ amount_paid: 100, balance: 200, payments: [{ id: "p0", amount: 100 }] });
  await flags(db, { paid: true });
  const q = db.t.Quotation[0];
  assertEquals(q.amount_paid, 300);
  assertEquals(q.balance, 0);
  assertEquals(q.payments.map((p: Row) => p.amount), [100, 200]);
});

Deno.test("cambiar solo payment_method en venta ya pagada no toca amount_paid/payments", async () => {
  const db = mk({ paid: true, amount_paid: 300, balance: 0, payments: [{ id: "p0", amount: 300 }] });
  await flags(db, { payment_method: "Tarjeta" });
  const q = db.t.Quotation[0];
  assertEquals(q.amount_paid, 300);
  assertEquals(q.payments.length, 1);
});
