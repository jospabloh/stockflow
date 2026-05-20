import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

/**
 * Scheduled daily job that queues and sends all lifecycle billing emails:
 * - Trial milestone reminders (day 15, 25, 28, 30)
 * - Trial expiry / view-only / archive / delete transitions
 * - License expiry reminders for non-auto-renewal (7d, 3d, 1d)
 * - Renewal charge reminders for auto-renewal (3d, 2d, 1d before renewal date)
 *
 * Delegates fully to checkAccountLifecycle which handles queuing + sending in one pass.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const validCron = cronSecretEnv && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );
    if (!validCron) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || (user.email !== PLATFORM_OWNER_EMAIL && user.role !== 'admin')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const result = await base44.asServiceRole.functions.invoke('checkAccountLifecycle', body);
    console.log('[queueBillingReminders] checkAccountLifecycle result:', JSON.stringify(result));
    return Response.json({ success: true, delegated_to: 'checkAccountLifecycle', ...result });

  } catch (error) {
    console.error('[queueBillingReminders] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
