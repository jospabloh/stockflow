// Users included per plan — must match the public pricing page
// (acaciaco-site apps/stockflow.html: Start 2, Growth 5, Pro unlimited).
// Identical copies: licenses/handlers/_planLimits.ts and
// business/handlers/_planLimits.ts (Deno can't import across function
// directories); client copy: src/lib/planLimits.js. 999 = unlimited.
// base44/tests/plan_limits_test.ts fails if any of them drift.
export const UNLIMITED_USERS = 999;

export const PLAN_LIMITS: Record<string, number> = {
  start: 2,
  growth: 5,
  pro: UNLIMITED_USERS,
  founder: UNLIMITED_USERS,
};

const NEXT_PLAN: Record<string, { id: string; label: string }> = {
  start: { id: 'growth', label: 'Growth' },
  growth: { id: 'pro', label: 'Pro' },
};

export function userLimitFor(plan: string | null | undefined): number {
  return PLAN_LIMITS[plan ?? ''] ?? PLAN_LIMITS.start;
}

// The plan to recommend when a business runs out of seats; null at the top.
export function nextPlanFor(plan: string | null | undefined): { id: string; label: string } | null {
  return NEXT_PLAN[plan ?? 'start'] ?? null;
}
