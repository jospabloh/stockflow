# StockFlow — Project Notes

## Quotation payments: two confirmation flows, only one was partial-payment-aware (fixed 2026-08-07)

A converted quotation can be marked paid two different ways, and only one of them used to
keep petty cash and the quotation's own bookkeeping fields (`amount_paid`/`balance`/
`payments[]`) correct:

- **`registerQuotationPayment.ts`** (the "Registrar Pago" panel,
  `QuotationPaymentsSection.jsx`) — always was correct: validates the entered amount against
  the real outstanding balance, appends to `payments[]`, updates `amount_paid`/`balance`/
  `paid`, and creates a `PettyCashMovement` for exactly the amount entered.
- **`updateQuotationFlagsSafe.ts`**'s quick "Confirmar Pago Total" path
  (`Quotations.jsx` → `handleConfirmPayment`) — used to reconcile petty cash with the
  quotation's **full `total`**, unconditionally, and never touched `amount_paid`/`balance`/
  `payments[]` at all. A quotation that already had a partial payment registered via the
  correct flow, then finished off via "Confirmar Pago Total", got **double-counted**: the
  already-collected partial amount stayed in its own "Pago efectivo" petty-cash entry, *and*
  the full total got recorded again as a second "Venta confirmada" entry.

> Reference (baristop, 2026-08-06): a $1,070 quotation paid in two $535 cash installments —
> the second installment (finished via "Confirmar Pago Total") was recorded in petty cash as
> $1,070 instead of the $535 actually still owed, so the ledger showed $1,605 collected
> against a $1,070 sale. Symptom of this class of bug: a converted quotation's `paid: true`
> is correct, but its petty-cash total exceeds its `total`, and/or `amount_paid` stays stale
> at the last partial-payment amount even though the quotation shows fully paid.

**Fix:** `updateQuotationFlagsSafe.ts` now computes `newlyCollected = total - amount_paid`
(pre-update) and reconciles petty cash with that instead of the raw total, and — when it's
the call that first flips `paid` to `true` — also sets `amount_paid`/`balance`/`payments[]`
itself, mirroring the invariant `registerQuotationPayment.ts` already enforced. Any tenant
affected by this before the fix can be found and corrected with
`scripts/reconcile-quotation-petty-cash.mjs --audit` (add `--apply` to write); it scans every
business for the exact fingerprint (a "Venta confirmada" petty-cash entry that doesn't match
`total - sum(payments[])`) and backfills the missing `payments[]` entry. Requires a live
Base44 service token — see the script's header comment.

**Data audited and corrected, 2026-08-07** (via live Base44 access, both businesses that
existed at the time — Baristop Distribuidora and the internal ACACIA owner sandbox): only one
quotation was ever actually hit by the double-count — Baristop's COT-260803-0003 (the
reference case above), now reconciled: `PettyCashMovement 6a750a5d84dcc1b5f5e39eb5` corrected
from $1,070 → $535, and the `Quotation`'s `amount_paid`/`balance`/`payments[]` backfilled to
match (`$535 + $535 = $1,070`). No other quotation in either business carried a mismatched
"Venta confirmada" entry. Inventory was independently confirmed untouched by this bug (exactly
one stock-exit batch per affected quotation, as expected — this bug never wrote to `Movement`).

**Separate, unrelated finding from the same audit:** `PettyCashMovement`s
`6a4d23138220fb3fa655e50b` and `6a4d23186b241c863502116b` (Baristop, COT-260707-0001) were
exact duplicates — same `origin_id`, same $1,080 amount, created 5 seconds apart on
2026-07-07. This is a race condition in `syncCashSaleToPettyCash`'s create-or-update logic
(reads "no existing record for this origin_id" before either of two near-simultaneous calls —
e.g. a double-click on "Confirmar Pago Total" — has written), not the partial-payment bug
above. The duplicate was neutralized (amount zeroed, annotated) rather than deleted, to keep
an audit trail.

**Fixed 2026-08-10:** `syncCashSaleToPettyCash`'s existing-record check and its create/update
were not atomic, so the race was still live for any concurrent call for the same
`(business_id, origin_id)` — not just a double-click on "Confirmar Pago Total" (the 2026-08-07
fix only guarded that one client button; every other caller — `createMovementSafe`,
`confirmMovementPaymentSafe`, `registerQuotationPayment`, `cancelQuotationSafe`,
`revertPaymentConfirmationSafe` — could still race). Base44 entity schemas have no DB-level
uniqueness constraint to enforce this atomically (confirmed via the Base44 CLI skill's entity
schema reference — field types are `string|number|integer|boolean|array|object|binary`, no
unique-index concept), so the fix closes the window from the other side: right after every
create/update, the function re-reads what's actually in the table for
`(business_id, origin_id, generated_by_system=true)`, keeps exactly one deterministic survivor
(oldest `created_date`, id tiebreak — same on every caller, so concurrent requests converge on
the same winner), and neutralizes the rest using the same "zero the amount, annotate, don't
delete" convention as the manual COT-260707-0001 fix. A duplicate can still exist for the few
hundred ms between two concurrent writes, but it cannot survive past the losing request's own
return — including when that request is the one that created it. See
`base44/functions/syncCashSaleToPettyCash/entry.ts` (`reconcileDuplicates`/`pickSurvivor`).

**Correction (same day, caught by automated PR review before it caused any real harm):** the
first version of this fix ran `reconcileDuplicates` unconditionally, which silently overrode a
tenant that had explicitly set `config_json.prevent_duplicates: false` on the rule — the
pre-existing pre-write cleanup a few lines below already respected that flag, the new post-write
one didn't. Fixed by threading `ruleConfig.prevent_duplicates` into `reconcileDuplicates`: with
it off, the function still computes the same deterministic survivor (so the response points at a
consistent record) but never neutralizes the other rows' data.

## License lifecycle is owned by Mission Control (2026-08-03)

StockFlow has **no native license-*status-transition*** automation.
`checkAccountLifecycle`, `processMonthlyRenewal`, `checkTenantLicense`,
`expireTrials`, `queueBillingReminders`, and `migrateViewOnlySince` were
removed — they duplicated the unified portfolio lifecycle that
`jospabloh/acacia-mission-control` (`api/cron/license-lifecycle.js`) already
runs against `Business.billing_status`. Do not re-add a StockFlow-native cron
that writes `billing_status` or does trial/license status transitions — that
logic belongs in Mission Control now. See `base44/AUTOMATION_SETUP_PROMPT.md`
for the retirement note and a known gap (Mercado Pago pre-charge reminder
emails aren't reproduced there yet).

`sendLifecycleEmails` and `base44/functions/licenses/*` were kept — they're
real dependencies of the manual admin actions in `LicenseAdmin.jsx`
(`confirmRenewalPayment`, `adminUpdateTenantLicense`), unrelated to the
retired cron.

**Documented exception (2026-08-18): `processTrialReactivationEmails` is
intentionally kept**, flagged by a portfolio-standard audit
(`jospabloh/acacia-app-standard`) as looking like the same violation this
section warns against, but it isn't one — it's a distinct engagement feature,
not a lifecycle-status duplicate:
- It **reads** `Business.billing_status === 'trial'` to scope which
  businesses to consider, but **never writes** `billing_status` or does any
  status transition — no overlap with what was removed above.
- It sends a "we miss you" nudge to a specific, narrow audience Mission
  Control's unified cron doesn't address at all: users **still inside an
  active trial** who've been inactive >24h. Mission Control's
  `computePortfolioLifecycleStage` only acts **after** `current_period_end`
  (the read_only/blocked/inactive escalation) — it has no concept of
  "still-active-trial, but user hasn't logged in," so retiring this without
  a replacement would just delete the feature, not centralize it.
- Proposed (not implemented) as a candidate for a future portfolio-wide
  `computePortfolioLifecycleStage` stage — see the 2026-08-18 addendum in
  Mission Control's `docs/superpowers/specs/2026-08-03-portfolio-license-lifecycle-design.md`.
  Until/unless that lands, this stays StockFlow-native. If you touch this
  function, keep it billing_status-**read-only** — the moment it needs to
  write status, it becomes the exact violation this section exists to
  prevent, and belongs in Mission Control instead.

## Base44

This app's data models live as schema-as-code in `base44/entities/*.jsonc`, but
the running app reads/writes against the **deployed** schema in the Base44
backend — the two can drift.

**Always, when working with Base44:** whenever you add or change a field in a
`base44/entities/*.jsonc` file, make sure that schema change is actually
**deployed to the Base44 backend** — don't assume committing the `.jsonc` is
enough. If a schema field only exists in the repo and not in the deployed
schema, Base44 **silently drops** that field on create/update: the record saves
but the new field never persists (no error is thrown). Verify the deployed
schema (e.g. via the Base44 MCP `list_entity_schemas`) and deploy/update it
(`update_entity_schema`) when it's missing the field.

Symptom of this class of bug: a record saves successfully but one specific
field never sticks and reverts to blank on reload.

> Reference: this exact issue caused the "Pagos a Proveedores" invoice-status
> (semáforo) not to save — the `invoice_status` field was in the repo `.jsonc`
> but missing from the deployed `SupplierPayment` schema.

## Base44 RLS field paths (multi-tenant isolation)

Every entity↔user RLS comparison has **two halves**, and getting **either** one
wrong fails *silently* — there is no error, the rule just stops matching. Both
halves must be correct:

- **Entity side (left of the rule):** custom fields are stored under `data.`, so
  the key must be a built-in (`id`, `created_by_id`, `created_date`,
  `updated_date`) or start with `data.`. A bare `business_id` points at a field
  that doesn't exist → the rule matches **every** row → RLS is effectively
  **OFF** (cross-tenant data leak).
- **User side (the template, right of the rule):** custom user fields resolve as
  `{{user.data.<field>}}`. The only bare built-ins are `{{user.id}}`,
  `{{user.email}}`, `{{user.role}}`. `{{user.business_id}}` resolves to
  **nothing** → the rule matches **zero** rows → every tenant sees an empty app
  ("cero items").

**All four operations (read, create, update, delete) need the same `$or` shape.**
The backend "Safe" functions go through `base44.asServiceRole` (see next
section) for **both reads and writes**, and `asServiceRole` evaluates as
`role: admin` with **no end-user context**. So a rule of only
`{{user.data.business_id}}` resolves the user template to **empty**:

- on **writes** → Base44 rejects the write (app-wide silent write outage);
- on **reads** → `asServiceRole.filter()` returns **zero rows**, so any function
  that loads a record before acting on it (`deliverQuotationSafe`, convert,
  register-payment, `manageSession`) sees "not found" and silently does nothing
  (a pedido won't mark Entregado, sessions duplicate every heartbeat).

The tenant branch still isolates **end users**: an `almacenista` never matches
`role: admin`, so they only ever see their own tenant. The admin branch is the
service-role/owner tier (same access the write rules already grant). Trade-off
accepted 2026-06-17: a `role: admin` user could read across tenants via raw API
(never through the app UI, which always filters by `business_id`).
**That trade-off was wrong and is closed (2026-09-24)** — business admins were
stored as `role: admin` too, so it applied to every customer, not just the
platform. See "Dueños de negocio = `owner`" below.

Correct rule for a business-scoped entity — **identical `$or` on all four ops**
(mirrors the `Session` entity, whose `asServiceRole` access already works):

```jsonc
"read": {
  "$or": [
    { "data.business_id": "{{user.data.business_id}}" },
    { "user_condition": { "role": "admin" } }
  ]
}
```

For the `Business` entity itself, scope by its built-in `id`
(`"id": "{{user.data.business_id}}"`) inside the same `$or` admin branch on
read/update/delete.

> Reference (2026-06-16 outage — reads): a "fix" corrected only the entity side
> (`business_id` → `data.business_id`) but left the user side as the
> non-resolving `{{user.business_id}}`. Before, both halves were wrong so the
> rule was a no-op (everyone saw everything); fixing only one half flipped it to
> matching nothing, so **every tenant saw zero items**. Fix was
> `{{user.business_id}}` → `{{user.data.business_id}}` on all 15 business
> entities + `Business`.

> Reference (2026-06-17 outage — writes): activating those now-correct rules on
> all four operations broke **every write app-wide**. The backend "Safe"
> functions write via `base44.asServiceRole` (no user context), so the
> create/update/delete templates resolved to empty and Base44 rejected the
> writes. Symptom: reads work, but nothing saves — "no me deja guardar" /
> marking a pedido delivered "no cambia", with **zero** records created or
> updated in any tenant after the deploy. Fix: add the
> `{"user_condition":{"role":"admin"}}` `$or` branch to create/update/delete on
> all 15 business entities + `Business`, leaving `read` strict.

> Reference (2026-06-17 outage — reads): leaving `read` strict (above) still
> broke every backend action that **reads a record before writing it**. Those
> functions load via `asServiceRole.entities.X.filter(...)`, which (as
> `role: admin`, no user context) matched **zero** rows under the strict read
> rule → "not found" → the action silently no-ops. Symptom: marking a pedido
> **Entregado** did nothing for **both** roles (admin *and* almacenista),
> convert/register-payment failed, and `manageSession` created a duplicate
> `Session` on every heartbeat. Fix: add the same
> `{"user_condition":{"role":"admin"}}` `$or` branch to **`read`** on all 15
> business entities + `Business` + `Session`. End-user isolation is preserved
> (non-admin users never match the admin branch). The alternative — rewriting
> ~70 functions to read via the user-scoped client — was rejected as far riskier
> (many are shared with cron/internal jobs that have no user context).

**Guard:** `npm run validate:rls` (also runs in CI) parses every
`base44/entities/*.jsonc` and fails on any invalid entity- or user-side RLS
path. Run it after touching any `rls` block, and remember to **deploy** the
fixed schema to the Base44 backend (`update_entity_schema`) — the repo `.jsonc`
alone does not change runtime behavior.

## Granular permission-key enforcement for Caja Chica / Utilidad / Pagos a Proveedores (fixed 2026-08-17)

RLS only enforces **tenant isolation** (`business_id` match) — it has no concept
of the app's granular `almacenista` permission keys (`src/lib/permissionRegistry.js`,
e.g. `Caja Chica:add_fund`, `Utilidad:add_withdrawal`). Those keys used to be
enforced **client-side only** (`can()` hides the button) for `PettyCashMovement`,
`UtilityMovement` and `SupplierPayment` — the client wrote them **directly** via
`base44.entities.X.create/update/delete(...)`, with no Safe function in between,
so an authenticated `almacenista` could bypass the UI (e.g. from devtools) and
perform these actions on their own business's records even when explicitly
denied by their admin. Deferred twice before (2026-08-03, 2026-08-10) for lack
of a way to deploy and verify the fix — see git history of this section for
that reasoning.

**Fix:** three new Safe-function groups, one per entity —
`base44/functions/{pettyCash,utility,supplierPayments}/` — each with
create/update/delete handlers (plus a narrower
`updateSupplierPaymentInvoiceStatusSafe` for the semáforo quick-toggle, which
the UI gates on `edit_invoice_status` alone, not `edit_amount`). Every handler
checks, in order: auth → tenant ownership (`business_id` match, same as the
existing Safe functions) → the specific `permissionRegistry.js` key the
corresponding UI button/action already gates on → `write_blocked`
(`billing_status: suspended|view_only`, closing the second half of the gap —
these three entities now inherit the license gate the other ~30 Safe functions
already had) → the field validation the client used to do. The `UtilityMovement`
and `SupplierPayment` handlers also perform the `PettyCashMovement` mirror
write/update/delete themselves (server-side, via `asServiceRole`) exactly as the
client used to, so behavior for a fully-permissioned user (i.e. every admin,
and any almacenista whose permissions were never restricted from the defaults)
is unchanged.

The permission check itself (`hasPermission()`,
`base44/functions/*/handlers/_permissions.ts` — one copy per function
directory, since Deno can't import across them; content is identical and
regenerated, see below) mirrors `PermissionContext.jsx`'s `can()` precedence
exactly: platform-owner email or `role:admin` → always allowed; else an
explicit `true`/`false` override in that business's `PermissionProfile` for
the caller's role wins; else fall back to the registry default
(`ALMACENISTA_DENIED`, same set `getDefaultsForRole('almacenista')` computes on
the client). `hasPermission()` has no npm/SDK imports, so it's covered by real
(not simulated) Deno unit tests —
`base44/tests/permissions_safe_functions_test.ts` — exercising admin-bypass,
default-allow, default-deny, both directions of an explicit `PermissionProfile`
override, cross-tenant profile isolation, and unknown-role deny-by-default,
plus simulated handler-level tests (permission-order, `write_blocked`,
cross-tenant `business_id`) matching the existing pattern in
`base44/tests/integration_test.ts`.

**Regenerating the permission data:** `CANONICAL_KEYS`/`ALMACENISTA_DENIED` in
each `_permissions.ts` are AUTOGEN blocks — `scripts/generatePermissionManifests.mjs`
now includes all three in `AUTOGEN_TARGETS`, so `npm run generate:permission-manifests`
(already wired into `npm run generate:all` / the release script) keeps them in
sync with `src/lib/permissionRegistry.js` forever, same as the pre-existing
`dailyPermissionAudit`/`backfillPermissionDefaults` copies.

The four client call sites (`PettyCashMovementForm.jsx`, `PettyCash.jsx`,
`UtilityMovementForm.jsx`, `Utility.jsx`, `SupplierPayments.jsx`) were migrated
from direct `base44.entities.X.*` calls to `base44.functions.invoke(...)`,
matching the calling convention every other Safe function already uses.

**Verification performed:** `npm run lint`, `npm run build`, `npm run
validate:rls` all pass locally; `deno` isn't available in this session's
sandbox, so the new Deno test suite got its first live run in this PR's CI —
which caught three unrelated, real, pre-existing CI bugs along the way (see
below) before finally going green: `ok | 31 passed | 0 failed` (12 from the
pre-existing `integration_test.ts` + 19 new). **Not** verified: an actual
browser session as a permission-restricted `almacenista`
against the deployed app (still not achievable in this environment) — the risk
this gap in verification carries is bounded by scope: these are brand-new
functions nothing previously called, and the migrated call sites preserve
identical behavior for every admin and for any almacenista who never had these
specific permissions revoked from their defaults (the only case that changes
is an almacenista whose admin explicitly denied one of these actions — for
that case, the action now correctly fails server-side instead of silently
succeeding).

The same class of gap still exists, currently un-exploitable, in two other
Safe functions that validate `business_id` but not the specific permission
key: `partialReturnQuotation` (`Cotizaciones:return`) and
`createQuotationSafe`/`updateQuotationSafe` (`Cotizaciones:create`/
`edit_items`) — both keys are granted to `almacenista` by default today, so
there's no live bypass, but revoking either via `PermissionAdmin` would
silently fail to take effect server-side. Left out of this fix's scope
(read-only entities in this bug's original report, not write-direct-from-client
like the three above); a natural follow-up once `hasPermission()` proves out.

**Separate finding from the same PR: `deno test` had never actually run in
CI.** `.github/workflows/ci.yml`'s test-detection step used `rg -l` to decide
whether to run `deno test` — `rg` (ripgrep) isn't installed on `ubuntu-latest`
runners, so that check always failed and silently fell through to "no test
modules found; skipping," regardless of whether test files existed. This means
**`base44/tests/integration_test.ts` had never actually executed in CI since
it was added** — `deno lint` (syntax/style only) and `validate-entity-rls.mjs`
were the only checks that ever really ran; a broken assertion in either test
file would have gone green forever. Fixed by switching the detection to
`find` (always available on the runner), scoped to `base44/` — the same
scope `deno.json`'s `lint.include` already uses. Scoping mattered: an
unscoped `find .`/`deno test` also discovers the vendored, unrelated
`*.test.js` files under `skills/superpowers-main/` (a Claude Code skill
package checked into this repo, not part of the app), which need a
`node_modules`/`@types/node` this Deno-only workflow never installs and
fail to type-check — caught only once `deno test` started actually running.
Also needed `--allow-env` on the `deno test` invocation itself:
`_permissions.ts` reads `PLATFORM_OWNER_EMAIL` at module load time (same
pattern `getPermissionProfiles.ts` already used), which `deno test`'s default
sandbox blocks even just to import the module — real Base44 function runtimes
always have env access, so this was never a production issue, only a gap in
this test file being the first to actually `import` production handler code
directly instead of simulating it (the pre-existing `integration_test.ts`
never imports anything real, so it never needed this).

## Granular permission-key enforcement, part 2: Rubros / Tipo de Pago / CuentasFondo / AppSettings / on-demand arrivals (fixed 2026-08-18)

The 2026-08-17 fix above covered `PettyCashMovement`/`UtilityMovement`/
`SupplierPayment`. A portfolio-standard audit (`jospabloh/acacia-app-standard`,
module 3) found the same class of gap still open on five more write paths
that were writing directly via `base44.entities.X.*` from the client with no
server-side permission or billing check:

- **`Rubro`, `PaymentMethod`, `FundAccount`** (`Rubros.jsx`,
  `PaymentMethods.jsx`, `FundAccounts.jsx`) — new shared Safe-function group
  `base44/functions/catalogSettings/` (`createCatalogItemSafe` /
  `updateCatalogItemSafe` / `deleteCatalogItemSafe`, all three entities go
  through the same three handlers, parameterized by an `entity` field — see
  `handlers/_entityConfig.ts`). Follows the same order as the 2026-08-17
  fix: auth → `business_id` match → `hasPermission()` → `write_blocked` →
  field whitelist → `asServiceRole` write. `_entityConfig.ts`'s
  `fieldAction` map enforces the same per-field granularity the client
  already had: Rubro/FundAccount gate every field (including the `active`
  toggle) behind one `edit` action, but PaymentMethod splits `edit_name`
  (name) from `edit_status` (the active toggle) — that split is intentional,
  matching `PaymentMethods.jsx`'s two separate `can()` checks, not merged
  into one.
- **`AppSettings`** — its `update` path already went through
  `updateAppSettingsSafe` (business-only, admin-gated), but the **first
  save** (`Settings.jsx`, when no `AppSettings` row exists yet for the
  business) called `base44.entities.AppSettings.create()` directly, with no
  gate of any kind. New `createAppSettingsSafe` handler in the existing
  `base44/functions/business/` group closes it, mirroring
  `updateAppSettingsSafe`'s admin-only check (this entity has no granular
  permission finer than admin — see `Configuracion`'s `deniedActionable`
  list in `permissionRegistry.js`, every edit action is admin-only by
  default) plus the `write_blocked` billing gate `updateAppSettingsSafe` was
  still missing too. Idempotent: if a row already exists (race with another
  tab, or a retry) it updates that row instead of creating a duplicate.
  `Utility.jsx`'s forecast toggle (`utility_forecast_enabled`) had the exact
  same direct-create-or-update gap and got its own narrower fix —
  `toggleUtilityForecastSafe` in the existing `base44/functions/utility/`
  group, gated by `Utilidad:manage_forecast` (the permission the switch
  itself was already client-gated on) rather than the blanket admin check,
  since that key already supports per-role overrides.
- **On-demand arrival registration** (`CreateFromOnDemandModal.jsx`, opened
  from the "Crear" button in `QuotationPreviewDialog.jsx`) — a 3-write
  sequence (`Movement.create` with `stock_applied:true`, `Product.stock`
  update, `Quotation.items` status update) that had **no gate of any kind**,
  not even a client-side `can()` check on the button (only the quotation's
  `status` gated it). New `registerOnDemandArrivalSafe` handler in the
  existing `base44/functions/quotations/` group, gated by
  `Movimientos:entry` (this registers a stock entry — same action id
  `Movements.jsx`'s own entry button already uses) plus an idempotency guard
  matching `deliverQuotationSafe`'s own pattern for its EXIT movements
  (skip if an entry `Movement` already exists for this
  `quotation_id`+`product_id`, since the call isn't atomic and could be
  double-invoked). Kept the exact same write shape the client used
  (`stock_applied:true` + a direct `Product.stock` update, not routed
  through `applyMovementStock` like `deliverQuotationSafe`'s EXIT movements
  are — switching that now would be an unrelated behavior change).
  `QuotationPreviewDialog.jsx`'s "Crear" button now also checks
  `can('Movimientos', 'entry')` client-side, matching the new server-side
  gate.

Two new `_permissions.ts` copies (`catalogSettings/`, `quotations/`) were
added to `AUTOGEN_TARGETS` in `scripts/generatePermissionManifests.mjs` so
they keep regenerating from `permissionRegistry.js` forever, same as the
2026-08-17 copies.

**Verification performed:** `npm run lint`, `npm run build`, `npm run
validate:rls` all pass locally. `deno` isn't available in this sandbox
either (same limitation noted in the 2026-08-17 section) — the new handlers'
Deno correctness gets its first live check in this PR's CI. **Not**
verified: an actual browser session as a permission-restricted `almacenista`
against the deployed app. Risk is bounded the same way as 2026-08-17: these
are new functions nothing previously called (or, for `AppSettings`'s update
path and the existing `utility`/`quotations`/`business` groups, additive new
actions alongside untouched existing ones), and every migrated client call
site preserves identical behavior for admins and for any almacenista who
was never specifically restricted from these actions — the only behavior
change is that an explicitly-denied action now correctly fails server-side
instead of silently succeeding.

## `AppSession` — investigated for the module-3 pattern, correctly excluded (2026-08-18)

A portfolio-standard audit flagged `src/lib/SessionHeartbeat.jsx`'s direct
`base44.entities.AppSession.create/update/get(...)` calls as the last
write path in this repo not yet routed through a Safe function, matching
the same shape of gap the 2026-08-17/2026-08-18 fixes above closed for
`PettyCashMovement`/`Rubro`/`AppSettings`/etc. Investigated rather than
converted by default, because `AppSession` is a different shape of problem
from all of those:

- **RLS already fully closes it, and can't be spoofed.** `AppSession.jsonc`'s
  `create`/`read`/`update` scope every non-admin caller to
  `created_by_id: "{{user.id}}"` — the Base44-assigned creator id, set by the
  platform itself on `create`, never client-supplied. There is no
  `business_id`/tenant field on this entity for a caller to fake, and no way
  for one user's session heartbeat to touch another user's row. This is the
  same non-spoofable-built-in pattern `_agentGuard.ts`-style functions use
  `created_by_id`/`user_id` for elsewhere in the portfolio — it just already
  lived in the RLS rule instead of a Safe function, so there's no equivalent
  of the `PettyCashMovement`/`Rubro`/etc. gap here.
- **Neither of the two things a Safe function would add here applies.**
  (a) There's no granular `almacenista`-style permission key gating "may
  this user heartbeat their own session" — every authenticated user, any
  role, needs this to work, unconditionally. (b) A `write_blocked`
  billing-status gate would be actively wrong: a suspended/view_only
  business's users still need to log in and see *why* — session tracking
  existing specifically so Mission Control can list/revoke sessions and so
  the app can enforce a forced logout has nothing to do with billing state,
  and gating it on `billing_status` would risk locking a suspended tenant's
  users out of the one screen that explains their account is suspended.
- **Converting it would add risk, not remove it.** `SessionHeartbeat.jsx`'s
  own header comment is explicit: "session tracking must never break the
  app" — it's deliberately best-effort, wrapped in try/catch, silently
  no-oping on failure. Routing it through a Safe function adds a network
  hop and a new failure mode (the function itself erroring) to a path whose
  only job is to be invisible when it works and harmless when it doesn't,
  for zero closed gap (RLS already covers the only thing that mattered).

**Conclusion: `AppSession` is correctly left on direct entity writes.** The
module-3 Safe-function pattern applies to writes that need a permission-key
or billing check beyond what RLS's `business_id`/`created_by_id` scoping
already gives — `AppSession` needs neither, so wrapping it would be
converting-for-the-sake-of-consistency, not closing a real gap. This closes
out module 3 for this repo: every remaining direct-write entity in `src/`
has been checked against this same test (does RLS alone leave a permission-
or billing-shaped hole?) and none do.

## 2026-08-10 automated security/quality/release audit

Routine sweep (secrets, dependency, RLS, permissions-heuristic, tenant isolation).
Only one code change came out of it — the `syncCashSaleToPettyCash` race-condition
fix documented above — everything else here was verified and needed no change:

- **Secrets:** grepped `src/` and `base44/` for hardcoded API keys/tokens/passwords
  and checked for tracked `.env*` files — none found.
- **`npm audit`** (clean `npm ci`, not just the partial lockfile scan): 5
  advisories, all verified non-issues for how this app actually uses them —
  none required a code change:
  - `xlsx` (high, no fix available upstream) — already risk-accepted with a code
    comment at `src/lib/exportData.js:118-120`: confirmed the only usage
    (`exportToXLSX`) *writes* files, never calls `XLSX.read`/`sheet_to_json` on
    untrusted input, so the parser-side advisories (prototype pollution, ReDoS)
    don't apply to how this app uses the package.
  - `dompurify` (moderate, via `jspdf`) — the advisory requires calling
    `DOMPurify.sanitize(..., {IN_PLACE: true})` on untrusted HTML, which only
    happens through jsPDF's `.html()` renderer. Confirmed
    `src/lib/exportData.js`'s PDF export uses `jspdf-autotable` (tabular data)
    only — `.html()` is never called, so that code path is unreachable.
  - `js-yaml` (high, via `eslint`) — devDependency-only (lint tooling), never
    shipped in the built app.
  - `nanoid` (high, via `postcss`) — build-time-only, never shipped in the
    built app.
  - `socket.io-parser` (high) — `npm ls socket.io-parser`/`npm ls socket.io-client`
    both resolve empty; it's a stale `package-lock.json` entry from a dependency
    the app no longer declares, not something actually bundled or reachable. Left
    as-is rather than force-regenerating the lockfile (out of scope, risk of
    unrelated version churn); a routine `npm install` will prune it naturally.
- **RLS:** `npm run validate:rls` passes (29 entities, 21 tenant-scoped) — no
  entity- or user-side path regressions.
- **`scripts/audit-permissions.mjs`:** 56 heuristic "possibly missing gates" hits
  across 169 scanned files — this is the same pre-existing, known-noisy baseline
  this script has produced every release cycle (it flags things like `Login.jsx`
  and `ForgotPassword.jsx` for having `onClick`/`onSubmit` handlers, which don't
  need permission gates since they're pre-auth). No new findings traced to this
  session's change — `syncCashSaleToPettyCash` has no UI surface.
- **Permission-enforcement gap** (`PettyCashMovement`/`UtilityMovement`/
  `SupplierPayment` direct writes) — reassessed with live Base44 access this time;
  deferred with a concrete implementation plan rather than rushed. See the
  "Known gap" section above.
- **Version/changelog:** intentionally *not* hand-bumped here. `APP_VERSION`,
  `RELEASE_DATE`, and the in-app changelog in `src/lib/appConfig.js` are already
  fully automated by `.github/workflows/auto-release-pr.yml` on every push to
  `main` (`npm run release` → AI-generated changelog → its own PR,
  `automated/release-pr`) — hand-editing them here would just race that
  workflow's next run. `npm run permissions:audit` and `npm run
  generate:all` are also already wired into that same script.

## Module 7 — self-service data export (added 2026-08-21)

A portfolio-standard audit found `Settings.jsx`'s "Cuenta" tab had the
irreversible delete-account flow but **no data export**. `src/lib/exportData.js`
is not that: it renders a specific on-screen report to XLSX/PDF, not the
tenant's raw rows — so a business could delete its account with no way to take
its own data with it.

**Fix:** new `exportBusinessData` handler in the existing
`base44/functions/business/` group. Runs as service role, but every read is
explicitly filtered by the caller's own `business_id`, re-derived from
`auth.me()` and never taken from the request body, so it can't reach another
tenant's rows. Returns the `Business` row plus every row of 22 business-scoped
entities (AppSettings, Campaign, Category, Client, Contact, Course, Enrollment,
FundAccount, InventoryAuditLog, Movement, PaymentMethod, PermissionProfile,
PettyCashMovement, Product, Quotation, Rubro, Supplier, SupplierPayment,
SupportTicket, SupportTicketMessage, TenantRule, UtilityMovement) as one JSON
payload. A failure on any single entity doesn't fail the export — that entity
comes back empty plus an entry in `errors`, and the UI warns rather than
claiming a clean export.

Two deliberate exclusions: **`User`** (other members' PII — the roster is
already in the Equipo tab) and **`EmailNotification`** (delivery
infrastructure, not the tenant's business data).

**No billing gate, on purpose.** Every other Safe function in this repo
rejects `view_only`/`suspended` with `write_blocked`; this one doesn't,
because it's read-only and a suspended tenant getting its data out is exactly
the case the export exists for. Gating it would make the danger zone a trap.

New permission key **`Configuracion:export_data`**, added to
`permissionRegistry.js` and to the `almacenista` `deniedActionable` list
(same posture as `delete_account`/`audit_inventory` — a full dump of the
business's books is admin-tier). `base44/functions/business/handlers/` got its
own `_permissions.ts` copy, registered in `AUTOGEN_TARGETS` so it keeps
regenerating from the registry like the other six copies. The "Cuenta" tab
now opens on `canDeleteAccount || canExportData` rather than delete alone, so
an operator granted export but not delete still reaches it.

**Verified:** `npm run lint`, `npm run validate:rls` (29 entities, 21
tenant-scoped), `npm run generate:permission-manifests` (185 keys, 54 denied)
and `npm run build` all pass. `deno` isn't available in this sandbox — the new
handler gets its first live `deno lint`/`deno test` in this PR's CI, same
limitation as the 2026-08-17/2026-08-18 fixes. **Not verified:** a browser
session as a permission-restricted `almacenista`. Risk is bounded: this is a
new, read-only function nothing previously called, and no existing call site
changed behavior.

## ACACIA Portfolio Standard

This app is part of the ACACIA portfolio and must stay compliant with
`jospabloh/acacia-app-standard`. Read `STANDARD.md` there before implementing
any item below for the first time, and re-read the relevant section before
touching a module that's already implemented.

- [x] Module 1 — License lifecycle: `Business.billing_status`
      (trial|active|view_only|suspended), written ONLY by Mission Control's
      unified cron. No native lifecycle/renewal/reminder cron here —
      `processTrialReactivationEmails` is a documented exception (reads
      billing_status, never writes it; see its section above).
- [x] Module 2 — Roles (`admin` / `almacenista`) declared in
      `src/lib/permissionRegistry.js`, mapped onto Base44's built-in `role`
      field. Mission Control's operator roles are a separate layer.
- [x] Module 3 — Granular permissions: `src/lib/permissionRegistry.js` +
      server-side `hasPermission()` re-check on every write path, same
      precedence order, gated behind billing_status. Generated server copies,
      drift-checked in CI, with real Deno unit tests.
- [x] Module 4 — RLS: four-op `$or` shape on every tenant entity, both halves
      verified, `validate-entity-rls.mjs` blocking in CI.
- [x] Module 5 — Health: Mission Control polls `acaciaControl`'s `ping`.
- [x] Module 6 — `src/lib/appConfig.js` + the automated
      `auto-release-pr.yml` release workflow (never the routine build).
- [x] Module 7 — Cuenta: license info, team members, **data export**
      (`exportBusinessData`, added 2026-08-21) and irreversible account
      deletion behind a three-step confirmation.
- [x] Module 8 — Soporte writes `SupportTicket` here first, then Mission
      Control pulls it via `acaciaControl`. No parallel triage UI.
- [x] Module 9 — `apps/stockflow.html` on `jospabloh/acaciaco-site`.
- [x] Module 10 — Login: on-brand, distinct error states, suspended/view_only
      explained post-login, links to the marketing page and to support.

Last audited against the standard: 2026-08-21 — module 7's missing data export
was the only open item; closed in this pass.

## Deploy: el id de la app vive en el repo (módulo 11, 2026-08-21)

El 2026-08-21, un `git pull` fallido dejó la terminal parada en `flowfin` y los
seis comandos siguientes desplegaron **el backend de FlowFin** en puntos, radar,
stockflow y ctrlhq: la CLI toma el origen del **directorio actual** y el destino
de `--app-id`, y nada comprueba que coincidan. En radar el `entities push` llegó
a completarse y borró el modelo de datos entero. Detalle en
`jospabloh/acacia-app-standard` → `docs/incidents.md`.

Por eso este repo ya no se deploya a mano:

```bash
npm run deploy            # funciones — lee el appId de base44.app.json
npm run deploy:site       # frontend — mergear a main NO lo hace por ti
npm run deploy:entities   # schema — DESTRUCTIVO, pide escribir "StockFlow"
npm run functions:audit   # quién llama a cada endpoint
```

**Mergear a `main` no deploya el sitio.** Se creyó lo contrario durante meses,
y en flowfin eso dejó un fix de frontend mergeado, verde en CI y **cinco días sin
servir**, con el bug vivo en producción (detalle en el CLAUDE.md de flowfin). El
frontend se deploya a mano con `npm run deploy:site`, igual que las funciones.
Y comprueba el resultado por **contenido**, no por hashes: el checkpoint del app
puede reportar un `git_commit_hash` igual al HEAD de `main` mientras el árbol que
de verdad se sirve está atrasado.

`scripts/base44-deploy.mjs` **rechaza** un `--app-id` por argumento, así que el
directorio y la app destino no pueden desalinearse. `deploy:entities` imprime la
lista de entidades y el nombre de la app antes de pedir confirmación — ver
"36 entidades de FlowFin" mientras crees estar desplegando otra app es la señal
de alto que faltaba.

`npm run validate:functions` (dentro de `npm run lint`) falla si los endpoints
pasan de `maxFunctions` en `base44.app.json` — hoy **46**, con
Base44 cortando en 50. El margen importa: por encima del tope el deploy falla a
media aplicación y la CLI **no** llega a su fase de poda, así que las funciones
viejas siguen ocupando los slots que harían falta para arreglarlo.

**Antes de consolidar o borrar cualquier función, corre `npm run functions:audit`.**
Una función sin llamadores en el repo casi nunca está muerta: el llamador vive
fuera, donde grep no ve — un entity hook de Base44, un cron del panel, un
`tool_config` de un agente, la URL de un webhook. El audit marca esas como
`REVISAR EN PANEL` en vez de adivinar; confírmalas contra
`npx base44 functions list` (anota `(N automation)`) antes de tocarlas.

## Selector de tema: claro / oscuro / dispositivo (módulo 12, 2026-08-21)

El tema se elige desde **un solo control**: un círculo pequeño anclado a una
esquina de la pantalla que muestra el modo vigente y, al pulsarlo, crece de lado
en una pista de tres ranuras (Claro · Oscuro · Sistema) con un indicador que se
desliza a la elegida. Tres estados, tres posiciones físicas — que es justo lo
que un botón sol/luna de dos estados no puede expresar en cuanto "seguir al
dispositivo" entra en la lista.

Lo que se guarda es la **preferencia** (`light` | `dark` | `system`), nunca el
color resuelto: con `system` la app sigue a `prefers-color-scheme` en vivo, sin
recargar. `index.html` trae un script pre-montaje que resuelve y aplica el tema
antes de que monte React, así que el primer frame ya sale del color correcto;
ese script y el proveedor comparten clave y valores, y cada uno lleva un
comentario apuntando al otro.

`src/components/ThemeSwitcher.jsx` es **idéntico byte a byte en todas las apps
del portafolio**. La fuente canónica vive en `jospabloh/acacia-app-standard` →
`shared/theme/`: cámbialo allí y cópialo, no lo edites aquí. Lo único propio de
esta app es `src/lib/useThemeMode.js` (de dónde sale el estado) y las variables
`--theme-switcher-bottom/right` en `src/index.css` (dónde se coloca).

Se quitó el botón cíclico de la cabecera — ya recorría los tres modos, pero
escondía el actual detrás de un icono y obligaba a adivinar el siguiente. El
control sube por encima de la barra inferior en móvil (`max-width: 1023px`).

## `npm run test:smoke` — comprueba el sitio DESPLEGADO (2026-08-22)

`tests/smoke/smoke.spec.js` es la suite compartida del portafolio, idéntica byte
a byte en todos los repos; la fuente canónica está en
`jospabloh/acacia-app-standard` → `shared/smoke/`. Lo propio de esta app vive en
`tests/smoke/smoke.config.js` (URL, `<title>`, cómo representa el tema).

**No comprueba el build local: comprueba lo que se sirve.** Es la automatización
de la regla que cada CLAUDE.md repite — mergear no deploya nada, y hay que
verificar por contenido y no por hash. Afirma cuatro cosas, todas derivadas de
lo que el propio repo produce (nunca de copy adivinado, que se rompe al cambiar
una palabra y enseña a ignorar la suite):

1. responde 200 y el `<title>` es el de esta app — no un deploy viejo ni otro;
2. no lanza excepciones al pintar;
3. el tema llega resuelto desde el primer frame (el script pre-montaje viajó);
4. el selector de esquina está montado, cambia el tema y la preferencia
   sobrevive a un reload.

**No corre en el pipeline normal ni desde un sandbox de desarrollo**: la salida
HTTPS ahí va por un proxy con allowlist que no incluye estos dominios. Corre en
GitHub Actions (`.github/workflows/smoke.yml`): `workflow_dispatch` para
dispararla a mano justo después de un deploy, y un cron diario como red.

    npm run test:smoke                      # contra producción
    SMOKE_URL=https://… npm run test:smoke  # contra un preview

Desde el 2026-08-22 la suite añade una quinta afirmación, del **módulo 12**: el
selector no tapa nada y nada lo tapa, en móvil (390), tablet (834) y escritorio
(1440), plegado y desplegado. Un control anclado por encima de todo en una
esquina es justo lo que acaba sentado sobre una barra inferior o un botón
flotante, y entonces la app pierde una función al ancho que nadie abrió. La
comprobación distingue las dos direcciones — algo pintado encima del selector, y
el selector respondiendo por un control que hay debajo — y nombra el control
afectado. Se coloca con `--theme-switcher-bottom/right`; si otra cosa ya es dueña
de esa esquina, se mueve el selector, no el control.

## Módulo 14 — auditoría de aislamiento multi-tenant (2026-08-22)

Nuevo en `jospabloh/acacia-app-standard`. **No es releer las reglas de RLS** (eso
es el módulo 4): es recorrer, con fecha y por escrito, todo lo que puede cruzar
un inquilino con otro — cada entidad, cada función de backend (el inquilino se
re-deriva en el servidor, nunca del cuerpo de la petición, y en update/delete se
comprueba contra el registro **almacenado**), cada campo bloqueado, cada
exportación/reporte/búsqueda, cada destinatario de correo o webhook, y el cambio
de inquilino. Contra el **esquema desplegado**, no contra el archivo del repo.

Se repite cuando se añade una entidad, una función o un rol. El resultado se
anota aquí, incluyendo **lo que no se pudo verificar** desde el entorno de
trabajo — normalmente una sesión autenticada como usuario restringido de un
segundo inquilino. Decirlo vale más que insinuar una cobertura que no se logró.

Lo que motiva el módulo es que todos los fallos de aislamiento que este
portafolio llegó a desplegar eran **sintácticamente válidos**: la rama de rol sin
`$and` al inquilino en `Parish` de cateqhub, las 84 instancias de liuma donde el
motor descartaba la cláusula hermana de `user_condition`, los campos de licencia
escribibles por el propio inquilino en puntos y rumbo, y el `PermissionProfile`
que ningún RLS puede consultar porque vive en otra fila.

### Resultado — 2026-08-23, contra el esquema desplegado

Contra `list_entity_schemas` (appId `69af971d0fdb362c9ae52ed3`), no contra los
`.jsonc`, más los 46 grupos de funciones de `base44/functions/`.

**Ningún inquilino puede leer ni escribir datos de otro. El aislamiento está
bien.** Lo que esta pasada encontró es otra cosa, y es peor de lo que suena
"módulo 3": **tres puertas que el propio sujeto al que restringen puede
escribir.** Y a diferencia del resto del portafolio, aquí no es latente — hay
dos inquilinos reales y una cuenta `almacenista` real que puede hacerlo hoy.

#### El estado vivo, primero, porque es lo que cambia la lectura

| | |
|---|---|
| `Business` | 2 — `69c593f99e0839c7e07fb5d0` ACACIA OWNER SANDBOX · `69c575fa1beaf2c90214d3ee` Baristop Distribuidora |
| `User` | 3 — dos `admin`, y **`ventas.baristop@gmail.com`, `almacenista` de Baristop** |
| `PermissionProfile` | 4 — entre ellos `69ebcd98244993257cc6f98f`, el perfil `almacenista` de Baristop |

Todas las demás apps de este portafolio se auditaron con un solo inquilino y un
solo usuario, así que sus hallazgos se fecharon como latentes. Éste no lo es.

#### 1. `Business` no tiene un solo bloqueo de campo, y su rama de inquilino no pide rol

La regla desplegada es:

```json
"update": {"$or":[{"id":"{{user.data.business_id}}"},{"user_condition":{"role":"admin"}}]}
```

Ninguno de estos campos lleva `rls.write`: `billing_status`, `status`,
`license_plan`, `licensed_user_limit`, `license_expires_at`,
`license_activated_at`, `trial_start_at`, `trial_end_at`, `auto_renewal`,
`payment_reference`, `activation_notes`, `activated_by_admin`,
`view_only_since`, `archived_at`, `scheduled_delete_at`.

Es exactamente el defecto del módulo 1 que puntos cerró el 2026-08-21 con 17
bloqueos y rumbo el 2026-08-19 con 10 — **los dos que el preámbulo de esta misma
sección cita como escarmiento**. Y aquí es más ancho que en cualquiera de los
dos: la rama de rumbo exigía `owner`/`admin`, la de puntos `business_admin`;
ésta **no exige ningún rol**, sólo pertenecer al inquilino. Un almacenista
califica. Puede devolver su negocio suspendido a `active`, estirarse el
`trial_end_at` o subirse el `licensed_user_limit`.

#### 2. `Business.delete` tiene la misma forma

```json
"delete": {"$or":[{"id":"{{user.data.business_id}}"},{"user_condition":{"role":"admin"}}]}
```

Cualquier miembro del inquilino borra la fila del negocio con una llamada. El
módulo 7 pone una confirmación escrita de tres pasos delante de eso en la
interfaz; RLS no pide nada. La UI es la única puerta y no es una puerta.

#### 3. `PermissionProfile` sólo pide el inquilino, no el rol — y eso deshace el módulo 3

```json
"update": {"$or":[{"data.business_id":"{{user.data.business_id}}"},{"user_condition":{"role":"admin"}}]}
```

Sin mitad de rol. El `almacenista` puede reescribir el perfil que decide qué
puede hacer un `almacenista`.

Vale seguir el hilo hasta el final, porque el trabajo de los días 17 y 18 de
agosto **sí se hizo bien** y aun así queda anulado: los cinco grupos de Safe
functions re-comprueban `hasPermission()` en el servidor, y la segunda
precedencia de `hasPermission()` lee `PermissionProfile`. La comprobación es
real; su entrada la controla el comprobado. Un `almacenista` al que su admin le
negó `Caja Chica:add_fund` se lo vuelve a conceder escribiendo la fila, y el
servidor le da la razón.

cateqhub resuelve esto mismo con `$and[parish_id, $or[role:admin,
parish_role:admin]]`. Aquí falta la mitad del rol, nada más.

### Lo que está bien, y con qué evidencia

- **El aislamiento entre inquilinos, que es lo que este módulo audita.** Forma
  `$or` de cuatro operaciones con `data.business_id` + rama de servicio,
  confirmada en el esquema **desplegado** de `Product`, `PettyCashMovement`,
  `SupportTicket` y `AppSession`. `validate:rls` (29 entidades, 21 con
  inquilino) es bloqueante en CI.
- **El defecto de liuma no está aquí.** Se comprobaron las 29 entidades del repo
  con un script, no a ojo, buscando `user_condition` con claves hermanas —el
  motor las descarta en silencio—: **cero**.
- **Las 32 handlers de update/delete releen el registro almacenado** antes de
  actuar. Sólo dos no comparan inquilino —`adminUpdateTenantLicense` y
  `adminDeleteTenantRule`— y las dos son exclusivas del dueño de plataforma, que
  es su trabajo.
- **Toda función que recibe `business_id` en el cuerpo lo ata.**
  `sendCampaignEmails:21` responde 403 si no coincide con el del solicitante;
  `getCurrentTenantRuleMap` y `upsertMissingRoleDefaults` caen de vuelta a
  `user.business_id` para quien no sea el dueño de plataforma (más blando que un
  403, pero igual de cerrado); las cuatro de `licenses`/`tenantRules` son sólo
  del dueño.
- **Todas las funciones de plataforma fallan CERRADO**: `!PLATFORM_OWNER_EMAIL
  || user.email !== PLATFORM_OWNER_EMAIL` → 403. Sin el secreto no hay bypass,
  hay negación — misma postura que rumbo, contraria a la que flowfin aprendió
  por las malas.
- **`exportBusinessData`** saca `businessId` de `auth.me()` y filtra las 22
  entidades por él.
- **Correo**: `sendCampaignEmails` arma destinatarios desde `Enrollment`/
  `Contact` ya filtrados por el `business_id` verificado; `confirmRenewalPayment`
  escribe sólo a los admins de ese negocio; `processTrialReactivationEmails` va a
  `u.email`.
- **`User.role` y `User.business_id` llevan `rls.write: {role: admin}`.** Eso es
  justo lo que mantiene los tres hallazgos de arriba **dentro** del inquilino: el
  almacenista puede reescribir la licencia y los permisos de su negocio, pero no
  puede moverse a otro.
- **No hay cambio de inquilino**: un `business_id` por usuario, sin entidad
  `Membership`. La pregunta "¿en qué inquilino estoy?" tiene una sola respuesta.

### Una cosa menor, anotada de paso

El camino de respaldo de `getCorrectBusiness` (líneas 40‑42) hace
`Business.list()` como rol de servicio y luego `.find()` en memoria. Devuelve
sólo `{id, name}` del negocio del solicitante, así que no se fuga nada — pero es
una lectura de tabla completa donde bastaba un filtro.

### Lo que no pude verificar

Una sesión autenticada como `ventas.baristop@gmail.com` ejecutando de verdad
1, 2 o 3. **No lo intenté a propósito**: escribir en el inquilino de producción
de un cliente real para demostrar un hallazgo es peor que el hallazgo. La
evidencia son las reglas RLS desplegadas más las filas vivas sobre las que
aplican, las dos leídas del backend en esta pasada.

## Módulo 15 — el puente con Mission Control: una llave por app (2026-08-23)

`INGEST_HMAC_SECRET` es **un solo valor compartido por todo el portafolio**, así
que una firma hecha con él demuestra «alguien tiene el secreto compartido» y
nunca «esto es StockFlow». Como el nombre de la app viaja en el cuerpo, cualquier
app podía firmar una carga diciendo ser otra y Mission Control la escribía con
esa atribución. Lo encontró la auditoría del módulo 14 de Mission Control.

El arreglo es dejar de usar el maestro directamente:

    appKey = HMAC-SHA256(maestro, "acacia.app.v1." + slug)

El prefijo es separación de dominio: garantiza que una llave derivada no puede
coincidir con una firma sobre un cuerpo, y el `v1` permite rotar el esquema sin
rotar el maestro.

`base44/functions/acaciaControl/_acaciaSign.ts`
es **idéntico byte a byte en todas las apps del portafolio**. La fuente
canónica vive en `jospabloh/acacia-app-standard` →
`shared/bridge/acaciaSign.ts`: cámbialo allí y cópialo, no lo edites aquí.
Aquí lo usa `acaciaControl` para **verificar** lo que llega de Mission Control.

**La migración tiene un orden y es el contrario del obvio.** La verificación
acepta las dos llaves mientras `ACCEPT_LEGACY_MASTER` sea `true`, así que da
igual quién despliegue primero. Pero Mission Control despliega al mergear y las
apps a mano, así que MC siempre va primero — por eso MC sigue **firmando** con
el maestro hasta que las nueve apps acepten derivada. **Los dos pasos ya están hechos** (2026-08-24): MC firma con `signFor` y
`ACCEPT_LEGACY_MASTER` está en `false` en los once sitios, así que una firma con
el maestro **ya no se acepta** — que es exactamente lo que cierra el agujero. `ACACIA_APP_SLUG=stockflow` está puesto en los secrets de esta app y verificado:
la sincronización de las 16:29 UTC no registró ni una advertencia contra ella.

**Y ahora hay una prueba, que es lo que faltaba.** El helper no lo comprobaba
nada: cada PR de este módulo decía que recibía su primer type-check al
desplegar. `acaciaSign.test.ts` (canónico en el repo estándar) fija el vector
que la mitad Node de Mission Control ya fijaba —dos implementaciones de HMAC en
dos runtimes sólo siguen siendo iguales si algo lo afirma, y una divergencia se
ve en runtime como `bad signature` en cada llamada, que parece un secreto mal
puesto y no lo es— y afirma lo que este módulo promete: un cuerpo firmado por
una app que dice ser otra **no** verifica. No tiene imports externos ni toca la
red, así que corre en un sandbox donde `jsr.io` y `deno.land` están bloqueados.
El test canónico está en el repo estándar. Aquí `deno lint base44/functions/`
sí corre en CI y fue lo que cazó la criptografía muerta que este módulo dejó
atrás en un primer intento.

**La criptografía en línea que esto reemplaza ya no está.** Cada `acaciaControl`
llevaba su propio `stableStringify` / `hmacHex` / `timingSafeEqual`, copiados a
mano contra `api/_lib/ingestSign.js` de Mission Control. Dejarlos al lado del
helper no es desorden: es una segunda implementación de la misma rutina en el
mismo archivo, que es exactamente la deriva que este módulo quita.

### `deno` SÍ se puede correr aquí — este archivo decía lo contrario

Este CLAUDE.md repetía «deno no está disponible en este sandbox» y por eso
varios cambios de `base44/functions/` se dieron por no verificables y se
mandaron a que CI los mirara por primera vez. **Es falso.** El binario se baja
de la release de GitHub —el mismo sitio de donde lo saca `setup-deno` en el
runner— y GitHub sí pasa por el proxy:

    curl -sSL -o deno.zip https://github.com/denoland/deno/releases/download/v2.9.5/deno-x86_64-unknown-linux-gnu.zip
    unzip -q deno.zip && chmod +x deno && ./deno --version

Lo que de verdad está bloqueado es `deno.land` y `jsr.io`, así que un test que
importe de ahí no resuelve; uno que no importe nada corre igual que en CI. Es la
misma lección que el `000` del proxy en Mission Control: **que una vía esté
bloqueada no significa que la pregunta no tenga respuesta.**

## Módulo 14, cierre: los tres hallazgos quedaron arreglados y desplegados (2026-08-24)

La auditoría del 2026-08-23 (sección "Módulo 14" arriba) dejó tres hallazgos
abiertos — `Business` sin un solo bloqueo de campo, `Business.delete` sin pedir
rol, y `PermissionProfile` sin la mitad de rol. Los tres se cerraron en esta
pasada, contra el **esquema desplegado** (`update_entity_schema`, appId
`69af971d0fdb362c9ae52ed3`), no sólo en el repo — confirmado releyendo con
`list_entity_schemas` después de escribir.

- **`Business`**: los 15 campos que el módulo 14 listó
  (`billing_status`, `status`, `license_plan`, `licensed_user_limit`,
  `license_expires_at`, `license_activated_at`, `trial_start_at`,
  `trial_end_at`, `auto_renewal`, `payment_reference`, `activation_notes`,
  `activated_by_admin`, `view_only_since`, `archived_at`,
  `scheduled_delete_at`) llevan ahora `rls.write: {role: admin}` — mismo
  patrón que puntos (17 bloqueos) y rumbo (10) ya tenían, y que `User.role`/
  `User.business_id` ya usaban en este mismo repo. Los campos de perfil
  general del negocio (`name`, `address`, `logo_url`, `tax_rate`, …) se
  dejaron sin bloquear a propósito: siguen siendo editables por el admin del
  propio inquilino por la vía normal.
- **`Business.delete`**: pasó de `$or[{id:business_id},{role:admin}]` a sólo
  `{role:admin}`. Se confirmó primero que no hay ningún flujo legítimo de
  usuario final que borre la fila `Business` — el "Eliminar cuenta" de
  `Settings.jsx` borra el **usuario**, no el negocio
  ("Los datos del negocio permanecerán en el sistema" es el propio texto de
  la UI), y una baja completa de negocio pasa por `scheduled_delete_at`
  (ya bloqueado arriba), gestionado sólo por las funciones de `licenses/`
  exclusivas del dueño de plataforma. El cambio no le quita acceso a ningún
  flujo real, sólo cierra la llamada cruda por API.
- **`PermissionProfile`**: `create`/`update`/`delete` pasaron de
  `$or[{business_id},{role:admin}]` a sólo `{role:admin}` (idéntico al
  patrón que ya usan `AppSession`/`AppChangelog`/`AppVersion`/
  `EmailNotification`/`SupportTicketMessage` en este mismo repo — no hace
  falta `$and` con el inquilino porque el rol de plataforma/servicio ya
  cubre ambos casos). `read` se dejó intacto: un almacenista sigue
  necesitando leer su propio perfil resuelto para el gateo de UI. Se
  verificó, antes del cambio, que **todo** camino real de escritura ya exigía
  `role:admin` en la capa de aplicación: `upsertPermissionProfile.ts`
  (invocado directo por el cliente) comprueba `user.role !== 'admin'` → 403
  antes de escribir con la identidad de quien llama;
  `seedDefaultPermissionProfiles`, `backfillPermissionDefaults`,
  `changeUserRole`, `upsertMissingRoleDefaults` y `dailyPermissionAudit`
  escriben con `asServiceRole` (que evalúa como `role:admin` sin contexto de
  usuario). Ningún flujo real cambia de comportamiento; sólo se cierra el
  bypass de API cruda que el módulo 14 documentó.

**Verificado:** `npm run validate:rls` (29 entidades, 21 con inquilino),
`npm run lint`, `npm run build` — los tres en verde con los cambios aplicados.
Los dos `entitySchema` enviados a `update_entity_schema` se releyeron con
`list_entity_schemas` y coinciden byte a byte con lo que se pidió escribir.
**No verificado:** una sesión autenticada como `ventas.baristop@gmail.com`
(el almacenista real de Baristop que el módulo 14 nombra) confirmando en vivo
que la escritura ahora falla — mismo límite que el módulo 14 ya declaró, y
por la misma razón: escribir contra el inquilino de producción de un cliente
real para demostrarlo sería peor que dejarlo sin confirmar en ese punto. La
evidencia es la regla RLS desplegada, releída, más la traza de cada camino de
escritura real de `PermissionProfile` confirmando que ya exigía `role:admin`
antes de esta capa.

**Hallazgo separado, mismo barrido — `npm audit`:** de las cuatro
vulnerabilidades de la última pasada (2026-08-10), tres tenían fix disponible
vía parche de una dependencia transitiva y no se habían aplicado:
`socket.io-parser` 4.2.6→4.2.7, `js-yaml` 4.3.0→4.3.1, `dompurify` 3.4.12→3.4.14
(los tres vía `npm audit fix`, sólo `package-lock.json`, sin tocar
`package.json`). Aplicados y verificados: `npm run build` sigue en verde. La
cuarta (`xlsx`, sin fix upstream) se re-verificó y el razonamiento de
2026-08-10 sigue vigente (`src/lib/exportData.js` sólo escribe XLSX, nunca
parsea uno subido por el usuario).

**Corrección sobre el propio hallazgo de 2026-08-10:** esa pasada dio por
"entrada de lockfile obsoleta, no empaquetada" a `socket.io-parser` porque
`npm ls socket.io-parser` resolvía vacío en ese momento. Ya no es así — resuelve
vía `@base44/sdk` → `socket.io-client`, y `FloatingHelpChat.jsx` sí llama
`base44.agents.subscribeToConversation`, que usa ese cliente de socket en
vivo. El riesgo real seguía acotado (el servidor al otro lado es el propio
backend de Base44, no uno arbitrario controlado por un atacante — el modelo
de amenaza del aviso, "memory exhaustion" desde un servidor Socket.IO
malicioso, no aplica a una conexión de primera parte), pero la conclusión de
"no alcanzable" ya no era cierta, y el parche disponible lo vuelve
discutible de todos modos.

## Módulo 18 — cambio de negocio multi-tenant (mergeado 2026-08-26, documentado aquí 2026-08-31, RETIRADO 2026-09-10)

> **Retirado el 2026-09-10.** Lo que sigue es el registro de cómo funcionaba
> mientras existió; el feature ya no está en el repo. Ver la sección final.

`4a7426f` ("Add Módulo 18: multi-tenant account switching and joining") se
mergeó a `main` sin tocar este archivo — el propio Módulo 14 de arriba dice
que su auditoría "se repite cuando se añade una entidad", y `Membership` es
una entidad nueva que nunca la disparó. Esta sección cierra ese hueco de
documentación tras una auditoría rutinaria que sí la leyó.

Antes de `Membership`, `User.business_id` (ya bloqueado a `role:admin`,
módulo 14) era el **único** registro de pertenencia — unirse a un segundo
negocio simplemente sobrescribía el primero, sin dejar rastro de que el
usuario seguía siendo miembro del anterior. `Membership` es ese rastro: una
fila por negocio al que el usuario tiene acceso, independiente de cuál sea
su `business_id` activo ahora mismo. La RLS desplegada (confirmada contra
`list_entity_schemas`, no solo el `.jsonc`) es:

- `create`/`update`/`delete`: sólo `role:admin` (rol de servicio) — ningún
  usuario final escribe esta entidad directamente, igual que
  `PermissionProfile` tras el cierre del módulo 14.
- `read`: `$or[{data.user_id: user.id}, {role:admin}]` — llaveado a
  `user_id`, no a `business_id`, a propósito: es lo que permite listar los
  negocios a los que el usuario pertenece pero no tiene activos ahora mismo
  (el `business_id` del negocio inactivo no coincide con nada del perfil
  del usuario en ese momento).

Los tres únicos escritores son `createBusinessSafe`, `joinBusinessSafe` y
`switchBusinessSafe` (`base44/functions/business/handlers/`), los tres
corren como `asServiceRole` tras validar server-side — un usuario no puede
crearse una membresía en un negocio ajeno ni reescribir el rol de una
propia. Revisado en esta pasada (`switchBusinessSafe.ts`, `joinBusinessSafe.ts`,
`createBusinessSafe.ts`, `Membership.jsonc`, `BusinessSwitcher.jsx`): el
servidor re-deriva la membresía desde cero en cada caso y nunca confía en el
`business_id`/`role` que manda el cliente. **No se encontró ningún defecto**
en esta pasada — el código en sí está bien construido; el único hallazgo es
el hueco de documentación que esta sección cierra.

## Auditoría rutinaria 2026-08-31: tres bypasses de Safe function cerrados (granular permissions, parte 3)

Sweep periódico (branch/PR inventory, `npm ci`/lint/build/`validate:rls`,
`npm audit`, secrets, deno lint + intento de `deno test`, regresión dirigida
sobre las formas de bug que este archivo ya documenta). El repo estaba
consistente con su propio estado documentado en todo lo verificable — nada
de RLS, permisos ni CVEs había retrocedido desde el 2026-08-24. Lo que esta
pasada encontró es la misma clase de gap que las partes 1 y 2 de arriba
(`base44.entities.X.create/update/delete` directo desde el cliente, sin
Safe function de por medio), en tres sitios que ninguna de las dos pasadas
anteriores había cubierto:

- **`Categories.jsx` (`handleSaveCategory`, rama de creación) — regresión,
  no gap nuevo.** `createCategorySafe` ya existía y ya se usaba
  correctamente desde `ProductFormDialog.jsx` (creación rápida de
  categoría) y desde la propia rama de *edición* de `Categories.jsx` — sólo
  la rama de *creación* de este archivo se había quedado en la llamada
  directa, bypaseando el `write_blocked` de `createCategorySafe` para un
  negocio `suspended`/`view_only`. Arreglo: esa rama ahora invoca
  `createCategorySafe`, igual que sus dos vecinos.
- **`BarcodeGenerator.jsx` (`handleSave`) — gap real, sin Safe function
  previa.** Escribía `Product.barcode` directo, sin ningún gate — ni
  siquiera client-side (`/BarcodeGenerator` no tenía `can()` check). Nuevo
  handler estrecho `updateProductBarcodeSafe`
  (`base44/functions/products/handlers/`), deliberadamente **no** enrutado
  por `updateProductSafe` — ese handler está fijo a `role:admin`, pero
  `Productos:edit_barcode` está concedido a `almacenista` por defecto
  (`permissionRegistry.js`), así que reusarlo habría **regresado** la
  función para todo usuario no-admin en vez de cerrar el gap. Mismo patrón
  que `toggleUtilityForecastSafe` (parte 2): un solo campo, gateado por la
  clave de permiso específica que el cliente ya usaba para mostrar el
  control (`Productos:edit_barcode`), más el gate de `business_id` y
  `write_blocked` que faltaban. El cliente ahora también checa
  `can('Productos', 'edit_barcode')` antes de mostrar el generador.
- **`QuotationPreviewDialog.jsx` (`handleShare`/`handleDisableShare`) — gap
  real, no exploitable hoy.** El botón de enlace público ya se gateaba
  client-side con `can('Cotizaciones', 'share')`, pero la escritura
  (`public_token`/`public_link_enabled`) iba directa a `Quotation.update`.
  Nuevo handler `toggleQuotationShareSafe`
  (`base44/functions/quotations/handlers/`, grupo ya existente — no cuenta
  contra el tope de 46 funciones del módulo 11). `Cotizaciones:share` está
  concedido a `almacenista` por defecto, así que esto no era explotable en
  la práctica — misma forma exacta que `partialReturnQuotation`/
  `createQuotationSafe`, que la parte 1 (2026-08-17) ya dejó anotados como
  "fuera de alcance, seguimiento natural". Este cierre es ese seguimiento,
  para uno de los dos.

Los tres arreglos siguen el mismo orden que las partes 1 y 2: auth →
`business_id` contra el registro cargado con `asServiceRole` →
`hasPermission()` → `write_blocked` → escritura. `products/handlers/`
ganó su propia copia de `_permissions.ts` (no existía antes — este grupo
nunca había necesitado una) y se registró en `AUTOGEN_TARGETS`
(`scripts/generatePermissionManifests.mjs`), igual que las seis copias
anteriores.

**Encontrado y NO cerrado en esta pasada, a propósito —
`SupportTickets.jsx` (`createTicket`/`sendReply`)**: la misma forma de gap
(`Centro de Soporte:create`/`reply`, gateados client-side, sin re-chequeo
server-side), pero deliberadamente diferido en vez de arreglado a la carrera:

1. **`Centro de Soporte:create`/`reply` están concedidos a `almacenista`
   por defecto** — no explotable hoy, misma situación que
   `Cotizaciones:share` de arriba antes de su cierre.
2. Es un flujo bastante más grande que los tres de arriba: dos escrituras
   encadenadas (`SupportTicket` + `SupportTicketMessage`) con lógica de
   estado calculada (`status`, `messages_count`, `unread_for_owner`) más un
   webhook saliente a Mission Control (`ticket-pull`) que **no puede
   fallar en silencio de forma distinta** a como falla hoy — Módulo 8 dice
   que este flujo es la única fuente de verdad antes de que Mission Control
   lo recoja.
3. No hay grupo de función existente natural para alojarlo sin crear uno
   nuevo — y el módulo 11 ya deja el margen en cero (46/46). Meterlo en un
   grupo ajeno (p. ej. `business/`) sólo por no sumar un endpoint sería
   forzarlo.
4. Esta sesión no pudo correr `deno test` de verdad (`deno.land` bloqueado
   en este sandbox — ver módulo 15) ni verificar con una sesión
   `almacenista` real. Escribir código nuevo sin poder probarlo, contra un
   flujo del que depende Mission Control, es exactamente el tipo de riesgo
   que este archivo repite que hay que evitar cuando no hace falta
   correrlo — la clave por defecto ya está concedida, así que no hay
   urgencia real.

Queda como seguimiento natural, igual que `Cotizaciones:return`/
`createQuotationSafe` sigue en la lista de la parte 1.

**Verificado:** `npm run lint` (incluye `validate:functions`, 46/46 — sin
margen pero sin regresión), `npm run build`, `npm run validate:rls` (30
entidades, 22 con inquilino), `npm run generate:permission-manifests` (185
claves, 54 denegadas — sólo el `products/handlers/_permissions.ts` nuevo y
el timestamp de `permissionManifests.ts` cambiaron de contenido), `deno
lint base44/functions/` (171 archivos, limpio — el binario de deno **sí** se
pudo descargar y correr en este sandbox, confirmando de nuevo la nota del
módulo 15). `npm audit`: 1 advertencia (`xlsx`, sin fix — mismo estado
aceptado desde 2026-08-10), ninguna nueva. Secrets: limpio.
**No verificado:** `deno test` (bloqueado por `deno.land`, no por el
binario — mismo límite que módulos 3/7 documentan repetidamente) y una
sesión de navegador como `almacenista` con permisos restringidos —
mismo límite y misma razón que el resto de este archivo ya declara.

## Venta de Maquinaria — un libro aparte, no un producto más (2026-09-03)

Silvita (Baristop) pidió «una pestaña de venta de maquinaria», y la petición
traía su propio diseño dentro: *«ahí no sería agregar productos, sería q nos
ponga los campos y nosotros llenarlo»*. Venía de un Excel con nueve columnas
— # · Fecha · Cliente · Nombre del negocio · Tipo · Costo · Venta · Utilidad ·
Comisión.

**Lo que hace que este módulo sea correcto es lo que NO toca.** No escribe
`Movement`, ni `Product.stock`, ni `PettyCashMovement`, ni `Quotation`. Es
tentador engancharlo a caja chica —«una venta es dinero que entra»— y sería un
error: los importes de maquinaria ya entran por el flujo de cotizaciones cuando
corresponde, y duplicarlos aquí reproduce exactamente el doble conteo que la
sección de arriba (2026-08-07) documenta como el bug más caro de este repo.

- **`MachinerySale`** (`base44/entities/MachinerySale.jsonc`): forma `$or` de
  cuatro operaciones, como toda entidad con inquilino. Único obligatorio además
  de `business_id`: `machine_type`. Fecha e importes son opcionales **a
  propósito** — los renglones 2 y 3 del Excel original tienen cliente y tipo
  pero ningún importe, así que una venta en trámite se captura y se termina
  después. La UI la marca «En trámite» en vez de mostrar un cero.
- **La utilidad y la comisión no se guardan.** Se derivan de `cost` y
  `sale_price` en `src/lib/machinerySales.js`. Guardar un total calculable es
  como se desincronizan las cifras.
- **`MACHINERY_COMMISSION_RATE = 0.05`**, en un solo lugar. El Excel encabezaba
  la columna «Comisión 4%»; la petición fue explícita en 5% de la utilidad. Al
  no estar congelada por venta, cambiar la constante recalcula todo el
  histórico — que es lo que se pidió esta vez, pero **piénsalo antes del
  próximo cambio de porcentaje**: si alguna vez hace falta que cada venta
  conserve la tasa a la que se vendió, eso es un campo nuevo, no un ajuste de
  la constante. Una venta a pérdida da comisión `0`, nunca negativa.

### El costo es el campo delicado, y no por lo que parece

`Venta de Maquinaria:financials` es `sensitive`, así que el almacenista no lo
tiene por defecto: captura y consulta la venta sin ver nunca costo, utilidad ni
comisión. Pero `create` y `edit` **sí** se le conceden, al revés que en «Pagos a
Proveedores» — el almacenista de Baristop es literalmente `ventas.baristop@`, y
un registro de ventas que el vendedor no puede llenar no sirve de nada. Sólo
`delete` queda fuera.

De ahí sale la trampa que `handlers/_fields.ts` (`applyCost`) existe para
evitar: **quien no ve el campo tampoco lo envía**, así que un cuerpo sin `cost`
no significa «ponlo en cero». Si el handler lo leyera del cuerpo, un
almacenista corrigiendo el nombre de un cliente borraría el costo de esa venta
—y con él la utilidad y la comisión— sin haber visto jamás el campo que
destruyó, y el guardado respondería éxito. Por eso `applyCost` conserva el
costo **almacenado** salvo que quien llama tenga `financials`, y
`base44/tests/machinery_sales_fields_test.ts` fija esa dirección en las dos
variantes (campo ausente y campo manipulado desde devtools).

Ese test no importa nada externo, a propósito: `deno.land` y `jsr.io` están
bloqueados en el sandbox, y así corre donde se escribe en vez de estrenarse en
CI. **9 pasaron, 0 fallaron**, corrido aquí.

### Verificado

`npm run lint` (con `validate:functions`), `npm run build` (emite el chunk
`MachinerySales-*.js`), `npm run validate:rls` (31 entidades, 23 con
inquilino), `npm run generate:permission-manifests` (190 claves, 56 denegadas)
y `deno lint base44/functions/` (175 archivos). La aritmética se contrastó
contra los renglones del propio Excel: utilidades de $8,658 y $7,777, idénticas
a las suyas; comisión al 5% = $432.90 y $388.85 (su columna al 4% daba $311.08
sobre $7,777, que es el mismo cálculo).

`maxFunctions` subió de 46 a 47 en `base44.app.json`. **El margen contra el
tope de Base44 (50) es ahora de 3.** El siguiente grupo de funciones conviene
que sea una consolidación, no un alta.

### Estado del deploy (2026-09-03, después de mergear el PR #377)

Mergear no deploya (módulo 11), así que esto va por partes y conviene leerlo
antes de dar la pestaña por viva:

- **Esquema de `MachinerySale`: DESPLEGADO.** Enviado con
  `create_entity_schema` (appId `69af971d0fdb362c9ae52ed3`) y releído con
  `list_entity_schemas`: 8 campos, `required: [business_id, machine_type]` y
  la forma `$or` de cuatro operaciones con las dos mitades correctas — coincide
  con el `.jsonc` del repo.
- **Funciones (`npm run deploy`) y sitio (`npm run deploy:site`): PENDIENTES
  en la fecha de esta sección — ya no.** Se corrieron el 2026-09-09; ver
  "Cierre del deploy" al final del archivo. Se quedaron pendientes aquí porque
  la CLI de Base44 no está instalada ni autenticada en el sandbox de una
  sesión de Claude (`npx base44` no resuelve y no hay token en el entorno),
  así que estos dos pasos se corren a mano desde una terminal con sesión.

**Hasta que corran esos dos, la pestaña no funciona**: el grupo
`machinerySales` no existe en el backend, así que el alta responde error de
función desconocida aunque la entidad ya esté ahí. Y comprueba el resultado por
**contenido**, no por hash (módulo 11).

**No verificado:** una sesión de navegador como almacenista restringido
(`ventas.baristop@`) confirmando que ve la pestaña sin costo/utilidad/comisión
y que `applyCost` le conserva el costo al editar — mismo límite que declaran
las secciones anteriores, y la razón por la que ese comportamiento está fijado
en un test que sí corre.

## Auditoría 2026-09-07: RLS de escritura de `MachinerySale` cerrada, workflows de licencia obsoletos borrados, lectura confidencial sistémica documentada (no arreglada)

Una revisión automatizada (Codex, disparada al marcar el PR #380 como listo)
encontró tres hallazgos P1 contra el estado del repo tras el merge de Venta de
Maquinaria. Los tres se verificaron contra el código real antes de actuar —
ninguno se aceptó de oídas.

**1. Cerrado — `MachinerySale.jsonc` permitía escritura directa por
cualquier miembro del inquilino.** `create`/`update`/`delete` tenían la forma
`$or[business_id, role:admin]` en vez de sólo `role:admin` — el mismo defecto
que el módulo 14 (2026-08-23) ya había cerrado para `PermissionProfile`, aquí
sin cerrar desde que la entidad se creó (2026-09-03). Se confirmó por grep que
las tres únicas escrituras del repo son los handlers de `machinerySales/`
(vía `asServiceRole`), así que apretar la regla no rompe ningún flujo real.
Arreglado igual que `PermissionProfile`: `create`/`update`/`delete` → sólo
`role:admin`, `read` sin tocar (un miembro del inquilino sigue leyendo la
lista de su propio negocio). **Sólo en el repo — el esquema desplegado
(`create_entity_schema`, 2026-09-03) sigue con la forma vieja** hasta que se
corra `update_entity_schema`; esta sesión no tiene credenciales de Base44
para hacerlo.

**2. Borrado — tres workflows de licencia retirados habían vuelto al repo.**
El commit `f5a9437` ("Migrated 6 workflow(s)", `base44-builder[bot]`,
2026-09-06) trajo 6 archivos a `base44/workflows/`; 3 de los 6 invocan
`checkAccountLifecycle`, `expireTrials` y `processMonthlyRenewal` — las tres
funciones que la sección "License lifecycle is owned by Mission Control" de
este mismo archivo documenta como **retiradas** el 2026-08-03. Ninguna de las
tres existe en `base44/functions/`. Se borraron los tres `.jsonc` del repo
(los otros 3 migrados — `Send Lifecycle Emails`, `Sync Product Stock on
Movement`, `Trial Reactivation Emails Daily` — sí invocan funciones que
existen y se dejaron). **Esto sólo limpia el repo.** Si esos tres workflows
migrados vinieron de un `pull` contra el backend desplegado (lo más probable,
dado que `base44-builder[bot]` sincroniza desde ahí), significa que la app
desplegada en Base44 **todavía tiene programados** tres crons diarios que
invocan funciones que ya no existen — fallarían cada día, o peor, si el
nombre de función quedó re-registrado por accidente con otra implementación,
podrían reintroducir transiciones de `billing_status` compitiendo con Mission
Control, que es exactamente el escenario que la sección original de este
archivo dice que nunca debe pasar. **Verificar y borrar esos tres workflows
en el dashboard de Base44 (o vía `npx base44` autenticado) es la siguiente
acción, y no se pudo hacer desde esta sesión** (sin CLI ni MCP de Base44
autenticados aquí).

**3. Documentado, NO arreglado — lectura de campos confidenciales sin
redactar, y es sistémico, no de `MachinerySale`.** `useMachinerySales`
(`src/hooks/queries/index.js`) trae la fila completa vía
`base44.entities.MachinerySale.filter(...)` directo desde el cliente;
`MachinerySales.jsx` sólo **oculta** las columnas de costo/utilidad/comisión
cuando falta `Venta de Maquinaria:financials` — el JSON ya llegó al navegador
con `cost` incluido, recuperable desde el panel de red o el caché de React
Query sin ningún esfuerzo técnico especial. Se comprobó que **no es un bug
nuevo de esta pestaña**: `useSupplierPayments` hace exactamente lo mismo con
`SupplierPayment.amount` (el campo que "Pagos a Proveedores" también trata
como sensible y también gatea sólo con un `if` en el JSX) — así que esto es
un límite arquitectónico de cómo este repo implementa "campo sensible" en
todas partes, no un defecto aislado.

Base44 **sí** soporta RLS de lectura a nivel de campo
(`properties.<campo>.rls.read`, ver el skill `base44-cli`'s
`references/rls-examples.md`), pero sólo contra el `role` **incorporado**
(admin/almacenista) — no contra el `PermissionProfile` por-negocio que
decide la clave granular `financials`. Bloquear el campo a `role:admin` sería
**más estricto** de lo que la app pretende: un almacenista al que su admin le
concedió explícitamente `financials` (el caso `ventas.baristop@`, ver
"Venta de Maquinaria" arriba) dejaría de poder verlo, aunque su perfil diga
que sí puede. El arreglo correcto es el mismo patrón que el resto de este
archivo ya usa para escritura pero que nunca se construyó para lectura: un
endpoint tipo Safe function que llame `hasPermission()` y devuelva la fila
redactada cuando falte, sustituyendo la llamada directa del cliente — un
patrón que no existe todavía en ningún lugar de este repo para lecturas.

**Por qué no se arregló esta noche:** es sistémico (afecta como mínimo
`MachinerySale` y `SupplierPayment`, probablemente más — no se hizo el barrido
completo de qué otros campos "sensibles" tienen el mismo patrón), requiere
inventar una arquitectura nueva (lectura redactada server-side) que nadie ha
probado en este repo, y esta sesión no puede desplegar ni probar contra
Base44 en vivo. Construir eso sin poder probarlo, de madrugada, en una app
financiera en producción, es exactamente el riesgo que este archivo repite
que hay que evitar cuando no hace falta correrlo. Queda como hallazgo
prioritario para una sesión con acceso a Base44, con alcance real (no sólo
`MachinerySale`) por determinar primero con un barrido dedicado.

**Verificado:** `npm run validate:rls` (31 entidades, 23 con inquilino),
`npm run lint`, `npm run build` — los tres en verde tras los cambios de #1 y
#2. `grep` confirmando los únicos escritores de `MachinerySale` y el mismo
patrón de lectura en `SupplierPayment`.

## Cierre del deploy de Venta de Maquinaria, y la deriva de RLS que duró dos días (2026-09-09)

Venta de Maquinaria quedó servida y con su esquema al día. Lo que vale la pena
guardar no es el «listo», sino la forma del hueco que hubo entre el 7 y el 9 de
septiembre, porque es una que este repo puede repetir.

### La deriva: un arreglo de seguridad mergeado y no desplegado

El 2026-09-07 la auditoría de arriba apretó `MachinerySale.create/update/delete`
de `$or[business_id, role:admin]` a sólo `role:admin`, y lo dejó dicho: «sólo en
el repo». Durante dos días el `main` afirmaba una regla que el backend no tenía,
y en Baristop eso **no era latente** — `ventas.baristop@gmail.com` existe, es
`almacenista`, y la regla desplegada le permitía escribir la entidad por API
cruda saltándose `hasPermission()`, `write_blocked` y el guardián `applyCost`.

**Lo que hace que este hueco sea fácil de crear: `npm run deploy` y
`npm run deploy:site` NO tocan el esquema.** El primero sube funciones, el
segundo el frontend. El único que empuja entidades es `npm run deploy:entities`.
Un cambio que vive sólo en un `.jsonc` puede pasar CI, mergearse, y sobrevivir a
dos deploys sin llegar nunca al backend — sin un solo error en ninguna parte.
`validate:rls` tampoco lo caza: valida el archivo, que está bien; lo que está
mal es que el backend no lo tenga.

**Cerrado el 2026-09-09** con `npm run deploy:entities` (31 entidades, `MachinerySale`
entre las actualizadas), seguido de `npm run deploy` (47 funciones, todas
`unchanged` — `machinerySales` ya estaba desde el deploy anterior) y
`npm run deploy:site`.

### La evidencia, y de qué tipo es

Conviene ser preciso, porque este archivo distingue en otras secciones entre
«escribí el esquema» y «lo releí del backend»:

- **Lo desplegado se sabe por la salida de la CLI** (`Entities pushed
  successfully` → `Updated: … MachinerySale …`), pegada desde la terminal del
  operador. **No se releyó con `list_entity_schemas`**: el MCP de Base44 estaba
  desconectado y pidiendo autorización en la sesión que documenta esto. Es una
  evidencia más débil que la del cierre del módulo 14 (2026-08-24), que sí
  releyó. Si alguien pasa por aquí con el MCP conectado, releer
  `MachinerySale.rls` y confirmar `role:admin` en las tres operaciones de
  escritura cuesta una llamada y cierra el punto del todo.
- **Lo servido se sabe por `smoke.yml` en GitHub Actions**, disparado a mano
  contra `https://stockflow.acaciaco.com.mx`: run 22, 20:16 UTC, **6 pasaron,
  1 saltada** (18.4s). Se corrió dos veces a propósito: la primera (run 21,
  20:03 UTC) cayó **entre** los dos `deploy:site` de esa tanda, así que no
  cubría el estado final; la 22 sí. Un verde contra el árbol equivocado no es
  un verde. Desde un
  sandbox de Claude el dominio **no** se alcanza —el proxy responde 403 al
  CONNECT, con `curl` y con WebFetch por igual—, así que Actions es la vía, no
  un lujo. Y ojo con lo que esa suite prueba: responde 200, es esta app, pinta
  sin excepciones y el selector de tema funciona. **Ninguna de sus
  afirmaciones toca Venta de Maquinaria** — habría pasado idéntica antes del
  deploy. Para comprobar por contenido que la página viajó:

      MAIN=$(curl -s https://stockflow.acaciaco.com.mx | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
      curl -s "https://stockflow.acaciaco.com.mx$MAIN" | grep -c MachinerySales

### `entities push` rechaza borrar una entidad con registros

En la misma tanda, el `entities push` de **rumbo** falló entero con
`Cannot delete entity schema for 'DebugProbe': it has existing records` — el
repo había borrado ese `.jsonc` y el push intentó borrarlo del remoto. Es
información nueva sobre el comando que el módulo 11 llama «DESTRUCTIVO»: existe
un freno del lado del servidor para entidades **con filas**.

**No lo leas como una red de seguridad.** Primero, el fallo es
**todo-o-nada**: rumbo no desplegó *ninguna* de sus 27 entidades por culpa de
una, y el script reporta el código 1 pero el operador venía encadenando
comandos y siguió. Segundo, no explica el borrado del modelo de datos de radar
del 2026-08-21, así que o esas entidades estaban vacías o el freno es posterior
— **queda como pregunta abierta, no como conclusión**. La disciplina del módulo
11 (leer la lista de entidades y el nombre de la app antes de confirmar) sigue
siendo la única puerta en la que confiar.

### Lo que este deploy NO cerró

- **Los tres workflows de licencia obsoletos seguían en el backend — cerrado
  el 2026-09-11**, ver la sección siguiente. Ni `entities push` ni
  `functions deploy` tocan workflows, así que borrarlos del repo (auditoría
  2026-09-07, punto 2) no los quitó de Base44.
- **La lectura sin redactar de campos confidenciales** (punto 3 de la misma
  auditoría) sigue abierta y sigue siendo sistémica — `MachinerySale.cost` y
  `SupplierPayment.amount` como mínimo. Ningún deploy la cierra; hace falta el
  patrón de lectura redactada que este repo todavía no tiene.
- **Una sesión de navegador como `almacenista` restringido**, que es la única
  comprobación que de verdad cierra el comportamiento de `applyCost` y de la
  columna de costo oculta. Mismo límite que declara el resto del archivo.

## Retirado: el selector de negocio (módulo 18) — 2026-09-10

**Un usuario pertenece a un solo negocio.** `User.business_id` es la
pertenencia y toda la RLS de las 22 entidades con inquilino compara contra
`{{user.data.business_id}}`. La entidad `Membership`, el handler
`switchBusinessSafe` y `src/components/BusinessSwitcher.jsx` se borraron — el
feature nunca llegó a producción en el portafolio.

**Dos puertas que hubo que volver a poner**, y no son orden: sin selector,
mover el `business_id` activo deja el negocio anterior inalcanzable.

- `createBusinessSafe` responde **409 `already_in_a_business`** a quien ya
  pertenece a uno. La comprobación va **antes** del `Business.create`, para no
  dejar un negocio huérfano con su código de invitación vivo y nadie dentro —
  ctrlhq acumuló cinco de esos por hacerlo al revés.
- `joinBusinessSafe` responde lo mismo. Redimir el código del negocio en el que
  **ya** estás sigue siendo idempotente, no un error.

Los backfills perezosos de las dos (que creaban una `Membership` para el
negocio anterior antes de moverlo) se van con ellas: sólo existían para no
perder acceso al cambiar.

`scripts/lib/entity-rls-rules.mjs`: `USER_SCOPED_READ_ALLOWLIST` queda
**vacía** — `Membership` era su única entrada. La comprobación que exige
`{{user.id}}` a lo que se meta ahí se queda tal cual: es lo que impide que esa
lista sirva de puerta trasera al check de aislamiento por `business_id`.

`validate:rls` pasa de 31 a **30 entidades, 22 con inquilino**. El conteo de
`validate:functions` **no baja**: `switchBusinessSafe` era un handler dentro
del grupo `business`, no un endpoint propio. **Seguimos en 47/47, margen 0** —
el siguiente cambio que quiera un endpoint nuevo sigue necesitando una
consolidación primero.

### Pendiente a mano: borrar `Membership` del esquema desplegado

`Membership` tiene **0 filas en producción** (consultado el 2026-09-10), así
que aquí `npm run deploy:entities` sí puede borrarla sin tropezar con el freno
que Base44 pone a una entidad con registros — el mismo freno que en esta misma
tanda tumbó el push entero de rumbo. Sigue siendo el comando destructivo: lee
la lista de entidades y el nombre de la app antes de confirmar.

**Verificado:** `npm run lint` (eslint + `validate:functions` 47/47),
`npm run validate:rls` (30 entidades, 22 con inquilino), `npm run build` y
`deno lint base44/functions/` (177 archivos) — todos limpios. `deno check`
sobre `createBusinessSafe`, `joinBusinessSafe` e `index.ts`: 5 errores
preexistentes, **igual antes y después**.

**No verificado:** `deno test base44/tests/` — `integration_test.ts` importa de
`deno.land/std`, bloqueado en este sandbox (la nota del módulo 15 sobre bajar
el binario de GitHub sigue siendo cierta; lo que no se puede es resolver
imports de `deno.land`). Corre en CI. Tampoco el deploy ni una sesión de
navegador.

## Los tres workflows de licencia retirados, borrados del backend (2026-09-11)

Base44 mandó un correo: «Expire Trials Daily failed 5 consecutive times, so we
automatically paused it». Era la confirmación en vivo de lo que la auditoría
del 2026-09-07 (punto 2) había supuesto y no había podido comprobar: los tres
workflows que invocan funciones retiradas el 2026-08-03 **sí** seguían
programados en el backend desplegado, aunque sus `.jsonc` ya no estén en el
repo.

Estado leído del backend antes de tocar nada (`GET /api/apps/{app_id}/workflows`,
appId `69af971d0fdb362c9ae52ed3`):

| workflow | cron | estado | corridas | fallos seguidos |
|---|---|---|---|---|
| Check Account Lifecycle Daily | `0 14 * * *` | inactive (`consecutive_failures`) | 101 | 5 |
| Expire Trials Daily | `0 7 * * *` | inactive (`consecutive_failures`) | 124 | 5 |
| Process Monthly Renewal Daily | `0 15 * * *` | inactive (`consecutive_failures`) | 102 | 5 |

**Base44 los había pausado solo, y eso es lo que hay que leer bien.** La pausa
automática no es el arreglo: es un contador. Cualquiera que abriera el panel,
viera un workflow «pausado por fallos» y pulsara reactivar habría vuelto a
poner tres crons diarios escribiendo `billing_status` en competencia con
Mission Control — exactamente lo que la sección «License lifecycle is owned by
Mission Control» existe para impedir. Un guardia que sólo cuenta hasta cinco no
es un guardia.

Los tres se archivaron con `DELETE /api/apps/{app_id}/workflows/{workflow_id}`,
que cancela el schedule y quita el archivo del código de la app conservando el
historial. Releído después con `include_archived=true`: los tres en
`status: archived`, `status_reason: null`.

Los otros tres workflows del backend se dejaron intactos a propósito, porque
invocan funciones que sí existen y que este archivo documenta como vivas:
`Send Lifecycle Emails` (`sendLifecycleEmails`, dependencia real de
`LicenseAdmin.jsx`), `Trial Reactivation Emails Daily` (la excepción
documentada del 2026-08-18, que lee `billing_status` y nunca lo escribe) y
`Sync Product Stock on Movement`. Los tres con `last_run_status: success`.

**La lección, porque el repo no la tenía escrita:** los workflows son una
cuarta superficie de despliegue, aparte de funciones, entidades y sitio.
`npm run deploy`, `deploy:entities` y `deploy:site` no tocan ninguno, y
`base44-builder[bot]` los sincroniza de vuelta al repo desde el backend — que
es como los tres reaparecieron en `f5a9437` después de haberse retirado. Borrar
un `.jsonc` de `base44/workflows/` no apaga nada: se apagan por el panel o por
la API de la plataforma, y hay que ir a mirarlos cuando se retira la función
que invocan.

## Auditoría 2026-09-14: `Movement` era el único núcleo del módulo 3 sin `hasPermission()` — cerrado

Sweep rutinario (branch/PR inventory, `npm ci`/lint/build/`validate:rls`,
`npm audit`, secrets, deno lint + intento de `deno test`, regresión dirigida
sobre las formas de bug que este archivo documenta). Todas las partes 1-3 de
"granular permission-key enforcement" de arriba (`PettyCashMovement`,
`Utility`, `SupplierPayment`, `Rubro`/`PaymentMethod`/`FundAccount`,
`AppSettings`, on-demand arrivals, `Category`, `Product.barcode`,
`Quotation.share`) cerraron el mismo defecto uno por uno — pero
`base44/functions/movements/handlers/` nunca tuvo una `_permissions.ts`, ni
una sola llamada a `hasPermission()` en `createMovementSafe.ts`,
`deleteMovementSafe.ts`, `confirmMovementPaymentSafe.ts` ni
`updateMovementPaymentDetailsSafe.ts`. Es la entidad con más claves
granulares del registro (`Movimientos:create/entry/exit/return/adjustment/
edit_quantity/edit_reason/edit_payment/confirm_payment/edit_status/delete`)
y era, de las cinco entidades con Safe function, la única sin el
re-chequeo — no una omisión menor, el hueco más grande que quedaba de esta
clase.

**Hallazgo P1, real y explotable hoy, no latente:** `Movimientos:adjustment`
es el único de esos doce que viene **denegado por defecto** al rol
`almacenista` (`ALMACENISTA_DENIED` en `permissionRegistry.js` —
`MovementFormDialog.jsx` oculta la opción "Ajuste (solo admin)" del selector
de tipo con `can('Movimientos','adjustment')`, sin pedirle nada a un admin
que lo revoque explícitamente). Pero `createMovementSafe.ts` aceptaba
`type:'adjustment'` en el cuerpo sin volver a comprobar nada más allá de
`business_id` y `write_blocked` — cualquier `almacenista`, con los permisos
de fábrica sin tocar, podía invocar
`base44.functions.invoke('movements', {action:'createMovementSafe',
type:'adjustment', ...})` desde devtools y crear un ajuste de inventario
"solo admin" directamente, saltándose por completo el control de stock que
esa restricción existe para proteger. Con `ventas.baristop@gmail.com` como
`almacenista` real de un inquilino real (módulo 14), esto no era un riesgo
teórico.

**Arreglo**, mismo orden que las partes 1-3: se creó
`base44/functions/movements/handlers/_permissions.ts` (copia AUTOGEN, igual
que las otras nueve — registrada en `AUTOGEN_TARGETS` de
`scripts/generatePermissionManifests.mjs`) y:

- `createMovementSafe.ts` ahora exige `Movimientos:create` siempre, más
  `Movimientos:<type>` (`entry`/`exit`/`return`/`adjustment`) según el
  `type` recibido — after el chequeo de `business_id`, antes de tocar el
  producto o crear el movimiento.
- `confirmMovementPaymentSafe.ts` exige `Movimientos:confirm_payment`,
  igual que el botón que `Movements.jsx` ya gatea con esa misma clave.
- `updateMovementPaymentDetailsSafe.ts` exige `Movimientos:edit_reason`
  (la única clave que `Movements.jsx` usa para mostrar el botón de editar,
  aunque el handler también toca `reference`/forma de pago — un solo botón
  de cliente, una sola clave de servidor, igual que la nota ya escrita para
  `PaymentMethod` sobre no fusionar acciones separadas del cliente en una).

`deleteMovementSafe.ts` **no se tocó**: ya exige `user.role === 'admin'` a
secas, más estricto que el default del registro (`Movimientos:delete: true`
para almacenista) — un almacenista con ese permiso de fábrica ve el botón de
eliminar en `Movements.jsx` pero el borrado siempre le devuelve 403. Es un
botón muerto, no un agujero (falla cerrado, no abierto), y decidir si el
registro debería relajarse a `hasPermission()` o si el handler es la fuente
de verdad y el registro debería marcar `delete` denegado por defecto es una
decisión de producto, no algo para resolver a la carrera en un audit
automatizado. Anotado como seguimiento.

**Hallazgo relacionado, documentado y NO arreglado a propósito —
`ProductFormDialog.jsx:161`:** al crear un producto con stock inicial, el
cliente escribe el `Movement` de tipo `entry` **directo** contra la entidad
(`base44.entities.Movement.create(...)`), no vía `createMovementSafe` — el
mismo tipo de bypass que esta sección cierra arriba, aquí sin cerrar. No es
explotable hoy: tanto `Productos:create` como `Movimientos:entry` vienen
concedidos a `almacenista` por defecto, así que un almacenista con permisos
de fábrica no gana nada saltándose el chequeo (mismo estado que
`Cotizaciones:return`/`createQuotationSafe` llevan documentado desde la
parte 1). Lo que sí lo bloqueó de un arreglo esta noche es más importante
que la ausencia de urgencia: **enrutar esta llamada por `createMovementSafe`
tal cual introduciría el bug de doble conteo que este archivo dedica más
espacio a advertir que cualquier otro** — `createMovementSafe` siempre
invoca `applyMovementStock` después de crear el movimiento (línea
107-114), mientras que el comentario junto al `Movement.create` actual dice
explícitamente que se marca `stock_applied:true` **para que la
automatización no vuelva a sumar** un stock que `createProductSafe` ya fijó.
`createMovementSafe` ni siquiera acepta `stock_applied` en su cuerpo. Un
arreglo correcto necesita o bien un parámetro nuevo en `createMovementSafe`
que respete `stock_applied` (cambia el contrato de una función que otros
llamadores ya usan sin ese campo) o un endpoint más angosto — ninguno de los
dos es del tamaño de "hallazgo latente, cerrar de paso" que sí fueron
`Categories.jsx`/`BarcodeGenerator.jsx`/`QuotationPreviewDialog.jsx` en la
parte 3. Construirlo sin poder correr `deno test` ni una sesión de navegador
esta noche, contra el flujo de stock de una app financiera en producción, es
exactamente el riesgo que este archivo repite que hay que evitar cuando no
hace falta correrlo. Queda como seguimiento, con la trampa ya escrita para
quien lo tome.

**Hallazgo separado, mismo barrido — `npm audit`:** `js-yaml` tenía una
segunda advisory (`GHSA-2883-xcg3-v3hh`, distinta de la que el cierre del
módulo 14 ya había parchado el 2026-08-24) con fix disponible en 4.3.2.
Aplicado vía `npm audit fix` (sólo `package-lock.json`, diff de 3 líneas —
se comprobó primero con `--dry-run`, que traía de más ~40 paquetes binarios
de plataformas de Tailwind/Rolldown sin relación, así que se aplicó el fix
real en vez del dry-run y se verificó que el diff resultante fuera mínimo).
Sigue siendo devDependency-only (herramienta de lint, nunca se empaqueta).
`xlsx` sigue sin fix upstream — mismo razonamiento aceptado desde
2026-08-10 (sólo escribe XLSX, nunca parsea uno subido por el usuario).

**Resto del barrido de 17 secciones solicitado:** RLS (módulo 4/14),
permisos granulares (módulo 3), deploy (módulo 11) y aislamiento
multi-tenant (módulo 14) ya tienen su propio ciclo de auditoría dedicado
documentado extensamente arriba, con fecha, y sin regresiones detectadas
en esta pasada (`validate:rls`: 30 entidades, 22 con inquilino, sin
cambios). UI/UX visual, cross-device y Core Web Vitals **no se
re-verificaron esta noche** — hacerlo de verdad requiere una sesión de
navegador contra la app desplegada o corrida localmente con
`VITE_BASE44_APP_ID`, ninguna de las dos disponibles en este sandbox (mismo
límite que todas las secciones anteriores declaran); `npm run test:smoke`
tampoco corre aquí (el proxy no alcanza el dominio — módulo 12). No hay
plantillas de correo nuevas ni cambios a `sendCampaignEmails`/
`sendLifecycleEmails` en esta pasada. El manual de usuario y el changelog no
se tocaron a propósito: `APP_VERSION`/`CHANGELOG`/manifiestos de permisos ya
están automatizados por `auto-release-pr.yml` en cada push a `main`
(sección "2026-08-10 automated security/quality/release audit" de arriba)
— bumpearlos a mano aquí competiría con esa corrida.

**Verificado:** `npm ci`, `npm run lint` (eslint + `validate:functions`,
47/47 — sin margen, sin regresión), `npm run build`, `npm run validate:rls`
(30 entidades, 22 con inquilino), `npm run generate:permission-manifests`
(190 claves, 56 denegadas — sólo el `_permissions.ts` nuevo de `movements/`
y el timestamp cambiaron de contenido), `deno lint base44/functions/` (179
archivos, limpio), `deno test --allow-env
base44/tests/machinery_sales_fields_test.ts` (9 pasaron, 0 fallaron — el
único archivo de test sin imports externos, así que el único que corre
aquí). Secrets: limpio (`.gitignore` cubre `.env*`, nada trackeado).
**No verificado:** `deno test` sobre `integration_test.ts`/
`permissions_safe_functions_test.ts` (bloqueados por `deno.land`, no por el
binario — mismo límite documentado repetidamente arriba; corren en CI), una
sesión de navegador como `almacenista` real confirmando que
`Movimientos:adjustment` ahora responde 403, y el esquema desplegado de
`MachinerySale` (pendiente desde el 2026-09-07, sin relación con este
hallazgo — el MCP de Base44 no estaba conectado en esta sesión tampoco).

## Reclamo de Baristop (2026-09-15): columna Factura añadida; lo demás no era un bug de código

Silvita reportó tres cosas sobre Venta de Maquinaria en la misma tanda de
mensajes de WhatsApp. Sólo una era código faltante — las otras dos ya
funcionan como están diseñadas, y quedan documentadas aquí para que la
próxima vez que alguien vea "Karla ve menos que yo" no se vuelva a investigar
desde cero.

**1. Cerrado — faltaba una columna de factura.** `MachinerySale` no tenía
ningún campo de folio de factura. Se agregó `invoice_number` (string,
opcional, texto libre) a `MachinerySale.jsonc`, `_fields.ts`
(`normalizeFields`, sin permiso especial — no es `financials`, un folio de
factura no revela costo/utilidad/comisión) y a `MachinerySales.jsx` (columna
de tabla, campo del formulario junto a "Tipo", y al texto que ya busca
`search`). Los dos handlers (`create`/`updateMachinerySaleSafe`) lo reciben
gratis vía el spread de `normalizeFields` — no necesitaron tocarse.

**2. NO era un bug — "a Karla que le aparezca la pantalla igual que a mi, le
aparece diferente, con menos información".** `Venta de Maquinaria:financials`
es `sensitive` y se deniega a `almacenista` por defecto
(`permissionRegistry.js`, confirmado leyendo `getDefaultsForRole` línea por
línea: el chequeo `if (action.sensitive)` va ANTES del chequeo por
categoría, así que aunque la acción también sea `category: "report"`, no
cae en la lista `deniedReports` — se resuelve por la rama `sensitive`, que
sí la deniega). Es exactamente el diseño que la sección "Venta de
Maquinaria" de arriba (2026-09-03) documenta: Karla (almacenista) ve y edita
sin costo/utilidad/comisión, a propósito. La pantalla "con menos
información" que describe Silvita es la vista de Karla funcionando como se
diseñó, no un defecto.

**Lo que sí puede hacer Silvita, sin necesitar código:** el admin de un
negocio ya tiene una UI para esto — Configuración → Permisos → pestaña
"Almacenista" → módulo "Venta de Maquinaria" → activar "Ver costo, utilidad
y comisión" (`UnifiedPermissionMatrix.jsx`, confirmado que expone todas las
claves del registro sin excluir ninguna) → Guardar. Eso escribe un override
en el `PermissionProfile` de Baristop que `hasPermission()` ya respeta en
los tres puntos donde importa: la tabla, el diálogo de alta/edición, y el
re-chequeo server-side de `createMachinerySaleSafe`/`updateMachinerySaleSafe`.
Es reversible desde la misma pantalla.

**3. Observación, no bug — las 4 ventas visibles en su captura muestran
Costo $0.00 y por lo tanto Utilidad = Venta exacta.** La aritmética
(`profit = salePrice - cost`, `commission = profit * 0.05`,
`src/lib/machinerySales.js`) es correcta; lo que pasa es que el costo real
nunca se capturó en esas 4 filas — consistente con que fueron creadas por
Karla, quien (antes del punto 2 de arriba) no puede ver ni escribir ese
campo, y nadie con `financials` ha vuelto a editarlas para completarlo.
`applyCost` conserva el costo almacenado (0, el valor por defecto al crear)
en vez de rechazar la venta — ninguna venta con importe queda bloqueada por
falta de costo, a propósito (una venta en trámite se documenta como tal;
una venta cerrada sin costo capturado no se distingue visualmente de una
venta cerrada con costo real cero, y **eso no se tocó en este cambio** —
no se pidió, y agregar un indicador nuevo sin que lo pidieran sería
construir algo no solicitado sobre una lectura de las capturas, no un
hecho confirmado). Una vez que alguien con `financials` (Silvita, o Karla
tras el punto 2) edite esas 4 filas y capture el costo real, la utilidad y
comisión se recalculan solas — no hay nada que migrar ni reconciliar.

**Verificado:** `npm ci`, `npm run lint` (eslint + `validate:functions`,
47/47 — sin margen, sin regresión), `npm run build` (emite
`MachinerySales-*.js`), `npm run validate:rls` (30 entidades, 22 con
inquilino — sin cambio, `invoice_number` no es sensible así que no lleva
`rls.write`), `npm run generate:permission-manifests` (190 claves, 56
denegadas — sin cambio; sólo el timestamp del manifiesto y ninguna clave
nueva, porque este cambio no tocó permisos), `deno lint base44/functions/`
(178 archivos, limpio) y `deno test --allow-env
base44/tests/machinery_sales_fields_test.ts` (10 pasaron, 0 fallaron — 9
existentes + 1 nueva para `invoice_number`).

**Pendiente, y es lo que de verdad importa para que esto no repita el hueco
del 2026-09-07/09:** `invoice_number` es un campo NUEVO — hace falta
`npm run deploy:entities` para que el esquema desplegado lo tenga (si no,
Base44 lo descarta en silencio al guardar, la sección "Base44" de arriba lo
explica), seguido de `npm run deploy` (los handlers cambiaron) y
`npm run deploy:site`. Esta sesión no tiene credenciales de Base44 — los
tres deploys y la verificación por contenido (no por hash, módulo 11) quedan
para quien tenga la CLI autenticada. **No verificado:** una sesión de
navegador confirmando que el campo se guarda y se lee correctamente, y que
Silvita puede efectivamente activar `financials` para almacenista desde la
UI descrita en el punto 2 — no hay forma de correr esa UI contra datos
reales desde este entorno.

> **Cerrado, 2026-09-21:** el `deploy:entities` pendiente arriba ya corrió —
> confirmado con el MCP de Base44 conectado y releído en vivo
> (`list_entity_schemas`, appId `69af971d0fdb362c9ae52ed3`): `MachinerySale`
> tiene los 8 campos incluido `invoice_number`, y `create`/`update`/`delete`
> siguen en `role:admin` (el cierre del 2026-09-07/09). Coincide byte a byte
> con el `.jsonc` del repo. `Membership` (retirada 2026-09-10) también se
> confirmó ausente del esquema desplegado — ese pendiente también está
> cerrado. Ver la auditoría de esa misma fecha, más abajo, para el resto de
> lo que esta sesión encontró con acceso real a Base44.

## Auditoría 2026-09-21: primera vez con el MCP de Base44 conectado en un audit rutinario — lectura confidencial de `MachinerySale.cost` cerrada, un gap nuevo cerrado, un hallazgo previo corregido

Todas las pasadas anteriores de este archivo que tocaron seguridad declararon,
en algún punto, "esta sesión no tiene credenciales de Base44" como la razón
para diferir una verificación o un deploy. Esta vez el MCP de Base44 sí estaba
conectado (`list_user_apps` confirmó el mismo `appId` que el resto del archivo
cita, `69af971d0fdb362c9ae52ed3`), así que el barrido de esta noche pudo
comprobar contra el **esquema y los workflows desplegados de verdad**, no sólo
contra el repo — y cerrar el hallazgo P3 que la auditoría del 2026-09-07 dejó
abierto por no poder hacer exactamente eso.

**0. Inventario.** La rama `audit/stockflow-full-review` ya tenía su PR
(#388) mergeado el 2026-09-14 — no había nada pendiente que retomar, así que
esta sesión reinició la rama desde `main` en vez de apilar sobre historia ya
mergeada (regla del propio runner de la tarea). `main` ya traía todo lo que
este archivo documenta hasta el 2026-09-15 (columna Factura incluida) más un
`Update base44 packages` sin relación.

**1. Ya cerrado, sólo pendiente de confirmar con el MCP conectado:**
releído `list_entity_schemas` para `MachinerySale` — 8 campos incluido
`invoice_number`, `create`/`update`/`delete` en `role:admin` — y para
`Membership` — ausente. Los dos "pendiente, sin credenciales" que las
secciones de arriba dejaron abiertos (2026-09-07/09 y 2026-09-10) están
confirmados cerrados; ver las notas insertadas en esas secciones.

**2. Workflows: sin deriva.** `GET /api/apps/{app_id}/workflows?include_archived=true`
confirma que los tres crons de licencia retirados (`Check Account Lifecycle
Daily`, `Expire Trials Daily`, `Process Monthly Renewal Daily`) siguen
`archived` desde el 2026-09-11 — no volvieron a aparecer activos pese a que
`base44-builder[bot]` ya los había reintroducido una vez en el repo (commit
`f5a9437`, 2026-09-06). Los otros tres workflows (`Send Lifecycle Emails`,
`Trial Reactivation Emails Daily`, `Sync Product Stock on Movement`) siguen
`active` con `last_run_status: success`.

**3. Corrección sobre el hallazgo #3 de la auditoría 2026-09-07 — el
`SupplierPayment.amount` NO estaba comprometido.** Esa auditoría escribió
que "`useSupplierPayments` hace exactamente lo mismo [que `MachinerySale`]
con `SupplierPayment.amount` — el campo que 'Pagos a Proveedores' también
trata como sensible". Releído `permissionRegistry.js` línea por línea para
este módulo: **ninguna** de las trece acciones de `Pagos a Proveedores`
lleva `sensitive: true`, y `edit_amount` (la única acción relacionada con
`amount` en el `deniedActionable` de almacenista) gatea sólo la **edición**,
no la **lectura** — `SupplierPayments.jsx:496` muestra `p.amount` sin
ningún `can()` alrededor, para cualquier usuario con `Pagos a
Proveedores:view` (que almacenista tiene por defecto: no está en la lista
de denegados). Es decir: `amount` nunca estuvo diseñado como campo oculto
para almacenista en este módulo — a diferencia de `Utilidad` (`view`/
`view_withdrawals` sí llevan `sensitive: true`) o de `Venta de Maquinaria`
(`financials` sí lo lleva). El hallazgo de 2026-09-07 confundió "el módulo
maneja dinero" con "el campo está gateado" sin releer el registro. **No hay
nada que arreglar aquí** — se deja escrito para que nadie vuelva a
"cerrarlo" sin necesidad.

**4. Cerrado — lectura sin redactar de `MachinerySale.cost`.** Este sí era
real (a diferencia del punto 3): `useMachinerySales`
(`src/hooks/queries/index.js`) llamaba `base44.entities.MachinerySale.filter(...)`
directo desde el cliente, así que `cost` viajaba al navegador para
**cualquier** usuario con acceso a la página, y `MachinerySales.jsx` sólo
ocultaba la columna con `{canSeeFinancials && ...}` — el JSON ya había
llegado, recuperable desde el panel de red o el caché de React Query. Con
el MCP de Base44 conectado ya no aplicaba la razón por la que esto se dejó
sin arreglar el 2026-09-07 ("requiere inventar una arquitectura de lectura
redactada que nadie ha probado en este repo, y esta sesión no puede
desplegar ni probar contra Base44 en vivo").

Arreglo, mismo patrón de siempre pero para lectura en vez de escritura:
nuevo handler `listMachinerySalesSafe` en el grupo **ya existente**
`base44/functions/machinerySales/` (no suma al tope de 47/47 del módulo
11 — es una acción nueva dentro de un grupo, no un endpoint nuevo, igual
que `switchBusinessSafe` no lo sumó dentro de `business/`). Resuelve
`business_id` de `auth.me()`, nunca del cuerpo; comprueba `hasPermission(...,
'Venta de Maquinaria', 'financials')`; si falta, quita `cost` de cada fila
antes de responder (no lo pone en `0` — lo quita, para que ni siquiera un
`0` sugiera "sin costo capturado" cuando en realidad es "no autorizado a
verlo"). `sale_price` **no** se redacta: no es `financials` (el vendedor
necesita saber en cuánto vendió). Quitar `cost` también corta la
posibilidad de que el cliente derive `profit`/`commission` con la
aritmética de `machinerySales.js` — sin costo no hay utilidad que calcular,
que es justo el efecto que se quería.

`useMachinerySales` ahora llama `base44.functions.invoke('machinerySales',
{action: 'listMachinerySalesSafe'})` en vez de `.filter()` directo. La UI
no cambió: `MachinerySales.jsx` ya gateaba el renderizado de costo/utilidad/
comisión con `canSeeFinancials`, así que un `s.cost` ausente en la fila no
rompe nada — simplemente nunca se lee para esos usuarios, igual que antes,
sólo que ahora tampoco llega.

**El mismo patrón NO se replicó para `SupplierPayment`** — no hace falta,
por el punto 3: no hay ningún campo ahí que el diseño quiera oculto a
lectura. Sistémico ya no es la palabra correcta para este hallazgo: era
un caso, no una clase.

**5. Cerrado — gap nuevo, encontrado por un sub-agente de este mismo
barrido: `seedAndDedupeCatalog` (`src/lib/seedCatalog.js`) escribía
`Rubro`/`FundAccount` directo, sin pasar por `catalogSettings`.** Este
helper corre en `Rubros.jsx`, `FundAccounts.jsx` y `PettyCash.jsx` al
montar, para sembrar los catálogos por defecto la primera vez que el
negocio los usa (y auto-reparar duplicados de una posible carrera entre
pestañas). Aunque la migración del 2026-08-18 ("parte 2") documentó
`Rubro`/`FundAccount` como ya cubiertos por `createCatalogItemSafe` /
`deleteCatalogItemSafe`, se refería a las acciones que dispara el propio
usuario (guardar, editar, borrar) — este helper de arranque automático se
quedó fuera y siguió llamando `base44.entities[entity].create/delete(...)`
directo, sin `hasPermission()` ni `write_blocked`.

Severidad baja y acotada, no un hallazgo del tamaño del punto 4: el payload
es enteramente fijo (`DEFAULT_RUBROS`/`DEFAULT_ACCOUNTS`, constantes del
propio código, nunca controlado por quien llama), no hay fuga entre
inquilinos (ya vive dentro del `business_id` propio), y no hay escalación
de privilegio (crea filas `is_system: true` idénticas a las que cualquier
negocio nuevo ya tendría). El gap real es sólo `write_blocked`: un negocio
`suspended`/`view_only` con el catálogo todavía vacío seguía sembrando
filas nuevas en cuanto alguien abría `Rubros.jsx`/`FundAccounts.jsx`/
`PettyCash.jsx`, saltándose la licencia por completo.

Arreglo deliberadamente más angosto que enrutar por `createCatalogItemSafe`:
enrutar por ahí exigiría además `hasPermission(..., 'create')`, y un
almacenista sin ese permiso (denegado explícitamente por su admin) que
abre `PettyCash.jsx` por primera vez necesita que el catálogo exista para
que la página funcione — nadie necesita un permiso granular para que el
catálogo *exista*, sólo para crear/editar/borrar rubros él mismo (mismo
razonamiento que la sección de `AppSession` de arriba: no todo write
directo es el hueco que el patrón Safe-function existe para cerrar). Se
añadió sólo el chequeo que sí falta — lee `Business.billing_status` (ya
legible por el cliente vía RLS normal) antes de sembrar, y si está
`suspended`/`view_only` devuelve la lista vacía sin escribir nada — sin
tocar el chequeo de permiso, que no aplica aquí.

**Verificado:** `npm ci`, `npm run lint` (eslint + `validate:functions`,
47/47 — el nuevo handler es una acción dentro de `machinerySales/`, no un
grupo nuevo, así que el tope no se movió), `npm run build`, `npm run
validate:rls` (30 entidades, 22 con inquilino — sin cambio, ningún archivo
`.jsonc` se tocó esta vez), `npm run generate:permission-manifests` (190
claves, 56 denegadas — sin cambio de contenido más allá del timestamp,
descartado sin commitear), `deno lint base44/functions/` (179 archivos,
limpio — binario bajado de la release de GitHub, misma vía que el módulo
15 documenta), `deno test --allow-env
base44/tests/machinery_sales_fields_test.ts` (10/10, sin cambios — este
hallazgo no tocó `_fields.ts`). `npm audit`: 1 advertencia (`xlsx`, sin fix
— mismo estado aceptado desde 2026-08-10). Secrets: limpio, sin `.env*`
trackeado. Un sub-agente de exploración de sólo lectura repitió el barrido
de "¿algún `base44.entities.X.create/update/delete` directo sin cubrir?"
sobre todo `src/` y confirmó que, fuera de los dos hallazgos de arriba
(#4 y #5) y los ya documentados y deliberadamente diferidos
(`SupportTickets.jsx`, `ProductFormDialog.jsx:161`, `AppSession`,
`Settings.jsx`'s self-delete de `User`), no queda ningún write directo sin
cubrir.

**No verificado, y por qué:** `deno test` sobre `integration_test.ts` /
`permissions_safe_functions_test.ts` — siguen bloqueados por `deno.land`,
no por el binario (módulo 15); corren en CI. Una sesión de navegador como
`ventas.baristop@gmail.com` confirmando en vivo que `listMachinerySalesSafe`
efectivamente le devuelve la fila sin `cost` — no hay forma de autenticar
como ese usuario desde el MCP (que opera como dueño de la cuenta, no como
un usuario final de un negocio), así que "el MCP está conectado" cierra el
gap de esquema/deploy que las pasadas anteriores no podían cerrar, pero no
sustituye una sesión de navegador real; sigue siendo el mismo límite que
declara el resto de este archivo. UI/UX visual, cross-device y Core Web
Vitals tampoco se re-verificaron esta noche — mismo límite de siempre (sin
`VITE_BASE44_APP_ID` ni navegador en este sandbox); `npm run test:smoke`
tampoco corre aquí (módulo 12).

**Pendiente de deploy:** `listMachinerySalesSafe` es código de función
nuevo (`base44/functions/machinerySales/`) — hace falta `npm run deploy`
después de mergear para que exista en el backend (ningún cambio de
entidad, así que `deploy:entities` no aplica esta vez), y `npm run
deploy:site` para que `useMachinerySales` lo use en producción en vez del
código anterior. Esta sesión sí tiene el MCP de Base44 conectado, pero
`run_command` opera dentro del sandbox de la app (útil para inspeccionar,
no documentado aquí como equivalente a la CLI autenticada con la que este
repo normalmente deploya desde una terminal del operador) — el deploy en
sí se deja para el mismo flujo de siempre, y se avisa en el reporte al
dueño.

## Correos del trial: nadie los encolaba, y la cola nunca se vaciaba (2026-09-24)

Lo encontró el alta de **Baristop Durango** (`6ab550de342f0a40f5324ebc`, primer
tenant en trial desde que se retiraron los crons nativos). Dos defectos que
sólo se ven con un trial vivo:

1. **`sendLifecycleEmails` nunca marcaba una fila como enviada.** Mandaba el
   correo y dejaba el `EmailNotification` en `pending`, así que el cron diario
   (15:00 UTC) lo habría reenviado todos los días. No se había notado porque
   todas las filas anteriores las escribían otros caminos ya como `sent`. Ahora
   marca `sent` / `failed` (+`retry_count`) / `skipped` (duplicado).
2. **Nada encolaba los recordatorios del trial.** `trial_day_*`/`trial_expired`
   los encolaban `expireTrials`/`checkAccountLifecycle` (retirados 2026-08-03), y
   Mission Control no los cubre: su ciclo mira `license_expires_at`, que durante
   un trial es `null`. `enqueueTrialReminders()` dentro del mismo cron los
   encola por ventana de días (fecha local de México) con `idempotency_key`
   atado a `trial_end_at`. **Sólo lee `billing_status`**, nunca lo escribe — la
   misma línea que respeta `processTrialReactivationEmails`. No suma endpoint
   (47/47).

Además: las plantillas del trial llevan la fecha de fin y cómo pagar (Mercado
Pago o transferencia vía WhatsApp, activación manual); el nombre del negocio se
resuelve del `Business` (antes salía «tu negocio»); y cada correo al cliente,
aquí y en `acaciaControl` `emails.sendFollowup`, manda una **copia aparte a
`PLATFORM_OWNER_EMAIL`** — `Core.SendEmail` no tiene bcc.

La bienvenida de Baristop Durango se mandó a mano desde Gmail el 2026-09-24 y su
fila se marcó `sent` para que el código viejo desplegado no la repitiera.
**Pendiente: `npm run deploy`** — sin él, nada de esto corre.

## Usuarios por plan: la app decía 4 / 10 / 20 y la web 2 / 5 / ilimitados (2026-09-24)

Había **tres** tablas distintas: la web (Start 2 · Growth 5 · Pro ilimitados),
la app (4 / 10 / 20, en `adminUpdateTenantLicense`, `LicenseAdmin.jsx` y el
`default` de `Business.licensed_user_limit`) y la ayuda (4 / 8 / 20). Manda la
web, que es donde se contrata. Ahora hay una sola fuente por runtime:
`src/lib/planLimits.js` y `base44/functions/licenses/handlers/_planLimits.ts`
(`999` = ilimitado, se muestra «Ilimitados»); `base44/tests/plan_limits_test.ts`
falla si se separan entre sí o de los números publicados.

Los 3 `Business` vivos (todos Start) se pasaron de 4 a 2 en producción el mismo
día. **Y ahora se aplica**: `joinBusinessSafe` responde 403
`user_limit_reached` (con `next_plan`/`next_plan_label`) cuando el negocio ya
usa todos sus asientos; la pantalla de unirse lo explica sin gastar uno de los
5 intentos del código, y Configuración muestra al admin, junto al código de
invitación, que su plan está lleno y a qué plan subir. Nadie existente se
expulsa: un negocio que ya esté por encima de su límite sólo deja de aceptar
altas. Dos altas simultáneas por el último asiento pueden pasar las dos —
aceptado. **Los planes difieren sólo en usuarios**, no en funcionalidades (la
ayuda de la app ya lo decía; la web se corrigió para no prometer SKUs,
multi-almacén ni API que no existen).
Cambiar el `default` del `.jsonc` requiere `npm run deploy:entities` para llegar
al backend; mientras tanto no importa, porque `initTenantTrial` escribe el
límite explícito.

## Dueños de negocio = `owner`, no `admin` (2026-09-24)

**Probado en vivo, no inferido.** Un usuario recién registrado que crea su
negocio por `createBusinessSafe` quedaba con el `role: admin` de Base44 — el
mismo que la plataforma — y la rama `user_condition:{role:"admin"}` de cada RLS
no está acotada al negocio. Con un usuario desechable
(`h.josepablo+sfrlstest0924@`): leyó los 4 negocios, 226 productos, 498
cotizaciones, caja chica y pagos a proveedores de Baristop; se activó su propia
licencia hasta 2030 (los candados de campo del módulo 14 no frenan a un
`admin`); y escribió en ACACIA OWNER SANDBOX (revertido). Lo único que Base44 le
negó fue cambiarse el rol: «Only platform users can update user roles».

El arreglo: el admin de un negocio se guarda como **`owner`**; `admin` queda
para el dueño de la plataforma y el rol de servicio, que es lo que la rama RLS
siempre quiso decir. Las reglas RLS no cambian — pasan a ser correctas tal
como están escritas.

- `createBusinessSafe` asigna `owner`; `changeUserRole` guarda `owner` cuando la
  UI pide «admin». El vocabulario de la app sigue siendo `admin`/`almacenista`
  (perfiles `role_key`, registro de permisos): `appRole()` en `src/lib/roles.js`
  traduce `owner → admin`, `isBusinessAdmin()` acepta los dos.
- Las comprobaciones **de negocio** aceptan `admin || owner` (misma forma en
  línea que ya usaba `applyInventoryAuditCorrection`), igual que
  `hasPermission()` en las 9 copias de `_permissions.ts`.
- Las **de plataforma** siguen en `admin` estricto y quedan, por fin, fuera del
  alcance de un cliente: `cleanupSessions`, `syncAppVersionToDB`,
  `initAppVersion`, `updateAppVersion`, `migrateWholesaleMinQtyToCategory`,
  `courseComms/runReminders`.
- `upsertPermissionProfile` escribía con la identidad del que llama; las
  escrituras de `PermissionProfile` son sólo `admin`, así que ahora escribe como
  servicio **después** de su propia comprobación de rol.
- `npm run validate:roles` (dentro de `lint`) falla si alguna función asigna
  `role: 'admin'` fuera de `upgradeOwnerToAdmin`/`restoreOwnerAdmin`.
- Mission Control ya buscaba destinatarios de StockFlow con `['owner','admin']`.

**Orden de despliegue — importa:**
1. `npm run deploy:entities` (el enum de `User.role` gana `owner`; sin esto
   Base44 rechaza el valor) y `npm run deploy` + `npm run deploy:site`. El
   código acepta `admin` y `owner`, así que nadie pierde acceso en este paso.
2. Como dueño de plataforma, en la consola de la app:
   `base44.functions.invoke('licenses', { action: 'migrateBusinessAdminsToOwner' })`
   (simulacro) y luego con `apply: true`. Pasa a `owner` a todo `admin` que no
   sea `PLATFORM_OWNER_EMAIL` — hoy Roseta, Karime y el usuario de prueba.
3. Repetir la prueba con el usuario de prueba: ya no debe ver nada ajeno.

**Cerrado y verificado en vivo, 2026-09-24 19:1x UTC.** Tras publicar, la
migración pasó a Roseta, Karime y el usuario de prueba a `owner` (releído en
`User`); el mismo usuario de prueba, ahora `owner`, ve **0** filas en
`Business`, `Product`, `Quotation`, `Client`, `PettyCashMovement`,
`SupplierPayment`, `MachinerySale`, `PermissionProfile` y `EmailNotification`
— antes veía los 4 negocios, 226 productos y 498 cotizaciones. **No
verificado:** que Roseta y Karime operen normal en su propio negocio como
`owner` (no hay sesión suya desde aquí); si algo de administración les falla,
es la primera sospecha.

### `npm run deploy` dijo «47 unchanged» y NO desplegó (2026-09-24)

Con el #396 ya en `main` y el pull hecho, `functions deploy --force` (CLI 0.1.15
y otra vez con 0.1.20) reportó `unchanged` para **todas** las funciones
agrupadas cuyo cambio vivía sólo en `handlers/` (`business`, `licenses`,
`permissions`…); sólo subieron las tres de un archivo. En producción la acción
nueva respondía `licenses: unknown action` — idéntico a un nombre inventado.
Lo que la puso viva fue **Publish en el panel de Base44**; la copia de código
que Base44 guarda (sincronizada desde GitHub) ya tenía todo. No se aisló la
causa exacta: una acción de handler del 2026-09-21 sí había llegado antes.

**La regla que queda:** después de desplegar funciones, **publica**, y
comprueba por comportamiento, no por la salida de la CLI. La prueba más barata
es llamar a una acción nueva sin permiso y leer el error: `unknown action` =
código viejo; un 403 propio de la acción = código nuevo.

**No resuelto:** si las funciones `asServiceRole` necesitan de verdad la rama
`admin` (la documentación de Base44 dice que el rol de servicio se salta RLS;
este archivo registra una caída en junio que dice lo contrario). Con este
cambio ya no importa para la seguridad — la rama sólo la satisfacen la
plataforma y el servicio.

## Escáner de seguridad de Base44 (2026-09-24): tres hallazgos cerrados

- **`initTenantTrial` reiniciaba la prueba a voluntad.** Cualquier miembro del
  negocio (almacenista incluido) podía llamarlo otra vez y devolver un negocio
  `view_only`/`suspended`/`active` a `trial` con 30 días nuevos. Ahora es de un
  solo uso: pide rol `owner`/`admin` y responde 409 `trial_already_started` si
  `trial_start_at` ya existe o `billing_status` ya no es el `trial` por defecto.
- **`syncProductStock` escribía `Product.stock` sin autenticar a nadie**, con el
  movimiento tomado del cuerpo de la petición. Ahora es un no-op para todo
  evento. `deleteMovementSafe` escribe él mismo el stock revertido para todos
  los tipos (antes sólo para `adjustment`), y nada en el código cambia
  `Movement.quantity`, así que la rama `update` no tenía llamador. El workflow
  "Sync Product Stock on Movement" sigue en el backend y ahora es inofensivo;
  se puede archivar desde el panel. **Deploya las dos funciones juntas**: con
  `deleteMovementSafe` nuevo y `syncProductStock` viejo, un borrado se revierte
  dos veces.
- **`Core.InvokeLLM` se llamaba desde el navegador** (entrevista de soporte,
  `src/lib/aiIntake.js`), así que cualquier sesión podía correr prompts
  arbitrarios con los créditos de la app. Ahora pasa por `business` →
  `aiIntakeTurn`, con prompt, esquema y tope de preguntas fijos en el servidor
  (acción dentro de un grupo existente: 47/47 sin cambio). **Sigue en el
  cliente:** `Core.UploadFile` (logo en Configuración, adjuntos del chat de
  ayuda) y el agente del chat de ayuda — si se desactivan las integraciones del
  lado del cliente en Base44, esos dos se rompen.

## Centro de Soporte pasa por el servidor (2026-09-25)

Cierra el `SupportTickets.jsx` que la auditoría del 2026-08-31 dejó diferido.
Crear, responder y marcar como leído ya no escriben las entidades desde el
navegador: van a `business` → `createSupportTicketSafe` /
`replySupportTicketSafe` / `markSupportTicketReadSafe` (acciones de un grupo
existente, 47/47 sin cambio). Cada una re-deriva negocio y autor de `auth.me()`
y comprueba `Centro de Soporte:create` / `reply` / `view` con `hasPermission()`.
Responder relee el ticket guardado para el conteo y el estado; uno `closed`
responde 409. **Sin freno de facturación**: un negocio suspendido tiene que
poder pedir ayuda.

La RLS se cerró a juego: `SupportTicket.create/update` y
`SupportTicketMessage.create` pasan a sólo `role:admin` (servicio/plataforma).
La lectura no cambia. Mission Control escribe por `acaciaControl` como servicio,
así que no le afecta, y ningún agente toca estas entidades.

**Orden de deploy**: `npm run deploy` + Publish + `npm run deploy:site`
**antes** de `npm run deploy:entities`. Con la RLS nueva y el frontend viejo, el
navegador no puede crear tickets.

## La sesión de Claude SÍ puede desplegar (2026-09-25)

Varias secciones de arriba dicen «la CLI de Base44 no está instalada ni
autenticada en el sandbox». **Ya no es cierto.** El entorno en la nube tiene
`BASE44_ACCESS_TOKEN` y `BASE44_REFRESH_TOKEN` como variables de entorno (la CLI
las lee en lugar de `~/.base44/auth/auth.json`), y `npx --yes base44@<versión del
lockfile> whoami` responde `Logged in as: h.josepablo@gmail.com`. La CLI no viene
en `node_modules`: se baja con `npx --yes`.

Así que `npm run deploy`, `deploy:site` y `deploy:entities` corren desde la
sesión. Lo que no cambia:

- **`deploy:entities` sigue siendo destructivo**: pide confirmación del dueño
  antes de correrlo, siempre, y lee la lista de entidades y el nombre de la app
  antes de escribir "StockFlow".
- **Comprueba por comportamiento, no por la salida de la CLI** (sección del
  2026-09-24): `unknown action` = código viejo; hace falta **Publish** en el
  panel si la CLI dijo `unchanged`.
- **Si `whoami` falla**, el refresh token rotó o caducó: el dueño corre
  `npx base44 login` en su Mac y vuelve a copiar los dos tokens de
  `~/.base44/auth/auth.json` a las variables del entorno. Nunca se pegan en el
  chat. Una variable nueva sólo la ve una sesión nueva.
- El MCP de Base44 es otra cosa: su token no puede usarse para desplegar ni para
  leer esquemas vía `execute_api` («scoped to MCP»). La CLI sí.

## Borrar movimientos y el «Stock inicial» (2026-09-25)

Cierra los dos seguimientos que la auditoría del 2026-09-14 dejó anotados.

- **Borrar un movimiento es sólo del dueño/admin, y ahora todo lo dice.**
  `deleteMovementSafe` siempre exigió `owner`/`admin` (reescribe el historial de
  stock), pero el registro concedía `Movimientos:delete` al almacenista: veía el
  botón y el servidor le respondía 403. Se eligió que manda el servidor, no el
  permiso. **No** se pasó el servidor a `hasPermission()`: los perfiles guardados
  pueden traer `delete: true` explícito para almacenista, y eso habría dado el
  borrado a todos los almacenistas existentes de golpe. Ahora
  `Movimientos:delete` está en `deniedActionable`, la acción se llama «Eliminar
  (solo admin)», y `Movements.jsx` muestra el botón con `isAdmin && can(...)`.
- **El movimiento de «Stock inicial» lo crea `createProductSafe`.** Antes lo
  escribía `ProductFormDialog.jsx` desde el navegador, y era la última escritura
  directa de `Movement`. Se sigue creando con `stock_applied: true` (el stock ya
  lo fijó el propio `Product.create`, así que `applyMovementStock` no lo vuelve a
  sumar). Es best-effort: si falla, el producto ya está guardado. El asistente
  de bienvenida (`OnboardingWizard.jsx`) también pasa por aquí y ahora deja su
  movimiento, cosa que antes no hacía. `createProductSafe` gana además el
  chequeo `Productos:create` que no tenía.
  El asistente mandaba el precio como `price`, que `createProductSafe` ignora
  (exige `retail_sale_price`), así que **ningún producto creado desde el
  asistente se había guardado nunca** (el servidor responde 400 y el asistente
  sólo mostraba un error genérico). Ahora manda `retail_sale_price`, lee la
  respuesta y muestra el motivo real si el servidor rechaza.
- **`Movement.create/update/delete` pasan a sólo `role:admin`** (servicio). Ya no
  queda ninguna escritura del navegador y los agentes sólo leen `Movement`.

**Orden de deploy**: `npm run deploy` + Publish + `npm run deploy:site` antes de
`npm run deploy:entities` — con la RLS nueva y el `ProductFormDialog` viejo, el
navegador fallaría al escribir el movimiento inicial (el producto sí se guarda).

## Auditoría completa 2026-09-28: `write_blocked` faltaba en 8 handlers de cotizaciones/pagos; `MachinerySale` confirmada sin drift; sin hallazgos nuevos de RLS/permisos/dependencias

Barrido programado sobre `audit/stockflow-full-review` (rama reiniciada desde
`main` porque el PR anterior de esa rama, #388, ya estaba mergeado —
`git merge-base --is-ancestor` lo confirmó antes de tocar nada). Con el MCP de
Base44 conectado, esta pasada pudo comparar programáticamente las 30
`.jsonc` del repo contra `list_entity_schemas` en vivo (appId
`69af971d0fdb362c9ae52ed3`) campo por campo, `rls` de las cuatro operaciones,
`required` y `rls.write` por campo: **cero drift** en las 30 entidades. Cierra
con evidencia dura la pregunta que varias secciones de arriba dejaron con
"pendiente de confirmar" (`MachinerySale.invoice_number`, `create/update/delete`
en `role:admin`, `Membership` ausente) — no hay que volver a preguntarlo hasta
que algo cambie.

**Hallazgo real, corregido — 8 handlers de dinero sin el candado de
licencia `write_blocked`.** Todo el resto del repo sigue el patrón
"auth → `business_id` → `hasPermission()` → `write_blocked` → escritura" en
cada Safe function que toca dinero o stock; estos ocho se quedaron sin la
última pieza (o, en tres casos, sin ninguna):

- **`quotationPayments/handlers/` — sin NINGÚN chequeo server-side**, ni de
  permiso ni de licencia. `registerQuotationPayment.ts`,
  `editQuotationPayment.ts` y `deleteQuotationPayment.ts` sólo validaban
  `business_id`. El cliente (`QuotationPaymentsSection.jsx`) sí gatea los
  tres botones (`can('Cotizaciones','confirm_payment')` para registrar,
  `can('Cotizaciones','edit_payment_record')` para editar/eliminar) pero
  nada lo repetía en el servidor — el mismo bypass-por-devtools que este
  archivo ha cerrado una y otra vez en otras entidades, aquí nunca cerrado
  desde que la función se creó. Un negocio `suspended`/`view_only` podía
  seguir registrando pagos en efectivo (que además crean un
  `PettyCashMovement`), y un almacenista al que su admin le negó
  `edit_payment_record` podía editar/borrar pagos igual. Arreglo: nuevo
  `base44/functions/quotationPayments/handlers/_permissions.ts` (copia
  AUTOGEN estándar, agregada a `AUTOGEN_TARGETS`), más el chequeo de
  `hasPermission()` con la misma clave que ya usa el botón, más
  `write_blocked` en los tres handlers, en ese orden.
- **`quotations/handlers/` — 5 de 9 handlers de escritura sin `write_blocked`,
  mientras sus hermanos en el mismo directorio sí lo tienen.**
  `createQuotationSafe`, `cancelQuotationSafe` y `convertQuotationSafe` ya
  bloqueaban `view_only`/`suspended`; `updateQuotationSafe`,
  `updateQuotationFlagsSafe` (el propio "Confirmar Pago Total" que la
  primera sección de este archivo documenta en detalle),
  `deliverQuotationSafe`, `revertPaymentConfirmationSafe` y
  `regenerateQuotation` no. El más grave de los cinco es
  `deliverQuotationSafe`: crea `Movement` de salida y llama
  `applyMovementStock` — una escritura real de inventario, alcanzable por un
  inquilino suspendido. Se agregó sólo el bloque `// LICENSE CHECK` (idéntico
  al de `cancelQuotationSafe`) a los cinco, sin tocar permisos — mismo criterio
  que el resto del grupo, donde el `write_blocked` es universal pero
  `hasPermission()` sólo se agrega cuando la acción tiene una clave granular
  propia y nueva. **`partialReturnQuotation.ts` se revisó y se dejó
  intacto**: ya trae su propio comentario `// LICENSE CHECK — returns are
  allowed even in view_only (they correct existing data)` — es una exención
  deliberada y documentada, no un descuido, y un subagente que la señaló como
  "hallazgo" se verificó y se descartó antes de tocar el archivo.

**Dos falsos positivos verificados y descartados antes de tocar código**
(ambos de un sub-agente de exploración que se usó para el barrido de
`base44.entities.X.create/update/delete` directo — su reporte se verificó
línea por línea, no se aceptó de oídas): el `dangerouslySetInnerHTML` de
`HelpCenter.jsx` renderiza únicamente `activeArticle.content`, que viene de
`localHelpData` (array estático del repo, nunca de una entidad ni de input de
usuario) — no hay XSS ahí pese a la apariencia. El de
`BarcodeGenerator.jsx` construye el SVG a partir de anchos/altos numéricos
calculados, nunca interpola el texto del código de barras crudo en un
contexto de atributo — tampoco es explotable.

**Limpieza menor:** `src/lib/helpDataWrapper.js` (1 línea, `export default
localHelpData`) no tenía un solo importador en todo el repo — confirmado con
grep antes de borrarlo. `helpDataExtension.js`/`helpDataNew.js`, que parecían
igual de huérfanos a primera vista, en realidad se importan desde dentro de
`helpData.js` — no se tocaron.

**Verificado:** `npm ci`, `npm run lint` (eslint + `validate:functions` 47/47
— la función nueva es un archivo de permisos dentro de un grupo existente, no
un endpoint — + `validate:roles`), `npm run build`, `npm run validate:rls` (30
entidades, 22 con inquilino, sin cambio), `npm run generate:permission-manifests`
(190 claves, 57 denegadas — sólo el nuevo `quotationPayments/_permissions.ts`
y el timestamp del manifiesto cambiaron de contenido), binario de `deno`
descargado fresco de la release de GitHub (`v2.9.5`, misma vía que documenta
el módulo 15) → `deno lint base44/functions/` (188 archivos, limpio) y
`deno test --allow-env` sobre los tres archivos de test sin imports externos
(`machinery_sales_fields_test.ts`, `owner_role_test.ts`, `plan_limits_test.ts`
— 34/34 pasaron). `npm audit`: 1 advertencia (`xlsx`, sin fix — mismo estado
aceptado desde 2026-08-10). Secrets: limpio, sin `.env*` trackeado. CI en
`main` (`Deno CI` + `Production smoke test`) verde en la corrida más reciente
antes de este cambio. Comparación de esquema desplegado vs. repo (arriba):
cero drift en las 30 entidades.

**No verificado:** `deno test` sobre `integration_test.ts` /
`permissions_safe_functions_test.ts` (importan de `deno.land/std`, bloqueado
en este sandbox — corren en CI, que está verde). Una sesión de navegador como
almacenista real confirmando en vivo que `edit_payment_record` ahora responde
403 y que un negocio `view_only` ahora recibe `write_blocked` en los ocho
handlers — mismo límite que declara el resto de este archivo.

**Deploy cerrado el mismo día, con evidencia de contenido — no sólo de la
salida de la CLI.** Mergeado como PR #404 (`55deb6a`). `npm run deploy`
reportó `47 unchanged`, incluidos `quotationPayments` y `quotations` — la
misma señal que la sección del 2026-09-24 documenta como poco confiable
para cambios que sólo tocan `handlers/`. Esta vez, en lugar de asumir que
"unchanged" significaba "no se aplicó", se verificó por contenido: `base44
functions pull` de los dos grupos contra una copia aislada del repo, diffed
byte a byte contra el código fuente — idénticos en ambos. El deploy sí llegó
al backend sin necesitar el paso manual de "Publish" en el panel que aquella
sección sí necesitó. Queda como dato útil para la próxima vez que la CLI
diga "unchanged" tras un cambio real: `functions pull <grupo>` a una copia
aparte y comparar es más barato y más concluyente que asumir en cualquier
dirección.

## Escáner de seguridad 2026-09-28: 8 hallazgos cerrados (permisos granulares, parte 4)

- **`updateProductStockSafe`** exige `Productos:edit_stock_quantity` (el rol solo no honraba la clave denegada al almacenista), el candado `write_blocked` y deja `InventoryAuditLog` (`direct_edit`), igual que `updateProductSafe`.
- **Clientes**: `createClientSafe` exige `Clientes:create` y las claves `edit_force_*` si activa esas banderas; `updateClientSafe` exige la clave de **cada campo que cambia** (el formulario reenvía el registro entero, un valor sin cambios no pide clave).
- **`sendCampaignEmails`** exige `Campañas:send`; `sendEnrollmentEmail` exige `Inscripciones:edit`.
- **Cotizaciones**: create/regenerate/convert/cancel/partialReturn exigen su clave; `updateQuotationSafe` y `updateQuotationFlagsSafe` mapean campo → clave (solo lo que cambia). `deliverQuotationSafe` no tiene clave propia y no se tocó.
- **Catálogos/CRM**: `createCategorySafe`, `createSupplierSafe`, contactos, cursos e inscripciones (create/update) exigen su clave; los `delete`/`update` de proveedores ya eran solo admin.
- **`write_blocked`** añadido a `importItemsSafe` y `updateProductStockSafe` (`quotationPayments` ya lo tenía desde el 2026-09-28).
- **Créditos**: `aiIntakeTurn` exige `Centro de Soporte:create`; `notifySupportIssue` exige negocio y acota longitudes.
- **HTML en correos**: nombre del negocio/destinatario escapado en `sendLifecycleEmails`, `sendTestLifecycleEmails` y `processTrialReactivationEmails`.
- Nuevas copias de `_permissions.ts` (8 grupos) registradas en `AUTOGEN_TARGETS`.

**Verificado:** `npm run lint`, `validate:rls`, `build`, `deno lint base44/functions/` (196 archivos) y 3 suites de deno sin imports externos. **No verificado:** sesión real de almacenista; tests de `deno.land`. **Pendiente:** `npm run deploy` + Publish (comprobar por comportamiento: 403 con `permission` en el cuerpo = código nuevo).
