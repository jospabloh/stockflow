import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { hasPermission } from './_permissions.ts';
import { isBusinessAdminRole, planResolution } from './_joinRequest.ts';

// resolveJoinRequest — an owner/admin approves (choosing the role) or rejects a
// pending join request. THE only place business_id/role get written for a
// joiner.
//
// Every check runs against stored data: the caller row and the request are
// re-read via asServiceRole; the request must belong to the caller's own
// business (a foreign id answers like a missing one); the role must be on the
// whitelist ('admin' → stored as owner, 'almacenista'), never a platform role.
// Needs a business admin role AND Configuracion:manage_team. Approving checks
// the plan's seat limit (user_limit_reached) and that the requester still
// belongs to no business, and only then writes.
//
// Order on approve: user first, request second. If the second write fails the
// request stays 'pending' and a retry lands on mode 'already_member', which
// reconciles the stored role with the selected one (if it differs) and
// finishes marking it.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const caller = (await sr.entities.User.filter({ id: user.id }))[0];
    if (!caller?.business_id) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });
    if (!isBusinessAdminRole(caller.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!(await hasPermission(sr, caller, 'Configuracion', 'manage_team'))) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Configuracion:manage_team' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body.request_id === 'string' ? body.request_id : '';
    if (!requestId) return Response.json({ error: 'request_id es requerido' }, { status: 400 });

    const request = (await sr.entities.JoinRequest.filter({ id: requestId }))[0] ?? null;
    const requester = request?.user_id
      ? (await sr.entities.User.filter({ id: request.user_id }))[0] ?? null
      : null;
    const business = await sr.entities.Business.get(caller.business_id).catch(() => null);
    const members = body.decision === 'approve'
      ? await sr.entities.User.filter({ business_id: caller.business_id })
      : [];

    const plan = planResolution({
      decision: body.decision,
      role: body.role,
      callerBusinessId: caller.business_id,
      request,
      requester,
      business,
      memberCount: members.length,
    });
    if (!plan.ok) return Response.json(plan.body, { status: plan.status });

    const now = new Date().toISOString();
    const decided = { decided_by_id: caller.id, decided_by_email: caller.email || '', decided_at: now };

    if (plan.mode === 'reject') {
      await sr.entities.JoinRequest.update(requestId, { status: 'rejected', ...decided });
      return Response.json({ success: true, status: 'rejected' });
    }
    if (plan.mode === 'cancel_stale') {
      await sr.entities.JoinRequest.update(requestId, { status: 'canceled', ...decided });
      return Response.json({ error: 'requester_unavailable' }, { status: 409 });
    }
    if (plan.mode === 'approve') {
      await sr.entities.User.update(request.user_id, {
        business_id: caller.business_id,
        role: plan.storedRole,
      });
    } else if (plan.mode === 'already_member' && requester?.role !== plan.storedRole) {
      // Retry path: the first attempt wrote business_id but may have died
      // before/while writing the role. Reconcile the stored role with the
      // approver's selection (same User.update write as the original) so
      // assigned_role below never disagrees with what the user actually has.
      await sr.entities.User.update(request.user_id, { role: plan.storedRole });
    }
    const assigned = plan.storedRole === 'owner' ? 'admin' : 'almacenista';
    await sr.entities.JoinRequest.update(requestId, { status: 'approved', assigned_role: assigned, ...decided });
    return Response.json({ success: true, status: 'approved', role: assigned });
  } catch (error) {
    console.error('[resolveJoinRequest]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
