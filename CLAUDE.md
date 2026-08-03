# StockFlow — Project Notes

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

## Known gap (blocked, 2026-08-03): granular permission keys are UI-only for a few direct-SDK entity writes

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
this. Next session with Base44 access: add and deploy the missing checks,
verify via `list_entity_schemas`/a live create/delete call as a
non-privileged `almacenista`, then remove this section.
