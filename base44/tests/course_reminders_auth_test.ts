/**
 * courseComms.runReminders is a cross-tenant sweep (service role, every
 * Enrollment of every business). Manual (non-cron) invocation must be limited
 * to the platform owner, NOT any tenant's role:admin / owner user.
 *
 * Run with: deno test -A base44/tests/course_reminders_auth_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Row = Record<string, any>;
const G = globalThis as any;

const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__rr.client(req); }");

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

const handle = await loadHandle("base44/functions/courseComms/handlers/runReminders.ts");

function tomorrowUtc() {
  const t = new Date(Date.now() + 24 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

async function call(user: Row | null, headers: Record<string, string> = {}) {
  const emails: Row[] = [];
  const updates: Row[] = [];
  G.__rr = {
    client: () => ({
      auth: { me: () => (user ? Promise.resolve(user) : Promise.reject(new Error("anon"))) },
      asServiceRole: {
        entities: {
          Enrollment: {
            filter: () => Promise.resolve([
              { id: "e-other", business_id: "b2", course_id: "c2", status: "confirmado", contact_email: "x@b2.test", contact_name: "X" },
            ]),
            update: (id: string, d: Row) => { updates.push({ id, ...d }); return Promise.resolve({}); },
          },
          Course: { filter: () => Promise.resolve([{ id: "c2", name: "Curso", sessions: [{ date: tomorrowUtc() }] }]) },
          Business: { filter: () => Promise.resolve([{ id: "b2", name: "Otro Tenant" }]) },
        },
        integrations: { Core: { SendEmail: (e: Row) => { emails.push(e); return Promise.resolve({}); } } },
      },
    }),
  };
  const res = await handle(new Request("http://local.test/fn", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "runReminders" }),
  }));
  return { status: res.status, emails, updates };
}

Deno.env.set("CRON_SECRET", "s3cret");
Deno.env.set("PLATFORM_OWNER_EMAIL", "platform@owner.test");

Deno.test("runReminders: a tenant role:admin cannot trigger the global sweep", async () => {
  const r = await call({ id: "u1", email: "admin@tenant1.test", role: "admin", business_id: "b1" });
  assertEquals(r.status, 401);
  assertEquals(r.emails.length, 0);
  assertEquals(r.updates.length, 0);
});

Deno.test("runReminders: a tenant owner cannot trigger the global sweep", async () => {
  const r = await call({ id: "u2", email: "dueno@tenant1.test", role: "owner", business_id: "b1" });
  assertEquals(r.status, 401);
  assertEquals(r.emails.length, 0);
});

Deno.test("runReminders: anonymous is rejected", async () => {
  const r = await call(null);
  assertEquals(r.status, 401);
  assertEquals(r.emails.length, 0);
});

Deno.test("runReminders: wrong cron secret is rejected", async () => {
  const r = await call(null, { "x-cron-secret": "nope" });
  assertEquals(r.status, 401);
});

Deno.test("runReminders: platform owner is allowed", async () => {
  const r = await call({ id: "u3", email: "platform@owner.test", role: "admin" });
  assertEquals(r.status, 200);
  assertEquals(r.emails.length, 1);
});

Deno.test("runReminders: valid CRON_SECRET is allowed", async () => {
  const r = await call(null, { "x-cron-secret": "s3cret" });
  assertEquals(r.status, 200);
  assertEquals(r.emails.length, 1);
});
