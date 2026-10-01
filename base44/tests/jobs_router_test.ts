/**
 * Pruebas estáticas del router `jobs` (ola 4 de consolidación).
 * No importan el SDK ni llaman a producción: verifican el registro de actions,
 * que los workflows/llamadores apunten a una action registrada y que los
 * handlers conserven su validación CRON/owner.
 *
 * Run with: deno test -A base44/tests/jobs_router_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ACTIONS = [
  "sendLifecycleEmails",
  "processTrialReactivationEmails",
  "dailyPermissionAudit",
  "dailyDocumentationAudit",
  "dailyStockReconcile",
  "cleanupSessions",
];

const read = (p: string) => Deno.readTextFile(new URL(`../../${p}`, import.meta.url));

Deno.test("jobs/handlers/index.ts registra exactamente las 6 actions", async () => {
  const idx = await read("base44/functions/jobs/handlers/index.ts");
  const block = idx.slice(idx.indexOf("HANDLERS"), idx.indexOf("};", idx.indexOf("HANDLERS")));
  for (const a of ACTIONS) {
    assert(idx.includes(`import { handle as ${a} } from './${a}.ts'`), `falta import ${a}`);
    assert(new RegExp(`^\\s+${a},$`, "m").test(block), `falta registro ${a}`);
  }
  assertEquals((block.match(/^\s+\w+,$/gm) ?? []).length, ACTIONS.length);
});

Deno.test("cada handler exporta handle y valida CRON_SECRET o platform owner", async () => {
  for (const a of ACTIONS) {
    const src = await read(`base44/functions/jobs/handlers/${a}.ts`);
    assert(src.includes("export async function handle(req: Request)"), `${a}: sin export handle`);
    assert(!src.includes("Deno.serve"), `${a}: no debe llamar Deno.serve`);
    assert(src.includes("CRON_SECRET"), `${a}: sin validación CRON_SECRET`);
    assert(src.includes("PLATFORM_OWNER_EMAIL"), `${a}: sin validación owner`);
    assert(src.includes("Unauthorized"), `${a}: sin 401`);
  }
});

Deno.test("entry.ts del router responde 400 a action desconocida", async () => {
  const entry = await read("base44/functions/jobs/entry.ts");
  assert(entry.includes("unknown action"));
  assert(entry.includes("status: 400"));
});

const LEGACY_WORKFLOWS_KEPT = ["Send Lifecycle Emails.jsonc", "Trial Reactivation Emails Daily.jsonc"];

Deno.test("workflows de jobs usan function_name 'jobs' con action registrada", async () => {
  const dir = new URL("../../base44/workflows/", import.meta.url);
  let found = 0;
  for await (const f of Deno.readDir(dir)) {
    if (!f.name.endsWith(".jsonc")) continue;
    const txt = await Deno.readTextFile(new URL(f.name, dir));
    if (txt.includes('"function_name": "jobs"')) {
      found++;
      const m = txt.match(/"action":\s*"(\w+)"/);
      assert(m && ACTIONS.includes(m[1]), `${f.name}: action inválida`);
    }
    // Los dos workflows de correo siguen apuntando a las funciones viejas hasta
    // verificar que Base44 entrega 'args' como body de la función (ver PR).
    for (const a of ACTIONS) {
      if (LEGACY_WORKFLOWS_KEPT.includes(f.name) && (a === "sendLifecycleEmails" || a === "processTrialReactivationEmails")) continue;
      assert(!txt.includes(`"function_name": "${a}"`), `${f.name} sigue apuntando a la función vieja ${a}`);
    }
  }
  assertEquals(found, 1); // solo Daily Stock Reconcile (solo lectura)
});

Deno.test("dailyStockReconcile sigue siendo de solo lectura", async () => {
  const src = await read("base44/functions/jobs/handlers/dailyStockReconcile.ts");
  assert(!/\.(update|create|delete|bulkCreate)\s*\(/.test(src));
});

Deno.test("llamadores de licenses siguen en sendLifecycleEmails vieja (hasta verificar auth service-role contra jobs)", async () => {
  const c = await read("base44/functions/licenses/handlers/confirmRenewalPayment.ts");
  assert(c.includes("invoke('sendLifecycleEmails', { jobs })"));
  assert(!c.includes("invoke('jobs'"));
  const a = await read("base44/functions/licenses/handlers/adminUpdateTenantLicense.ts");
  assert(a.includes("/functions/v1/sendLifecycleEmails"));
  assert(!a.includes("/functions/v1/jobs"));
});

Deno.test("generadores escriben en la ruta nueva y no recrean las viejas", async () => {
  const p = await read("scripts/generatePermissionManifests.mjs");
  const v = await read("scripts/generateVersionHistorySnapshot.mjs");
  assert(p.includes("'jobs', 'handlers', 'dailyPermissionAudit.ts'"));
  assert(v.includes("'jobs', 'handlers', 'dailyDocumentationAudit.ts'"));
  assert(!p.includes("'dailyPermissionAudit', 'entry.ts'"));
  assert(!v.includes("'dailyDocumentationAudit', 'entry.ts'"));
});
