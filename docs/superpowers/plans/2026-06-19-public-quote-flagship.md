# Public Quote Flagship — Implementation Plan

> Execution: inline (executing-plans) with Playwright visual iteration by the controller, then a final whole-file review subagent. Single cohesive design file.

**Goal:** Redesign `src/pages/PublicQuotation.jsx` into a polished, business-branded quote document per the spec, presentational-only.

**Tech:** React/Vite, Tailwind v4, existing fonts (Space Grotesk / IBM Plex Sans / IBM Plex Mono) and `.tabular` utility. Dynamic accent via inline `style` from `biz.primary_color`.

## Global Constraints
- Presentational only: do NOT change `getPublicQuotation`/`respondToPublicQuotation`, data shape, or any flow/logic. Preserve every status branch and both actions and the viral footer.
- Page stays light (document); independent of app dark mode.
- Works for any `primary_color` (luminance-aware text) and when logo/notes/footer/tax/valid_until are absent.
- No raw `indigo-`/`cyan-` literals; neutral utilities + inline style for the dynamic accent. Build + lint + validate:rls green.

## Steps (inline; commit at the end as one cohesive change)

- [ ] **1. Accent helpers.** Add pure helpers at top of file: `readableTextOn(hex)` (relative-luminance → `#FFFFFF`/`#0F172A`) and `tint(hex, alpha)` (rgba string for accent-tinted surfaces). Keep `formatMXN`, `isExpired`, `STATUS_CONFIG`.
- [ ] **2. Masthead band.** Accent background (`style backgroundColor: accent`), `readableTextOn(accent)` foreground; logo + business name (Space Grotesk) + contact; right eyebrow `COTIZACIÓN` + folio (mono).
- [ ] **3. Meta strip.** Para (client), issue date, válida hasta, status chip (positive statuses tinted with accent; cancelled = neutral/danger).
- [ ] **4. Items list.** Each row: product name (medium) + optional description (muted) + `qty × unit price` (mono); right-aligned line total (mono). Hairline separators.
- [ ] **5. Totals.** Subtotal + IVA rows (mono, right-aligned), then accent-tinted Total panel with large mono total and Space Grotesk "Total" label.
- [ ] **6. Notes + footer text** (conditional, unchanged content).
- [ ] **7. Action zone + states.** Primary `Aprobar cotización` (accent bg, readable text, full-width) + secondary `Rechazar`; expired banner; accepted → clean warm confirmation (accent check + "qué sigue"); rejected → courteous; keep `responding` disabled states.
- [ ] **8. Error/not-found + loading.** Keep `FullPageLoader`; redesign error state to the document palette with the StockFlow CTA, directional copy.
- [ ] **9. Sticky StockFlow footer.** Retain, refined to the neutral palette.
- [ ] **10. Quality floor.** Visible focus on buttons/links, semantic headings, logo alt, sufficient contrast.
- [ ] **11. Verify.** `npm run build && npm run lint && npm run validate:rls` → 0. Playwright: render mock data across states (sent/expired/accepted/rejected/not-found) and two brand colors (one dark e.g. `#0F766E`, one light e.g. `#FACC15`), desktop + 375px; review screenshots; iterate. Remove harness (never commit).
- [ ] **12. Commit + push + final review subagent (opus) + draft PR.**

## Self-Review
- Spec coverage: palette/type/layout/signature/states all mapped to steps 1–9; quality floor step 10; verification step 11; constraints honored (presentational, light-only, any-hue, lint). ✓
- No placeholders; helpers and step content concrete.
