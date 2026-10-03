/**
 * Fallas preexistentes confirmadas por la regresion (2026-10-02):
 *  1. createMovementSafe (return + petty_cash_deduction): el egreso de caja chica se creaba SIN await,
 *     la funcion respondia antes y el egreso podia no generarse. Un fallo de caja chica no aborta
 *     la devolucion pero se informa en petty_cash_warning.
 *  2. upgradeOwnerToAdmin: sin sesion -> 401 (antes 500). Cubierto por auth_401_sin_sesion_test.ts.
 *  3. sendTestLifecycleEmails: sin sesion -> 401 (antes 403); no dueño -> 403.
 *
 * SDK simulado, sin red ni datos. Estas pruebas FALLAN con el codigo anterior.
 * Run: deno test --allow-env --allow-read base44/tests/preexisting_fixes_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;
Deno.env.set("PLATFORM_OWNER_EMAIL", "platform@x.com");

const b64 = (src: string) => "data:application/typescript;base64," + btoa(unescape(encodeURIComponent(src)));
const MOCK_SDK_URL = b64("export function createClientFromRequest(req) { return globalThis.__pf.client(req); }");
const readSrc = (rel: string) => Deno.readTextFile(new URL(`../${rel}`, import.meta.url));
const SHARED_URL = b64("// @ts-nocheck\n" + await readSrc("shared/applyStock.ts"));
const PERMS_URL = b64("// @ts-nocheck\n" + await readSrc("functions/movements/handlers/_permissions.ts"));
const VALIDATION_URL = b64("// @ts-nocheck\n" + await readSrc("functions/movements/handlers/_validation.ts"));
const AUTH_URL = new URL("../shared/authUser.ts", import.meta.url).href;
const load = async (rel: string) => {
  const src = "// @ts-nocheck\n" + (await readSrc(rel))
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
    .replace(/from\s+['"](?:\.\.\/)+shared\/applyStock\.ts['"]/, `from '${SHARED_URL}'`)
    .replace(/from\s+['"](?:\.\.\/)+shared\/authUser\.ts['"]/, `from '${AUTH_URL}'`)
    .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERMS_URL}'`)
    .replace(/from\s+['"]\.\/_validation\.ts['"]/, `from '${VALIDATION_URL}'`);
  return (await import(b64(src))).handle as (r: Request) => Promise<Response>;
};

const createMov = await load("functions/movements/handlers/createMovementSafe.ts");
const sendTest = await load("functions/business/handlers/sendTestLifecycleEmails.ts");

// Base en memoria con latencia: una escritura sin await NO existe todavia cuando responde la funcion.
const DELAY = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class Db {
  t: Record<string, Row[]> = {};
  failPetty = false;
  seq = 0;
  seed(table: string, rows: Row[]) { (this.t[table] ??= []).push(...rows); }
  rows(table: string) { return this.t[table] ?? []; }
  entity(table: string) {
    return {
      filter: async (q: Row = {}) => {
        await sleep(DELAY);
        return this.rows(table).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }));
      },
      list: async () => this.rows(table).map((r) => ({ ...r })),
      get: async (id: string) => ({ ...this.rows(table).find((r) => r.id === id) }),
      create: async (d: Row) => {
        await sleep(DELAY);
        if (table === "PettyCashMovement" && this.failPetty) throw new Error("petty cash down");
        const row = { id: `${table}-${++this.seq}`, ...d };
        (this.t[table] ??= []).push(row);
        return { ...row };
      },
      update: async (id: string, patch: Row) => {
        await sleep(DELAY);
        const r = this.rows(table).find((x) => x.id === id);
        if (!r) throw new Error("not found");
        Object.assign(r, patch);
        return { ...r };
      },
    };
  }
}

G.__pf = {
  ctx: null as { db: Db; user: Row | null } | null,
  client() {
    const ctx = this.ctx;
    const entities = new Proxy({}, { get: (_t: unknown, n: string) => ctx.db.entity(n) });
    return {
      auth: {
        me: () => ctx.user ? Promise.resolve(ctx.user) : Promise.reject(Object.assign(new Error("Authentication required to view users"), { status: 401 })),
      },
      asServiceRole: {
        entities,
        functions: { invoke: () => Promise.resolve({ data: { success: true } }) },
        integrations: { Core: { SendEmail: () => { throw new Error("no debe enviar correos"); } } },
      },
    };
  },
};

const owner = { id: "u1", role: "owner", business_id: "b1", email: "o@x.com" };
function baseDb() {
  const db = new Db();
  db.seed("Business", [{ id: "b1", billing_status: "active" }]);
  db.seed("Product", [{ id: "p1", business_id: "b1", name: "Cafe", stock: 10, purchase_price: 5 }]);
  db.seed("TenantRule", [{ id: "r1", business_id: "b1", rule_key: "cash_sales_to_petty_cash", enabled: true, archived: false }]);
  return db;
}
async function run(db: Db, user: Row | null, fn: (r: Request) => Promise<Response>, body: Row) {
  G.__pf.ctx = { db, user };
  const res = await fn(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() as Row };
}
const RETURN = {
  product_id: "p1", product_name: "Cafe", type: "return", quantity: 2, unit_price: 10, total: 20,
  business_id: "b1", reference: "Efectivo", reason: "defecto", petty_cash_deduction: true,
};

Deno.test("createMovementSafe return en efectivo: el egreso de caja chica YA existe cuando llega la respuesta", async () => {
  const db = baseDb();
  const r = await run(db, owner, createMov, RETURN);
  assertEquals(r.status, 200);
  assertEquals(r.json.petty_cash_warning, undefined);
  const eg = db.rows("PettyCashMovement");
  assertEquals(eg.length, 1, "el egreso debe existir antes de responder");
  assertEquals(eg[0].movement_type, "expense");
  assertEquals(eg[0].amount, 20);
  assertEquals(eg[0].origin_type, "movement_return");
  assertEquals(eg[0].origin_id, db.rows("Movement")[0].id);
  assert(db.rows("TenantRule")[0].last_applied_at, "last_applied_at actualizado antes de responder");
});

Deno.test("createMovementSafe return: sin regla activa o sin deduccion no crea egreso", async () => {
  const db = baseDb();
  db.t.TenantRule[0].enabled = false;
  await run(db, owner, createMov, RETURN);
  assertEquals(db.rows("PettyCashMovement").length, 0);
  const db2 = baseDb();
  await run(db2, owner, createMov, { ...RETURN, petty_cash_deduction: false });
  assertEquals(db2.rows("PettyCashMovement").length, 0);
  const db3 = baseDb();
  await run(db3, owner, createMov, { ...RETURN, reference: "Tarjeta" });
  assertEquals(db3.rows("PettyCashMovement").length, 0);
});

Deno.test("createMovementSafe return: si falla caja chica la devolucion sigue registrada y se avisa en petty_cash_warning", async () => {
  const db = baseDb();
  db.failPetty = true;
  const r = await run(db, owner, createMov, RETURN);
  assertEquals(r.status, 200);
  assertEquals(r.json.success, true);
  assertEquals(db.rows("Movement").length, 1);
  assert(r.json.petty_cash_warning, "debe devolver petty_cash_warning");
  assert(/caja chica/i.test(String(r.json.petty_cash_warning.message)));
  assertEquals(db.rows("PettyCashMovement").length, 0);
});

Deno.test("sendTestLifecycleEmails: sin sesion 401; no dueño 403", async () => {
  const db = baseDb();
  const a = await run(db, null, sendTest, {});
  assertEquals(a.status, 401, JSON.stringify(a.json));
  const b = await run(db, { id: "u2", email: "otro@x.com" }, sendTest, {});
  assertEquals(b.status, 403, JSON.stringify(b.json));
});
