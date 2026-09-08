# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page IT Project Management Kanban board for a fictional "UOB IT PMO" — an internal
demo / training tool, not a real system. The entire application is one file: `index.html`
(markup + one `<style>` block + one `<script>` block). There is no git repo, no `package.json`,
no dependencies and no source tree.

## Hard constraints

These are product requirements, not stylistic preferences. Several of them look like defects or
missing features from inside the code, so check here before "fixing" one.

- **Vanilla HTML/CSS/JS only.** No React, Vue, jQuery, Tailwind, bundler, build step or npm.
- **One file.** All markup, styles and script stay in `index.html`. Do not split out `.css`/`.js`.
- **No external resources.** No CDN, no web fonts, no image files. System font stack; inline SVG or
  Unicode glyphs for icons. The FormSubmit endpoint is the only URL the file may contain.
- **No persistence, deliberately.** No `localStorage`, `sessionStorage`, IndexedDB, cookies or any
  storage API. A refresh resetting the board to seed data is intended behaviour and is announced by
  the notice in the header. Do not add persistence as an improvement.
- **Must run from `file://`** by double-clicking. No server.
- **No UOB branding.** Neutral "UOB IT PMO" text wordmark and a generic corporate blue palette only —
  no real logo, trademark, or imitation of an official UOB system. The header glyph and footer
  disclaimer exist for this reason.
- **No `alert()` or `confirm()`.** Validation uses inline error text under each field; delete uses an
  inline "Delete? Yes / No" row rendered inside the card.
- **No `!important`** in the CSS.

## Architecture

### State and the render contract

`state` (line 841) is the single source of truth: `{ tasks, filters, idCounter, pendingDeleteId }`.
The invariants that hold the app together:

- **`renderBoard()` is the only function that writes card DOM.** Never mutate a card's contents
  directly from an event handler — change `state` and re-render.
- **Every mutator ends in `renderBoard()`** — `addTask()`, `moveTask()`, `deleteTask()`, and each
  filter handler. Adding a new mutator means following the same shape.
- **`pendingDeleteId` lives in state, not the DOM.** The inline delete confirmation is rendered from
  it, which is why it survives a re-render.
- **Column listeners are bound once** (`bindColumnEvents()`, on the static `.column` elements);
  **card listeners are re-bound after every render** (`bindCardEvents()`, called at the end of
  `renderBoard()`) because cards are recreated as HTML strings. Card *button* and *select* handlers
  are delegated on `#board` in `bindEvents()` and are bound once.

Flow: `init()` → `seedTasks()` → `bindColumnEvents()` → `bindEvents()` → `renderBoard()`.
`renderBoard()` → `applyFilters()` → `renderCard()` per task → `renderSummary()` +
`renderFilterResult()` → `bindCardEvents()`.

Note the deliberate asymmetry: **column count badges and the filter line reflect the filtered
subset; the header summary strip always counts the full `state.tasks`.**

### Escaping

Cards are built as HTML strings, so `escapeHtml()` is load-bearing. There are exactly three
`innerHTML` assignment sites (in `renderBoard()`, `renderSummary()` and `showToast()`), and every
user-supplied value reaching them must pass through `escapeHtml()` first — including values
interpolated into attributes such as `aria-label` and `data-id`. Any new markup-building code
inherits this rule.

### Dates

Due dates are `YYYY-MM-DD` strings. `parseISODate()` and `toISODate()` build **local-midnight**
dates deliberately — using `new Date(iso)` or `toISOString()` reintroduces UTC drift that shifts due
dates by a day in some timezones. `isOverdue()` is `due < todayMidnight() && status !== "Done"`.
Seed due dates are generated with `daysFromToday(±n)` rather than hardcoded, so the Overdue badge
demonstrates correctly whenever the file is opened.

### FormSubmit

`FORMSUBMIT_ENDPOINT` (line 830) is the one place the destination email is configured; it ships with
a `YOUR_EMAIL@example.com` placeholder. FormSubmit requires one-time activation — the first request
sends a confirmation email to that address, and nothing delivers until its link is clicked.

**With the placeholder in place, `notifyNewTask()` always fails, and the amber "Card added locally —
email notification failed" toast is the correct, expected outcome.** That is the optimistic-UI path
working, not a bug. `handleSubmit()` adds the card to the board and resets the form *before* the
fetch; the fetch is wrapped in `try`/`catch`/`finally` so a FormSubmit failure can never break the
board or leave the submit button stuck in its "Sending…" state.

## Verifying changes

There is no test runner and **Node is not installed on this machine.** Use the system
JavaScriptCore binary, which is present at
`/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc`.

Parse-check the script block (wrapping in `new Function` keeps DOM references from executing):

```sh
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
T=$(mktemp -d)
awk '/^<script>/{f=1;next} /^<\/script>/{f=0} f' index.html > "$T/app.js"
printf 'try { new Function(readFile("%s/app.js")); print("PARSE OK"); } catch (e) { print("ERROR: " + e); }\n' "$T" > "$T/check.js"
"$JSC" "$T/check.js"
```

To exercise the logic, extract `app.js` the same way, then evaluate it under a small fake-DOM stub
(`document.getElementById`/`querySelector` returning stub elements with `addEventListener`,
`classList`, `value`, `textContent`, `innerHTML`, `closest`, `focus`, `reset`) and append a `return`
statement exposing the internals you want to assert on. That makes `seedTasks()`, `applyFilters()`,
`isOverdue()`, `escapeHtml()`, `renderCard()` and the mutators directly testable without a browser.
When writing assertions about `renderCard()` output, be precise: naive substring checks like
`indexOf('"><')` or `indexOf("onerror=")` match legitimate tag boundaries and *already-escaped* text
and will report false failures.

Drag-and-drop gestures and layout can only be confirmed in a browser (`open index.html`): drop-target
highlight, the keyboard-only "Move ▸" path, the responsive stack below 768px, and visible focus rings.

## Grep checks worth running after edits

```sh
grep -niE "localStorage|sessionStorage|indexedDB|document\.cookie|!important|alert\(|confirm\(" index.html
grep -oE "https?://[^\"' )]+" index.html   # should only ever print the formsubmit.co endpoint
grep -n "innerHTML" index.html             # should stay at 3 sites, all escaped
```
