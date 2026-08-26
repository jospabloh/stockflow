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
// Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md, 2026-08-26): ya NO
// rechaza al caller por ya pertenecer a otro negocio — el único rechazo
// legítimo es ya-ser-miembro-de-ESTE-negocio, y eso es idempotente, no un
// error. Unirse mueve el business_id activo al negocio recién unido de
// inmediato (como createBusinessSafe/switchBusinessSafe); si el caller ya
// tenía un negocio, se le respalda una Membership antes de moverlo — mismo
// razonamiento y mismo código que createBusinessSafe.ts.

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

    // Backfill a Membership for the business the caller was already in (if
    // any) BEFORE moving business_id away from it — see createBusinessSafe.ts
    // for the full reasoning; same one-time, idempotent migration.
    if (user.business_id && user.business_id !== business.id) {
      const already = await sr.entities.Membership.filter(
        { business_id: user.business_id, user_id: user.id }, undefined, 1,
      );
      if (!already?.length) {
        await sr.entities.Membership.create({
          business_id: user.business_id,
          user_id: user.id,
          user_email: user.email,
          role: user.role || 'almacenista',
        });
      }
    }

    // Idempotent: redeeming a code for a business the caller already belongs
    // to is a no-op on Membership (keeps the role an admin may have already
    // granted), never an error — the invite code doesn't downgrade anyone.
    const existingHere = await sr.entities.Membership.filter(
      { business_id: business.id, user_id: user.id }, undefined, 1,
    );
    let role = existingHere?.[0]?.role || 'almacenista';
    if (!existingHere?.length) {
      await sr.entities.Membership.create({
        business_id: business.id,
        user_id: user.id,
        user_email: user.email,
        role,
      });
    }

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
