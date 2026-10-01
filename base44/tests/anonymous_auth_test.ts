/**
 * Sin sesión, `base44.auth.me()` del SDK LANZA una excepción ("Authentication
 * required to view users") en vez de devolver null. Los handlers hacen
 * `if (!user) return 401`, pero con el `await base44.auth.me()` desnudo la
 * excepción caía en el catch general y respondía 500. Esta prueba estática
 * exige que toda llamada a auth.me() en funciones tenga `.catch(() => null)`,
 * salvo las allowlisted (ya dentro de try/catch propio o posteriores a la
 * autenticación).
 *
 * Run with: deno test -A base44/tests/anonymous_auth_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ROOT = new URL("../functions/", import.meta.url);

// Rutas (relativas a base44/functions) cuya llamada desnuda es correcta.
const ALLOWED = new Set([
  // Dentro de try { } catch { /* no valid session */ } -> 401 propio.
  "jobs/handlers/dailyDocumentationAudit.ts",
  "jobs/handlers/dailyPermissionAudit.ts",
  "dailyDocumentationAudit/entry.ts",
  "dailyPermissionAudit/entry.ts",
  // Re-lectura tras haber autenticado al usuario (ya no es anónimo).
  "permissions/handlers/upgradeOwnerToAdmin.ts",
]);

async function* walk(dir: URL): AsyncGenerator<string> {
  for await (const e of Deno.readDir(dir)) {
    const u = new URL(e.name + (e.isDirectory ? "/" : ""), dir);
    if (e.isDirectory) yield* walk(u);
    else if (e.name.endsWith(".ts")) yield u.pathname;
  }
}

Deno.test("auth.me() anónimo no debe convertirse en 500: todas las llamadas llevan .catch", async () => {
  const offenders: string[] = [];
  const base = ROOT.pathname;
  for await (const path of walk(ROOT)) {
    const rel = path.slice(base.length);
    if (ALLOWED.has(rel)) continue;
    const lines = (await Deno.readTextFile(path)).split("\n");
    lines.forEach((l, i) => {
      if (/^\s*(\/\/|\*)/.test(l)) return;
      if (/await\s+base44\.auth\.me\(\)(?!\s*\.catch)/.test(l)) offenders.push(`${rel}:${i + 1}`);
    });
  }
  assertEquals(offenders, []);
});
