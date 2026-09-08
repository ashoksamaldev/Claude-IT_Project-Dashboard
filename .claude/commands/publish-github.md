---
description: Scan for secrets, push this project to GitHub, deploy GitHub Pages via Actions, and write the README + repo About/homepage
argument-hint: [github repo URL or owner/name — optional if origin is already set]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Publish this project to GitHub

Target repo (may be empty): **$ARGUMENTS**

Publish the project in the current working directory to GitHub, serve it as a GitHub Pages
site built by a GitHub Actions workflow, and give the repo a README and an About section that
links to the live page.

Work through the phases **in order**. Phase 1 is a hard gate: never push until it passes.
Report a short status line after each phase. If a phase cannot complete, stop and say exactly
what is blocking and what the user needs to do.

## Repo constraints to respect

If the repo has a `CLAUDE.md`, read it first and honour it. For this project specifically:
`index.html` is a deliberately single-file, no-build, no-dependency app — the Pages workflow
must publish the repo root as a **static** artifact. Do **not** add a build step, `package.json`,
bundler, or any dependency, and do not split `index.html`.

## Phase 0 — Establish the target

1. `git rev-parse --is-inside-work-tree` — if this is not a repo, `git init` and set the branch
   to `main`.
2. Determine the destination in this order:
   - the URL / `owner/name` in `$ARGUMENTS`,
   - else the existing `git remote -v` origin,
   - else **ask the user** for the repo URL and stop until they answer.
3. Normalise `owner` and `repo` from whatever form was given (full HTTPS URL, SSH URL, or
   `owner/name`). Set/replace `origin` with the HTTPS URL. Echo the resolved
   `owner/repo`, current branch, and `git status --short` so the user can confirm the target.
4. Check tooling once and remember the result: `command -v gh` and, if present,
   `gh auth status`. `gh` is **not required** — every step below has a manual fallback that
   you must hand the user verbatim (exact URL + exact field to fill) when `gh` is missing or
   unauthenticated.

## Phase 1 — Sensitive-data scan (blocking gate)

Everything pushed here becomes **public and permanent**, including anything already in history.
Scan the working tree, the staged/untracked files, and the existing commit history.

Run at least these, from the repo root:

```sh
# Working tree — credential-shaped strings
grep -rniE "api[_-]?key|secret|passwd|password|token|bearer |authorization:|client[_-]secret|private[_-]key|BEGIN (RSA|OPENSSH|EC|PGP) PRIVATE KEY" . \
  --exclude-dir=.git --exclude-dir=node_modules

# Known provider key shapes
grep -rnE "sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN" . \
  --exclude-dir=.git --exclude-dir=node_modules

# Email addresses and absolute local paths that leak identity/machine layout
grep -rnE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|/Users/[A-Za-z0-9._-]+/" . \
  --exclude-dir=.git --exclude-dir=node_modules

# Files that should never be committed
git status --porcelain --untracked-files=all
find . -name ".env*" -o -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "id_rsa*" \
  -o -name "*.sqlite" -o -name ".DS_Store" | grep -v "^./.git/"

# History — a secret removed from the working tree may still be in an old commit
git log --oneline --all | head -50
git grep -nE "sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN|password" $(git rev-list --all) -- 2>/dev/null | head -30
```

Also check, for this project: `grep -n "FORMSUBMIT_ENDPOINT" index.html`. It is meant to ship
with the `YOUR_EMAIL@example.com` placeholder. **If it holds a real address, flag it** — a real
inbox in a public repo gets scraped — and ask whether to restore the placeholder before pushing.

Judgement, not noise: an `.example` file, a placeholder, a `# password:` label in a comment,
or a variable named `token` with no value is fine. Report only things that are, or plausibly
are, real credentials or real personal data.

Then:
- **Nothing found** → say "Secret scan clean" with a one-line note on what was checked, continue.
- **Something found** → **stop before pushing.** List each hit as `file:line` with the matched
  text redacted to its first few characters, say why it matters, and propose the fix
  (remove the value, move it to a `.env` + `.gitignore` entry, rotate the credential if it was
  ever real, or rewrite history if it is in an old commit). Continue only once the user says to.
- Ensure `.gitignore` covers at minimum `.DS_Store`, `.env*`, `*.pem`, `*.key`,
  `.claude/settings.local.json`. Add missing entries; never delete existing ones.

## Phase 2 — Push the code

1. If `origin` does not exist on GitHub yet:
   - with `gh`: `gh repo create <owner>/<repo> --public --source=. --remote=origin` (ask
     public vs private first if the user has not said; Pages on a private repo needs a paid plan
     — tell them that if they choose private).
   - without `gh`: give the user the exact steps — open <https://github.com/new>, create
     `<repo>` under `<owner>`, **no** README/.gitignore/licence, then confirm back — and wait.
2. Stage and commit whatever is uncommitted, with a clear message. Follow the repo's existing
   commit-message style. If the current branch is not `main`, ask before pushing to `main`.
3. `git push -u origin main`. If the push is rejected for unrelated history or auth, report the
   real error and the fix rather than forcing. Never `git push --force` without explicit
   permission.
4. Confirm with `git log --oneline -1` and `git status`.

## Phase 3 — GitHub Pages via GitHub Actions

Create `.github/workflows/pages.yml` (edit it in place if it already exists rather than
duplicating). Publish the repo root as a static artifact — no build:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
```

If the site entry point is not `index.html` at the repo root, adjust `path:` to the directory
that holds it, and say what you changed.

Then set the Pages source to **GitHub Actions** (a workflow alone does not enable Pages):

- with `gh`:
  `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow` (if it 409s, it already
  exists — use `-X PUT` to update instead).
- without `gh`: tell the user to open
  `https://github.com/<owner>/<repo>/settings/pages` and set **Source → GitHub Actions**.

Commit and push the workflow, then report the run status
(`gh run list --limit 3`, or the URL `https://github.com/<owner>/<repo>/actions`) and the
expected site URL: `https://<owner>.github.io/<repo>/`. The first deploy takes a couple of
minutes; do not claim the site is live unless you have actually seen the run succeed.

## Phase 4 — README

Create `README.md`, or edit the existing one in place, keeping any content the user wrote.
Base every claim on what the code actually does — read the source, do not invent features.
Include:

- project title and a one-or-two-sentence description of what it is,
- a **live demo** link to the Pages URL,
- screenshots only if image files already exist in the repo (this project forbids adding any),
- key features, as observed in the code,
- how to run it locally (for this project: clone and double-click `index.html` — no build,
  no server, no dependencies),
- notable constraints or intentional behaviour a reader would otherwise mistake for a bug
  (here: no persistence — a refresh resets to seed data; the FormSubmit endpoint needs
  one-time activation and fails with the placeholder email by design),
- tech-stack line and any licence/disclaimer the repo requires (this one must keep its
  "not affiliated with UOB / demo only" disclaimer).

No fabricated badges, no CI badge for a workflow that does not exist, no invented licence.

## Phase 5 — Repo About + homepage link

Set the repo description and the homepage to the Pages URL, plus a few relevant topics:

- with `gh`:
  ```sh
  gh repo edit <owner>/<repo> \
    --description "<one-line description>" \
    --homepage "https://<owner>.github.io/<repo>/" \
    --add-topic kanban --add-topic project-management --add-topic vanilla-js
  ```
  (Choose topics that actually fit the project.)
- without `gh`: tell the user to open `https://github.com/<owner>/<repo>`, click the ⚙ next to
  **About**, and paste the description, the website URL, and the topics — give them the exact
  strings to paste.

Verify with `gh repo view <owner>/<repo> --json description,homepageUrl,repositoryTopics`
when `gh` is available.

## Final report

Print a compact summary:

- secret scan result (clean, or what was found and how it was handled),
- repo URL and the commit that was pushed,
- Actions run status and link,
- live Pages URL — and whether you confirmed it is serving or it is still deploying,
- README and About: written / updated / skipped,
- anything left for the user to do by hand, as a numbered list.

Be accurate about what is verified versus what is expected to happen shortly.
