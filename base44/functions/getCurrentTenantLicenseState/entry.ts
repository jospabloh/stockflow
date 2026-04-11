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

    // Fetch business using service role to ensure we get all fields
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

    let billingStatus = biz.billing_status || 'trial';
    let effectiveStatus = billingStatus;
    let trialDaysLeft = null;
    let isReadOnly = false;

    // Calculate trial expiration
    if (billingStatus === 'trial' && biz.trial_end_at) {
      const now = new Date();
      const end = new Date(biz.trial_end_at);
      if (end <= now) {
        effectiveStatus = 'expired';
        billingStatus = 'view_only';
        isReadOnly = true;
      } else {
        trialDaysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      }
    }

    // view_only and suspended are always read-only
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      effectiveStatus = billingStatus === 'suspended' ? 'suspended' : 'expired';
      isReadOnly = true;
    }

    // Calculate next renewal date for active licenses
    let nextRenewalAt = null;
    if (billingStatus === 'active' && biz.license_activated_at) {
      const activated = new Date(biz.license_activated_at);
      nextRenewalAt = new Date(activated);
      nextRenewalAt.setMonth(nextRenewalAt.getMonth() + 1);
    }

    // Get active user count if available
    const activeUserCount = biz.active_user_count !== undefined ? biz.active_user_count : null;

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