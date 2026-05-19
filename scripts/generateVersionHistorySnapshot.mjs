#!/usr/bin/env node
/**
 * Genera src/generated/versionHistorySnapshot.ts desde src/lib/appConfig.js y git log,
 * y actualiza el bloque AUTOGEN:VERSION_SNAPSHOT en dailyDocumentationAudit/entry.ts.
 *
 * Uso: npm run generate:version-snapshot
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;

// --- 1. Importar appConfig ---
const { APP_VERSION, RELEASE_DATE, CHANGELOG, USER_MANUAL_LAST_REVIEWED } =
  await import('../src/lib/appConfig.js');

if (!USER_MANUAL_LAST_REVIEWED) {
  console.warn('⚠️  USER_MANUAL_LAST_REVIEWED no está definido en appConfig.js');
}

// --- 2. Capturar git log (últimos 25 commits) ---
let gitLog = '';
try {
  gitLog = execSync('git log --oneline -25', { cwd: ROOT, timeout: 10_000 }).toString().trim();
} catch {
  gitLog = '(git log no disponible)';
}

// --- 3. Generar src/generated/versionHistorySnapshot.ts ---
const generatedAt = new Date().toISOString();
const latestEntry = CHANGELOG[0] ?? { version: APP_VERSION, date: RELEASE_DATE, changes: [] };

const changesLiteral = latestEntry.changes
  .map(c => `  ${JSON.stringify(c)}`)
  .join(',\n');

const changelogLiteral = CHANGELOG.map(entry => {
  const changes = entry.changes.map(c => `    ${JSON.stringify(c)}`).join(',\n');
  return `  {\n    version: ${JSON.stringify(entry.version)},\n    date: ${JSON.stringify(entry.date)},\n    changes: [\n${changes}\n    ]\n  }`;
}).join(',\n');

const snapshotContent = `// AUTO-GENERADO — no editar manualmente.
// Comando: npm run generate:version-snapshot
// Generado: ${generatedAt}

export const SNAPSHOT_VERSION = ${JSON.stringify(APP_VERSION)};

export const SNAPSHOT_RELEASE_DATE = ${JSON.stringify(RELEASE_DATE)};

export const USER_MANUAL_LAST_REVIEWED = ${JSON.stringify(USER_MANUAL_LAST_REVIEWED ?? RELEASE_DATE)};

export const SNAPSHOT_GIT_LOG = ${JSON.stringify(gitLog)};

export const SNAPSHOT_LATEST_CHANGES: string[] = [
${changesLiteral},
];

export const SNAPSHOT_FULL_CHANGELOG: Array<{
  version: string;
  date: string;
  changes: string[];
}> = [
${changelogLiteral},
];
`;

const generatedDir = join(ROOT, 'src', 'generated');
writeFileSync(join(generatedDir, 'versionHistorySnapshot.ts'), snapshotContent);
console.log(`✅  src/generated/versionHistorySnapshot.ts generado (versión ${APP_VERSION})`);

// --- 4. Actualizar bloque AUTOGEN en dailyDocumentationAudit/entry.ts ---
const fnPath = join(ROOT, 'base44', 'functions', 'dailyDocumentationAudit', 'entry.ts');
let fnSource = readFileSync(fnPath, 'utf8');

const escapedGitLog = gitLog.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const changesTs = latestEntry.changes.map(c => `  ${JSON.stringify(c)}`).join(',\n');

const newBlock = `// AUTOGEN:VERSION_SNAPSHOT:BEGIN — regenerado por scripts/generateVersionHistorySnapshot.mjs
const CURRENT_VERSION_IN_CODE = ${JSON.stringify(APP_VERSION)};
const SNAPSHOT_RELEASE_DATE = ${JSON.stringify(RELEASE_DATE)};
const USER_MANUAL_LAST_REVIEWED = ${JSON.stringify(USER_MANUAL_LAST_REVIEWED ?? RELEASE_DATE)};
const GIT_LOG_SNAPSHOT = \`
${escapedGitLog}
\`;
const SNAPSHOT_LATEST_CHANGES = [
${changesTs},
];
// AUTOGEN:VERSION_SNAPSHOT:END`;

fnSource = fnSource.replace(
  /\/\/ AUTOGEN:VERSION_SNAPSHOT:BEGIN[\s\S]*?\/\/ AUTOGEN:VERSION_SNAPSHOT:END/,
  newBlock,
);

writeFileSync(fnPath, fnSource);
console.log(`✅  base44/functions/dailyDocumentationAudit/entry.ts actualizado`);
console.log(`   Versión snapshot: ${APP_VERSION} (${RELEASE_DATE})`);
console.log(`   Git log: ${gitLog.split('\n').length} commits capturados`);
