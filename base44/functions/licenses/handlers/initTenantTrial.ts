import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { userLimitFor } from './_planLimits.ts';

/**
 * Called right after a new business is created.
 * Sets up the 30-day trial using server-side time.
 *
 * ONE-SHOT: it only runs on a business whose trial was never started
 * (`trial_start_at` empty) and that is still on its schema default
 * `billing_status: 'trial'`, and only for that business's owner/admin. Without
 * those checks any member (an almacenista included) could call it again at will
 * and reset a view_only/suspended/active business back to a fresh 30-day trial —
 * i.e. skip billing forever. Everything after the initial trial belongs to
 * Mission Control's lifecycle cron and the platform-owner license functions.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { business_id } = body;

    if (!business_id) return Response.json({ error: 'business_id is required' }, { status: 400 });
    if (business_id !== user.business_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (user.role !== 'owner' && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const business = await base44.asServiceRole.entities.Business.get(business_id).catch(() => null);
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });
    if (business.trial_start_at || (business.billing_status && business.billing_status !== 'trial')) {
      return Response.json({ error: 'trial_already_started' }, { status: 409 });
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 30);

    await base44.asServiceRole.entities.Business.update(business_id, {
      trial_start_at: now.toISOString(),
      trial_end_at: trialEnd.toISOString(),
      billing_status: 'trial',
      license_plan: 'start',
      licensed_user_limit: userLimitFor('start'),
    });

    // Queue trial_welcome email — non-fatal if it fails
    try {
      const bizUsers = await base44.asServiceRole.entities.User.filter({ business_id });
      const admin = bizUsers.find((u: any) => u.role === 'admin' || u.role === 'owner') || bizUsers[0];
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

    // Tell Mission Control about the new tenant from the SERVER. The browser
    // ping in BusinessSetup.jsx is fire-and-forget and can be lost (ad blocker,
    // network, tab closed) — on 2026-09-29 a real signup only reached the owner
    // through a manual sync. Idempotent on MC's side (known tenant / already
    // alerted → no-op), so it is fine that both pings exist. Never fatal.
    try {
      await fetch('https://control.acaciaco.com.mx/api/ingest/tenant-pull', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: 'stockflow', tenantId: business_id }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (_) {
      console.warn('[initTenantTrial] tenant-pull ping to Mission Control failed');
    }

    return Response.json({
      success: true,
      trial_start_at: now.toISOString(),
      trial_end_at: trialEnd.toISOString(),
      trial_days: 30,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}