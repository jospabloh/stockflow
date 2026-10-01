/**
 * Sin sesion (o con token invalido) las functions deben responder 401, no 500.
 * base44.auth.me() LANZA una excepcion cuando no hay sesion; antes caia en el
 * catch generico de cada handler y devolvia 500 "Authentication required to
 * view users". Cubre las 19 actions de clients, suppliers, supplierPayments,
 * contacts, utility y referrals.
 *
 * SDK simulado (sin red, sin datos). Run: deno test --allow-env --allow-read base44/tests/auth_required_401_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SDK = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(_r: Request) { return (globalThis as any).__noSession(); }");
const PERM = "data:application/typescript;base64," +
  btoa("export function hasPermission() { return Promise.resolve(true); }");

const HANDLERS: Record<string, string[]> = {
  clients: ["createClientSafe", "updateClientSafe", "deleteClientSafe"],
  suppliers: ["createSupplierSafe", "updateSupplierSafe", "deleteSupplierSafe"],
  supplierPayments: [
    "createSupplierPaymentSafe", "updateSupplierPaymentSafe",
    "updateSupplierPaymentInvoiceStatusSafe", "deleteSupplierPaymentSafe",
  ],
  contacts: ["createContactSafe", "updateContactSafe", "deleteContactSafe"],
  utility: [
    "createUtilityMovementSafe", "updateUtilityMovementSafe",
    "deleteUtilityMovementSafe", "toggleUtilityForecastSafe",
  ],
  referrals: ["applyReferralCode", "getReferralStats"],
};

// deno-lint-ignore no-explicit-any
(globalThis as any).__noSession = () => ({
  auth: { me: () => Promise.reject(new Error("Authentication required to view users")) },
  entities: new Proxy({}, { get: () => { throw new Error("no debe tocar entidades sin sesion"); } }),
  asServiceRole: new Proxy({}, { get: () => { throw new Error("no debe tocar service role sin sesion"); } }),
});

for (const [router, names] of Object.entries(HANDLERS)) {
  for (const name of names) {
    Deno.test(`${router}/${name}: sin sesion responde 401 (no 500)`, async () => {
      const src = await Deno.readTextFile(new URL(`../functions/${router}/handlers/${name}.ts`, import.meta.url));
      const rewritten = "// @ts-nocheck\n" + src
        .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${SDK}'`)
        .replace(/from\s+['"]\.\/_permissions\.ts['"]/, `from '${PERM}'`);
      const { handle } = await import("data:application/typescript;base64," + btoa(unescape(encodeURIComponent(rewritten))));
      const res = await handle(new Request("http://t/f", { method: "POST", body: JSON.stringify({ action: name }) }));
      assertEquals(res.status, 401);
    });
  }
}
