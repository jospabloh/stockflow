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

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.business_id) {
      return Response.json({ error: 'already_has_business', business_id: user.business_id }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body.invite_code === 'string' ? body.invite_code.trim().toUpperCase() : '';
    if (!code) return Response.json({ error: 'invite_code es requerido' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ invite_code: code });
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

    await base44.asServiceRole.entities.User.update(user.id, {
      business_id: business.id,
      role: 'almacenista',
    });

    return Response.json({ success: true, business: { id: business.id, name: business.name } });
  } catch (error) {
    console.error('[joinBusinessSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
