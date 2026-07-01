import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Platform admin only: returns all businesses with license info.
 * Gate: user.role === 'admin' (platform admin).
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });

    const businesses = await base44.asServiceRole.entities.Business.list();
    const allUsers = await base44.asServiceRole.entities.User.list();

    const now = new Date();

    const result = businesses.map(biz => {
      const tenantUsers = allUsers.filter(u => u.business_id === biz.id);
      
      // === UNIFIED LICENSE STATE RESOLUTION (same as getCurrentTenantLicenseState) ===
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

      // view_only, suspended and archived always read-only
      if (billingStatus === 'view_only' || billingStatus === 'suspended' || billingStatus === 'archived') {
        isReadOnly = true;
      }

      return {
        id: biz.id,
        name: biz.name,
        created_by: biz.created_by || '',
        billing_status: billingStatus,
        license_plan: biz.license_plan || 'start',
        licensed_user_limit: biz.licensed_user_limit || 4,
        trial_start_at: biz.trial_start_at || null,
        trial_end_at: biz.trial_end_at || null,
        trial_days_left: trialDaysLeft,
        license_activated_at: biz.license_activated_at || null,
        license_expires_at: biz.license_expires_at || null,
        payment_reference: biz.payment_reference || '',
        activation_notes: biz.activation_notes || '',
        activated_by_admin: biz.activated_by_admin || '',
        active_user_count: tenantUsers.length,
        is_read_only: isReadOnly,
        auto_renewal: biz.auto_renewal ?? false,
        status: biz.status || 'active',
        created_date: biz.created_date,
      };
    });

    // Sort: view_only first, then trial, then active
    const order = { view_only: 0, suspended: 1, trial: 2, active: 3 };
    result.sort((a, b) => (order[a.billing_status] ?? 9) - (order[b.billing_status] ?? 9));

    return Response.json({ success: true, businesses: result, total: result.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}