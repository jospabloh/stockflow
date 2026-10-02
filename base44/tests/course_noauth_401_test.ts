/**
 * Without credentials, base44.auth.me() REJECTS (SDK throws "Authentication
 * required"). Course/enrollment/courseComms handlers must answer 401, not 500.
 *
 * Run with: deno test -A base44/tests/course_noauth_401_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const G = globalThis as any;
const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__na.client(req); }");
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

const writes: string[] = [];
const sink = new Proxy({}, { get: () => () => { writes.push("touched"); return Promise.resolve([]); } });
G.__na = {
  client: () => ({
    auth: { me: () => Promise.reject(new Error("Authentication required to view users")) },
    entities: sink,
    asServiceRole: { entities: sink, integrations: { Core: { SendEmail: () => { writes.push("email"); return Promise.resolve({}); } } } },
  }),
};

const HANDLERS = [
  "courses/handlers/createCourseSafe.ts",
  "courses/handlers/updateCourseSafe.ts",
  "courses/handlers/deleteCourseSafe.ts",
  "enrollments/handlers/createEnrollmentSafe.ts",
  "enrollments/handlers/updateEnrollmentSafe.ts",
  "enrollments/handlers/deleteEnrollmentSafe.ts",
  "courseComms/handlers/sendEnrollmentEmail.ts",
  "courseComms/handlers/sendCampaignEmails.ts",
];

for (const h of HANDLERS) {
  Deno.test(`${h}: sin credenciales -> 401 y sin escrituras`, async () => {
    const handle = await loadHandle(`base44/functions/${h}`);
    const res = await handle(new Request("http://local.test/fn", {
      method: "POST",
      body: JSON.stringify({ action: "x", business_id: "x", title: "x" }),
    }));
    assertEquals(res.status, 401);
    assertEquals(writes.length, 0);
  });
}
