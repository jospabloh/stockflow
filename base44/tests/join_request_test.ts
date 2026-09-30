// Joining a business by code files a request; only an owner/admin of that
// business turns it into access (2026-09-30). These pin the decision rules.
import { planJoin, planResolution, storedRoleFor, APPROVABLE_ROLES } from '../functions/business/handlers/_joinRequest.ts';

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

const base = {
  decision: 'approve',
  role: 'almacenista',
  callerBusinessId: 'b1',
  request: { id: 'r1', business_id: 'b1', user_id: 'u2', status: 'pending' },
  requester: { id: 'u2' },
  business: { id: 'b1', status: 'active', license_plan: 'growth' },
  memberCount: 1,
};

Deno.test('role whitelist: admin is stored as owner, never a platform role', () => {
  eq(storedRoleFor('admin'), 'owner', 'admin');
  eq(storedRoleFor('almacenista'), 'almacenista', 'almacenista');
  eq(storedRoleFor('owner'), null, 'owner is not an app role name');
  eq(storedRoleFor('super'), null, 'unknown');
  eq(APPROVABLE_ROLES.length, 2, 'only two');
});

Deno.test('approve with a valid role and a free seat writes', () => {
  const r = planResolution(base);
  eq(r.ok, true, 'ok');
  eq(r.mode, 'approve', 'mode');
  eq(r.storedRole, 'almacenista', 'role');
  eq(planResolution({ ...base, role: 'admin' }).storedRole, 'owner', 'admin -> owner');
});

Deno.test('approve rejects a role outside the whitelist', () => {
  for (const role of ['owner', 'superadmin', '', undefined, 'admin '])
    eq(planResolution({ ...base, role }).status, 400, `role ${role}`);
});

Deno.test('a request of another business looks like a missing one', () => {
  const foreign = { ...base, request: { ...base.request, business_id: 'b2' } };
  eq(planResolution(foreign).status, 404, 'foreign');
  eq(planResolution({ ...base, request: null }).status, 404, 'missing');
  eq(planResolution({ ...base, callerBusinessId: undefined }).status, 404, 'caller without business');
});

Deno.test('only a pending request can be decided', () => {
  for (const status of ['approved', 'rejected', 'canceled'])
    eq(planResolution({ ...base, request: { ...base.request, status } }).status, 409, status);
});

Deno.test('approve is blocked by the plan seat limit and the request stays pending', () => {
  const r = planResolution({ ...base, memberCount: 5 });
  eq(r.ok, false, 'blocked');
  eq(r.status, 403, 'status');
  eq(r.body?.error, 'user_limit_reached', 'error');
  eq(r.body?.limit, 5, 'limit');
  eq(r.body?.next_plan, 'pro', 'next plan');
  // start plan, 2 seats
  eq(planResolution({ ...base, business: { ...base.business, license_plan: 'start' }, memberCount: 2 }).status, 403, 'start');
  // explicit licensed_user_limit wins
  eq(planResolution({ ...base, business: { ...base.business, licensed_user_limit: 10 }, memberCount: 5 }).mode, 'approve', 'limit override');
});

Deno.test('reject needs no role and no seat', () => {
  const r = planResolution({ ...base, decision: 'reject', role: undefined, memberCount: 99 });
  eq(r.ok, true, 'ok');
  eq(r.mode, 'reject', 'mode');
});

Deno.test('a requester who already belongs somewhere else is never moved', () => {
  eq(planResolution({ ...base, requester: { id: 'u2', business_id: 'b9' } }).mode, 'cancel_stale', 'elsewhere');
  eq(planResolution({ ...base, requester: null }).mode, 'cancel_stale', 'deleted user');
  eq(planResolution({ ...base, requester: { id: 'u2', business_id: 'b1' } }).mode, 'already_member', 'retry after half-done approval');
});

Deno.test('approve on an inactive business is refused', () => {
  eq(planResolution({ ...base, business: { ...base.business, status: 'suspended' } }).status, 403, 'inactive');
  eq(planResolution({ ...base, business: null }).status, 403, 'no business');
});

Deno.test('unknown decision is a 400', () => {
  eq(planResolution({ ...base, decision: 'maybe' }).status, 400, 'maybe');
});

Deno.test('joining: one user, one business, never instant access', () => {
  eq(planJoin({ userBusinessId: undefined, targetBusinessId: 'b1', openRequest: null }), 'create', 'new request');
  eq(planJoin({ userBusinessId: 'b1', targetBusinessId: 'b1', openRequest: null }), 'already_member', 'own business idempotent');
  eq(planJoin({ userBusinessId: 'b0', targetBusinessId: 'b1', openRequest: null }), 'already_in_a_business', '409');
  eq(planJoin({ userBusinessId: undefined, targetBusinessId: 'b1', openRequest: { business_id: 'b1' } }), 'same_request', 'refile same');
  eq(planJoin({ userBusinessId: undefined, targetBusinessId: 'b1', openRequest: { business_id: 'b2' } }), 'pending_request_exists', 'other pending');
});
