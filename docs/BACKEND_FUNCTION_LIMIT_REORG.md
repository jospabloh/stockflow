# Backend Function Limit — Reorganization (StockFlow)

Base44 caps a project at **50 backend functions/endpoints**. StockFlow had
**89** deployed functions and was over the limit. This reorganizes it to **≤50**.

## Key fact: nesting does NOT reduce the count

In Base44 a "function" is any directory with an `entry.ts`/`entry.js`, and its
name is its **full path**. So nesting only reorganizes names — every `entry.ts`
is still one deployed endpoint. The only lever is **consolidating** several
functions behind a single dispatcher endpoint that routes by an `action` field.

## Router pattern

Each router is one endpoint (`functions/<router>/entry.ts`). It reads the
`action` from a **clone** of the request (`req.clone().json()`, so the original
body stays unconsumed) and forwards the intact `req` to a handler module under
`functions/<router>/handlers/<action>.ts`. Handler modules have no `entry.ts`,
so they are bundled code — **not** endpoints — and don't count against the limit.

Each handler is the original function's code moved **verbatim**; only the
`Deno.serve(async (req) => { … })` wrapper became
`export async function handle(req: Request): Promise<Response> { … }`. The handler
still reads `await req.json()` exactly as before, so behavior is unchanged.

Invocation contract:
```js
// before
base44.functions.invoke('createProductSafe', { ...data })
// after
base44.functions.invoke('products', { action: 'createProductSafe', ...data })
```
The `action` equals the original function name. All 59 in-repo call sites across
`src/` were updated. There are no backend cross-calls to any consolidated
function (the only backend-to-backend calls target `applyMovementStock`,
`checkAccountLifecycle`, `sendLifecycleEmails`, `syncCashSaleToPettyCash`, none
of which are consolidated).

## Consolidation map (59 functions → 13 routers)

| Router | Consolidates |
|---|---|
| `products` | createProductSafe, updateProductSafe, deleteProductSafe, generateBarcodeSafe, importItemsSafe, applyInventoryAuditCorrection |
| `categories` | createCategorySafe, updateCategorySafe, deleteCategorySafe |
| `clients` | createClientSafe, updateClientSafe, deleteClientSafe |
| `suppliers` | createSupplierSafe, updateSupplierSafe, deleteSupplierSafe |
| `movements` | createMovementSafe, deleteMovementSafe, confirmMovementPaymentSafe, updateMovementPaymentDetailsSafe |
| `quotations` | createQuotationSafe, updateQuotationSafe, updateQuotationFlagsSafe, cancelQuotationSafe, convertQuotationSafe, deliverQuotationSafe, regenerateQuotation, partialReturnQuotation, calculateQuotationWithTransport, respondToPublicQuotation, getPublicQuotation |
| `quotationPayments` | registerQuotationPayment, editQuotationPayment, deleteQuotationPayment |
| `tenantRules` | adminUpsertTenantRule, adminListTenantRules, adminDeleteTenantRule, getCurrentTenantRuleMap, activateBaristopCashRule |
| `licenses` | adminGetAllLicenses, adminUpdateTenantLicense, getCurrentTenantLicenseState, confirmRenewalPayment, initTenantTrial |
| `permissions` | getPermissionProfiles, upsertPermissionProfile, seedDefaultPermissionProfiles, backfillPermissionDefaults, changeUserRole, getTeamMembers |
| `referrals` | applyReferralCode, getReferralStats |
| `session` | manageSession, sessionHeartbeat, trackUserActivity |
| `business` | updateBusinessSafe, updateAppSettingsSafe, getBusinessCatalogs, validateBusinessOwnership, sendTestLifecycleEmails |

**89 → 43 endpoints.**

## Deliberately left untouched (invoked out-of-band)

Renaming these would break the caller (Base44 dashboard / external service / entity
automation), so they are **not** consolidated:

- **Mission Control bridge**: `acaciaControl`
- **Agent tool** (`base44/agents/*.jsonc`): `notifySupportIssue`
- **Scheduled crons**: `checkAccountLifecycle`, `cleanupSessions`,
  `dailyDocumentationAudit`, `dailyPermissionAudit`, `dailyStockReconcile`,
  `expireTrials`, `processMonthlyRenewal`, `processTrialReactivationEmails`,
  `queueBillingReminders`, `checkTenantLicense`, `sendLifecycleEmails`,
  `migrateViewOnlySince`, `migrateWholesaleMinQtyToCategory`
- **Entity automations / stock hooks**: `applyMovementStock`,
  `onProductCreateValidate`, `syncCashSaleToPettyCash`, `syncProductStock`,
  `updateProductStockSafe`
- **App-version / bootstrap helpers**: `getAppState`, `getBusinessName`,
  `getCorrectBusiness`, `initAppVersion`, `updateAppVersion`,
  `syncAppVersionToDB`, `generateUniqueBarcode`
- **Owner/role one-offs**: `restoreOwnerAdmin`, `upgradeOwnerToAdmin`,
  `upsertMissingRoleDefaults`
- Also note: `auditInventoryNow` is invoked from `Settings.jsx` but has **no
  backend function directory** (a pre-existing dangling call, unrelated to this
  change) — left exactly as-is.

## Deploy (must run outside this env)

The Base44 CLI is blocked from this environment (`403 host_not_allowed`), so
deploy from a machine with Base44 egress:

1. `npx base44 functions deploy --force` (`--force` prunes the removed function
   names from the backend).
2. `npx base44 functions list` to confirm the count is ≤ 50.

No dashboard cron/webhook/agent reconfiguration is required — none of the
consolidated functions were of those kinds.
