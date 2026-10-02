/**
 * createSupplierSafe sin nombre debe responder 400 de validacion (como
 * createClientSafe / createContactSafe), no 500 con el error crudo de la
 * entidad ("Error in field name: Field required"). No se debe crear registro.
 *
 * SDK simulado en memoria (sin red, sin datos reales).
 * Run: deno test --allow-env --allow-read base44/tests/create_supplier_validation_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

function install(created: Row[]) {
  const entities = new Proxy({}, {
    get: (_x, n: string) => ({
      filter: () => Promise.resolve(n === "Business" ? [{ id: "b1", billing_status: "active" }] : []),
      create: (d: Row) => {
        // Simula la validacion de campo requerido de la plataforma.
        if (n === "Supplier" && (d.name === undefined || d.name === null || d.name === "")) {
          return Promise.reject(new Error("Error in field name: Field required"));
        }
        created.push(d);
        return Promise.resolve({ id: "s1", ...d });
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

const src = await Deno.readTextFile(new URL("../functions/suppliers/handlers/createSupplierSafe.ts", import.meta.url));
const rewritten = "// @ts-nocheck\n" + src
  .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
  .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM}'`);
const { handle } = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));

async function call(body: Row) {
  const created: Row[] = [];
  install(created);
  const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json(), created };
}

for (const [label, name] of [["ausente", undefined], ["vacio", ""], ["solo espacios", "   "]] as const) {
  Deno.test(`createSupplierSafe: nombre ${label} -> 400 y no crea`, async () => {
    const r = await call({ business_id: "b1", name });
    assertEquals(r.status, 400);
    assertEquals(r.json.success, false);
    assertEquals(r.json.error.includes("Field required"), false);
    assertEquals(r.created.length, 0);
  });
}

Deno.test("createSupplierSafe: nombre valido crea (200)", async () => {
  const r = await call({ business_id: "b1", name: "Proveedor X" });
  assertEquals(r.status, 200);
  assertEquals(r.created.length, 1);
});
