import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Called right after a new business is created.
 * Sets up the 30-day trial using server-side time.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { business_id } = body;

    if (!business_id) return Response.json({ error: 'business_id is required' }, { status: 400 });
    if (business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 30);

    await base44.asServiceRole.entities.Business.update(business_id, {
      trial_start_at: now.toISOString(),
      trial_end_at: trialEnd.toISOString(),
      billing_status: 'trial',
      license_plan: 'start',
      licensed_user_limit: 4,
    });

    // Queue trial_welcome email — non-fatal if it fails
    try {
      const bizUsers = await base44.asServiceRole.entities.User.filter({ business_id });
      const admin = bizUsers.find((u: any) => u.role === 'admin') || bizUsers[0];
      if (admin?.email) {
        await base44.asServiceRole.entities.EmailNotification.create({
          business_id,
          email_type: 'trial_welcome',
          recipient_email: admin.email,
          status: 'pending',
          retry_count: 0,
        });
      }
    } catch (_) {
      console.warn('[initTenantTrial] Failed to queue trial_welcome email');
    }

    return Response.json({
      success: true,
      trial_start_at: now.toISOString(),
      trial_end_at: trialEnd.toISOString(),
      trial_days: 30,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});