import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req: Request) => {
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
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Self-gate: only run on day 1 of month unless force=true in body
    const forceRun = body?.force === true;
    if (!forceRun && new Date().getDate() !== 1) {
      return Response.json({ skipped: true, reason: 'Not the 1st of the month' });
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const businesses = await base44.asServiceRole.entities.Business.list();

    const autoRenewalBizs = businesses.filter(
      (b: any) => b.billing_status === 'active' && b.auto_renewal === true && b.license_expires_at
    );

    let renewed = 0;

    // Payment confirmation emails are now sent manually via confirmRenewalPayment after
    // the owner verifies the MP charge landed — not auto-dispatched here.
    for (const biz of autoRenewalBizs) {
      const expiresAt = new Date(biz.license_expires_at);

      // On/past expiry: extend by 1 month; owner confirms payment separately
      if (expiresAt <= now) {
        const newExpiry = new Date(expiresAt);
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        await base44.asServiceRole.entities.Business.update(biz.id, {
          license_expires_at: newExpiry.toISOString(),
          license_activated_at: nowISO,
        });
        renewed++;
        console.log(`[processMonthlyRenewal] Extended ${biz.name} → new expiry ${newExpiry.toISOString()}`);
      }
    }

    return Response.json({
      success: true,
      run_at: nowISO,
      auto_renewal_checked: autoRenewalBizs.length,
      renewed,
    });

  } catch (error: any) {
    console.error('[processMonthlyRenewal] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
