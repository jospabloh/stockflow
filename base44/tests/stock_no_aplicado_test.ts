/**
 * Fix "stock-no-aplicado" (incidente Baristop, sep-2026).
 *
 * Ejecuta los handlers REALES (applyMovementStock, createMovementSafe,
 * convertQuotationSafe, registerOnDemandArrivalSafe, dailyStockReconcile y
 * shared/applyStock.ts) contra una base en memoria con inyección de fallos
 * (simula el 429/5xx/timeout de plataforma entre las dos escrituras).
 *
 * Cómo se aísla el SDK: cada fuente se importa como data: URL con el import
 * `npm:@base44/sdk@x` reescrito a un módulo falso (sin escribir a disco).
 *
 * Estas pruebas FALLAN con el código anterior (el error se tragaba, el
 * movimiento quedaba con stock_applied=false sin aviso, y un movimiento
 * histórico sin marca podía reaplicarse).
 *
 * Run (mismos flags que CI): deno test --allow-env --allow-read base44/tests/stock_no_aplicado_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

Deno.env.set("CRON_SECRET", "test-secret");
Deno.env.set("STOCK_APPLY_RETRY_MS", "0");

// ---------------------------------------------------------------- fake DB
class FakeDb {
  tables: Record<string, Row[]> = {};
  seq = 0;
  /** Simula un esquema sin desplegar: la plataforma descarta en silencio estos campos. */
  dropFields: string[] = [];
  /** Se invoca antes de cada escritura; lanzar para simular fallo. */
  fault: ((table: string, op: string, id: string | null, data: Row) => void) | null = null;
  seed(table: string, rows: Row[]) {
    for (const r of rows) this.insert(table, r);
  }
  insert(table: string, data: Row): Row {
    this.seq++;
    const row = { id: data.id ?? `${table}-${this.seq}`, created_date: new Date().toISOString(), ...data };
    (this.tables[table] ??= []).push(row);
    return row;
  }
  rows(table: string) {
    return this.tables[table] ?? [];
  }
  get(table: string, id: string) {
    return this.rows(table).find((r) => r.id === id)!;
  }
  entity(table: string) {
    // deno-lint-ignore no-this-alias
    const db = this;
    return {
      filter: (q: Row = {}) =>
        Promise.resolve(db.rows(table).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
      list: () => Promise.resolve(db.rows(table).map((r) => ({ ...r }))),
      get: (id: string) => {
        const r = db.rows(table).find((x) => x.id === id);
        return Promise.resolve(r ? { ...r } : null);
      },
      create: (data: Row) => {
        try {
          db.fault?.(table, "create", null, data);
        } catch (e) {
          return Promise.reject(e);
        }
        return Promise.resolve({ ...db.insert(table, data) });
      },
      update: (id: string, patch: Row) => {
        try {
          db.fault?.(table, "update", id, patch);
        } catch (e) {
          return Promise.reject(e);
        }
        const r = db.rows(table).find((x) => x.id === id);
        if (!r) return Promise.reject(new Error(`${table} ${id} not found`));
        for (const k of db.dropFields) delete patch[k];
        Object.assign(r, patch);
        r.updated_date = new Date().toISOString();
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

function httpErr(status: number, msg = "platform error") {
  return Object.assign(new Error(msg), { response: { status, data: { error: msg } } });
}

// ---------------------------------------------------------------- loader
// Sin escribir a disco (CI corre `deno test --allow-env --allow-read`): cada fuente se importa
// como data: URL con el SDK reemplazado por un módulo falso; los imports relativos
// (shared/applyStock.ts, ./_permissions.ts) se inlinean también como data: URL.
const b64 = (src: string) => "data:application/typescript;base64," + btoa(unescape(encodeURIComponent(src)));
const MOCK_SDK_URL = b64("export function createClientFromRequest(req) { return globalThis.__sf.client(req); }");
const readSrc = (rel: string) => Deno.readTextFile(new URL(`../${rel}`, import.meta.url));
const SHARED_URL = b64("// @ts-nocheck\n" + await readSrc("shared/applyStock.ts"));
const permsUrls: Record<string, string> = {};
for (const dir of ["movements", "quotations"]) {
  permsUrls[dir] = b64("// @ts-nocheck\n" + await readSrc(`functions/${dir}/handlers/_permissions.ts`));
}
const VALIDATION_URL = b64("// @ts-nocheck\n" + await readSrc("functions/movements/handlers/_validation.ts"));
const load = async (rel: string) => {
  const dir = rel.split("/")[1];
  const src = "// @ts-nocheck\n" + (await readSrc(rel))
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
    .replace(/from\s+['"](?:\.\.\/)+shared\/applyStock\.ts['"]/, `from '${SHARED_URL}'`)
    .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${permsUrls[dir]}'`)
    .replace(/from\s+['"]\.\/_validation\.ts['"]/, `from '${VALIDATION_URL}'`);
  return (await import(b64(src))).handle as (r: Request) => Promise<Response>;
};

const apply = await load("functions/movements/handlers/applyMovementStock.ts");
const createMov = await load("functions/movements/handlers/createMovementSafe.ts");
const convert = await load("functions/quotations/handlers/convertQuotationSafe.ts");
const onDemand = await load("functions/quotations/handlers/registerOnDemandArrivalSafe.ts");
const deleteMov = await load("functions/movements/handlers/deleteMovementSafe.ts");
const reconcile = await load("functions/jobs/handlers/dailyStockReconcile.ts");

type Ctx = { db: FakeDb; user: Row | null };
G.__sf = {
  ctx: null as Ctx | null,
  client() {
    const ctx = this.ctx as Ctx;
    const entities = new Proxy({}, { get: (_t, name: string) => ctx.db.entity(name) });
    return {
      auth: { me: () => (ctx.user ? Promise.resolve(ctx.user) : Promise.reject(new Error("not authenticated"))) },
      asServiceRole: {
        entities,
        functions: {
          // Simula functions.invoke: enruta 'movements' al handler real y lanza como axios en status >= 400.
          invoke: async (name: string, body: Row) => {
            if (name === "pettyCash") return { data: { success: true } };
            assertEquals(name, "movements");
            const res = await apply(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) }));
            const data = await res.json();
            if (res.status >= 400) throw Object.assign(new Error(`Request failed with status code ${res.status}`), { response: { status: res.status, data } });
            return { data };
          },
        },
      },
    };
  },
};

const req = (body: Row) => new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) });
const CRON = { "x-cron-secret": "test-secret" };
const owner = { id: "u1", role: "owner", business_id: "b1", email: "o@x.com" };

function baseDb(stock = 10) {
  const db = new FakeDb();
  db.seed("Business", [{ id: "b1", billing_status: "active" }]);
  db.seed("Product", [{ id: "p1", business_id: "b1", name: "Cafe", stock, purchase_price: 5 }]);
  return db;
}
async function run(db: FakeDb, user: Row | null, fn: (r: Request) => Promise<Response>, body: Row) {
  G.__sf.ctx = { db, user };
  const res = await fn(req(body));
  return { status: res.status, json: await res.json() as Row };
}

// ------------------------------------------------------------------ tests
Deno.test("applyMovementStock: falla la marca final -> 500 product_written:true; el reintento NO duplica", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 1 }]);
  db.fault = (t, op, _id, d) => {
    if (t === "Movement" && op === "update" && d.stock_applied === true) throw httpErr(503);
  };
  const r1 = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r1.status, 500);
  assertEquals(r1.json.product_written, true);
  assertEquals(db.get("Product", "p1").stock, 9); // el stock SÍ cambió
  assertEquals(db.get("Movement", "m1").stock_applied, undefined);
  assertEquals(db.get("Movement", "m1").stock_apply_state, "pending");
  assertEquals(db.get("Movement", "m1").stock_before, 10);

  db.fault = null; // la plataforma se recupera
  const r2 = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r2.status, 200);
  assertEquals(db.get("Product", "p1").stock, 9); // NO se descontó dos veces
  assertEquals(db.get("Movement", "m1").stock_applied, true);
  assertEquals(db.get("Movement", "m1").stock_apply_state, "applied");
  assertEquals(db.get("Movement", "m1").stock_after, 9);
});

Deno.test("applyMovementStock: un 429 transitorio en cada escritura se reintenta y aplica UNA vez", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "entry", quantity: 5 }]);
  const seen: Record<string, number> = {};
  db.fault = (t, op, _id, d) => {
    const key = `${t}:${op}:${d.stock_applied ?? d.stock ?? d.stock_apply_state}`;
    seen[key] = (seen[key] ?? 0) + 1;
    if (seen[key] === 1) throw httpErr(429, "rate limited");
  };
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 15);
  assertEquals(db.get("Movement", "m1").stock_applied, true);
});

Deno.test("applyMovementStock: si falla la marca 'pending' no toca el producto", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 1 }]);
  db.fault = (t, op) => {
    if (t === "Movement" && op === "update") throw httpErr(500);
  };
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 500);
  assertEquals(r.json.product_written, false);
  assertEquals(db.get("Product", "p1").stock, 10);
});

Deno.test("applyMovementStock: movimiento HISTÓRICO sin estado y sin marca NO se reaplica (caso Baristop)", async () => {
  const db = baseDb(11); // el stock ya refleja el descuento
  db.seed("Movement", [{
    id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 1,
    stock_applied: false, created_date: "2026-09-09T17:06:33.000Z", updated_date: "2026-09-09T17:06:33.000Z",
  }]);
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 409);
  assertEquals(r.json.needs_review, true);
  assertEquals(db.get("Product", "p1").stock, 11);
  assertEquals(db.get("Movement", "m1").stock_applied, false); // dato pasado intacto
  assertEquals(db.get("Movement", "m1").stock_apply_state, undefined);
});

Deno.test("applyMovementStock: 'pending' con stock distinto al esperado -> 409 needs_review sin tocar nada", async () => {
  const db = baseDb(7); // otro movimiento cambió el stock entre medias
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 1, stock_apply_state: "failed", stock_before: 10 }]);
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 409);
  assertEquals(db.get("Product", "p1").stock, 7);
  assertEquals(db.get("Movement", "m1").stock_applied, undefined);
});

Deno.test("applyMovementStock: 'failed' con producto sin escribir (stock == stock_before) se aplica", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 2, stock_apply_state: "failed", stock_before: 10 }]);
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 8);
  assertEquals(db.get("Movement", "m1").stock_applied, true);
});

Deno.test("applyMovementStock: escritura concurrente entre la marca pending y Product.update NO se pisa (lost-update)", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 1 }]);
  let injected = false;
  db.fault = (t, op, _id, d) => {
    // otra venta (-3) aterriza justo cuando se escribe la marca pending
    if (!injected && t === "Movement" && op === "update" && d.stock_apply_state === "pending") {
      injected = true;
      db.get("Product", "p1").stock = 7;
    }
  };
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 6); // 7 (concurrente) - 1; antes habría quedado en 9
  assertEquals(db.get("Movement", "m1").stock_before, 7);
  assertEquals(db.get("Movement", "m1").stock_after, 6);
  assertEquals(db.get("Movement", "m1").stock_applied, true);
});

Deno.test("applyMovementStock: Product.update con timeout que SÍ escribió -> el reintento no duplica", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 1 }]);
  let n = 0, writes = 0;
  db.fault = (t, op, _id, d) => {
    if (t === "Product" && op === "update") {
      writes++;
      if (++n === 1) {
        db.get("Product", "p1").stock = d.stock; // la plataforma escribió...
        throw httpErr(504, "timeout"); // ...pero respondió timeout
      }
    }
  };
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 200);
  assertEquals(writes, 1); // no se reescribió
  assertEquals(db.get("Product", "p1").stock, 9);
  assertEquals(db.get("Movement", "m1").stock_applied, true);
});

Deno.test("applyMovementStock: timeout que escribió + cambio de un tercero antes del reintento -> 409 needs_review, sin sobrescribir", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 1 }]);
  let n = 0;
  db.fault = (t, op, _id, d) => {
    if (t === "Product" && op === "update" && ++n === 1) {
      db.get("Product", "p1").stock = d.stock; // escribió (9)
      db.get("Product", "p1").stock = 5; // y un tercero movió el stock antes del reintento
      throw httpErr(504, "timeout");
    }
  };
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 409);
  assertEquals(r.json.needs_review, true);
  assertEquals(db.get("Product", "p1").stock, 5); // no se pisó
  assertEquals(db.get("Movement", "m1").stock_applied, undefined);
});

Deno.test("applyMovementStock: Product.update falla transitorio SIN escribir y el stock sigue igual -> se reintenta y aplica una vez", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{ id: "m1", business_id: "b1", product_id: "p1", type: "exit", quantity: 1 }]);
  let n = 0;
  db.fault = (t, op) => {
    if (t === "Product" && op === "update" && ++n === 1) throw httpErr(503);
  };
  const r = await run(db, null, apply, { movement_id: "m1", ...CRON });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 9);
});

Deno.test("createMovementSafe: si falla aplicar el stock ya NO hay éxito silencioso (stock_warning + alerta + estado failed)", async () => {
  const db = baseDb(10);
  db.fault = (t, op, _id, d) => {
    if (t === "Movement" && op === "update" && d.stock_applied === true) throw httpErr(503);
  };
  const r = await run(db, owner, createMov, {
    product_id: "p1", product_name: "Cafe", type: "entry", quantity: 3, unit_price: 1, total: 3, business_id: "b1", paid: true,
  });
  assertEquals(r.status, 200);
  assert(r.json.stock_warning, "debe devolver stock_warning");
  assertEquals(r.json.stock_warning.failures.length, 1);
  const mov = db.rows("Movement")[0];
  assertEquals(mov.stock_apply_state, "failed");
  assert(String(mov.stock_apply_error).length > 0);
  const alerts = db.rows("InventoryAuditLog");
  assertEquals(alerts.length, 1);
  assertEquals(alerts[0].event_type, "stock_apply_failed");
  assertEquals(alerts[0].business_id, "b1");
  assertEquals(db.get("Product", "p1").stock, 13); // el stock quedó aplicado una sola vez
});

Deno.test("createMovementSafe: camino feliz no devuelve warning y aplica una vez", async () => {
  const db = baseDb(10);
  const r = await run(db, owner, createMov, {
    product_id: "p1", product_name: "Cafe", type: "exit", quantity: 4, unit_price: 1, total: 4, business_id: "b1", paid: false,
  });
  assertEquals(r.status, 200);
  assertEquals(r.json.stock_warning, undefined);
  assertEquals(db.get("Product", "p1").stock, 6);
  assertEquals(db.rows("Movement")[0].stock_applied, true);
  assertEquals(db.rows("InventoryAuditLog").length, 0);
});

Deno.test("convertQuotationSafe: un item que falla no aborta ni se oculta; avisa y deja alerta", async () => {
  const db = baseDb(10);
  db.seed("Product", [{ id: "p2", business_id: "b1", name: "Te", stock: 10, purchase_price: 2 }]);
  db.seed("Quotation", [{
    id: "q1", business_id: "b1", folio: "COT-1", client_name: "C", total: 30, status: "sent",
    items: [
      { product_id: "p1", product_name: "Cafe", quantity: 1, unit_price: 10, total: 10 },
      { product_id: "p2", product_name: "Te", quantity: 2, unit_price: 10, total: 20 },
    ],
  }]);
  db.fault = (t, op, id, d) => {
    if (t === "Movement" && op === "update" && d.stock_applied === true && db.get("Movement", id!).product_id === "p2") throw httpErr(503);
  };
  const r = await run(db, owner, convert, { quotation_id: "q1", payment_method: "Efectivo" });
  assertEquals(r.status, 200);
  assertEquals(r.json.success, true);
  assertEquals(r.json.stock_warning.failures.length, 1);
  assertEquals(r.json.stock_warning.failures[0].product_name, "Te");
  assertEquals(db.get("Quotation", "q1").status, "converted");
  assertEquals(db.get("Product", "p1").stock, 9);
  assertEquals(db.get("Product", "p2").stock, 8);
  assertEquals(db.rows("InventoryAuditLog").length, 1);
});

Deno.test("registerOnDemandArrivalSafe: ya no deja stock_applied=true con el stock sin escribir", async () => {
  const db = baseDb(10);
  db.seed("Quotation", [{
    id: "q1", business_id: "b1", folio: "COT-1", status: "sent",
    items: [{ product_id: "p1", product_name: "Cafe", quantity: 3, unit_price: 10, total: 30, is_on_demand: true, on_demand_status: "pending" }],
  }]);
  db.fault = (t, op, _id, d) => {
    if (t === "Product" && op === "update") throw httpErr(503); // el producto no se puede escribir
  };
  const r = await run(db, owner, onDemand, { quotation_id: "q1", item_index: 0, quantity_received: 3 });
  assertEquals(r.status, 200);
  assert(r.json.stock_warning, "debe avisar");
  const mov = db.rows("Movement")[0];
  assert(mov.stock_applied !== true, "no debe marcarse aplicado si el producto no se escribió");
  assertEquals(db.get("Product", "p1").stock, 10);
  assertEquals(db.rows("InventoryAuditLog").length, 1);
});

Deno.test("dailyStockReconcile: NO sana nada (solo alerta una vez) y no toca datos ni stock", async () => {
  const db = baseDb(9);
  const old = new Date(Date.now() - 3 * 3600_000).toISOString();
  db.seed("Movement", [
    // fallo reciente con producto ya escrito (10 -> 9): ya NO se marca automáticamente, se reporta
    { id: "mA", business_id: "b1", product_id: "p1", type: "exit", quantity: 1, stock_apply_state: "failed", stock_before: 10, created_date: old },
    // sin estado y sin marca, fuera del periodo de gracia: no se corrige, se alerta
    { id: "mB", business_id: "b1", product_id: "p1", type: "exit", quantity: 1, stock_applied: false, created_date: old },
  ]);
  const r1 = await run(db, null, reconcile, { ...CRON });
  assertEquals(r1.status, 200);
  assertEquals(db.get("Movement", "mA").stock_applied, undefined); // intacto
  assertEquals(db.get("Movement", "mA").stock_apply_state, "failed");
  assertEquals(db.get("Product", "p1").stock, 9);
  assertEquals(db.get("Movement", "mB").stock_applied, false);
  assertEquals(r1.json.report.healed_ids, []);
  assertEquals([...r1.json.report.unapplied_ids].sort(), ["mA", "mB"]);
  assertEquals(db.rows("InventoryAuditLog").length, 2);
  const r2 = await run(db, null, reconcile, { ...CRON });
  assertEquals(r2.status, 200);
  assertEquals(db.rows("InventoryAuditLog").length, 2); // sin alertas duplicadas
  assertEquals(db.get("Product", "p1").stock, 9);
});

Deno.test("reconcile no puede reaplicar movimientos fuera de la ventana (los 4 de Baristop)", async () => {
  const db = baseDb(11);
  db.seed("Movement", [{ id: "mOld", business_id: "b1", product_id: "p1", type: "exit", quantity: 1, stock_applied: false, created_date: "2026-09-09T17:06:33.000Z" }]);
  const r = await run(db, null, reconcile, { ...CRON });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 11);
  assertEquals(db.get("Movement", "mOld").stock_applied, false);
  assertEquals(db.rows("InventoryAuditLog").length, 0);
});

Deno.test("modo degradado (esquema sin desplegar: la plataforma descarta stock_apply_state): NO reintenta a ciegas ni duplica", async () => {
  const db = baseDb(10);
  db.dropFields = ["stock_apply_state", "stock_before", "stock_apply_error"];
  db.fault = (t, op, _id, d) => {
    if (t === "Movement" && op === "update" && d.stock_applied === true) throw httpErr(503);
  };
  const r = await run(db, owner, createMov, {
    product_id: "p1", product_name: "Cafe", type: "entry", quantity: 3, unit_price: 1, total: 3, business_id: "b1", paid: true,
  });
  assertEquals(r.status, 200);
  assert(r.json.stock_warning, "debe avisar aunque no haya estado persistido");
  assertEquals(db.get("Product", "p1").stock, 13); // exactamente UNA aplicación
  assert(db.rows("Movement")[0].stock_applied !== true);
  // el reconcile no reintenta (no hay estado): solo alerta, y no cambia el stock
  db.fault = null;
  const old = new Date(Date.now() - 3 * 3600_000).toISOString();
  db.rows("Movement")[0].created_date = old;
  const rc = await run(db, null, reconcile, { ...CRON });
  assertEquals(rc.status, 200);
  assertEquals(db.get("Product", "p1").stock, 13);
});

// ----------------------------------------------------------- regresión ABA
const HOURS_AGO = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

Deno.test("ABA (ya escrito): exit x2 escrito 10->8 con marca final fallida; luego entry +2 (8->10); la recuperación NO duplica -> 409 needs_review", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{
    id: "mSale", business_id: "b1", product_id: "p1", type: "exit", quantity: 2,
    stock_apply_state: "failed", stock_before: 10, created_date: HOURS_AGO(5), stock_pending_at: HOURS_AGO(5),
  }]);
  db.get("Product", "p1").stock = 8; // la venta sí se escribió
  // entrada legítima posterior (+2) que devuelve el stock a 10 = stock_before
  const entry = db.insert("Movement", {
    id: "mEntry", business_id: "b1", product_id: "p1", type: "entry", quantity: 2,
    stock_applied: true, stock_apply_state: "applied", stock_before: 8, stock_after: 10, created_date: HOURS_AGO(1),
  });
  entry.updated_date = HOURS_AGO(1);
  db.get("Product", "p1").stock = 10;
  const r = await run(db, null, apply, { movement_id: "mSale", ...CRON });
  assertEquals(r.status, 409);
  assertEquals(r.json.needs_review, true);
  assertEquals(db.get("Product", "p1").stock, 10); // no se descontó otra vez
  assertEquals(db.get("Movement", "mSale").stock_applied, undefined);
  // y el reconcile tampoco lo sana
  const rc = await run(db, null, reconcile, { ...CRON });
  assertEquals(rc.json.report.healed_ids, []);
  assertEquals(db.get("Product", "p1").stock, 10);
  assertEquals(db.get("Movement", "mSale").stock_applied, undefined);
});

Deno.test("ABA (marca en falso): movimiento nunca escrito, el stock coincide por casualidad con el esperado tras otros movimientos -> NO se marca aplicado", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{
    id: "mLost", business_id: "b1", product_id: "p1", type: "exit", quantity: 2,
    stock_apply_state: "failed", stock_before: 10, created_date: HOURS_AGO(5), stock_pending_at: HOURS_AGO(5),
  }]);
  // nunca se escribió; otros movimientos llevaron el stock 10 -> 12 -> 8 (== esperado de mLost)
  for (const [id, before, after] of [["mX", 10, 12], ["mY", 12, 8]] as const) {
    const m = db.insert("Movement", { id, business_id: "b1", product_id: "p1", type: "entry", quantity: 1, stock_applied: true, stock_apply_state: "applied", stock_before: before, stock_after: after, created_date: HOURS_AGO(2) });
    m.updated_date = HOURS_AGO(2);
  }
  db.get("Product", "p1").stock = 8;
  const r = await run(db, null, apply, { movement_id: "mLost", ...CRON });
  assertEquals(r.status, 409);
  assertEquals(r.json.needs_review, true);
  assertEquals(db.get("Movement", "mLost").stock_applied, undefined); // no se marcó en falso
  assertEquals(db.get("Product", "p1").stock, 8);
});

Deno.test("ABA (producto editado por un tercero sin Movement): stock == stock_before pero el producto cambió después de la marca -> 409", async () => {
  const db = baseDb(10);
  db.seed("Movement", [{
    id: "mLost", business_id: "b1", product_id: "p1", type: "exit", quantity: 2,
    stock_apply_state: "failed", stock_before: 10, created_date: HOURS_AGO(5), stock_pending_at: HOURS_AGO(5),
  }]);
  db.get("Product", "p1").updated_date = HOURS_AGO(1); // edición manual posterior que dejó 10 otra vez
  const r = await run(db, null, apply, { movement_id: "mLost", ...CRON });
  assertEquals(r.status, 409);
  assertEquals(db.get("Product", "p1").stock, 10);
  assertEquals(db.get("Movement", "mLost").stock_applied, undefined);
});

Deno.test("recuperación segura: ya escrito y sin otros movimientos posteriores -> solo pone la marca (no duplica)", async () => {
  const db = baseDb(8); // 10 -> 8 ya escrito
  db.seed("Movement", [{
    id: "mSale", business_id: "b1", product_id: "p1", type: "exit", quantity: 2,
    stock_apply_state: "failed", stock_before: 10, created_date: HOURS_AGO(1), stock_pending_at: HOURS_AGO(1),
  }]);
  const r = await run(db, null, apply, { movement_id: "mSale", ...CRON });
  assertEquals(r.status, 200);
  assertEquals(r.json.recovered, true);
  assertEquals(db.get("Product", "p1").stock, 8);
  assertEquals(db.get("Movement", "mSale").stock_applied, true);
});

Deno.test("deleteMovementSafe: movimiento failed/pending sin confirmar -> 409 needs_review, no borra ni revierte stock", async () => {
  for (const state of ["failed", "pending"]) {
    const db = baseDb(10); // el producto NUNCA se escribió: sigue en 10
    db.seed("Movement", [{
      id: "mBad", business_id: "b1", product_id: "p1", type: "exit", quantity: 2,
      stock_apply_state: state, stock_applied: false, stock_before: 10,
    }]);
    const r = await run(db, owner, deleteMov, { movement_id: "mBad" });
    assertEquals(r.status, 409);
    assertEquals(r.json.needs_review, true);
    assertEquals(db.get("Product", "p1").stock, 10); // sin +2 espurio
    assertEquals(db.rows("Movement").length, 1);
  }
});

Deno.test("deleteMovementSafe: sin estado (los 4 de Baristop, stock_applied=false pero stock SÍ cambió) conserva el comportamiento actual", async () => {
  const db = baseDb(8); // exit x2 sí se aplicó (10 -> 8)
  db.seed("Movement", [{
    id: "mOld", business_id: "b1", product_id: "p1", type: "exit", quantity: 2, stock_applied: false,
  }]);
  const r = await run(db, owner, deleteMov, { movement_id: "mOld" });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 10);
  assertEquals(db.rows("Movement").length, 0);
});

Deno.test("deleteMovementSafe: estado 'failed' pero stock_applied=true (confirmado) se revierte normalmente", async () => {
  const db = baseDb(8);
  db.seed("Movement", [{
    id: "mOk", business_id: "b1", product_id: "p1", type: "exit", quantity: 2,
    stock_apply_state: "failed", stock_applied: true,
  }]);
  const r = await run(db, owner, deleteMov, { movement_id: "mOk" });
  assertEquals(r.status, 200);
  assertEquals(db.get("Product", "p1").stock, 10);
});

// ---- Incidente real Baristop 2026-10-01: Movement creado y Product.update nunca ocurre ----
Deno.test("INCIDENTE: entrada x10 con Product.update fallando siempre -> stock intacto, Movement failed, stock_warning en español y alerta (nunca éxito silencioso)", async () => {
  const db = baseDb(10);
  db.fault = (t, op) => {
    if (t === "Product" && op === "update") throw httpErr(503);
  };
  const r = await run(db, owner, createMov, {
    product_id: "p1", product_name: "Tisana Ixil Fresa/Kiwi", type: "entry", quantity: 10, unit_price: 1, total: 10, business_id: "b1", paid: false,
  });
  assertEquals(r.status, 200);
  assert(r.json.stock_warning, "no debe haber éxito silencioso");
  assert(/stock/i.test(String(r.json.stock_warning.message)), "aviso en español que menciona el stock");
  assertEquals(r.json.stock_warning.failures.length, 1);
  assertEquals(db.get("Product", "p1").stock, 10, "el producto no se tocó");
  const mov = db.rows("Movement")[0];
  assert(mov.stock_applied !== true);
  assertEquals(mov.stock_apply_state, "failed");
  const alerts = db.rows("InventoryAuditLog");
  assertEquals(alerts.length, 1);
  assertEquals(alerts[0].event_type, "stock_apply_failed");
  // la conciliación diaria lo reporta (y no lo toca)
  const rec = await run(db, null, reconcile, { ...CRON });
  assertEquals(rec.status, 200);
});

Deno.test("INCIDENTE: Product.update falla 1 vez y luego funciona -> el stock se aplica con reintento, sin aviso", async () => {
  const db = baseDb(10);
  let n = 0;
  db.fault = (t, op) => {
    if (t === "Product" && op === "update" && ++n === 1) throw httpErr(503);
  };
  const r = await run(db, owner, createMov, {
    product_id: "p1", product_name: "Tisana Ixil Fresa/Kiwi", type: "entry", quantity: 10, unit_price: 1, total: 10, business_id: "b1", paid: false,
  });
  assertEquals(r.status, 200);
  assertEquals(r.json.stock_warning, undefined);
  assertEquals(db.get("Product", "p1").stock, 20);
  assertEquals(db.rows("Movement")[0].stock_applied, true);
});
