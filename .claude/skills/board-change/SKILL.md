---
name: board-change
description: Make a change to the UOB IT PMO Kanban board in index.html and verify it without a browser. Use when adding or editing a card field, column, filter, badge, mutator, toast, or form validation rule, or when a change to index.html needs proving before hand-off.
---

# Changing the Kanban board

One file, no build step, no test runner, no Node. This skill is the lifecycle for changing
`index.html` safely: read the contract, make the change in the shape the file already uses,
prove it with the bundled harness, and report what was actually checked.

## 1. Read the contract before editing

`CLAUDE.md` holds the hard constraints — they are product requirements, not preferences, and
several of them look like bugs from inside the code. Re-read it rather than trusting memory.
The ones most often broken by an innocent-looking edit:

- **No persistence.** No `localStorage`/`sessionStorage`/IndexedDB/cookies. A refresh resetting
  the board is intended and is announced in the header. Never "improve" this.
- **No `alert()`/`confirm()`.** Validation is inline error text per field; delete is an inline
  "Delete? Yes / No" row rendered inside the card.
- **No `!important`**, no external resources, no framework, everything stays in the one file.

## 2. Work inside the state → render contract

`state` (around line 841) is the single source of truth:
`{ tasks, filters: { project, assignee, priority }, idCounter, pendingDeleteId }`.
A task is `{ id, title, description, project, category, assignee, priority, dueDate, status }`.
An empty-string filter means *no filter* — there is no `"All"` sentinel.

Four rules keep the app coherent. A change that breaks one produces bugs that only show up
after a re-render, which is exactly when they are hardest to trace:

1. **`renderBoard()` is the only function that writes card DOM.** Never mutate a card from an
   event handler. Change `state`, then re-render.
2. **Every mutator ends in `renderBoard()`.** `addTask()`, `moveTask()`, `deleteTask()` and each
   filter handler already do. A new mutator follows the same shape.
3. **Transient UI state lives in `state`, not the DOM.** `pendingDeleteId` is the model: it
   survives a re-render because it is re-rendered *from*. Anything else that must outlive a
   render belongs there too.
4. **Listener binding is asymmetric on purpose.** Column listeners bind once in
   `bindColumnEvents()`; card button/select handlers are delegated on `#board` in `bindEvents()`
   and also bind once; only `bindCardEvents()` re-binds after each render, because cards are
   rebuilt from HTML strings. Adding a per-card listener means adding it to `bindCardEvents()`
   or, better, delegating it on `#board`.

Flow: `init()` → `seedTasks()` → `bindColumnEvents()` → `bindEvents()` → `renderBoard()`;
`renderBoard()` → `applyFilters()` → `renderCard()` per task → `renderSummary()` +
`renderFilterResult()` → `bindCardEvents()`.

**The deliberate asymmetry:** column count badges and the filter line reflect the *filtered*
subset; the header summary strip always counts the full `state.tasks`. Do not "fix" this.

## 3. Escaping is load-bearing

Cards are HTML strings, so every user-supplied value reaching an `innerHTML` site must pass
through `escapeHtml()` first — including values interpolated into attributes such as
`aria-label` and `data-id`. There are exactly three `innerHTML` sites (`renderBoard()`,
`renderSummary()`, `showToast()`). New markup-building code inherits the rule; new
`innerHTML` sites need a deliberate decision, not a reflex. See the `board-security-review`
skill when a change touches rendering, the form, or the FormSubmit call.

## 4. Dates

Due dates are `YYYY-MM-DD` strings. `parseISODate()` and `toISODate()` build **local-midnight**
dates on purpose — `new Date(iso)` and `toISOString()` reintroduce UTC drift that shifts a due
date by a day in some timezones. `isOverdue()` is `due < todayMidnight() && status !== "Done"`.
Seed dates use `daysFromToday(±n)` so the Overdue badge demonstrates whenever the file is opened;
never hardcode them.

## 5. Verify

Node is not installed. Use the system JavaScriptCore binary via the bundled scripts — run them
from the project root:

```sh
.claude/skills/board-change/scripts/parse-check.sh index.html          # compiles, no execution
.claude/skills/board-change/scripts/run-harness.sh index.html          # runs init() under a stub DOM
.claude/skills/board-change/scripts/run-harness.sh index.html my-assertions.js
```

`run-harness.sh` extracts the `<script>` block, evaluates it against a fake DOM, and hands your
assertions file an `app` object exposing `state`, `seedTasks`, `applyFilters`, `renderCard`,
`renderBoard`, `addTask`, `moveTask`, `deleteTask`, `escapeHtml`, `isOverdue`, `validateForm`
and the date helpers, plus `ok(cond, label)` and `eq(actual, expected, label)`. It exits
non-zero on any failure. Because the whole `init()` path runs for real, a crash in seeding,
binding or rendering surfaces immediately.

Copy `scripts/example-assertions.js` to the scratchpad as a starting point — it covers seeding,
escaping, the mutators, filters and date round-tripping, and documents the traps.

**Write assertions precisely.** Naive substring checks like `indexOf('"><')` or
`indexOf("onerror=")` match legitimate tag boundaries *and already-escaped text*, and report
failures that are not real. Assert on the specific escaped form (`&lt;img`) and the specific raw
form (`<img src=x`) instead.

Stub notes: `fetch` rejects by default, matching the shipped placeholder endpoint; set
`fetchMode = "ok"` in an assertions file to exercise the success path. `setTimeout` is a no-op,
so toasts never auto-hide under test. `elements[id]` reaches any stub element the app touched,
and `el.fire("click", { target: … })` invokes listeners bound directly to it.

Then grep for constraint regressions:

```sh
grep -niE "localStorage|sessionStorage|indexedDB|document\.cookie|!important|alert\(|confirm\(" index.html
grep -oE "https?://[^\"' )]+" index.html   # only ever the formsubmit.co endpoint
grep -n "innerHTML" index.html             # stays at 3 sites, all escaped
```

## 6. What only a browser can confirm

Say so plainly rather than implying it was tested. `open index.html` covers: drag-and-drop
gestures and the drop-target highlight, the keyboard-only "Move ▸" path, the responsive stack
below 768px, and visible focus rings. The harness cannot see any of them.

## 7. Report honestly

State which checks ran and what they proved, name anything left to browser confirmation, and
quote real output when something fails. "Parse OK and 19 assertions pass; drag-and-drop still
needs a browser" is a useful report. "Verified" on its own is not.
