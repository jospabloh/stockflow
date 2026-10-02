/**
 * Sin credenciales, las acciones autenticadas deben responder 401 (no 500
 * 'Authentication required to view users'). Cubre los 5 routers, notifySupportIssue y
 * validateBusinessOwnership.
 *
 * Run: deno test -A base44/tests/auth_401_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const ROOT = new URL("../../", import.meta.url);
const tmp = await Deno.makeTempDir();
const AUTH_ERR = "Authentication required to view users";

G.__sf = {
  client: () => ({ auth: { me: () => Promise.reject(new Error(AUTH_ERR)) } }),
};
const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__sf.client(req); }");

type Serve = (req: Request) => Promise<Response>;
async function loadServe(rel: string, indexStub?: string): Promise<Serve> {
  const abs = new URL(rel, ROOT);
  let src = await Deno.readTextFile(abs);
  src = src.replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`);
  if (indexStub) {
    src = src.replace("'./handlers/index.ts'", `'data:application/typescript;base64,${btoa(indexStub)}'`);
  }
  const file = `${tmp}/${rel.replace(/\W/g, "_")}.ts`;
  await Deno.writeTextFile(file, "// @ts-nocheck\n" + src);
  const realServe = Deno.serve;
  let captured: Serve | null = null;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (fn: Serve) => { captured = fn; return {}; };
  try {
    await import(`file://${file}?${Math.random()}`);
  } finally {
    // deno-lint-ignore no-explicit-any
    (Deno as any).serve = realServe;
  }
  return captured!;
}

const post = (body: Record<string, unknown>) =>
  new Request("https://x.test/f", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

for (const fn of ["permissions", "tenantRules", "licenses", "session", "business"]) {
  Deno.test(`${fn}: handler que devuelve 500 'Authentication required' sale como 401`, async () => {
    const stub = `export const getHandler = (a) => a === 'x' ? async () => Response.json({ error: '${AUTH_ERR}' }, { status: 500 }) : a === 'boom' ? async () => { throw new Error('${AUTH_ERR}'); } : a === 'real' ? async () => Response.json({ error: 'db caida' }, { status: 500 }) : null;`;
    const serve = await loadServe(`base44/functions/${fn}/entry.ts`, stub);
    assertEquals((await serve(post({ action: "x" }))).status, 401);
    assertEquals((await serve(post({ action: "boom" }))).status, 401);
    // Un 500 real sigue siendo 500
    assertEquals((await serve(post({ action: "real" }))).status, 500);
    assertEquals((await serve(post({ action: "nope" }))).status, 400);
  });
}

Deno.test("notifySupportIssue sin sesion responde 401", async () => {
  const serve = await loadServe("base44/functions/notifySupportIssue/entry.ts");
  assertEquals((await serve(post({ issue_type: "bug", description: "x" }))).status, 401);
});

Deno.test("business.validateBusinessOwnership sin sesion responde 401", async () => {
  const abs = new URL("base44/functions/business/handlers/validateBusinessOwnership.ts", ROOT);
  const src = (await Deno.readTextFile(abs)).replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/, `from '${MOCK_SDK_URL}'`);
  const file = `${tmp}/vbo.ts`;
  await Deno.writeTextFile(file, "// @ts-nocheck\n" + src);
  const mod = await import(`file://${file}`);
  const res = await mod.handle(post({ entity_name: "Product", record_id: "1" }));
  assertEquals(res.status, 401);
});
