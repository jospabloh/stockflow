// Pure rules for the join-by-code flow (no imports, so `deno test` loads it
// without npm:@base44/sdk). Used by joinBusinessSafe, cancelJoinRequest,
// listJoinRequests and resolveJoinRequest.
//
// Contract (2026-09-30): redeeming an invite code never grants access. It
// files a JoinRequest ('pending'); the user keeps no business_id and sees no
// data until an owner/admin of THAT business approves it and picks the role.
import { nextPlanFor, userLimitFor } from './_planLimits.ts';

// Roles an approver may hand out, in the app's own vocabulary. The platform
// tier (built-in 'admin') is never on this list; 'admin' of a business is
// stored as 'owner' (see createBusinessSafe).
export const APPROVABLE_ROLES = ['admin', 'almacenista'] as const;
export type ApprovableRole = typeof APPROVABLE_ROLES[number];

export function storedRoleFor(role: unknown): 'owner' | 'almacenista' | null {
  if (role === 'admin') return 'owner';
  if (role === 'almacenista') return 'almacenista';
  return null;
}

// Business admins as the platform stores them (legacy 'admin' still works).
export function isBusinessAdminRole(role: unknown): boolean {
  return role === 'owner' || role === 'admin';
}

export interface JoinRequestRow {
  id?: string;
  business_id?: string;
  user_id?: string;
  status?: string;
}

export interface Resolution {
  ok: boolean;
  status?: number;
  body?: Record<string, unknown>;
  // approve: write user + mark approved; already_member: user already sits in
  // the business (retry after a half-finished approval), only mark approved;
  // reject: mark rejected; cancel_stale: requester is gone/elsewhere, mark canceled.
  mode?: 'approve' | 'already_member' | 'reject' | 'cancel_stale';
  storedRole?: 'owner' | 'almacenista';
}

export function planResolution(p: {
  decision: unknown;
  role: unknown;
  callerBusinessId: string | undefined;
  request: JoinRequestRow | null | undefined;
  requester: { id?: string; business_id?: string } | null | undefined;
  business: { id?: string; status?: string; license_plan?: string; licensed_user_limit?: number } | null | undefined;
  memberCount: number;
}): Resolution {
  if (p.decision !== 'approve' && p.decision !== 'reject') {
    return { ok: false, status: 400, body: { error: 'decision debe ser approve o reject' } };
  }
  // Same answer for "does not exist" and "belongs to another business".
  if (!p.request || !p.callerBusinessId || p.request.business_id !== p.callerBusinessId) {
    return { ok: false, status: 404, body: { error: 'request_not_found' } };
  }
  if (p.request.status !== 'pending') {
    return { ok: false, status: 409, body: { error: 'request_not_pending', status: p.request.status } };
  }
  if (p.decision === 'reject') return { ok: true, mode: 'reject' };

  const storedRole = storedRoleFor(p.role);
  if (!storedRole) {
    return { ok: false, status: 400, body: { error: 'invalid_role', allowed: [...APPROVABLE_ROLES] } };
  }
  if (!p.requester) return { ok: true, mode: 'cancel_stale' };
  if (p.requester.business_id === p.callerBusinessId) {
    return { ok: true, mode: 'already_member', storedRole };
  }
  if (p.requester.business_id) {
    // Joined or created another business meanwhile: a user belongs to one.
    return { ok: true, mode: 'cancel_stale' };
  }
  if (!p.business || p.business.status !== 'active') {
    return { ok: false, status: 403, body: { error: 'business_inactive' } };
  }
  const limit = p.business.licensed_user_limit || userLimitFor(p.business.license_plan);
  if (p.memberCount >= limit) {
    const next = nextPlanFor(p.business.license_plan);
    return {
      ok: false,
      status: 403,
      body: {
        error: 'user_limit_reached',
        limit,
        plan: p.business.license_plan ?? null,
        next_plan: next?.id ?? null,
        next_plan_label: next?.label ?? null,
      },
    };
  }
  return { ok: true, mode: 'approve', storedRole };
}

// What joinBusinessSafe does with a code that already resolved to an active
// business, given who is asking and what they already have.
export function planJoin(p: {
  userBusinessId: string | undefined;
  targetBusinessId: string;
  openRequest: { business_id?: string } | null | undefined;
}): 'already_member' | 'already_in_a_business' | 'pending_request_exists' | 'same_request' | 'create' {
  if (p.userBusinessId) {
    return p.userBusinessId === p.targetBusinessId ? 'already_member' : 'already_in_a_business';
  }
  if (p.openRequest) {
    return p.openRequest.business_id === p.targetBusinessId ? 'same_request' : 'pending_request_exists';
  }
  return 'create';
}
