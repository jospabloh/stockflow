/**
 * convertQuotationSafe conserva un anticipo ya registrado: amount_paid/balance
 * deben coincidir con sum(payments[]) en lugar de reiniciarse a 0/total.
 * SDK simulado en memoria (sin red ni datos reales).
 *
 * Run: deno test -A base44/tests/convert_keeps_deposit_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const tables: Record<string, Row[]> = {};
function entity(name: string) {
  return {
    filter: (q: Row = {}) =>
      Promise.resolve((tables[name] ?? []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    update: (id: string, patch: Row) => {
      const r = (tables[name] ?? []).find((x) => x.id === id);
      if (!r) return Promise.reject(new Error("not found"));
      Object.assign(r, patch);
      return Promise.resolve({ ...r });
    },
  };
}
G.__sf = {
  client: () => ({
    auth: { me: () => Promise.resolve({ id: "u1", role: "owner", business_id: "b1", email: "x@test" }) },
    asServiceRole: { entities: new Proxy({}, { get: (_t, n: string) => entity(n) }) },
  }),
};
const MOCK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__sf.client(r); }");
const b64 = (s: string) => "data:application/typescript;base64," + btoa(unescape(encodeURIComponent(s)));

async function loadHandle(): Promise<(r: Request) => Promise<Response>> {
  const dir = new URL("../functions/quotations/handlers/", import.meta.url);
  const perms = await Deno.readTextFile(new URL("_permissions.ts", dir));
  const src = await Deno.readTextFile(new URL("convertQuotationSafe.ts", dir));
  const rewritten = "// @ts-nocheck\n" +
    src.replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK}'`).replace("'./_permissions.ts'", `'${b64("// @ts-nocheck\n" + perms)}'`)
    .replace(/from\s+['"](?:\.\.\/)+shared\/authUser\.ts['"]/, `from '${new URL("../shared/authUser.ts", import.meta.url).href}'`)
    .replace("'../../../shared/applyStock.ts'", `'${new URL("../shared/applyStock.ts", import.meta.url).href}'`);
  return (await import(b64(rewritten))).handle;
}
const handle = await loadHandle();

async function convert(q: Row) {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.Business = [{ id: "b1", billing_status: "active" }];
  tables.Quotation = [{ id: "q1", business_id: "b1", status: "accepted", folio: "F-1", client_name: "C", items: [], ...q }];
  const res = await handle(
    new Request("http://t/fn", { method: "POST", body: JSON.stringify({ quotation_id: "q1", payment_method: "Efectivo" }) }),
  );
  return { res, q: tables.Quotation[0] };
}

Deno.test("convert conserva anticipo parcial", async () => {
  const { res, q } = await convert({ total: 200, balance: 170, amount_paid: 30, payments: [{ id: "p1", amount: 30 }] });
  assertEquals(res.status, 200);
  assertEquals(q.status, "converted");
  assertEquals(q.amount_paid, 30);
  assertEquals(q.balance, 170);
  assertEquals(q.paid, false);
  assertEquals(q.payments.length, 1);
});

Deno.test("convert sin anticipos deja amount_paid=0 y balance=total", async () => {
  const { q } = await convert({ total: 200, balance: 0 });
  assertEquals(q.amount_paid, 0);
  assertEquals(q.balance, 200);
  assertEquals(q.paid, false);
});

Deno.test("convert con anticipos que cubren el total queda pagada", async () => {
  const { q } = await convert({ total: 200, payments: [{ id: "p1", amount: 200 }] });
  assertEquals(q.amount_paid, 200);
  assertEquals(q.balance, 0);
  assertEquals(q.paid, true);
});
