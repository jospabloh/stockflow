/**
 * registerQuotationPayment solo debe aceptar pagos sobre cotizaciones
 * `converted`. En borrador/enviada/aceptada/cancelada debe rechazar (400) sin
 * modificar la cotizacion ni crear movimientos de caja chica.
 * SDK simulado en memoria (sin red ni datos reales).
 *
 * Run: deno test --allow-env --allow-read base44/tests/register_quotation_payment_status_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

const tables: Record<string, Row[]> = {};
let seq = 0;
function entity(name: string) {
  return {
    filter: (q: Row = {}) =>
      Promise.resolve((tables[name] ?? []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    create: (d: Row) => {
      const row = { id: `${name}-${++seq}`, ...d };
      (tables[name] ??= []).push(row);
      return Promise.resolve({ ...row });
    },
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

async function loadHandle(): Promise<(r: Request) => Promise<Response>> {
  const dir = new URL("../functions/quotationPayments/handlers/", import.meta.url);
  const perms = await Deno.readTextFile(new URL("_permissions.ts", dir));
  const permsUrl = "data:application/typescript;base64," + btoa(unescape(encodeURIComponent("// @ts-nocheck\n" + perms)));
  const src = await Deno.readTextFile(new URL("registerQuotationPayment.ts", dir));
  const rewritten = "// @ts-nocheck\n" +
    src.replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK}'`).replace("'./_permissions.ts'", `'${permsUrl}'`);
  const mod = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));
  return mod.handle;
}
const handle = await loadHandle();

async function pay(status: string) {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.Business = [{ id: "b1", billing_status: "active" }];
  tables.Quotation = [{ id: "q1", business_id: "b1", status, total: 100, folio: "F-1", client_name: "C" }];
  const res = await handle(
    new Request("http://t/fn", { method: "POST", body: JSON.stringify({ quotation_id: "q1", amount: 100, payment_method: "Efectivo" }) }),
  );
  return { status: res.status, json: await res.json() as Row, q: tables.Quotation[0], cash: tables.PettyCashMovement ?? [] };
}

for (const st of ["draft", "sent", "accepted", "cancelled"]) {
  Deno.test(`rechaza pago sobre cotizacion ${st}`, async () => {
    const r = await pay(st);
    assertEquals(r.status, 400);
    assertEquals(r.cash.length, 0);
    assert(!r.q.paid && r.q.amount_paid === undefined && r.q.payments === undefined);
  });
}

Deno.test("acepta pago sobre cotizacion converted y registra caja", async () => {
  const r = await pay("converted");
  assertEquals(r.status, 200);
  assertEquals(r.q.paid, true);
  assertEquals(r.cash.length, 1);
});
