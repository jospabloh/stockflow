/**
 * Regresión: los handlers que llaman base44.auth.me() deben responder 401 (no 500)
 * cuando no hay sesión. Sin sesión el SDK real lanza ("Authentication required to
 * view users"); el try/catch lo convertía en HTTP 500 y el `if (!user) 401` nunca
 * se alcanzaba.
 *
 * Usa los handlers REALES con un SDK simulado cuyo auth.me() rechaza (mismo patrón
 * que procesos_control_test.ts). No toca red ni datos.
 *
 * Run: deno test -A base44/tests/unauth_401_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("PLATFORM_OWNER_EMAIL", "owner@example.com");

const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa(
    "export function createClientFromRequest(_req: Request) { return {" +
      " auth: { me: () => Promise.reject(new Error('Authentication required to view users')) }," +
      " entities: new Proxy({}, { get: () => { throw new Error('no debe tocar entidades sin sesion'); } })," +
      " asServiceRole: new Proxy({}, { get: () => { throw new Error('no debe tocar service role sin sesion'); } })" +
      " }; }",
  );

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

const TARGETS = [
  "courses/handlers/createCourseSafe",
  "courses/handlers/updateCourseSafe",
  "courses/handlers/deleteCourseSafe",
  "enrollments/handlers/createEnrollmentSafe",
  "enrollments/handlers/updateEnrollmentSafe",
  "enrollments/handlers/deleteEnrollmentSafe",
  "courseComms/handlers/sendEnrollmentEmail",
  "courseComms/handlers/sendCampaignEmails",
];

for (const t of TARGETS) {
  Deno.test(`${t.split("/").pop()}: sin sesión -> 401, no 500`, async () => {
    const handle = await loadHandle(`base44/functions/${t}.ts`);
    const res = await handle(
      new Request("http://local.test/fn", { method: "POST", body: JSON.stringify({ action: "x" }) }),
    );
    const json = await res.json();
    assertEquals(res.status, 401, JSON.stringify(json));
    assertEquals(json.error, "Unauthorized");
  });
}
