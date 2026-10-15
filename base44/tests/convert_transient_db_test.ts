/**
 * convertQuotationSafe ante timeouts de la base de datos de Base44 (2026-10-15).
 *
 * El reintento de COT-261013-0004 falló con
 *   "pl-0-us-west-2.jmgvw.mongodb.net:1063: timed out (timeoutMS: 20000.0ms)"
 * sin escribir nada: la plataforma tiró UNA llamada. Este archivo inyecta ese
 * timeout, una vez, en cada llamada de la conversión y exige que la venta
 * termine igual, sin duplicar salidas ni descontar dos veces:
 *  - lecturas y la actualización final: se reintentan;
 *  - Movement.create que falla DESPUÉS de guardar (la respuesta se perdió): no
 *    se reintenta a ciegas; se busca primero si la salida ya quedó guardada.
 *
 * Run: deno test -A base44/tests/convert_transient_db_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("STOCK_APPLY_RETRY_MS", "0");

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const tables: Record<string, Row[]> = {};
let seq = 0;

// Inyección: la N-ésima llamada a `target` lanza el timeout de Mongo.
// `commit: true` simula que la escritura SÍ se guardó y sólo se perdió la respuesta.
type Fault = { target: string; nth: number; commit?: boolean; withStatus?: number };
let fault: Fault | null = null;
const counts: Record<string, number> = {};
function maybeFail(key: string, commitFn?: () => void) {
  counts[key] = (counts[key] || 0) + 1;
  if (fault && fault.target === key && counts[key] === fault.nth) {
    if (fault.commit && commitFn) commitFn();
    const e: Row = new Error("pl-0-us-west-2.jmgvw.mongodb.net:1063: timed out (configured timeouts: timeoutMS: 20000.0ms, connectTimeoutMS: 30000.0ms)");
    if (fault.withStatus) e.status = fault.withStatus;
    throw e;
  }
}
function matches(r: Row, q: Row) {
  return Object.entries(q).every(([k, v]) =>
    v && typeof v === "object" && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v
  );
}
function entity(name: string) {
  return {
    filter: async (q: Row = {}) => {
      maybeFail(`${name}.filter`);
      return (tables[name] ?? []).filter((r) => matches(r, q)).map((r) => ({ ...r }));
    },
    get: async (id: string) => {
      maybeFail(`${name}.get`);
      return { ...(tables[name] ?? []).find((r) => r.id === id) };
    },
    create: async (data: Row) => {
      const now = new Date().toISOString();
      const row = { id: `${name}-${++seq}`, created_date: now, updated_date: now, ...data };
      maybeFail(`${name}.create`, () => (tables[name] ??= []).push(row));
      (tables[name] ??= []).push(row);
      return { ...row };
    },
    update: async (id: string, patch: Row) => {
      const r = (tables[name] ?? []).find((x) => x.id === id);
      if (!r) throw new Error("not found");
      maybeFail(`${name}.update`, () => Object.assign(r, patch));
      Object.assign(r, patch, { updated_date: new Date().toISOString() });
      return { ...r };
    },
  };
}
function applyMovementStock(movementId: string) {
  const m = tables.Movement.find((x) => x.id === movementId)!;
  if (m.stock_applied) return { data: { success: true, already_applied: true } };
  const p = tables.Product.find((x) => x.id === m.product_id)!;
  p.stock = Math.max(0, (p.stock || 0) - m.quantity);
  Object.assign(m, { stock_applied: true, stock_apply_state: "applied" });
  return { data: { success: true } };
}
G.__sf = {
  client: () => ({
    auth: { me: () => Promise.resolve({ id: "u1", role: "owner", business_id: "b1", email: "x@test" }) },
    asServiceRole: {
      entities: new Proxy({}, { get: (_t, n: string) => entity(n) }),
      functions: { invoke: (_fn: string, body: Row) => Promise.resolve(applyMovementStock(body.movement_id)) },
    },
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
    src.replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK}'`)
      .replace("'./_permissions.ts'", `'${b64("// @ts-nocheck\n" + perms)}'`)
      .replace("'./_convertPlan.ts'", `'${new URL("_convertPlan.ts", dir).href}'`)
      .replace(/from\s+['"](?:\.\.\/)+shared\/authUser\.ts['"]/, `from '${new URL("../shared/authUser.ts", import.meta.url).href}'`)
      .replace("'../../../shared/applyStock.ts'", `'${new URL("../shared/applyStock.ts", import.meta.url).href}'`);
  return (await import(b64(rewritten))).handle;
}
const handle = await loadHandle();

const line = (pid: string) => ({ product_id: pid, product_name: `N-${pid}`, quantity: 1, unit_price: 10, total: 10 });
function seed() {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const k of Object.keys(counts)) delete counts[k];
  tables.Business = [{ id: "b1", billing_status: "active" }];
  tables.Product = ["p1", "p2", "p3"].map((id) => ({ id, business_id: "b1", stock: 5, purchase_price: 1 }));
  tables.Quotation = [{ id: "q1", business_id: "b1", status: "draft", folio: "F", client_name: "C", total: 30, payments: [], items: [line("p1"), line("p2"), line("p3")] }];
  tables.Movement = [];
}
async function convert() {
  const res = await handle(new Request("http://t/fn", { method: "POST", body: JSON.stringify({ quotation_id: "q1", payment_method: "Transferencia AFIRME" }) }));
  return { res, body: await res.json() };
}
function assertConvertedOnce() {
  const q = tables.Quotation[0];
  assertEquals(q.status, "converted");
  assertEquals(q.payment_method, "Transferencia AFIRME");
  const exits = tables.Movement.filter((m) => m.type === "exit");
  assertEquals(exits.length, 3, "una salida por renglón, sin duplicados");
  for (const p of tables.Product) assertEquals(p.stock, 4, `stock de ${p.id} descontado exactamente una vez`);
}

const CASES: Array<[string, Fault]> = [
  ["lectura de la cotización", { target: "Quotation.filter", nth: 1 }],
  ["lectura de salidas existentes", { target: "Movement.filter", nth: 1 }],
  ["lectura del negocio (licencia)", { target: "Business.filter", nth: 1 }],
  ["lectura de productos", { target: "Product.filter", nth: 1 }],
  ["creación de salida que NO se guardó", { target: "Movement.create", nth: 2 }],
  ["creación de salida que SÍ se guardó (respuesta perdida)", { target: "Movement.create", nth: 2, commit: true }],
  ["actualización final de la cotización", { target: "Quotation.update", nth: 1 }],
  ["timeout con status 500", { target: "Movement.filter", nth: 1, withStatus: 500 }],
  ["timeout con status 504", { target: "Product.filter", nth: 1, withStatus: 504 }],
];
for (const [name, f] of CASES) {
  Deno.test(`timeout de Mongo en ${name}: la venta se completa una sola vez`, async () => {
    seed();
    fault = f;
    try {
      const { res, body } = await convert();
      assertEquals(res.status, 200, JSON.stringify(body));
      assertConvertedOnce();
    } finally {
      fault = null;
    }
  });
}
