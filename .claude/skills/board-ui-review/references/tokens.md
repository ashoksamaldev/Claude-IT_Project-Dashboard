# Design tokens in index.html, and their measured contrast

Values read from the `:root` block. **Reuse these tokens; do not introduce new raw hex values
in a rule.** If a change genuinely needs a new colour, add it as a token in `:root` with a
comment, and measure it before use.

The palette is a corporate **green**. The token names are `--brand-*`, not `--green-*`, so a
future palette change is a `:root` edit and nothing else.

## Palette

| Token | Value | Role |
|---|---|---|
| `--brand-900` | `#0a2c1d` | Field labels, deepest accent |
| `--brand-800` | `#0f4229` | Header ground; category-pill text |
| `--brand-700` | `#14563a` | Secondary-button text, Notes toggle |
| `--brand-600` | `#1a7048` | Primary action **and the focus ring** |
| `--brand-500` | `#2f9e68` | Focus ring on the dark header only; drag-over border |
| `--brand-100` | `#dcefe3` | Category pill ground; drop-target ground |
| `--brand-050` | `#f0f7f2` | Panel heads, expanded Notes ground |
| `--surface` | `#ffffff` | Cards, form |
| `--canvas` | `#eaf1ec` | Page ground |
| `--column` | `#dfe8e2` | Column ground |
| `--border` | `#c9d9cf` | **Separators only** — see below |
| `--border-strong` | `#6f8578` | **Control boundaries** — inputs, selects, secondary buttons |
| `--text` | `#12231a` | Body text |
| `--muted` | `#55655c` | Secondary text |
| `--pri-critical` / `--pri-high` / `--pri-medium` / `--pri-low` | `#c62828` `#a05a00` `#1a7048` `#62736a` | Priority pill grounds + card left edge |
| `--ok` / `--warn` / `--danger` | `#1a7048` `#a05a00` `#c62828` | Toast + status |
| `--danger-bg` / `--danger-br` | `#fdecec` `#f0b6b6` | Delete confirm row, error field ground |
| `--warn-bg` / `--warn-br` | `#fdf6ea` `#e6c893` | Over-WIP column ground and border |
| `--focus` | `var(--brand-600)` | The one place the focus-ring colour is set |

Spacing `--s-1…--s-6` = 4 / 8 / 12 / 16 / 24 / 32px. Radius 6px, `--radius-sm` 4px.
Type: body 14px / 1.45; scale in use is 10, 11, 12, 13, 13.5, 14, 15, 18px.
(10px is the `.chev` glyph on the Notes toggle only — decorative, `aria-hidden`, never
the sole carrier of meaning.)

## Measured contrast (WCAG 2.1, computed — not estimated)

Normal text needs 4.5:1; large text (≥18.66px bold or ≥24px) and non-text UI boundaries need 3:1.

| Pair | Ratio | |
|---|---|---|
| `--text` on `--surface` | 16.39 | AAA |
| `--text` on `--canvas` | 14.28 | AAA |
| `--text` on `--column` | 13.10 | AAA |
| `--muted` on `--surface` | 6.17 | AA |
| `--muted` on `--canvas` | 5.38 | AA |
| `--muted` on `--column` | 4.93 | AA |
| `--muted` on `--brand-050` | 5.67 | AA |
| white on `--brand-800` (header) | 11.47 | AAA |
| `--brand-100` on `--brand-800` (header sub) | 9.55 | AAA |
| white on `--brand-600` (primary button) | 6.08 | AA |
| `--brand-700` on `--surface` (secondary button) | 8.67 | AAA |
| `--brand-700` on `--brand-050` (Notes toggle) | 7.97 | AAA |
| `--brand-800` on `--brand-100` (category pill) | 9.55 | AAA |
| `--brand-900` on `--surface` (field labels) | 15.10 | AAA |
| white on `--pri-critical` | 5.62 | AA |
| white on `--pri-high` | 5.31 | AA |
| white on `--pri-medium` | 6.08 | AA |
| white on `--pri-low` | 5.02 | AA |
| `--warn` on `--warn-bg` (over-WIP note) | 4.94 | AA |
| `--danger` on `--danger-bg` | 4.92 | AA |
| `--focus` ring on `--canvas` | 5.29 | passes the 3:1 non-text rule |
| `--focus` ring on `--surface` | 6.08 | passes |
| `--focus` ring on `--column` | 4.86 | passes |
| `--focus` ring on `--brand-100` (drag-over) | 5.06 | passes |
| `--brand-500` ring on `--brand-800` (header override) | 3.39 | passes |
| `--border-strong` on `--surface` | 3.96 | passes |
| `--border-strong` on `--canvas` | 3.45 | passes |
| `--border-strong` on `--column` | 3.16 | passes |
| `--border-strong` on `--brand-050` | 3.64 | passes |
| `--border` on `--surface` | 1.47 | decorative only — see below |
| `--border` on `--canvas` | 1.28 | decorative only |

## The two long-standing issues, and how they were closed

Both are fixed. They are recorded here because the fixes are load-bearing and easy to
re-break by "tidying" the palette.

1. **The High-priority pill used to fail AA.** White on the old `#c77700` was 3.46:1 at 11–12px,
   where the large-text exemption does not apply. `--pri-high` is now `#a05a00` (5.31:1). The
   token also drives the card's left edge and the Blocked column rule, so those darkened with
   it — consistent, and intended. Do not lighten this token back toward amber.

2. **`--border` was doing two jobs.** At 1.28–1.47:1 it is fine for a divider and far too low
   for the edge of a control, which WCAG's non-text rule wants at 3:1. There are now two
   tokens. **`--border` separates; `--border-strong` delimits anything a user can operate** —
   text inputs, selects, textareas, `.btn-secondary`, `.icon-btn`, `.confirm-no`. A new
   interactive control takes `--border-strong`; a new hairline between sections takes `--border`.

## The focus ring is two-valued on purpose

`--focus` (`--brand-600`) clears 3:1 on every light ground in the file. It reaches only 1.89:1
on the dark header, so `.app-header :focus-visible` overrides the colour to `--brand-500`
(3.39:1). If you ever put an interactive control on another dark ground, it needs the same
treatment — a green ring that vanishes into a green header is worse than no design at all.

## Motion

Section 10 of the stylesheet holds the only motion in the file: a 120ms card hover lift and a
160ms toast entry, both `transform`/`opacity` only, both switched off under
`@media (prefers-reduced-motion: reduce)` in the same section. Anything added joins that block.
