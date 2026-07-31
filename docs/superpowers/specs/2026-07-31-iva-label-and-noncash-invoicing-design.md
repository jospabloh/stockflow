# IVA Label Fix + Facturación de Pagos No-Efectivo No Facturados

Date: 2026-07-31
Status: Draft (awaiting user review)
Tenant driving this request: Baristop Distribuidora

## Context

Two related but independent asks from the tenant, both in Cotizaciones:

1. Where a line item shows no tax, the UI/PDF currently prints "Exento". The
   tenant wants it to read the tax rate explicitly instead.
2. Baristop issues one consolidated "factura a público en general" at month end
   covering all sales that (a) the customer did **not** request an individual
   invoice for (`invoice_status === "no_requerida"`) and (b) were paid, in whole
   or in part, by a method other than cash — cash sales are handled separately
   and must be excluded. Quotations can have **mixed** payments (part cash,
   part card/transfer/etc.), so only the non-cash portion of each quotation
   counts toward the invoice. Today there is no way to see this total, no
   detail of which quotations make it up, and no field to record which invoice
   number a quotation was folded into once Baristop issues it manually in their
   invoicing system.

## Part 1 — IVA label

Two display locations show "Exento" for untaxed items (`item.tax_rate === 0`):

- `src/components/quotations/QuotationPDF.jsx:200` — the customer-facing PDF.
  Currently: taxed → `"16%"`, untaxed → `"Exento"`.
- `src/components/quotations/QuotationPreviewDialog.jsx:220` — the on-screen
  preview dialog. Currently: taxed → shows the IVA amount in `$`, untaxed →
  `"Exento"`.

**Change:**
- PDF: both branches read `"IVA 16%"` / `"IVA 0%"`.
- Preview dialog: taxed branch is unchanged (keeps showing the `$` IVA amount,
  more useful for internal review); untaxed branch changes from `"Exento"` to
  `"IVA 0%"`.

No data model change — `tax_rate` already drives this, this is purely a label
change in two files.

## Part 2 — Non-cash unbilled report + invoice number tracking

### Data model

Add `invoice_number` (string, optional, nullable) to `Quotation` in
`base44/entities/Quotation.jsonc`. Per CLAUDE.md, adding it to the `.jsonc`
does **not** change runtime behavior — it must also be deployed to the live
Base44 backend schema (verify via Base44 MCP `list_entity_schemas`, apply via
`update_entity_schema`), or the field will silently fail to persist.

No RLS change: this is a field addition to an entity whose RLS already
implements the correct `data.business_id` / `role:admin` `$or` pattern on all
four operations. `npm run validate:rls` must still pass after the edit.

### Write path

All flag-style updates to `Quotation` go through the backend "Safe" function
`base44/functions/quotations/handlers/updateQuotationFlagsSafe.ts`, which
whitelists updatable fields via `ALLOWED_FLAG_FIELDS` (mass-assignment
protection, per that file's existing comments). `invoice_number` must be added
to that whitelist. This is a Deno edge function — editing the `.ts` file is
not enough, it must be deployed to the Base44 backend the same way the entity
schema does (verify via Base44 MCP / existing deploy tooling for this repo).

### Non-cash amount calculation

New helper, `src/lib/nonCashInvoicing.js`:

```js
export function nonCashAmount(quotation) {
  const payments = Array.isArray(quotation.payments) ? quotation.payments : [];
  return payments
    .filter(p => !String(p.payment_method || "").toLowerCase().includes("efectivo"))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}
```

This mirrors the existing cash-detection idiom in
`QuotationPaymentsSection.jsx:56` (`method.toLowerCase().includes("efectivo")`)
so a payment method is treated identically everywhere in the app.

A quotation is **eligible for the report** when:
- `invoice_status === "no_requerida"`, AND
- `nonCashAmount(quotation) > 0`, AND
- `!quotation.invoice_number` (not already folded into a prior invoice), AND
- `created_date` falls within the selected month/year filter (default: current
  month).

### Pre-IVA proration

Payments are amounts, not tied to specific line items (which can carry mixed
tax rates), so the non-cash amount is prorated using the quotation's own
subtotal/total ratio:

```
pre_iva = non_cash_amount * (quotation.subtotal / quotation.total)   // total > 0
iva     = non_cash_amount - pre_iva
```

When `quotation.total === 0`, treat `pre_iva = non_cash_amount` and `iva = 0`
(guards a divide-by-zero; these are "muestra/interno" quotations that
shouldn't reach this report in practice since they have no payments).

### New report — "Facturación Público General" tab

New component `src/components/reports/UnbilledNonCashInvoiceReport.jsx`,
registered as an additional tab in `src/pages/Reports.jsx` alongside
`OperationalReports`, `PredictiveReports`, `CollectionsRiskReport`, etc. —
same data-fetch pattern (`base44.entities.Quotation.filter({business_id}, ...)`
scoped to the signed-in business).

UI:
- Month/year picker at the top, defaulting to the current month.
- Table, one row per eligible quotation: checkbox · Folio · Cliente · Fecha ·
  métodos no-efectivo usados · Monto no-efectivo · Pre-IVA · IVA.
- Footer totals row: sum of Monto no-efectivo / Pre-IVA / IVA across all rows
  currently listed.
- "Seleccionar todo" checkbox in the header.
- "Asignar N° de factura" button, enabled when ≥1 row selected, opens a dialog
  with a single text input for the invoice number Baristop issued. On confirm,
  calls `updateQuotationFlagsSafe` for each selected quotation with
  `{ invoice_number: <value>, invoice_status: "emitida" }` (status flips
  automatically per the tenant's confirmed answer — it reflects that the
  quotation is now covered by the consolidated invoice). After success,
  invalidate the Quotation cache; rows disappear from the report since they no
  longer match `invoice_status === "no_requerida"`.
- Empty state: "Sin cotizaciones pendientes de facturar para <mes>" when
  nothing is eligible.

### Quotations table — invoice number column

New "N° Factura" column in `src/components/tables/VirtualizedQuotationTable.jsx`
(desktop row, desktop header, and the mobile card view), visible/editable on
**all** quotations (not just report-eligible ones, so a directly-issued
individual invoice can also be recorded). Inline-editable text input, wired
through a new `onInvoiceNumberChange(q, value)` prop threaded from
`src/pages/Quotations.jsx` — mirrors the existing `onInvoiceStatusChange`
handler exactly (same `updateQuotationFlagsSafe` call, same toast-on-error
handling), just with `{ invoice_number: value }` as the update payload.

## Out of scope

- No changes to how cash sales are invoiced (unaffected — they're excluded by
  construction, `no_requerida` + non-cash-only).
- No automated generation of the actual invoice document/PDF for the
  consolidated "factura a público en general" — Baristop issues that manually
  in their own invoicing system; this feature only tracks the resulting number
  against the underlying quotations.
- No change to per-line-item tax rate logic — Part 1 only changes labels.

## Verification

- `npm run validate:rls` (entity `.jsonc` edit).
- `npm run lint`.
- `npm run build`.
- Verify `Quotation.invoice_number` exists in the **deployed** Base44 schema
  (Base44 MCP `list_entity_schemas`), deploy if missing (`update_entity_schema`).
- Verify the updated `updateQuotationFlagsSafe` function is deployed to the
  live Base44 backend, not just committed to the repo.
- Manual check: create a test quotation with mixed cash/transfer payments,
  `invoice_status = no_requerida`, confirm it appears in the new report with
  correct non-cash/pre-IVA/IVA math, assign an invoice number, confirm it
  disappears from the report and the number now shows (and is editable) in the
  main Cotizaciones table.
