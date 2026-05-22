import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Returns the license state for the current tenant.
 * Platform admin (role=admin, no business_id) gets a bypass response.
 * Grandfathers existing businesses with no billing_status as 'active'.
 */
Deno.serve(async (req) => {
  // Safe defaults — if anything fails, user gets view_only (safe)
  const safeDefault = {
    is_platform_admin: false,
    billing_status: 'view_only',
    trial_days_left: null,
    license_plan: 'start',
    licensed_user_limit: 4,
    active_user_count: 0,
  };

  let base44, user;
  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
  } catch (_) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
  const isPlatformAdmin = Boolean(PLATFORM_OWNER_EMAIL) && user.email === PLATFORM_OWNER_EMAIL;

  if (isPlatformAdmin) {
    return Response.json({
      is_platform_admin: true,
      billing_status: 'active',
      trial_days_left: null,
      license_plan: 'pro',
      licensed_user_limit: 999,
      active_user_count: 0,
    });
  }

  if (!user.business_id) {
    return Response.json({ is_platform_admin: false, billing_status: null, trial_days_left: null });
  }

  // Fetch business — safe, fallback to view_only if not found or error
  let biz = null;
  try {
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    biz = businesses?.[0] || null;
  } catch (_) {
    console.error('[checkTenantLicense] Error fetching business, returning safe default');
    return Response.json(safeDefault);
  }

  if (!biz) return Response.json(safeDefault);

  // Determine billing status with real-time trial expiry
  let billingStatus = biz.billing_status || 'active';

  if (billingStatus === 'trial' && biz.trial_end_at) {
    try {
      const now = new Date();
      const end = new Date(biz.trial_end_at);
      if (end <= now) {
        billingStatus = 'view_only';
        // Background update — fire and forget, never throws
        base44.asServiceRole.entities.Business.update(biz.id, { billing_status: 'view_only' }).catch(() => {});
      }
    } catch (_) { /* keep current billingStatus */ }
  }

  // Trial days left
  let trialDaysLeft = null;
  if (billingStatus === 'trial' && biz.trial_end_at) {
    try {
      const now = new Date();
      const end = new Date(biz.trial_end_at);
      trialDaysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    } catch (_) { /* leave null */ }
  }

  // Active user count — safe, default to 0 on error
  let activeUserCount = 0;
  try {
    const allUsers = await base44.asServiceRole.entities.User.list();
    activeUserCount = allUsers.filter(u => u.business_id === user.business_id).length;
  } catch (_) { /* leave 0 */ }

  return Response.json({
    is_platform_admin: false,
    billing_status: billingStatus,
    license_plan: biz.license_plan || 'start',
    licensed_user_limit: biz.licensed_user_limit || 4,
    trial_start_at: biz.trial_start_at || null,
    trial_end_at: biz.trial_end_at || null,
    license_expires_at: biz.license_expires_at || null,
    trial_days_left: trialDaysLeft,
    active_user_count: activeUserCount,
    business_name: biz.name,
  });
});