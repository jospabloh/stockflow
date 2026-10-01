/**
 * Proveedores / Clientes / Contactos: las acciones de editar y borrar deben aplicar el
 * permiso granular del registry (Proveedores:edit_*, Proveedores:delete, Clientes:delete,
 * Contactos:delete) y no solo el rol admin/owner. Antes updateSupplierSafe,
 * deleteSupplierSafe, deleteClientSafe y deleteContactSafe cortaban con
 * `role !== admin/owner` y nunca llamaban hasPermission, a diferencia de los create/update
 * hermanos.
 *
 * Usa los handlers REALES con un cliente SDK simulado en memoria. No toca red ni datos reales.
 *
 * Run: deno test -A base44/tests/directory_permissions_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

class FakeDb {
  tables: Record<string, Row[]> = {};
  seed(table: string, rows: Row[]) {
    (this.tables[table] ??= []).push(...rows.map((r) => ({ ...r })));
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
      .replace(/from\s+'\.\/(\w+\.ts)'/g, (_m, f) => `from '${new URL(f, abs).href}'`);
  const file = `${tmp}/${rel.replace(/\W/g, "_")}.ts`;
  await Deno.writeTextFile(file, rewritten);
  const mod = await import(`file://${file}?${Math.random()}`);
  return mod.handle;
}

const updateSupplier = await loadHandle("base44/functions/suppliers/handlers/updateSupplierSafe.ts");
const deleteSupplier = await loadHandle("base44/functions/suppliers/handlers/deleteSupplierSafe.ts");
const deleteClient = await loadHandle("base44/functions/clients/handlers/deleteClientSafe.ts");
const deleteContact = await loadHandle("base44/functions/contacts/handlers/deleteContactSafe.ts");

async function call(h: (r: Request) => Promise<Response>, db: FakeDb, user: Row | null, body: Row) {
  G.__sf.ctx = { db, user } as Ctx;
  const res = await h(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() as Row };
}

const OWNER = { id: "u1", email: "dueno@b1.com", role: "owner", business_id: "b1" };
const ALM = { id: "u2", email: "alm@b1.com", role: "almacenista", business_id: "b1" };
const OTHER_ROLE = { id: "u3", email: "x@b1.com", role: "user", business_id: "b1" };

function baseDb(profile?: Record<string, boolean>) {
  const db = new FakeDb();
  db.seed("Business", [{ id: "b1", billing_status: "active" }]);
  db.seed("Supplier", [{ id: "s1", business_id: "b1", name: "Prov", contact_name: "C", email: "a@b.c", phone: "1", address: "A", rfc: "R", notes: "N" }]);
  db.seed("Client", [{ id: "c1", business_id: "b1", name: "Cli", business_name: "CliCo", phone: "1" }]);
  db.seed("Contact", [{ id: "k1", business_id: "b1", name: "Con" }]);
  if (profile) db.seed("PermissionProfile", [{ business_id: "b1", role_key: "almacenista", permissions: profile }]);
  return db;
}

// ---- deletes -------------------------------------------------------------

const DELETES = [
  { name: "deleteSupplierSafe", h: deleteSupplier, body: { supplier_id: "s1" }, table: "Supplier", key: "Proveedores:delete" },
  { name: "deleteClientSafe", h: deleteClient, body: { client_id: "c1" }, table: "Client", key: "Clientes:delete" },
  { name: "deleteContactSafe", h: deleteContact, body: { contact_id: "k1" }, table: "Contact", key: "Contactos:delete" },
];

for (const d of DELETES) {
  Deno.test(`${d.name}: almacenista con el permiso ${d.key} denegado en su perfil NO borra`, async () => {
    const db = baseDb({ [d.key]: false });
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 403);
    assertEquals(r.json.permission, d.key);
    assertEquals(db.rows(d.table).length, 1);
  });

  Deno.test(`${d.name}: almacenista con ${d.key} concedido SI borra`, async () => {
    const db = baseDb({ [d.key]: true });
    const r = await call(d.h, db, ALM, d.body);
    assertEquals(r.status, 200);
    assertEquals(r.json.success, true);
    assertEquals(db.rows(d.table).length, 0);
  });

  Deno.test(`${d.name}: rol sin perfil ni defaults no borra`, async () => {
    const db = baseDb();
    const r = await call(d.h, db, OTHER_ROLE, d.body);
    assertEquals(r.status, 403);
    assertEquals(db.rows(d.table).length, 1);
  });

  Deno.test(`${d.name}: owner sigue pudiendo borrar aunque el perfil lo niegue`, async () => {
    const db = baseDb({ [d.key]: false });
    const r = await call(d.h, db, OWNER, d.body);
    assertEquals(r.status, 200);
    assertEquals(db.rows(d.table).length, 0);
  });

  Deno.test(`${d.name}: sin sesion -> 401`, async () => {
    const r = await call(d.h, baseDb(), null, d.body);
    assertEquals(r.status, 401);
  });
}

Deno.test("deleteSupplierSafe: otro tenant sigue bloqueado aunque tenga el permiso", async () => {
  const db = baseDb({ "Proveedores:delete": true });
  const r = await call(deleteSupplier, db, { ...ALM, business_id: "b2" }, { supplier_id: "s1" });
  assertEquals(r.status, 403);
  assertEquals(db.rows("Supplier").length, 1);
});

Deno.test("deleteContactSafe: write_blocked se mantiene para tenants view_only", async () => {
  const db = baseDb({ "Contactos:delete": true });
  db.tables["Business"][0].billing_status = "view_only";
  const r = await call(deleteContact, db, ALM, { contact_id: "k1" });
  assertEquals(r.status, 403);
  assertEquals(r.json.error, "write_blocked");
  assertEquals(db.rows("Contact").length, 1);
});

// ---- updateSupplierSafe --------------------------------------------------

Deno.test("updateSupplierSafe: almacenista sin Proveedores:edit_name no puede renombrar", async () => {
  const db = baseDb({ "Proveedores:edit_name": false });
  const r = await call(updateSupplier, db, ALM, { supplier_id: "s1", updates: { name: "Nuevo" } });
  assertEquals(r.status, 403);
  assertEquals(r.json.permission, "Proveedores:edit_name");
  assertEquals(db.rows("Supplier")[0].name, "Prov");
});

Deno.test("updateSupplierSafe: con solo edit_notes concedido, cambiar notas SI y nombre NO", async () => {
  const db = baseDb({ "Proveedores:edit_name": false, "Proveedores:edit_notes": true });
  const ok = await call(updateSupplier, db, ALM, { supplier_id: "s1", updates: { notes: "otra" } });
  assertEquals(ok.status, 200);
  assertEquals(db.rows("Supplier")[0].notes, "otra");
  const bad = await call(updateSupplier, db, ALM, { supplier_id: "s1", updates: { name: "X", notes: "otra" } });
  assertEquals(bad.status, 403);
  assertEquals(db.rows("Supplier")[0].name, "Prov");
});

Deno.test("updateSupplierSafe: el formulario reenvia el registro completo; valores sin cambio no exigen permiso", async () => {
  const db = baseDb({ "Proveedores:edit_name": false, "Proveedores:edit_notes": true });
  const r = await call(updateSupplier, db, ALM, {
    supplier_id: "s1",
    updates: { name: "Prov", contact_name: "C", email: "a@b.c", phone: "1", address: "A", rfc: "R", notes: "cambio" },
  });
  assertEquals(r.status, 200);
  assertEquals(db.rows("Supplier")[0].notes, "cambio");
});

Deno.test("updateSupplierSafe: owner edita todo; rol sin perfil no edita", async () => {
  const db = baseDb();
  const o = await call(updateSupplier, db, OWNER, { supplier_id: "s1", updates: { name: "Dueno", rfc: "Z" } });
  assertEquals(o.status, 200);
  const u = await call(updateSupplier, db, OTHER_ROLE, { supplier_id: "s1", updates: { name: "Hack" } });
  assertEquals(u.status, 403);
  assertEquals(db.rows("Supplier")[0].name, "Dueno");
});
