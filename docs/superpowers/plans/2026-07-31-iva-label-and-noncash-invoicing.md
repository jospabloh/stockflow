# IVA Label Fix + Non-Cash Invoicing Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Exento" IVA label with explicit rate labels in quotations, and add a report + `invoice_number` tracking column so Baristop can identify and bulk-assign a consolidated "factura a público en general" to quotations that were paid non-cash but never individually invoiced.

**Architecture:** Two label-only edits in the PDF/preview renderers; a new `invoice_number` field on the `Quotation` entity (schema deploy required); a whitelist update in the existing `updateQuotationFlagsSafe` backend function (the only write path for this kind of flag update); a pure-logic helper for the non-cash/pre-IVA math; a new report tab following the existing `Reports.jsx` pattern; and a new inline-editable column in the existing quotations table, wired through the same backend function the invoice-status semáforo already uses.

**Tech Stack:** React (Vite), Base44 SDK (`base44.entities.*`, `base44.functions.invoke`), Base44 CLI (`npx base44 entities push` / `functions deploy`), Tailwind, shadcn/radix UI primitives, moment.js, sonner (toast).

## Global Constraints

- No unit/E2E test framework exists in this repo (`src/` has none — confirmed via `find` and `package.json`). Verification is `npm run lint`, `npm run build`, `npm run typecheck`, and `npm run validate:rls` where applicable, plus a manual QA checklist — do not introduce a new test framework, that's out of scope.
- Per `CLAUDE.md`: any `base44/entities/*.jsonc` or `base44/functions/**` change must be **deployed** to the live Base44 backend (`npx base44 entities push` / `npx base44 functions deploy`) — committing the file alone does not change runtime behavior, and a missing deployed field is silently dropped on save with no error.
- Cash detection must use the exact idiom already used elsewhere in this codebase: `String(payment_method || "").toLowerCase().includes("efectivo")` (see `QuotationPaymentsSection.jsx:56`) — do not invent a different check.
- All new Quotation writes go through `base44.functions.invoke('quotations', { action: 'updateQuotationFlagsSafe', quotation_id, updates })` — never call `base44.entities.Quotation.update` directly from `src/`, it bypasses the field whitelist and business_id ownership check.
- Spec: `docs/superpowers/specs/2026-07-31-iva-label-and-noncash-invoicing-design.md`.

---

### Task 1: IVA label in the quotation PDF

**Files:**
- Modify: `src/components/quotations/QuotationPDF.jsx:200`

**Interfaces:**
- Consumes: `item.tax_rate` (existing field, unchanged).
- Produces: nothing new — pure label change, no new exports.

- [ ] **Step 1: Make the change**

Current line 200:
```js
    const ivaLabel = (effectiveTaxRate > 0) ? "16%" : "Exento";
```
New:
```js
    const ivaLabel = (effectiveTaxRate > 0) ? "IVA 16%" : "IVA 0%";
```

- [ ] **Step 2: Verify with a throwaway Node check**

Run:
```bash
node -e '
const effectiveTaxRate = 16;
const ivaLabel1 = (effectiveTaxRate > 0) ? "IVA 16%" : "IVA 0%";
const effectiveTaxRate2 = 0;
const ivaLabel2 = (effectiveTaxRate2 > 0) ? "IVA 16%" : "IVA 0%";
if (ivaLabel1 !== "IVA 16%" || ivaLabel2 !== "IVA 0%") throw new Error("label mismatch");
console.log("OK:", ivaLabel1, ivaLabel2);
'
```
Expected: `OK: IVA 16% IVA 0%`

- [ ] **Step 3: Commit**

```bash
git add src/components/quotations/QuotationPDF.jsx
git commit -m "fix: label untaxed quotation items as IVA 0% instead of Exento in PDF"
```

---

### Task 2: IVA label in the quotation preview dialog

**Files:**
- Modify: `src/components/quotations/QuotationPreviewDialog.jsx:220`

**Interfaces:**
- Consumes: `hasTax` (existing local boolean derived from `item.tax_rate`), unchanged.
- Produces: nothing new.

- [ ] **Step 1: Make the change**

Current lines 214-221:
```jsx
                      <td className="px-3 py-2 text-center">
                        {hasTax ? (
                          <span className="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px] tabular">
                            ${fmt(ivaPerUnit)}
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded text-[10px]">Exento</span>
                        )}
                      </td>
```
New (only the untaxed branch's text changes, taxed branch keeps showing the `$` amount):
```jsx
                      <td className="px-3 py-2 text-center">
                        {hasTax ? (
                          <span className="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px] tabular">
                            ${fmt(ivaPerUnit)}
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded text-[10px]">IVA 0%</span>
                        )}
                      </td>
```

- [ ] **Step 2: Verify**

Run: `grep -n "Exento" src/components/quotations/QuotationPreviewDialog.jsx src/components/quotations/QuotationPDF.jsx`
Expected: no output (both occurrences removed).

- [ ] **Step 3: Commit**

```bash
git add src/components/quotations/QuotationPreviewDialog.jsx
git commit -m "fix: label untaxed quotation items as IVA 0% instead of Exento in preview"
```

---

### Task 3: Add `invoice_number` to the Quotation entity schema

**Files:**
- Modify: `base44/entities/Quotation.jsonc`

**Interfaces:**
- Produces: `Quotation.invoice_number` (string, optional) — consumed by Task 4 (backend whitelist), Task 6 (report), Task 8 (table column).

- [ ] **Step 1: Add the field**

In `base44/entities/Quotation.jsonc`, inside `"properties"`, add (alphabetical position, right after `"in_route"` and before `"invoice_status"` to match the file's existing alphabetical ordering):

```jsonc
    "invoice_number": {
      "description": "Número de la factura (individual o consolidada) a la que quedó asignada esta cotización",
      "type": "string"
    },
```

Do not add it to `"required"` — it starts empty and is filled in manually later.

- [ ] **Step 2: Validate RLS is still intact**

Run: `npm run validate:rls`
Expected: exits 0, no errors (this is a property addition only, the `rls` block is untouched).

- [ ] **Step 3: Commit**

```bash
git add base44/entities/Quotation.jsonc
git commit -m "feat: add invoice_number field to Quotation entity schema"
```

- [ ] **Step 4: Deploy the schema to the live Base44 backend**

Run:
```bash
npx base44 whoami
```
If authenticated, run:
```bash
npx base44 entities push
```
Expected: `Quotation` reports as updated with the new `invoice_number` field, no errors.

**If `npx base44` cannot install/run in this environment** (e.g. registry access to `npm.jsr.io` is blocked by network policy — verify with `npx base44 whoami` first before assuming this), do not silently skip: tell the user explicitly that `base44/entities/Quotation.jsonc` was committed but is **not yet deployed**, and that they (or a session with working Base44 CLI network access) must run `npx base44 entities push` before the `invoice_number` field will actually persist — otherwise every future save of it will silently no-op per the CLAUDE.md drift warning.

---

### Task 4: Whitelist `invoice_number` in the backend write path

**Files:**
- Modify: `base44/functions/quotations/handlers/updateQuotationFlagsSafe.ts:4`

**Interfaces:**
- Consumes: Task 3's `Quotation.invoice_number` field.
- Produces: `updateQuotationFlagsSafe` now accepts `{ invoice_number }` in its `updates` payload — consumed by Task 6 and Task 9's frontend calls.

- [ ] **Step 1: Add the field to the whitelist**

Current line 4:
```ts
const ALLOWED_FLAG_FIELDS = ['invoice_status', 'in_route', 'delivered', 'paid', 'payment_method', 'payments', 'amount_paid', 'balance'];
```
New:
```ts
const ALLOWED_FLAG_FIELDS = ['invoice_status', 'invoice_number', 'in_route', 'delivered', 'paid', 'payment_method', 'payments', 'amount_paid', 'balance'];
```

- [ ] **Step 2: Verify**

Run: `grep -n "ALLOWED_FLAG_FIELDS" base44/functions/quotations/handlers/updateQuotationFlagsSafe.ts`
Expected: shows the line with `'invoice_number'` present.

- [ ] **Step 3: Commit**

```bash
git add base44/functions/quotations/handlers/updateQuotationFlagsSafe.ts
git commit -m "feat: allow invoice_number in updateQuotationFlagsSafe whitelist"
```

- [ ] **Step 4: Deploy the function to the live Base44 backend**

Run:
```bash
npx base44 functions deploy quotations
```
Expected: the `quotations` function reports as redeployed successfully.

**Same fallback as Task 3, Step 4** if the CLI can't reach the Base44 backend from this environment: tell the user explicitly this function edit is committed but **not deployed** — until it is, calls to update `invoice_number` will hit the old deployed whitelist and the field will be silently dropped (400-free, no error, just never saved), exactly the failure class documented in `CLAUDE.md`.

---

### Task 5: `nonCashInvoicing` helper

**Files:**
- Create: `src/lib/nonCashInvoicing.js`

**Interfaces:**
- Produces:
  - `nonCashAmount(quotation): number`
  - `proratePreIva(quotation, amount): { preIva: number, iva: number }`
  - `isEligibleForNonCashInvoicing(quotation): boolean`
  - Consumed by Task 6 (`UnbilledNonCashInvoiceReport.jsx`).
- Consumes: `quotation.payments` (array of `{ amount, payment_method }`), `quotation.invoice_status`, `quotation.invoice_number`, `quotation.subtotal`, `quotation.total` — all existing fields except `invoice_number` (Task 3).

- [ ] **Step 1: Write the module**

```js
// src/lib/nonCashInvoicing.js

/**
 * Sum of all payments on a quotation whose method is NOT cash ("efectivo").
 * Uses the same cash-detection idiom as QuotationPaymentsSection.jsx.
 */
export function nonCashAmount(quotation) {
  const payments = Array.isArray(quotation?.payments) ? quotation.payments : [];
  return payments
    .filter((p) => !String(p.payment_method || "").toLowerCase().includes("efectivo"))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
}

/**
 * Prorates a non-cash amount into its pre-IVA and IVA portions, using the
 * quotation's own subtotal/total ratio (payments aren't tied to specific
 * line items, which can carry mixed tax rates).
 */
export function proratePreIva(quotation, amount) {
  const total = quotation?.total || 0;
  const subtotal = quotation?.subtotal || 0;
  if (total <= 0) {
    return { preIva: amount, iva: 0 };
  }
  const preIva = amount * (subtotal / total);
  return { preIva, iva: amount - preIva };
}

/**
 * A quotation belongs in the "factura a público en general" report when the
 * customer didn't request an individual invoice, it has a non-cash payment
 * component, and it hasn't already been folded into a prior invoice.
 */
export function isEligibleForNonCashInvoicing(quotation) {
  return (
    quotation?.invoice_status === "no_requerida" &&
    !quotation?.invoice_number &&
    nonCashAmount(quotation) > 0
  );
}
```

- [ ] **Step 2: Verify with a throwaway Node check**

Run:
```bash
node -e '
import("./src/lib/nonCashInvoicing.js").then(({ nonCashAmount, proratePreIva, isEligibleForNonCashInvoicing }) => {
  const q = {
    invoice_status: "no_requerida",
    invoice_number: null,
    subtotal: 100,
    tax: 16,
    total: 116,
    payments: [
      { amount: 58, payment_method: "Efectivo" },
      { amount: 58, payment_method: "Transferencia" },
    ],
  };
  const nc = nonCashAmount(q);
  if (nc !== 58) throw new Error("nonCashAmount wrong: " + nc);
  const { preIva, iva } = proratePreIva(q, nc);
  if (Math.abs(preIva - 50) > 0.001) throw new Error("preIva wrong: " + preIva);
  if (Math.abs(iva - 8) > 0.001) throw new Error("iva wrong: " + iva);
  if (!isEligibleForNonCashInvoicing(q)) throw new Error("should be eligible");
  const q2 = { ...q, invoice_number: "A-1" };
  if (isEligibleForNonCashInvoicing(q2)) throw new Error("should NOT be eligible once invoiced");
  const q3 = { ...q, payments: [{ amount: 116, payment_method: "Efectivo" }] };
  if (isEligibleForNonCashInvoicing(q3)) throw new Error("should NOT be eligible when fully cash");
  console.log("OK", { nc, preIva, iva });
}).catch((e) => { console.error("FAIL", e); process.exit(1); });
'
```
Expected: `OK { nc: 58, preIva: 50, iva: 8 }`

- [ ] **Step 3: Commit**

```bash
git add src/lib/nonCashInvoicing.js
git commit -m "feat: add nonCashInvoicing helper for non-cash unbilled report math"
```

---

### Task 6: `UnbilledNonCashInvoiceReport` component

**Files:**
- Create: `src/components/reports/UnbilledNonCashInvoiceReport.jsx`

**Interfaces:**
- Consumes:
  - Props: `quotations: Quotation[]`, `onQuotationsUpdated: () => void`.
  - `nonCashAmount`, `proratePreIva`, `isEligibleForNonCashInvoicing` from `@/lib/nonCashInvoicing` (Task 5).
  - `base44.functions.invoke('quotations', { action: 'updateQuotationFlagsSafe', quotation_id, updates })` (existing backend function, Task 4 whitelist).
- Produces: default export `UnbilledNonCashInvoiceReport` — consumed by Task 7 (`Reports.jsx`).

- [ ] **Step 1: Write the component**

```jsx
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText } from "lucide-react";
import moment from "moment";
import { toast } from "sonner";
import { nonCashAmount, proratePreIva, isEligibleForNonCashInvoicing } from "@/lib/nonCashInvoicing";

export default function UnbilledNonCashInvoiceReport({ quotations, onQuotationsUpdated }) {
  const [month, setMonth] = useState(moment().format("YYYY-MM"));
  const [selected, setSelected] = useState(new Set());
  const [invoiceNumberInput, setInvoiceNumberInput] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    return quotations
      .filter((q) => isEligibleForNonCashInvoicing(q))
      .filter((q) => moment(q.created_date).format("YYYY-MM") === month)
      .map((q) => {
        const amount = nonCashAmount(q);
        const { preIva, iva } = proratePreIva(q, amount);
        const methods = [...new Set(
          (q.payments || [])
            .filter((p) => !String(p.payment_method || "").toLowerCase().includes("efectivo"))
            .map((p) => p.payment_method)
            .filter(Boolean)
        )];
        return { quotation: q, amount, preIva, iva, methods };
      })
      .sort((a, b) => moment(a.quotation.created_date).diff(moment(b.quotation.created_date)));
  }, [quotations, month]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    amount: acc.amount + r.amount,
    preIva: acc.preIva + r.preIva,
    iva: acc.iva + r.iva,
  }), { amount: 0, preIva: 0, iva: 0 }), [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.quotation.id));

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.quotation.id)));
  };

  const handleAssign = async () => {
    const value = invoiceNumberInput.trim();
    if (!value) {
      toast.error("Ingresa un número de factura");
      return;
    }
    setSaving(true);
    try {
      const targets = rows.filter((r) => selected.has(r.quotation.id));
      const results = await Promise.all(targets.map((r) =>
        base44.functions.invoke('quotations', {
          action: 'updateQuotationFlagsSafe',
          quotation_id: r.quotation.id,
          updates: { invoice_number: value, invoice_status: "emitida" },
        })
      ));
      const failed = results.filter((res) => !res.data?.success);
      if (failed.length > 0) {
        toast.error(`No se pudo actualizar ${failed.length} de ${targets.length} cotizaciones`);
      } else {
        toast.success(`Factura ${value} asignada a ${targets.length} cotizaciones`);
      }
      setSelected(new Set());
      setInvoiceNumberInput("");
      setAssignDialogOpen(false);
      onQuotationsUpdated?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "No se pudo asignar el número de factura");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b bg-emerald-50/50">
        <div>
          <h3 className="font-semibold text-slate-700">Facturación Público General — Pagos No-Efectivo</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cotizaciones no facturadas individualmente (No Requerida) con pagos en un método distinto a efectivo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500">Mes</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="px-4 py-3 w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={rows.length === 0} />
              </th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Folio</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Métodos</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Monto no-efectivo</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">Pre-IVA</th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium">IVA</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400">Sin cotizaciones pendientes de facturar para {moment(month, "YYYY-MM").format("MMMM YYYY")}</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.quotation.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Checkbox checked={selected.has(r.quotation.id)} onCheckedChange={() => toggleRow(r.quotation.id)} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-600">{r.quotation.folio}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.quotation.client_name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{moment(r.quotation.created_date).format("DD/MM/YY")}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.methods.join(", ")}</td>
                  <td className="px-4 py-3 text-right tabular">${r.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right tabular">${r.preIva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right tabular">${r.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-50/70 font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-slate-600">Totales</td>
                <td className="px-4 py-3 text-right tabular">${totals.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right tabular">${totals.preIva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right tabular">${totals.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="p-4 bg-slate-50/50 border-t flex items-center justify-between">
        <p className="text-xs text-slate-500">{selected.size} seleccionada(s)</p>
        <Button size="sm" disabled={selected.size === 0} onClick={() => setAssignDialogOpen(true)}>
          <FileText className="h-3.5 w-3.5 mr-2" /> Asignar N° de factura
        </Button>
      </div>

      <AlertDialog open={assignDialogOpen} onOpenChange={(v) => { if (!v && !saving) setAssignDialogOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asignar número de factura</AlertDialogTitle>
            <AlertDialogDescription>
              Se asignará a {selected.size} cotización(es) seleccionada(s) y su estado de facturación cambiará a "Emitida".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs text-slate-500">Número de factura</Label>
            <Input
              value={invoiceNumberInput}
              onChange={(e) => setInvoiceNumberInput(e.target.value)}
              placeholder="Ej. A-1024"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => { e.preventDefault(); handleAssign(); }}
            >
              {saving ? "Guardando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
```

- [ ] **Step 2: Lint the new file**

Run: `npx eslint src/components/reports/UnbilledNonCashInvoiceReport.jsx --quiet`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/UnbilledNonCashInvoiceReport.jsx
git commit -m "feat: add UnbilledNonCashInvoiceReport component"
```

---

### Task 7: Wire the new report into `Reports.jsx`

**Files:**
- Modify: `src/pages/Reports.jsx`

**Interfaces:**
- Consumes: `UnbilledNonCashInvoiceReport` (Task 6), existing `quotations` state, existing `can('Reportes', 'operational')` permission gate (reused — no new permission key is introduced, per YAGNI, since this report is an operational/finance report and adding a new permission key would require touching the generated permission manifests, which is out of scope for this feature).
- Produces: new "Facturación Público General" tab in the Reports page.

- [ ] **Step 1: Add `businessId` state and a reusable quotations fetcher**

In `src/pages/Reports.jsx`, add a new piece of state next to the existing ones (after line 21, `const [isAdmin, setIsAdmin] = useState(false);`):

```jsx
  const [businessId, setBusinessId] = useState(null);
```

Update the `useEffect` (lines 25-42) to also store it and to expose a reusable fetch function. Replace:

```jsx
  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const admin = u?.role === "admin";
      const bId = u?.business_id;
      setIsAdmin(admin);
      const [prods, movs, cats] = await Promise.all([
        base44.entities.Product.filter({ business_id: bId }, "-created_date", 500),
        base44.entities.Movement.filter({ business_id: bId }, "-created_date", 1000),
        base44.entities.Category.filter({ business_id: bId }),
      ]);
      setProducts(prods);
      setMovements(movs);
      setCategories(cats);
      const quots = await base44.entities.Quotation.filter({ business_id: bId }, "-created_date", 500).catch(() => []);
      setQuotations(quots);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
```

with:

```jsx
  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const admin = u?.role === "admin";
      const bId = u?.business_id;
      setIsAdmin(admin);
      setBusinessId(bId);
      const [prods, movs, cats] = await Promise.all([
        base44.entities.Product.filter({ business_id: bId }, "-created_date", 500),
        base44.entities.Movement.filter({ business_id: bId }, "-created_date", 1000),
        base44.entities.Category.filter({ business_id: bId }),
      ]);
      setProducts(prods);
      setMovements(movs);
      setCategories(cats);
      const quots = await base44.entities.Quotation.filter({ business_id: bId }, "-created_date", 500).catch(() => []);
      setQuotations(quots);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const refetchQuotations = async () => {
    if (!businessId) return;
    const quots = await base44.entities.Quotation.filter({ business_id: businessId }, "-created_date", 500).catch(() => []);
    setQuotations(quots);
  };
```

- [ ] **Step 2: Import the new component**

Add near the top with the other report imports (after line 12, `import SupplierPaymentsReportChart from "@/components/dashboard/SupplierPaymentsReportChart";`):

```jsx
import UnbilledNonCashInvoiceReport from "@/components/reports/UnbilledNonCashInvoiceReport";
```

- [ ] **Step 3: Add the tab trigger**

In the `TabsList` block, after the "PAGOS A PROVEEDORES" trigger (after line 118's closing `)}`), add:

```jsx
          {/* FACTURACIÓN PÚBLICO GENERAL (no-efectivo, no facturado) */}
          {can('Reportes', 'operational') && (
            <TabsTrigger value="billing" className="font-medium">🧾 Facturación Público General</TabsTrigger>
          )}
```

- [ ] **Step 4: Add the tab content**

After the "PAGOS A PROVEEDORES" `TabsContent` block (after line 147's closing `)}`), add:

```jsx
        {/* FACTURACIÓN PÚBLICO GENERAL */}
        {can('Reportes', 'operational') && (
          <TabsContent value="billing">
            <UnbilledNonCashInvoiceReport
              quotations={quotations}
              onQuotationsUpdated={refetchQuotations}
            />
          </TabsContent>
        )}
```

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Reports.jsx
git commit -m "feat: add Facturación Público General tab to Reports page"
```

---

### Task 8: `invoice_number` column in the quotations table

**Files:**
- Modify: `src/components/tables/VirtualizedQuotationTable.jsx`

**Interfaces:**
- Consumes: `q.invoice_number` (Task 3 field).
- Produces: new prop `onInvoiceNumberChange(quotation, value: string)` on the default-exported `VirtualizedQuotationTable` — consumed by Task 9 (`Quotations.jsx`).

This column follows the existing `invoice_status` semáforo precedent: **desktop table only** (the mobile `QuotationCard` doesn't render `invoice_status` either — see `QuotationCard`'s prop list, which has no `onInvoiceStatusChange`), so no mobile card change is needed here.

- [ ] **Step 1: Add the inline-edit cell component**

Add this new component right before `function QuotationRow(...)` (i.e. right after the imports, before line 14):

```jsx
function InvoiceNumberCell({ value, onSave }) {
  const [draft, setDraft] = React.useState(value || "");
  React.useEffect(() => { setDraft(value || ""); }, [value]);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value || "")) {
      onSave(trimmed);
    }
  };
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      placeholder="—"
      title="Número de factura"
      className="w-full text-[10px] text-center bg-transparent border border-transparent hover:border-slate-200 focus:border-brand-400 focus:bg-white rounded px-1 py-0.5 outline-none"
    />
  );
}
```

- [ ] **Step 2: Add `onInvoiceNumberChange` to `QuotationRow`'s props and render the cell**

Change the `QuotationRow` signature (line 14) from:

```jsx
function QuotationRow({ q, statusConfig, onEdit, onPreview, onDownloadPDF, onConvert, onCancel, onPay, onPartialReturn, onInvoiceStatusChange, onInRouteChange, isExpired, onRegenerate, canRevertPayment, onRevertPayment }) {
```

to:

```jsx
function QuotationRow({ q, statusConfig, onEdit, onPreview, onDownloadPDF, onConvert, onCancel, onPay, onPartialReturn, onInvoiceStatusChange, onInvoiceNumberChange, onInRouteChange, isExpired, onRegenerate, canRevertPayment, onRevertPayment }) {
```

Then, right after the "Invoice Status" `<div>` block closes (after line 87, `</div>` that closes the `{["pendiente", "emitida", "no_requerida"].map(...)}` block), add:

```jsx
      {/* Invoice Number */}
      <div className="w-24 px-1">
        <InvoiceNumberCell
          value={q.invoice_number}
          onSave={(val) => onInvoiceNumberChange(q, val)}
        />
      </div>
```

- [ ] **Step 3: Add the header cell**

In the desktop header block, right after the "Factura" `ColumnFilterPopover` block closes (after line 522, the `</div>` closing the `w-24 text-center` invoice-status filter div), add:

```jsx
          <div className="w-24 text-center">
            <span className="text-[11px] font-semibold text-muted-foreground">N° Factura</span>
          </div>
```

- [ ] **Step 4: Thread the prop through `commonProps` and the default export**

In `VirtualizedQuotationTable`'s param list (line 428), add `onInvoiceNumberChange` next to `onInvoiceStatusChange`:

```jsx
export default function VirtualizedQuotationTable({
  quotations,
  statusConfig,
  onEdit,
  onPreview,
  onDownloadPDF,
  onConvert,
  onCancel,
  onPay,
  onPartialReturn,
  onInvoiceStatusChange,
  onInvoiceNumberChange,
  onInRouteChange,
  isExpired,
  onRegenerate,
  canRevertPayment,
  onRevertPayment,
  // Filtros tipo Excel
  filters,
  onFiltersChange,
  paymentMethodOptions,
}) {
  const commonProps = { statusConfig, onEdit, onPreview, onDownloadPDF, onConvert, onCancel, onPay, onPartialReturn, onInvoiceStatusChange, onInvoiceNumberChange, onInRouteChange, isExpired, onRegenerate, canRevertPayment, onRevertPayment };
```

(`QuotationCard` ignores the extra `onInvoiceNumberChange` key silently since it doesn't destructure it — no mobile change needed, matching the existing `onInvoiceStatusChange` precedent.)

- [ ] **Step 5: Lint**

Run: `npx eslint src/components/tables/VirtualizedQuotationTable.jsx --quiet`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/tables/VirtualizedQuotationTable.jsx
git commit -m "feat: add editable invoice_number column to quotations table"
```

---

### Task 9: Wire `onInvoiceNumberChange` in `Quotations.jsx`

**Files:**
- Modify: `src/pages/Quotations.jsx`

**Interfaces:**
- Consumes: `VirtualizedQuotationTable`'s new `onInvoiceNumberChange` prop (Task 8), `base44.functions.invoke('quotations', { action: 'updateQuotationFlagsSafe', ... })` (existing, Task 4 whitelist), `invalidate("Quotation")` (existing `useInvalidateEntities` hook).
- Produces: nothing new — this is the final consumer.

- [ ] **Step 1: Add the handler**

In the `<VirtualizedQuotationTable ... />` JSX block, right after the existing `onInvoiceStatusChange={...}` block closes (after line 430, matching the `}}` that closes it), add:

```jsx
        onInvoiceNumberChange={async (q, val) => {
          try {
            const response = await base44.functions.invoke('quotations', { action: 'updateQuotationFlagsSafe',
              quotation_id: q.id,
              updates: { invoice_number: val }
            });
            if (response.data?.success) {
              invalidate("Quotation");
            } else {
              toast.error(response.data?.error || response.data?.message || "No se pudo actualizar el número de factura");
            }
          } catch (err) {
            toast.error(err?.response?.data?.error || err?.message || "No se pudo actualizar el número de factura");
          }
        }}
```

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Quotations.jsx
git commit -m "feat: wire invoice_number inline edit to updateQuotationFlagsSafe"
```

---

### Task 10: Final verification and deploy status check

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: exits 0, no errors.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: exits 0, 0 errors.

- [ ] **Step 3: RLS validation**

Run: `npm run validate:rls`
Expected: exits 0.

- [ ] **Step 4: Confirm live Base44 deploy status**

Run: `npx base44 whoami`

- If authenticated and the CLI works in this environment: confirm (re-run if needed) that `npx base44 entities push` (Task 3) and `npx base44 functions deploy quotations` (Task 4) both completed successfully. If either wasn't run yet, run it now.
- If the CLI cannot run here (network-restricted sandbox): explicitly tell the user, in plain terms, that the code is committed but the `invoice_number` field and the updated `updateQuotationFlagsSafe` function are **not yet live** on Baristop's Base44 backend, and that this must be deployed (`npx base44 entities push && npx base44 functions deploy quotations` from an environment with Base44 CLI network access) before the new report or the inline invoice-number editor will actually persist data — until then, saves will silently no-op per the exact failure class documented in this repo's `CLAUDE.md`.

- [ ] **Step 5: Manual QA checklist (post-deploy)**

Once both schema and function are confirmed live, manually verify in the running app (as a Baristop admin user):
1. Create or find a `converted` quotation with `invoice_status = no_requerida` and a mixed payment (part "Efectivo", part e.g. "Transferencia").
2. Open the quotation's PDF and preview — confirm untaxed items show "IVA 0%" (PDF) and the on-screen preview shows "IVA 0%" for untaxed lines while taxed lines still show a `$` amount.
3. Go to Reportes → "Facturación Público General", select the quotation's month — confirm the quotation appears with the correct non-cash amount, pre-IVA, and IVA figures.
4. Select it, click "Asignar N° de factura", enter a test number, confirm — the row should disappear from the report.
5. Go to Cotizaciones (main table) — confirm the "N° Factura" column now shows the assigned number for that quotation, and confirm the "Factura" status badge shows "Emit" (emitida).
6. Edit the "N° Factura" cell directly on an unrelated quotation (not via the report) — confirm it saves on blur.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin claude/stockflow-iva-invoicing-sht1ck
```
