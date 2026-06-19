# Design Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 502 hardcoded `indigo-*`/`cyan-*` Tailwind literals with a centralized `brand`/`accent` color scale, with zero visual change.

**Architecture:** Add `brand` (= current Tailwind indigo) and `accent` (= current Tailwind cyan) scales to `tailwind.config.js`, then mechanically rename `indigo-<n>`→`brand-<n>` and `cyan-<n>`→`accent-<n>` (preserving shade + opacity) batch by batch, verifying pixel parity per batch. A lint guard forbids new raw literals once the tree is clean.

**Tech Stack:** Tailwind CSS v4 (bridged JS config via `@config`), React/Vite, ESLint (flat config + custom rules in `eslint-rules/`), Playwright (visual parity).

## Global Constraints

- Client-side only: touch NO data, API, Base44 schema, or RLS.
- Every migrated class resolves to the identical hex it does today (pixel-parity).
- `npm run build`, `npm run lint`, `npm run validate:rls` must stay green after every task.
- Status colors (`emerald/green/amber/yellow/red/rose/orange/blue/purple`) and `slate-*` are OUT of scope — do not touch.
- Migrate only literal utility classes of the form `(bg|text|border|ring|from|to|via|shadow|fill|stroke|ring-offset|divide|outline|decoration|accent|caret)-(indigo|cyan)-<shade>` plus optional `/<opacity>`. Do NOT touch the words "indigo"/"cyan" in comments, prop values, or string content.
- Exact Tailwind reference values (hex), used verbatim for the scales:
  - indigo: 50 `#eef2ff` · 100 `#e0e7ff` · 200 `#c7d2fe` · 300 `#a5b4fc` · 400 `#818cf8` · 500 `#6366f1` · 600 `#4f46e5` · 700 `#4338ca` · 800 `#3730a3` · 900 `#312e81` · 950 `#1e1b4b`
  - cyan: 50 `#ecfeff` · 100 `#cffafe` · 200 `#a5f3fc` · 300 `#67e8f9` · 400 `#22d3ee` · 500 `#06b6d4` · 600 `#0891b2` · 700 `#0e7490` · 800 `#155e75` · 900 `#164e63` · 950 `#083344`

---

### Task 0: Define the `brand` and `accent` scales

**Files:**
- Modify: `tailwind.config.js` (colors block, alongside existing `brand`/`brand-2` single-hue tokens)

**Interfaces:**
- Produces: utility classes `brand-{50..950}` and `accent-{50..950}` for every color utility prefix, resolving to the indigo/cyan hex values above.
- Note: the existing single-hue semantic tokens (`brand.DEFAULT`, `brand-2.DEFAULT` from `--brand`/`--brand-2`) must remain. To avoid a key collision, the numeric scale is added as `brand` only if it can coexist with `brand.DEFAULT`; Tailwind allows `brand: { DEFAULT, 50..950 }`. Merge them into one object.

- [ ] **Step 1: Add the scales to the colors object**

In `tailwind.config.js`, replace the existing `brand` entry and add `accent` so they read:

```js
brand: {
  DEFAULT: 'hsl(var(--brand))',
  foreground: 'hsl(var(--brand-foreground))',
  50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
  400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
  800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
},
accent: {
  // NOTE: shadcn `accent`/`accent-foreground` semantic tokens are separate
  // (DEFAULT/foreground). Keep them; add the numeric cyan scale alongside.
  DEFAULT: 'hsl(var(--accent))',
  foreground: 'hsl(var(--accent-foreground))',
  50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
  400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
  800: '#155e75', 900: '#164e63', 950: '#083344',
},
```

(The existing `accent` entry currently only has DEFAULT/foreground — extend it, don't replace, so shadcn hover surfaces keep working.)

- [ ] **Step 2: Build to verify config is valid**

Run: `npm run build`
Expected: exit 0, no Tailwind config error.

- [ ] **Step 3: Smoke-test a generated class**

Add `<div className="bg-brand-500 text-accent-400" />` to any page temporarily, run `npm run build`, confirm the classes appear in the built CSS:
Run: `grep -rl "bg-brand-500" dist/assets/*.css`
Expected: a match. Then remove the temporary div.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js
git commit -m "Add brand/accent color scales (= indigo/cyan), no usage yet"
```

---

### Task 1: Migrate shared components (`ui/`, `tables/`) — 29 literals

**Files:**
- Modify: `src/components/ui/**` (10), `src/components/tables/**` (19)
- Verify against: any page that renders these (dashboard, quotations)

**Interfaces:**
- Consumes: `brand-*`/`accent-*` scales from Task 0.
- Produces: shared components free of `indigo-`/`cyan-` literals.

- [ ] **Step 1: Capture baseline screenshots (pre-change)**

Boot dev server (`npm run dev`), use the Playwright harness (see Appendix A) to
screenshot `/preview` or the relevant rendered components to `/tmp/base-ui-*.png`.
(For shared `ui/` primitives, render a small gallery; for `tables/`, screenshot
the Quotations table.)

- [ ] **Step 2: Enumerate occurrences**

Run: `grep -rnE "(bg|text|border|ring|from|to|via|shadow|fill|stroke|ring-offset|divide|outline|decoration|accent|caret)-(indigo|cyan)-[0-9]{2,3}(/[0-9]+)?" src/components/ui src/components/tables`
Read each hit in context to confirm it is a static class (not dynamic/semantic).

- [ ] **Step 3: Apply the renames (per file, reviewed)**

For each occurrence, `indigo-<n>`→`brand-<n>` and `cyan-<n>`→`accent-<n>`,
preserving shade and any `/opacity`. Handle dynamic class maps (object/cva
lookups) by renaming the literal values inside them. Do NOT alter prop names or
strings that merely contain the word.

- [ ] **Step 4: Verify zero literals remain in this batch**

Run: `grep -rnE "(indigo|cyan)-[0-9]{2,3}" src/components/ui src/components/tables`
Expected: no output.

- [ ] **Step 5: Build + lint**

Run: `npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Visual parity check**

Re-screenshot the same views to `/tmp/post-ui-*.png` and diff against baseline
(Appendix A). Expected: no perceptible difference (identical hex → identical pixels).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui src/components/tables
git commit -m "Migrate shared ui/ + tables/ to brand/accent tokens"
```

---

### Tasks 2–6: Per-area batches (identical procedure to Task 1)

Each batch repeats **Task 1's Steps 1–7 verbatim**, changing only the target
paths and the screens screenshotted. Migrate in this order (low cross-impact
first); each ends with its own commit and visual-parity check:

- [ ] **Task 2 — Dashboard + Layout** (`src/components/dashboard`, `src/Layout.jsx`, `src/pages/Dashboard.jsx`) ~70. Screenshot: dashboard light+dark.
- [ ] **Task 3 — Products + Movements** (`src/components/products`, `src/components/movements`, `src/pages/Products*`, `src/pages/Movements*`) ~50. Screenshot: products list, movement form.
- [ ] **Task 4 — Quotations** (`src/components/quotations`, `src/pages/Quotations*`) ~50. Screenshot: quotations list + editor.
- [ ] **Task 5 — Reports + Settings + chat** (`src/components/reports`, `src/components/settings`, `src/components/chat`, `src/pages/Reports.jsx`, `src/pages/Settings.jsx`) ~100. Screenshot: reports, settings, help chat.
- [ ] **Task 6 — Remaining** (`src/components/permissions`, `src/components/license`, `src/components/petty-cash`, and all remaining `src/pages/*`) — sweep everything left. Screenshot: a sampling of the remaining pages.

After Task 6, the global check must pass:
Run: `grep -rnE "(indigo|cyan)-[0-9]{2,3}" src`
Expected: **no output** (whole tree clean).

---

### Task 7: Add the lint guard

**Files:**
- Create: `eslint-rules/no-raw-brand-color.js` (mirror the structure of `eslint-rules/registered-permission-key.js`)
- Modify: `eslint.config.js` (register the rule as `error`)

**Interfaces:**
- Consumes: a clean tree (Task 6 complete) so the rule does not fail existing code.
- Produces: CI-enforced prevention of new `indigo-`/`cyan-` literals.

- [ ] **Step 1: Write the rule**

Create `eslint-rules/no-raw-brand-color.js`: a rule that inspects `Literal` and
`TemplateLiteral` string values and reports any match of
`/\b(indigo|cyan)-[0-9]{2,3}\b/`, with message
"Use the brand/accent token (e.g. brand-500) instead of raw indigo/cyan-500."

```js
export default {
  meta: { type: "problem", docs: { description: "Disallow raw indigo/cyan utility classes; use brand/accent tokens." }, schema: [] },
  create(context) {
    const re = /\b(indigo|cyan)-[0-9]{2,3}\b/;
    const check = (node, value) => { if (typeof value === "string" && re.test(value)) context.report({ node, message: "Use the brand/accent token (e.g. brand-500) instead of raw indigo/cyan utility classes." }); };
    return {
      Literal(node) { check(node, node.value); },
      TemplateElement(node) { check(node, node.value.raw); },
    };
  },
};
```

- [ ] **Step 2: Register it in `eslint.config.js`**

Add the local rule to the plugins/rules (follow how `registered-permission-key` is wired) and set it to `"error"` for `src/**/*.{js,jsx}`.

- [ ] **Step 3: Run lint to confirm the tree is clean under the new rule**

Run: `npm run lint`
Expected: exit 0 (no violations, because Task 6 cleaned everything).

- [ ] **Step 4: Negative test the rule**

Temporarily add `const x = "bg-indigo-500";` to a source file, run `npm run lint`,
confirm it now errors, then remove the line.

- [ ] **Step 5: Commit**

```bash
git add eslint-rules/no-raw-brand-color.js eslint.config.js
git commit -m "Add lint guard forbidding raw indigo/cyan literals"
```

---

### Task 8: Re-theme proof + final verification

- [ ] **Step 1:** Temporarily change `brand-500` in `tailwind.config.js` to a clearly different hue (e.g. `#16a34a`), `npm run dev`, screenshot the dashboard — confirm the whole app retints from the one change. Revert.
- [ ] **Step 2:** Run full gate: `npm run build && npm run lint && npm run validate:rls`. Expected: all exit 0.
- [ ] **Step 3:** Confirm `grep -rnE "(indigo|cyan)-[0-9]{2,3}" src` returns nothing.
- [ ] **Step 4:** Open the PR (draft) for review.

---

## Appendix A — Playwright visual-parity harness

Per batch: render the affected screens before and after, screenshot at
`deviceScaleFactor: 2`, light + dark, and compare. Because every migrated class
resolves to the identical hex, a correct migration produces byte-near-identical
images; any visible diff means a wrong shade or an accidental semantic-color edit
— investigate before committing. (The same throwaway-harness approach used to
verify PR #187; harness files are temporary and never committed.)

## Self-Review

- **Spec coverage:** scales (Task 0) ✓; migrate all in-scope dirs (Tasks 1–6) ✓;
  lint guard (Task 7) ✓; re-theme proof + success criteria (Task 8) ✓; status/
  slate left untouched (Global Constraints) ✓; visual parity (Appendix A, every
  batch) ✓; build/lint/RLS green (Global Constraints + Task 8) ✓.
- **Placeholder scan:** no TBD/TODO; rule code and config values are concrete.
- **Type consistency:** class prefixes and the regex are consistent across
  enumeration (Task 1 Step 2), the global check (Task 6), and the lint rule
  (Task 7).
