import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Platform admin only: manually update a tenant license.
 * Used to activate licenses, change plans, add payment references, etc.
 */
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

// Fields that must be persisted as strict booleans — SDK may drop them in multi-field
// updates if the column was added after initial records were created.
const BOOLEAN_FIELDS = ['auto_renewal'];

const PLAN_LIMITS = { start: 4, growth: 10, pro: 20 };

function datesEqual(a: unknown, b: unknown): boolean {
  try {
    return new Date(a as string).toISOString() === new Date(b as string).toISOString();
  } catch {
    return false;
  }
}

function valuesMatch(key: string, want: unknown, got: unknown): boolean {
  if (want === got) return true;
  // Normalize date-time strings to avoid format/timezone false positives
  if (typeof want === 'string' && typeof got === 'string') return datesEqual(want, got);
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
    if (user.email !== PLATFORM_OWNER_EMAIL) return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });

    const body = await req.json();
    const { business_id, updates } = body;

    if (!business_id) return Response.json({ error: 'business_id is required' }, { status: 400 });
    if (!updates || typeof updates !== 'object') return Response.json({ error: 'updates required' }, { status: 400 });

    const sanitized: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) sanitized[key] = updates[key];
    }

    if (Object.keys(sanitized).length === 0) return Response.json({ error: 'No valid fields to update' }, { status: 400 });

    // Explicit boolean coercion — prevents SDK from silently dropping typed booleans
    for (const f of BOOLEAN_FIELDS) {
      if (f in sanitized) sanitized[f] = Boolean(sanitized[f]);
    }

    // Auto-set license_activated_at and activated_by_admin when activating
    if (sanitized.billing_status === 'active') {
      if (!sanitized.license_activated_at) sanitized.license_activated_at = new Date().toISOString();
      if (!sanitized.activated_by_admin) sanitized.activated_by_admin = user.email || 'platform-admin';
    }

    // Auto-set licensed_user_limit based on plan if plan changes
    if (sanitized.license_plan && !('licensed_user_limit' in sanitized)) {
      sanitized.licensed_user_limit = PLAN_LIMITS[sanitized.license_plan as string] || 4;
    }

    console.log('[adminUpdateTenantLicense] updating', business_id, 'with', sanitized);

    await base44.asServiceRole.entities.Business.update(business_id, sanitized);

    // Re-fetch to verify persistence — SDK may silently drop some fields
    let fresh = (await base44.asServiceRole.entities.Business.filter({ id: business_id }))[0];
    if (!fresh) {
      return Response.json({ error: 'Business not found after update' }, { status: 500 });
    }

    // Detect any field that didn't persist (compare sanitized → fresh)
    const mismatches: Array<{ field: string; requested: unknown; persisted: unknown }> = [];
    for (const key of Object.keys(sanitized)) {
      if (!valuesMatch(key, sanitized[key], fresh[key])) {
        mismatches.push({ field: key, requested: sanitized[key], persisted: fresh[key] });
      }
    }

    // Targeted retry for boolean fields that weren't persisted — workaround for
    // SDK dropping new boolean columns in multi-field updates
    const boolMismatches = mismatches.filter(m => BOOLEAN_FIELDS.includes(m.field));
    if (boolMismatches.length > 0) {
      const retryPayload: Record<string, unknown> = {};
      for (const m of boolMismatches) retryPayload[m.field] = Boolean(m.requested);
      console.warn('[adminUpdateTenantLicense] retry boolean-only update', retryPayload);
      await base44.asServiceRole.entities.Business.update(business_id, retryPayload);
      fresh = (await base44.asServiceRole.entities.Business.filter({ id: business_id }))[0];
    }

    // Final mismatch check after retry
    const finalMismatches: Array<{ field: string; requested: unknown; persisted: unknown }> = [];
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
      return Response.json({
        success: false,
        error: 'Some fields failed to persist after retry',
        mismatches: finalMismatches,
        business_id,
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      business_id,
      updated_fields: Object.keys(sanitized),
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
});
