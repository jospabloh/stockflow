/**
 * Shared license state resolver.
 * Used by both adminGetAllLicenses and getCurrentTenantLicenseState
 * to ensure consistent billing status calculation across the platform.
 * 
 * NOT EXPORTED FOR FRONTEND — internal server-side use only.
 */

export function resolveLicenseState(biz, tenantUsers = []) {
  const now = new Date();
  
  // Start with biz.billing_status or default to 'trial'
  let billingStatus = biz?.billing_status || 'trial';
  let trialDaysLeft = null;
  let isReadOnly = false;

  // If trial: check if expired
  if (billingStatus === 'trial' && biz?.trial_end_at) {
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
  if (billingStatus === 'active' && biz?.license_activated_at) {
    const activated = new Date(biz.license_activated_at);
    nextRenewalAt = new Date(activated);
    nextRenewalAt.setMonth(nextRenewalAt.getMonth() + 1);
  }

  // Active user count
  const activeUserCount = tenantUsers ? tenantUsers.length : 0;

  return {
    billing_status: billingStatus,
    effective_status: effectiveStatus,
    trial_days_left: trialDaysLeft,
    trial_start_at: biz?.trial_start_at || null,
    trial_end_at: biz?.trial_end_at || null,
    license_plan: biz?.license_plan || 'start',
    licensed_user_limit: biz?.licensed_user_limit || 4,
    active_user_count: activeUserCount,
    license_activated_at: biz?.license_activated_at || null,
    license_expires_at: biz?.license_expires_at || null,
    next_renewal_at: nextRenewalAt,
    is_read_only: isReadOnly,
    // Additional fields for admin view
    payment_reference: biz?.payment_reference || null,
    activation_notes: biz?.activation_notes || null,
    activated_by_admin: biz?.activated_by_admin || null,
  };
}