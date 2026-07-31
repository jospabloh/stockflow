# Permission coverage audit — close the gap between the registry and the app

## Origin

Client (tenant **baristop**) asked for almacenista to get three specific
capabilities that already existed as registry permissions but weren't toggled
on: the Cotizaciones fiscal summary (`Cotizaciones:pricing`), the invoice-status
semaphore + N° factura (`Cotizaciones:edit_invoice_status`), and Pagos a
Proveedores view+create. Resolving that surfaced a broader concern: the
Permission Admin matrix should be a complete, trustworthy control surface —
every visible/executable thing in the app should have a real permission behind
it, and every permission should have a real effect. A 5-way parallel audit
across all 19 registry modules + a full `src/pages/` sweep found ~35 places
where that's not true today.

## Failure patterns found (not one bug, four repeating shapes)

1. **Ungated** — a button/field/tab that changes or reveals data with zero
   `can()`/`canSee()` call at all (e.g. Categorías' entire create/edit dialog,
   Clientes' force-wholesale/force-purchase checkboxes, Caja Chica's
   Ingreso/Egreso buttons).
2. **Hardcoded `isAdmin`** — gated by the raw role flag instead of a registry
   permission, so the Permission Admin matrix checkbox for that action is
   decorative (Movimientos/Caja Chica edit-delete, Settings' entire tab list,
   Reportes' "Compras" total).
3. **Wrong key** — gated by a real, existing permission, but the wrong one
   semantically (Reportes' bulk "Asignar N° de factura" checks
   `Cotizaciones:confirm_payment` instead of `Cotizaciones:edit_invoice_status`).
4. **Dead permission** — declared in the registry, shown in the matrix,
   checked by nothing (Reportes' `export`, several Pagos a Proveedores
   per-field actions, Configuración's `manage_referral`).

Plus a few **missing registry entries entirely** for features that ship with
no permission at all: SupportTickets (whole module), Settings' "Audit
Inventario" bulk stock correction.

Full findings list (module, file:line, current state, suggested fix) lives in
the session transcript from the 5 parallel Explore-agent audits; this doc
captures the decisions made from it, not the raw findings.

## Hard rule: no access regression

This fix must not take away anything a role can do today. Where "ungated"
meant "accessible to everyone including almacenista," the newly-added gate's
almacenista default is set to **match that existing de-facto access**
(`true`), even where the registry had already declared a stricter intended
default that was simply never enforced. The Permission Admin matrix — now
actually functional — is where a business opts into tightening it afterward,
not something this cleanup pass does unilaterally.

Two cases were called out explicitly as exceptions, decided with the client:

- **Reportes' bulk "Asignar N° de factura"** (wrong-key case): fixed to use
  the correct key, `Cotizaciones:edit_invoice_status`, at its existing
  (already-decided-this-session) default of `false` for almacenista — even
  though this measurably removes access almacenista had today via the bug.
  Rationale (client's call): "lo correcto es lo correcto, no hay tratos
  especiales" — the wrong-key bug gave almacenista a backdoor to a capability
  the business already deliberately decided to keep admin-only; closing the
  backdoor is the fix, not a new restriction to negotiate around.
- **Movimientos' cost price on "Entrada"**: fixed to respect the existing
  `Productos:cost_price` permission (sensitive, `false` default for
  almacenista) as-is, even though almacenista can see this cost today. Treated
  as closing a financial-data leak (the exact class of data `cost_price`
  already exists to protect everywhere else in the app), not as removing a
  feature.

Every other fix in this pass follows the general no-regression rule.

## New registry entries required

| Key | Purpose | Almacenista default | Why |
|---|---|---|---|
| `Configuracion:audit_inventory` | Bulk stock-quantity correction | `false` | Destructive; today admin-only (`isAdmin`), no regression by keeping it denied |
| `Centro de Soporte:view` / `:create` / `:reply` (new module) | Support ticket center | `true` | Reachable today via direct URL with zero gating (accidental, not a deliberate restriction) — wiring it up preserves that access |
| `Movimientos:export` | Export movement history | `true` | Currently unconditionally exported; no existing gate to regress from |
| `Caja Chica:export` | Export petty cash ledger | `false` | Currently unconditionally exported, but this is a full financial ledger — treated like the cost-price case, closing a leak rather than preserving an oversight, consistent with `Dashboard:financial` already being denied by default |
| `Reportes:billing` | "Facturación Público General" tab, decoupled from `operational` | `true` | Currently reachable via `operational` (already true); this only splits it out for future independent control, not a new restriction |
| `Cotizaciones:edit_payment_record` | Edit/delete an already-recorded payment (distinct from registering/confirming one) | `true` | `QuotationPaymentsSection`'s current gate is a tautology (always true) — preserving today's real access per the no-regression rule |
| `Clientes:edit_force_zero_price` | "Precio $0 / muestra interna" checkbox | `true` | Currently fully ungated — preserving today's real access |

All other fixes reuse existing registry keys, either at their current
almacenista default (where that already matches observed behavior) or
overridden to `true` per the no-regression rule (documented per-finding in
the implementation).

## Execution

1. Registry changes first (new keys above + any default overrides needed to
   satisfy no-regression), in `src/lib/permissionRegistry.js`.
2. Run `npm run generate:permission-manifests` — regenerates
   `src/generated/permissionManifests.ts` and the three Base44 backend
   functions' `AUTOGEN:CANONICAL_KEYS` blocks (this pipeline already exists
   from the earlier Cotizaciones invoice-status fix this session).
3. Wire up every finding: add the missing `can()`/`canSee()` call, replace
   `isAdmin &&` with the registry-backed check, or fix the mismatched key —
   grouped by module so each change is independently reviewable.
4. `npm run lint` && `npm run build` after each module batch.
5. Security review pass over the full diff before commit (this touches
   authorization logic extensively).
6. Base44 backend functions changed need deployment (same caveat as every
   permission-registry change this session) — flagged in the PR body.
7. Deliverable for the client: once a finding's fix makes a capability into a
   real, working checkbox in the Permission Admin matrix, list that checkbox
   explicitly (module + action label) so baristop's admin can toggle whatever
   they specifically want beyond the defaults — same pattern as the original
   4-checkbox guidance, extended to cover whatever this audit adds.
