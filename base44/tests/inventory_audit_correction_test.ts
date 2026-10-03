/**
 * applyInventoryAuditCorrection (rehabilitada): permisos, confirmacion explicita,
 * recalculo en servidor y registro en InventoryAuditLog.
 *
 * Handlers REALES con un cliente SDK simulado en memoria (mismo patron que
 * procesos_control_test.ts). No toca red ni datos reales.
 *
 * Run: deno test -A base44/tests/inventory_audit_correction_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

class FakeDb {
  tables: Record<string, Row[]> = {};
  seq = 0;
  failCreateOn: string | null = null;
  seed(table: string, rows: Row[]) {
    for (const r of rows) this.insert(table, r);
  }
  insert(table: string, data: Row): Row {
    this.seq++;
    const row = {
      id: data.id ?? `${table}-${this.seq}`,
      created_date: new Date(Date.UTC(2026, 6, 1, 0, 0, 0, this.seq)).toISOString(),
      ...data,
    };
    (this.tables[table] ??= []).push(row);
    return row;
  }
  rows(table: string) {
    return this.tables[table] ?? [];
  }
  entity(table: string) {
    // deno-lint-ignore no-this-alias
    const db = this;
    return {
      filter: (q: Row = {}, sort?: string, limit?: number, skip = 0) => {
        let out = db.rows(table).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v));
        if (sort) {
          const desc = sort.startsWith("-");
          const f = desc ? sort.slice(1) : sort;
          out = [...out].sort((a, b) => String(a[f] ?? "").localeCompare(String(b[f] ?? "")) * (desc ? -1 : 1));
        }
        out = out.slice(skip, limit ? skip + limit : undefined);
        return Promise.resolve(out.map((r) => ({ ...r })));
      },
      create: (data: Row) => {
        if (db.failCreateOn === table) return Promise.reject(new Error(`${table} create failed`));
        return Promise.resolve({ ...db.insert(table, data) });
      },
      update: (id: string, patch: Row) => {
        const r = db.rows(table).find((x) => x.id === id);
        if (!r) return Promise.reject(new Error(`${table} ${id} not found`));
        Object.assign(r, patch);
        return Promise.resolve({ ...r });
      },
      delete: (id: string) => {
        db.tables[table] = db.rows(table).filter((x) => x.id !== id);
        return Promise.resolve({});
      },
    };
  }
  snapshot() {
    return JSON.stringify(this.tables);
  }
}

type Ctx = { db: FakeDb; user: Row | null };
G.__ac = {
  ctx: null as Ctx | null,
  client() {
    const ctx = this.ctx as Ctx;
    const entities = new Proxy({}, { get: (_t, name: string) => ctx.db.entity(name) });
    return {
      auth: { me: () => (ctx.user ? Promise.resolve(ctx.user) : Promise.reject(new Error("Authentication required to view users"))) },
      asServiceRole: { entities },
    };
  },
};

const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__ac.client(req); }");
const PERM_URL = "data:application/typescript;base64," +
  btoa("export function hasPermission() { return Promise.resolve(true); }");

const ROOT = new URL("../../", import.meta.url);
const tmp = await Deno.makeTempDir();

async function loadHandle(rel: string): Promise<(req: Request) => Promise<Response>> {
  const abs = new URL(rel, ROOT);
  const src = await Deno.readTextFile(abs);
  const rewritten = "// @ts-nocheck\n" +
    src
      .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`).replace(/from\s+['"](?:\.\.\/)+shared\/authUser\.ts['"]/, `from '${new URL("../shared/authUser.ts", import.meta.url).href}'`)
      .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM_URL}'`)
      .replace(/from\s+'\.\/(\w+\.ts)'/g, (_m, f) => `from '${new URL(f, abs).href}'`);
  const file = `${tmp}/${rel.replace(/\W/g, "_")}.ts`;
  await Deno.writeTextFile(file, rewritten);
  return (await import(`file://${file}?${Math.random()}`)).handle;
}

const correction = await loadHandle("base44/functions/products/handlers/applyInventoryAuditCorrection.ts");
const audit = await loadHandle("base44/functions/products/handlers/auditInventory.ts");

async function call(h: (r: Request) => Promise<Response>, db: FakeDb, user: Row | null, body: Row) {
  G.__ac.ctx = { db, user } as Ctx;
  const res = await h(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() as Row };
}

const OWNER = { id: "u1", email: "dueno@b1.com", role: "owner", business_id: "b1" };
const ADMIN = { id: "u2", email: "admin@b1.com", role: "admin", business_id: "b1" };

function auditDb() {
  const db = new FakeDb();
  db.seed("Product", [
    { id: "pBad", business_id: "b1", name: "Descuadrado", stock: 10 }, // esperado 7 -> sync_error
    { id: "pNone", business_id: "b1", name: "SinMov", stock: 3 }, // no_movements
    { id: "pLegacy", business_id: "b1", name: "Legacy", stock: 9 }, // legacy_bug
    { id: "pOk", business_id: "b1", name: "OK", stock: 7 },
    { id: "pOther", business_id: "b2", name: "OtroTenant", stock: 50 }, // esperado 40 en b2
  ]);
  db.seed("Movement", [
    { business_id: "b1", product_id: "pBad", type: "exit", quantity: 3, stock_after: 7, stock_applied: true, created_date: "2026-06-01T00:00:00.000Z" },
    { business_id: "b1", product_id: "pLegacy", type: "entry", quantity: 5, stock_after: 5, stock_applied: true, created_date: "2026-03-01T00:00:00.000Z" },
    { business_id: "b1", product_id: "pOk", type: "exit", quantity: 3, stock_after: 7, stock_applied: true, created_date: "2026-06-01T00:00:00.000Z" },
    { business_id: "b2", product_id: "pOther", type: "exit", quantity: 1, stock_after: 40, stock_applied: true, created_date: "2026-06-01T00:00:00.000Z" },
  ]);
  return db;
}

const validBody = (over: Row = {}) => ({
  action: "applyInventoryAuditCorrection",
  product_id: "pBad",
  mode: "revert_to_calculated",
  expected_stock: 7,
  current_stock: 10,
  reason: "Conteo fisico confirma 7",
  confirm: true,
  ...over,
});

const stockOf = (db: FakeDb, id: string) => db.rows("Product").find((p) => p.id === id)!.stock;

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------

Deno.test("sin sesion responde 401 y no escribe", async () => {
  const db = auditDb();
  const before = db.snapshot();
  const r = await call(correction, db, null, validBody());
  assertEquals(r.status, 401);
  assertEquals(db.snapshot(), before);
});

Deno.test("solo owner o admin: cualquier otro rol recibe 403 y no escribe", async () => {
  for (const role of ["almacenista", "vendedor", "user", "viewer", undefined]) {
    const db = auditDb();
    const before = db.snapshot();
    const r = await call(correction, db, { id: "u9", email: "x@b1.com", role, business_id: "b1" }, validBody());
    assertEquals(r.status, 403, `rol ${role}`);
    assertEquals(db.snapshot(), before);
  }
});

Deno.test("owner y admin del tenant si pueden corregir", async () => {
  for (const user of [OWNER, ADMIN]) {
    const db = auditDb();
    const r = await call(correction, db, user, validBody());
    assertEquals(r.status, 200, JSON.stringify(r.json));
    assertEquals(stockOf(db, "pBad"), 7);
  }
});

Deno.test("solo en su propio tenant: producto de otro negocio -> 403 sin escribir (aunque el body diga otro business_id)", async () => {
  const db = auditDb();
  const before = db.snapshot();
  const r = await call(correction, db, OWNER, validBody({ product_id: "pOther", expected_stock: 40, current_stock: 50, business_id: "b2" }));
  assertEquals(r.status, 403);
  assertEquals(db.snapshot(), before);
  // ni siquiera un admin de b2 corrige en b1
  const r2 = await call(correction, db, { id: "u3", email: "a@b2.com", role: "admin", business_id: "b2" }, validBody());
  assertEquals(r2.status, 403);
  assertEquals(db.snapshot(), before);
});

Deno.test("owner sin business_id -> 400 sin escribir", async () => {
  const db = auditDb();
  const before = db.snapshot();
  const r = await call(correction, db, { id: "u1", email: "d@x.com", role: "owner" }, validBody());
  assertEquals(r.status, 400);
  assertEquals(db.snapshot(), before);
});

// ---------------------------------------------------------------------------
// Confirmacion explicita y contrato
// ---------------------------------------------------------------------------

Deno.test("sin confirm:true (ausente, false o string) -> 400 confirmation_required y no escribe", async () => {
  for (const confirm of [undefined, false, "true", 1]) {
    const db = auditDb();
    const before = db.snapshot();
    const r = await call(correction, db, OWNER, validBody({ confirm }));
    assertEquals(r.status, 400);
    assertEquals(r.json.code, "confirmation_required");
    assertEquals(db.snapshot(), before);
  }
});

Deno.test("sin motivo (vacio o muy corto) -> 400 y no escribe", async () => {
  for (const reason of [undefined, "", "  ", "ab"]) {
    const db = auditDb();
    const before = db.snapshot();
    const r = await call(correction, db, OWNER, validBody({ reason }));
    assertEquals(r.status, 400);
    assertEquals(r.json.code, "reason_required");
    assertEquals(db.snapshot(), before);
  }
});

Deno.test("el modo viaja en 'mode': mode invalido/ausente o el campo viejo 'correction' no corrigen nada", async () => {
  for (const body of [validBody({ mode: "otro" }), validBody({ mode: undefined, correction: "revert_to_calculated" })]) {
    const db = auditDb();
    const before = db.snapshot();
    const r = await call(correction, db, OWNER, body);
    assertEquals(r.status, 400);
    assertEquals(db.snapshot(), before);
  }
});

// ---------------------------------------------------------------------------
// Recalculo en servidor
// ---------------------------------------------------------------------------

Deno.test("no se confia en expected_stock/current_stock del cliente: valores distintos -> 409 stale_audit", async () => {
  for (const over of [{ expected_stock: 0 }, { expected_stock: 999999 }, { expected_stock: -5 }, { current_stock: 11 }]) {
    const db = auditDb();
    const before = db.snapshot();
    const r = await call(correction, db, OWNER, validBody(over));
    assertEquals(r.status, 409);
    assertEquals(r.json.code, "stale_audit");
    assertEquals(db.snapshot(), before);
  }
  const db = auditDb();
  const r = await call(correction, db, OWNER, validBody({ expected_stock: "7" }));
  assertEquals(r.status, 400);
});

Deno.test("no_movements, legacy_bug y productos que ya cuadran se rechazan (409) sin escribir", async () => {
  const cases: Array<[Row, string]> = [
    [{ product_id: "pNone", expected_stock: 0, current_stock: 3 }, "not_correctable"],
    [{ product_id: "pLegacy", expected_stock: 5, current_stock: 9 }, "not_correctable"],
    [{ product_id: "pOk", expected_stock: 7, current_stock: 7 }, "no_discrepancy"],
  ];
  for (const [over, code] of cases) {
    for (const mode of ["accept_current", "revert_to_calculated"]) {
      const db = auditDb();
      const before = db.snapshot();
      const r = await call(correction, db, OWNER, validBody({ ...over, mode }));
      assertEquals(r.status, 409, `${over.product_id}/${mode}`);
      assertEquals(r.json.code, code);
      assertEquals(db.snapshot(), before);
    }
  }
});

Deno.test("producto inexistente -> 404", async () => {
  const db = auditDb();
  const r = await call(correction, db, OWNER, validBody({ product_id: "nope" }));
  assertEquals(r.status, 404);
});

// ---------------------------------------------------------------------------
// Efecto y registro
// ---------------------------------------------------------------------------

Deno.test("revert_to_calculated: fija el stock calculado y registra quien, antes, despues y motivo", async () => {
  const db = auditDb();
  const r = await call(correction, db, ADMIN, validBody({ reason: "  Conteo fisico del 01/10  " }));
  assertEquals(r.status, 200);
  assertEquals(r.json.stock_before, 10);
  assertEquals(r.json.stock_after, 7);
  assertEquals(stockOf(db, "pBad"), 7);

  const logs = db.rows("InventoryAuditLog");
  assertEquals(logs.length, 1);
  const log = logs[0];
  assertEquals(log.event_type, "system_correction");
  assertEquals(log.business_id, "b1");
  assertEquals(log.product_id, "pBad");
  assertEquals(log.product_name, "Descuadrado");
  assertEquals(log.performed_by, "admin@b1.com"); // quien
  assertEquals(log.stock_before, 10); // antes
  assertEquals(log.stock_after, 7); // despues
  assert(log.notes.includes("Conteo fisico del 01/10")); // motivo
  assert(log.notes.includes("revert_to_calculated"));
  assert(typeof log.created_date === "string" && log.created_date.length > 0); // cuando

  const adj = db.rows("Movement").filter((m) => m.type === "adjustment");
  assertEquals(adj.length, 1);
  assertEquals(adj[0].quantity, 7); // absoluto = stock final
  assertEquals(adj[0].stock_after, 7);
  assertEquals(adj[0].stock_applied, true);
  assertEquals(adj[0].business_id, "b1");
});

Deno.test("accept_current: no cambia el stock, pero registra la decision", async () => {
  const db = auditDb();
  const r = await call(correction, db, OWNER, validBody({ mode: "accept_current", reason: "El conteo fisico dice 10" }));
  assertEquals(r.status, 200);
  assertEquals(stockOf(db, "pBad"), 10);
  const logs = db.rows("InventoryAuditLog");
  assertEquals(logs.length, 1);
  assertEquals(logs[0].stock_before, 10);
  assertEquals(logs[0].stock_after, 10);
  assertEquals(logs[0].performed_by, "dueno@b1.com");
  assert(logs[0].notes.includes("accept_current") && logs[0].notes.includes("El conteo fisico dice 10"));
  const adj = db.rows("Movement").filter((m) => m.type === "adjustment");
  assertEquals(adj.length, 1);
  assertEquals(adj[0].quantity, 10); // absoluto = stock final
  assertEquals(adj[0].stock_after, 10);
});

Deno.test("tras corregir, la auditoria deja de reportar el producto; no se toca ningun otro", async () => {
  for (const mode of ["accept_current", "revert_to_calculated"]) {
    const db = auditDb();
    const otherBefore = JSON.stringify(db.rows("Product").filter((p) => p.id !== "pBad"));
    assertEquals((await call(correction, db, OWNER, validBody({ mode }))).status, 200);
    const a = await call(audit, db, OWNER, { action: "auditInventory" });
    assertEquals(a.status, 200);
    assert(!a.json.discrepancies.some((d: Row) => d.product_id === "pBad"), `${mode}: sigue reportado`);
    assertEquals(JSON.stringify(db.rows("Product").filter((p) => p.id !== "pBad")), otherBefore);
    // un segundo intento (doble clic) ya no encuentra nada que corregir
    assertEquals((await call(correction, db, OWNER, validBody({ mode }))).status, 409);
  }
});

Deno.test("si el registro falla, el stock se revierte y no queda movimiento: no hay correccion sin registro", async () => {
  const db = auditDb();
  db.failCreateOn = "InventoryAuditLog";
  const movsBefore = db.rows("Movement").length;
  const r = await call(correction, db, OWNER, validBody());
  assertEquals(r.status, 500);
  assertEquals(stockOf(db, "pBad"), 10);
  assertEquals(db.rows("Movement").length, movsBefore);
  assertEquals(db.rows("InventoryAuditLog").length, 0);
});

Deno.test("auditInventory: no_movements y legacy_bug ya no ofrecen correccion automatica", async () => {
  const db = auditDb();
  const a = await call(audit, db, OWNER, { action: "auditInventory" });
  const byId = Object.fromEntries(a.json.discrepancies.map((d: Row) => [d.product_id, d]));
  assertEquals(byId.pBad.can_auto_correct, true);
  assertEquals(byId.pNone.can_auto_correct, false);
  assertEquals(byId.pLegacy.can_auto_correct, false);
});

// ---------------------------------------------------------------------------
// Frontend
// ---------------------------------------------------------------------------

Deno.test("frontend: botones rehabilitados, 'action' una sola vez, modo en 'mode' y confirmacion explicita", async () => {
  const src = await Deno.readTextFile(new URL("src/pages/Settings.jsx", ROOT));
  const m = src.match(/functions\.invoke\(\s*'products'\s*,\s*\{([^}]*action:\s*'applyInventoryAuditCorrection'[^}]*)\}/);
  assert(m, "falta la llamada a applyInventoryAuditCorrection");
  const body = m[1];
  assertEquals((body.match(/(?<![\w.])action\s*:/g) ?? []).length, 1, "clave action repetida");
  assert(/\bmode\s*,|\bmode\s*:/.test(body), "el modo debe viajar en 'mode'");
  assert(!/\bcorrection\s*:/.test(body));
  assert(/confirm:\s*true/.test(body));
  assert(/reason:/.test(body));
  assert(src.includes("Aceptar actual (") && src.includes("Corregir a {d.expected_stock}"));
  // La llamada solo ocurre desde el dialogo de confirmacion; los botones solo abren el dialogo
  assert(src.includes("setPendingCorrection({ d, mode: 'accept_current' })"));
  assert(src.includes("setPendingCorrection({ d, mode: 'revert_to_calculated' })"));
  assert(src.includes("Confirmar corrección"));
  // Solo owner/admin ven los botones
  assert(/canCorrectInventory\s*=\s*currentUserRole === 'owner' \|\| currentUserRole === 'admin'/.test(src));
  assert(src.includes("d.can_auto_correct && canCorrectInventory"));
});
