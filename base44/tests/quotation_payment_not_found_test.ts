/**
 * editQuotationPayment / deleteQuotationPayment con una cotizacion inexistente
 * deben responder 404 (como registerQuotationPayment y el resto de actions),
 * no 500. El SDK real lanza "Entity Quotation with ID ... not found" en
 * Quotation.get cuando el id no existe; el fix usa filter({ id }).
 *
 * SDK simulado en memoria (sin red, sin datos reales).
 * Run: deno test --allow-env --allow-read base44/tests/quotation_payment_not_found_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

function install(quotations: Row[]) {
  const q = {
    // Igual que el SDK: get() lanza si no existe.
    get: (id: string) => {
      const r = quotations.find((x) => x.id === id);
      return r ? Promise.resolve({ ...r }) : Promise.reject(new Error(`Entity Quotation with ID ${id} not found`));
    },
    filter: (f: Row = {}) =>
      Promise.resolve(quotations.filter((r) => Object.entries(f).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    update: (id: string, p: Row) => {
      Object.assign(quotations.find((x) => x.id === id)!, p);
      return Promise.resolve({});
    },
  };
  const entities = {
    Quotation: q,
    Business: { filter: () => Promise.resolve([{ id: "b1", billing_status: "active" }]) },
    PettyCashMovement: { update: () => Promise.resolve({}), delete: () => Promise.resolve({}), create: () => Promise.resolve({ id: "pcm" }) },
  };
  G.__qp = {
    client: () => ({
      auth: { me: () => Promise.resolve({ id: "u1", business_id: "b1", role: "admin" }) },
      asServiceRole: { entities },
    }),
  };
}

const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__qp.client(r); }");
const PERM = "data:application/typescript;base64," +
  btoa("export function hasPermission() { return Promise.resolve(true); }");

async function load(name: string) {
  const src = await Deno.readTextFile(new URL(`../functions/quotationPayments/handlers/${name}.ts`, import.meta.url));
  const rewritten = "// @ts-nocheck\n" + src
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
    .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM}'`);
  return (await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))))).handle;
}

const call = async (handle: (r: Request) => Promise<Response>, body: Row) => {
  const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

const MISSING = "000000000000000000000000";

Deno.test("editQuotationPayment: cotizacion inexistente -> 404", async () => {
  install([]);
  const r = await call(await load("editQuotationPayment"), { quotation_id: MISSING, payment_id: "p1", amount: 10, payment_method: "Transferencia" });
  assertEquals(r.status, 404);
  assertEquals(r.json.error, "Quotation not found");
});

Deno.test("deleteQuotationPayment: cotizacion inexistente -> 404", async () => {
  install([]);
  const r = await call(await load("deleteQuotationPayment"), { quotation_id: MISSING, payment_id: "p1" });
  assertEquals(r.status, 404);
  assertEquals(r.json.error, "Quotation not found");
});

Deno.test("editQuotationPayment: cotizacion existente sigue funcionando", async () => {
  const qs = [{ id: "q1", business_id: "b1", folio: "COT-1", total: 100, payments: [{ id: "p1", amount: 50, payment_method: "Transferencia" }] }];
  install(qs);
  const r = await call(await load("editQuotationPayment"), { quotation_id: "q1", payment_id: "p1", amount: 60, payment_method: "Transferencia" });
  assertEquals(r.status, 200);
  assertEquals(qs[0].payments[0].amount, 60);
});

Deno.test("deleteQuotationPayment: cotizacion existente sigue funcionando", async () => {
  const qs = [{ id: "q1", business_id: "b1", folio: "COT-1", total: 100, payments: [{ id: "p1", amount: 50 }] }];
  install(qs);
  const r = await call(await load("deleteQuotationPayment"), { quotation_id: "q1", payment_id: "p1" });
  assertEquals(r.status, 200);
  assertEquals(qs[0].payments.length, 0);
});
