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

## ⚠️ Backend functions do NOT auto-deploy from git

Merging a PR to `main` rebuilds and redeploys the **site** (frontend) only.
Backend functions under `base44/functions/` are deployed **separately and
manually** via the Base44 CLI. **After any PR that adds, removes, renames, or
edits a function, someone must run `npx base44 functions deploy` — otherwise the
deployed frontend calls endpoints that don't exist on the backend.**

> Reference (2026-07-02 outage): PR #241 switched every frontend call to the new
> `invoke('<router>', { action })` contract and merged. The site redeployed with
> the new contract, but the 13 routers were never deployed. Every function call
> 404'd; because `PermissionContext` loaded the user role in the same
> `Promise.all` as `invoke('permissions', …)`, that failing call blanked the
> **entire navigation** — the app looked completely empty even though it loaded.
> (Hardened in #242: identity now loads independently of the permissions call.)

### Deploy checklist after touching `base44/functions/`

1. `git pull origin main` on the deploy machine so its `base44/functions/`
   matches what the site expects (a **stale local checkout deploys stale
   function names** — this is what turned the outage into a 90-function push).
2. `npx base44 functions deploy --force`
3. `npx base44 functions list` — confirm the routers are present and the total
   is ≤ 50.

### Recovering from a "Maximum of 50 functions per app reached" jam

If a deploy from a stale/pre-consolidation checkout pushed the old individual
functions and half-filled the 50-slot cap, `--force` can't help on its own: it
deletes remote-only functions **after** uploading, so the uploads hit the cap
first. Clear room, then deploy:

1. Delete the old individual (now-consolidated) function names from the backend
   — `npx base44 functions delete <name...>` accepts many names at once and
   treats "not found" as harmless. The names are every `handle as <name>` entry
   across `base44/functions/*/handlers/index.ts`.
2. `npx base44 functions list` — confirm you're back to the ~30 out-of-band
   helpers with free slots.
3. `npx base44 functions deploy --force` — the 13 routers now fit
   (30 + 13 = 43 ≤ 50). Expect `13 deployed, 30 unchanged, 0 errors`.

## 2026-10-01 — Consolidation waves 1 and 2 (47 → 35)

Verified against production first (`base44 functions list` = the same 47 as the
repo; active workflows = 3). Removed 12 functions, none of which had a caller in
`src/`, workflows, agents, other functions, other repos or Mission Control:

- **Wave 1 (no callers / one-off):** `getAppState`, `getBusinessName`,
  `getCorrectBusiness`, `generateUniqueBarcode`, `updateProductStockSafe`
  (orphaned since aae8f74, 2026-04-20; it also set stock without a movement),
  `initAppVersion`, `updateAppVersion`, `syncAppVersionToDB` (would roll the
  version back to 2.8.1 if run), `upsertMissingRoleDefaults`,
  `migrateWholesaleMinQtyToCategory`.
- **Wave 2 (dead automations):** `syncProductStock` (deliberate no-op) together
  with its workflow "Sync Product Stock on Movement" (archived in the panel), and
  `onProductCreateValidate` (proof of concept, always 401 in automation context,
  no trigger attached).

`maxFunctions` lowered 47 → 40. Still pending: wave 3 (`applyMovementStock`,
`syncCashSaleToPettyCash`, owner repairs → routers; needs tests first) and wave 4
(`jobs` router for the cron functions). Note: `dailyStockReconcile`,
`cleanupSessions`, `dailyPermissionAudit`, `dailyDocumentationAudit` and
`sendCourseReminders` are deployed but have **no scheduler** — nothing runs them.
Full analysis: ~/Documents/09_Proyectos_Cowork/Negocios_StockFlow_ConsolidacionFunciones/.

## Wave 3 (PR #417, deployed and verified in production 2026-10-01)

Moved verbatim into router handlers (old standalone functions stay deployed
until verified in production, then are deleted — done in the follow-up PR that removes the four legacy directories):

| Old function | New home |
|---|---|
| `applyMovementStock` | `movements` action `applyMovementStock` |
| `syncCashSaleToPettyCash` | `pettyCash` action `syncCashSaleToPettyCash` |
| `upgradeOwnerToAdmin`, `restoreOwnerAdmin` | `permissions` actions of the same name |

**Contract change (backend-only, frontend untouched):** `syncCashSaleToPettyCash`
already used `action` for `create|reverse|reconcile`. Behind the router `action`
is the handler name, so the sub-action now travels in `sync_action`. All 13
backend call sites (5 `applyMovementStock`, 8 `syncCashSaleToPettyCash`) were
updated to `invoke('movements'|'pettyCash', { action: <handler>, ... })`.
Anyone still calling the OLD functions (e.g. a panel automation) keeps working
until they are deleted. Characterization tests:
`base44/tests/ola3_stock_and_cash_test.ts` (run with `--allow-env --allow-read`).
