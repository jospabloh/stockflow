/**
 * deleteMovementSafe: un ajuste con movimientos posteriores NO se borra.
 *
 * Por qué: un ajuste fija el stock en un valor absoluto. Al borrarlo el handler reponía el
 * stock_after del movimiento ANTERIOR e ignoraba todo lo posterior (el stock saltaba de 6 a 20
 * en una prueba). Decisión de JP (2026-10-05): tiene que haber trazabilidad; se ajusta, no se
 * borra historial. El ajuste que es el último movimiento se sigue borrando como siempre.
 *
 * Ejecuta el handler REAL contra una base en memoria (mismo método de aislamiento del SDK que
 * stock_no_aplicado_test.ts). Run: deno test --allow-env --allow-read base44/tests/delete_adjustment_history_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;
Deno.env.set("CRON_SECRET", "test-secret");

class FakeDb {
  tables: Record<string, Row[]> = {};
  writes = 0;
  /** true = la plataforma ignora el orden pedido (devuelve en el orden de inserción). */
  ignoreSort = false;
  seed(t: string, rows: Row[]) {
    (this.tables[t] ??= []).push(...rows.map((r) => ({ ...r })));
  }
  rows(t: string) {
    return this.tables[t] ?? [];
  }
  get(t: string, id: string) {
    return this.rows(t).find((r) => r.id === id)!;
  }
  entity(t: string) {
    // deno-lint-ignore no-this-alias
    const db = this;
    return {
      // Respeta el orden ('-campo') y el límite, como la plataforma.
      filter: (q: Row = {}, sort?: string, limit?: number) => {
        let out = db.rows(t).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }));
        if (sort && !db.ignoreSort) {
          const desc = sort.startsWith("-");
          const f = desc ? sort.slice(1) : sort;
          out.sort((a, b) => (desc ? -1 : 1) * (a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0));
        }
        if (limit) out = out.slice(0, limit);
        return Promise.resolve(out);
      },
      update: (id: string, patch: Row) => {
        db.writes++;
        Object.assign(db.get(t, id), patch);
        return Promise.resolve({});
      },
      delete: (id: string) => {
        db.writes++;
        const a = db.rows(t);
        const i = a.findIndex((x) => x.id === id);
        if (i >= 0) a.splice(i, 1);
        return Promise.resolve({ success: true });
      },
    };
  }
}

const b64 = (src: string) => "data:application/typescript;base64," + btoa(unescape(encodeURIComponent(src)));
const MOCK_SDK_URL = b64("export function createClientFromRequest(req) { return globalThis.__sf.client(req); }");
const src = "// @ts-nocheck\n" + (await Deno.readTextFile(new URL("../functions/movements/handlers/deleteMovementSafe.ts", import.meta.url)))
  .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
  .replace(/from\s+['"](?:\.\.\/)+shared\/authUser\.ts['"]/, `from '${new URL("../shared/authUser.ts", import.meta.url).href}'`);
const deleteMov = (await import(b64(src))).handle as (r: Request) => Promise<Response>;

G.__sf = {
  ctx: null as { db: FakeDb; user: Row } | null,
  client() {
    const ctx = this.ctx!;
    const entities = new Proxy({}, { get: (_t, name: string) => ctx.db.entity(name) });
    return {
      auth: { me: () => Promise.resolve(ctx.user) },
      asServiceRole: { entities, functions: { invoke: () => Promise.resolve({ data: { success: true } }) } },
    };
  },
};

const owner = { id: "u1", role: "owner", business_id: "b1", email: "o@x.com" };
const t = (n: number) => new Date(Date.UTC(2026, 9, 1, 10, n)).toISOString();

/** entrada 10 -> salida 4 -> ajuste a 20 -> devolución 1: el producto queda en 21. */
function history(extra: Row[] = []) {
  const db = new FakeDb();
  db.seed("Business", [{ id: "b1", billing_status: "active" }]);
  db.seed("Product", [{ id: "p1", business_id: "b1", name: "Cafe", stock: 21 }]);
  db.seed("Movement", [
    { id: "mEntry", business_id: "b1", product_id: "p1", type: "entry", quantity: 10, stock_after: 10, created_date: t(1) },
    { id: "mExit", business_id: "b1", product_id: "p1", type: "exit", quantity: 4, stock_after: 6, created_date: t(2) },
    { id: "mAdj", business_id: "b1", product_id: "p1", type: "adjustment", quantity: 20, stock_after: 20, created_date: t(3) },
    { id: "mRet", business_id: "b1", product_id: "p1", type: "return", quantity: 1, stock_after: 21, created_date: t(4) },
    ...extra,
  ]);
  return db;
}
async function run(db: FakeDb, body: Row, user: Row = owner) {
  G.__sf.ctx = { db, user };
  const res = await deleteMov(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() as Row };
}

Deno.test("ajuste con movimientos posteriores -> 409 en español; stock y movimientos intactos (con main el stock saltaba de 21 a 6)", async () => {
  const db = history();
  const r = await run(db, { movement_id: "mAdj" });
  assertEquals(r.status, 409);
  assertEquals(r.json.success, false);
  assertEquals(r.json.blocked_by_history, true);
  assert(/ajuste/i.test(r.json.error) && /posteriores/.test(r.json.error), "mensaje claro en español");
  assertEquals(db.get("Product", "p1").stock, 21);
  assertEquals(db.rows("Movement").length, 4);
  assertEquals(db.writes, 0, "nada se escribe antes del 409");
});

Deno.test("ajuste que es el último movimiento se borra como hoy (vuelve al stock_after anterior)", async () => {
  const db = history();
  db.tables.Movement = db.rows("Movement").filter((m) => m.id !== "mRet");
  db.get("Product", "p1").stock = 20;
  const r = await run(db, { movement_id: "mAdj" });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 6);
  assertEquals(db.rows("Movement").some((m) => m.id === "mAdj"), false);
});

Deno.test("los demás tipos se borran igual que hoy aunque haya movimientos posteriores", async () => {
  const db = history();
  const r = await run(db, { movement_id: "mExit" });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 25); // 21 + 4, comportamiento de siempre
  assertEquals(db.rows("Movement").some((m) => m.id === "mExit"), false);
});

Deno.test("movimientos posteriores de OTRO producto u otro negocio no bloquean el borrado del ajuste", async () => {
  const db = history();
  db.tables.Movement = db.rows("Movement").filter((m) => m.id !== "mRet");
  db.get("Product", "p1").stock = 20;
  db.seed("Movement", [
    { id: "x1", business_id: "b1", product_id: "p2", type: "exit", quantity: 1, created_date: t(9) },
    { id: "x2", business_id: "b2", product_id: "p1", type: "exit", quantity: 1, created_date: t(9) },
  ]);
  const r = await run(db, { movement_id: "mAdj" });
  assertEquals(r.status, 200);
});

Deno.test("la guarda no cambia la autorización: un almacenista sigue recibiendo 403", async () => {
  const db = history();
  const r = await run(db, { movement_id: "mAdj" }, { id: "u2", role: "user", business_id: "b1", email: "w@x.com" });
  assertEquals(r.status, 403);
});

Deno.test("la plataforma devuelve los movimientos DESORDENADOS: el ajuste con posteriores sigue bloqueado (409, sin escrituras)", async () => {
  const db = history();
  db.ignoreSort = true;
  // Sin orden, la plataforma devuelve el más antiguo primero (mEntry ... mRet): con límite 1 la guarda vieja miraba mEntry y fallaba abierta.
  const r = await run(db, { movement_id: "mAdj" });
  assertEquals(r.status, 409);
  assertEquals(r.json.blocked_by_history, true);
  assertEquals(db.get("Product", "p1").stock, 21);
  assertEquals(db.rows("Movement").length, 4);
  assertEquals(db.writes, 0);
});

Deno.test("con la plataforma desordenando, el último ajuste se borra y vuelve al stock_after del movimiento anterior", async () => {
  const db = history();
  db.ignoreSort = true;
  db.tables.Movement = db.rows("Movement").filter((m) => m.id !== "mRet"); // mEntry, mExit, mAdj (más antiguo primero)
  db.get("Product", "p1").stock = 20;
  const r = await run(db, { movement_id: "mAdj" });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 6);
});
