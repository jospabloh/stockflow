import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { getAuthUser } from '../../../shared/authUser.ts';

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
// UN USUARIO, UN NEGOCIO (2026-09-10): rechaza a un caller que ya pertenece a
// otro negocio. Durante un tiempo se permitió crear un segundo, apoyado en un
// selector que dejaba volver al primero; ese selector se retiró (nunca llegó a
// producción), así que sin este rechazo el negocio original quedaría
// inalcanzable en cuanto `business_id` se moviera al nuevo.

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'BSNS-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Un usuario, un negocio: quien ya pertenece a uno no puede crear otro.
    // Se comprueba ANTES de crear el Business, para no dejar un negocio
    // huérfano con su código de invitación vivo y nadie dentro.
    // La decisión sale de una lectura FRESCA del User guardado (módulo 22), no de
    // la vista cacheada de auth.me(): con un `business_id` viejo (vacío) una
    // segunda llamada pasaría y movería al usuario a un segundo negocio,
    // dejando el primero inalcanzable. Falla cerrado si no se puede leer.
    const fresh = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0];
    if (!fresh) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (fresh.business_id) {
      return Response.json({ error: 'already_in_a_business' }, { status: 409 });
    }

    // Una solicitud pendiente para unirse a otro negocio también cuenta como
    // "ya tienes un negocio": hay que cancelarla antes de crear uno propio, o el
    // usuario acabaría con un negocio y una solicitud abierta al mismo tiempo
    // (2026-09-30). Igual que arriba, se comprueba ANTES de crear el Business.
    const pendingRequests = await base44.asServiceRole.entities.JoinRequest.filter({ user_id: user.id, status: 'pending' });
    if (pendingRequests.length > 0) {
      return Response.json({ error: 'pending_join_request' }, { status: 409 });
    }

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
    //
    // NOTE: `status` is NOT passed here. After the Módulo 14 closure (2026-08-24),
    // `Business.status` carries `rls.write: {role: admin}`. A brand-new user has
    // role `almacenista` (the default), so explicitly sending `status: 'active'`
    // was rejected by the field-level RLS and caused a 500. The field defaults to
    // `'active'` in the schema, so omitting it produces the same result without
    // the RLS violation.
    const business = await base44.entities.Business.create({
      name,
      phone,
      address,
      invite_code: generateInviteCode(),
      tax_rate: 16,
      currency: 'MXN',
    });

    const sr = base44.asServiceRole;

    // `tenant_id` = id propio: la regla RLS `{id: {{user.data.business_id}}}` no
    // empareja (devuelve [] / 404 al dueño); `data.tenant_id` sí, y read/update de
    // Business la usan. Va ANTES de asignar al usuario y, si falla, se borra el
    // negocio recién creado para no dejar un tenant a medias e inalcanzable.
    // Solo el servicio puede escribirlo (candado de campo: role admin).
    try {
      await sr.entities.Business.update(business.id, { tenant_id: business.id });
    } catch (e) {
      console.error('[createBusinessSafe] tenant_id', e);
      await sr.entities.Business.delete(business.id).catch(() => {});
      return Response.json({ error: 'No se pudo crear el negocio' }, { status: 500 });
    }

    // Grant business_id + admin tier via the service role — this is the one
    // privileged write this whole function exists to gate. Bounded to exactly
    // the business we just created for exactly this caller.
    await sr.entities.User.update(user.id, {
      business_id: business.id,
      // 'owner', NOT built-in 'admin': every RLS rule carries a
      // user_condition:{role:"admin"} branch (the service-role tier) that is
      // NOT scoped to a tenant, so a business admin stored as 'admin' could
      // read and write every other business (verified live 2026-09-24).
      role: 'owner',
    });

    return Response.json({ success: true, business: { ...business, tenant_id: business.id } });
  } catch (error) {
    console.error('[createBusinessSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}