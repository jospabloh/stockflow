/**
 * Procesos de control de inventario: auditoría restaurada (products.auditInventory),
 * contrato de applyInventoryAuditCorrection y aviso diario de dailyStockReconcile.
 *
 * Usa los handlers REALES con un cliente SDK simulado en memoria (mismo patrón que
 * ola3_stock_and_cash_test.ts). No toca red ni datos reales.
 *
 * Run: deno test -A base44/tests/procesos_control_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

Deno.env.set("CRON_SECRET", "test-secret");
Deno.env.set("PLATFORM_OWNER_EMAIL", "owner@example.com");

class FakeDb {
  tables: Record<string, Row[]> = {};
  seq = 0;
  seed(table: string, rows: Row[]) {
    for (const r of rows) this.insert(table, r);
  }
  insert(table: string, data: Row): Row {
    this.seq++;
    const row = {
      id: data.id ?? `${table}-${this.seq}`,
      created_date: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, this.seq)).toISOString(),
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
      // Respeta sort ('-campo' = descendente), limit y skip como el SDK real.
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
      create: (data: Row) => Promise.resolve({ ...db.insert(table, data) }),
      update: (id: string, patch: Row) => {
        const r = db.rows(table).find((x) => x.id === id);
        if (!r) return Promise.reject(new Error(`${table} ${id} not found`));
        Object.assign(r, patch);
        return Promise.resolve({ ...r });
      },
      delete: () => Promise.reject(new Error("delete no debe usarse")),
    };
  }
  snapshot() {
    return JSON.stringify(this.tables);
  }
}

type Ctx = { db: FakeDb; user: Row | null; emails: Row[]; failEmail: boolean };
G.__sf = {
  ctx: null as Ctx | null,
  client() {
    const ctx = this.ctx as Ctx;
    const entities = new Proxy({}, { get: (_t, name: string) => ctx.db.entity(name) });
    return {
      auth: { me: () => (ctx.user ? Promise.resolve(ctx.user) : Promise.reject(new Error("not authenticated"))) },
      asServiceRole: {
        entities,
        integrations: {
          Core: {
            SendEmail: (e: Row) => {
              if (ctx.failEmail) return Promise.reject(new Error("smtp down"));
              ctx.emails.push(e);
              return Promise.resolve({});
            },
          },
        },
      },
    };
  },
};

const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__sf.client(req); }");

const ROOT = new URL("../../", import.meta.url);
const tmp = await Deno.makeTempDir();

async function loadHandle(rel: string): Promise<(req: Request) => Promise<Response>> {
  const abs = new URL(rel, ROOT);
  const src = await Deno.readTextFile(abs);
  const rewritten = "// @ts-nocheck\n" +
    src
      .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
      .replace(/from\s+'\.\/(\w+\.ts)'/g, (_m, f) => `from '${new URL(f, abs).href}'`);
  const file = `${tmp}/${rel.replace(/\W/g, "_")}.ts`;
  await Deno.writeTextFile(file, rewritten);
  const mod = await import(`file://${file}?${Math.random()}`);
  return mod.handle;
}

const audit = await loadHandle("base44/functions/products/handlers/auditInventory.ts");
const reconcile = await loadHandle("base44/functions/jobs/handlers/dailyStockReconcile.ts");

function req(body: Row) {
  return new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) });
}
async function call(
  h: (r: Request) => Promise<Response>,
  db: FakeDb,
  user: Row | null,
  body: Row,
  opts: { failEmail?: boolean } = {},
) {
  const ctx: Ctx = { db, user, emails: [], failEmail: !!opts.failEmail };
  G.__sf.ctx = ctx;
  const res = await h(req(body));
  return { status: res.status, json: await res.json() as Row, emails: ctx.emails };
}

const OWNER = { id: "u1", email: "dueno@b1.com", role: "owner", business_id: "b1" };

function auditDb() {
  const db = new FakeDb();
  db.seed("Product", [
    { id: "pOk", business_id: "b1", name: "OK", stock: 7 },
    { id: "pBad", business_id: "b1", name: "Descuadrado", stock: 10 },
    { id: "pNone", business_id: "b1", name: "SinMov", stock: 3 },
    { id: "pOther", business_id: "b2", name: "OtroTenant", stock: 99 },
  ]);
  db.seed("Movement", [
    { business_id: "b1", product_id: "pOk", type: "exit", quantity: 3, stock_after: 7, stock_applied: true, created_date: "2026-06-01T00:00:00.000Z" },
    { business_id: "b1", product_id: "pBad", type: "exit", quantity: 3, stock_after: 7, stock_applied: true, created_date: "2026-06-01T00:00:00.000Z" },
  ]);
  return db;
}

// ---------------------------------------------------------------------------
// auditInventory (botón "Auditar inventario" de Ajustes)
// ---------------------------------------------------------------------------

Deno.test("products registra la action auditInventory", async () => {
  const idx = await Deno.readTextFile(new URL("base44/functions/products/handlers/index.ts", ROOT));
  assert(idx.includes("from './auditInventory.ts'"));
  assert(/applyInventoryAuditCorrection, auditInventory \}/.test(idx));
});

Deno.test("auditInventory detecta discrepancias del tenant y NO escribe nada", async () => {
  const db = auditDb();
  const before = db.snapshot();
  const r = await call(audit, db, OWNER, { action: "auditInventory" });
  assertEquals(r.status, 200);
  assertEquals(r.json.read_only, true);
  assertEquals(r.json.summary.products_audited, 3); // b2 excluido
  assertEquals(r.json.summary.discrepancies, 2);
  const byId = Object.fromEntries(r.json.discrepancies.map((d: Row) => [d.product_id, d]));
  assertEquals(byId.pBad.current_stock, 10);
  assertEquals(byId.pBad.expected_stock, 7);
  assertEquals(byId.pBad.reason_type, "sync_error");
  assertEquals(byId.pNone.reason_type, "no_movements");
  assert(!byId.pOk && !byId.pOther);
  assertEquals(db.snapshot(), before, "la auditoría no debe modificar ningún dato");
});

Deno.test("auditInventory pagina: no se corta con >500 movimientos por producto", async () => {
  const db = new FakeDb();
  db.seed("Product", [{ id: "p1", business_id: "b1", name: "Muchos", stock: 5 }]);
  const movs: Row[] = [];
  for (let i = 1; i <= 1203; i++) {
    movs.push({ business_id: "b1", product_id: "p1", type: "entry", quantity: 1, stock_after: i === 1203 ? 5 : i });
  }
  db.seed("Movement", movs);
  const r = await call(audit, db, OWNER, {});
  assertEquals(r.status, 200);
  assertEquals(r.json.summary.discrepancies, 0, "el último stock_after (5) coincide con el stock");
  assertEquals(r.json.truncated, false);
});

Deno.test("auditInventory: 401 sin sesión, 403 sin permiso, 200 con permiso", async () => {
  const db = auditDb();
  assertEquals((await call(audit, db, null, {})).status, 401);
  const alm = { id: "u2", email: "alm@b1.com", role: "almacenista", business_id: "b1" };
  // almacenista: audit_inventory está en ALMACENISTA_DENIED -> 403 por defecto
  assertEquals((await call(audit, db, alm, {})).status, 403);
  db.seed("PermissionProfile", [{ business_id: "b1", role_key: "almacenista", permissions: { "Configuracion:audit_inventory": true } }]);
  assertEquals((await call(audit, db, alm, {})).status, 200);
});

// ---------------------------------------------------------------------------
// applyInventoryAuditCorrection: ver inventory_audit_correction_test.ts; aqui solo el frontend
// ---------------------------------------------------------------------------

Deno.test("frontend: ninguna llamada a functions.invoke repite la clave action ni llama auditInventoryNow", async () => {
  const src = await Deno.readTextFile(new URL("src/pages/Settings.jsx", ROOT));
  assert(!src.includes("auditInventoryNow"));
  const re = /functions\.invoke\(\s*'products'\s*,\s*\{([^}]*)\}/g;
  let n = 0;
  for (const m of src.matchAll(re)) {
    n++;
    assertEquals((m[1].match(/(?<![\w.])action\s*:/g) ?? []).length, 1, `clave action repetida: ${m[0]}`);
  }
  assert(n >= 1, "esperaba la llamada auditInventory");
  assert(src.includes("action: 'auditInventory'"));
  // La correccion (applyInventoryAuditCorrection) se cubre en inventory_audit_correction_test.ts
});

// ---------------------------------------------------------------------------
// dailyStockReconcile: aviso por correo, ventana de 25 h, paginación
// ---------------------------------------------------------------------------

const CRON = { "x-cron-secret": "test-secret" };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

Deno.test("dailyStockReconcile: sin credenciales responde 401", async () => {
  const r = await call(reconcile, new FakeDb(), null, {});
  assertEquals(r.status, 401);
});

Deno.test("dailyStockReconcile: anomalía reciente -> un correo al platform owner", async () => {
  const db = new FakeDb();
  db.seed("Movement", [
    { id: "mBad", business_id: "b1", product_id: "p1", product_name: "<Café>", type: "exit", quantity: 2, stock_applied: false, created_date: hoursAgo(3) },
    { id: "mOk", business_id: "b1", product_id: "p1", type: "exit", quantity: 1, stock_applied: true, created_date: hoursAgo(2) },
  ]);
  const before = db.snapshot();
  const r = await call(reconcile, db, null, { ...CRON });
  assertEquals(r.status, 200);
  assertEquals(r.json.report.unapplied_count, 1);
  assertEquals(r.json.report.email_sent, true);
  assertEquals(r.emails.length, 1);
  assertEquals(r.emails[0].to, "owner@example.com");
  assert(r.emails[0].body.includes("mBad"));
  assert(r.emails[0].body.includes("&lt;Café&gt;"), "el contenido se escapa");
  assertEquals(db.snapshot(), before, "solo lectura");
});

Deno.test("dailyStockReconcile: sin anomalías no envía correo", async () => {
  const db = new FakeDb();
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", stock_applied: true, created_date: hoursAgo(1) }]);
  const r = await call(reconcile, db, null, { ...CRON });
  assertEquals(r.json.report.unapplied_count, 0);
  assertEquals(r.emails.length, 0);
});

Deno.test("dailyStockReconcile: una anomalía de hace 30 h ya no se vuelve a reportar (ventana 25 h)", async () => {
  const db = new FakeDb();
  db.seed("Movement", [{ id: "mOld", business_id: "b1", product_id: "p1", stock_applied: false, created_date: hoursAgo(30) }]);
  const r = await call(reconcile, db, null, { ...CRON });
  assertEquals(r.json.report.unapplied_count, 0);
  assertEquals(r.emails.length, 0);
});

Deno.test("dailyStockReconcile: si falla el correo el job no falla", async () => {
  const db = new FakeDb();
  db.seed("Movement", [{ id: "mBad", business_id: "b1", product_id: "p1", stock_applied: false, created_date: hoursAgo(1) }]);
  const r = await call(reconcile, db, null, { ...CRON }, { failEmail: true });
  assertEquals(r.status, 200);
  assertEquals(r.json.success, true);
  assertEquals(r.json.report.unapplied_count, 1);
  assertEquals(r.json.report.email_sent, false);
});

Deno.test("dailyStockReconcile: ve anomalías más allá de los primeros 2000 movimientos (varios tenants)", async () => {
  const db = new FakeDb();
  const rows: Row[] = [];
  // 2300 movimientos recientes y aplicados; la anomalía es la MÁS ANTIGUA de la ventana.
  for (let i = 0; i < 2300; i++) {
    rows.push({ business_id: "b" + (i % 5), product_id: "p1", stock_applied: true, created_date: hoursAgo(1 + i / 1000) });
  }
  rows.push({ id: "mDeep", business_id: "b9", product_id: "p1", stock_applied: false, created_date: hoursAgo(23) });
  db.seed("Movement", rows);
  const r = await call(reconcile, db, null, { ...CRON });
  assertEquals(r.json.report.unapplied_ids, ["mDeep"]);
  assertEquals(r.json.report.truncated, false);
  assertEquals(r.emails.length, 1);
});

Deno.test("dailyStockReconcile: ventana truncada se marca y se avisa", async () => {
  const db = new FakeDb();
  const rows: Row[] = [];
  for (let i = 0; i < 20_500; i++) {
    rows.push({ business_id: "b1", product_id: "p1", stock_applied: true, created_date: hoursAgo(1 + (i / 20_500) * 20) });
  }
  db.seed("Movement", rows);
  const r = await call(reconcile, db, null, { ...CRON });
  assertEquals(r.json.report.truncated, true);
  assertEquals(r.emails.length, 1);
  assert(r.emails[0].subject.includes("truncada"));
});
