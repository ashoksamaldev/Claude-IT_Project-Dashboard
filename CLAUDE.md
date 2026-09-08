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
- **No UOB branding.** Neutral "UOB IT PMO" text wordmark and a generic corporate green palette only —
  no real logo, trademark, or imitation of an official UOB system. The header glyph and footer
  disclaimer exist for this reason.
- **No `alert()` or `confirm()`.** Validation uses inline error text under each field; delete uses an
  inline "Delete? Yes / No" row rendered inside the card.
- **No `!important`** in the CSS.

## Architecture

### State and the render contract

`state` (line 1061) is the single source of truth:
`{ tasks, filters, idCounter, pendingDeleteId, expandedIds, celebrate, notify }`.
The invariants that hold the app together:

- **`renderBoard()` is the only function that writes card DOM.** Never mutate a card's contents
  directly from an event handler — change `state` and re-render.
- **Every mutator ends in `renderBoard()`** — `addTask()`, `moveTask()`, `deleteTask()`, and each
  filter handler. Adding a new mutator means following the same shape.
- **Transient UI state lives in state, not the DOM.** `pendingDeleteId` (inline delete confirmation),
  `expandedIds` (which cards have their Notes section open) and `celebrate` (the Done dialog) are
  all rendered *from* state,
  which is why they survive a re-render. Anything else that must outlive a render goes there too.
- **Column listeners are bound once** (`bindColumnEvents()`, on the static `.column` elements);
  **card listeners are re-bound after every render** (`bindCardEvents()`, called at the end of
  `renderBoard()`) because cards are recreated as HTML strings. Card *button* and *select* handlers
  are delegated on `#board` in `bindEvents()` and are bound once.

Flow: `init()` → `seedTasks()` → `bindColumnEvents()` → `bindEvents()` → `renderBoard()`.
`renderBoard()` → `applyFilters()` → `sortTasks()` per column → `renderCard()` per task →
`renderWipNote()` per column → `renderSummary()` (metric tiles) + `renderStatusChart()` (SVG +
hidden table) + `renderFilterResult()` → `bindCardEvents()`.

Note the deliberate asymmetry: **column count badges and the filter line reflect the filtered
subset; the header summary strip always counts the full `state.tasks`.** The WIP note is a third
case and also deliberate: it is measured against the full `state.tasks`, because a filter that
hides cards must not make an over-limit column look healthy.

### The overview: metric tiles and the status chart

`.overview` is the first row of `main.layout` and spans both columns, so the board summary leads
the page at every width. It stays first in **DOM order** on purpose: putting it there rather than
reordering with CSS `order` keeps the visual order and the tab order in agreement.

- `statusCounts()` is the single source for both the tiles and the chart, so the two can never
  disagree with each other.
- Both read the **full** `state.tasks`, never `applyFilters()`. A filter that hides cards must not
  make the board look emptier than it is; the caption under the chart says so out loud.
- The chart is a horizontal bar chart in **one** hue (`--brand-600`), not four. The job is
  comparing magnitude across four states, which wants length, not identity — four colours would
  imply the states are unrelated categories and would need a CVD-safe palette to say nothing
  extra. The hue was measured against the white widget surface, not eyeballed: it passes the
  lightness band, the chroma floor and 3:1 contrast. A sequential *ramp* was rejected because its
  light end fell to 1.54:1.
- Every bar is labelled with its value at the tip, so the chart carries no x-axis ticks and no
  gridlines — only the baseline the bars grow from. A zero-count status draws its label and a `0`
  but **no** bar, because a zero-width rounded mark renders as a stray dot.
- SVG type is specified in **viewBox units**, not pixels. The SVG scales to its box, so the
  rendered size is `13 × (box width / 340)`; the layout holds that box between roughly 310px and
  410px, keeping rendered type in the 12–15.7px range and never under the 12px floor. Changing
  `CHART.width` or the chart column width means re-checking that.
- `#chart-table` is a real `<table>`, visually hidden, carrying the exact figures. The chart is
  never the only way to read the numbers.

### The celebration dialog

Moving a task **into** Done opens `#celebrate-backdrop` — the one modal in the app. Everything
else here is deliberately non-blocking (inline field errors, the inline delete row, toasts); this
one blocks because it asks a question and then acts on the answer, which a toast cannot do.

- `state.celebrate` (`{ taskId, messageIndex }` or `null`) is the model, and
  **`renderCelebration()` is the only function that writes dialog DOM** — the same contract
  `renderBoard()` has for cards. `init()` calls it once so the DOM is a function of state from
  the first frame.
- It builds every node with `createElement`/`createTextNode` + `textContent`, so the task title
  is never parsed as markup and the dialog adds no `innerHTML` site.
- The trigger is on the **transition**, not the status: `moveTask()` opens it only when
  `newStatus === "Done"`, so a re-render or a filter change never re-opens it. `deleteTask()`
  calls `closeCelebration()` (not a bare `state.celebrate = null`) so the DOM and focus are put
  back exactly as a dismissal would.
- `syncShareLink()` exists so that choosing a message updates only the `href` — re-rendering the
  radios would throw away the focus of the user standing on them.
- `celebrateReturnFocus` is a module-level DOM node, not state, the same shape as
  `draggedTaskId`; it is checked with `document.contains()` before use because the card the move
  came from was rebuilt while the dialog was open.
- Dismissal paths: Close, Escape, a click on the backdrop itself (not inside the dialog), and
  sharing. Tab is trapped inside the dialog by `trapCelebrationFocus()` — an `aria-modal` dialog
  that lets Tab walk into the board is lying about what is behind it.

`WHATSAPP_SHARE_BASE` (`https://wa.me/?text=`) is the second external URL in the file and the
first that is **not** a subresource: it is a navigation target on an `<a target="_blank">`, the
page never fetches it, so it needs no `connect-src` entry and the CSP is unchanged. The message
is percent-encoded with `encodeURIComponent()`, which is what keeps a title full of quotes and
angle brackets from meaning anything in the URL. Nothing is sent by the page — WhatsApp opens
with the text pre-filled and the user picks the recipient.

### Ordering, WIP limits and Notes

- `sortTasks()` orders each column: overdue first, then priority, then soonest due date, then id.
  The comparator is total, so re-rendering never reshuffles equal cards.
- `WIP_LIMITS` caps In Progress and Blocked. Backlog and Done are queues and are deliberately
  uncapped. Going over a limit **warns and never blocks a move** — a control that refuses to act
  is a dead end, and the board must be able to represent what is really happening.
- Card descriptions are collapsed behind a Notes toggle. The text is always in the DOM (hidden),
  never truncated, so `aria-controls` always resolves.

### Input sanitisation

`escapeHtml()` stops a string becoming markup; it does not stop a string lying about what it says.
`sanitizeText()` strips C0/C1 control characters and Unicode bidi overrides (the "trojan source"
trick, where an assignee name renders differently from the value stored and emailed), collapses
whitespace and applies `MAX_LEN`. It runs in **both** `validateForm()` and `addTask()` — the
latter is the model boundary, so rendering never depends on validation having run first. Tab, LF
and CR are deliberately preserved for the multiline description.

### Escaping

Cards are built as HTML strings, so `escapeHtml()` is load-bearing. There are exactly **two**
`innerHTML` assignment sites — `renderBoard()` and `showToast()` — and every user-supplied value
reaching them must pass through `escapeHtml()` first, including values interpolated into
attributes such as `aria-label` and `data-id`. Any new markup-building code inherits this rule.

The overview renderers deliberately do **not** use `innerHTML`: `renderSummary()` builds the metric
tiles with `createElement` + `textContent`, and `renderStatusChart()` builds the SVG with
`createElementNS`. Neither can inject, so neither needs escaping. Prefer that shape for new
rendering code — a third `innerHTML` site needs a real justification, not a reflex.

### Dates

Due dates are `YYYY-MM-DD` strings. `parseISODate()` and `toISODate()` build **local-midnight**
dates deliberately — using `new Date(iso)` or `toISOString()` reintroduces UTC drift that shifts due
dates by a day in some timezones. `isOverdue()` is `due < todayMidnight() && status !== "Done"`.
Seed due dates are generated with `daysFromToday(±n)` rather than hardcoded, so the Overdue badge
demonstrates correctly whenever the file is opened.

### FormSubmit

`FORMSUBMIT_ENDPOINT` (line 1021) is the one place the destination email is configured; it ships with
a `YOUR_EMAIL@example.com` placeholder. FormSubmit requires one-time activation — the first request
sends a confirmation email to that address, and nothing delivers until its link is clicked.

**A failed notification is not a bug.** The amber "Card added locally — email notification failed"
toast is the optimistic-UI path working. `handleSubmit()` adds the card and resets the form
*before* the fetch, and the fetch is wrapped in `try`/`catch`/`finally` so a FormSubmit failure can
never break the board or strand the submit button in "Sending…". (With the placeholder address the
call may still return 200 — FormSubmit accepts the request and simply never delivers until the
address is activated. Both outcomes are handled.)

Three guards sit in front of the call and must survive any edit to it:

- **An `AbortController` timeout** (`NOTIFY_TIMEOUT_MS`). Without it a hung connection leaves the
  promise pending forever, `finally` never runs, and the form is dead for the rest of the session.
- **A client-side throttle** (`notifyBlockedReason()`). FormSubmit is called with
  `_captcha:"false"`, so a public page with a real address is reachable by anyone who opens it.
  This is a speed bump against accidental floods, **not a security control** — the real control is
  FormSubmit's own settings.
- **`SUBMIT_LABEL` / `inFlightNotifications`**. The button label is a constant, never read back off
  the button: a second submission starting mid-flight would otherwise capture "Sending…" as the
  label to restore and strand it there.

## Content Security Policy

The `<meta http-equiv="Content-Security-Policy">` in `<head>` is declared in-document because there
is no server to send a header. `'unsafe-inline'` is unavoidable — the whole app is one inline
`<style>` and one inline `<script>`. What it still buys: `default-src 'none'`, `connect-src`
limited to `formsubmit.co` (so injected script cannot exfiltrate elsewhere), `form-action 'none'`
and `base-uri 'none'`. `frame-ancestors` cannot be set from a meta tag, so clickjacking is not
defended here.

**Adding any external URL means editing the CSP as well**, and that should be a deliberate decision
rather than a reflex — today `formsubmit.co` is the only host in the file.

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
grep -n "innerHTML =" index.html           # should stay at 2 sites, both escaped
```

The URL grep now matches three things, and all are expected: the FormSubmit endpoint;
`http://www.w3.org/2000/svg` inside `SVG_NS`, an XML namespace identifier passed to
`createElementNS` and never fetched; and `https://wa.me/?text=` in `WHATSAPP_SHARE_BASE`, a
navigation target on an anchor and likewise never fetched. Anything else in that output is a real
finding.
