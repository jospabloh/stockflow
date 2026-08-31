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

## Módulo 18 — cambio de negocio multi-tenant (mergeado 2026-08-26, documentado aquí 2026-08-31)

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
