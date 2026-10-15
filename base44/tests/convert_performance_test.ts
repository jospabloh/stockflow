/**
 * convertQuotationSafe — rendimiento con la plataforma lenta (2026-10-15).
 *
 * El día del incidente COT-261013-0004 cada llamada a Base44 tardó 4–13 s en vez
 * de ~0.15 s, y una venta de 11 renglones encadena ~100 llamadas en serie. Este
 * archivo fija las tres palancas que no dependen de la plataforma:
 *  1. Validación con UNA lectura de productos ($in), no una por renglón; y la
 *     cantidad se suma por producto (dos renglones del mismo producto).
 *  2. Renglones EN SERIE: la cuota de operaciones de Base44 es una sola para
 *     todos los inquilinos (estándar, módulo 31); paralelizar sólo sube la ráfaga.
 *  3. Presupuesto de tiempo: pasado CONVERT_BUDGET_MS no se empiezan renglones
 *     nuevos; responde 202 `partial` y el cliente continúa con
 *     `continuation: true`, que salta la ventana de "en curso" sólo si todas las
 *     salidas existentes ya terminaron. Siempre avanza al menos un renglón.
 *
 * Run: deno test -A base44/tests/convert_performance_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("STOCK_APPLY_RETRY_MS", "0");

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const tables: Record<string, Row[]> = {};
const calls: string[] = [];
let seq = 0;
let latencyMs = 0;
let inFlight = 0;
let maxInFlight = 0;
const productBusy = new Set<string>();
let sameProductOverlap = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function matches(r: Row, q: Row) {
  return Object.entries(q).every(([k, v]) =>
    v && typeof v === "object" && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v
  );
}
function entity(name: string) {
  return {
    filter: async (q: Row = {}) => {
      calls.push(`${name}.filter`);
      await sleep(latencyMs);
      return (tables[name] ?? []).filter((r) => matches(r, q)).map((r) => ({ ...r }));
    },
    get: async (id: string) => {
      await sleep(latencyMs);
      return { ...(tables[name] ?? []).find((r) => r.id === id) };
    },
    create: async (data: Row) => {
      calls.push(`${name}.create`);
      await sleep(latencyMs);
      const now = new Date().toISOString();
      const row = { id: `${name}-${++seq}`, created_date: now, updated_date: now, ...data };
      (tables[name] ??= []).push(row);
      return { ...row };
    },
    update: async (id: string, patch: Row) => {
      await sleep(latencyMs);
      const r = (tables[name] ?? []).find((x) => x.id === id);
      if (!r) throw new Error("not found");
      Object.assign(r, patch, { updated_date: new Date().toISOString() });
      return { ...r };
    },
  };
}

async function applyMovementStock(movementId: string) {
  const m = tables.Movement.find((x) => x.id === movementId)!;
  inFlight++;
  maxInFlight = Math.max(maxInFlight, inFlight);
  if (productBusy.has(m.product_id)) sameProductOverlap = true;
  productBusy.add(m.product_id);
  await sleep(latencyMs * 3);
  if (!m.stock_applied) {
    const p = tables.Product.find((x) => x.id === m.product_id)!;
    p.stock = Math.max(0, (p.stock || 0) - m.quantity);
    Object.assign(m, { stock_applied: true, stock_apply_state: "applied", updated_date: new Date().toISOString() });
  }
  productBusy.delete(m.product_id);
  inFlight--;
  return { data: { success: true } };
}

G.__sf = {
  client: () => ({
    auth: { me: () => Promise.resolve({ id: "u1", role: "owner", business_id: "b1", email: "x@test" }) },
    asServiceRole: {
      entities: new Proxy({}, { get: (_t, n: string) => entity(n) }),
      functions: { invoke: (_fn: string, body: Row) => applyMovementStock(body.movement_id) },
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

const line = (pid: string, qty = 1) => ({ product_id: pid, product_name: `N-${pid}`, quantity: qty, unit_price: 10, total: 10 * qty });

function seed(items: Row[], stock: Record<string, number>, movements: Row[] = []) {
  for (const k of Object.keys(tables)) delete tables[k];
  calls.length = 0;
  maxInFlight = 0;
  inFlight = 0;
  sameProductOverlap = false;
  productBusy.clear();
  tables.Business = [{ id: "b1", billing_status: "active" }];
  tables.Product = Object.entries(stock).map(([id, s]) => ({ id, business_id: "b1", stock: s, purchase_price: 1 }));
  tables.Quotation = [{ id: "q1", business_id: "b1", status: "draft", folio: "F-1", client_name: "C", total: 100, payments: [], items }];
  tables.Movement = movements.map((m, i) => ({ id: `old-${i}`, type: "exit", quotation_id: "q1", business_id: "b1", ...m }));
}

async function convert(extra: Row = {}) {
  const res = await handle(new Request("http://t/fn", {
    method: "POST",
    body: JSON.stringify({ quotation_id: "q1", payment_method: "Transferencia", ...extra }),
  }));
  return { res, body: await res.json(), q: tables.Quotation[0], exits: () => tables.Movement.filter((m) => m.type === "exit") };
}

Deno.test("valida stock con UNA lectura de productos, no una por renglón", async () => {
  const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
  seed(ids.map((p) => line(p)), Object.fromEntries(ids.map((p) => [p, 5])));
  const { res, q } = await convert();
  assertEquals(res.status, 200);
  assertEquals(q.status, "converted");
  assertEquals(calls.filter((c) => c === "Product.filter").length, 1);
});

Deno.test("dos renglones del mismo producto suman cantidad al validar stock", async () => {
  seed([line("p1"), line("p1")], { p1: 1 });
  const { res, body, exits } = await convert();
  assertEquals(res.status, 400);
  assert(String(body.error).includes("Insufficient stock"), body.error);
  assertEquals(exits().length, 0);
});

Deno.test("renglones en serie: la cuota de Base44 es compartida por todos los inquilinos (módulo 31)", async () => {
  latencyMs = 5;
  try {
    const items = [line("p1"), line("p1"), line("p2"), line("p3"), line("p4")];
    seed(items, { p1: 9, p2: 9, p3: 9, p4: 9 });
    const { res, q, exits } = await convert();
    assertEquals(res.status, 200);
    assertEquals(q.status, "converted");
    assertEquals(exits().length, 5);
    assertEquals(maxInFlight, 1, "paralelizar sólo sube la ráfaga y provoca 429 para todos");
    assertEquals(sameProductOverlap, false);
    assertEquals(tables.Product.find((p) => p.id === "p1")!.stock, 7);
  } finally {
    latencyMs = 0;
  }
});

Deno.test("presupuesto agotado: 202 partial, avanza, y la continuación termina la venta", async () => {
  Deno.env.set("CONVERT_BUDGET_MS", "0");
  try {
    seed([line("p1"), line("p2"), line("p3")], { p1: 5, p2: 5, p3: 5 });
    const first = await convert();
    assertEquals(first.res.status, 202, JSON.stringify(first.body));
    assertEquals(first.body.partial, true);
    assert(first.body.done >= 1, "siempre avanza al menos un renglón");
    assertEquals(first.body.total, 3);
    assertEquals(first.q.status, "draft");

    let last = first;
    for (let i = 0; i < 5 && last.body.partial; i++) last = await convert({ continuation: true });
    assertEquals(last.res.status, 200, JSON.stringify(last.body));
    assertEquals(last.q.status, "converted");
    assertEquals(last.exits().length, 3, "sin duplicados");
    for (const p of ["p1", "p2", "p3"]) assertEquals(tables.Product.find((x) => x.id === p)!.stock, 4);
  } finally {
    Deno.env.delete("CONVERT_BUDGET_MS");
  }
});

Deno.test("sin continuation, salidas recientes siguen dando 409 (doble clic / otra pestaña)", async () => {
  const now = new Date().toISOString();
  seed([line("p1"), line("p2")], { p1: 5, p2: 5 }, [
    { product_id: "p1", quantity: 1, created_date: now, updated_date: now, stock_applied: true, stock_apply_state: "applied" },
  ]);
  const { res, exits } = await convert();
  assertEquals(res.status, 409);
  assertEquals(exits().length, 1);
});

Deno.test("continuation con una salida reciente que no ha terminado: 409, no duplica", async () => {
  const now = new Date().toISOString();
  seed([line("p1"), line("p2")], { p1: 5, p2: 5 }, [
    { product_id: "p1", quantity: 1, created_date: now, updated_date: now, stock_applied: false, stock_apply_state: "pending" },
  ]);
  const { res, body, exits } = await convert({ continuation: true });
  assertEquals(res.status, 409);
  assertEquals(body.conversion_in_progress, true);
  assertEquals(exits().length, 1);
});
