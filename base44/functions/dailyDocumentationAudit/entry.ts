import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

// Baked-in snapshot of the current app version — update this when releasing
const SNAPSHOT_VERSION = '2.12.0';
const SNAPSHOT_DATE = '2026-04-28';
const SNAPSHOT_CHANGES = [
  "Sistema de reactivación de trial: emails automáticos a usuarios inactivos con prueba activa",
  "Job diario processTrialReactivationEmails: detecta inactivos >24h, límite de 3 emails por trial y mínimo 48h entre envíos",
  "Idempotencia garantizada por clave única usuario/negocio/día",
  "Email bilingüe en español (es-MX) e inglés (en-US) según configuración regional del tenant",
  "Hook useActivityTracker + función trackUserActivity con throttle de 15 min",
  "Tenant isolation preservada: solo actualiza al usuario autenticado",
  "Entidad User actualizada: campos last_active_at, last_trial_reactivation_email_at, trial_reactivation_email_count",
  "Entidad EmailNotification: nuevo tipo trial_reactivation con idempotency_key, user_id, skip_reason",
];

// Max days before docs are considered stale
const STALE_DAYS = 60;

Deno.serve(async (req) => {
  // Auth: x-cron-secret header OR authenticated platform owner
  const cronSecret = Deno.env.get('CRON_SECRET');
  const headerSecret = req.headers.get('x-cron-secret');
  const isCronCall = cronSecret && headerSecret === cronSecret;

  if (!isCronCall) {
    const base44Check = createClientFromRequest(req);
    const user = await base44Check.auth.me().catch(() => null);
    if (!user || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const base44 = createClientFromRequest(req);
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY_SF');

  const result = {
    success: true,
    snapshotVersion: SNAPSHOT_VERSION,
    dbVersionFound: null,
    versionInSync: false,
    changelogGenerated: false,
    staleWarning: false,
    aiUsed: false,
    actions: [],
  };

  // 1. Check latest AppVersion in DB
  const versions = await base44.asServiceRole.entities.AppVersion.list('-released_at', 5);
  const latest = versions[0] || null;
  result.dbVersionFound = latest?.version || null;

  // 2. Check sync
  result.versionInSync = latest?.version === SNAPSHOT_VERSION;

  // 3. If out of sync — create/update AppVersion record
  if (!result.versionInSync) {
    let releaseNotes = SNAPSHOT_CHANGES.join('\n• ');

    // Try AI-generated changelog if Anthropic key is available
    if (anthropicKey) {
      try {
        const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: `Eres el redactor técnico de StockFlow, un SaaS de gestión de inventario en español para México.
Genera un changelog en español para la versión ${SNAPSHOT_VERSION} (${SNAPSHOT_DATE}) basado en estos cambios:

${SNAPSHOT_CHANGES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Formato requerido: una línea por cambio, comenzando con un emoji relevante, sin encabezados adicionales, máximo 10 líneas. Sé conciso y orientado al usuario final.`,
            }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          releaseNotes = aiData.content?.[0]?.text || releaseNotes;
          result.aiUsed = true;
          result.actions.push('AI-generated changelog using claude-haiku-4-5');
        }
      } catch (aiErr) {
        result.actions.push(`AI unavailable (${aiErr.message}), using snapshot changes`);
      }
    } else {
      result.actions.push('ANTHROPIC_API_KEY_SF not set — using snapshot changes as release notes');
    }

    // Check if this version record already exists
    const existing = versions.find(v => v.version === SNAPSHOT_VERSION);
    if (existing) {
      await base44.asServiceRole.entities.AppVersion.update(existing.id, {
        release_notes: releaseNotes,
        released_at: `${SNAPSHOT_DATE}T00:00:00Z`,
      });
      result.actions.push(`Updated existing AppVersion record for ${SNAPSHOT_VERSION}`);
    } else {
      await base44.asServiceRole.entities.AppVersion.create({
        version: SNAPSHOT_VERSION,
        release_notes: releaseNotes,
        released_at: `${SNAPSHOT_DATE}T00:00:00Z`,
      });
      result.actions.push(`Created new AppVersion record for ${SNAPSHOT_VERSION}`);
    }
    result.changelogGenerated = true;
  }

  // 4. Check for stale docs (latest record > STALE_DAYS old)
  if (latest?.released_at) {
    const releasedAt = new Date(latest.released_at);
    const daysSince = (Date.now() - releasedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > STALE_DAYS) {
      result.staleWarning = true;
      result.actions.push(`⚠️ Last release was ${Math.round(daysSince)} days ago — docs may be stale`);
    }
  }

  // 5. Send email report
  const reportBody = `
<h2>StockFlow — Daily Documentation Audit</h2>
<p><strong>Date:</strong> ${new Date().toISOString()}</p>
<table border="1" cellpadding="6" style="border-collapse:collapse">
  <tr><td>Snapshot version (code)</td><td><strong>${SNAPSHOT_VERSION}</strong></td></tr>
  <tr><td>DB version (latest)</td><td><strong>${result.dbVersionFound || 'none'}</strong></td></tr>
  <tr><td>In sync</td><td><strong>${result.versionInSync ? '✅ Yes' : '❌ No'}</strong></td></tr>
  <tr><td>Changelog generated</td><td><strong>${result.changelogGenerated ? '✅ Yes' : '—'}</strong></td></tr>
  <tr><td>AI used</td><td><strong>${result.aiUsed ? '✅ Yes (claude-haiku-4-5)' : 'No'}</strong></td></tr>
  <tr><td>Stale warning</td><td><strong>${result.staleWarning ? '⚠️ Yes' : '✅ No'}</strong></td></tr>
</table>
${result.actions.length > 0 ? `<h3>Actions taken:</h3><ul>${result.actions.map(a => `<li>${a}</li>`).join('')}</ul>` : '<p>No actions needed.</p>'}
  `.trim();

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: PLATFORM_OWNER_EMAIL,
    subject: `[StockFlow] Docs Audit — ${result.versionInSync ? '✅ In sync' : `⚠️ Updated to ${SNAPSHOT_VERSION}`}`,
    body: reportBody,
  }).catch(() => {});

  return Response.json(result);
});