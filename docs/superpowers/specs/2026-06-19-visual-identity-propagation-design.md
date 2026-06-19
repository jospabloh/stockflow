# Visual Identity Propagation — Sub-project #2

Date: 2026-06-19
Status: Draft (awaiting user review)
Part of: "Level up StockFlow" roadmap (2 of 4)

## Context

PR #187 gave the dashboard a full visual identity (display headings, IBM Plex
Mono tabular figures, the InventoryPulse signature). PR #191 centralized the
brand into `brand`/`accent` tokens app-wide. But the identity did **not**
propagate: Products has zero tabular/mono numbers, tables and reports barely
any, and ~19+ money/stock figures across those areas render in plain
proportional body font (columns don't align; nothing reads as "the same app"
as the dashboard).

This sub-project propagates the numeric + typographic identity to the remaining
high-traffic surfaces — **consistency and craft only, no new signature
elements** (the dashboard hero stays the one bold place).

## Goal

Every money/stock/quantity/percentage figure across Products, Quotations,
Reports, and the shared data tables reads as deliberate and aligns in columns,
so the whole app feels as intentional as the dashboard.

## Constraints

- **Production-safe.** Client-side className/typography only. No data, API,
  Base44 schema, RLS, or logic changes.
- **No layout breakage.** Tabular figures are equal-width and generally narrow
  variation, but verify no table reflow, truncation, or mobile overflow.
- **This is an intentional visual change** (unlike #1). Success = "looks
  deliberate and aligned," verified by screenshots — not pixel parity.
- **Restraint.** No new hero/banner/signature elements; no layout rethink. Only
  typographic treatment of existing content.

## The two-tier numeric rule (the core decision)

- **In-row table cells** (dense numeric columns: price, stock, qty, line
  totals): add the existing `tabular` class (sans, `font-variant-numeric:
  tabular-nums`). Keeps body font + density, just aligns digits. Avoids the
  width blow-up and mobile-overflow risk of switching dense cells to mono.
- **Emphasized figures** (table footer/grand totals, Reports KPI card values,
  detail-view/dialog headline amounts): use `font-mono tabular` — echoes the
  dashboard's StatCard/hero treatment for the figures that deserve emphasis.

This gives a coherent rule: mono = "headline number you're meant to notice,"
tabular-sans = "data in a column." Both come from infrastructure that already
exists (`.tabular` in index.css; `font-mono` from the Tailwind config).

## Scope

### In scope (apply the two-tier rule)
- `src/components/tables/**` — numeric columns + total rows.
- `src/components/products/**` and `src/pages/Products*` — price/stock/qty in
  lists, cards, and the product detail/form read-outs.
- `src/components/quotations/**` and `src/pages/Quotations*` — line prices,
  quantities, subtotals/totals, balance figures.
- `src/components/reports/**` and `src/pages/Reports.jsx` — KPI card values
  (mono) and table cells (tabular).
- Numbers covered: currency (`$…`), stock/quantity counts, percentages.

### Out of scope (YAGNI)
- Dates/times (alignment benefit is marginal; leave to avoid scope creep).
- Any layout, spacing, or component-structure change.
- New headers, eyebrows, banners, or signature elements (that was the rejected
  "light page headers" depth option).
- The dashboard (already done) and surfaces outside the four areas above.
- Copy/empty-state rewrites (separate concern; only fix an empty state if a
  touched number sits inside one and is obviously broken).

## Approach

Mechanical-with-judgment className additions, per area, subagent-driven (same
rhythm as #1). For each numeric display the implementer: identifies whether it
is an in-row cell (→ `tabular`) or an emphasized figure (→ `font-mono tabular`),
adds the class to the existing element, and changes nothing else.

## Success criteria

- Money/stock/qty/percentage figures in the four areas carry the correct tier
  class; columns of numbers visually align.
- `npm run build`, `npm run lint`, `npm run validate:rls`, CI all green.
- Screenshot review (light + dark, desktop + mobile width) of Products list,
  Quotations list/editor, and Reports: figures aligned, no reflow/truncation/
  overflow, identity reads consistently with the dashboard.

## Testing

- **Visual:** Playwright harness — render the touched surfaces (or representative
  components in isolation, as in #187) at desktop + 375px mobile width, light +
  dark; confirm alignment and no overflow.
- **Static:** build + lint + RLS guard.

## Rollout

- One area per batch (tables → products → quotations → reports), each its own
  commit; per-batch build/lint; one consolidated visual review at the end;
  draft PR.

## Open questions

- None blocking.
