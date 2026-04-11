import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Scheduled daily job: finds all businesses with billing_status=trial
 * whose trial_end_at <= now, and transitions them to view_only.
 * Never deletes data. Never fully blocks login.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow CRON_SECRET header (scheduled invocation) or platform admin auth
    const cronSecret = req.headers.get('x-cron-secret');
    const validCron = cronSecret && cronSecret === Deno.env.get('CRON_SECRET');

    if (!validCron) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date().toISOString();
    const businesses = await base44.asServiceRole.entities.Business.list();

    const toExpire = businesses.filter(b =>
      b.billing_status === 'trial' &&
      b.trial_end_at &&
      b.trial_end_at <= now
    );

    let expiredCount = 0;
    const expiredNames = [];

    for (const biz of toExpire) {
      await base44.asServiceRole.entities.Business.update(biz.id, {
        billing_status: 'view_only'
      });
      expiredCount++;
      expiredNames.push(biz.name);
    }

    console.log(`[expireTrials] Checked ${businesses.length} businesses. Expired ${expiredCount}: ${expiredNames.join(', ')}`);

    return Response.json({
      success: true,
      checked: businesses.length,
      expired_count: expiredCount,
      expired_businesses: expiredNames,
      checked_at: now,
    });
  } catch (error) {
    console.error('[expireTrials] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});