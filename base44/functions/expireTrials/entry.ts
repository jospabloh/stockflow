import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * Scheduled daily job — now delegates to checkAccountLifecycle which handles
 * trial expiry plus the full lifecycle (view_only → archived → deleted).
 * Kept for backward-compatibility with existing cron schedule.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const cronSecret = req.headers.get('x-cron-secret');
    const validCron = cronSecret && cronSecret === Deno.env.get('CRON_SECRET');

    if (!validCron) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Delegate to checkAccountLifecycle via HTTP if APP_URL is configured
    const appUrl = Deno.env.get('APP_URL');
    if (appUrl) {
      const sharedHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cronSecret) sharedHeaders['x-cron-secret'] = cronSecret;
      const authHeader = req.headers.get('authorization');
      if (authHeader) sharedHeaders['Authorization'] = authHeader;

      try {
        const lifecycleResp = await fetch(`${appUrl}/functions/v1/checkAccountLifecycle`, {
          method: 'POST',
          headers: sharedHeaders,
        });
        const lifecycleData = await lifecycleResp.json();
        console.log('[expireTrials] checkAccountLifecycle:', JSON.stringify(lifecycleData));

        let sendData: unknown = null;
        try {
          const emailJobs = lifecycleData?.emails_to_send ?? [];
          const sendResp = await fetch(`${appUrl}/functions/v1/sendLifecycleEmails`, {
            method: 'POST',
            headers: sharedHeaders,
            body: JSON.stringify({ jobs: emailJobs }),
          });
          sendData = await sendResp.json();
          console.log('[expireTrials] sendLifecycleEmails:', JSON.stringify(sendData));
        } catch (sendErr: Error | unknown) {
          const sendError = sendErr instanceof Error ? (sendErr as Error).message : String(sendErr);
          console.error('[expireTrials] sendLifecycleEmails failed:', sendError);
          sendData = { error: sendError };
        }

        return Response.json({ success: true, delegated: true, lifecycle: lifecycleData, emails: sendData });
      } catch (fetchErr: Error | unknown) {
        const fetchError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.error('[expireTrials] Delegation fetch failed, running fallback:', fetchError);
      }
    }

    // Fallback: inline trial expiry logic (original behavior + view_only_since)
    const now = new Date().toISOString();
    const businesses = await base44.asServiceRole.entities.Business.list();

    const toExpire = businesses.filter((b: any) =>
      b.billing_status === 'trial' &&
      b.trial_end_at &&
      b.trial_end_at <= now
    );

    let expiredCount = 0;
    const expiredNames: string[] = [];

    for (const biz of toExpire) {
      await base44.asServiceRole.entities.Business.update(biz.id, {
        billing_status: 'view_only',
        view_only_since: now,
      });
      expiredCount++;
      expiredNames.push(biz.name);
    }

    console.log(`[expireTrials] Fallback: checked ${businesses.length}, expired ${expiredCount}: ${expiredNames.join(', ')}`);

    return Response.json({
      success: true,
      checked: businesses.length,
      expired_count: expiredCount,
      expired_businesses: expiredNames,
      checked_at: now,
    });
  } catch (error: Error | unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[expireTrials] Error:', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
