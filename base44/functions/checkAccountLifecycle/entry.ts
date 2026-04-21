import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const DAY_MS = 24 * 60 * 60 * 1000;

interface EmailJob {
  email_type: string;
  recipient_email: string;
  business_id: string;
  business_name: string;
  license_expires_at?: string | null;
  scheduled_delete_at?: string | null;
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
    scheduled_delete_at: biz.scheduled_delete_at ?? null,
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

    const now = new Date();
    const nowISO = now.toISOString();
    const businesses = await base44.asServiceRole.entities.Business.list();

    const emailJobs: EmailJob[] = [];
    const seen = new Set<string>();

    const results = {
      trial:     { processed: 0, transitioned: 0, emails_queued: 0 },
      view_only: { processed: 0, archived: 0,      emails_queued: 0 },
      archived:  { processed: 0, deleted: 0,        emails_queued: 0 },
      active:    { processed: 0, transitioned: 0,  emails_queued: 0 },
    };

    // === SECTION A: TRIAL BUSINESSES ===
    for (const biz of businesses.filter((b: any) => b.billing_status === 'trial')) {
      results.trial.processed++;
      if (!biz.trial_start_at) continue;

      const trialStart = new Date(biz.trial_start_at);
      const daysElapsed = Math.floor((now.getTime() - trialStart.getTime()) / DAY_MS);
      const adminEmails = await getAdminEmails(base44, biz.id);

      // Trial expired — transition to view_only
      if (biz.trial_end_at && new Date(biz.trial_end_at) <= now) {
        await base44.asServiceRole.entities.Business.update(biz.id, {
          billing_status: 'view_only',
          view_only_since: nowISO,
        });
        results.trial.transitioned++;
        for (const email of adminEmails) {
          if (scheduleEmail(emailJobs, seen, 'trial_expired', email, biz)) results.trial.emails_queued++;
          if (scheduleEmail(emailJobs, seen, 'account_view_only', email, biz)) results.trial.emails_queued++;
        }
        continue;
      }

      // Reminder milestones — exact-day matching prevents daily re-sends without persistent dedup
      const milestones = [
        { day: 15, type: 'trial_day_15' },
        { day: 25, type: 'trial_day_25' },
        { day: 28, type: 'trial_day_28' },
        { day: 30, type: 'trial_day_30' },
      ];
      for (const m of milestones) {
        if (daysElapsed === m.day) {
          for (const email of adminEmails) {
            if (scheduleEmail(emailJobs, seen, m.type, email, biz)) results.trial.emails_queued++;
          }
        }
      }
    }

    // === SECTION B: VIEW_ONLY BUSINESSES ===
    for (const biz of businesses.filter((b: any) => b.billing_status === 'view_only')) {
      results.view_only.processed++;

      if (!biz.view_only_since) {
        const seededSince = biz.trial_end_at || nowISO;
        await base44.asServiceRole.entities.Business.update(biz.id, { view_only_since: seededSince });
        biz.view_only_since = seededSince;
      }

      const viewOnlySince = new Date(biz.view_only_since);
      const daysInViewOnly = Math.floor((now.getTime() - viewOnlySince.getTime()) / DAY_MS);
      const adminEmails = await getAdminEmails(base44, biz.id);

      // Day 10: warn about upcoming archival (exact day to avoid daily re-sends)
      if (daysInViewOnly === 10) {
        for (const email of adminEmails) {
          if (scheduleEmail(emailJobs, seen, 'archive_warning', email, biz)) results.view_only.emails_queued++;
        }
      }

      // 15+ days: archive
      if (daysInViewOnly >= 15) {
        const scheduledDelete = new Date(now);
        scheduledDelete.setDate(scheduledDelete.getDate() + 30);
        const updatedBiz = { ...biz, scheduled_delete_at: scheduledDelete.toISOString() };
        await base44.asServiceRole.entities.Business.update(biz.id, {
          billing_status: 'archived',
          archived_at: nowISO,
          scheduled_delete_at: scheduledDelete.toISOString(),
        });
        results.view_only.archived++;
        for (const email of adminEmails) {
          if (scheduleEmail(emailJobs, seen, 'account_archived', email, updatedBiz)) results.view_only.emails_queued++;
        }
      }
    }

    // === SECTION C: ARCHIVED BUSINESSES ===
    for (const biz of businesses.filter((b: any) => b.billing_status === 'archived')) {
      results.archived.processed++;
      if (!biz.scheduled_delete_at) continue;

      const scheduledDelete = new Date(biz.scheduled_delete_at);
      const daysUntilDelete = Math.ceil((scheduledDelete.getTime() - now.getTime()) / DAY_MS);
      const adminEmails = await getAdminEmails(base44, biz.id);

      // Exactly 7 days before: warn
      if (daysUntilDelete === 7) {
        for (const email of adminEmails) {
          if (scheduleEmail(emailJobs, seen, 'delete_warning', email, biz)) results.archived.emails_queued++;
        }
      }

      // Deletion day reached
      if (scheduledDelete <= now) {
        for (const email of adminEmails) {
          scheduleEmail(emailJobs, seen, 'account_deleted_confirmation', email, biz);
          results.archived.emails_queued++;
        }

        try {
          const tenantUsers = await base44.asServiceRole.entities.User.filter({ business_id: biz.id });
          for (const u of tenantUsers) {
            try {
              await base44.asServiceRole.entities.User.delete(u.id);
            } catch (_) {
              await base44.asServiceRole.entities.User.update(u.id, { business_id: null });
            }
          }
        } catch (err) {
          console.error(`[checkAccountLifecycle] Failed to remove users for ${biz.id}:`, err);
        }

        await base44.asServiceRole.entities.Business.delete(biz.id);
        results.archived.deleted++;
        console.log(`[checkAccountLifecycle] Deleted business ${biz.id} (${biz.name})`);
      }
    }

    // === SECTION D: ACTIVE BUSINESSES WITH EXPIRING LICENSES (manual renewal only) ===
    for (const biz of businesses.filter(
      (b: any) => b.billing_status === 'active' && b.license_expires_at && !b.auto_renewal
    )) {
      results.active.processed++;
      const expiresAt = new Date(biz.license_expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
      const adminEmails = await getAdminEmails(base44, biz.id);

      // Expired: transition to view_only
      if (expiresAt <= now) {
        await base44.asServiceRole.entities.Business.update(biz.id, {
          billing_status: 'view_only',
          view_only_since: nowISO,
        });
        results.active.transitioned++;
        for (const email of adminEmails) {
          if (scheduleEmail(emailJobs, seen, 'license_expired', email, biz)) results.active.emails_queued++;
          if (scheduleEmail(emailJobs, seen, 'account_view_only', email, biz)) results.active.emails_queued++;
        }
        continue;
      }

      // Expiry reminders — exact-day matching
      const milestones = [
        { threshold: 7, type: 'license_expiring_7' },
        { threshold: 3, type: 'license_expiring_3' },
        { threshold: 1, type: 'license_expiring_1' },
      ];
      for (const m of milestones) {
        if (daysUntilExpiry === m.threshold) {
          for (const email of adminEmails) {
            if (scheduleEmail(emailJobs, seen, m.type, email, biz)) results.active.emails_queued++;
          }
        }
      }
    }

    // === SECTION E: ACTIVE BUSINESSES WITH AUTO-RENEWAL ===
    for (const biz of businesses.filter(
      (b: any) => b.billing_status === 'active' && b.license_expires_at && b.auto_renewal
    )) {
      const expiresAt = new Date(biz.license_expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
      const adminEmails = await getAdminEmails(base44, biz.id);

      // FYI: renewal in 7 days
      if (daysUntilExpiry === 7) {
        for (const email of adminEmails) {
          if (scheduleEmail(emailJobs, seen, 'renewal_upcoming', email, biz)) results.active.emails_queued++;
        }
      }
    }

    console.log(`[checkAccountLifecycle] Done:`, JSON.stringify(results));
    return Response.json({ success: true, checked_at: nowISO, results, emails_to_send: emailJobs });

  } catch (error: any) {
    console.error('[checkAccountLifecycle] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
