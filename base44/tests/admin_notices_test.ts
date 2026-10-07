/**
 * Avisos al administrador por borrados de un no-admin (decision de JP 2026-10-05):
 * el almacenista con el permiso granular SI puede borrar proveedores, clientes y contactos,
 * pero cada borrado deja un AdminNotice que el owner/admin ve y marca como leido.
 *
 * Intencion que fijan estas pruebas:
 *  - FALLA CERRADA: nunca existe un borrado de no-admin sin su aviso (si el aviso no se puede
 *    crear, el registro NO se borra).
 *  - Quitar la compuerta por rol no abre nada que el perfil no conceda.
 *  - Los avisos solo los ven/marcan owner/admin del MISMO negocio; el almacenista nunca.
 *
 * Usa los handlers REALES con un cliente SDK simulado en memoria (la plataforma responde con
 * la forma de siempre). No toca red ni datos reales.
 *
 * Run: deno test -A base44/tests/admin_notices_test.ts
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

class FakeDb {
  tables: Record<string, Row[]> = {};
  faults = new Set<string>();
  // Borrado ambiguo: la plataforma LO APLICA pero la llamada rechaza (respuesta perdida / timeout).
  ambiguousDeletes = new Set<string>();
  // Tras un borrado ambiguo, las lecturas de esa tabla fallan (no se puede comprobar).
  filterFaultsAfterDelete = new Set<string>();
  deleted = new Set<string>();
  // Gancho tras servir una lectura (simula a otro admin escribiendo en paralelo).
  onFilter: ((table: string, n: number) => void) | null = null;
  filterCalls: Record<string, number> = {};
  // Gancho tras aplicar un update (simula una escritura concurrente posterior a la nuestra).
  onUpdate: ((table: string, id: string, n: number) => void) | null = null;
  updateCalls: Record<string, number> = {};
  seq = 0;
  seed(table: string, rows: Row[]) {
    (this.tables[table] ??= []).push(...rows.map((r) => ({ ...r })));
  }
  rows(table: string) {
    return this.tables[table] ?? [];
  }
  fault(table: string, op: string) {
    this.faults.add(`${table}.${op}`);
  }
  private check(table: string, op: string) {
    if (this.faults.has(`${table}.${op}`)) return Promise.reject(new Error(`boom ${table}.${op}`));
    return null;
  }
  entity(table: string) {
    // deno-lint-ignore no-this-alias
    const db = this;
    return {
      filter: (q: Row = {}, _sort?: string, limit?: number, skip?: number) => {
        if (db.deleted.has(table) && db.filterFaultsAfterDelete.has(table)) return Promise.reject(new Error(`boom ${table}.filter tras borrar`));
        const failed = db.check(table, "filter");
        if (failed) return failed;
        const out = db.rows(table).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v))
          .slice(skip ?? 0, (skip ?? 0) + (limit ?? 1000)).map((r) => ({ ...r }));
        const n = db.filterCalls[table] = (db.filterCalls[table] ?? 0) + 1;
        db.onFilter?.(table, n);
        return Promise.resolve(out);
      },
      create: (row: Row) =>
        db.check(table, "create") ?? (() => {
          const created = { id: `${table}-${++db.seq}`, created_date: new Date().toISOString(), ...row };
          (db.tables[table] ??= []).push(created);
          return Promise.resolve({ ...created });
        })(),
      update: (id: string, patch: Row) =>
        db.check(table, "update") ?? (() => {
          const r = db.rows(table).find((x) => x.id === id);
          if (!r) return Promise.reject(new Error(`${table} ${id} not found`));
          Object.assign(r, patch);
          const n = db.updateCalls[table] = (db.updateCalls[table] ?? 0) + 1;
          db.onUpdate?.(table, id, n);
          return Promise.resolve({ ...r });
        })(),
      delete: (id: string) =>
        db.check(table, "delete") ?? (() => {
          db.tables[table] = db.rows(table).filter((x) => x.id !== id);
          db.deleted.add(table);
          if (db.ambiguousDeletes.has(table)) return Promise.reject(new Error(`timeout ${table}.delete (aplicado)`));
          return Promise.resolve({});
        })(),
    };
  }
}

type Ctx = { db: FakeDb; user: Row | null };
G.__sf = {
  ctx: null as Ctx | null,
  client() {
    const ctx = this.ctx as Ctx;
    const entities = new Proxy({}, { get: (_t, name: string) => ctx.db.entity(name) });
    return {
      auth: { me: () => Promise.resolve(ctx.user) },
      entities,
      asServiceRole: { entities },
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
      .replace(/from\s+['"](?:\.\.\/)+shared\/(\w+)\.ts['"]/g, (_m, f) => `from '${new URL(`../shared/${f}.ts`, import.meta.url).href}'`)
      .replace(/from\s+'\.\/(\w+\.ts)'/g, (_m, f) => `from '${new URL(f, abs).href}'`);
  const file = `${tmp}/${rel.replace(/\W/g, "_")}.ts`;
  await Deno.writeTextFile(file, rewritten);
  const mod = await import(`file://${file}?${Math.random()}`);
  return mod.handle;
}

const deleteSupplier = await loadHandle("base44/functions/suppliers/handlers/deleteSupplierSafe.ts");
const deleteClient = await loadHandle("base44/functions/clients/handlers/deleteClientSafe.ts");
const deleteContact = await loadHandle("base44/functions/contacts/handlers/deleteContactSafe.ts");
const updateSupplier = await loadHandle("base44/functions/suppliers/handlers/updateSupplierSafe.ts");
const listNotices = await loadHandle("base44/functions/business/handlers/listAdminNotices.ts");
const markRead = await loadHandle("base44/functions/business/handlers/markAdminNoticeReadSafe.ts");

async function call(h: (r: Request) => Promise<Response>, db: FakeDb, user: Row | null, body: Row) {
  G.__sf.ctx = { db, user } as Ctx;
  const res = await h(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() as Row };
}

const OWNER = { id: "u1", email: "dueno@b1.com", role: "owner", business_id: "b1" };
const OWNER_B2 = { id: "u9", email: "dueno@b2.com", role: "owner", business_id: "b2" };
const ALM = { id: "u2", email: "ventas.baristop@gmail.com", full_name: "Ventas Baristop", role: "almacenista", business_id: "b1" };

// Perfil real de Baristop: borrar proveedores/clientes/contactos en true; movimientos delete/adjustment en false.
const BARISTOP_PROFILE: Record<string, boolean> = {
  "Proveedores:delete": true,
  "Clientes:delete": true,
  "Contactos:delete": true,
  "Movimientos:delete": false,
  "Movimientos:adjustment": false,
};

function baseDb(profile?: Record<string, boolean>) {
  const db = new FakeDb();
  db.seed("Business", [{ id: "b1", billing_status: "active" }]);
  db.seed("Supplier", [{ id: "s1", business_id: "b1", name: "Proveedor Uno", phone: "555", email: "p@x.com" }]);
  db.seed("Client", [{ id: "c1", business_id: "b1", name: "Cliente Uno", business_name: "CliCo" }]);
  db.seed("Contact", [{ id: "k1", business_id: "b1", name: "Contacto Uno" }]);
  if (profile) db.seed("PermissionProfile", [{ business_id: "b1", role_key: "almacenista", permissions: profile }]);
  return db;
}

const DELETES = [
  { name: "deleteSupplierSafe", h: deleteSupplier, body: { supplier_id: "s1" }, table: "Supplier", type: "Supplier", id: "s1", label: "Proveedor Uno", key: "Proveedores:delete" },
  { name: "deleteClientSafe", h: deleteClient, body: { client_id: "c1" }, table: "Client", type: "Client", id: "c1", label: "Cliente Uno", key: "Clientes:delete" },
  { name: "deleteContactSafe", h: deleteContact, body: { contact_id: "k1" }, table: "Contact", type: "Contact", id: "k1", label: "Contacto Uno", key: "Contactos:delete" },
];

for (const d of DELETES) {
  Deno.test(`${d.name}: almacenista con el perfil real de Baristop borra y deja un aviso con copia del registro (decision 3 de JP)`, async () => {
    const db = baseDb(BARISTOP_PROFILE);
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 200);
    assertEquals(r.json.notice_created, true);
    assertEquals(db.rows(d.table).length, 0);
    const notices = db.rows("AdminNotice");
    assertEquals(notices.length, 1);
    const n = notices[0];
    assertEquals(n.business_id, "b1");
    assertEquals(n.kind, "directory_delete");
    assertEquals(n.entity_type, d.type);
    assertEquals(n.record_id, d.id);
    assertEquals(n.record_label, d.label);
    assertEquals(n.record_snapshot.name, d.label);
    assertEquals(n.performed_by_email, "ventas.baristop@gmail.com");
    assertEquals(n.performed_by_id, "u2");
    assertEquals(n.status, "unread");
    assert(!Number.isNaN(new Date(n.performed_at).getTime()), "performed_at es una fecha");
  });

  Deno.test(`${d.name}: FALLA CERRADA, si el aviso no se puede crear NO se borra (503) y no queda aviso`, async () => {
    const db = baseDb(BARISTOP_PROFILE);
    db.fault("AdminNotice", "create");
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 503);
    assertEquals(r.json.notice_failed, true);
    assert(String(r.json.error).includes("NO se eliminó"));
    assertEquals(db.rows(d.table).length, 1);
    assertEquals(db.rows("AdminNotice").length, 0);
  });

  Deno.test(`${d.name}: si el borrado falla despues de crear el aviso, el aviso se compensa (500, registro sigue)`, async () => {
    const db = baseDb(BARISTOP_PROFILE);
    db.fault(d.table, "delete");
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 500);
    assertEquals(db.rows(d.table).length, 1);
    assertEquals(db.rows("AdminNotice").length, 0);
  });

  Deno.test(`${d.name}: si ademas falla la compensacion queda 1 aviso residual sobre un registro NO borrado (nunca al reves)`, async () => {
    const db = baseDb(BARISTOP_PROFILE);
    db.fault(d.table, "delete");
    db.fault("AdminNotice", "delete");
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 500);
    assertEquals(db.rows(d.table).length, 1);
    assertEquals(db.rows("AdminNotice").length, 1);
  });

  Deno.test(`${d.name}: borrado AMBIGUO (rechaza pero se aplico): el registro ya no existe, el aviso SE CONSERVA y responde exito (Codex #472 P2)`, async () => {
    const db = baseDb(BARISTOP_PROFILE);
    db.ambiguousDeletes.add(d.table);
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 200);
    assertEquals(r.json.success, true);
    assertEquals(r.json.delete_confirmed_by_recheck, true);
    assertEquals(db.rows(d.table).length, 0);
    assertEquals(db.rows("AdminNotice").length, 1);
    assertEquals(db.rows("AdminNotice")[0].status, "unread");
  });

  Deno.test(`${d.name}: borrado fallido y NO se puede comprobar el registro: el aviso se conserva (nunca borrado sin aviso)`, async () => {
    const db = baseDb(BARISTOP_PROFILE);
    db.ambiguousDeletes.add(d.table);
    db.filterFaultsAfterDelete.add(d.table);
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 500);
    assertEquals(db.rows(d.table).length, 0);
    assertEquals(db.rows("AdminNotice").length, 1);
  });

  Deno.test(`${d.name}: el owner con borrado AMBIGUO (se aplico pero rechaza) tambien se resuelve por relectura: exito, sin aviso (Codex #479 P2)`, async () => {
    const db = baseDb();
    db.ambiguousDeletes.add(d.table);
    const r = await call(d.h, db, OWNER, d.body);
    assertEquals(r.status, 200);
    assertEquals(r.json.success, true);
    assertEquals(r.json.notice_created, false);
    assertEquals(r.json.delete_confirmed_by_recheck, true);
    assertEquals(db.rows("AdminNotice").length, 0);
  });

  Deno.test(`${d.name}: el owner con borrado fallido de verdad (el registro sigue) recibe 500`, async () => {
    const db = baseDb();
    db.fault(d.table, "delete");
    const r = await call(d.h, db, OWNER, d.body);
    assertEquals(r.status, 500);
    assertEquals(db.rows(d.table).length, 1);
  });

  Deno.test(`${d.name}: el owner borra sin aviso (notice_created false) aunque la entidad de avisos falle`, async () => {
    const db = baseDb(BARISTOP_PROFILE);
    db.fault("AdminNotice", "create");
    const r = await call(d.h, db, OWNER, d.body);
    assertEquals(r.status, 200);
    assertEquals(r.json.notice_created, false);
    assertEquals(db.rows(d.table).length, 0);
    assertEquals(db.rows("AdminNotice").length, 0);
  });

  // Decision de JP 2026-10-05 (4bfdf78): sin perfil el almacenista hereda el default, que ya
  // permite borrar (con aviso). Lo que sigue bloqueando es una clave explicita en false.
  Deno.test(`${d.name}: almacenista con la clave en false sigue en 403 y sin aviso`, async () => {
    const db = baseDb({ [d.key]: false });
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 403);
    assertEquals(db.rows(d.table).length, 1);
    assertEquals(db.rows("AdminNotice").length, 0);
  });

  Deno.test(`${d.name}: otro tenant sigue bloqueado y no deja aviso`, async () => {
    const db = baseDb(BARISTOP_PROFILE);
    const r = await call(d.h, db, { ...ALM, business_id: "b2" }, d.body);
    assertEquals(r.status, 403);
    assertEquals(db.rows(d.table).length, 1);
    assertEquals(db.rows("AdminNotice").length, 0);
  });
}

Deno.test("bloqueos previos ganan al aviso: proveedor con productos (409), cliente con cotizaciones (409), view_only (403): 0 avisos", async () => {
  const db1 = baseDb(BARISTOP_PROFILE);
  db1.seed("Product", [{ id: "p1", business_id: "b1", supplier: "s1" }]);
  const r1 = await call(deleteSupplier, db1, ALM, { supplier_id: "s1" });
  assertEquals(r1.status, 409);
  assertEquals(db1.rows("Supplier").length, 1);
  assertEquals(db1.rows("AdminNotice").length, 0);

  const db2 = baseDb(BARISTOP_PROFILE);
  db2.seed("Quotation", [{ id: "q1", business_id: "b1", client_id: "c1" }]);
  const r2 = await call(deleteClient, db2, ALM, { client_id: "c1" });
  assertEquals(r2.status, 409);
  assertEquals(db2.rows("Client").length, 1);
  assertEquals(db2.rows("AdminNotice").length, 0);

  const db3 = baseDb(BARISTOP_PROFILE);
  db3.tables["Business"][0].billing_status = "view_only";
  const r3 = await call(deleteContact, db3, ALM, { contact_id: "k1" });
  assertEquals(r3.status, 403);
  assertEquals(r3.json.error, "write_blocked");
  assertEquals(db3.rows("Contact").length, 1);
  assertEquals(db3.rows("AdminNotice").length, 0);
});

Deno.test("updateSupplierSafe NO cambia: almacenista con todas las claves en true sigue en 403 (editar proveedor no fue decidido)", async () => {
  const db = baseDb({ ...BARISTOP_PROFILE, "Proveedores:edit_name": true, "Proveedores:edit_notes": true });
  const r = await call(updateSupplier, db, ALM, { supplier_id: "s1", updates: { name: "Nuevo" } });
  assertEquals(r.status, 403);
  assertEquals(db.rows("Supplier")[0].name, "Proveedor Uno");
});

// ---- listAdminNotices ---------------------------------------------------------

function noticesDb() {
  const db = baseDb(BARISTOP_PROFILE);
  db.seed("AdminNotice", [
    { id: "n1", business_id: "b1", status: "unread", entity_type: "Supplier", record_label: "A" },
    { id: "n2", business_id: "b1", status: "read", entity_type: "Client", record_label: "B", read_by_email: "dueno@b1.com" },
    { id: "n3", business_id: "b2", status: "unread", entity_type: "Contact", record_label: "OTRO NEGOCIO" },
  ]);
  return db;
}

Deno.test("listAdminNotices: el owner ve SOLO los avisos de su negocio (no los de otro tenant)", async () => {
  const r = await call(listNotices, noticesDb(), OWNER, {});
  assertEquals(r.status, 200);
  assertEquals(r.json.notices.map((n: Row) => n.id), ["n1"]);
  assertEquals(r.json.unread_count, 1);
});

Deno.test("listAdminNotices: status 'all' incluye leidos y unread_count cuenta solo los no leidos", async () => {
  const r = await call(listNotices, noticesDb(), OWNER, { status: "all" });
  assertEquals(r.json.notices.map((n: Row) => n.id).sort(), ["n1", "n2"]);
  assertEquals(r.json.unread_count, 1);
});

Deno.test("listAdminNotices: el almacenista NO puede leer avisos (403) aunque su perfil traiga claves en true", async () => {
  const r = await call(listNotices, noticesDb(), ALM, {});
  assertEquals(r.status, 403);
  assertEquals(r.json.notices, undefined);
});

Deno.test("listAdminNotices: sin sesion 401; el tenant sale del usuario, no del cuerpo", async () => {
  assertEquals((await call(listNotices, noticesDb(), null, {})).status, 401);
  const r = await call(listNotices, noticesDb(), OWNER_B2, { business_id: "b1" });
  assertEquals(r.json.notices.map((n: Row) => n.id), ["n3"]);
});

Deno.test("listAdminNotices: un negocio view_only igual puede ver sus avisos (sin gate de licencia)", async () => {
  const db = noticesDb();
  db.tables["Business"][0].billing_status = "view_only";
  assertEquals((await call(listNotices, db, OWNER, {})).status, 200);
});

Deno.test("listAdminNotices: unread_count es el total REAL aunque pasen de una pagina (Codex #472 P2)", async () => {
  const db = baseDb();
  const rows: Row[] = [];
  for (let i = 0; i < 450; i++) rows.push({ id: `m${i}`, business_id: "b1", kind: "directory_delete", status: "unread", created_date: "2026-10-05T00:00:00Z" });
  for (let i = 0; i < 7; i++) rows.push({ id: `r${i}`, business_id: "b1", kind: "directory_delete", status: "read", created_date: "2026-10-04T00:00:00Z" });
  rows.push({ id: "otro", business_id: "b2", kind: "directory_delete", status: "unread" });
  db.seed("AdminNotice", rows);
  const unread = await call(listNotices, db, OWNER, {});
  assertEquals(unread.json.notices.length, 200, "la lista sigue acotada a una pagina");
  assertEquals(unread.json.unread_count, 450);
  const all = await call(listNotices, db, OWNER, { status: "all" });
  assertEquals(all.json.unread_count, 450);
  // multiplo exacto de la pagina: no debe quedarse corto ni ciclar
  const db2 = baseDb();
  db2.seed("AdminNotice", Array.from({ length: 400 }, (_, i) => ({ id: `e${i}`, business_id: "b1", status: "unread" })));
  assertEquals((await call(listNotices, db2, OWNER, {})).json.unread_count, 400);
  assertEquals((await call(listNotices, db2, OWNER, {})).json.unread_count_truncated, undefined);
});

Deno.test("listAdminNotices: si se agota el tope de paginas lo declara (unread_count_truncated), no lo presenta como total real (Codex #479 P2)", async () => {
  const db = baseDb();
  // filtro simulado: cada pagina viene siempre llena, sin fin
  db.tables["AdminNotice"] = [];
  const full = (_q: Row = {}, _s?: string, limit?: number) => Promise.resolve(Array.from({ length: limit ?? 200 }, (_, i) => ({ id: `x${i}`, business_id: "b1", status: "unread" })));
  const orig = db.entity.bind(db);
  db.entity = (table: string) => table === "AdminNotice" ? { ...orig(table), filter: full } : orig(table);
  const r = await call(listNotices, db, OWNER, {});
  assertEquals(r.json.unread_count, 200 * 1000);
  assertEquals(r.json.unread_count_truncated, true);
});

// ---- markAdminNoticeReadSafe --------------------------------------------------

Deno.test("markAdminNoticeReadSafe: el owner marca leido y queda registrado quien y cuando", async () => {
  const db = noticesDb();
  const r = await call(markRead, db, OWNER, { notice_id: "n1" });
  assertEquals(r.status, 200);
  assertEquals(r.json.success, true);
  const n = db.rows("AdminNotice").find((x) => x.id === "n1")!;
  assertEquals(n.status, "read");
  assertEquals(n.read_by_id, "u1");
  assertEquals(n.read_by_email, "dueno@b1.com");
  assert(!Number.isNaN(new Date(n.read_at).getTime()), "read_at es una fecha");
  assertEquals(db.rows("AdminNotice").length, 3, "los avisos nunca se borran");
});

Deno.test("markAdminNoticeReadSafe: idempotente, un segundo acuse no sobrescribe a quien lo leyo primero", async () => {
  const db = noticesDb();
  await call(markRead, db, OWNER, { notice_id: "n1" });
  const other = { ...OWNER, id: "u5", email: "otro-admin@b1.com", role: "admin" };
  const r = await call(markRead, db, other, { notice_id: "n1" });
  assertEquals(r.status, 200);
  assertEquals(r.json.already_read, true);
  assertEquals(db.rows("AdminNotice").find((x) => x.id === "n1")!.read_by_email, "dueno@b1.com");
});

Deno.test("markAdminNoticeReadSafe: si otro admin acusa entre la primera lectura y la escritura, NO se sobrescribe (relectura previa) (Codex #472 P2)", async () => {
  const db = noticesDb();
  db.onFilter = (table, n) => {
    // justo despues de la 1a lectura del aviso, otro admin lo acusa
    if (table === "AdminNotice" && n === 1) {
      Object.assign(db.rows("AdminNotice").find((x) => x.id === "n1")!, { status: "read", read_by_id: "u7", read_by_email: "primero@b1.com", read_at: "2026-10-06T10:00:00.000Z" });
    }
  };
  const r = await call(markRead, db, OWNER, { notice_id: "n1" });
  assertEquals(r.status, 200);
  assertEquals(r.json.already_read, true);
  assertEquals(db.updateCalls["AdminNotice"] ?? 0, 0, "no escribio");
  assertEquals(db.rows("AdminNotice").find((x) => x.id === "n1")!.read_by_email, "primero@b1.com");
});

Deno.test("markAdminNoticeReadSafe: si una escritura posterior de otro admin pisa la nuestra, se restituye al PRIMER lector (verificacion posterior)", async () => {
  const db = noticesDb();
  db.onUpdate = (table, id, n) => {
    // tras nuestro primer update, otro admin escribe un acuse POSTERIOR (read_at mayor) encima
    if (table === "AdminNotice" && id === "n1" && n === 1) {
      Object.assign(db.rows("AdminNotice").find((x) => x.id === "n1")!, { status: "read", read_by_id: "u7", read_by_email: "despues@b1.com", read_at: "2999-01-01T00:00:00.000Z" });
    }
  };
  const r = await call(markRead, db, OWNER, { notice_id: "n1" });
  assertEquals(r.status, 200);
  const n = db.rows("AdminNotice").find((x) => x.id === "n1")!;
  assertEquals(n.read_by_email, "dueno@b1.com", "queda el primer lector");
  assertEquals(db.updateCalls["AdminNotice"], 2);
});

Deno.test("markAdminNoticeReadSafe: si el otro acuse que quedo guardado es ANTERIOR al nuestro, se respeta y no se reescribe", async () => {
  const db = noticesDb();
  db.onUpdate = (table, id, n) => {
    if (table === "AdminNotice" && id === "n1" && n === 1) {
      Object.assign(db.rows("AdminNotice").find((x) => x.id === "n1")!, { status: "read", read_by_id: "u7", read_by_email: "antes@b1.com", read_at: "2000-01-01T00:00:00.000Z" });
    }
  };
  const r = await call(markRead, db, OWNER, { notice_id: "n1" });
  assertEquals(r.json.already_read, true);
  assertEquals(db.rows("AdminNotice").find((x) => x.id === "n1")!.read_by_email, "antes@b1.com");
  assertEquals(db.updateCalls["AdminNotice"], 1);
});

Deno.test("markAdminNoticeReadSafe: aviso de otro negocio responde 404 y no se toca", async () => {
  const db = noticesDb();
  const r = await call(markRead, db, OWNER, { notice_id: "n3" });
  assertEquals(r.status, 404);
  assertEquals(db.rows("AdminNotice").find((x) => x.id === "n3")!.status, "unread");
  assertEquals((await call(markRead, db, OWNER, { notice_id: "no-existe" })).status, 404);
});

Deno.test("markAdminNoticeReadSafe: almacenista 403 (no puede marcar), sin notice_id 400, sin sesion 401", async () => {
  const db = noticesDb();
  assertEquals((await call(markRead, db, ALM, { notice_id: "n1" })).status, 403);
  assertEquals(db.rows("AdminNotice").find((x) => x.id === "n1")!.status, "unread");
  assertEquals((await call(markRead, db, OWNER, {})).status, 400);
  assertEquals((await call(markRead, db, null, { notice_id: "n1" })).status, 401);
});

Deno.test("integracion: el almacenista borra, el admin lo ve sin leer, lo marca y sigue en el historial", async () => {
  const db = baseDb(BARISTOP_PROFILE);
  await call(deleteSupplier, db, ALM, { supplier_id: "s1" });
  const unread = await call(listNotices, db, OWNER, {});
  assertEquals(unread.json.unread_count, 1);
  assertEquals(unread.json.notices[0].record_snapshot.name, "Proveedor Uno");
  await call(markRead, db, OWNER, { notice_id: unread.json.notices[0].id });
  assertEquals((await call(listNotices, db, OWNER, {})).json.unread_count, 0);
  assertEquals((await call(listNotices, db, OWNER, { status: "all" })).json.notices.length, 1);
});
