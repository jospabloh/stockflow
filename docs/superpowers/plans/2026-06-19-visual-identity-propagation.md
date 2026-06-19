# Visual Identity Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the two-tier numeric typography rule to every money/stock/qty/percentage figure in Products, Quotations, Reports, and shared tables, so the whole app reads as deliberately as the dashboard.

**Architecture:** Pure className additions on existing numeric elements. No layout, logic, or data changes. Per-area batches, subagent-driven, build/lint each, one visual review at the end.

**Tech Stack:** React/Vite, Tailwind v4. Uses existing utilities: `.tabular` (defined in `src/index.css`: `font-variant-numeric: tabular-nums`) and `font-mono` (IBM Plex Mono, from `tailwind.config.js`).

## Global Constraints

- Client-side typography only: touch NO data, API, Base44 schema, RLS, or logic. No layout/spacing/structure changes. No new headers/banners/signature elements.
- **Two-tier rule:**
  - In-row table cells (price/stock/qty/line-total columns) → add class `tabular`.
  - Emphasized figures (table footer/grand totals, Reports KPI card values, detail-view/dialog headline amounts) → add classes `font-mono tabular`.
- Only numbers: currency (`$…`), stock/quantity counts, percentages. NOT dates/times.
- If an element already has `font-mono` and/or `tabular`, leave it (don't duplicate).
- Intentional visual change — success is "aligned & deliberate," confirmed by screenshots, NOT pixel parity. Per batch: `npm run build` and `npm run lint` must pass.

---

### Task 1: Shared data tables (`src/components/tables/`)

**Files:** Modify numeric cells/totals under `src/components/tables/**`.

- [ ] **Step 1: Enumerate numeric displays**

Run: `grep -rnE "toLocaleString|\\bstock\\b|qty|quantity|total|price|\\$" src/components/tables`
Read each hit; classify as in-row cell vs emphasized total.

- [ ] **Step 2: Apply the two-tier rule**

For each numeric cell, add `tabular` to its element's className. For footer/grand-total figures, add `font-mono tabular`. Add to the element that directly wraps the number (a `<span>`/`<td>`/`<p>`); do not restructure markup. Skip elements that already have the class.

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`  → both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/tables && git commit -m "Tabular figures in shared data tables"
```

---

### Task 2: Products (`src/components/products/`, `src/pages/Products*`)

**Files:** `src/components/products/**`, `src/pages/Products.jsx`, `src/pages/Products/**`.

- [ ] **Step 1: Enumerate**

Run: `grep -rnE "toLocaleString|\\bstock\\b|min_stock|qty|quantity|price|purchase_price|sale_price|\\$" src/components/products src/pages/Products.jsx src/pages/Products`
Read each; classify in-row vs emphasized.

- [ ] **Step 2: Apply the two-tier rule**

In-row product list/table figures (stock, prices) → `tabular`. Emphasized figures in the product detail/form read-outs (e.g. a headline price or computed margin shown prominently) → `font-mono tabular`. No markup restructure; skip already-classed.

- [ ] **Step 3: Build + lint** — `npm run build && npm run lint` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/products src/pages/Products.jsx src/pages/Products && git commit -m "Tabular/mono figures in Products"
```

---

### Task 3: Quotations (`src/components/quotations/`, `src/pages/Quotations*`)

**Files:** `src/components/quotations/**`, `src/pages/Quotations.jsx`, `src/pages/Quotations/**`.

- [ ] **Step 1: Enumerate**

Run: `grep -rnE "toLocaleString|qty|quantity|subtotal|total|price|balance|saldo|\\$" src/components/quotations src/pages/Quotations.jsx src/pages/Quotations`
Read each; classify.

- [ ] **Step 2: Apply the two-tier rule**

Line-item price/qty cells → `tabular`. Subtotal/total/balance headline amounts (quote editor totals, summary) → `font-mono tabular`. No restructure; skip already-classed.

- [ ] **Step 3: Build + lint** — exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/quotations src/pages/Quotations.jsx src/pages/Quotations && git commit -m "Tabular/mono figures in Quotations"
```

---

### Task 4: Reports (`src/components/reports/`, `src/pages/Reports.jsx`)

**Files:** `src/components/reports/**`, `src/pages/Reports.jsx`.

- [ ] **Step 1: Enumerate**

Run: `grep -rnE "toLocaleString|total|count|percent|%|price|\\$" src/components/reports src/pages/Reports.jsx`
Read each; classify.

- [ ] **Step 2: Apply the two-tier rule**

Report table cells → `tabular`. KPI/summary card values (the big headline numbers) → `font-mono tabular`. Chart axis ticks and recharts internals are NOT className targets — skip. No restructure; skip already-classed.

- [ ] **Step 3: Build + lint** — exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports src/pages/Reports.jsx && git commit -m "Tabular/mono figures in Reports"
```

---

### Task 5: Visual review + PR

- [ ] **Step 1:** Controller boots the dev server and uses a throwaway Playwright harness to render representative components from each area (or the isolated component gallery as in #187) at 1280px and 375px widths, light + dark. Screenshot.
- [ ] **Step 2:** Inspect screenshots: numeric columns align; emphasized figures read as mono headlines; NO table reflow, truncation, or mobile overflow. If any overflow/reflow, dispatch a fix to drop that specific cell back to `tabular`-only (no mono) or revert that element.
- [ ] **Step 3:** Run `npm run build && npm run lint && npm run validate:rls` → all exit 0. Remove harness files (never commit them).
- [ ] **Step 4:** Open a draft PR for the branch.

## Self-Review

- **Spec coverage:** tables (T1), products (T2), quotations (T3), reports (T4) ✓; two-tier rule applied per task ✓; visual + static verification (T5 + per-batch build/lint) ✓; no new signature elements / no layout change (Global Constraints) ✓; dates and out-of-scope areas excluded ✓.
- **Placeholder scan:** commands and the two-tier rule are concrete; no TBD/TODO.
- **Consistency:** the `tabular` vs `font-mono tabular` distinction is identical across all tasks and the Global Constraints block.
