import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const ALLOWED_FIELDS = [
  'billing_status',
  'license_plan',
  'licensed_user_limit',
  'payment_reference',
  'activation_notes',
  'activated_by_admin',
  'license_activated_at',
  'license_expires_at',
  'trial_end_at',
  'auto_renewal',
  'view_only_since',
  'archived_at',
  'scheduled_delete_at',
];

const BOOLEAN_FIELDS = ['auto_renewal'];
const PLAN_LIMITS = { start: 4, growth: 10, pro: 20 };

function datesEqual(a, b) {
  try {
    return new Date(a).toISOString() === new Date(b).toISOString();
  } catch {
    return false;
  }
}

function valuesMatch(_key, want, got) {
  if (want === got) return true;
  if (typeof want === 'string' && typeof got === 'string') return datesEqual(want, got);
  return false;
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });

    const body = await req.json();
    const { business_id, updates } = body;

    if (!business_id) return Response.json({ error: 'business_id is required' }, { status: 400 });
    if (!updates || typeof updates !== 'object') return Response.json({ error: 'updates required' }, { status: 400 });

    const bizBefores = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const businessBefore = bizBefores[0];
    if (!businessBefore) return Response.json({ error: 'Business not found' }, { status: 404 });
    const previousBillingStatus = businessBefore.billing_status;

    const sanitized = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) sanitized[key] = updates[key];
    }

    if (Object.keys(sanitized).length === 0) return Response.json({ error: 'No valid fields to update' }, { status: 400 });

    for (const f of BOOLEAN_FIELDS) {
      if (f in sanitized) sanitized[f] = Boolean(sanitized[f]);
    }

    if (sanitized.billing_status === 'active') {
      if (!sanitized.license_activated_at) sanitized.license_activated_at = new Date().toISOString();
      if (!sanitized.activated_by_admin) sanitized.activated_by_admin = user.email || 'platform-admin';
      if (!sanitized.license_expires_at && !businessBefore.license_expires_at) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        sanitized.license_expires_at = expiry.toISOString();
      }
    }

    if (sanitized.license_plan && !('licensed_user_limit' in sanitized)) {
      sanitized.licensed_user_limit = PLAN_LIMITS[sanitized.license_plan] || 4;
    }

    console.log('[adminUpdateTenantLicense] updating', business_id, 'with', sanitized);

    const booleanUpdates = {};
    const otherUpdates = {};
    for (const [k, v] of Object.entries(sanitized)) {
      if (BOOLEAN_FIELDS.includes(k)) booleanUpdates[k] = v;
      else otherUpdates[k] = v;
    }

    if (Object.keys(otherUpdates).length > 0) {
      await base44.asServiceRole.entities.Business.update(business_id, otherUpdates);
    }

    let boolUpdateError = null;
    if (Object.keys(booleanUpdates).length > 0) {
      try {
        await base44.asServiceRole.entities.Business.update(business_id, booleanUpdates);
      } catch (e) {
        boolUpdateError = e;
        console.warn('[adminUpdateTenantLicense] boolean update failed', boolUpdateError?.message);
      }
    }

    await new Promise(r => setTimeout(r, 50));

    const freshArr = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    let fresh = freshArr[0];
    if (!fresh) {
      return Response.json({ error: 'Business not found after update' }, { status: 500 });
    }

    const mismatches = [];
    for (const key of Object.keys(sanitized)) {
      if (!valuesMatch(key, sanitized[key], fresh[key])) {
        mismatches.push({ field: key, requested: sanitized[key], persisted: fresh[key] });
      }
    }

    const boolMismatches = mismatches.filter(m => BOOLEAN_FIELDS.includes(m.field));
    if (boolMismatches.length > 0) {
      const retryPayload = {};
      for (const m of boolMismatches) retryPayload[m.field] = Boolean(m.requested);
      console.warn('[adminUpdateTenantLicense] retry boolean-only update', retryPayload);
      await base44.asServiceRole.entities.Business.update(business_id, retryPayload);
      const freshArr2 = await base44.asServiceRole.entities.Business.filter({ id: business_id });
      fresh = freshArr2[0];
    }

    const finalMismatches = [];
    for (const key of Object.keys(sanitized)) {
      if (!valuesMatch(key, sanitized[key], fresh[key])) {
        finalMismatches.push({ field: key, requested: sanitized[key], persisted: fresh[key] });
      }
    }

    console.log('[adminUpdateTenantLicense] persisted state', {
      auto_renewal: fresh.auto_renewal,
      billing_status: fresh.billing_status,
      license_plan: fresh.license_plan,
      licensed_user_limit: fresh.licensed_user_limit,
    });

    if (finalMismatches.length > 0) {
      const nonBoolFinalMismatches = finalMismatches.filter(m => !BOOLEAN_FIELDS.includes(m.field));
      if (nonBoolFinalMismatches.length === 0) {
        return Response.json({
          success: true,
          warning: 'auto_renewal no persistió a pesar del reintento',
          mismatches: finalMismatches,
          persisted: {
            auto_renewal: fresh.auto_renewal,
            billing_status: fresh.billing_status,
            license_plan: fresh.license_plan,
            licensed_user_limit: fresh.licensed_user_limit,
            license_expires_at: fresh.license_expires_at,
            payment_reference: fresh.payment_reference,
            activation_notes: fresh.activation_notes,
            activated_by_admin: fresh.activated_by_admin,
            license_activated_at: fresh.license_activated_at,
          },
          business_id,
        });
      }
      return Response.json({
        success: false,
        error: 'Some fields failed to persist after retry',
        mismatches: finalMismatches,
        business_id,
      }, { status: 500 });
    }

    let emailDispatch = null;
    if (previousBillingStatus !== 'active' && fresh.billing_status === 'active') {
      try {
        const tenantUsers = await base44.asServiceRole.entities.User.filter({ business_id });
        const admins = tenantUsers
          .filter((u) => u.role === 'admin' && u.email)
          .map((u) => ({ email: u.email, full_name: u.full_name || null }));

        if (admins.length > 0) {
          const jobs = admins.map((a) => ({
            email_type: 'license_activated',
            recipient_email: a.email,
            recipient_name: a.full_name,
            business_id,
            business_name: fresh.name || 'tu negocio',
            license_plan: fresh.license_plan ?? null,
            license_expires_at: fresh.license_expires_at ?? null,
          }));

          const appUrl = Deno.env.get('APP_URL');
          const cronSecret = Deno.env.get('CRON_SECRET');
          const sendHeaders = { 'Content-Type': 'application/json' };
          if (cronSecret) sendHeaders['x-cron-secret'] = cronSecret;
          const authHeader = req.headers.get('authorization');
          if (authHeader) sendHeaders['Authorization'] = authHeader;

          const sendResp = await fetch(`${appUrl}/functions/v1/sendLifecycleEmails`, {
            method: 'POST',
            headers: sendHeaders,
            body: JSON.stringify({ jobs }),
          });
          const sendData = await sendResp.json();
          emailDispatch = { sent: sendData.sent ?? 0, failed: sendData.failed ?? 0 };
          console.log('[adminUpdateTenantLicense] license_activated emails dispatched:', JSON.stringify(emailDispatch));
        }
      } catch (emailErr) {
        console.error('[adminUpdateTenantLicense] email dispatch failed (non-fatal):', (emailErr as Error).message);
        emailDispatch = { sent: 0, failed: -1 };
      }
    }

    return Response.json({
      success: true,
      business_id,
      updated_fields: Object.keys(sanitized),
      ...(emailDispatch !== null && { email_dispatch: emailDispatch }),
      persisted: {
        auto_renewal: fresh.auto_renewal,
        billing_status: fresh.billing_status,
        license_plan: fresh.license_plan,
        licensed_user_limit: fresh.licensed_user_limit,
        license_expires_at: fresh.license_expires_at,
        payment_reference: fresh.payment_reference,
        activation_notes: fresh.activation_notes,
        activated_by_admin: fresh.activated_by_admin,
        license_activated_at: fresh.license_activated_at,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
