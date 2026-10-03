/**
 * Sin sesion, toda action autenticada debe responder 401, no 500.
 *
 * El SDK real LANZA ("Authentication required to view users") en
 * `base44.auth.me()` cuando no hay sesion. Todos los routers resuelven el
 * usuario con el helper compartido `base44/shared/authUser.ts`
 * (`getAuthUser`), que convierte ese error en null para que el
 * `if (!user) return 401` de cada handler sea alcanzable.
 *
 * Consolida #424, #425, #427, #429, #435 y #444. SDK simulado, sin red ni datos.
 *
 * Run: deno test -A base44/tests/auth_401_sin_sesion_test.ts
 */
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getAuthUser } from "../shared/authUser.ts";

const FN_ROOT = new URL("../functions/", import.meta.url);

async function* walk(dir: URL): AsyncGenerator<string> {
  for await (const e of Deno.readDir(dir)) {
    const u = new URL(e.name + (e.isDirectory ? "/" : ""), dir);
    if (e.isDirectory) yield* walk(u);
    else if (e.name.endsWith(".ts")) yield u.pathname;
  }
}

// Llamadas desnudas a auth.me() que son correctas (rutas relativas a base44/functions).
const BARE_ALLOWED = new Set([
  // Re-lectura tras haber autenticado al usuario (ya no es anonimo).
  "permissions/handlers/upgradeOwnerToAdmin.ts",
]);

// ---- helper ----
Deno.test("getAuthUser: devuelve el usuario cuando hay sesion", async () => {
  const u = await getAuthUser({ auth: { me: () => Promise.resolve({ id: "u1" }) } });
  assertEquals(u, { id: "u1" });
});

Deno.test("getAuthUser: null cuando me() devuelve null/undefined", async () => {
  assertEquals(await getAuthUser({ auth: { me: () => Promise.resolve(null) } }), null);
  assertEquals(await getAuthUser({ auth: { me: () => Promise.resolve(undefined) } }), null);
});

Deno.test("getAuthUser: null cuando me() lanza sin sesion (con o sin status 401/403)", async () => {
  for (const err of [new Error("Authentication required to view users"), Object.assign(new Error("x"), { status: 401 }), Object.assign(new Error("x"), { status: 403 })]) {
    assertEquals(await getAuthUser({ auth: { me: () => Promise.reject(err) } }), null);
  }
});

Deno.test("getAuthUser: null cuando me() lanza sincronamente", async () => {
  assertEquals(await getAuthUser({ auth: { me: () => { throw new Error("boom"); } } }), null);
});

Deno.test("getAuthUser: un fallo real del backend (>= 500) se relanza", async () => {
  const err = Object.assign(new Error("upstream down"), { status: 503 });
  await assertRejects(() => getAuthUser({ auth: { me: () => Promise.reject(err) } }), Error, "upstream down");
});

// ---- guarda estatica ----
Deno.test("ninguna funcion llama a auth.me() desnudo (todas usan getAuthUser)", async () => {
  const offenders: string[] = [];
  const base = FN_ROOT.pathname;
  for await (const path of walk(FN_ROOT)) {
    const rel = path.slice(base.length);
    if (BARE_ALLOWED.has(rel)) continue;
    const lines = (await Deno.readTextFile(path)).split("\n");
    lines.forEach((l, i) => {
      if (/^\s*(\/\/|\*)/.test(l)) return;
      if (/\bauth\.me\(\)/.test(l)) offenders.push(`${rel}:${i + 1}`);
    });
  }
  assertEquals(offenders, [], "usa getAuthUser(base44) de base44/shared/authUser.ts");
});

// ---- dinamica: cada handler responde 401 sin sesion ----
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

async function loadHandle(path: string): Promise<(req: Request) => Promise<Response>> {
  const src = await Deno.readTextFile(path);
  const abs = new URL("file://" + path);
  const rewritten = "// @ts-nocheck\n" + src
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/g, `from '${MOCK_SDK_URL}'`)
    .replace(/from\s+'(\.[^']+)'/g, (_m, p) => `from '${new URL(p, abs).href}'`);
  const file = `${tmp}/${path.replace(/\W/g, "_")}`;
  await Deno.writeTextFile(file, rewritten);
  return (await import(`file://${file}?${Math.random()}`)).handle;
}

// Handlers que NO exigen sesion de usuario (auth propia: cron/CRON_SECRET, webhook,
// service role). Rutas relativas a base44/functions.
const NOT_USER_AUTH = new Set<string>([
  "courseComms/handlers/runReminders.ts",
  "pettyCash/handlers/syncCashSaleToPettyCash.ts",
  "movements/handlers/applyMovementStock.ts",
  "session/handlers/trackUserActivity.ts",
  "business/handlers/sendTestLifecycleEmails.ts",
]);

const handlerFiles: string[] = [];
for await (const path of walk(FN_ROOT)) {
  const rel = path.slice(FN_ROOT.pathname.length);
  if (!/^[^/]+\/handlers\/[^_/][^/]*\.ts$/.test(rel) || rel.endsWith("/index.ts")) continue;
  const text = await Deno.readTextFile(path);
  if (!/export\s+async\s+function\s+handle\b/.test(text) || !/getAuthUser\(/.test(text)) continue;
  handlerFiles.push(rel);
}

Deno.test("hay una cantidad razonable de handlers cubiertos", () => {
  assert(handlerFiles.length >= 80, `solo ${handlerFiles.length} handlers detectados`);
});

for (const rel of handlerFiles) {
  if (NOT_USER_AUTH.has(rel)) continue;
  Deno.test(`${rel}: sin sesion responde 401 (no 500)`, async () => {
    const handle = await loadHandle(FN_ROOT.pathname + rel);
    const action = rel.split("/").pop()!.replace(/\.ts$/, "");
    const res = await handle(
      new Request("http://localhost/fn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      }),
    );
    const body = await res.text();
    assertEquals(res.status, 401, body);
  });
}

// ---- notifySupportIssue: funcion suelta (sin carpeta handlers/), usa Deno.serve ----
Deno.test("notifySupportIssue/entry.ts: sin sesion responde 401 (no 500)", async () => {
  const rel = "notifySupportIssue/entry.ts";
  const path = FN_ROOT.pathname + rel;
  const text = await Deno.readTextFile(path);
  assert(/getAuthUser\(/.test(text), "notifySupportIssue debe usar getAuthUser");
  const abs = new URL("file://" + path);
  const rewritten = "// @ts-nocheck\n" + text
    .replace(/from\s+['"]npm:@base44\/sdk@[\d.]+['"]/g, `from '${MOCK_SDK_URL}'`)
    .replace(/from\s+'(\.[^']+)'/g, (_m, p) => `from '${new URL(p, abs).href}'`);
  const file = `${tmp}/notifySupportIssue_entry.ts`;
  await Deno.writeTextFile(file, rewritten);
  const realServe = Deno.serve;
  let captured: ((req: Request) => Promise<Response>) | undefined;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: (req: Request) => Promise<Response>) => { captured = h; return { shutdown: () => Promise.resolve() }; };
  try {
    await import(`file://${file}?${Math.random()}`);
  } finally {
    (Deno as any).serve = realServe; // deno-lint-ignore no-explicit-any
  }
  assert(captured, "entry.ts debe registrar un handler con Deno.serve");
  const res = await captured!(
    new Request("http://localhost/fn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issue_type: "x", description: "y" }),
    }),
  );
  assertEquals(res.status, 401, await res.text());
});
