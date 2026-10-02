/**
 * generateBarcodeSafe debe exigir el permiso 'Productos:barcode' (el mismo que
 * la UI usa para mostrar el botón "Generar código"), igual que
 * updateProductBarcodeSafe exige 'Productos:edit_barcode'.
 *
 * Se carga el handler REAL reescribiendo el import del SDK a un mock y el
 * import de ./_permissions.ts a su URL de archivo.
 *
 * Run: deno test -A base44/tests/generate_barcode_permission_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
G.__gb = { ctx: null };
G.__gb.client = () => {
  const c = G.__gb.ctx;
  return {
    auth: { me: () => Promise.resolve(c.user) },
    entities: { Product: c.Product },
    asServiceRole: { entities: { PermissionProfile: c.PermissionProfile, Product: c.Product } },
  };
};
const MOCK_SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(r: Request) { return (globalThis as any).__gb.client(r); }");

const handlersDir = new URL("../functions/products/handlers/", import.meta.url);
const src = await Deno.readTextFile(new URL("generateBarcodeSafe.ts", handlersDir));
const rewritten = "// @ts-nocheck\n" + src
  .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK}'`)
  .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${new URL("_permissions.ts", handlersDir).href}'`);
const mod = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));

function setup(user: Record<string, unknown>, profiles: Array<Record<string, unknown>> = []) {
  const updates: unknown[] = [];
  const product = { id: "p1", business_id: "biz-1", name: "X", barcode: "" };
  G.__gb.ctx = {
    user,
    PermissionProfile: { filter: (q: Record<string, unknown>) => Promise.resolve(profiles.filter((p) => p.business_id === q.business_id && p.role_key === q.role_key)) },
    Product: {
      filter: (q: Record<string, unknown>) => Promise.resolve(q.id ? [product] : []),
      update: (_id: string, d: unknown) => { updates.push(d); return Promise.resolve({ ...product, ...(d as object) }); },
    },
  };
  return updates;
}
const call = () => mod.handle(new Request("http://x", { method: "POST", body: JSON.stringify({ product_id: "p1" }) }));

Deno.test("generateBarcodeSafe: usuario sin Productos:barcode recibe 403 y no escribe", async () => {
  const updates = setup(
    { role: "almacenista", business_id: "biz-1", email: "a@x" },
    [{ business_id: "biz-1", role_key: "almacenista", permissions: { "Productos:barcode": false } }],
  );
  const res = await call();
  assertEquals(res.status, 403);
  assertEquals(updates.length, 0);
});

Deno.test("generateBarcodeSafe: usuario con Productos:barcode genera el código", async () => {
  const updates = setup(
    { role: "almacenista", business_id: "biz-1", email: "a@x" },
    [{ business_id: "biz-1", role_key: "almacenista", permissions: { "Productos:barcode": true } }],
  );
  const res = await call();
  assertEquals(res.status, 200);
  assertEquals(updates.length, 1);
});

Deno.test("generateBarcodeSafe: admin siempre permitido", async () => {
  const updates = setup({ role: "admin", business_id: "biz-1", email: "ad@x" });
  const res = await call();
  assertEquals(res.status, 200);
  assertEquals(updates.length, 1);
});
