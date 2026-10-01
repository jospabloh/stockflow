import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { planJoin } from './_joinRequest.ts';

// joinBusinessSafe — server-side counterpart of the "Unirme a un equipo" flow
// in src/pages/BusinessSetup.jsx.
//
// SOLICITUD, NO ACCESO (2026-09-30): redeeming a valid code no longer writes
// `business_id`/`role` on the caller. It files a JoinRequest ('pending') and
// the user keeps seeing nothing of the business until an owner/admin of THAT
// business approves it and picks the role (business:resolveJoinRequest, the
// only writer of business_id for a joiner). Before this, whoever held the code
// (a forwarded WhatsApp message was enough) got read/write on the whole
// business at once.
//
// Kept from before:
//  - the code is validated server-side (asServiceRole), never by the client;
//  - a user belongs to ONE business (409 already_in_a_business); redeeming the
//    code of the business you already belong to is an idempotent no-op;
//  - the seat limit is checked, but at APPROVAL time (resolveJoinRequest).
//
// New: a user with a pending request cannot file another one for a different
// business (409 pending_request_exists) until they cancel it, and cannot
// create a business (createBusinessSafe answers 409 too). Refiling for the
// same business returns the existing request.
//
// DEPLOY ORDER: the JoinRequest entity must be deployed BEFORE this function
// (deploy:entities, then deploy). Without it the create below fails (500).

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
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

    // Fresh read of the caller's own row: the decision below hinges on
    // business_id, so don't trust the cached auth.me() view.
    const fresh = (await sr.entities.User.filter({ id: user.id }))[0] || user;
    const pending = await sr.entities.JoinRequest.filter({ user_id: user.id, status: 'pending' });

    const plan = planJoin({
      userBusinessId: fresh.business_id,
      targetBusinessId: business.id,
      openRequest: pending[0],
    });

    if (plan === 'already_in_a_business') {
      return Response.json({ error: 'already_in_a_business' }, { status: 409 });
    }
    if (plan === 'already_member') {
      return Response.json({ success: true, already_member: true, business: { id: business.id, name: business.name } });
    }
    if (plan === 'pending_request_exists') {
      return Response.json({
        error: 'pending_request_exists',
        business: { id: pending[0].business_id, name: pending[0].business_name ?? null },
      }, { status: 409 });
    }
    if (plan === 'same_request') {
      return Response.json({
        success: true,
        pending: true,
        business: { id: business.id, name: business.name },
        request_id: pending[0].id,
      });
    }

    const request = await sr.entities.JoinRequest.create({
      business_id: business.id,
      business_name: business.name || '',
      user_id: user.id,
      user_email: user.email || '',
      user_name: user.full_name || '',
      status: 'pending',
    });

    return Response.json({
      success: true,
      pending: true,
      business: { id: business.id, name: business.name },
      request_id: request.id,
    });
  } catch (error) {
    console.error('[joinBusinessSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
