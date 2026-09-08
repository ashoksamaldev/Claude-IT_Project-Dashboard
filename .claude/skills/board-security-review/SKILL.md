---
name: board-security-review
description: Threat-model and security-review the UOB IT PMO Kanban board (index.html) before publishing or after a change to rendering, the task form, or the FormSubmit call. Use for XSS/injection review, secret and PII leakage checks before pushing to a public repo or GitHub Pages, and for judging whether a proposed feature widens the attack surface.
---

# Security review for a single-file, file:// board

Generic web-app security advice mostly misfires here. There is no server, no session, no
database, no auth and no dependencies — so most of the OWASP Top 10 is structurally absent, and
the few risks that *do* apply are concentrated in three places. Review those properly instead of
producing a checklist that grades an app this small against controls it cannot have.

## The actual model

**Assets worth protecting** — in this order:

1. **The destination email address** in `FORMSUBMIT_ENDPOINT` (~line 830). Once the repo is
   public, whatever sits there is public and scrapeable.
2. **Task content typed into the form**, which leaves the browser for a third party
   (`formsubmit.co`) — title, description, project, category, assignee, priority, due date.
   Assignee names are personal data.
3. **The reader's trust.** The page names a real bank. A page that looks like an official UOB
   system, published under a real-looking URL, is a phishing template whether or not that was
   the intent. This is why `CLAUDE.md` forbids UOB branding and requires the footer disclaimer.

**Trust boundaries** — there are only two: the form input → the DOM (injection), and the form
input → `formsubmit.co` over the network (disclosure). Everything else is one process, one file.

**Structurally out of scope**, and it is correct to say so rather than inventing findings:
no server-side anything, no authn/authz, no session or cookie handling, no SQL, no SSRF, no CSRF
(no authenticated state to forge against), no dependency/supply-chain risk (the no-CDN,
no-npm constraint *is* the control), and no data at rest (the no-persistence constraint means
nothing survives the tab).

## STRIDE, scoped to this file

| | Applies? | Where it actually lives |
|---|---|---|
| **S**poofing | Yes — reputational | The page impersonating an official UOB system. Neutral wordmark + footer disclaimer are the control. |
| **T**ampering | Yes — DOM injection | The three `innerHTML` sites. `escapeHtml()` is the only control. |
| **R**epudiation | No | Single-user demo, no audit claims made. |
| **I**nformation disclosure | Yes | Task content to `formsubmit.co`; the email address in a public repo. |
| **D**enial of service | Negligible | Local page; worst case is the user's own tab. |
| **E**levation of privilege | No | No privilege levels exist. |

## Review checklist

Run the greps first — they are cheap and catch the regressions that matter:

```sh
grep -n "innerHTML" index.html                       # must stay at 3 sites
grep -oE "https?://[^\"' )]+" index.html             # must print only the formsubmit.co endpoint
grep -niE "localStorage|sessionStorage|indexedDB|document\.cookie" index.html   # must print nothing
grep -nE "YOUR_EMAIL@example\.com" index.html        # placeholder still in place?
grep -niE "location\.(search|hash|href)|URLSearchParams|postMessage|eval\(|new Function|insertAdjacentHTML|document\.write" index.html
```

That last grep is the important one for future changes: today the page reads **no** untrusted
input other than the form, so injection is self-inflicted (a user attacking their own tab).
The moment a change reads `location.search`/`location.hash`, accepts `postMessage`, or fetches
remote JSON, injection becomes attacker-reachable from a link and the model above must be redone.

Then, by area:

**1. Rendering.** Every user-supplied value reaching an `innerHTML` site passes through
`escapeHtml()` — including values interpolated into attributes (`aria-label`, `data-id`,
`title`). Attribute context is where escaping is usually forgotten: an unescaped value inside
`aria-label="…"` breaks out with a single `"`. A new `innerHTML` site needs justification;
prefer `textContent` for anything that is not markup.

**2. The form.** `validateForm()` is a UX control, not a security control — it constrains
shape, not safety. Rendering safety must not depend on validation having run.

**3. The FormSubmit call.** Confirm the payload in `notifyNewTask()` still carries only task
fields the user typed, and no environment, clipboard or identity data. Confirm the endpoint
is still the single external URL in the file. If the placeholder has been replaced with a real
address, flag that publishing the repo publishes that address.

**4. Failure behaviour.** With the placeholder in place, `notifyNewTask()` **always fails, and
the amber "Card added locally — email notification failed" toast is the correct outcome** — the
optimistic-UI path working, not a finding. `handleSubmit()` adds the card and resets the form
*before* the fetch, and wraps it in `try`/`catch`/`finally` so a failure cannot break the board
or strand the submit button in "Sending…". A change that moves the fetch before the state update
is a regression.

## Before publishing to a public repo or GitHub Pages

Publishing is the step that converts a local demo into an internet-facing page. Check, in order:

1. **Secrets.** Scan the whole tree, not just `index.html` — `git log -p` too, because history is
   published as well. Real email addresses, tokens, internal hostnames, screenshots containing
   real names or ticket numbers.
2. **`.gitignore`** covers `.env*`, keys/certs, `.DS_Store` and local settings.
3. **Impersonation.** No real UOB logo, trademark, colours-as-brand, or wording that reads as an
   official system; the footer disclaimer is intact. A public URL raises this from a style rule
   to the sharpest risk in the project.
4. **PII in seed data.** Seeded assignee names should stay clearly fictional.
5. **Third-party disclosure.** If a real FormSubmit address is configured, anyone who opens the
   published page can send mail to it. That is inherent to the design — state it as a known,
   accepted property rather than a defect, and say so in the report.

## Reporting

Rank by real-world impact for *this* app, not by generic CVSS instinct. An unescaped
`aria-label` in a local demo and a live email address in a public repo are not the same finding.
Give each: what breaks, the concrete path to trigger it, and the smallest fix that respects the
hard constraints. Say explicitly when a category was considered and found not to apply — that
is a result, not a gap. Do not pad a report with controls this architecture deliberately
excludes; recommending a CSP header, a WAF or dependency pinning for a file:// single-file page
is noise that buries the two findings that count.
