import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const DAY_MS = 24 * 60 * 60 * 1000;

async function getAdminEmail(base44: any, businessId: string): Promise<string | null> {
  try {
    const users = await base44.asServiceRole.entities.User.filter({ business_id: businessId });
    const admin = users.find((u: any) => u.role === 'admin');
    return admin?.email || null;
  } catch (_) {
    return null;
  }
}

async function queueEmail(
  base44: any,
  businessId: string,
  emailType: string,
  recipientEmail: string
): Promise<boolean> {
  if (!recipientEmail) return false;
  try {
    const existing = await base44.asServiceRole.entities.EmailNotification.filter({
      business_id: businessId,
    });
    const alreadyQueued = existing.find(
      (e: any) => e.email_type === emailType && (e.status === 'pending' || e.status === 'sent')
    );
    if (alreadyQueued) return false;
    await base44.asServiceRole.entities.EmailNotification.create({
      business_id: businessId,
      email_type: emailType,
      recipient_email: recipientEmail,
      status: 'pending',
      retry_count: 0,
    });
    return true;
  } catch (_) {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: cron secret OR platform admin
    const cronSecret = req.headers.get('x-cron-secret');
    const validCron = cronSecret && cronSecret === Deno.env.get('CRON_SECRET');
    if (!validCron) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.email !== PLATFORM_OWNER_EMAIL) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Self-gate: only run on day 1 of month unless force=true in body
    const body = await req.json().catch(() => ({}));
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
    let upcomingQueued = 0;

    for (const biz of autoRenewalBizs) {
      const expiresAt = new Date(biz.license_expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
      const adminEmail = await getAdminEmail(base44, biz.id);

      // 5 days before expiry: queue renewal_upcoming reminder
      if (daysUntilExpiry <= 5 && daysUntilExpiry > 0 && adminEmail) {
        const q = await queueEmail(base44, biz.id, 'renewal_upcoming', adminEmail);
        if (q) upcomingQueued++;
      }

      // On/past expiry: extend by 1 month and queue confirmation
      if (expiresAt <= now) {
        const newExpiry = new Date(expiresAt);
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        await base44.asServiceRole.entities.Business.update(biz.id, {
          license_expires_at: newExpiry.toISOString(),
          license_activated_at: nowISO,
        });
        renewed++;
        if (adminEmail) {
          await queueEmail(base44, biz.id, 'renewal_confirmed', adminEmail);
        }
        console.log(`[processMonthlyRenewal] Renewed ${biz.name} → new expiry ${newExpiry.toISOString()}`);
      }
    }

    return Response.json({
      success: true,
      run_at: nowISO,
      auto_renewal_checked: autoRenewalBizs.length,
      renewed,
      upcoming_queued: upcomingQueued,
    });

  } catch (error: any) {
    console.error('[processMonthlyRenewal] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
