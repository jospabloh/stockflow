/**
 * processTrialReactivationEmails — Daily scheduled job.
 * Sends friendly reactivation emails to inactive trial users.
 *
 * Eligibility rules (ALL must be true):
 *  1. billing_status === 'trial'
 *  2. trial_end_at in future (days_left > 0)
 *  3. User last_active_at is null or > INACTIVITY_HOURS ago
 *  4. User last_trial_reactivation_email_at is null or > MIN_HOURS_BETWEEN_EMAILS ago
 *  5. User trial_reactivation_email_count < MAX_EMAILS_PER_TRIAL
 *  6. User has valid email
 *  7. No duplicate for same user+business+day (idempotency_key)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
const APP_NAME = 'StockFlow';
const BRAND_COLOR = '#4F46E5';
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || Deno.env.get('PLATFORM_OWNER_EMAIL') || '';
const UPGRADE_URL = 'https://www.acaciaco.com.mx/stockflow';

// Configuration constants
const TRIAL_REACTIVATION_ENABLED = true;
const INACTIVITY_HOURS = 24;
const MIN_HOURS_BETWEEN_EMAILS = 48;
const MAX_EMAILS_PER_TRIAL = 3;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDaysLeft(trialEndAt) {
  if (!trialEndAt) return 0;
  const endMs = new Date(trialEndAt).getTime();
  if (isNaN(endMs)) return 0;
  return Math.max(0, Math.ceil((endMs - Date.now()) / DAY_MS));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function buildIdempotencyKey(userId, businessId) {
  return `trial_reactivation:${userId}:${businessId}:${todayKey()}`;
}

function firstName(fullName) {
  if (!fullName) return '';
  return String(fullName).trim().split(/\s+/)[0] || '';
}

// ─── Email template (bilingual) ───────────────────────────────────────────────

function buildEmailTemplate(user, business, daysLeft, appUrl, locale) {
  const isEnglish = locale && (locale.startsWith('en') || locale === 'en-US');
  const name = firstName(user.full_name) || business.name || 'there';
  const businessName = business.name || APP_NAME;

  const featureListEs = `
    <ul style="color:#374151;line-height:1.8;padding-left:20px">
      <li>Controlar tu inventario</li>
      <li>Registrar entradas y salidas de productos</li>
      <li>Crear y administrar cotizaciones</li>
      <li>Dar seguimiento a clientes y proveedores</li>
      <li>Recibir alertas de stock bajo</li>
      <li>Consultar reportes para tomar mejores decisiones</li>
    </ul>`;

  const featureListEn = `
    <ul style="color:#374151;line-height:1.8;padding-left:20px">
      <li>Manage your inventory</li>
      <li>Register product entries and exits</li>
      <li>Create and manage quotations</li>
      <li>Track clients and suppliers</li>
      <li>Receive low-stock alerts</li>
      <li>Review reports to make better business decisions</li>
    </ul>`;

  const ctaButton = (label, url) =>
    `<div style="text-align:center;margin:24px 0">
      <a href="${url}" style="background:${BRAND_COLOR};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">${label}</a>
    </div>`;

  const wrap = (bodyHtml) => `<!DOCTYPE html>
<html lang="${isEnglish ? 'en' : 'es'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:${BRAND_COLOR};padding:20px 24px">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">${APP_NAME}</h1>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">${isEnglish ? 'Inventory Management System' : 'Sistema de Inventario'}</p>
    </div>
    <div style="padding:28px 24px">
      ${bodyHtml}
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
      <p style="margin:0;font-size:12px;color:#6b7280">${isEnglish ? 'Need help? Write to us at' : '¿Necesitas ayuda? Escríbenos a'} <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
      <p style="margin:6px 0 0;font-size:11px;color:#9ca3af">© 2026 ${APP_NAME} — <a href="${appUrl}" style="color:${BRAND_COLOR}">${isEnglish ? 'Go to app' : 'Ir a la app'}</a></p>
    </div>
  </div>
</body>
</html>`;

  if (isEnglish) {
    return {
      subject: `We miss you in ${APP_NAME} — you still have ${daysLeft} trial ${daysLeft === 1 ? 'day' : 'days'} left`,
      html: wrap(`
        <h2 style="color:#111827;margin-top:0">Hi ${name}, we miss you in ${APP_NAME}! 👋</h2>
        <p style="color:#374151;line-height:1.6">We noticed you have not used ${APP_NAME} in the last few days. Your free trial is still active.</p>
        <div style="background:#eff6ff;border-left:4px solid ${BRAND_COLOR};padding:14px 18px;border-radius:4px;margin:16px 0">
          <p style="margin:0;color:#1e40af;font-size:18px;font-weight:700">⏰ ${daysLeft} trial ${daysLeft === 1 ? 'day' : 'days'} remaining</p>
        </div>
        <p style="color:#374151;line-height:1.6">You still have <strong>${daysLeft} days</strong> to explore ${APP_NAME} features for <strong>${businessName}</strong>:</p>
        ${featureListEn}
        <p style="color:#374151;line-height:1.6">Your 30-day trial is designed so you can explore ${APP_NAME} calmly and confirm whether it really helps you control your operation.</p>
        ${ctaButton('Come back to StockFlow', appUrl)}
        <p style="color:#6b7280;font-size:13px">Have questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        <p style="color:#9ca3af;font-size:12px">The ${APP_NAME} Team</p>
      `),
    };
  }

  // Default: Spanish
  return {
    subject: `Te extrañamos en ${APP_NAME} — aún tienes ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} de prueba`,
    html: wrap(`
      <h2 style="color:#111827;margin-top:0">¡Hola ${name}, te extrañamos en ${APP_NAME}! 👋</h2>
      <p style="color:#374151;line-height:1.6">Vimos que no has usado ${APP_NAME} en los últimos días y queríamos recordarte que tu prueba gratuita sigue activa.</p>
      <div style="background:#eff6ff;border-left:4px solid ${BRAND_COLOR};padding:14px 18px;border-radius:4px;margin:16px 0">
        <p style="margin:0;color:#1e40af;font-size:18px;font-weight:700">⏰ Te quedan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} de prueba</p>
      </div>
      <p style="color:#374151;line-height:1.6">Aún tienes <strong>${daysLeft} días</strong> para probar las funcionalidades de ${APP_NAME} en <strong>${businessName}</strong>:</p>
      ${featureListEs}
      <p style="color:#374151;line-height:1.6">Tu trial de 30 días está pensado para que puedas explorar ${APP_NAME} con calma y confirmar si realmente te ayuda a ordenar y controlar tu operación.</p>
      ${ctaButton('Volver a StockFlow', appUrl)}
      <p style="color:#6b7280;font-size:13px">¿Tienes preguntas? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
      <p style="color:#9ca3af;font-size:12px">Equipo ${APP_NAME}</p>
    `),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Auth: cron secret or platform owner
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

    if (!TRIAL_REACTIVATION_ENABLED) {
      return Response.json({ skipped: true, reason: 'TRIAL_REACTIVATION_ENABLED=false' });
    }

    const appUrl = Deno.env.get('APP_URL');
    if (!appUrl) {
      console.warn('[processTrialReactivationEmails] APP_URL not set — skipping job');
      return Response.json({ skipped: true, reason: 'missing_app_url' });
    }

    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    const stats = {
      started_at: nowISO,
      scanned_businesses: 0,
      scanned_users: 0,
      eligible: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      skip_reasons: {},
    };

    function addSkip(reason) {
      stats.skipped++;
      stats.skip_reasons[reason] = (stats.skip_reasons[reason] || 0) + 1;
    }

    // Load all trial businesses
    const allBusinesses = await base44.asServiceRole.entities.Business.list();
    const trialBusinesses = allBusinesses.filter((b) => b.billing_status === 'trial');
    stats.scanned_businesses = trialBusinesses.length;

    for (const biz of trialBusinesses) {
      // Verify trial is still valid
      if (!biz.trial_end_at) {
        addSkip('no_trial_end_at');
        continue;
      }
      const daysLeft = calcDaysLeft(biz.trial_end_at);
      if (daysLeft <= 0) {
        addSkip('trial_expired');
        continue;
      }

      // Load all users for this business
      let bizUsers = [];
      try {
        bizUsers = await base44.asServiceRole.entities.User.filter({ business_id: biz.id });
      } catch (err) {
        console.error(`[processTrialReactivationEmails] Failed to load users for business ${biz.id}:`, err?.message);
        stats.failed++;
        continue;
      }

      for (const u of bizUsers) {
        stats.scanned_users++;

        // Must have valid email
        if (!u.email || !String(u.email).includes('@')) {
          addSkip('no_valid_email');
          continue;
        }

        // Verify user still belongs to this tenant (safety guard)
        if (u.business_id !== biz.id) {
          addSkip('tenant_mismatch');
          continue;
        }

        // Check inactivity: must NOT have been active in last INACTIVITY_HOURS
        if (u.last_active_at) {
          const lastActiveMs = new Date(u.last_active_at).getTime();
          if (!isNaN(lastActiveMs) && now - lastActiveMs < INACTIVITY_HOURS * HOUR_MS) {
            addSkip('user_recently_active');
            continue;
          }
        }
        // If last_active_at is null/undefined → user never tracked → treat as inactive (eligible)

        // Anti-spam: min hours between emails
        if (u.last_trial_reactivation_email_at) {
          const lastEmailMs = new Date(u.last_trial_reactivation_email_at).getTime();
          if (!isNaN(lastEmailMs) && now - lastEmailMs < MIN_HOURS_BETWEEN_EMAILS * HOUR_MS) {
            addSkip('email_sent_too_recently');
            continue;
          }
        }

        // Anti-spam: max emails per trial
        const emailCount = Number(u.trial_reactivation_email_count) || 0;
        if (emailCount >= MAX_EMAILS_PER_TRIAL) {
          addSkip('max_emails_reached');
          continue;
        }

        // Idempotency check: look for existing sent record today
        const iKey = buildIdempotencyKey(u.id, biz.id);
        let alreadySentToday = false;
        try {
          const existingLogs = await base44.asServiceRole.entities.EmailNotification.filter({
            idempotency_key: iKey,
          });
          alreadySentToday = existingLogs.some((l) => l.status === 'sent');
        } catch (_) {
          // If we can't check, proceed (fail open — idempotency is best-effort)
        }
        if (alreadySentToday) {
          addSkip('idempotency_key_exists');
          continue;
        }

        // Determine locale — use AppSettings if available, fallback to es-MX
        let locale = 'es-MX';
        try {
          const settings = await base44.asServiceRole.entities.AppSettings.filter({ business_id: biz.id });
          if (settings?.[0]?.locale) locale = settings[0].locale;
        } catch (_) { /* ignore — safe fallback */ }

        stats.eligible++;

        // Build email
        const template = buildEmailTemplate(u, biz, daysLeft, appUrl, locale);

        // Create notification log record first (status=pending for audit trail)
        let logId = null;
        try {
          const logRecord = await base44.asServiceRole.entities.EmailNotification.create({
            business_id: biz.id,
            user_id: u.id,
            email_type: 'trial_reactivation',
            recipient_email: u.email,
            status: 'pending',
            idempotency_key: iKey,
            last_attempt_at: nowISO,
          });
          logId = logRecord?.id;
        } catch (logErr) {
          console.warn(`[processTrialReactivationEmails] Could not create log for ${u.email}:`, logErr?.message);
        }

        // Send email
        let sendOk = false;
        let sendError = null;
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: u.email,
            subject: template.subject,
            body: template.html,
            from_name: APP_NAME,
          });
          sendOk = true;
          stats.sent++;
          console.log(`[processTrialReactivationEmails] Sent trial_reactivation to ${u.email} (biz=${biz.id}, days_left=${daysLeft})`);
        } catch (err) {
          sendError = err?.message || String(err);
          stats.failed++;
          console.error(`[processTrialReactivationEmails] Failed to send to ${u.email}:`, sendError);
        }

        // Update notification log
        if (logId) {
          try {
            await base44.asServiceRole.entities.EmailNotification.update(logId, {
              status: sendOk ? 'sent' : 'failed',
              sent_at: sendOk ? nowISO : undefined,
              error_message: sendError || undefined,
              retry_count: sendOk ? 0 : 1,
            });
          } catch (_) { /* non-critical */ }
        }

        // Update user tracking fields only on success
        if (sendOk) {
          try {
            await base44.asServiceRole.entities.User.update(u.id, {
              last_trial_reactivation_email_at: nowISO,
              trial_reactivation_email_count: emailCount + 1,
            });
          } catch (updateErr) {
            console.warn(`[processTrialReactivationEmails] Could not update user fields for ${u.id}:`, updateErr?.message);
          }
        }
      }
    }

    stats.completed_at = new Date().toISOString();
    console.log('[processTrialReactivationEmails] Done:', JSON.stringify(stats));
    return Response.json({ success: true, stats });

  } catch (error) {
    console.error('[processTrialReactivationEmails] Fatal error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});