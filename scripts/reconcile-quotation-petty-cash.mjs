#!/usr/bin/env node
/**
 * Reconciliation tool for the "Confirmar Pago Total" petty-cash bug fixed
 * 2026-08-07 (see stockflow/CLAUDE.md and
 * base44/functions/quotations/handlers/updateQuotationFlagsSafe.ts).
 *
 * BUG SHAPE: before the fix, marking a converted quotation paid via the quick
 * "Confirmar Pago Total" dialog (Quotations.jsx handleConfirmPayment) synced a
 * PettyCashMovement ("Venta confirmada", origin_type: 'quotation',
 * origin_id: quotation.id) using the quotation's FULL total, even when part of
 * that total had already been collected — and separately, correctly, logged —
 * via prior partial payments (registerQuotationPayment.ts, "Pago efectivo"
 * entries). Net effect: petty cash double-counted the already-collected
 * portion, and the quotation's own amount_paid/balance/payments[] never
 * reflected the "Confirmar Pago Total" collection at all.
 *
 * This script finds every quotation with that fingerprint (across ALL
 * businesses by default) and reconciles it: corrects the stray "Venta
 * confirmada" PettyCashMovement's amount down to what was actually newly
 * collected, and backfills the quotation's amount_paid/balance/payments[] so
 * the audit trail is complete. It NEVER touches inventory/stock entities —
 * this bug never wrote to any of those; the script's --audit mode reports a
 * stock sanity check purely to confirm that.
 *
 * Usage:
 *   node scripts/reconcile-quotation-petty-cash.mjs --audit
 *     Scan every business/quotation, print a full report. No writes. Always
 *     run this first and review the output before --apply.
 *
 *   node scripts/reconcile-quotation-petty-cash.mjs --audit --business <id> [--folio <folio>]
 *     Narrow the scan to one business (and optionally one quotation) — useful
 *     to re-check a single reported case, e.g. baristop / COT-260803-0003.
 *
 *   node scripts/reconcile-quotation-petty-cash.mjs --apply [--business <id>] [--folio <folio>]
 *     Same scan, but actually writes the corrections for everything found
 *     (or just the narrowed scope, if --business/--folio are given).
 *
 * Required environment (NOT available in a sandboxed/CI session — run this
 * wherever a real Base44 admin/service token for the StockFlow app exists,
 * e.g. via an authorized Base44 MCP connector or a manually-issued token):
 *   BASE44_APP_ID           (or VITE_BASE44_APP_ID)
 *   BASE44_APP_BASE_URL     (or VITE_BASE44_APP_BASE_URL, defaults to https://app.base44.com)
 *   BASE44_SERVICE_TOKEN    service-role / admin API key for the app
 *
 * REST shape mirrors acacia-mission-control's working Base44 adapter
 * (api/_lib/adapters/base44.js): GET/POST/PUT {BASE}/api/apps/{appId}/entities/{Entity}[/{id}],
 * auth header `api_key: <token>`.
 */

import process from "node:process";

const argv = process.argv.slice(2);
const flags = { audit: false, apply: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--audit") flags.audit = true;
  else if (a === "--apply") flags.apply = true;
  else if (a === "--business") flags.business = argv[++i];
  else if (a === "--folio") flags.folio = argv[++i];
  else if (a === "--help" || a === "-h") flags.help = true;
}

if (flags.help || (!flags.audit && !flags.apply)) {
  console.log(
    "usage: node scripts/reconcile-quotation-petty-cash.mjs (--audit | --apply) [--business <id>] [--folio <folio>]\n" +
      "  --audit   dry-run: scan and report, no writes (always run this first)\n" +
      "  --apply   write the corrections for everything the scan finds\n" +
      "  --business/--folio narrow the scan to one tenant/quotation",
  );
  process.exit(flags.help ? 0 : 1);
}

const APP_ID = process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID;
const APP_BASE_URL =
  process.env.BASE44_APP_BASE_URL || process.env.VITE_BASE44_APP_BASE_URL || "https://app.base44.com";
const TOKEN = process.env.BASE44_SERVICE_TOKEN;

if (!APP_ID || !TOKEN) {
  console.error(
    "Missing BASE44_APP_ID (or VITE_BASE44_APP_ID) and/or BASE44_SERVICE_TOKEN.\n" +
      "This script cannot run without a real Base44 admin/service token for the StockFlow app — " +
      "see the header comment for how to obtain one. Nothing was read or written.",
  );
  process.exit(1);
}

async function call(entity, { method = "GET", id, body, query } = {}) {
  const url = new URL(`${APP_BASE_URL}/api/apps/${APP_ID}/entities/${entity}${id ? `/${id}` : ""}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", api_key: TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`base44 ${method} ${entity}${id ? `/${id}` : ""} → ${res.status} ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

async function listBusinesses() {
  if (flags.business) return [await call("Business", { id: flags.business })];
  return call("Business", {});
}

async function listConvertedPaidQuotations(businessId) {
  const query = { business_id: businessId, status: "converted", paid: true };
  if (flags.folio) query.folio = flags.folio;
  return call("Quotation", { query });
}

async function auditQuotation(business, quotation) {
  const sumOfLoggedPayments = Array.isArray(quotation.payments)
    ? quotation.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : 0;
  const total = Number(quotation.total) || 0;
  const missingAmount = Math.max(0, total - sumOfLoggedPayments);

  if (missingAmount <= 0) {
    return { affected: false };
  }

  const movements = await call("PettyCashMovement", {
    query: { business_id: business.id, origin_type: "quotation", origin_id: quotation.id },
  });
  const strayMovement = (movements || []).find(
    (m) => m.generated_by_system && String(m.description || "").startsWith("Venta confirmada"),
  );

  if (!strayMovement) {
    // paid=true, payments[] under-count total, but no petty-cash entry to correct —
    // out of scope for this script (nothing cash-side to reconcile); flag for manual review.
    return {
      affected: true,
      needsManualReview: true,
      business,
      quotation,
      missingAmount,
      strayMovement: null,
    };
  }

  if (Math.abs((Number(strayMovement.amount) || 0) - missingAmount) < 0.01) {
    return { affected: false }; // already correct (e.g. no prior partial payment existed)
  }

  return {
    affected: true,
    needsManualReview: false,
    business,
    quotation,
    missingAmount,
    strayMovement,
  };
}

async function checkInventorySanity(business, results) {
  // Read-only: this bug never wrote to stock entities. Confirm that by checking
  // one Movement (stock) batch exists per converted quotation we looked at —
  // no corrections are ever made here.
  let checked = 0;
  for (const r of results) {
    if (!r.quotation) continue;
    try {
      const stockMovements = await call("Movement", {
        query: { business_id: business.id, reference: r.quotation.folio },
      });
      checked += Array.isArray(stockMovements) ? stockMovements.length : 0;
    } catch {
      // Movement entity/query shape may vary; this is a best-effort sanity check only.
    }
  }
  return checked;
}

async function main() {
  const businesses = await listBusinesses();
  console.log(`Scanning ${businesses.length} business(es)${flags.folio ? ` for folio ${flags.folio}` : ""}...\n`);

  let scanned = 0;
  let affectedCount = 0;
  let correctedCount = 0;
  let manualReviewCount = 0;
  let totalAdjusted = 0;

  for (const business of businesses) {
    const quotations = await listConvertedPaidQuotations(business.id);
    const auditResults = [];
    for (const quotation of quotations) {
      scanned++;
      const result = await auditQuotation(business, quotation);
      if (result.affected) auditResults.push(result);
    }

    for (const r of auditResults) {
      affectedCount++;
      const { quotation, strayMovement, missingAmount, needsManualReview } = r;

      if (needsManualReview) {
        manualReviewCount++;
        console.log(
          `⚠ MANUAL REVIEW — ${business.name} / ${quotation.folio}: paid=true but payments[] ` +
            `only total ${money(quotation.payments?.reduce((s, p) => s + (Number(p.amount) || 0), 0))} of ` +
            `${money(quotation.total)}, and no matching petty-cash entry was found to correct. ` +
            `Skipped — this script does not guess at movements that don't exist.`,
        );
        continue;
      }

      console.log(
        `${flags.apply ? "✎ FIXING" : "would fix"} — ${business.name} / ${quotation.folio}: ` +
          `PettyCashMovement ${strayMovement.id} amount ${money(strayMovement.amount)} → ${money(missingAmount)}`,
      );
      console.log(
        `           Quotation ${quotation.id}: amount_paid → ${money(quotation.total)}, balance → $0.00, ` +
          `+1 payments[] entry of ${money(missingAmount)}`,
      );
      totalAdjusted += Number(strayMovement.amount || 0) - missingAmount;

      if (flags.apply) {
        await call("PettyCashMovement", { method: "PUT", id: strayMovement.id, body: { amount: missingAmount } });

        const existingPayments = Array.isArray(quotation.payments) ? quotation.payments : [];
        await call("Quotation", {
          method: "PUT",
          id: quotation.id,
          body: {
            amount_paid: quotation.total,
            balance: 0,
            payments: [
              ...existingPayments,
              {
                id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                amount: missingAmount,
                payment_method: strayMovement.payment_method_snapshot || quotation.payment_method || "",
                paid_at: strayMovement.movement_date
                  ? new Date(strayMovement.movement_date).toISOString()
                  : new Date().toISOString(),
                registered_by: "reconcile-quotation-petty-cash-script",
                petty_cash_movement_id: strayMovement.id,
                notes: "Reconciliado — corrección de bug de pago total (ver PR)",
              },
            ],
          },
        });
        correctedCount++;
      }
    }

    const stockChecked = await checkInventorySanity(business, auditResults);
    if (auditResults.length > 0) {
      console.log(`  (inventory check: ${stockChecked} stock movement(s) found for affected quotations, no changes made)\n`);
    }
  }

  console.log("─".repeat(60));
  console.log(`Scanned:        ${scanned} converted+paid quotation(s)`);
  console.log(`Affected:       ${affectedCount}`);
  console.log(`Manual review:  ${manualReviewCount}`);
  console.log(
    flags.apply
      ? `Corrected:      ${correctedCount}`
      : `Would correct:  ${affectedCount - manualReviewCount} (run with --apply to write)`,
  );
  console.log(`Petty-cash amount adjusted: ${money(totalAdjusted)}`);
  console.log("Inventory: read-only check only, no writes made by this script.");
}

main().catch((err) => {
  console.error("Reconciliation failed:", err.message);
  process.exit(1);
});
