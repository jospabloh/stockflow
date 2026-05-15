#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;
const CONFIG_PATH = join(ROOT, 'src', 'lib', 'appConfig.js');

const rl = createInterface({ input, output });

async function ask(question) {
  if (process.env.CI) return '';
  const answer = await rl.question(question);
  return answer.trim();
}

async function callAnthropic(gitLog, version) {
  const apiKey = process.env.ANTHROPIC_API_KEY_SF;
  if (!apiKey) {
    console.warn("⚠️ ANTHROPIC_API_KEY_SF no configurada. Generando changelog genérico.");
    return [`Actualización a la versión ${version}`];
  }

  console.log("🤖 Consultando a Anthropic para generar el changelog...");
  const systemPrompt = `Eres un redactor técnico que genera changelogs de software en español (es-MX) para StockFlow, un sistema de inventario SaaS multi-tenant.
Escribe cambios concisos, orientados al usuario final, usando emojis al inicio de cada línea.
Devuelve SOLO un array JSON de strings, sin explicaciones adicionales.`;

  const userPrompt = `Genera el changelog para la versión ${version} de StockFlow basándote en estos commits de git:
${gitLog}

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
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    console.warn(`⚠️ Anthropic API falló: ${res.status}`);
    return [`Actualización a la versión ${version}`];
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '[]';

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [`Actualización a la versión ${version}`];
  return JSON.parse(match[0]);
}

async function main() {
  console.log('== 🚀 StockFlow Release Publisher ==\n');

  // 1. Obtener commits recientes
  console.log('📦 Obteniendo commits recientes...');
  let gitLog = '';
  try {
    gitLog = execSync('git log --oneline -10').toString().trim();
    console.log(gitLog);
  } catch {
    gitLog = 'Sin commits recientes';
  }

  // 2. Leer versión actual
  let configSrc = readFileSync(CONFIG_PATH, 'utf8');
  const versionMatch = configSrc.match(/export const APP_VERSION = "([^"]+)";/);
  if (!versionMatch) throw new Error("No se pudo encontrar APP_VERSION en appConfig.js");
  
  const currentVersion = versionMatch[1];
  console.log(`\nVersión actual: ${currentVersion}`);
  
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  const nextPatch = `${major}.${minor}.${patch + 1}`;
  
  let newVersion = nextPatch;
  if (!process.env.CI) {
    const userInput = await ask(`Nueva versión (default: ${nextPatch}): `);
    if (userInput) newVersion = userInput;
  }

  // 3. Generar Changelog
  const changes = await callAnthropic(gitLog, newVersion);
  console.log('\n📝 Changelog Generado:');
  changes.forEach(c => console.log(`  - ${c}`));

  if (!process.env.CI) {
    const confirm = await ask('\n¿Proceder con la actualización? (Y/n): ');
    if (confirm.toLowerCase() === 'n') {
      console.log('Cancelado.');
      process.exit(0);
    }
  }

  const dateStr = new Date().toISOString().split('T')[0];

  // 4. Modificar appConfig.js
  configSrc = configSrc.replace(
    /export const APP_VERSION = "[^"]+";/,
    `export const APP_VERSION = "${newVersion}";`
  );
  configSrc = configSrc.replace(
    /export const RELEASE_DATE = "[^"]+";/,
    `export const RELEASE_DATE = "${dateStr}";`
  );

  const changesLiteral = changes.map(c => `      ${JSON.stringify(c)},`).join('\n');
  const newChangelogEntry = `  {
    version: "${newVersion}",
    date: "${dateStr}",
    changes: [
${changesLiteral}
    ],
  },`;

  configSrc = configSrc.replace(
    /export const CHANGELOG = \[\n/,
    `export const CHANGELOG = [\n${newChangelogEntry}\n`
  );

  writeFileSync(CONFIG_PATH, configSrc);
  console.log(`✅  appConfig.js actualizado a la versión ${newVersion}`);

  // 5. Auditar Permisos (otorgar por defecto a admins si hay nuevos)
  // We execute audit-permissions.mjs. Note: it's a read-only script, but we remind the user.
  console.log('\n🔍 Ejecutando auditoría de permisos...');
  try {
    execSync('node scripts/audit-permissions.mjs', { stdio: 'inherit' });
  } catch (e) {
    console.log('⚠️ La auditoría de permisos reportó advertencias.');
  }

  // 6. Generar snapshots para Base44
  console.log('\n🔄 Generando snapshots para Base44...');
  execSync('npm run generate:all', { stdio: 'inherit' });

  if (process.env.CI) {
    console.log('\n✅ Script completado en modo CI. Los cambios están listos para el PR.');
  } else {
    console.log('\n🎉 Release preparado localmente.');
    console.log('Siguientes pasos:');
    console.log('1. Revisa appConfig.js y src/lib/permissionRegistry.js');
    console.log('2. Haz un git commit y push a GitHub.');
    console.log('3. Base44 desplegará automáticamente la nueva versión sin atascarse.\n');
  }
  
  rl.close();
}

main().catch(console.error);
