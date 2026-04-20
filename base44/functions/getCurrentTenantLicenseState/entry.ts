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
      console.error('[getCurrentTenantLicenseState] User has no business_id:', user.email);
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

    // STRICT TENANT RESOLUTION: filter by exact user.business_id to avoid
    // pagination gaps that .list() would introduce on large datasets
    const matches = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = matches[0];

    console.log('[getCurrentTenantLicenseState] User:', user.email, 'business_id:', user.business_id, 'found:', !!biz);

    // HARD GUARD: business must exist and ID must match exactly
    if (!biz || biz.id !== user.business_id) {
      console.error('[getCurrentTenantLicenseState] HARD FAIL: business not found for id:', user.business_id);
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

    // Fetch only this tenant's users — filter avoids pagination issues
    const tenantUsers = await base44.asServiceRole.entities.User.filter({ business_id: biz.id });

    console.log('[getCurrentTenantLicenseState] Tenant users for', biz.name, ':', tenantUsers.length);

    // === UNIFIED LICENSE STATE RESOLUTION ===
    const now = new Date();
    let billingStatus = biz.billing_status || 'trial';
    let trialDaysLeft = null;
    let isReadOnly = false;

    if (billingStatus === 'trial' && biz.trial_end_at) {
      const trialEnd = new Date(biz.trial_end_at);
      if (trialEnd <= now) {
        billingStatus = 'view_only';
        isReadOnly = true;
      } else {
        trialDaysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
      }
    }

    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      isReadOnly = true;
    }

    let effectiveStatus = billingStatus;
    if (billingStatus === 'view_only') {
      effectiveStatus = 'expired';
    }

    let nextRenewalAt = null;
    if (billingStatus === 'active' && biz.license_activated_at) {
      const activated = new Date(biz.license_activated_at);
      nextRenewalAt = new Date(activated);
      nextRenewalAt.setMonth(nextRenewalAt.getMonth() + 1);
    }

    return Response.json({
      is_platform_admin: false,
      billing_status: billingStatus,
      effective_status: effectiveStatus,
      trial_days_left: trialDaysLeft,
      trial_start_at: biz.trial_start_at || null,
      trial_end_at: biz.trial_end_at || null,
      license_plan: biz.license_plan || 'start',
      licensed_user_limit: biz.licensed_user_limit || 4,
      active_user_count: tenantUsers.length,
      license_activated_at: biz.license_activated_at || null,
      next_renewal_at: nextRenewalAt,
      is_read_only: isReadOnly,
    });
  } catch (error) {
    console.error('getCurrentTenantLicenseState error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
