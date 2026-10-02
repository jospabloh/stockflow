/**
 * Ruta licenses -> jobs.sendLifecycleEmails (ola 4b, tren 3).
 *
 * confirmRenewalPayment y adminUpdateTenantLicense ya no llaman a la funcion suelta
 * `sendLifecycleEmails` (borrada): despachan al router `jobs` con
 * { action: 'sendLifecycleEmails', jobs }. Se ejercitan los handlers REALES con un
 * cliente SDK simulado; el invoke/fetch se enruta al handler real de jobs.
 *
 * Run: deno test -A base44/tests/licenses_to_jobs_route_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
const G = globalThis as any;

Deno.env.set("CRON_SECRET", "test-secret");
Deno.env.set("PLATFORM_OWNER_EMAIL", "owner@example.com");
Deno.env.set("APP_URL", "https://app.example.test");

const OWNER = { id: "u-owner", email: "owner@example.com" };

type Ctx = {
  tables: Record<string, Row[]>;
  user: Row | null;
  emails: Row[];
  invokes: { name: string; payload: Row }[];
  jobsHandle: ((req: Request) => Promise<Response>) | null;
};
G.__sf = {
  ctx: null as Ctx | null,
  client() {
    const ctx = this.ctx as Ctx;
    const entities = new Proxy({}, {
      get: (_t, name: string) => ({
        filter: (q: Row = {}) =>
          Promise.resolve((ctx.tables[name] ?? []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
        create: (d: Row) => {
          const row = { id: `${name}-${(ctx.tables[name] ??= []).length + 1}`, ...d };
          ctx.tables[name].push(row);
          return Promise.resolve({ ...row });
        },
        update: (id: string, patch: Row) => {
          const r = (ctx.tables[name] ?? []).find((x) => x.id === id);
          if (!r) return Promise.reject(new Error(`${name} ${id} not found`));
          Object.assign(r, patch);
          return Promise.resolve({ ...r });
        },
      }),
    });
    return {
      auth: { me: () => (ctx.user ? Promise.resolve(ctx.user) : Promise.reject(new Error("not authenticated"))) },
      asServiceRole: {
        entities,
        functions: {
          // La plataforma reenvia la peticion al endpoint; aqui se enruta al handler real de jobs.
          invoke: async (name: string, payload: Row) => {
            ctx.invokes.push({ name, payload });
            if (name !== "jobs") throw new Error(`Function not found: ${name}`);
            // Un invoke con service role NO lleva sesion de usuario (ni owner): jobs solo ve el
            // secreto del body. Se simula como la plataforma real (auth.me() falla).
            const saved = ctx.user;
            ctx.user = null;
            try {
              const res = await ctx.jobsHandle!(new Request("https://x.test/functions/jobs", { method: "POST", body: JSON.stringify(payload) }));
              const data = await res.json();
              if (!res.ok) throw new Error(`Request failed with status code ${res.status}`);
              return data;
            } finally {
              ctx.user = saved;
            }
          },
        },
        integrations: { Core: { SendEmail: (e: Row) => { ctx.emails.push(e); return Promise.resolve({}); } } },
      },
    };
  },
};

const MOCK_SDK_URL = "data:application/typescript;base64," +
  btoa("export function createClientFromRequest(req: Request) { return (globalThis as any).__sf.client(req); }");
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

const jobsLifecycle = await loadHandle("base44/functions/jobs/handlers/sendLifecycleEmails.ts");
const confirmRenewal = await loadHandle("base44/functions/licenses/handlers/confirmRenewalPayment.ts");
const adminUpdate = await loadHandle("base44/functions/licenses/handlers/adminUpdateTenantLicense.ts");

function freshCtx(user: Row | null = OWNER): Ctx {
  const ctx: Ctx = {
    tables: {
      Business: [{ id: "biz-1", name: "Negocio Prueba", billing_status: "active", license_plan: "start", license_expires_at: "2027-01-01T00:00:00Z" }],
      User: [
        { id: "u1", business_id: "biz-1", role: "owner", email: "dueno@negocio.test", full_name: "Dueno" },
        { id: "u2", business_id: "biz-1", role: "user", email: "empleado@negocio.test" },
      ],
      EmailNotification: [],
    },
    user,
    emails: [],
    invokes: [],
    jobsHandle: jobsLifecycle,
  };
  G.__sf.ctx = ctx;
  return ctx;
}

const post = (body: Row, headers: Record<string, string> = {}) =>
  new Request("https://x.test/f", { method: "POST", headers, body: JSON.stringify(body) });

Deno.test("confirmRenewalPayment despacha a jobs { action: 'sendLifecycleEmails', jobs } y el correo sale", async () => {
  const ctx = freshCtx();
  const res = await confirmRenewal(post({ business_id: "biz-1" }));
  assertEquals(res.status, 200);
  assertEquals(ctx.invokes.length, 1);
  assertEquals(ctx.invokes[0].name, "jobs");
  assertEquals(ctx.invokes[0].payload.action, "sendLifecycleEmails");
  assertEquals(ctx.invokes[0].payload.jobs.length, 1);
  assertEquals(ctx.invokes[0].payload.jobs[0].email_type, "payment_received");
  assertEquals(ctx.invokes[0].payload["x-cron-secret"], "test-secret");
  const out = await res.json();
  assertEquals(out.dispatch.sent, 1);
  assertEquals(out.dispatch.failed, 0);
  assert(ctx.emails.some((e) => e.to === "dueno@negocio.test"));
});

Deno.test("confirmRenewalPayment: no llama a la funcion suelta borrada", async () => {
  const ctx = freshCtx();
  await confirmRenewal(post({ business_id: "biz-1" }));
  assert(ctx.invokes.every((i) => i.name === "jobs"));
});

Deno.test("adminUpdateTenantLicense (activacion) invoca jobs con x-cron-secret y el correo sale (sin fetch /functions/v1)", async () => {
  const ctx = freshCtx();
  ctx.tables.Business[0].billing_status = "trial";
  const realFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = (() => { fetched++; return Promise.resolve(new Response("nf", { status: 404 })); }) as typeof fetch;
  try {
    const res = await adminUpdate(post({ business_id: "biz-1", updates: { billing_status: "active" } }, { authorization: "Bearer tok" }));
    assertEquals(res.status, 200);
    assertEquals(fetched, 0);
    assertEquals(ctx.invokes.length, 1);
    assertEquals(ctx.invokes[0].name, "jobs");
    assertEquals(ctx.invokes[0].payload.action, "sendLifecycleEmails");
    assertEquals(ctx.invokes[0].payload.jobs[0].email_type, "license_activated");
    assertEquals(ctx.invokes[0].payload["x-cron-secret"], "test-secret");
    const out = await res.json();
    assertEquals(out.email_dispatch.sent, 1);
    assert(ctx.emails.some((e) => e.to === "dueno@negocio.test"));
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("licenses: si jobs rechaza el despacho (401), el fallo es visible y no se registra como enviado", async () => {
  const ctx = freshCtx();
  ctx.tables.Business[0].billing_status = "trial";
  const saved = Deno.env.get("CRON_SECRET");
  Deno.env.set("CRON_SECRET", "otro-secreto-de-jobs");
  try {
    // El handler de jobs ya cargado lee CRON_SECRET en cada request; el body lleva el secreto de licenses.
    ctx.jobsHandle = async (_req: Request) => Response.json({ error: "Unauthorized" }, { status: 401 });
    const r1 = await adminUpdate(post({ business_id: "biz-1", updates: { billing_status: "active" } }));
    const o1 = await r1.json();
    assertEquals(o1.email_dispatch.sent, 0);
    assertEquals(o1.email_dispatch.failed, -1);
    assert(String(o1.email_dispatch.error).includes("401"));
    ctx.tables.Business[0].billing_status = "active";
    const r2 = await confirmRenewal(post({ business_id: "biz-1" }));
    const o2 = await r2.json();
    assertEquals(o2.email_dispatch_failed, true);
    assert(String(o2.dispatch.error).includes("401"));
    assertEquals(ctx.tables.EmailNotification.length, 0);
  } finally {
    if (saved) Deno.env.set("CRON_SECRET", saved);
  }
});

Deno.test("jobs.sendLifecycleEmails conserva la autenticacion de la funcion vieja", async () => {
  const job = { email_type: "payment_received", recipient_email: "a@b.test", business_id: "biz-1" };
  freshCtx(null);
  let r = await jobsLifecycle(post({ action: "sendLifecycleEmails", jobs: [] }));
  assertEquals(r.status, 401);
  freshCtx({ id: "x", email: "otro@tenant.test", role: "admin" });
  r = await jobsLifecycle(post({ action: "sendLifecycleEmails", jobs: [] }));
  assertEquals(r.status, 401);
  freshCtx(null);
  r = await jobsLifecycle(post({ action: "sendLifecycleEmails", jobs: [job] }, { "x-cron-secret": "test-secret" }));
  assertEquals(r.status, 200);
  assertEquals((await r.json()).sent, 1);
  freshCtx(OWNER);
  r = await jobsLifecycle(post({ action: "sendLifecycleEmails", jobs: [job] }));
  assertEquals(r.status, 200);
});

Deno.test("estaticas: las funciones sueltas borradas ya no existen y licenses no las invoca", async () => {
  const OLD = [
    "sendLifecycleEmails", "processTrialReactivationEmails", "cleanupSessions",
    "dailyDocumentationAudit", "dailyPermissionAudit", "dailyStockReconcile", "sendCourseReminders",
  ];
  for (const n of OLD) {
    let exists = true;
    try { await Deno.stat(new URL(`base44/functions/${n}`, ROOT)); } catch { exists = false; }
    assert(!exists, `base44/functions/${n} debe estar borrada`);
  }
  for (const f of ["confirmRenewalPayment", "adminUpdateTenantLicense"]) {
    const src = await Deno.readTextFile(new URL(`base44/functions/licenses/handlers/${f}.ts`, ROOT));
    assert(!/invoke\('sendLifecycleEmails'/.test(src), `${f}: invoke a funcion suelta`);
    assert(!src.includes("/functions/v1/sendLifecycleEmails"), `${f}: fetch a funcion suelta`);
  }
});
