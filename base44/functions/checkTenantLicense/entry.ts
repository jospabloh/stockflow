import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Returns the license state for the current tenant.
 * Platform admin (role=admin, no business_id) gets a bypass response.
 * Grandfathers existing businesses with no billing_status as 'active'.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Platform admin: any user with role=admin
    const isPlatformAdmin = user.role === 'admin';

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

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    if (!businesses.length) return Response.json({ error: 'Business not found' }, { status: 404 });

    const biz = businesses[0];

    // Grandfather: existing businesses with no billing_status → treat as active
    const billingStatus = biz.billing_status || 'active';

    let trialDaysLeft = null;
    if (billingStatus === 'trial' && biz.trial_end_at) {
      const now = new Date();
      const end = new Date(biz.trial_end_at);
      trialDaysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    }

    // Count users belonging to this business
    const allUsers = await base44.asServiceRole.entities.User.list();
    const activeUserCount = allUsers.filter(u => u.business_id === user.business_id).length;

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
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});