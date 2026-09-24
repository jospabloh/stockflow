// Users included per plan — must match the public pricing page
// (acaciaco-site apps/stockflow.html: Start 2, Growth 5, Pro unlimited).
// Client copy: src/lib/planLimits.js. 999 = unlimited.
export const UNLIMITED_USERS = 999;

export const PLAN_LIMITS: Record<string, number> = {
  start: 2,
  growth: 5,
  pro: UNLIMITED_USERS,
  founder: UNLIMITED_USERS,
};

export function userLimitFor(plan: string | null | undefined): number {
  return PLAN_LIMITS[plan ?? ''] ?? PLAN_LIMITS.start;
}
