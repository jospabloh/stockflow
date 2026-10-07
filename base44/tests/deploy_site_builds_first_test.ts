/**
 * `npm run deploy:site` debe CONSTRUIR antes de subir, y no subir nada si la
 * construcción no dejó un dist/index.html escrito en esa misma corrida.
 *
 * Incidente 2026-10-06 (21:57–22:01 CDMX): `base44 site deploy` sube `dist/` tal
 * como está; subió un dist/ del 24-sep y producción sirvió 4 minutos un frontend
 * de dos semanas atrás.
 *
 * Ejecuta el script REAL (`scripts/base44-deploy.mjs --site`) con node, dentro de
 * una copia temporal mínima del repo y con `npm`/`npx` FALSOS al frente del PATH.
 * Los falsos sólo escriben en un log: nunca se toca la CLI de Base44 ni producción.
 *
 * Run: deno test --allow-env --allow-read --allow-write --allow-run=node base44/tests/deploy_site_builds_first_test.ts
 */
import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const REPO = new URL("../../", import.meta.url).pathname;

type BuildMode = "ok" | "fail" | "stale";

// El npm falso simula la construcción según FAKE_BUILD:
//   ok    → escribe dist/index.html nuevo
//   fail  → sale con código 1
//   stale → «termina bien» pero no escribe nada (queda el dist/ viejo)
const FAKE_NPM = `#!/bin/sh
echo "npm $* VITE_BASE44_APP_ID=$VITE_BASE44_APP_ID" >> "$FAKE_LOG"
case "$FAKE_BUILD" in
  ok) mkdir -p dist && echo '<html>nuevo</html>' > dist/index.html; exit 0 ;;
  fail) exit 1 ;;
  *) exit 0 ;;
esac
`;
const FAKE_NPX = `#!/bin/sh
echo "npx $*" >> "$FAKE_LOG"
exit 0
`;

async function runSite(mode: BuildMode) {
  const tmp = await Deno.makeTempDir({ prefix: "deploy-site-" });
  try {
    // Copia mínima: el script calcula ROOT desde su propia ruta, así que se copia
    // junto con lo que importa (validate-functions.mjs) y la config de la app.
    await Deno.mkdir(`${tmp}/scripts`);
    for (const f of ["base44-deploy.mjs", "validate-functions.mjs"]) {
      await Deno.copyFile(`${REPO}scripts/${f}`, `${tmp}/scripts/${f}`);
    }
    await Deno.copyFile(`${REPO}base44.app.json`, `${tmp}/base44.app.json`);
    await Deno.mkdir(`${tmp}/base44/functions`, { recursive: true });

    // dist/ viejo, del 24-sep: lo que subió el incidente.
    await Deno.mkdir(`${tmp}/dist`);
    await Deno.writeTextFile(`${tmp}/dist/index.html`, "<html>viejo</html>");
    const old = new Date("2026-09-24T12:00:00Z");
    await Deno.utime(`${tmp}/dist/index.html`, old, old);

    await Deno.mkdir(`${tmp}/bin`);
    for (const [name, body] of [["npm", FAKE_NPM], ["npx", FAKE_NPX]]) {
      await Deno.writeTextFile(`${tmp}/bin/${name}`, body);
      await Deno.chmod(`${tmp}/bin/${name}`, 0o755);
    }

    const log = `${tmp}/calls.log`;
    const out = await new Deno.Command("node", {
      args: ["scripts/base44-deploy.mjs", "--site"],
      cwd: tmp,
      env: {
        PATH: `${tmp}/bin:${Deno.env.get("PATH") ?? ""}`,
        FAKE_LOG: log,
        FAKE_BUILD: mode,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();

    let calls: string[] = [];
    try {
      calls = (await Deno.readTextFile(log)).split("\n").filter(Boolean);
    } catch { /* ningún falso fue invocado */ }
    const html = await Deno.readTextFile(`${tmp}/dist/index.html`);
    return {
      code: out.code,
      stderr: new TextDecoder().decode(out.stderr),
      calls,
      html,
    };
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
}

const appId = JSON.parse(await Deno.readTextFile(`${REPO}base44.app.json`)).appId as string;
const deployCalls = (calls: string[]) => calls.filter((c) => c.startsWith("npx base44 site deploy"));

Deno.test("deploy:site construye ANTES de subir, con VITE_BASE44_APP_ID = id de base44.app.json", async () => {
  const r = await runSite("ok");
  assertEquals(r.code, 0, r.stderr);
  assert(appId.length > 0);
  assertEquals(r.calls.length, 2, `llamadas: ${r.calls.join(" | ")}`);
  assertEquals(r.calls[0], `npm run build VITE_BASE44_APP_ID=${appId}`);
  assert(r.calls[1].startsWith("npx base44 site deploy"), r.calls[1]);
  assert(r.calls[1].includes(`--app-id ${appId}`), r.calls[1]);
  assertEquals(r.html, "<html>nuevo</html>\n");
});

Deno.test("si la construcción falla, no se invoca site deploy y el script sale distinto de cero", async () => {
  const r = await runSite("fail");
  assertNotEquals(r.code, 0);
  assertEquals(deployCalls(r.calls), []);
  assert(r.calls[0]?.startsWith("npm run build"), `llamadas: ${r.calls.join(" | ")}`);
});

Deno.test("incidente 2026-10-06: build «exitoso» sin dist/index.html nuevo (queda el viejo) NO sube nada", async () => {
  const r = await runSite("stale");
  assertNotEquals(r.code, 0);
  assertEquals(deployCalls(r.calls), []);
  assertEquals(r.html, "<html>viejo</html>");
  assert(r.stderr.includes("dist/index.html"), r.stderr);
});
