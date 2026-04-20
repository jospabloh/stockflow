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
    const body = await req.json().catch(() => ({}));

    // Accept cron secret from header (manual/delegation calls) or body (Base44 scheduler via function_args)
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
      const adminEmail = await getAdminEmail(base44, biz.id);

      // Trial expired — transition to view_only
      if (biz.trial_end_at && new Date(biz.trial_end_at) <= now) {
        await base44.asServiceRole.entities.Business.update(biz.id, {
          billing_status: 'view_only',
          view_only_since: nowISO,
        });
        results.trial.transitioned++;
        if (adminEmail) {
          const q = await queueEmail(base44, biz.id, 'trial_expired', adminEmail);
          if (q) results.trial.emails_queued++;
        }
        continue;
      }

      // Reminder milestones
      const milestones = [
        { day: 15, type: 'trial_day_15' },
        { day: 25, type: 'trial_day_25' },
        { day: 28, type: 'trial_day_28' },
        { day: 30, type: 'trial_day_30' },
      ];
      for (const m of milestones) {
        if (daysElapsed >= m.day && adminEmail) {
          const q = await queueEmail(base44, biz.id, m.type, adminEmail);
          if (q) results.trial.emails_queued++;
        }
      }
    }

    // === SECTION B: VIEW_ONLY BUSINESSES ===
    for (const biz of businesses.filter((b: any) => b.billing_status === 'view_only')) {
      results.view_only.processed++;

      // Auto-seed view_only_since if missing — gives a fresh 15-day countdown from today.
      // Uses trial_end_at as the best estimate for businesses that transitioned before this field existed.
      if (!biz.view_only_since) {
        const seededSince = biz.trial_end_at || nowISO;
        await base44.asServiceRole.entities.Business.update(biz.id, { view_only_since: seededSince });
        biz.view_only_since = seededSince;
      }

      const viewOnlySince = new Date(biz.view_only_since);
      const daysInViewOnly = Math.floor((now.getTime() - viewOnlySince.getTime()) / DAY_MS);
      const adminEmail = await getAdminEmail(base44, biz.id);

      // Queue account_view_only once (idempotent)
      if (adminEmail) {
        const q = await queueEmail(base44, biz.id, 'account_view_only', adminEmail);
        if (q) results.view_only.emails_queued++;
      }

      // 10+ days: warn about upcoming archival
      if (daysInViewOnly >= 10 && adminEmail) {
        const q = await queueEmail(base44, biz.id, 'archive_warning', adminEmail);
        if (q) results.view_only.emails_queued++;
      }

      // 15+ days: archive
      if (daysInViewOnly >= 15) {
        const scheduledDelete = new Date(now);
        scheduledDelete.setDate(scheduledDelete.getDate() + 30);
        await base44.asServiceRole.entities.Business.update(biz.id, {
          billing_status: 'archived',
          archived_at: nowISO,
          scheduled_delete_at: scheduledDelete.toISOString(),
        });
        results.view_only.archived++;
        if (adminEmail) {
          const q = await queueEmail(base44, biz.id, 'account_archived', adminEmail);
          if (q) results.view_only.emails_queued++;
        }
      }
    }

    // === SECTION C: ARCHIVED BUSINESSES ===
    for (const biz of businesses.filter((b: any) => b.billing_status === 'archived')) {
      results.archived.processed++;
      if (!biz.scheduled_delete_at) continue;

      const scheduledDelete = new Date(biz.scheduled_delete_at);
      const daysUntilDelete = Math.ceil((scheduledDelete.getTime() - now.getTime()) / DAY_MS);
      const adminEmail = await getAdminEmail(base44, biz.id);

      // 7 days before: warn
      if (daysUntilDelete <= 7 && daysUntilDelete > 0 && adminEmail) {
        const q = await queueEmail(base44, biz.id, 'delete_warning', adminEmail);
        if (q) results.archived.emails_queued++;
      }

      // Deletion day reached
      if (scheduledDelete <= now) {
        // Queue confirmation before deleting so record still exists
        if (adminEmail) {
          await queueEmail(base44, biz.id, 'account_deleted_confirmation', adminEmail);
          results.archived.emails_queued++;
        }

        // Dissociate / delete tenant users
        try {
          const tenantUsers = await base44.asServiceRole.entities.User.filter({ business_id: biz.id });
          for (const u of tenantUsers) {
            try {
              await base44.asServiceRole.entities.User.delete(u.id);
            } catch (_) {
              // Fallback: dissociate instead of hard-delete if system entity restricts delete
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
      const adminEmail = await getAdminEmail(base44, biz.id);

      // Expired: transition to view_only
      if (expiresAt <= now) {
        await base44.asServiceRole.entities.Business.update(biz.id, {
          billing_status: 'view_only',
          view_only_since: nowISO,
        });
        results.active.transitioned++;
        if (adminEmail) {
          const q = await queueEmail(base44, biz.id, 'license_expired', adminEmail);
          if (q) results.active.emails_queued++;
        }
        continue;
      }

      // Expiry reminders
      const milestones = [
        { threshold: 7, type: 'license_expiring_7' },
        { threshold: 3, type: 'license_expiring_3' },
        { threshold: 1, type: 'license_expiring_1' },
      ];
      for (const m of milestones) {
        if (daysUntilExpiry <= m.threshold && adminEmail) {
          const q = await queueEmail(base44, biz.id, m.type, adminEmail);
          if (q) results.active.emails_queued++;
        }
      }
    }

    console.log(`[checkAccountLifecycle] Done:`, JSON.stringify(results));
    return Response.json({ success: true, checked_at: nowISO, results });

  } catch (error: any) {
    console.error('[checkAccountLifecycle] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
