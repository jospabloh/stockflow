# Public Quote Page — Flagship Redesign (Sub-project #3)

Date: 2026-06-19
Status: Draft (awaiting user review)
Part of: "Level up StockFlow" roadmap (3 of 4)

## Context

`src/pages/PublicQuotation.jsx` is the customer-facing shared quote — the page a
client/prospect opens from a link. It is the most generic surface in the app
(raw `gray-*`, no display type, no tabular figures, a plain card) yet the highest
brand-impression surface, because external people see it. It is already
per-tenant branded via `biz.primary_color`, purely presentational, and
unauthenticated. This sub-project makes it an excellent, trustworthy **quote
document** — end to end, including its states.

## Goal

A client opening the link immediately perceives a professional, branded quote,
can read every figure clearly, and can confidently approve it.

## Brief (frontend-design grounding)

- **Subject:** a price quotation (cotización) sent by a small business to its
  client, Mexican-Spanish, MXN.
- **Audience:** the recipient client/prospect — often on a phone, non-technical.
- **The page's one job:** let the client review the quote with full clarity and
  approve (or reject) it — while reflecting the issuing business's brand.
- Whose brand leads: the **business's** (`primary_color`, logo, name, footer).
  StockFlow appears only as a quiet "powered by" line.

## Design plan (token system)

**Color** — a light "paper" document palette; the business `primary_color` is the
single accent (any hue must work).
- canvas `#F6F7F9`, paper `#FFFFFF`, ink `#0F172A` (slate-900), muted ink
  `#64748B` (slate-500), hairline `#E5E7EB`.
- accent = `biz.primary_color` (fallback `#4F46E5`). Used for: masthead band,
  the Total panel tint, the primary CTA, section eyebrows, positive status chip.
- **Luminance-aware foreground:** a tiny helper `readableTextOn(hex)` returns
  `#FFFFFF` or `#0F172A` by relative luminance, so masthead/CTA text stays legible
  for both dark and light brand colors (today's white-on-color breaks for light hues).
- The page stays **light** (a document); it does not follow app dark mode.

**Type** (already loaded app-wide):
- Display — Space Grotesk: business name, the "Cotización / #folio" masthead, the
  Total label.
- Body — IBM Plex Sans.
- Mono + `tabular` — IBM Plex Mono for EVERY monetary figure and quantity
  (unit price, line total, subtotal, IVA, total) so columns align like a real invoice.

**Layout** (document, single column, mobile-first, max-width ~720px):
1. **Masthead band** (accent bg, luminance-aware text): logo + business name +
   contact; right side eyebrow `COTIZACIÓN` + folio in mono.
2. **Meta strip:** Para (client), issue date, válida hasta, status chip.
3. **Items:** itemized rows — name + description, `qty × unit price` (mono),
   right-aligned line total (mono); subtle separators.
4. **Totals:** subtotal, IVA, then a prominent accent-tinted **Total** panel with
   the figure large in mono.
5. **Notes** + business **footer text** (when present).
6. **Action zone:** primary `Aprobar cotización` (accent, full-width, confident)
   + secondary `Rechazar`.
7. **States as designed moments:** expired banner; **accepted → clean warm
   confirmation** (accent check + "qué sigue", NO confetti per decision);
   rejected → courteous; not-found/error → directional with the StockFlow CTA.
8. Quiet sticky **"Generada con StockFlow — Pruébalo gratis"** footer (retained).

**Signature:** the masthead + accent Total panel + confident accept CTA together
make it read as a real, professional quote. The accept moment is a clean designed
confirmation (the user chose no confetti).

## Constraints

- **Presentational only.** Do NOT change `getPublicQuotation` /
  `respondToPublicQuotation`, the data contract, or any logic/flow. Preserve every
  state and both actions. Keep the viral footer.
- **Production-safe.** Unauthenticated, self-contained page; no Base44/RLS/data.
- Works for any `primary_color` hue (luminance-aware text); graceful when logo,
  notes, footer, tax, or valid_until are absent.
- No raw `indigo-`/`cyan-` literals (lint guard). Use neutral utilities/tokens and
  inline styles for the dynamic accent color.

## Success criteria

- The page reads as a polished, branded quote document; figures align in mono;
  the business brand leads, StockFlow is a quiet footer.
- Verified by screenshots: desktop + 375px mobile, light; with a DARK brand color
  and a LIGHT brand color (luminance text correct in both); plus the expired,
  accepted, rejected, and not-found states.
- `npm run build`, `npm run lint`, `npm run validate:rls`, CI green.
- All existing behavior intact (approve/reject calls, every status branch).

## Testing

- Playwright harness rendering the page with mock quotation data across states and
  two contrasting brand colors, desktop + mobile, captured and reviewed by the
  controller (inline execution with visual iteration).
- Static: build + lint + RLS guard.

## Rollout

- One feature branch, inline execution with visual iteration, final whole-file
  review subagent (opus), draft PR.

## Out of scope (YAGNI)

- The internal list page, authoring flow, PDF generation (`QuotationPDF.jsx`).
- Online payment, new backend capabilities, data-model changes.
- Dark mode for the public page (a quote is a light document).

## Open questions

- None blocking.
