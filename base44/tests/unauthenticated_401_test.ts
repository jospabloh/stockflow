/**
 * Sin sesión, toda action protegida debe responder 401, no 500.
 *
 * En producción `base44.auth.me()` LANZA ("Authentication required to view
 * users") cuando no hay sesión, en vez de devolver null; sin `.catch(() => null)`
 * el `if (!user)` nunca se alcanzaba y el catch general devolvía 500.
 *
 * Usa los handlers REALES con un SDK simulado cuyo auth.me() lanza igual que el
 * real. No toca red ni datos.
 *
 * Run: deno test -A base44/tests/unauthenticated_401_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
const G = globalThis as any;

const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__unauth.client(req); }");

const ROOT = new URL("../../", import.meta.url);
const tmp = await Deno.makeTempDir();

async function loadHandle(rel: string): Promise<(req: Request) => Promise<Response>> {
  const abs = new URL(rel, ROOT);
  const src = await Deno.readTextFile(abs);
  const rewritten = "// @ts-nocheck\n" +
    src
      .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
      .replace(/from\s+'(\.[^']+)'/g, (_m, p) => `from '${new URL(p, abs).href}'`);
  const file = `${tmp}/${rel.replace(/\W/g, "_")}.ts`;
  await Deno.writeTextFile(file, rewritten);
  const mod = await import(`file://${file}?${Math.random()}`);
  return mod.handle;
}

// Sin sesión: auth.me() lanza como el SDK real; cualquier otro acceso falla fuerte.
G.__unauth = {
  client: () => ({
    auth: { me: () => Promise.reject(new Error("Authentication required to view users")) },
    asServiceRole: new Proxy({}, { get() { throw new Error("service role must not be reached"); } }),
    entities: new Proxy({}, { get() { throw new Error("entities must not be reached"); } }),
  }),
};

const HANDLERS: Record<string, string[]> = {
  products: [
    "createProductSafe", "updateProductSafe", "deleteProductSafe", "generateBarcodeSafe",
    "updateProductBarcodeSafe", "importItemsSafe", "applyInventoryAuditCorrection", "auditInventory",
  ],
  categories: ["createCategorySafe", "updateCategorySafe", "deleteCategorySafe"],
  movements: [
    "createMovementSafe", "deleteMovementSafe", "confirmMovementPaymentSafe",
    "updateMovementPaymentDetailsSafe",
  ],
  machinerySales: [
    "createMachinerySaleSafe", "updateMachinerySaleSafe", "deleteMachinerySaleSafe", "listMachinerySalesSafe",
  ],
  catalogSettings: ["createCatalogItemSafe", "updateCatalogItemSafe", "deleteCatalogItemSafe"],
};

for (const [router, names] of Object.entries(HANDLERS)) {
  for (const name of names) {
    Deno.test(`${router}/${name}: sin sesión responde 401 (no 500)`, async () => {
      const handle = await loadHandle(`base44/functions/${router}/handlers/${name}.ts`);
      const res = await handle(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify({ action: name }) }));
      assertEquals(res.status, 401);
    });
  }
}

// applyMovementStock admite service-role/cron: sin sesión ni credencial también 401.
Deno.test("movements/applyMovementStock: sin sesión responde 401", async () => {
  const handle = await loadHandle("base44/functions/movements/handlers/applyMovementStock.ts");
  const res = await handle(new Request("http://local.test/fn", { method: "POST", body: JSON.stringify({ action: "applyMovementStock", movement_id: "m1" }) }));
  assertEquals(res.status, 401);
});
