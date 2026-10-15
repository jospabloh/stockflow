/**
 * convertQuotationSafe — conversión interrumpida a medias (incidente Baristop
 * COT-261013-0004, 2026-10-15).
 *
 * La conversión crea un Movement de salida por renglón y sólo al final marca
 * la cotización como `converted`. Con la plataforma lenta (20–65 s por
 * renglón) la función murió tras 4 de 11 renglones: quedaron 4 salidas y la
 * cotización en `draft`. El guardia de idempotencia ("existe alguna salida →
 * ya convertida") convertía ese corte en un bloqueo PERMANENTE: cada reintento
 * respondía "Quotation already converted" y la cotización seguía en Borrador.
 *
 * Contrato que fija este archivo:
 *  - Salidas recientes (< ventana de seguridad) → 409 conversion_in_progress,
 *    sin crear nada (sigue cubriendo el doble clic / la corrida en vuelo).
 *  - Salidas viejas y status != converted → se REANUDA: sólo se crean los
 *    renglones que faltan (emparejando por product_id + cantidad, como
 *    multiconjunto) y se marca `converted`.
 *  - Ya `converted` → 400 como siempre.
 * SDK simulado en memoria (sin red ni datos reales).
 *
 * Run: deno test -A base44/tests/convert_resume_interrupted_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("STOCK_APPLY_RETRY_MS", "0");

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const tables: Record<string, Row[]> = {};
const invoked: string[] = [];
let seq = 0;

function entity(name: string) {
  return {
    filter: (q: Row = {}) =>
      Promise.resolve((tables[name] ?? []).filter((r) => Object.entries(q).every(([k, v]) => (v && typeof v === "object" && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v))).map((r) => ({ ...r }))),
    get: (id: string) => Promise.resolve({ ...(tables[name] ?? []).find((r) => r.id === id) }),
    create: (data: Row) => {
      const now = new Date().toISOString();
      const row = { id: `${name}-${++seq}`, created_date: now, updated_date: now, ...data };
      (tables[name] ??= []).push(row);
      return Promise.resolve({ ...row });
    },
    update: (id: string, patch: Row) => {
      const r = (tables[name] ?? []).find((x) => x.id === id);
      if (!r) return Promise.reject(new Error("not found"));
      Object.assign(r, patch, { updated_date: new Date().toISOString() });
      return Promise.resolve({ ...r });
    },
  };
}

// applyMovementStock simulado: aplica el delta de salida y marca el movimiento.
function applyMovementStock(movementId: string) {
  invoked.push(movementId);
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
      functions: {
        invoke: (_fn: string, body: Row) => Promise.resolve(applyMovementStock(body.movement_id)),
      },
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

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ITEMS = [
  { product_id: "pA", product_name: "A", quantity: 1, unit_price: 10, total: 10 },
  { product_id: "pB", product_name: "B", quantity: 1, unit_price: 20, total: 20 },
  { product_id: "pC", product_name: "C", quantity: 2, unit_price: 5, total: 10 },
];

function seed(opts: { status?: string; items?: Row[]; movements?: Row[]; stock?: Record<string, number> } = {}) {
  for (const k of Object.keys(tables)) delete tables[k];
  invoked.length = 0;
  const stock = { pA: 10, pB: 10, pC: 10, ...(opts.stock ?? {}) };
  tables.Business = [{ id: "b1", billing_status: "active" }];
  tables.Product = Object.entries(stock).map(([id, s]) => ({ id, business_id: "b1", stock: s, purchase_price: 1 }));
  tables.Quotation = [{
    id: "q1", business_id: "b1", status: opts.status ?? "draft", folio: "F-1", client_name: "C",
    total: 40, payments: [], items: opts.items ?? ITEMS,
  }];
  tables.Movement = (opts.movements ?? []).map((m, i) => ({
    id: `old-${i}`, type: "exit", quotation_id: "q1", business_id: "b1",
    stock_applied: true, stock_apply_state: "applied", ...m,
  }));
}

async function convert() {
  const res = await handle(
    new Request("http://t/fn", { method: "POST", body: JSON.stringify({ quotation_id: "q1", payment_method: "Transferencia" }) }),
  );
  return { res, body: await res.json(), q: tables.Quotation[0], exits: tables.Movement.filter((m) => m.type === "exit") };
}

Deno.test("conversión normal: una salida por renglón y queda converted", async () => {
  seed();
  const { res, q, exits } = await convert();
  assertEquals(res.status, 200);
  assertEquals(q.status, "converted");
  assertEquals(exits.length, 3);
  assertEquals(tables.Product.find((p) => p.id === "pC")!.stock, 8);
});

Deno.test("conversión interrumpida (salidas viejas): reanuda sólo lo que falta y queda converted", async () => {
  seed({ movements: [{ product_id: "pA", quantity: 1, created_date: ago(30), updated_date: ago(30) }], stock: { pA: 9 } });
  const { res, body, q, exits } = await convert();
  assertEquals(res.status, 200, JSON.stringify(body));
  assertEquals(body.resumed, true);
  assertEquals(q.status, "converted");
  assertEquals(q.payment_method, "Transferencia");
  assertEquals(exits.length, 3);
  assertEquals(exits.filter((m) => m.product_id === "pA").length, 1, "no duplica el renglón ya registrado");
  assertEquals(tables.Product.find((p) => p.id === "pA")!.stock, 9, "no vuelve a descontar A");
  assertEquals(tables.Product.find((p) => p.id === "pB")!.stock, 9);
  assertEquals(tables.Product.find((p) => p.id === "pC")!.stock, 8);
});

Deno.test("salidas recientes: 409 conversion_in_progress, no crea nada ni cambia status", async () => {
  seed({ movements: [{ product_id: "pA", quantity: 1, created_date: ago(1), updated_date: ago(1) }] });
  const { res, body, q, exits } = await convert();
  assertEquals(res.status, 409);
  assertEquals(body.conversion_in_progress, true);
  assertEquals(q.status, "draft");
  assertEquals(exits.length, 1);
});

Deno.test("la ventana usa la actividad más reciente (updated_date), no sólo created_date", async () => {
  seed({ movements: [{ product_id: "pA", quantity: 1, created_date: ago(30), updated_date: ago(1) }] });
  const { res, exits } = await convert();
  assertEquals(res.status, 409);
  assertEquals(exits.length, 1);
});

Deno.test("renglones repetidos del mismo producto se emparejan como multiconjunto", async () => {
  const items = [
    { product_id: "pA", product_name: "A", quantity: 1, unit_price: 10, total: 10 },
    { product_id: "pA", product_name: "A", quantity: 1, unit_price: 10, total: 10 },
    { product_id: "pB", product_name: "B", quantity: 2, unit_price: 10, total: 20 },
  ];
  seed({ items, movements: [{ product_id: "pA", quantity: 1, created_date: ago(30), updated_date: ago(30) }] });
  const { res, q, exits } = await convert();
  assertEquals(res.status, 200);
  assertEquals(q.status, "converted");
  assertEquals(exits.filter((m) => m.product_id === "pA").length, 2);
  assertEquals(exits.filter((m) => m.product_id === "pB").length, 1);
});

Deno.test("al reanudar sólo se valida stock de lo que falta; si falta stock no crea nada", async () => {
  // A ya salió (su stock actual 0 no debe bloquear); B no alcanza → 400 sin escrituras.
  seed({
    movements: [{ product_id: "pA", quantity: 1, created_date: ago(30), updated_date: ago(30) }],
    stock: { pA: 0, pB: 0 },
  });
  const { res, body, q, exits } = await convert();
  assertEquals(res.status, 400);
  assert(String(body.error).includes("Insufficient stock for B"), body.error);
  assertEquals(q.status, "draft");
  assertEquals(exits.length, 1);
});

Deno.test("una salida existente sin stock aplicado se reintenta (idempotente) al reanudar", async () => {
  seed({
    movements: [{
      product_id: "pA", quantity: 1, created_date: ago(30), updated_date: ago(30),
      stock_applied: false, stock_apply_state: undefined,
    }],
  });
  const { res, q } = await convert();
  assertEquals(res.status, 200);
  assertEquals(q.status, "converted");
  assert(invoked.includes("old-0"), "debe invocar applyMovementStock para la salida pendiente");
});

Deno.test("cancelada con salidas viejas: NO se reanuda ni se marca converted", async () => {
  seed({ status: "cancelled", movements: ITEMS.map((i) => ({ product_id: i.product_id, quantity: i.quantity, created_date: ago(60), updated_date: ago(60) })) });
  const { res, q, exits } = await convert();
  assertEquals(res.status, 400);
  assertEquals(q.status, "cancelled");
  assertEquals(exits.length, 3);
});

Deno.test("salida vieja que no corresponde a ningún renglón: 409 needs_review, sin escrituras", async () => {
  // El renglón A se editó a cantidad 1 pero la salida registrada fue de 3.
  seed({ movements: [{ product_id: "pA", quantity: 3, created_date: ago(30), updated_date: ago(30) }] });
  const { res, body, q, exits } = await convert();
  assertEquals(res.status, 409);
  assertEquals(body.needs_review, true);
  assertEquals(q.status, "draft");
  assertEquals(exits.length, 1);
});

Deno.test("ya converted: 400 como siempre, sin escrituras", async () => {
  seed({ status: "converted" });
  const { res, body, exits } = await convert();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Quotation already converted");
  assertEquals(exits.length, 0);
});
