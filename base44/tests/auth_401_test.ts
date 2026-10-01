/**
 * Regression: without a session (or with an invalid token) the authenticated
 * actions of quotations / quotationPayments / pettyCash must answer 401, not
 * 500. base44.auth.me() THROWS ("Authentication required to view users") when
 * there is no valid user, so the `if (!user)` guard was never reached and the
 * outer catch turned it into a 500.
 *
 * Runs the real handlers against a mock SDK (same technique as
 * procesos_control_test.ts: handlers are rewritten into a temp dir) whose
 * auth.me() throws exactly like the real SDK does for an anonymous caller.
 * Any other SDK access fails the test: nothing may be read or written before
 * the 401.
 *
 * Run with: deno test --allow-env --allow-read --allow-write base44/tests/auth_401_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MOCK_SDK = `
export function createClientFromRequest(_req) {
  const deny = () => { throw new Error("SDK access before auth: handler must return 401 first"); };
  return {
    auth: {
      me: () => Promise.reject(Object.assign(new Error("Authentication required to view users"), { status: 401 })),
    },
    asServiceRole: new Proxy({}, { get: deny }),
    entities: new Proxy({}, { get: deny }),
  };
}
`;
const tmp = await Deno.makeTempDir();
const MOCK_SDK_URL = "file://" + tmp + "/mock_sdk.ts";
await Deno.writeTextFile(tmp + "/mock_sdk.ts", MOCK_SDK);

async function loadHandler(router: string, name: string) {
  const abs = new URL(`../functions/${router}/handlers/${name}.ts`, import.meta.url);
  const src = (await Deno.readTextFile(abs))
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`)
    .replace(/from\s+'\.\/(\w+\.ts)'/g, (_m, f) => `from '${new URL(f, abs).href}'`);
  const file = `${tmp}/${router}_${name}.ts`;
  await Deno.writeTextFile(file, src);
  return await import(`file://${file}`);
}

const ROUTERS: Record<string, string[]> = {
  quotations: [
    "calculateQuotationWithTransport", "cancelQuotationSafe", "convertQuotationSafe",
    "createQuotationSafe", "deliverQuotationSafe", "partialReturnQuotation",
    "regenerateQuotation", "registerOnDemandArrivalSafe", "revertPaymentConfirmationSafe",
    "toggleQuotationShareSafe", "updateQuotationFlagsSafe", "updateQuotationSafe",
  ],
  quotationPayments: ["deleteQuotationPayment", "editQuotationPayment", "registerQuotationPayment"],
  pettyCash: ["createPettyCashMovementSafe", "deletePettyCashMovementSafe", "updatePettyCashMovementSafe", "syncCashSaleToPettyCash"],
};

for (const [router, names] of Object.entries(ROUTERS)) {
  for (const name of names) {
    for (const token of [null, "bogus"]) {
      Deno.test(`${router}/${name} -> 401 sin sesion (${token ? "token invalido" : "sin token"})`, async () => {
        const mod = await loadHandler(router, name);
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res: Response = await mod.handle(new Request("https://x.test/", {
          method: "POST", headers, body: JSON.stringify({ action: name, quotation_id: "000000000000000000000000" }),
        }));
        await res.text();
        assertEquals(res.status, 401);
      });
    }
  }
}
