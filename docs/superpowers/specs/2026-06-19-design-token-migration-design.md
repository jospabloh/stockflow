# Design Token Migration — Sub-project #1

Date: 2026-06-19
Status: Draft (awaiting user review)
Part of: "Level up StockFlow" roadmap (4 sub-projects; this is #1 of 4)

## Context

The frontend-design review found the brand was applied as ~1,399 hardcoded
Tailwind color literals (`indigo-*`, `cyan-*`) scattered across components,
instead of living in the design tokens. PR #187 fixed the *source* (the
`index.css` tokens now carry the indigo/cyan brand), but the literals remain, so:

- Re-theming still requires a find-and-replace across the whole app.
- New code keeps reintroducing literals → drift.

This sub-project retires the brand literals in favor of a centralized brand
color scale, with **no intended visual change**.

## Goal

One source of truth for the brand colors, enforced so it stays that way —
without altering a single rendered pixel.

## Constraints (non-negotiable)

- **Production-safe.** StockFlow is live, multi-tenant, on Base44. This change
  is client-side CSS/class names only. It touches **no** data, API, Base44
  schema, or RLS. (See CLAUDE.md for why backend changes are high-risk.)
- **Visually identical.** Every migrated class must resolve to the exact same
  color it does today. Verified by screenshot parity, not by eye-balling code.
- **Incremental & reversible.** Shipped page-group by page-group behind draft
  PRs, each independently revertable.

## Scope

### In scope
- `indigo-{50..950}` (bg/text/border/ring/from/to/via/shadow + `/opacity`) →
  `brand-{50..950}` equivalents.
- `cyan-{50..950}` → `accent-{50..950}` equivalents.
- A lint guard forbidding **new** raw `indigo-`/`cyan-` utility classes.

### Out of scope (YAGNI — deliberately left as literals)
- Status/semantic colors: `emerald`/`green` (success), `amber`/`yellow`
  (warning), `red`/`rose` (danger), `orange` (pending), `blue`/`purple` (chart
  categories). These encode meaning, not brand, and migrating them adds visual
  risk with no theming payoff.
- Neutral grays (`slate-*`) — high churn, low value; a candidate for a later
  pass, not this one.
- The `index.css` token values themselves (already correct from PR #187).

## Approach: shade-preserving brand scale (Approach B)

1. **Define the scales.** Add a `brand` color scale to `tailwind.config.js`
   whose `50..950` values are exactly Tailwind's current `indigo` hex values, and
   an `accent` scale equal to Tailwind's `cyan` hex values. The config is already
   a single file, so it is itself the one retheme point — no CSS-variable
   indirection needed (keep it simple).
   - Note: the existing semantic tokens `--brand`/`--brand-2` (single hues) stay;
     this adds the full numeric *scales* used by utilities.
2. **Mechanical rename.** `indigo-<shade>` → `brand-<shade>`,
   `cyan-<shade>` → `accent-<shade>`, preserving shade and any `/opacity`
   suffix. Because the resolved hex is identical, output is pixel-for-pixel the
   same.
3. **Guard.** Add an ESLint rule (or extend `eslint-rules/`) that flags raw
   `indigo-`/`cyan-` class strings in JSX, so drift can't return.

### Rejected alternatives
- **A — collapse to `primary`/`brand-2` via opacity:** changes shades app-wide;
  unacceptable visual-diff risk for a "don't break prod" goal.
- **C — lint guard only:** leaves 1,399 literals in place indefinitely.

## Migration mechanics & safety

- The rename is **not** a blind global `sed`. Risks to control:
  - Substring false positives (`indigo` inside comments, strings, or words).
  - Dynamic class construction (template literals, `cva` variants, lookup maps
    like `StatCard`'s `colors` object).
  - Arbitrary values (`bg-[#6366f1]`) — out of scope unless trivially the brand.
- Therefore: migrate in **page-group batches** (e.g. dashboard, products,
  quotations, settings, shared `ui/`), each batch:
  1. enumerate occurrences, 2. apply renames, 3. `npm run build` + `lint`,
  4. screenshot-diff the affected screens (light + dark) against `main`,
  5. open a draft PR for that batch.
- Subagent-driven: one batch per subagent, with a review pass, to keep each
  change small and in-context.

## Success criteria

- Zero raw `indigo-`/`cyan-` utility classes remain in `src/` (lint guard green).
- `brand-*` / `accent-*` scales resolve to the identical hex values as before.
- Screenshot parity on dashboard, products, quotations, reports (light + dark):
  no perceptible difference.
- `npm run build`, `npm run lint`, `npm run validate:rls`, and CI all green.
- Re-theming demo: changing the `brand` scale in one place visibly retints the
  whole app (proves the centralization).

## Testing

- **Visual:** Playwright screenshot harness (same approach used to verify #187),
  per page-group, light + dark, compared to the pre-migration render.
- **Static:** build + eslint (including the new guard rule) + existing RLS guard.
- No unit-test changes expected (pure presentational rename).

## Rollout

- Branch per batch off the current working branch; draft PR each; merge in order.
- Lint guard lands in the **last** batch (once the tree is clean) so CI doesn't
  fail mid-migration.

## Open questions

- None blocking. Slate/neutral migration is explicitly deferred to a possible
  later sub-project.
