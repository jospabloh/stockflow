#!/usr/bin/env node
// Interactive codegen: adds a new permission to src/lib/permissionRegistry.js
// Usage: npm run permissions:add

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import process from "node:process";
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const REGISTRY_PATH = join(ROOT, 'src', 'lib', 'permissionRegistry.js');

const rl = createInterface({ input, output });

async function ask(question) {
  const answer = await rl.question(question);
  return answer.trim();
}

async function askChoice(question, choices) {
  console.log(question);
  choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
  while (true) {
    const ans = await rl.question('Choose (number): ');
    const idx = parseInt(ans) - 1;
    if (idx >= 0 && idx < choices.length) return choices[idx];
    console.log('  Invalid choice, try again.');
  }
}

async function main() {
  console.log('\n== Add Permission ==\n');

  const src = readFileSync(REGISTRY_PATH, 'utf8');

  // Find existing module names
  const moduleNames = [];
  const moduleRegex = /^\s{2}["']?([\w\s]+)["']?\s*:\s*\{/gm;
  let m;
  while ((m = moduleRegex.exec(src)) !== null) {
    const name = m[1].trim();
    if (name !== 'PERMISSION_REGISTRY') moduleNames.push(name);
  }

  console.log('Existing modules:', moduleNames.join(', '));
  let moduleName = await ask('Module name (existing or new): ');
  if (!moduleName) { console.log('Cancelled.'); rl.close(); return; }

  const actionId = await ask('Action ID (e.g. approve_discount): ');
  if (!actionId) { console.log('Cancelled.'); rl.close(); return; }

  // Check idempotency
  const existingKey = `${moduleName}:${actionId}`;
  if (src.includes(`id: "${actionId}"`) && src.includes(`${moduleName}:`)) {
    // More precise check
    const keyPattern = new RegExp(`${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,200}id:\\s*["']${actionId}["']`);
    if (keyPattern.test(src)) {
      console.log(`\nKey '${existingKey}' already exists. Nothing to do.`);
      rl.close();
      return;
    }
  }

  const label = await ask('Label (human-readable): ');
  const category = await askChoice('Category:', ['visual', 'actionable', 'report']);
  const sensitiveAns = await ask('Sensitive? (y/N): ');
  const sensitive = sensitiveAns.toLowerCase() === 'y';
  const icon = await ask('Icon emoji (default: ⚙️): ') || '⚙️';
  const description = await ask('Description: ');
  const defaultAlmacenistaAns = await ask('Default for almacenista (y/N): ');
  const defaultAlmacenista = defaultAlmacenistaAns.toLowerCase() === 'y';

  // Build the new action entry
  const sensitiveStr = sensitive ? ', sensitive: true' : '';
  const newAction = `      { id: "${actionId}", label: "${label}", category: "${category}", icon: "${icon}"${sensitiveStr}, description: "${description}" },`;

  let updatedSrc = src;

  if (moduleNames.includes(moduleName)) {
    // Find the actions array for this module and append
    const modulePattern = new RegExp(
      `(["']?${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*:\\s*\\{[\\s\\S]*?actions:\\s*\\[)([\\s\\S]*?)(\\s*\\])`,
      'm'
    );
    const match = modulePattern.exec(src);
    if (!match) {
      console.error(`Could not find actions array for module "${moduleName}". Edit registry manually.`);
      rl.close();
      return;
    }
    updatedSrc = src.replace(modulePattern, `$1$2\n${newAction}$3`);
  } else {
    // Create new module before the closing brace of PERMISSION_REGISTRY
    const newModule = `
  "${moduleName}": {
    label: "${moduleName}",
    actions: [
${newAction}
    ]
  },`;
    updatedSrc = src.replace(/^(export const PERMISSION_REGISTRY[\s\S]*?)(\n};)/, `$1${newModule}$2`);
  }

  // Update almacenista defaults if needed
  if (!defaultAlmacenista) {
    // Add to ALMACENISTA_DENIED list in getDefaultsForRole
    const deniedPattern = /(const deniedReports\s*=\s*\[)([\s\S]*?)(\s*\];)/;
    const deniedActionPattern = /(const deniedActionable\s*=\s*\[)([\s\S]*?)(\s*\];)/;
    const targetPattern = category === 'report' ? deniedPattern : category === 'actionable' ? deniedActionPattern : null;
    if (targetPattern) {
      if (targetPattern.test(updatedSrc)) {
        updatedSrc = updatedSrc.replace(targetPattern, `$1$2\n            '${existingKey}',\n          $3`);
      }
    }
    // Also add to ALMACENISTA_DENIED inline array
    const financialVisualPattern = /(const financialVisual\s*=\s*\[)([\s\S]*?)(\s*\];)/;
    if (category === 'visual' && sensitive && financialVisualPattern.test(updatedSrc)) {
      updatedSrc = updatedSrc.replace(financialVisualPattern, `$1$2\n            '${existingKey}',\n          $3`);
    }
  }

  writeFileSync(REGISTRY_PATH, updatedSrc);

  console.log(`\n✓ Updated src/lib/permissionRegistry.js`);
  console.log(`  Added: ${existingKey} (${category}${sensitive ? ', sensitive' : ''})`);
  console.log(`  Default almacenista: ${defaultAlmacenista}`);
  console.log(`\nReminder: use can('${moduleName}', '${actionId}') in your component.`);

  rl.close();
}

main().catch(e => { console.error(e); process.exit(1); });
