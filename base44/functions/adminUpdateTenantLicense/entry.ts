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

const PLAN_LIMITS = { start: 4, growth: 10, pro: 20 };

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

    const sanitized = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) sanitized[key] = updates[key];
    }

    if (Object.keys(sanitized).length === 0) return Response.json({ error: 'No valid fields to update' }, { status: 400 });

    // Auto-set license_activated_at and activated_by_admin when activating
    if (sanitized.billing_status === 'active') {
      if (!sanitized.license_activated_at) sanitized.license_activated_at = new Date().toISOString();
      if (!sanitized.activated_by_admin) sanitized.activated_by_admin = user.email || 'platform-admin';
    }

    // Auto-set licensed_user_limit based on plan if plan changes
    if (sanitized.license_plan && !('licensed_user_limit' in sanitized)) {
      sanitized.licensed_user_limit = PLAN_LIMITS[sanitized.license_plan] || 4;
    }

    await base44.asServiceRole.entities.Business.update(business_id, sanitized);

    return Response.json({ success: true, business_id, updated_fields: Object.keys(sanitized) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});