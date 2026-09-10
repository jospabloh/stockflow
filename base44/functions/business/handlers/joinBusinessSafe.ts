import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// joinBusinessSafe — server-side counterpart of the "Unirme a un equipo" flow
// in src/pages/BusinessSetup.jsx.
//
// Why this exists: joining a business used to validate the invite code
// client-side and then set `business_id`/`role` on the caller directly via
// `base44.auth.updateMe({ business_id, role: "almacenista" })`. Because User
// had no field-level write RLS on those fields, a client could skip the
// invite-code check entirely and call `updateMe({ business_id: '<any-id>' })`
// directly to join ANY business without ever knowing its invite code — the
// `data.business_id` RLS branch on all business-scoped entities grants full
// read/write to any member regardless of role, so this alone is a full tenant
// takeover, no role escalation required.
//
// This function re-derives the same invite-code validation the client used to
// do, but authoritatively via base44.asServiceRole (bypassing any ambiguity in
// what an unauthenticated-for-this-business caller can read directly), and is
// now the ONLY sanctioned way business_id/role get set for a joining user.
//
// DEPLOY ORDER: see createBusinessSafe.ts — deploy this function before the
// User schema's field-level RLS lock on role/business_id.
//
// UN USUARIO, UN NEGOCIO (2026-09-10): rechaza al caller que ya pertenece a
// otro negocio. Redimir un código mueve el `business_id` activo, y sin el
// selector de negocio (retirado, nunca llegó a producción) eso dejaría el
// negocio anterior inalcanzable. Redimir el código del negocio en el que ya
// estás sigue siendo idempotente, no un error.

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = typeof body.invite_code === 'string' ? body.invite_code.trim().toUpperCase() : '';
    if (!code) return Response.json({ error: 'invite_code es requerido' }, { status: 400 });

    const sr = base44.asServiceRole;

    const businesses = await sr.entities.Business.filter({ invite_code: code });
    if (businesses.length === 0) {
      return Response.json({ error: 'invalid_code' }, { status: 404 });
    }
    const business = businesses[0];

    if (business.invite_code_active === false) {
      return Response.json({ error: 'code_disabled' }, { status: 403 });
    }
    if (business.status !== 'active') {
      return Response.json({ error: 'business_inactive' }, { status: 403 });
    }

    // Un usuario, un negocio: quien ya pertenece a otro no puede unirse aquí.
    // Redimir el código del negocio en el que YA estás es idempotente — no
    // mueve nada y no es un error.
    if (user.business_id && user.business_id !== business.id) {
      return Response.json({ error: 'already_in_a_business' }, { status: 409 });
    }

    const role = user.business_id === business.id ? (user.role || 'almacenista') : 'almacenista';
    await sr.entities.User.update(user.id, {
      business_id: business.id,
      role,
    });

    return Response.json({ success: true, business: { id: business.id, name: business.name } });
  } catch (error) {
    console.error('[joinBusinessSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
