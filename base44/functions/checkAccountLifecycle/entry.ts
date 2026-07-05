import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
const DAY_MS = 24 * 60 * 60 * 1000;

async function getAdmins(base44, businessId) {
  try {
    const users = await base44.asServiceRole.entities.User.filter({ business_id: businessId });
    return users
      .filter((u) => u.role === 'admin' && u.email)
      .map((u) => ({ email: u.email, full_name: u.full_name || null }));
  } catch (_) {
    return [];
  }
}

function scheduleEmail(jobs, seen, emailType, admin, biz) {
  if (!admin?.email) return false;
  const key = `${biz.id}:${emailType}:${admin.email}`;
  if (seen.has(key)) return false;
  seen.add(key);
  jobs.push({
    email_type: emailType,
    recipient_email: admin.email,
    recipient_name: admin.full_name,
    business_id: biz.id,
    business_name: biz.name || 'tu negocio',
    license_plan: biz.license_plan ?? null,
    license_expires_at: biz.license_expires_at ?? null,
    scheduled_delete_at: biz.scheduled_delete_at ?? null,
  });
  return true;
}

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
      if (!user || !PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date();
    const nowISO = now.toISOString();
    // Tope defensivo explícito: Base44 ya limita list a 5,000, pero lo fijamos
    // aquí para acotar el trabajo por corrida (evita barridos no acotados si el
    // número de negocios creciera). El recorrido siguiente son bucles finitos
    // sobre este arreglo — no hay recursión ni bucles no terminantes.
    const BUSINESS_SCAN_CAP = 5000;
    const businesses = await base44.asServiceRole.entities.Business.list('-created_date', BUSINESS_SCAN_CAP);

    const emailJobs = [];
    const seen = new Set();

    const results = {
      trial:     { processed: 0, transitioned: 0, emails_queued: 0 },
      view_only: { processed: 0, archived: 0,      emails_queued: 0 },
      archived:  { processed: 0, deleted: 0,        emails_queued: 0 },
      active:    { processed: 0, transitioned: 0,  emails_queued: 0 },
    };

    // TRIAL businesses
    for (const biz of businesses.filter((b) => b.billing_status === 'trial')) {
      results.trial.processed++;
      if (!biz.trial_start_at) continue;

      const trialStart = new Date(biz.trial_start_at);
      const daysElapsed = Math.floor((now.getTime() - trialStart.getTime()) / DAY_MS);
      const admins = await getAdmins(base44, biz.id);

      if (biz.trial_end_at && new Date(biz.trial_end_at) <= now) {
        await base44.asServiceRole.entities.Business.update(biz.id, {
          billing_status: 'view_only',
          view_only_since: nowISO,
        });
        results.trial.transitioned++;
        for (const admin of admins) {
          if (scheduleEmail(emailJobs, seen, 'trial_expired', admin, biz)) results.trial.emails_queued++;
          if (scheduleEmail(emailJobs, seen, 'account_view_only', admin, biz)) results.trial.emails_queued++;
        }
        continue;
      }

      const milestones = [
        { day: 15, type: 'trial_day_15' },
        { day: 25, type: 'trial_day_25' },
        { day: 28, type: 'trial_day_28' },
        { day: 30, type: 'trial_day_30' },
      ];
      for (const m of milestones) {
        if (daysElapsed === m.day) {
          for (const admin of admins) {
            if (scheduleEmail(emailJobs, seen, m.type, admin, biz)) results.trial.emails_queued++;
          }
        }
      }
    }

    // VIEW_ONLY businesses
    for (const biz of businesses.filter((b) => b.billing_status === 'view_only')) {
      results.view_only.processed++;

      if (!biz.view_only_since) {
        const seededSince = biz.trial_end_at || nowISO;
        await base44.asServiceRole.entities.Business.update(biz.id, { view_only_since: seededSince });
        biz.view_only_since = seededSince;
      }

      const viewOnlySince = new Date(biz.view_only_since);
      const daysInViewOnly = Math.floor((now.getTime() - viewOnlySince.getTime()) / DAY_MS);
      const admins = await getAdmins(base44, biz.id);

      if (daysInViewOnly === 10) {
        for (const admin of admins) {
          if (scheduleEmail(emailJobs, seen, 'archive_warning', admin, biz)) results.view_only.emails_queued++;
        }
      }

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
        for (const admin of admins) {
          if (scheduleEmail(emailJobs, seen, 'account_archived', admin, updatedBiz)) results.view_only.emails_queued++;
        }
      }
    }

    // ARCHIVED businesses
    for (const biz of businesses.filter((b) => b.billing_status === 'archived')) {
      results.archived.processed++;
      if (!biz.scheduled_delete_at) continue;

      const scheduledDelete = new Date(biz.scheduled_delete_at);
      const daysUntilDelete = Math.ceil((scheduledDelete.getTime() - now.getTime()) / DAY_MS);
      const admins = await getAdmins(base44, biz.id);

      if (daysUntilDelete === 7) {
        for (const admin of admins) {
          if (scheduleEmail(emailJobs, seen, 'delete_warning', admin, biz)) results.archived.emails_queued++;
        }
      }

      if (scheduledDelete <= now) {
        for (const admin of admins) {
          scheduleEmail(emailJobs, seen, 'account_deleted_confirmation', admin, biz);
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

    // ACTIVE without auto_renewal — expiry reminders
    for (const biz of businesses.filter(
      (b) => b.billing_status === 'active' && b.license_expires_at && !b.auto_renewal
    )) {
      results.active.processed++;
      const expiresAt = new Date(biz.license_expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
      const admins = await getAdmins(base44, biz.id);

      if (expiresAt <= now) {
        await base44.asServiceRole.entities.Business.update(biz.id, {
          billing_status: 'view_only',
          view_only_since: nowISO,
        });
        results.active.transitioned++;
        for (const admin of admins) {
          if (scheduleEmail(emailJobs, seen, 'license_expired', admin, biz)) results.active.emails_queued++;
          if (scheduleEmail(emailJobs, seen, 'account_view_only', admin, biz)) results.active.emails_queued++;
        }
        continue;
      }

      const milestones = [
        { threshold: 7, type: 'license_expiring_7' },
        { threshold: 3, type: 'license_expiring_3' },
        { threshold: 1, type: 'license_expiring_1' },
      ];
      for (const m of milestones) {
        if (daysUntilExpiry === m.threshold) {
          for (const admin of admins) {
            if (scheduleEmail(emailJobs, seen, m.type, admin, biz)) results.active.emails_queued++;
          }
        }
      }
    }

    // ACTIVE with auto_renewal — charge reminders
    for (const biz of businesses.filter(
      (b) => b.billing_status === 'active' && b.license_expires_at && b.auto_renewal
    )) {
      const expiresAt = new Date(biz.license_expires_at);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
      const admins = await getAdmins(base44, biz.id);

      const chargeReminders = [
        { threshold: 3, type: 'renewal_charge_reminder_3' },
        { threshold: 2, type: 'renewal_charge_reminder_2' },
        { threshold: 1, type: 'renewal_charge_reminder_1' },
      ];
      for (const r of chargeReminders) {
        if (daysUntilExpiry === r.threshold) {
          for (const admin of admins) {
            if (scheduleEmail(emailJobs, seen, r.type, admin, biz)) results.active.emails_queued++;
          }
        }
      }
    }

    console.log(`[checkAccountLifecycle] Done:`, JSON.stringify(results));

    // ── Dispatch email jobs immediately via sendLifecycleEmails ──────────────
    let emailResult = { sent: 0, failed: 0, batch_size: 0 };
    if (emailJobs.length > 0) {
      try {
        const sendResp = await base44.asServiceRole.functions.invoke('sendLifecycleEmails', {
          jobs: emailJobs,
        });
        emailResult = sendResp || emailResult;
        console.log(`[checkAccountLifecycle] sendLifecycleEmails result:`, JSON.stringify(emailResult));
      } catch (sendErr) {
        console.error(`[checkAccountLifecycle] Failed to invoke sendLifecycleEmails:`, (sendErr as Error).message);
      }

      // ── Persist audit log in EmailNotification entity ────────────────────
      const nowAudit = new Date().toISOString();
      for (const job of emailJobs) {
        try {
          await base44.asServiceRole.entities.EmailNotification.create({
            business_id: job.business_id,
            email_type: job.email_type,
            recipient_email: job.recipient_email,
            status: 'sent',
            sent_at: nowAudit,
            idempotency_key: `${job.email_type}:${job.business_id}:${job.recipient_email}:${nowAudit.slice(0, 10)}`,
          });
        } catch (_) { /* non-critical audit log */ }
      }
    } else {
      console.log(`[checkAccountLifecycle] No email jobs to send today.`);
    }

    return Response.json({ success: true, checked_at: nowISO, results, emails_sent: emailResult });

  } catch (error) {
    console.error('[checkAccountLifecycle] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});