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

## License lifecycle is owned by Mission Control (2026-08-03)

StockFlow has **no native license-lifecycle automation**. `checkAccountLifecycle`,
`processMonthlyRenewal`, `checkTenantLicense`, `expireTrials`,
`queueBillingReminders`, and `migrateViewOnlySince` were removed — they
duplicated the unified portfolio lifecycle that `jospabloh/acacia-mission-control`
(`api/cron/license-lifecycle.js`) already runs against `Business.billing_status`.
Do not re-add a StockFlow-native cron for trial/license status transitions or
lifecycle reminder emails — that logic belongs in Mission Control now. See
`base44/AUTOMATION_SETUP_PROMPT.md` for the retirement note and a known gap
(Mercado Pago pre-charge reminder emails aren't reproduced there yet).

`sendLifecycleEmails` and `base44/functions/licenses/*` were kept — they're
real dependencies of the manual admin actions in `LicenseAdmin.jsx`
(`confirmRenewalPayment`, `adminUpdateTenantLicense`), unrelated to the
retired cron.

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

## Known gap (deferred, reassessed 2026-08-10): granular permission keys are UI-only for a few direct-SDK entity writes

RLS (above) only enforces **tenant isolation** (`business_id` match) — it has no
concept of the app's granular `almacenista` permission keys
(`src/lib/permissionRegistry.js`, e.g. `Caja Chica:add_fund`,
`Utilidad:add_withdrawal`). Those keys are enforced in **two** places today:

1. The UI (`can()` / hides the button) — always present, but bypassable by
   anyone calling the Base44 SDK directly (e.g. from devtools).
2. A hand-written check inside a backend **"Safe" function**
   (`base44/functions/*/handlers/*Safe.ts`) — this is the real, non-bypassable
   enforcement. Most sensitive writes (quotations, movements, products,
   categories, contacts, courses, enrollments, client delete, team/role
   changes, license admin, tenant-rule admin, product import) go through one
   of these and are correctly gated server-side.

`PettyCashMovement` and `UtilityMovement` are the exception: the client writes
them **directly** via `base44.entities.X.create/update/delete(...)`, with no
Safe function in between. RLS still stops cross-tenant writes, but nothing
server-side checks `Caja Chica:add_fund` / `Caja Chica:delete` /
`Utilidad:add_withdrawal` / `edit_withdrawal` / `delete_withdrawal` — an
authenticated `almacenista` can bypass the UI and perform these actions on
their own business's records even when explicitly denied by their admin.
`SupplierPayment` has the same direct-write shape and should be checked too.

The same class of gap exists, currently un-exploitable, in two Safe functions
that validate `business_id` but not the specific permission key:
`partialReturnQuotation` (`Cotizaciones:return`) and
`createQuotationSafe`/`updateQuotationSafe` (`Cotizaciones:create`/
`edit_items`) — both keys are granted to `almacenista` by default today, so
there's no live bypass, but revoking either via `PermissionAdmin` would
silently fail to take effect server-side.

**Separately, same root cause:** the `write_blocked` billing/license gate
(`checkTenantLicense`, `billing_status: suspended|view_only`) is implemented
inside the Safe functions too, so `PettyCashMovement`/`SupplierPayment`/
`UtilityMovement` writes also skip it — a suspended/view-only tenant can keep
using Caja Chica/Utilidad after their license should have cut off writes.
`LicenseContext.isReadOnly` was already added for exactly this purpose but has
**zero consumers** in `src/` — it's dead code waiting for someone to wire it up
client-side (which would only be a UX nicety here, not the real fix).

**Why this isn't fixed yet:** the correct fix is a new Safe function (or
equivalent) that checks the permission key and `write_blocked` before writing,
which needs **deploying to Base44** to take effect — writing it without
deploying would just be a second instance of the "`.jsonc` changed but runtime
didn't" bug this file already warns about. Base44 MCP access and CLI login are
both required and were unavailable in the 2026-08-03 audit session that found
this.

**2026-08-10 reassessment:** Base44 MCP access was available this session, so
the original blocker is lifted, but the fix was still deferred rather than
rushed: it touches ~15 direct-write call sites across four live financial-data
components (`PettyCashMovementForm.jsx`, `UtilityMovementForm.jsx`,
`SupplierPayments.jsx`, `Utility.jsx`/`PettyCash.jsx`), each with real
create/update/delete business logic (petty-cash sync amounts, utility↔pettycash
linking, the invoice-status semáforo), and there is no way in this session to
exercise the resulting UI as a permission-restricted `almacenista` to verify
nothing broke before it reaches real tenants' cashbox data — the exact
combination this file's own rules ("don't patch cashbox logic without
verification", "don't ship an unverified Base44 deploy") warn against rushing.
Recommended shape for the next session that picks this up: one new Safe
function per entity (`createPettyCashMovementSafe` /
`updatePettyCashMovementSafe` / `deletePettyCashMovementSafe`, mirrored for
`UtilityMovement` and `SupplierPayment`) that checks the permission key +
`write_blocked` and then performs exactly the same write the client does
today; migrate the four call sites to call them; deploy; verify via
`list_entity_schemas` + a live create/delete call as a non-privileged
`almacenista` (both an allowed and a denied permission case) before removing
this section.

## 2026-08-10 automated security/quality/release audit

Routine sweep (secrets, dependency, RLS, permissions-heuristic, tenant isolation).
Only one code change came out of it — the `syncCashSaleToPettyCash` race-condition
fix documented above — everything else here was verified and needed no change:

- **Secrets:** grepped `src/` and `base44/` for hardcoded API keys/tokens/passwords
  and checked for tracked `.env*` files — none found.
- **`npm audit`:** 3 advisories, both pre-existing and accepted, not new:
  - `xlsx` (high, no fix available upstream) — already risk-accepted with a code
    comment at `src/lib/exportData.js:118-120`: confirmed the only usage
    (`exportToXLSX`) *writes* files, never calls `XLSX.read`/`sheet_to_json` on
    untrusted input, so the parser-side advisories (prototype pollution, ReDoS)
    don't apply to how this app uses the package.
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
