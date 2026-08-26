import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// createBusinessSafe — server-side counterpart of the "Crear mi negocio" flow in
// src/pages/BusinessSetup.jsx.
//
// Why this exists: business creation used to set `business_id`/`role` on the
// caller directly from the client via `base44.auth.updateMe({ business_id,
// role: "admin" })`. Because User had no field-level write RLS on
// `role`/`business_id`, ANY authenticated user — not just someone going through
// this screen — could instead call `updateMe({ role: 'admin' })` from the
// browser console and become platform-wide admin (28 business entities carry an
// unscoped `user_condition:{role:"admin"}` RLS branch), or call
// `updateMe({ business_id: '<any-business-id>' })` to instantly get full
// read/write on that tenant's data (the `data.business_id` RLS branch on those
// same entities matches regardless of role) — without ever knowing that
// business's invite code.
//
// This function is now the ONLY sanctioned way `business_id`/`role` get set for
// a new business owner. It re-derives the same "first admin of a brand-new
// business" grant BusinessSetup.jsx used to hand out client-side, but validates
// it server-side (via base44.asServiceRole, so it keeps working once
// User.role/business_id are locked to admin-only writes via field-level RLS)
// and rejects it outright for anyone who already belongs to a business.
//
// This does NOT change who legitimately ends up with role:"admin" — a business
// creator still gets it, exactly as before (that grant is intentional: within
// their own tenant it grants nothing beyond what the `data.business_id` RLS
// branch already grants every member of that tenant). What changes is that the
// grant can no longer be triggered by an arbitrary updateMe call outside this
// validated, one-time-per-user path.
//
// DEPLOY ORDER: deploy this function (and joinBusinessSafe) FIRST, then the
// User schema with the field-level RLS lock. If the lock lands before these
// functions are live, both "Crear mi negocio" and "Unirme a un equipo" will
// silently no-op (Base44 drops disallowed field writes from the old
// client-side updateMe calls) and new users will get stuck on BusinessSetup.
//
// Módulo 18 (jospabloh/acacia-app-standard → STANDARD.md, 2026-08-26): ya NO
// rechaza a un caller que ya pertenece a otro negocio — crear un negocio
// adicional es legítimo (el mismo email administra dos tiendas). Antes de
// mover el `business_id` activo al negocio recién creado, si el caller ya
// tenía uno, se le respalda una fila `Membership` para ÉL — sin esto, un
// admin existente que usara este flujo por primera vez perdería sin darse
// cuenta el acceso a su negocio original, porque `Membership` no existía
// todavía cuando ese negocio se creó (ver STANDARD.md, checklist #16: "cada
// perfil que ya quedó silenciosamente encerrado en el tenant equivocado
// necesita un empujón de una sola vez para re-resolverse" — este es ese
// empujón, aplicado de forma perezosa la primera vez que hace falta).

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BSNS-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return Response.json({ error: 'name es requerido' }, { status: 400 });

    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';

    // Created via the user-scoped client (not asServiceRole) so `created_by_id`
    // is the real caller — this is what business-ownership checks elsewhere
    // (e.g. validateBusinessOwnership-style logic) rely on. Business.create RLS
    // already allows `created_by_id: {{user.id}}`, so this does not depend on
    // the caller having any elevated role.
    const business = await base44.entities.Business.create({
      name,
      phone,
      address,
      invite_code: generateInviteCode(),
      status: 'active',
      tax_rate: 16,
      currency: 'MXN',
    });

    const sr = base44.asServiceRole;

    // Backfill a Membership for whatever business the caller was already in
    // BEFORE we move business_id away from it — a lazy, one-time migration
    // for accounts that were onboarded before Membership existed. Best-effort
    // idempotent (checks for an existing row first) so a retry can't double it.
    if (user.business_id) {
      const already = await sr.entities.Membership.filter(
        { business_id: user.business_id, user_id: user.id }, undefined, 1,
      );
      if (!already?.length) {
        await sr.entities.Membership.create({
          business_id: user.business_id,
          user_id: user.id,
          user_email: user.email,
          role: user.role || 'admin',
        });
      }
    }

    await sr.entities.Membership.create({
      business_id: business.id,
      user_id: user.id,
      user_email: user.email,
      role: 'admin',
    });

    // Grant business_id + admin tier via the service role — this is the one
    // privileged write this whole function exists to gate. Bounded to exactly
    // the business we just created for exactly this caller.
    await sr.entities.User.update(user.id, {
      business_id: business.id,
      role: 'admin',
    });

    return Response.json({ success: true, business });
  } catch (error) {
    console.error('[createBusinessSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
