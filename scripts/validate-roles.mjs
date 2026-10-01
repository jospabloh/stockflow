#!/usr/bin/env node
// Fails if backend code assigns built-in role 'admin' to a user.
//
// Built-in 'admin' matches the user_condition:{role:"admin"} branch on every
// entity's RLS, and that branch is not scoped to a business. A business admin
// stored as 'admin' could read and write every other business (verified live
// 2026-09-24). Business admins are stored as 'owner'; only the platform-owner
// recovery functions below may write 'admin'.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "base44/functions";
const ALLOWED = new Set([
  "base44/functions/upgradeOwnerToAdmin/entry.ts", // legacy standalone (se borra tras verificar ola 3)
  "base44/functions/restoreOwnerAdmin/entry.ts", // legacy standalone (se borra tras verificar ola 3)
  "base44/functions/permissions/handlers/upgradeOwnerToAdmin.ts",
  "base44/functions/permissions/handlers/restoreOwnerAdmin.ts",
]);
const ASSIGN = /\brole\s*:\s*['"]admin['"]/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

const offenders = [];
for (const file of walk(ROOT)) {
  if (ALLOWED.has(file)) continue;
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    if (ASSIGN.test(code) && !/user_condition/.test(code)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}

// A joiner only gets a business_id from resolveJoinRequest (after an owner/admin
// approves) and a founder from createBusinessSafe. Any other User.update that
// writes business_id would be a way around the approval.
const BUSINESS_ID_WRITERS = new Set([
  "base44/functions/business/handlers/createBusinessSafe.ts",
  "base44/functions/business/handlers/resolveJoinRequest.ts",
  "base44/functions/restoreOwnerAdmin/entry.ts", // platform-owner recovery (legacy standalone)
  "base44/functions/permissions/handlers/restoreOwnerAdmin.ts", // platform-owner recovery
]);
const WRITES_BUSINESS_ID = /User\.update\([^)]*business_id/s;
for (const file of walk(ROOT)) {
  if (BUSINESS_ID_WRITERS.has(file) || file.includes("/tests/")) continue;
  const code = readFileSync(file, "utf8").replace(/\/\/.*$/gm, "");
  if (WRITES_BUSINESS_ID.test(code)) offenders.push(`${file}: writes User.business_id outside createBusinessSafe/resolveJoinRequest`);
}

if (offenders.length) {
  console.error("✗ Role/business assignment outside the sanctioned functions:");
  for (const o of offenders) console.error("  " + o);
  console.error("  Business admins must be stored as role 'owner'; joiners get business_id only from resolveJoinRequest.");
  process.exit(1);
}
console.log("✓ No business code assigns built-in role 'admin'.");
