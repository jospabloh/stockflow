#!/usr/bin/env node
// Audit script: finds components/pages that look actionable or visual but lack permission gates.
// Exits 0 — does NOT fail the build.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from "node:process";

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

const ACTIONABLE_PATTERNS = [/<Button[^>]*onClick/m, /onClick=\{/m, /onSubmit=\{/m];
const VISUAL_SUFFIX_PATTERN = /(Card|Chart|Section|Alert|Report|StatCard)\.jsx$/;
const GATE_PATTERNS = [/\bcan\(/, /\bcanSee\(/, /<PermissionGate/];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (full.endsWith('.jsx')) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = [
  ...walk(join(SRC, 'pages')),
  ...walk(join(SRC, 'components')),
];

const findings = [];

for (const file of allFiles) {
  const rel = relative(ROOT, file);
  // Skip UI primitive components
  if (rel.includes('components/ui/')) continue;

  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const hasGate = GATE_PATTERNS.some(p => p.test(src));
  if (hasGate) continue;

  const isVisual = VISUAL_SUFFIX_PATTERN.test(file);
  const isActionable = ACTIONABLE_PATTERNS.some(p => p.test(src));

  if (isVisual || isActionable) {
    const reason = [];
    if (isVisual) reason.push('visual-suffix');
    if (isActionable) reason.push('has-onClick/onSubmit');
    findings.push({ file: rel, reason: reason.join(', ') });
  }
}

// Write report
const lines = [
  '# Permissions Audit Report',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  findings.length === 0
    ? 'No issues found — all detectable actionable/visual components have permission gates.'
    : `Found ${findings.length} component(s) that may be missing permission gates:`,
  '',
];

for (const { file, reason } of findings) {
  lines.push(`- \`${file}\` — ${reason}`);
}

lines.push('');
lines.push('## Notes');
lines.push('- This is a heuristic scan. False positives are expected for shared UI primitives.');
lines.push('- To silence a finding, add a `can()` call or `<PermissionGate>` to the component.');
lines.push('- Run `npm run permissions:add` to register a new permission key.');

const reportPath = join(ROOT, 'permissions-audit-report.md');
writeFileSync(reportPath, lines.join('\n'));

console.log(`\nPermissions Audit`);
console.log(`  Scanned: ${allFiles.length} files`);
console.log(`  Issues:  ${findings.length}`);
if (findings.length > 0) {
  console.log('\n  Components possibly missing gates:');
  for (const { file, reason } of findings) {
    console.log(`    - ${file} (${reason})`);
  }
}
console.log(`\n  Report written to: permissions-audit-report.md`);

process.exit(0);
