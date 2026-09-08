---
name: board-ui-review
description: UI/UX and accessibility guidance for the UOB IT PMO Kanban board (index.html) — colour, type, spacing, focus, keyboard paths, responsive layout, and pre-hand-off review. Use when adding or restyling any visible element, when the board "doesn't look right", or before handing a visual change back.
---

# UI/UX for this board

A dense internal PMO tool rendered from one file, no framework, no icon library, no web fonts.
Generic design-system advice has to be translated before it applies — and a few common rules are
already answered by the hard constraints in `CLAUDE.md`. Read `references/tokens.md` for the
actual palette, spacing scale and **measured** contrast ratios before choosing any colour.

## Priority order

Work down this list; the top three are where regressions actually hurt.

1. **Accessibility** — contrast, keyboard reachability, visible focus, accessible names.
2. **Interaction & feedback** — every action visibly acknowledged; no dead-end controls.
3. **Layout & responsive** — the 768px stack, no horizontal page scroll.
4. **Colour & type** — reuse tokens, never invent hex values in a rule.
5. **Density & rhythm** — the 4/8px spacing scale.
6. **Motion** — currently none; see below before adding any.

## What the file already does right — do not undo it

- **A global `:focus-visible` ring** (3px `--blue-500`, 2px offset). Never remove an outline
  without replacing it with something equally visible. Measured 3.97:1 against the canvas, which
  clears the 3:1 non-text threshold.
- **Colour is never the only channel.** Priority is a coloured pill *with a text label*, and the
  card's left edge repeats it. Overdue is a badge, not just red text. Any new status signal must
  carry a text or shape channel too.
- **A `.visually-hidden` utility** for screen-reader-only text, plus `aria-live` regions for
  toasts and the filter result line. New async feedback announces through the existing live
  region rather than a new one.
- **Inline validation** — error text under each field, `aria-describedby`/`aria-invalid` wired
  up, and focus moved to the first invalid field. This is a constraint (`no alert()/confirm()`)
  *and* the better pattern; keep errors adjacent to their field, never collected at the top.
- **Inline delete confirmation** rendered from `state.pendingDeleteId`, with focus moved onto the
  confirm button. It survives a re-render because it lives in state.

## Translating the usual rules to this project

- **"No emoji as icons"** — the real rule is *structural icons must be vector and themeable*.
  Here the no-external-resources constraint rules out an icon library, so **inline SVG is the
  default** for anything structural. A Unicode glyph is acceptable only for decoration or where
  a text label sits beside it, and it must be `aria-hidden="true"` with the meaning carried by
  adjacent text or an `aria-label`. Never let a glyph be the sole carrier of meaning.
- **"Body text ≥16px"** — this board runs 14px/1.45 deliberately; a card wall is a data-dense
  surface and 14px is a defensible baseline for it. The rule that still binds: **nothing below
  12px may carry meaning a user must read**, and the 11px sizes in the file are at that edge —
  keep them for supporting metadata with strong contrast, never for the only copy of a fact.
- **"44×44px touch targets"** — this is a desktop-first pointer UI, so the touch minimum applies
  to the sub-768px layout. Below that breakpoint the "Move ▸" control, the delete affordance and
  the confirm Yes/No buttons need real hit area and ≥8px separation; `.confirm-yes` and
  `.confirm-no` sitting adjacent are the easiest pair to mis-tap.
- **Dark mode** — the file commits to a single light theme and defines no
  `prefers-color-scheme` block. That is a valid choice; do not half-add dark mode by theming one
  component. Either leave it, or token-swap the whole `:root` in one change.
- **Motion** — there are currently **no** CSS transitions or animations in the file. Anything
  added must (a) animate `transform`/`opacity` only, never `width`/`height`/`top`, and
  (b) ship with a `@media (prefers-reduced-motion: reduce)` block in the same edit. Do not add
  motion to drag-and-drop feedback without it.

## Layout

One breakpoint: `@media (max-width: 768px)`, where columns stack. Check both sides of it.
The board scrolls **inside** its own container — the page body must never scroll horizontally.
Columns carry `min-height: 180px` so an empty column stays a visible drop target; keep that,
because an empty column that collapses is an unusable drag destination.

## Keyboard and pointer parity

Drag-and-drop is not accessible on its own, which is why the **"Move ▸" select exists as the
keyboard path**. Every drag-only capability needs an equivalent keyboard route. When you add an
interaction, walk it with Tab/Enter/Escape and confirm: focus lands somewhere sensible after the
action, focus is never trapped, and the change is announced through the live region.

## Before handing back a visual change

Run through this and report what you actually checked:

- [ ] Colours come from tokens in `:root`; nothing new fails the ratio table in
      `references/tokens.md`.
- [ ] Spacing uses the `--s-*` scale.
- [ ] Every interactive element is Tab-reachable and shows the focus ring.
- [ ] Every icon-only or glyph-only control has an accessible name; decorative glyphs are
      `aria-hidden="true"`.
- [ ] No meaning conveyed by colour alone.
- [ ] Nothing below 12px carries required information.
- [ ] No `!important` (a hard constraint) — fix specificity instead.
- [ ] Layout holds at ~1280px, ~900px and ~375px; no horizontal body scroll.
- [ ] Any new motion respects `prefers-reduced-motion`.

**Then say what you could not check.** Rendering, drop-target highlighting, focus-ring
visibility and the responsive stack are only confirmable in a browser (`open index.html`) —
CSS changes are invisible to the JS harness in the `board-change` skill. Claiming a visual
change is "verified" from a passing parse check is a false report; run the browser check or
name it as outstanding.
