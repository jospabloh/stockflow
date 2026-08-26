import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// switchBusinessSafe — Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md).
//
// Único camino para mover el `business_id` activo de un usuario que
// pertenece a más de un negocio (vía Membership). Mismo patrón que
// createBusinessSafe/joinBusinessSafe: nunca confía en el cliente, siempre
// re-deriva del registro almacenado.
//
// Seguridad — el punto entero de esta función:
//   - El `business_id` que pide el cliente se valida contra el conjunto de
//     Membership del caller re-leído DESDE CERO en el servidor — nunca se
//     confía en que el id que mandó el cliente sea uno de los suyos.
//   - Un business_id fuera de ese conjunto responde EXACTAMENTE igual que
//     uno inexistente (404 genérico): el endpoint no debe funcionar como
//     oráculo de existencia.
//   - El rol se re-deriva del propio Membership — nunca se copia el rol
//     que el usuario tenía en el negocio anterior.

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetBusinessId = typeof body.business_id === 'string' ? body.business_id.trim() : '';
    if (!targetBusinessId) return Response.json({ error: 'business_id es requerido' }, { status: 400 });

    const sr = base44.asServiceRole;
    const memberships = await sr.entities.Membership.filter({ user_id: user.id, business_id: targetBusinessId }, undefined, 1);
    const membership = memberships?.[0] || null;

    // Misma respuesta que un negocio inexistente: no confirma ni niega que
    // targetBusinessId sea un negocio real al que el caller no pertenece.
    if (!membership) {
      return Response.json({ error: 'No encontramos ese negocio.' }, { status: 404 });
    }

    await sr.entities.User.update(user.id, {
      business_id: membership.business_id,
      role: membership.role,
    });

    return Response.json({ success: true, business_id: membership.business_id, role: membership.role });
  } catch (error) {
    console.error('[switchBusinessSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
