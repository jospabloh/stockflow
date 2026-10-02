/**
 * Sin sesion, auth.me() lanza "Authentication required ..." y los handlers lo
 * devolvian como 500. Los routers quotations, quotationPayments y pettyCash lo
 * mapean a 401. Pruebas sin SDK ni red.
 *
 * Run: deno test -A base44/tests/auth_missing_401_test.ts
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

for (const fn of ["quotations", "quotationPayments", "pettyCash"]) {
  const read = (p: string) => Deno.readTextFile(new URL(`../functions/${fn}/${p}`, import.meta.url));
  Deno.test(`${fn}: entry.ts aplica mapAuthErrorTo401`, async () => {
    const entry = await read("entry.ts");
    assert(entry.includes("mapAuthErrorTo401(await handler(req))"));
  });
  Deno.test(`${fn}: 500 por falta de sesion pasa a 401, otros 500 y 200 intactos`, async () => {
    const { mapAuthErrorTo401 } = await import(new URL(`../functions/${fn}/handlers/_authGuard.ts`, import.meta.url).href);
    const noAuth = await mapAuthErrorTo401(
      Response.json({ success: false, error: "Authentication required to view users" }, { status: 500 }),
    );
    assertEquals(noAuth.status, 401);
    const other = await mapAuthErrorTo401(Response.json({ error: "db down" }, { status: 500 }));
    assertEquals(other.status, 500);
    assertEquals((await other.json()).error, "db down");
    const ok = await mapAuthErrorTo401(Response.json({ success: true }));
    assertEquals(ok.status, 200);
  });
}
