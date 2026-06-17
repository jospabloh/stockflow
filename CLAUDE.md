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

**The read rule and the write rules are NOT the same.** Reads run in the end
user's context, so the strict tenant template is correct. But every backend
write goes through `base44.asServiceRole` (see next section), which evaluates as
`role: admin` with **no end-user context** — so a write rule of only
`{{user.data.business_id}}` resolves the user template to **empty** and rejects
the write. Reads keep working while **every** create/update/delete fails: a
silent, app-wide write outage.

Correct **read** rule for a business-scoped entity:

```jsonc
"read": { "data.business_id": "{{user.data.business_id}}" }
```

Correct **create / update / delete** rules — same tenant check **OR** the service
role (mirrors the `Session` entity, whose `asServiceRole` writes already work):

```jsonc
"update": {
  "$or": [
    { "data.business_id": "{{user.data.business_id}}" },
    { "user_condition": { "role": "admin" } }
  ]
}
```

For the `Business` entity itself, scope by its built-in `id`
(`"id": "{{user.data.business_id}}"`), with the same `$or` admin branch on
update/delete.

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

**Guard:** `npm run validate:rls` (also runs in CI) parses every
`base44/entities/*.jsonc` and fails on any invalid entity- or user-side RLS
path. Run it after touching any `rls` block, and remember to **deploy** the
fixed schema to the Base44 backend (`update_entity_schema`) — the repo `.jsonc`
alone does not change runtime behavior.
