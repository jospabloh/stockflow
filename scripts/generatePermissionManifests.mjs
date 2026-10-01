#!/usr/bin/env node
/**
 * Genera src/generated/permissionManifests.ts desde src/lib/permissionRegistry.js
 * y actualiza el bloque AUTOGEN:CANONICAL_KEYS en jobs/handlers/dailyPermissionAudit.ts.
 *
 * Uso: npm run generate:permission-manifests
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

// --- 1. Importar el registro de permisos del frontend ---
const { PERMISSION_REGISTRY, ALL_PERMISSION_KEYS, getDefaultsForRole } =
  await import('../src/lib/permissionRegistry.js');

const adminDefaults = getDefaultsForRole('admin');
const almacenistaDefaults = getDefaultsForRole('almacenista');

// Calcular ALMACENISTA_DENIED desde los defaults
const almacenistaDenied = ALL_PERMISSION_KEYS.filter(k => almacenistaDefaults[k] === false);

// --- 2. Generar src/generated/permissionManifests.ts ---
const generatedAt = new Date().toISOString();

const keysLiteral = ALL_PERMISSION_KEYS.map(k => `  "${k}"`).join(',\n');
const adminDefaultsLiteral = ALL_PERMISSION_KEYS
  .map(k => `  "${k}": ${adminDefaults[k]}`)
  .join(',\n');
const almacenistaDefaultsLiteral = ALL_PERMISSION_KEYS
  .map(k => `  "${k}": ${almacenistaDefaults[k]}`)
  .join(',\n');

const registryLiteral = Object.entries(PERMISSION_REGISTRY)
  .map(([mod, def]) => {
    const actions = def.actions.map(a =>
      `    { id: "${a.id}", label: "${a.label}", category: "${a.category}"${a.sensitive ? ', sensitive: true' : ''} }`
    ).join(',\n');
    return `  "${mod}": {\n    label: "${def.label}",\n    actions: [\n${actions}\n    ]\n  }`;
  })
  .join(',\n');

const manifestContent = `// AUTO-GENERADO — no editar manualmente.
// Comando: npm run generate:permission-manifests
// Generado: ${generatedAt}

export const ALL_PERMISSION_KEYS = [
${keysLiteral},
] as const;

export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

export const PERMISSION_REGISTRY: Record<string, {
  label: string;
  actions: { id: string; label: string; category: string; sensitive?: true }[];
}> = {
${registryLiteral},
};

export const ROLE_DEFAULTS: Record<string, Record<PermissionKey, boolean>> = {
  admin: {
${adminDefaultsLiteral},
  } as Record<PermissionKey, boolean>,
  almacenista: {
${almacenistaDefaultsLiteral},
  } as Record<PermissionKey, boolean>,
};
`;

const generatedDir = join(ROOT, 'src', 'generated');
writeFileSync(join(generatedDir, 'permissionManifests.ts'), manifestContent);
console.log(`✅  src/generated/permissionManifests.ts generado (${ALL_PERMISSION_KEYS.length} claves)`);

// --- 3. Actualizar el bloque AUTOGEN:CANONICAL_KEYS en cada función Base44 que
// lo declare. Deno no puede importar desde src/, así que cada función mantiene
// su propia copia — pero esa copia SIEMPRE se regenera desde aquí, nunca a mano.
const canonicalKeysTs = ALL_PERMISSION_KEYS.map(k => `  "${k}"`).join(',\n');
const deniedTs = almacenistaDenied.map(k => `  "${k}"`).join(',\n');

const blockWithDenied = `// AUTOGEN:CANONICAL_KEYS:BEGIN — regenerado por scripts/generatePermissionManifests.mjs
const CANONICAL_KEYS: string[] = [
${canonicalKeysTs},
];

const ALMACENISTA_DENIED = new Set<string>([
${deniedTs},
]);
// AUTOGEN:CANONICAL_KEYS:END`;

const blockKeysOnly = `// AUTOGEN:CANONICAL_KEYS:BEGIN — regenerado por scripts/generatePermissionManifests.mjs
const CANONICAL_KEYS: string[] = [
${canonicalKeysTs},
];
// AUTOGEN:CANONICAL_KEYS:END`;

const AUTOGEN_TARGETS = [
  { path: ['base44', 'functions', 'jobs', 'handlers', 'dailyPermissionAudit.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'permissions', 'handlers', 'backfillPermissionDefaults.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'pettyCash', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'utility', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'supplierPayments', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'catalogSettings', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'products', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'movements', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'quotations', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'quotationPayments', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'business', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'machinerySales', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'categories', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'suppliers', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'contacts', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'courses', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'enrollments', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'clients', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'courseComms', 'handlers', '_permissions.ts'], block: blockWithDenied },
  { path: ['base44', 'functions', 'permissions', 'handlers', 'getPermissionProfiles.ts'], block: blockKeysOnly },
];

for (const { path, block } of AUTOGEN_TARGETS) {
  const fnPath = join(ROOT, ...path);
  let fnSource = readFileSync(fnPath, 'utf8');
  if (!/\/\/ AUTOGEN:CANONICAL_KEYS:BEGIN[\s\S]*?\/\/ AUTOGEN:CANONICAL_KEYS:END/.test(fnSource)) {
    console.error(`❌  ${path.join('/')} no tiene un bloque AUTOGEN:CANONICAL_KEYS — agrégalo manualmente una vez.`);
    continue;
  }
  fnSource = fnSource.replace(
    /\/\/ AUTOGEN:CANONICAL_KEYS:BEGIN[\s\S]*?\/\/ AUTOGEN:CANONICAL_KEYS:END/,
    block,
  );
  writeFileSync(fnPath, fnSource);
  console.log(`✅  ${path.join('/')} actualizado`);
}
console.log(`   Claves canónicas: ${ALL_PERMISSION_KEYS.length}`);
console.log(`   Denegadas para almacenista: ${almacenistaDenied.length}`);
