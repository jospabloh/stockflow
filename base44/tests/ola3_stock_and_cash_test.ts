/**
 * Ola 3 — pruebas de caracterización de applyMovementStock y
 * syncCashSaleToPettyCash con un cliente SDK simulado (en memoria).
 *
 * Las MISMAS pruebas corren contra dos variantes del código:
 *   - "old": las funciones independientes base44/functions/<fn>/entry.ts
 *            (Deno.serve).
 *   - "new": los handlers de router (movements/handlers/applyMovementStock.ts
 *            y pettyCash/handlers/syncCashSaleToPettyCash.ts), si existen.
 * Así queda fijado que el movimiento a handlers es verbatim en comportamiento.
 *
 * Cómo se aísla el SDK: el código de producción importa
 * `npm:@base44/sdk@x.y.z`. Aquí se lee el fuente, se reescribe ese import a un
 * módulo falso (data: URL) y se importa dinámicamente. Para las variantes
 * "old", `Deno.serve(` se reemplaza por un captador del handler. No se toca
 * ninguna red ni datos reales.
 *
 * Diferencia de contrato intencional (única): syncCashSaleToPettyCash ya usa
 * el campo `action` para otra cosa (create|reverse|reconcile). Detrás del
 * router, `action` pasa a ser el nombre del handler y la sub-acción viaja en
 * `sync_action`. Las variantes "new" de abajo traducen entre ambos formatos.
 *
 * Run: deno test --allow-env --allow-read base44/tests/ola3_stock_and_cash_test.ts
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// ---------------------------------------------------------------------------
// Base de datos falsa + cliente SDK falso
// ---------------------------------------------------------------------------

class FakeDb {
  tables: Record<string, Row[]> = {};
  seq = 0;
  // Hook para simular una escritura concurrente justo antes de un create.
  beforeCreate: ((table: string, data: Row, db: FakeDb) => void) | null = null;

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
      filter: (q: Row = {}) =>
        Promise.resolve(
          db.rows(table).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r })),
        ),
      list: () => Promise.resolve(db.rows(table).map((r) => ({ ...r }))),
      get: (id: string) => {
        const r = db.rows(table).find((x) => x.id === id);
        return Promise.resolve(r ? { ...r } : null);
      },
      create: (data: Row) => {
        db.beforeCreate?.(table, data, db);
        return Promise.resolve({ ...db.insert(table, data) });
      },
      update: (id: string, patch: Row) => {
        const r = db.rows(table).find((x) => x.id === id);
        if (!r) return Promise.reject(new Error(`${table} ${id} not found`));
        Object.assign(r, patch);
        return Promise.resolve({ ...r });
      },
      delete: (id: string) => {
        const arr = db.rows(table);
        const i = arr.findIndex((x) => x.id === id);
        if (i >= 0) arr.splice(i, 1);
        return Promise.resolve({ success: true });
      },
    };
  }
}

type Ctx = { db: FakeDb; user: Row | null };
// deno-lint-ignore no-explicit-any
const G = globalThis as any;
G.__sf = {
  ctx: null as Ctx | null,
  client() {
    const ctx = this.ctx as Ctx;
    const entities = new Proxy({}, { get: (_t, name: string) => ctx.db.entity(name) });
    return {
      auth: { me: () => (ctx.user ? Promise.resolve(ctx.user) : Promise.reject(new Error("not authenticated"))) },
      asServiceRole: { entities },
    };
  },
};

const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__sf.client(req); }");

// ---------------------------------------------------------------------------
// Carga de variantes
// ---------------------------------------------------------------------------

type Variant = { name: string; call: (body: Row) => Promise<Response> };

async function readSrc(rel: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(new URL(rel, import.meta.url));
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

// Los handlers importan ../../../shared/applyStock.ts (relativo): un data: URL no puede
// resolver rutas relativas, así que se inlinea como otro data: URL.
const SHARED_APPLY_STOCK_URL = "data:application/typescript;base64," +
  btoa(unescape(encodeURIComponent(await Deno.readTextFile(new URL("../shared/applyStock.ts", import.meta.url)))));

async function importRewritten(src: string): Promise<Row> {
  const rewritten = "// @ts-nocheck\n" +
    src
      .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
      .replace(/from\s+['"](?:\.\.\/)+shared\/applyStock\.ts['"]/, `from '${SHARED_APPLY_STOCK_URL}'`)
      .replace("Deno.serve(", "globalThis.__serve(");
  const url = "data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten)));
  return await import(url);
}

async function loadServe(rel: string): Promise<((req: Request) => Promise<Response>) | null> {
  const src = await readSrc(rel);
  if (src === null) return null;
  let captured: ((req: Request) => Promise<Response>) | null = null;
  G.__serve = (h: (req: Request) => Promise<Response>) => {
    captured = h;
  };
  await importRewritten(src);
  return captured;
}

async function loadHandle(rel: string): Promise<((req: Request) => Promise<Response>) | null> {
  const src = await readSrc(rel);
  if (src === null) return null;
  const mod = await importRewritten(src);
  return mod.handle;
}

function asRequest(body: Row) {
  return new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) });
}

const stockVariants: Variant[] = [];
const cashVariants: Variant[] = [];

{
  const oldStock = await loadServe("../functions/applyMovementStock/entry.ts");
  if (oldStock) stockVariants.push({ name: "old", call: (b) => oldStock(asRequest(b)) });
  const newStock = await loadHandle("../functions/movements/handlers/applyMovementStock.ts");
  if (newStock) {
    stockVariants.push({ name: "new", call: (b) => newStock(asRequest({ action: "applyMovementStock", ...b })) });
  }

  const oldCash = await loadServe("../functions/syncCashSaleToPettyCash/entry.ts");
  if (oldCash) cashVariants.push({ name: "old", call: (b) => oldCash(asRequest(b)) });
  const newCash = await loadHandle("../functions/pettyCash/handlers/syncCashSaleToPettyCash.ts");
  if (newCash) {
    cashVariants.push({
      name: "new",
      call: (b) => {
        const { action, ...rest } = b;
        return newCash(asRequest({ ...rest, action: "syncCashSaleToPettyCash", sync_action: action }));
      },
    });
  }
}

Deno.env.set("CRON_SECRET", "test-secret");
const CRON = { "x-cron-secret": "test-secret" };

async function run(v: Variant, db: FakeDb, user: Row | null, body: Row) {
  G.__sf.ctx = { db, user };
  const res = await v.call(body);
  return { status: res.status, json: await res.json() as Row };
}

Deno.test("hay al menos una variante cargada de cada funcion", () => {
  assert(stockVariants.length >= 1, "applyMovementStock: ninguna variante");
  assert(cashVariants.length >= 1, "syncCashSaleToPettyCash: ninguna variante");
});

// ---------------------------------------------------------------------------
// applyMovementStock
// ---------------------------------------------------------------------------

function stockDb(mov: Row, product: Row = { id: "p1", business_id: "b1", stock: 10 }) {
  const db = new FakeDb();
  db.seed("Product", [product]);
  // created_date reciente: un movimiento SIN stock_apply_state y de más de 30 min se considera histórico (no se reaplica).
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", created_date: new Date().toISOString(), ...mov }]);
  return db;
}

for (const v of stockVariants) {
  const T = (name: string, fn: () => Promise<void>) => Deno.test(`[${v.name}] applyMovementStock: ${name}`, fn);

  T("entry suma, marca stock_applied y guarda stock_after", async () => {
    const db = stockDb({ type: "entry", quantity: 5 });
    const r = await run(v, db, null, { movement_id: "m1", business_id: "b1", ...CRON });
    assertEquals(r.status, 200);
    assertEquals(r.json, { success: true, product_id: "p1", new_stock: 15 });
    assertEquals(db.rows("Product")[0].stock, 15);
    assertEquals(db.rows("Movement")[0].stock_applied, true);
    assertEquals(db.rows("Movement")[0].stock_after, 15);
  });

  T("exit resta", async () => {
    const db = stockDb({ type: "exit", quantity: 4 });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.json.new_stock, 6);
    assertEquals(db.rows("Product")[0].stock, 6);
    assertEquals(db.rows("Movement")[0].stock_after, 6);
  });

  T("return (devolucion) resta, igual que exit", async () => {
    const db = stockDb({ type: "return", quantity: 3 });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.json.new_stock, 7);
  });

  T("adjustment fija el stock de forma ABSOLUTA", async () => {
    const db = stockDb({ type: "adjustment", quantity: 42 });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.json.new_stock, 42);
    assertEquals(db.rows("Product")[0].stock, 42);
  });

  T("el stock nunca baja de 0", async () => {
    const db = stockDb({ type: "exit", quantity: 99 });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.json.new_stock, 0);
    assertEquals(db.rows("Product")[0].stock, 0);
    assertEquals(db.rows("Movement")[0].stock_after, 0);
  });

  T("idempotencia: segunda invocacion no vuelve a aplicar", async () => {
    const db = stockDb({ type: "exit", quantity: 4 });
    await run(v, db, null, { movement_id: "m1", ...CRON });
    const r2 = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r2.status, 200);
    assertEquals(r2.json, { success: true, already_applied: true, product_id: "p1" });
    assertEquals(db.rows("Product")[0].stock, 6);
  });

  T("movimiento con stock_applied=true de origen no toca el producto", async () => {
    const db = stockDb({ type: "entry", quantity: 5, stock_applied: true });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.json.already_applied, true);
    assertEquals(db.rows("Product")[0].stock, 10);
  });

  T("movement_id es obligatorio (400)", async () => {
    const r = await run(v, stockDb({ type: "entry", quantity: 1 }), null, { ...CRON });
    assertEquals(r.status, 400);
  });

  T("sin CRON_SECRET ni usuario: 401", async () => {
    const db = stockDb({ type: "entry", quantity: 1 });
    const r = await run(v, db, null, { movement_id: "m1" });
    assertEquals(r.status, 401);
    assertEquals(db.rows("Product")[0].stock, 10);
  });

  T("usuario sin business_id: 403 (ya no es service-role)", async () => {
    const db = stockDb({ type: "entry", quantity: 1 });
    const r = await run(v, db, { id: "u1", email: "a@b.c" }, { movement_id: "m1" });
    assertEquals(r.status, 403);
    assertEquals(db.rows("Product")[0].stock, 10);
  });

  T("usuario de otro tenant: 403 y no cambia stock", async () => {
    const db = stockDb({ type: "entry", quantity: 1 });
    const r = await run(v, db, { id: "u1", business_id: "b2" }, { movement_id: "m1" });
    assertEquals(r.status, 403);
    assertEquals(db.rows("Product")[0].stock, 10);
    assertEquals(db.rows("Movement")[0].stock_applied, undefined);
  });

  T("usuario de su propio tenant: permitido", async () => {
    const db = stockDb({ type: "entry", quantity: 1 });
    const r = await run(v, db, { id: "u1", business_id: "b1" }, { movement_id: "m1" });
    assertEquals(r.status, 200);
    assertEquals(db.rows("Product")[0].stock, 11);
  });

  T("business_id del body distinto al del movimiento: 403 (incluso con CRON)", async () => {
    const db = stockDb({ type: "entry", quantity: 1 });
    const r = await run(v, db, null, { movement_id: "m1", business_id: "otro", ...CRON });
    assertEquals(r.status, 403);
    assertEquals(db.rows("Product")[0].stock, 10);
  });

  T("movimiento inexistente: 404", async () => {
    const r = await run(v, stockDb({ type: "entry", quantity: 1 }), null, { movement_id: "nope", ...CRON });
    assertEquals(r.status, 404);
  });

  T("movimiento sin product_id: skipped", async () => {
    const db = stockDb({ type: "entry", quantity: 1, product_id: undefined });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.json, { success: true, skipped: "no product_id" });
  });

  T("producto inexistente: 404", async () => {
    const db = stockDb({ type: "entry", quantity: 1, product_id: "ghost" });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.status, 404);
  });

  T("producto de otro tenant que el movimiento: 403, sin cambios", async () => {
    const db = stockDb({ type: "entry", quantity: 1 }, { id: "p1", business_id: "b9", stock: 10 });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.status, 403);
    assertEquals(db.rows("Product")[0].stock, 10);
    assertEquals(db.rows("Movement")[0].stock_applied, undefined);
  });

  T("tipo desconocido: 400 y no marca stock_applied", async () => {
    const db = stockDb({ type: "weird", quantity: 1 });
    const r = await run(v, db, null, { movement_id: "m1", ...CRON });
    assertEquals(r.status, 400);
    assertEquals(db.rows("Product")[0].stock, 10);
    assertEquals(db.rows("Movement")[0].stock_applied, undefined);
  });
}

// ---------------------------------------------------------------------------
// syncCashSaleToPettyCash
// ---------------------------------------------------------------------------

const RULE = { id: "rule1", business_id: "b1", rule_key: "cash_sales_to_petty_cash", enabled: true, archived: false, config_json: {} };

function cashDb(opts: { rule?: Row | null; petty?: Row[] } = {}) {
  const db = new FakeDb();
  db.seed("Movement", [{ id: "m1", business_id: "b1", type: "exit" }]);
  db.seed("Quotation", [{ id: "q1", business_id: "b1" }]);
  if (opts.rule !== null) db.seed("TenantRule", [opts.rule ?? { ...RULE }]);
  db.seed("PettyCashMovement", opts.petty ?? []);
  return db;
}

const SALE = {
  action: "reconcile",
  origin_type: "movement",
  origin_id: "m1",
  amount: 100,
  payment_method: "Efectivo",
  description: "Venta directa",
  folio_or_ref: "F-1",
  movement_date: "2026-10-01",
  business_id: "b1",
  ...CRON,
};

const generated = (id: string, extra: Row = {}) => ({
  id, business_id: "b1", origin_id: "m1", origin_type: "movement", generated_by_system: true,
  movement_type: "income", amount: 100, payment_method_snapshot: "Efectivo", ...extra,
});

for (const v of cashVariants) {
  const T = (name: string, fn: () => Promise<void>) => Deno.test(`[${v.name}] syncCashSaleToPettyCash: ${name}`, fn);

  T("venta en efectivo con regla activa crea ingreso en caja chica", async () => {
    const db = cashDb();
    const r = await run(v, db, null, SALE);
    assertEquals(r.status, 200);
    assertEquals(r.json.success, true);
    assertEquals(r.json.created, true);
    const rows = db.rows("PettyCashMovement");
    assertEquals(rows.length, 1);
    assertEquals(rows[0].movement_type, "income");
    assertEquals(rows[0].amount, 100);
    assertEquals(rows[0].category, "Venta efectivo");
    assertEquals(rows[0].generated_by_system, true);
    assertEquals(rows[0].origin_id, "m1");
    assertEquals(rows[0].payment_method_snapshot, "Efectivo");
    assert(db.rows("TenantRule")[0].last_applied_at, "actualiza last_applied_at");
    assertEquals(r.json.petty_cash_id, rows[0].id);
  });

  T("anti-duplicados: reconciliar 2 veces actualiza, no duplica", async () => {
    const db = cashDb();
    await run(v, db, null, SALE);
    const r2 = await run(v, db, null, { ...SALE, amount: 150 });
    assertEquals(r2.json.updated, true);
    assertEquals(db.rows("PettyCashMovement").length, 1);
    assertEquals(db.rows("PettyCashMovement")[0].amount, 150);
  });

  T("anti-duplicados: duplicados previos se eliminan (prevent_duplicates)", async () => {
    const db = cashDb({ petty: [generated("pc1"), generated("pc2"), generated("pc3")] });
    const r = await run(v, db, null, SALE);
    assertEquals(r.json.updated, true);
    assertEquals(db.rows("PettyCashMovement").map((x) => x.id), ["pc1"]);
  });

  T("condicion de carrera: un duplicado concurrente queda neutralizado (monto 0), no borrado", async () => {
    const db = cashDb();
    let injected = false;
    db.beforeCreate = (table, _data, d) => {
      if (table === "PettyCashMovement" && !injected) {
        injected = true;
        d.insert("PettyCashMovement", generated("rival", { amount: 100 }));
      }
    };
    const r = await run(v, db, null, SALE);
    assertEquals(r.json.success, true);
    const rows = db.rows("PettyCashMovement");
    assertEquals(rows.length, 2);
    const survivor = rows.find((x) => x.id === "rival")!;
    const loser = rows.find((x) => x.id !== "rival")!;
    assertEquals(survivor.amount, 100);
    assertEquals(loser.amount, 0);
    assert(String(loser.notes).includes("[duplicado neutralizado"));
    assertEquals(r.json.created, false);
    assertEquals(r.json.updated, true);
    assertEquals(r.json.petty_cash_id, "rival");
  });

  T("cambio de forma de pago a no-efectivo REVIERTE la entrada existente", async () => {
    const db = cashDb({ petty: [generated("pc1")] });
    const r = await run(v, db, null, { ...SALE, payment_method: "Tarjeta" });
    assertEquals(r.json, { success: true, reversed: true, reason: "reversed" });
    assertEquals(db.rows("PettyCashMovement").length, 0);
  });

  T("pago no-efectivo sin entrada previa: no crea nada (no_record_found)", async () => {
    const db = cashDb();
    const r = await run(v, db, null, { ...SALE, payment_method: "Tarjeta" });
    assertEquals(r.json, { success: true, reversed: false, reason: "no_record_found" });
    assertEquals(db.rows("PettyCashMovement").length, 0);
  });

  T("sin reverse_on_payment_method_change, no-efectivo solo se omite", async () => {
    const db = cashDb({ rule: { ...RULE, config_json: { reverse_on_payment_method_change: false } }, petty: [generated("pc1")] });
    const r = await run(v, db, null, { ...SALE, payment_method: "Tarjeta" });
    assertEquals(r.json, { success: true, skipped: true, reason: "payment_method_not_allowed" });
    assertEquals(db.rows("PettyCashMovement").length, 1);
  });

  T("action=reverse borra las entradas generadas del origen (no las manuales)", async () => {
    const db = cashDb({ petty: [generated("pc1"), { id: "manual", business_id: "b1", origin_id: "m1", generated_by_system: false }] });
    const r = await run(v, db, null, { action: "reverse", origin_type: "movement", origin_id: "m1", business_id: "b1", ...CRON });
    assertEquals(r.json, { success: true, reversed: true, reason: "reversed" });
    assertEquals(db.rows("PettyCashMovement").map((x) => x.id), ["manual"]);
  });

  T("action=reverse sin registros: no_record_found", async () => {
    const r = await run(v, cashDb(), null, { action: "reverse", origin_type: "movement", origin_id: "m1", business_id: "b1", ...CRON });
    assertEquals(r.json, { success: true, reversed: false, reason: "no_record_found" });
  });

  T("action desconocida se trata como reconcile", async () => {
    const db = cashDb();
    const r = await run(v, db, null, { ...SALE, action: "lo-que-sea" });
    assertEquals(r.json.created, true);
  });

  T("regla desactivada: borra generadas y omite", async () => {
    const db = cashDb({ rule: { ...RULE, enabled: false }, petty: [generated("pc1")] });
    const r = await run(v, db, null, SALE);
    assertEquals(r.json, { success: true, skipped: true, reason: "rule_disabled", reversed: true });
    assertEquals(db.rows("PettyCashMovement").length, 0);
  });

  T("sin regla: se comporta como desactivada", async () => {
    const db = cashDb({ rule: null });
    const r = await run(v, db, null, SALE);
    assertEquals(r.json.reason, "rule_disabled");
    assertEquals(db.rows("PettyCashMovement").length, 0);
  });

  T("origen no permitido por la regla: source_not_allowed", async () => {
    const db = cashDb({ rule: { ...RULE, config_json: { sources: ["quotation"] } } });
    const r = await run(v, db, null, SALE);
    assertEquals(r.json, { success: true, skipped: true, reason: "source_not_allowed" });
  });

  T("cotizacion como origen tambien funciona", async () => {
    const db = cashDb();
    const r = await run(v, db, null, { ...SALE, origin_type: "quotation", origin_id: "q1" });
    assertEquals(r.json.created, true);
    assertEquals(db.rows("PettyCashMovement")[0].origin_type, "quotation");
  });

  T("movement_date obligatorio al crear (400)", async () => {
    const r = await run(v, cashDb(), null, { ...SALE, movement_date: undefined });
    assertEquals(r.status, 400);
  });

  T("sin business_id: 400", async () => {
    const r = await run(v, cashDb(), null, { ...SALE, business_id: undefined });
    assertEquals(r.status, 400);
  });

  T("sin origin_id: 400", async () => {
    const r = await run(v, cashDb(), null, { ...SALE, origin_id: undefined });
    assertEquals(r.status, 400);
  });

  T("sin CRON_SECRET ni usuario: 401", async () => {
    const r = await run(v, cashDb(), null, { ...SALE, "x-cron-secret": undefined });
    assertEquals(r.status, 401);
  });

  T("usuario de otro negocio: 403", async () => {
    const db = cashDb();
    const r = await run(v, db, { id: "u1", business_id: "b2" }, { ...SALE, "x-cron-secret": undefined });
    assertEquals(r.status, 403);
    assertEquals(db.rows("PettyCashMovement").length, 0);
  });

  T("usuario del mismo negocio: permitido", async () => {
    const db = cashDb();
    const r = await run(v, db, { id: "u1", business_id: "b1" }, { ...SALE, "x-cron-secret": undefined });
    assertEquals(r.json.created, true);
  });

  T("origen de otro tenant que el business_id del body: 403 (incluso con CRON)", async () => {
    const db = cashDb();
    const r = await run(v, db, null, { ...SALE, business_id: "b2" });
    assertEquals(r.status, 403);
    assertEquals(db.rows("PettyCashMovement").length, 0);
  });

  T("origen inexistente (p.ej. reverse tras borrar): continua el flujo", async () => {
    const db = cashDb({ petty: [generated("pc1", { origin_id: "gone" })] });
    const r = await run(v, db, null, { action: "reverse", origin_type: "movement", origin_id: "gone", business_id: "b1", ...CRON });
    assertEquals(r.json.reversed, true);
    assertEquals(db.rows("PettyCashMovement").length, 0);
  });
}

// ---------------------------------------------------------------------------
// Cableado de routers (verificacion estatica del indice de handlers)
// ---------------------------------------------------------------------------

Deno.test("routers registran los handlers de la ola 3 (solo si ya existen los archivos)", async () => {
  const checks: Array<[string, string, string]> = [
    ["../functions/movements/handlers/applyMovementStock.ts", "../functions/movements/handlers/index.ts", "applyMovementStock"],
    ["../functions/pettyCash/handlers/syncCashSaleToPettyCash.ts", "../functions/pettyCash/handlers/index.ts", "syncCashSaleToPettyCash"],
    ["../functions/permissions/handlers/upgradeOwnerToAdmin.ts", "../functions/permissions/handlers/index.ts", "upgradeOwnerToAdmin"],
    ["../functions/permissions/handlers/restoreOwnerAdmin.ts", "../functions/permissions/handlers/index.ts", "restoreOwnerAdmin"],
  ];
  for (const [file, index, action] of checks) {
    if ((await readSrc(file)) === null) continue;
    const idx = (await readSrc(index))!;
    assert(idx.includes(`import { handle as ${action} }`), `${index} importa ${action}`);
    assert(new RegExp(`\\b${action}\\b`).test(idx.split("HANDLERS")[1] ?? ""), `${index} registra ${action}`);
  }
});
