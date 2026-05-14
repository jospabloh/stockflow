import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const APP_NAME = 'StockFlow';
const BRAND_COLOR = '#4F46E5';
const STALE_DOCS_DAYS = 60;

// AUTOGEN:VERSION_SNAPSHOT:BEGIN — regenerado por scripts/generateVersionHistorySnapshot.mjs
const SNAPSHOT_VERSION = "2.13.0";
const SNAPSHOT_RELEASE_DATE = "2026-05-14";
const SNAPSHOT_GIT_LOG = `
4b94c9e Update base44 packages
a8b8493 Update base44 packages
76f17f8 File changes
79308ce chore: add base44 CLI config files
49bf5c7 Update base44 packages
3080ae0 Merge pull request #51 from jospabloh/claude/add-family-id-creator-email-W5D90
9abb358 Mostrar ID del negocio y correo del creador en panel de Licencias
8e1483b File changes
93071a9 File changes
5ccf920 File changes
2e23157 File changes
14c4f54 File changes
bbf2f64 File changes
b447ef0 File changes
3c108ef File changes
6baa123 File changes
aeed444 Gestión de pagos implementada
1114423 File changes
086cfef File changes
d5cef20 File changes
262c4db File changes
68aa765 File changes
451be9d File changes
4e7bfd4 File changes
3356a4d File changes
`;
const SNAPSHOT_LATEST_CHANGES = [
  "🔐 Permisos granulares: política oficial de defaults — Admin inicia con acceso total (true) en todos los módulos, visuales y acciones",
  "👥 Member/Almacenista mantiene acceso operativo; permisos sensibles o nuevos no se elevan automáticamente",
  "🆕 Nuevo módulo, visual o acción: default para member en false hasta otorgamiento explícito por admin",
  "🧩 Matriz de permisos alineada a acciones estándar: view, add, modify, delete",
  "📚 Manual de permisos actualizado con cobertura completa de módulos activos y reglas de gobernanza",
];
// AUTOGEN:VERSION_SNAPSHOT:END

function fmtDate(d) {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function callAnthropic(gitLog, version, existingChanges) {
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
  const text = data.content?.[0]?.text ?? '[]';

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Respuesta inesperada de Anthropic: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

// Badge states: "synced" | "created" | "error"
function buildEmail(s) {
  const hasErrors = s.errors.length > 0;
  const statusColor = hasErrors ? '#dc2626' : '#16a34a';
  const statusLabel = hasErrors ? `⚠️ ${s.errors.length} error(es)` : '✅ Sin errores';

  let syncBadge;
  if (s.changelogBadge === 'synced') {
    syncBadge = '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:12px;font-size:12px">✅ Al día</span>';
  } else if (s.changelogBadge === 'created') {
    syncBadge = '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:12px">🆕 Se creó</span>';
  } else {
    syncBadge = '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:12px">❌ Error</span>';
  }

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

  const runAt = new Date().toISOString();
  const stats = {
    runAt,
    snapshotVersion: SNAPSHOT_VERSION,
    dbVersion: null,
    // "synced" | "created" | "error"
    changelogBadge: 'error',
    appVersionUpdated: false,
    daysSinceLastRelease: null,
    staleDocsWarning: false,
    errors: [],
  };

  try {
    // ── FIX 2: Check AppChangelog by version (filter, not list-all) ──────────
    let existingChangelogs = [];
    try {
      existingChangelogs = await base44.asServiceRole.entities.AppChangelog.filter({
        version: SNAPSHOT_VERSION,
      });
    } catch (e) {
      stats.errors.push(`filter AppChangelog: ${e.message}`);
    }

    const existingEntry = existingChangelogs.length > 0 ? existingChangelogs[0] : null;

    if (existingEntry) {
      // ── FIX 3: Badge "Al día" → ya existía antes de esta ejecución ──────
      stats.changelogBadge = 'synced';
    } else {
      // Need to create — first get AppVersion for released_at and notes
      let appVersionRecord = null;
      try {
        const versions = await base44.asServiceRole.entities.AppVersion.list();
        if (versions.length > 0) appVersionRecord = versions[0];
      } catch (e) {
        stats.errors.push(`list AppVersion: ${e.message}`);
      }

      // Generate changelog text via Anthropic (fallback to snapshot)
      let generatedChanges = SNAPSHOT_LATEST_CHANGES;
      try {
        generatedChanges = await callAnthropic(SNAPSHOT_GIT_LOG, SNAPSHOT_VERSION, SNAPSHOT_LATEST_CHANGES);
      } catch (e) {
        stats.errors.push(`Anthropic API: ${e.message} — usando cambios del snapshot`);
      }

      // ── FIX 1: Only update AppVersion if version actually changed ────────
      const releasedAt = appVersionRecord?.released_at
        ?? new Date(SNAPSHOT_RELEASE_DATE).toISOString();
      const releaseNotes = generatedChanges.slice(0, 5).join('\n');

      if (appVersionRecord) {
        if (appVersionRecord.version !== SNAPSHOT_VERSION) {
          try {
            await base44.asServiceRole.entities.AppVersion.update(appVersionRecord.id, {
              version: SNAPSHOT_VERSION,
              release_notes: releaseNotes,
              released_at: new Date(SNAPSHOT_RELEASE_DATE).toISOString(),
            });
            stats.appVersionUpdated = true;
          } catch (e) {
            stats.errors.push(`update AppVersion: ${e.message}`);
          }
        }
        // If version matches, skip update entirely (Fix 1)
      } else {
        // No AppVersion record at all — create it
        try {
          await base44.asServiceRole.entities.AppVersion.create({
            version: SNAPSHOT_VERSION,
            release_notes: releaseNotes,
            released_at: new Date(SNAPSHOT_RELEASE_DATE).toISOString(),
          });
          stats.appVersionUpdated = true;
        } catch (e) {
          stats.errors.push(`create AppVersion: ${e.message}`);
        }
      }

      // ── FIX 2: Write AppChangelog with correct schema fields ─────────────
      try {
        await base44.asServiceRole.entities.AppChangelog.create({
          version: SNAPSHOT_VERSION,
          released_at: new Date(SNAPSHOT_RELEASE_DATE).toISOString(),
          notes: generatedChanges.join('\n'),
          synced_at: runAt,
          source: 'cron',
        });
        // ── FIX 3: Badge "Se creó" → se escribió un registro nuevo ahora ──
        stats.changelogBadge = 'created';
      } catch (e) {
        stats.errors.push(`create AppChangelog: ${e.message}`);
        // Badge remains "error"
        stats.changelogBadge = 'error';
      }
    }

    // ── Compute staleness using released_at from AppChangelog ────────────────
    const releaseDate = existingEntry
      ? new Date(existingEntry.released_at ?? SNAPSHOT_RELEASE_DATE)
      : new Date(SNAPSHOT_RELEASE_DATE);

    stats.dbVersion = SNAPSHOT_VERSION;
    if (!isNaN(releaseDate.getTime())) {
      stats.daysSinceLastRelease = daysBetween(releaseDate, new Date());
      stats.staleDocsWarning = stats.daysSinceLastRelease > STALE_DOCS_DAYS;
    }

  } catch (e) {
    stats.errors.push(`fatal: ${e.message}`);
    stats.changelogBadge = 'error';
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
    stats.errors.push(`email: ${e.message}`);
  }

  return Response.json({ success: true, ...stats });
});