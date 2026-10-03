/**
 * registerQuotationPayment / editQuotationPayment deben respetar la regla de
 * tenant cash_sales_to_petty_cash (igual que updateQuotationFlagsSafe via
 * syncCashSaleToPettyCash): con la regla desactivada, archivada o ausente no
 * se crea ingreso en caja chica por pagos en efectivo.
 *
 * SDK simulado en memoria; no toca red ni datos reales.
 * Run: deno test -A base44/tests/quotation_payments_cash_rule_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

class FakeDb {
  tables: Record<string, Row[]> = {};
  seq = 0;
  seed(t: string, rows: Row[]) { for (const r of rows) this.insert(t, r); }
  insert(t: string, d: Row) {
    this.seq++;
    const row = { id: d.id ?? `${t}-${this.seq}`, ...d };
    (this.tables[t] ??= []).push(row);
    return row;
  }
  rows(t: string) { return this.tables[t] ?? []; }
  entity(t: string) {
    return {
      filter: (q: Row = {}) =>
        Promise.resolve(this.rows(t).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
      get: (id: string) => {
        const r = this.rows(t).find((x) => x.id === id);
        return Promise.resolve(r ? { ...r } : null);
      },
      create: (d: Row) => Promise.resolve({ ...this.insert(t, d) }),
      update: (id: string, p: Row) => {
        const r = this.rows(t).find((x) => x.id === id);
        if (!r) return Promise.reject(new Error("not found"));
        Object.assign(r, p);
        return Promise.resolve({ ...r });
      },
      delete: (id: string) => {
        const a = this.rows(t);
        const i = a.findIndex((x) => x.id === id);
        if (i >= 0) a.splice(i, 1);
        return Promise.resolve({ success: true });
      },
    };
  }
}

G.__sf = { db: null as FakeDb | null };
const MOCK_SDK_URL = "data:application/typescript;base64," + btoa(
  `export function createClientFromRequest() {
    const db = globalThis.__sf.db;
    const entities = new Proxy({}, { get: (_t, n) => db.entity(n) });
    return { auth: { me: () => Promise.resolve({ id: "u1", business_id: "b1", role: "owner" }) }, asServiceRole: { entities } };
  }`,
);

async function load(rel: string) {
  const src = await Deno.readTextFile(new URL(rel, import.meta.url));
  const out = "// @ts-nocheck\n" + src.replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
    .replace("'./_permissions.ts'", `'${new URL("../functions/quotationPayments/handlers/_permissions.ts", import.meta.url).href}'`)
    .replace("'./_cashRule.ts'", `'${new URL("../functions/quotationPayments/handlers/_cashRule.ts", import.meta.url).href}'`);
  const mod = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(out))));
  return mod.handle as (req: Request) => Promise<Response>;
}

const register = await load("../functions/quotationPayments/handlers/registerQuotationPayment.ts");
const edit = await load("../functions/quotationPayments/handlers/editQuotationPayment.ts");

const req = (body: Row) => new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) });
const RULE = { id: "r1", business_id: "b1", rule_key: "cash_sales_to_petty_cash", enabled: true, archived: false, config_json: {} };

function mkDb(rule: Row | null, payments: Row[] = []) {
  const db = new FakeDb();
  db.seed("Business", [{ id: "b1", billing_status: "active" }]);
  db.seed("Quotation", [{ id: "q1", business_id: "b1", folio: "F-1", client_name: "C", status: "converted", total: 500, amount_paid: 0, balance: 500, paid: false, payments }]);
  if (rule) db.seed("TenantRule", [rule]);
  G.__sf.db = db;
  return db;
}

Deno.test("register: regla desactivada -> pago en efectivo NO crea caja chica", async () => {
  const db = mkDb({ ...RULE, enabled: false });
  const res = await register(req({ quotation_id: "q1", amount: 100, payment_method: "Efectivo" }));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).petty_cash_movement_id, null);
  assertEquals(db.rows("PettyCashMovement").length, 0);
  assertEquals(db.rows("Quotation")[0].amount_paid, 100);
});

Deno.test("register: regla archivada o ausente -> no crea caja chica", async () => {
  for (const rule of [{ ...RULE, archived: true }, null]) {
    const db = mkDb(rule);
    await register(req({ quotation_id: "q1", amount: 100, payment_method: "Efectivo" }));
    assertEquals(db.rows("PettyCashMovement").length, 0);
  }
});

Deno.test("register: regla activa -> crea ingreso (comportamiento previo intacto)", async () => {
  const db = mkDb({ ...RULE });
  const res = await register(req({ quotation_id: "q1", amount: 100, payment_method: "Efectivo" }));
  const j = await res.json();
  assertEquals(db.rows("PettyCashMovement").length, 1);
  assertEquals(db.rows("PettyCashMovement")[0].amount, 100);
  assertEquals(j.petty_cash_movement_id, db.rows("PettyCashMovement")[0].id);
});

Deno.test("register: pago no efectivo con regla activa -> no crea caja chica", async () => {
  const db = mkDb({ ...RULE });
  await register(req({ quotation_id: "q1", amount: 100, payment_method: "Transferencia" }));
  assertEquals(db.rows("PettyCashMovement").length, 0);
});

Deno.test("edit: no efectivo -> efectivo con regla desactivada NO crea caja chica", async () => {
  const db = mkDb({ ...RULE, enabled: false }, [{ id: "p1", amount: 100, payment_method: "Transferencia", petty_cash_movement_id: null }]);
  const res = await edit(req({ quotation_id: "q1", payment_id: "p1", amount: 100, payment_method: "Efectivo" }));
  assertEquals(res.status, 200);
  assertEquals(db.rows("PettyCashMovement").length, 0);
  assertEquals(db.rows("Quotation")[0].payments[0].payment_method, "Efectivo");
});

Deno.test("edit: no efectivo -> efectivo con regla activa crea caja chica", async () => {
  const db = mkDb({ ...RULE }, [{ id: "p1", amount: 100, payment_method: "Transferencia", petty_cash_movement_id: null }]);
  await edit(req({ quotation_id: "q1", payment_id: "p1", amount: 100, payment_method: "Efectivo" }));
  assertEquals(db.rows("PettyCashMovement").length, 1);
});

Deno.test("edit: movimiento ya existente se sigue actualizando aunque la regla este desactivada", async () => {
  const db = mkDb({ ...RULE, enabled: false }, [{ id: "p1", amount: 100, payment_method: "Efectivo", petty_cash_movement_id: "pc1" }]);
  db.seed("PettyCashMovement", [{ id: "pc1", business_id: "b1", amount: 100 }]);
  await edit(req({ quotation_id: "q1", payment_id: "p1", amount: 150, payment_method: "Efectivo" }));
  assertEquals(db.rows("PettyCashMovement").length, 1);
  assertEquals(db.rows("PettyCashMovement")[0].amount, 150);
});
