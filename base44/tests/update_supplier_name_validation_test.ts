/**
 * updateSupplierSafe no debe aceptar dejar el nombre vacio (createSupplierSafe ya
 * lo rechaza): updates.name '' / solo espacios / no-string -> 400 y no actualiza.
 *
 * SDK simulado en memoria (sin red, sin datos reales).
 * Run: deno test --allow-env --allow-read base44/tests/update_supplier_name_validation_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

function install(updated: Row[]) {
  const rows: Record<string, Row[]> = {
    Business: [{ id: "b1", billing_status: "active" }],
    Supplier: [{ id: "s1", business_id: "b1", name: "Original" }],
  };
  const entities = new Proxy({}, {
    get: (_x, n: string) => ({
      filter: () => Promise.resolve(rows[n] ?? []),
      update: (id: string, d: Row) => {
        updated.push({ id, ...d });
        return Promise.resolve({ id, ...d });
      },
    }),
  });
  G.__cs = {
    client: () => ({
      auth: { me: () => Promise.resolve({ id: "u1", business_id: "b1", role: "admin" }) },
      entities,
      asServiceRole: { entities },
    }),
  };
}

const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__cs.client(r); }");
const PERM = "data:application/typescript;base64," +
  btoa("export function hasPermission() { return Promise.resolve(true); }");

const src = await Deno.readTextFile(new URL("../functions/suppliers/handlers/updateSupplierSafe.ts", import.meta.url));
const rewritten = "// @ts-nocheck\n" + src
  .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
  .replace(/from\s+['"](?:\.\.\/)+shared\/authUser\.ts['"]/, `from '${new URL("../shared/authUser.ts", import.meta.url).href}'`)
  .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM}'`);
const { handle } = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));

async function call(updates: Row) {
  const updated: Row[] = [];
  install(updated);
  const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify({ supplier_id: "s1", updates }) }));
  return { status: res.status, json: await res.json(), updated };
}

for (const [label, name] of [["vacio", ""], ["solo espacios", "   "], ["null", null], ["no-string", 42]] as const) {
  Deno.test(`updateSupplierSafe: nombre ${label} -> 400 y no actualiza`, async () => {
    const r = await call({ name });
    assertEquals(r.status, 400);
    assertEquals(r.updated.length, 0);
  });
}

Deno.test("updateSupplierSafe: nombre valido actualiza (200)", async () => {
  const r = await call({ name: "Nuevo" });
  assertEquals(r.status, 200);
  assertEquals(r.updated.length, 1);
});

Deno.test("updateSupplierSafe: actualizar otro campo sin tocar name sigue funcionando", async () => {
  const r = await call({ phone: "555" });
  assertEquals(r.status, 200);
  assertEquals(r.updated.length, 1);
});
