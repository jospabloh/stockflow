// Users included per plan — must match the public pricing page
// (acaciaco-site apps/stockflow.html: Start 2, Growth 5, Pro unlimited).
// Server copies: base44/functions/{licenses,business}/handlers/_planLimits.ts.
export const UNLIMITED_USERS = 999;

export const PLAN_USER_LIMITS = {
  start: 2,
  growth: 5,
  pro: UNLIMITED_USERS,
  founder: UNLIMITED_USERS,
};

export function userLimitFor(plan) {
  return PLAN_USER_LIMITS[plan] ?? PLAN_USER_LIMITS.start;
}

export function formatUserLimit(limit) {
  return limit >= UNLIMITED_USERS ? "Ilimitados" : String(limit);
}

const NEXT_PLAN = {
  start: { id: "growth", label: "Growth" },
  growth: { id: "pro", label: "Pro" },
};

// The plan to recommend when a business runs out of seats; null at the top.
export function nextPlanFor(plan) {
  return NEXT_PLAN[plan ?? "start"] ?? null;
}
