/**
 * Resolución del usuario autenticado, compartida por todos los routers.
 *
 * Sin sesión (o con token inválido) `base44.auth.me()` del SDK LANZA
 * ("Authentication required to view users") en vez de devolver null. Los
 * handlers hacen `if (!user) return 401`, pero con el `await base44.auth.me()`
 * desnudo esa guarda nunca se alcanzaba: el catch general respondía 500.
 *
 * Uso:
 *   const user = await getAuthUser(base44);
 *   if (!user) return unauthorized();
 *
 * Devuelve null cuando no hay sesión válida (error de auth, 4xx o sin status).
 * Un fallo real del backend (status >= 500) se relanza, para que siga siendo
 * un 500 y no se disfrace de "sesión expirada".
 */

// deno-lint-ignore no-explicit-any
export async function getAuthUser(base44: any): Promise<any | null> {
  try {
    return (await base44.auth.me()) ?? null;
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status);
    if (Number.isFinite(status) && status >= 500) throw error;
    return null;
  }
}

export function unauthorized(message = 'Unauthorized'): Response {
  return Response.json({ error: message }, { status: 401 });
}
