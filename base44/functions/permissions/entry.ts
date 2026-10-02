import { getHandler } from './handlers/index.ts';

Deno.serve(async (req) => {
  let action = '';
  try {
    const peek = await req.clone().json();
    if (peek && typeof peek.action === 'string') action = peek.action;
  } catch { /* no/invalid body */ }
  const handler = getHandler(action);
  if (!handler) return Response.json({ error: `permissions: unknown action '${action}'` }, { status: 400 });
  // Sin credenciales el SDK lanza 'Authentication required to view users' y los handlers lo
  // devuelven como 500: es un 401 (cliente sin sesion), no un error del servidor.
  const AUTH_RE = /authentication required/i;
  try {
    const res = await handler(req);
    if (res.status === 500) {
      const b = await res.clone().json().catch(() => null);
      if (typeof b?.error === 'string' && AUTH_RE.test(b.error)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    return res;
  } catch (e) {
    if (AUTH_RE.test(String((e as Error)?.message ?? e))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    throw e;
  }
});
