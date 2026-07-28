import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
const APP_NAME = 'StockFlow';
const BRAND_COLOR = '#4F46E5';
const STALE_MANUAL_DAYS = 60;

// AUTOGEN:VERSION_SNAPSHOT:BEGIN — regenerado por scripts/generateVersionHistorySnapshot.mjs
const CURRENT_VERSION_IN_CODE = "2.18.14";
const SNAPSHOT_RELEASE_DATE = "2026-07-28";
const USER_MANUAL_LAST_REVIEWED = "2026-07-27";
const GIT_LOG_SNAPSHOT = `
cf5e62c Merge pull request #313 from jospabloh/claude/gifted-turing-7puf7q
cfcd736 chore: automated security, quality and permissions audit v2.18.13
cded2ff Update base44 packages
6936e49 Merge pull request #310 from jospabloh/claude/unmerged-branches-cleanup-xwtflm
43f5776 chore(deps): remove unused dependencies
5b3642f Merge pull request #308 from jospabloh/dependabot/github_actions/github-actions-eefdb6dedd
97b8eae chore(deps): bump actions/setup-node in the github-actions group
ab6eefe Merge pull request #307 from jospabloh/claude/unmerged-branches-cleanup-xwtflm
f13d2f5 fix(deps): correct dependabot.yml content (was accidentally base64-encoded)
ae406d9 chore(deps): group dependabot updates into a single weekly PR per ecosystem
2694c98 Merge pull request #293 from jospabloh/automated/release-pr
22a8e83 Merge remote-tracking branch 'origin/main' into automated/release-pr
9e7bbd6 Merge pull request #294 from jospabloh/claude/utility-withdrawals-admin-visibility-99f8g4
01ee5b8 Merge remote-tracking branch 'origin/main' into claude/utility-withdrawals-admin-visibility-99f8g4
c5f2297 Merge pull request #295 from jospabloh/claude/react-deps-merge-conflict-p8c82n
48a8ef9 chore(deps): bump react and @types/react to 19.2.7 / 19.2.17
974e991 Restrict profit withdrawals visibility to admin by default
c15b926 chore: release and update documentation
2934e0f Merge pull request #291 from jospabloh/dependabot/npm_and_yarn/multi-3d3f0671f1
72cfe50 Merge branch 'main' into dependabot/npm_and_yarn/multi-3d3f0671f1
d10efa1 Merge pull request #290 from jospabloh/dependabot/npm_and_yarn/radix-ui/react-select-2.3.3
c35e325 Merge branch 'main' into dependabot/npm_and_yarn/radix-ui/react-select-2.3.3
e927940 chore(deps): bump react-dom and @types/react-dom
ff867b3 Merge pull request #289 from jospabloh/dependabot/npm_and_yarn/radix-ui/react-radio-group-1.4.3
bcd9184 Merge branch 'main' into dependabot/npm_and_yarn/radix-ui/react-radio-group-1.4.3
`;
const SNAPSHOT_LATEST_CHANGES = [
  "🔒 Re-auditoría de seguridad, calidad, permisos y CI: repo sin cambios desde v2.18.13, todas las correcciones previas siguen vigentes (react-leaflet, jsconfig, permiso Caja Chica:add_fund).",
  "📦 Dependencias: aplicado el subconjunto seguro del bump agrupado de dependabot (#315) — Radix UI, React 19.2.8, @tanstack/react-query, vite, etc. Excluidos de este bump: eslint 10.x (sin release de eslint-plugin-react compatible aún — habría roto `npm ci` igual que react-leaflet) y react-window 2.x (cambio de API rompe el build de VirtualizedProductTable.jsx, que usa `FixedSizeList`).",
  "🛠️ dependabot.yml: agregadas reglas ignore para los mayors de eslint y react-window hasta que el ecosistema/código lo soporte, para no repetir el mismo bump roto cada semana.",
  "🛠️ CI: corregido el workflow 'Auto Release PR' — usaba GITHUB_TOKEN por defecto para abrir su PR, y GitHub no dispara otros workflows sobre eventos autenticados con GITHUB_TOKEN, así que Deno CI nunca corría en esa PR (quedaba 'unstable' para siempre). Ahora usa el secret RELEASE_PR_PAT si existe (fallback a GITHUB_TOKEN mientras no se configure).",
  "🧹 Cerradas PR #314 (release automático, superseded por este cambio de versión) y #315 (bump de dependabot, habría roto el build) con explicación — ver comentarios en cada una.",
];
// AUTOGEN:VERSION_SNAPSHOT:END

type CheckStatus = 'ok' | 'auto' | 'human';
interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function notesFromGitLog(gitLog: string, fallback: string[]): string {
  const lines = gitLog
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^[0-9a-f]+\s+Merge (pull request|branch)/i.test(l))
    .map(l => l.replace(/^[0-9a-f]+\s+/, ''))
    .slice(0, 15);
  if (lines.length === 0) return fallback.join('\n');
  return lines.map(l => `- ${l}`).join('\n');
}

function statusBadge(status: CheckStatus): string {
  if (status === 'ok') {
    return '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">✅ OK</span>';
  }
  if (status === 'auto') {
    return '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">🔧 Auto-corregido</span>';
  }
  return '<span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">⚠️ Acción humana</span>';
}

interface AuditStats {
  runAt: string;
  versionInCode: string;
  dbVersion: string | null;
  checks: CheckResult[];
  errors: string[];
}

function buildEmail(s: AuditStats): string {
  const humanItems = s.checks.filter(c => c.status === 'human');
  const headerColor = humanItems.length > 0 || s.errors.length > 0 ? '#dc2626' : '#16a34a';
  const headerLabel = humanItems.length > 0
    ? `⚠️ ${humanItems.length} acción(es) humana(s)`
    : s.errors.length > 0
      ? `⚠️ ${s.errors.length} error(es)`
      : '✅ Todo en orden';

  const rows = s.checks.map(c => `
    <tr>
      <td style="padding:10px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f1f5f9">${c.name}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f1f5f9">${statusBadge(c.status)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0 12px 10px;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb">${c.detail}</td>
    </tr>`).join('');

  const manualSection = humanItems.length > 0
    ? `<div style="margin-top:16px;padding:12px;background:#fefce8;border-left:3px solid #ca8a04;border-radius:4px">
        <p style="margin:0 0 8px;color:#92400e;font-weight:600">Requiere acción humana:</p>
        <ul style="margin:0;padding-left:20px;color:#78350f;font-size:13px">
          ${humanItems.map(c => `<li style="margin-bottom:4px"><strong>${c.name}:</strong> ${c.detail}</li>`).join('')}
        </ul>
      </div>`
    : '';

  const errorsSection = s.errors.length > 0
    ? `<div style="margin-top:16px;padding:12px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px">
        <p style="margin:0 0 8px;font-weight:600;color:#dc2626">Errores internos:</p>
        <ul style="margin:0;padding-left:20px;color:#374151;font-size:13px">
          ${s.errors.map(e => `<li style="margin-bottom:4px">${e}</li>`).join('')}
        </ul>
      </div>`
    : '';

  return `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:${BRAND_COLOR};padding:20px 24px">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${APP_NAME}</h1>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Auditoría Nocturna de Documentación</p>
  </div>
  <div style="padding:28px 24px">
    <h2 style="margin-top:0;color:#111827">Reporte — ${fmtDate(new Date(s.runAt))}</h2>
    <p style="color:#374151;margin:0 0 4px">Estado: <strong style="color:${headerColor}">${headerLabel}</strong></p>
    <p style="color:#6b7280;margin:0 0 16px;font-size:13px">Versión en código: <strong>${s.versionInCode}</strong> · Versión en BD: <strong>${s.dbVersion ?? '— (ninguna)'}</strong></p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">
      ${rows}
    </table>
    ${manualSection}
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
      authorized = Boolean(PLATFORM_OWNER_EMAIL) && user?.email === PLATFORM_OWNER_EMAIL;
    } catch { /* no valid session */ }
  }
  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runAt = new Date().toISOString();
  const stats: AuditStats = {
    runAt,
    versionInCode: CURRENT_VERSION_IN_CODE,
    dbVersion: null,
    checks: [],
    errors: [],
  };

  // ─── CHECK 1 ── DB version record matches CURRENT_VERSION_IN_CODE ────────
  // Source of truth is the code; the DB mirrors it.
  let appVersionRecord: Record<string, unknown> | null = null;
  try {
    const versions = await base44.asServiceRole.entities.AppVersion.list();
    if (versions.length > 0) appVersionRecord = versions[0];
  } catch (e) {
    stats.errors.push(`list AppVersion: ${(e as Error).message}`);
  }

  stats.dbVersion = (appVersionRecord?.version as string) ?? null;

  if (!appVersionRecord) {
    try {
      await base44.asServiceRole.entities.AppVersion.create({
        version: CURRENT_VERSION_IN_CODE,
        release_notes: SNAPSHOT_LATEST_CHANGES.join('\n'),
        released_at: new Date(SNAPSHOT_RELEASE_DATE).toISOString(),
      });
      stats.dbVersion = CURRENT_VERSION_IN_CODE;
      stats.checks.push({
        name: 'Versión en BD',
        status: 'auto',
        detail: `No existía registro AppVersion — creado con versión ${CURRENT_VERSION_IN_CODE}.`,
      });
    } catch (e) {
      stats.checks.push({
        name: 'Versión en BD',
        status: 'human',
        detail: `No se pudo crear AppVersion: ${(e as Error).message}`,
      });
    }
  } else if (appVersionRecord.version !== CURRENT_VERSION_IN_CODE) {
    try {
      await base44.asServiceRole.entities.AppVersion.update(appVersionRecord.id as string, {
        version: CURRENT_VERSION_IN_CODE,
        released_at: new Date(SNAPSHOT_RELEASE_DATE).toISOString(),
      });
      stats.dbVersion = CURRENT_VERSION_IN_CODE;
      stats.checks.push({
        name: 'Versión en BD',
        status: 'auto',
        detail: `BD tenía ${appVersionRecord.version} — actualizada a ${CURRENT_VERSION_IN_CODE} (versión del código).`,
      });
    } catch (e) {
      stats.checks.push({
        name: 'Versión en BD',
        status: 'human',
        detail: `No se pudo actualizar AppVersion a ${CURRENT_VERSION_IN_CODE}: ${(e as Error).message}`,
      });
    }
  } else {
    stats.checks.push({
      name: 'Versión en BD',
      status: 'ok',
      detail: `BD y código coinciden en ${CURRENT_VERSION_IN_CODE}.`,
    });
  }

  // ─── CHECK 2 ── AppChangelog has entries for the current version ─────────
  let currentVersionEntries: Record<string, unknown>[] = [];
  try {
    currentVersionEntries = await base44.asServiceRole.entities.AppChangelog.filter({
      version: CURRENT_VERSION_IN_CODE,
    });
  } catch (e) {
    stats.errors.push(`filter AppChangelog by version: ${(e as Error).message}`);
  }

  const hasPublishedForCurrent = currentVersionEntries.some(
    (e) => (e.published as boolean | undefined) !== false,
  );

  if (hasPublishedForCurrent) {
    stats.checks.push({
      name: 'Changelog en BD',
      status: 'ok',
      detail: `Existe entrada publicada para ${CURRENT_VERSION_IN_CODE}.`,
    });
  } else {
    const notes = notesFromGitLog(GIT_LOG_SNAPSHOT, SNAPSHOT_LATEST_CHANGES);
    try {
      await base44.asServiceRole.entities.AppChangelog.create({
        version: CURRENT_VERSION_IN_CODE,
        released_at: new Date(SNAPSHOT_RELEASE_DATE).toISOString(),
        notes,
        published: true,
        synced_at: runAt,
        source: 'cron',
      });
      stats.checks.push({
        name: 'Changelog en BD',
        status: 'auto',
        detail: `No había changelog para ${CURRENT_VERSION_IN_CODE} — creado desde GIT_LOG_SNAPSHOT.`,
      });
    } catch (e) {
      stats.checks.push({
        name: 'Changelog en BD',
        status: 'human',
        detail: `No se pudo crear AppChangelog ${CURRENT_VERSION_IN_CODE}: ${(e as Error).message}`,
      });
    }
  }

  // ─── CHECK 3 ── Unpublished AppChangelog drafts → publish into current ───
  let drafts: Record<string, unknown>[] = [];
  try {
    drafts = await base44.asServiceRole.entities.AppChangelog.filter({ published: false });
  } catch (e) {
    stats.errors.push(`filter AppChangelog drafts: ${(e as Error).message}`);
  }

  if (drafts.length === 0) {
    stats.checks.push({
      name: 'Drafts pendientes',
      status: 'ok',
      detail: 'No hay registros AppChangelog sin publicar.',
    });
  } else {
    let publishedCount = 0;
    const failures: string[] = [];
    for (const d of drafts) {
      try {
        await base44.asServiceRole.entities.AppChangelog.update(d.id as string, {
          version: (d.version as string) || CURRENT_VERSION_IN_CODE,
          published: true,
          synced_at: runAt,
        });
        publishedCount++;
      } catch (e) {
        failures.push(`${d.id}: ${(e as Error).message}`);
      }
    }
    if (failures.length === 0) {
      stats.checks.push({
        name: 'Drafts pendientes',
        status: 'auto',
        detail: `${publishedCount} draft(s) publicado(s) en versión ${CURRENT_VERSION_IN_CODE}.`,
      });
    } else {
      stats.checks.push({
        name: 'Drafts pendientes',
        status: 'human',
        detail: `${publishedCount} publicado(s), ${failures.length} fallido(s): ${failures.join('; ')}`,
      });
    }
  }

  // ─── CHECK 4 ── User manual reviewed within STALE_MANUAL_DAYS days ───────
  // Manual action only — no automated remediation: a human must read and validate
  // the manual.
  const manualDate = new Date(USER_MANUAL_LAST_REVIEWED);
  if (isNaN(manualDate.getTime())) {
    stats.checks.push({
      name: 'Manual de usuario',
      status: 'human',
      detail: `USER_MANUAL_LAST_REVIEWED no es una fecha válida: "${USER_MANUAL_LAST_REVIEWED}".`,
    });
  } else {
    const ageDays = daysBetween(manualDate, new Date());
    if (ageDays <= STALE_MANUAL_DAYS) {
      stats.checks.push({
        name: 'Manual de usuario',
        status: 'ok',
        detail: `Revisado hace ${ageDays} día(s) (límite ${STALE_MANUAL_DAYS}). Última revisión: ${USER_MANUAL_LAST_REVIEWED}.`,
      });
    } else {
      stats.checks.push({
        name: 'Manual de usuario',
        status: 'human',
        detail: `Han pasado ${ageDays} días desde la última revisión humana del manual (límite ${STALE_MANUAL_DAYS}). Actualiza USER_MANUAL_LAST_REVIEWED en src/lib/appConfig.js tras releer el manual.`,
      });
    }
  }

  // Send email report
  try {
    const humanCount = stats.checks.filter(c => c.status === 'human').length;
    const subject = humanCount > 0
      ? `[${APP_NAME}] ⚠️ Documentación: ${humanCount} acción(es) humana(s) — ${fmtDate(new Date())}`
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
