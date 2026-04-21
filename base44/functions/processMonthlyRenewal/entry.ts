import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const DAY_MS = 24 * 60 * 60 * 1000;

interface EmailJob {
  email_type: string;
  recipient_email: string;
  business_id: string;
  business_name: string;
  license_expires_at?: string | null;
}

async function getAdminEmails(base44: any, businessId: string): Promise<string[]> {
  try {
    const users = await base44.asServiceRole.entities.User.filter({ business_id: businessId });
    return users.filter((u: any) => u.role === 'admin').map((u: any) => u.email).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function scheduleEmail(
  jobs: EmailJob[],
  seen: Set<string>,
  emailType: string,
  recipientEmail: string,
  biz: any
): boolean {
  if (!recipientEmail) return false;
  const key = `${biz.id}:${emailType}:${recipientEmail}`;
  if (seen.has(key)) return false;
  seen.add(key);
  jobs.push({
    email_type: emailType,
    recipient_email: recipientEmail,
    business_id: biz.id,
    business_name: biz.name || 'tu negocio',
    license_expires_at: biz.license_expires_at ?? null,
  });
  return true;
}

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
      if (!user || user.email !== PLATFORM_OWNER_EMAIL) {
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

    const emailJobs: EmailJob[] = [];
    const seen = new Set<string>();
    let renewed = 0;
    let emailsQueued = 0;

    for (const biz of autoRenewalBizs) {
      const expiresAt = new Date(biz.license_expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
      const adminEmails = await getAdminEmails(base44, biz.id);

      // 5 days before expiry: FYI renewal upcoming
      if (daysUntilExpiry <= 5 && daysUntilExpiry > 0) {
        for (const email of adminEmails) {
          if (scheduleEmail(emailJobs, seen, 'renewal_upcoming', email, biz)) emailsQueued++;
        }
      }

      // On/past expiry: extend by 1 month and confirm
      if (expiresAt <= now) {
        const newExpiry = new Date(expiresAt);
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        const updatedBiz = { ...biz, license_expires_at: newExpiry.toISOString() };
        await base44.asServiceRole.entities.Business.update(biz.id, {
          license_expires_at: newExpiry.toISOString(),
          license_activated_at: nowISO,
        });
        renewed++;
        for (const email of adminEmails) {
          if (scheduleEmail(emailJobs, seen, 'renewal_confirmed', email, updatedBiz)) emailsQueued++;
        }
        console.log(`[processMonthlyRenewal] Renewed ${biz.name} → new expiry ${newExpiry.toISOString()}`);
      }
    }

    // Dispatch emails via sendLifecycleEmails
    let sendData: any = null;
    const appUrl = Deno.env.get('APP_URL');
    if (emailJobs.length > 0 && appUrl) {
      try {
        const sendHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (cronSecretEnv) sendHeaders['x-cron-secret'] = cronSecretEnv;
        const authHeader = req.headers.get('authorization');
        if (authHeader) sendHeaders['Authorization'] = authHeader;

        const sendResp = await fetch(`${appUrl}/functions/v1/sendLifecycleEmails`, {
          method: 'POST',
          headers: sendHeaders,
          body: JSON.stringify({ jobs: emailJobs }),
        });
        sendData = await sendResp.json();
        console.log('[processMonthlyRenewal] sendLifecycleEmails:', JSON.stringify(sendData));
      } catch (sendErr: any) {
        console.error('[processMonthlyRenewal] sendLifecycleEmails failed:', sendErr.message);
        sendData = { error: sendErr.message };
      }
    }

    return Response.json({
      success: true,
      run_at: nowISO,
      auto_renewal_checked: autoRenewalBizs.length,
      renewed,
      emails_queued: emailsQueued,
      emails: sendData,
    });

  } catch (error: any) {
    console.error('[processMonthlyRenewal] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
