import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const APP_NAME = 'StockFlow';
const BRAND_COLOR = '#4F46E5';
const STALE_DOCS_DAYS = 60;

// AUTOGEN:VERSION_SNAPSHOT:BEGIN — regenerado por scripts/generateVersionHistorySnapshot.mjs
const SNAPSHOT_VERSION = "2.12.0";
const SNAPSHOT_RELEASE_DATE = "2026-04-28";
const SNAPSHOT_GIT_LOG = `
33aaece Merge pull request #49 from jospabloh/claude/nightly-automation-setup-ZagxP
773941d Merge branch 'main' into claude/nightly-automation-setup-ZagxP
c7a462d File changes
c0bcbcb Add nightly permission & documentation audit automations
8fa5cfc File changes
a305d74 File changes
f36c1cf File changes
b3bf822 File changes
9f46dca File changes
9ffddb8 File changes
05acb72 Merge pull request #48 from jospabloh/claude/check-renewal-emails-L83pp
3342d49 Add queueBillingReminders function to fix missing automation target
101da53 File changes
4c7d408 File changes
51a7bce Update base44 packages
22c0687 File changes
6ac0977 File changes
1895bde File changes
4073f34 Merge pull request #47 from jospabloh/claude/mercado-pago-checkout-ATHGT
8f4eace Personalize lifecycle emails with app + plan + recipient name
46c0afb Add 'Confirmar pago recibido' trigger in LicenseAdmin
dfcd21b Add MP-aligned license email flow
3637b21 File changes
0edcc70 File changes
e815d7f File changes
`;
const SNAPSHOT_LATEST_CHANGES = [
  "📧 Sistema de reactivación de trial: emails automáticos a usuarios inactivos con prueba activa (sin afectar cuentas pagadas, vencidas, archivadas o suspendidas)",
  "⏰ Job diario processTrialReactivationEmails: detecta usuarios inactivos >24 h, respeta límite de 3 emails por trial y mínimo 48 h entre envíos",
  "🔒 Idempotencia garantizada: clave única por usuario/negocio/día previene duplicados aunque el job corra dos veces",
  "🌐 Email bilingüe: plantilla en español (es-MX) e inglés (en-US) según configuración regional del tenant",
  "📊 Rastreo de actividad seguro: hook useActivityTracker + función trackUserActivity con throttle de 15 min; no bloquea UI",
  "🛡️ Tenant isolation preservada: trackUserActivity solo actualiza al usuario autenticado; job lee users filtrados por business_id",
  "📋 Entidad User actualizada: campos last_active_at, last_trial_reactivation_email_at, trial_reactivation_email_count (no rompe campos existentes)",
  "📋 Entidad EmailNotification: nuevo tipo trial_reactivation + campos idempotency_key, user_id, skip_reason para auditoría",
];
// AUTOGEN:VERSION_SNAPSHOT:END

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function callAnthropic(gitLog: string, version: string, existingChanges: string[]): Promise<string[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY_SF');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY_SF no configurada');

  const systemPrompt = `Eres un redactor técnico que genera changelogs de software en español (es-MX) para StockFlow, un sistema de inventario SaaS multi-tenant.
Escribe cambios concisos, orientados al usuario final, usando emojis al inicio de cada línea como en este ejemplo:
- 📦 Nuevo módulo de gestión de productos con importación masiva desde CSV
- 🐛 Fix: cálculo de IVA en cotizaciones corregido para evitar doble conteo
- ✨ Dashboard: nueva tarjeta de análisis de ventas por período
Devuelve SOLO un array JSON de strings, sin explicaciones adicionales.`;

  const userPrompt = `Genera el changelog para la versión ${version} de StockFlow basándote en estos commits de git:

${gitLog}

${existingChanges.length > 0
    ? `El equipo ya identificó estos cambios principales (inclúyelos si son relevantes, puedes mejorar su redacción):
${existingChanges.map(c => `- ${c}`).join('\n')}`
    : ''}

Responde ÚNICAMENTE con un array JSON de strings, por ejemplo:
["✨ Cambio 1", "🐛 Fix: Cambio 2"]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '[]';

  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Respuesta inesperada de Anthropic: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]) as string[];
}

interface DocAuditStats {
  runAt: string;
  snapshotVersion: string;
  dbVersion: string | null;
  changelogSynced: boolean;
  changelogCreated: boolean;
  appVersionUpdated: boolean;
  daysSinceLastRelease: number | null;
  staleDocsWarning: boolean;
  errors: string[];
}

function buildEmail(s: DocAuditStats): string {
  const hasErrors = s.errors.length > 0;
  const statusColor = hasErrors ? '#dc2626' : '#16a34a';
  const statusLabel = hasErrors ? `⚠️ ${s.errors.length} error(es)` : '✅ Sin errores';

  const syncBadge = s.changelogSynced
    ? '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:12px;font-size:12px">✅ Sincronizado</span>'
    : '<span style="background:#fef9c3;color:#ca8a04;padding:2px 8px;border-radius:12px;font-size:12px">⚙️ Se actualizó</span>';

  const staleSection = s.staleDocsWarning
    ? `<div style="margin-top:16px;padding:12px;background:#fefce8;border-left:3px solid #ca8a04;border-radius:4px">
        <p style="margin:0;color:#92400e;font-weight:600">📋 Aviso: documentación sin actualizar</p>
        <p style="margin:6px 0 0;color:#78350f;font-size:13px">Han pasado ${s.daysSinceLastRelease} días desde la última release registrada (límite: ${STALE_DOCS_DAYS} días). Considera actualizar el manual o publicar una nueva versión.</p>
      </div>`
    : '';

  const errorsSection = hasErrors
    ? `<div style="margin-top:16px;padding:12px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px">
        <p style="margin:0 0 8px;font-weight:600;color:#dc2626">Errores:</p>
        <ul style="margin:0;padding-left:20px;color:#374151">
          ${s.errors.map(e => `<li style="margin-bottom:4px">${e}</li>`).join('')}
        </ul>
      </div>`
    : '';

  return `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:${BRAND_COLOR};padding:20px 24px">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${APP_NAME}</h1>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Auditoría Nocturna de Documentación</p>
  </div>
  <div style="padding:28px 24px">
    <h2 style="margin-top:0;color:#111827">Reporte — ${fmtDate(new Date(s.runAt))}</h2>
    <p style="color:#374151">Estado: <strong style="color:${statusColor}">${statusLabel}</strong></p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Versión en código (snapshot)</td>
        <td style="padding:10px 12px;font-weight:600;text-align:right">${s.snapshotVersion}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Versión en BD</td>
        <td style="padding:10px 12px;font-weight:600;text-align:right">${s.dbVersion ?? '— (ninguna)'}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Changelog sincronizado</td>
        <td style="padding:10px 12px;text-align:right">${syncBadge}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Días desde última release</td>
        <td style="padding:10px 12px;font-weight:600;text-align:right">${s.daysSinceLastRelease ?? '—'}</td>
      </tr>
    </table>
    ${staleSection}
    ${errorsSection}
  </div>
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
    <p style="margin:0;font-size:11px;color:#9ca3af">Cron: 15 9 * * * — ${APP_NAME} Platform</p>
  </div>
</div>
</body></html>`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Auth: cron secret OR platform-owner session
  const cronSecret = req.headers.get('x-cron-secret');
  const validSecret = Deno.env.get('CRON_SECRET');
  let authorized = Boolean(validSecret && cronSecret === validSecret);
  if (!authorized) {
    try {
      const user = await base44.auth.me();
      authorized = user?.email === PLATFORM_OWNER_EMAIL;
    } catch { /* no valid session */ }
  }
  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats: DocAuditStats = {
    runAt: new Date().toISOString(),
    snapshotVersion: SNAPSHOT_VERSION,
    dbVersion: null,
    changelogSynced: false,
    changelogCreated: false,
    appVersionUpdated: false,
    daysSinceLastRelease: null,
    staleDocsWarning: false,
    errors: [],
  };

  try {
    // 1. Check AppChangelog for snapshot version
    let changelogs: Record<string, unknown>[] = [];
    try {
      changelogs = await base44.asServiceRole.entities.AppChangelog.list();
    } catch (e) {
      stats.errors.push(`list AppChangelog: ${(e as Error).message}`);
    }

    const existingEntry = changelogs.find(c => c.version === SNAPSHOT_VERSION);

    if (!existingEntry) {
      // 2. Version not in DB — generate changelog via Anthropic and sync
      let generatedChanges: string[] = SNAPSHOT_LATEST_CHANGES;

      try {
        generatedChanges = await callAnthropic(SNAPSHOT_GIT_LOG, SNAPSHOT_VERSION, SNAPSHOT_LATEST_CHANGES);
      } catch (e) {
        stats.errors.push(`Anthropic API: ${(e as Error).message} — usando cambios del snapshot`);
      }

      // 3. Create AppChangelog record
      try {
        await base44.asServiceRole.entities.AppChangelog.create({
          version: SNAPSHOT_VERSION,
          release_date: SNAPSHOT_RELEASE_DATE,
          changes: generatedChanges,
          generated_by: 'automation',
          source_git_log: SNAPSHOT_GIT_LOG.trim().slice(0, 2000),
        });
        stats.changelogCreated = true;
      } catch (e) {
        stats.errors.push(`create AppChangelog: ${(e as Error).message}`);
      }

      // 4. Update AppVersion in DB
      try {
        const versions = await base44.asServiceRole.entities.AppVersion.list();
        const releaseNotes = generatedChanges.slice(0, 5).join('\n');

        if (versions.length > 0) {
          await base44.asServiceRole.entities.AppVersion.update(versions[0].id as string, {
            version: SNAPSHOT_VERSION,
            release_notes: releaseNotes,
            released_at: new Date(SNAPSHOT_RELEASE_DATE).toISOString(),
          });
        } else {
          await base44.asServiceRole.entities.AppVersion.create({
            version: SNAPSHOT_VERSION,
            release_notes: releaseNotes,
            released_at: new Date(SNAPSHOT_RELEASE_DATE).toISOString(),
          });
        }
        stats.appVersionUpdated = true;
      } catch (e) {
        stats.errors.push(`update AppVersion: ${(e as Error).message}`);
      }
    } else {
      stats.changelogSynced = true;
    }

    // 5. Compute latest DB version and check staleness
    const allChangelogs = existingEntry
      ? changelogs
      : [...changelogs, { version: SNAPSHOT_VERSION, release_date: SNAPSHOT_RELEASE_DATE }];

    // Sort by release_date descending
    const sorted = [...allChangelogs].sort((a, b) => {
      const da = String(a.release_date ?? '');
      const db = String(b.release_date ?? '');
      return db.localeCompare(da);
    });

    if (sorted.length > 0) {
      const latest = sorted[0];
      stats.dbVersion = String(latest.version ?? SNAPSHOT_VERSION);
      const latestDate = new Date(String(latest.release_date ?? SNAPSHOT_RELEASE_DATE));
      if (!isNaN(latestDate.getTime())) {
        stats.daysSinceLastRelease = daysBetween(latestDate, new Date());
        stats.staleDocsWarning = stats.daysSinceLastRelease > STALE_DOCS_DAYS;
      }
    }
  } catch (e) {
    stats.errors.push(`fatal: ${(e as Error).message}`);
  }

  // Send email report
  try {
    const subject = stats.staleDocsWarning
      ? `[${APP_NAME}] ⚠️ Documentación desactualizada — Auditoría ${fmtDate(new Date())}`
      : `[${APP_NAME}] Auditoría de Documentación — ${fmtDate(new Date())}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: PLATFORM_OWNER_EMAIL,
      subject,
      body: buildEmail(stats),
      from_name: APP_NAME,
    });
  } catch (e) {
    stats.errors.push(`email: ${(e as Error).message}`);
  }

  return Response.json({ success: true, ...stats });
});
