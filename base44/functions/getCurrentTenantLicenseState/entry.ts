import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
    if (user.email === PLATFORM_OWNER_EMAIL) {
      return Response.json({
        is_platform_admin: true,
        billing_status: 'active',
        effective_status: 'active',
        trial_days_left: null,
        trial_start_at: null,
        trial_end_at: null,
        license_plan: 'pro',
        licensed_user_limit: 999,
        active_user_count: null,
        license_activated_at: null,
        next_renewal_at: null,
        is_read_only: false,
      });
    }

    if (!user.business_id) {
      return Response.json({
        is_platform_admin: false,
        billing_status: null,
        effective_status: null,
        trial_days_left: null,
        trial_start_at: null,
        trial_end_at: null,
        license_plan: null,
        licensed_user_limit: null,
        active_user_count: null,
        license_activated_at: null,
        next_renewal_at: null,
        is_read_only: false,
      });
    }

    // Fetch business and tenant users
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses?.[0];

    if (!biz) {
      return Response.json({
        is_platform_admin: false,
        billing_status: null,
        effective_status: null,
        trial_days_left: null,
        trial_start_at: null,
        trial_end_at: null,
        license_plan: null,
        licensed_user_limit: null,
        active_user_count: null,
        license_activated_at: null,
        next_renewal_at: null,
        is_read_only: false,
      });
    }

    // Fetch tenant users to count active ones
    const allUsers = await base44.asServiceRole.entities.User.list();
    const tenantUsers = allUsers.filter(u => u.business_id === biz.id);

    // === UNIFIED LICENSE STATE RESOLUTION (same as adminGetAllLicenses) ===
    const now = new Date();
    let billingStatus = biz.billing_status || 'trial';
    let trialDaysLeft = null;
    let isReadOnly = false;

    // If trial: check if expired
    if (billingStatus === 'trial' && biz.trial_end_at) {
      const trialEnd = new Date(biz.trial_end_at);
      if (trialEnd <= now) {
        // Trial expired → automatically become view_only
        billingStatus = 'view_only';
        isReadOnly = true;
      } else {
        // Still in trial
        trialDaysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
      }
    }

    // view_only and suspended always read-only
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      isReadOnly = true;
    }

    // Normalize effective_status for display
    let effectiveStatus = billingStatus;
    if (billingStatus === 'view_only') {
      effectiveStatus = 'expired';
    }

    // Next renewal date for active licenses
    let nextRenewalAt = null;
    if (billingStatus === 'active' && biz.license_activated_at) {
      const activated = new Date(biz.license_activated_at);
      nextRenewalAt = new Date(activated);
      nextRenewalAt.setMonth(nextRenewalAt.getMonth() + 1);
    }

    // Active user count (from actual tenant users)
    const activeUserCount = tenantUsers.length;

    return Response.json({
      is_platform_admin: false,
      billing_status: billingStatus,
      effective_status: effectiveStatus,
      trial_days_left: trialDaysLeft,
      trial_start_at: biz.trial_start_at || null,
      trial_end_at: biz.trial_end_at || null,
      license_plan: biz.license_plan || 'start',
      licensed_user_limit: biz.licensed_user_limit || 4,
      active_user_count: activeUserCount,
      license_activated_at: biz.license_activated_at || null,
      next_renewal_at: nextRenewalAt,
      is_read_only: isReadOnly,
    });
  } catch (error) {
    console.error('getCurrentTenantLicenseState error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});