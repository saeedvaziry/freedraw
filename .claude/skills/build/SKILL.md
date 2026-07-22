---
name: build
description: Issue-driven build workflow for the FreeDraw roadmap. Use at the START of any session that will implement roadmap work, and at the END to hand off cleanly. Drives work from the beads backlog (bd), keeps everything on the dev branch, and leaves each session's state clean so the next one starts fresh. Triggers - "start building", "work the backlog", "pick up an issue", "/build", "hand off", "wrap up this session", "what should I work on".
---

# FreeDraw Build Workflow

This skill runs the **issue-driven build loop** for the FreeDraw roadmap. It is NOT about `npm run build` (never run that — see guardrails). It means: pull the next ready issue from beads, implement it on the `dev` branch, verify it, and leave a clean hand-off so a fresh session can continue without re-discovering context.

The roadmap was produced by a discovery spike and lives entirely in **beads** (`bd`). The full backlog is 6 phase epics (`fd-p0`, `fd-p05`, `fd-p1`, `fd-p2a`, `fd-p2b`, `fd-p3`) and ~78 dependency-linked issues. Each issue's description carries its approach, key files, effort, and risk — that is the persistent design record.

---

## Ground rules (read every session)

- **Branch:** ALL work happens on `dev` (branched from `main`). **Nothing goes to `main`** until the whole backlog is done; the `dev → main` merge happens only when the user explicitly says it's ready. If you're not on `dev`, `git checkout dev` (create it from `main` if missing).
- **Beads is local + gitignored** ("for now"). The `.beads/` dir is in `.gitignore`; do **not** try to commit it, and do **not** run `bd dolt push`/`git add .beads` — the auto-export "git add failed: paths ignored" warning is expected and harmless. Issues live only in this clone's Dolt DB.
- **One issue at a time.** Claim it, implement only its scope, verify, close it. Scope creep becomes a *new* issue, not a bigger diff.
- **Never invent status.** If something isn't done, say so and leave a hand-off note — don't close it.

---

## 1. Orient (start of session)

```bash
git branch --show-current          # must be dev; if not: git checkout dev  (or: git checkout -b dev main)
git status --short                 # know what's already dirty (there may be unrelated engine WIP — leave it alone)
bd ready                           # unblocked, claimable issues (grouped by epic)
```

- Read the top of `bd ready`. Ready issues are ordered; P0 correctness/foundation first.
- If resuming, also check `bd list --status in_progress` and read any hand-off note (`bd show <id>` → NOTES) left by the previous session.
- Pick the issue. Prefer: unblocking work (things that many others depend on — `fd-cam-local`, `fd-assets-be`, `fd-hocus-svc`, `fd-tokens`, `fd-board-context`, `fd-registry`, `fd-draw-cache`) before leaf work.

## 2. Claim & plan

```bash
bd show <id>                       # read description: approach, key files, effort, risk, deps
bd update <id> --claim             # marks in_progress + assigns you
```

- Open and read the **key files named in the description** before writing anything.
- If the issue is an epic (`fd-p*`), don't "work" it — pick one of its children.
- Sketch the change mentally against the real code; if the description's assumptions no longer hold, `bd note <id> "reality check: ..."` and adjust.

## 3. Build

Implement only this issue's scope, following the project conventions (below).

- If you discover necessary follow-up work, file it instead of expanding scope:
  ```bash
  bd create "<title>" -t task -p <0-4> -l "<labels>" -d "<what/why/files>" --deps "discovered-from:<id>" --silent
  ```
- If the new work must precede something, add a blocking edge: `bd dep add <blocked> <blocker>`.
- Keep the diff reviewable. Match surrounding code style. **No code comments** (project rule).

## 4. Verify (quality gates — required before closing)

Run the gates relevant to what you touched. **Never run `npm run build`** (assume `npm run dev` is running; Vite manifest errors → ask the user to restart it).

- Engine / frontend TypeScript: `npm --prefix packages/engine run test` (vitest) for engine; `npm run types:check` (tsc) and `npm run lint:check` at root for the React/TS layer.
- Backend PHP: `./vendor/bin/pest` (sqlite). Activate the `pest-testing` skill when writing tests. Every Action/Service gets a test; feature tests for controller endpoints.
- Add/extend tests for the issue (the descriptions call out test plans, e.g. the drag-layer and align-snap items).
- If a gate fails and you can't fix it in scope, do NOT close — leave a hand-off note.

## 5. Close or hand off

**If fully done and gates pass:**
```bash
bd close <id> --reason "<what shipped, in one line>"
bd close <id> --suggest-next      # optional: shows newly-unblocked work
```

**If partially done (end of session, blocked, or out of time):** leave the issue `in_progress` and write a structured hand-off note so the next session starts clean:
```bash
bd note <id> "HANDOFF $(date +%F)
DONE: <what's implemented + committed>
REMAINING: <precise next steps>
FILES: <touched / to-touch>
GOTCHAS: <traps, decisions, open questions>
GATES: <which pass/fail now>"
```

## 6. Commit to dev & leave it clean

Commit **only** the files for this issue — do not sweep up unrelated WIP. Reference the issue id.

```bash
git add <the files you changed>
git commit -m "<id>: <summary>"      # e.g. "fd-draw-cache: cache roughjs drawables in local coords"
git push origin dev                   # push the feature branch (NEVER push/merge to main)
```

- `git push origin dev` is fine (feature branch). **Do not** `git push origin main`, `git merge` into `main`, `rebase` shared history, or run any destructive git command without asking.
- End state to verify: `git status` clean for your files, correct branch, issue status accurate, hand-off note present if partial.
- Then summarize for the user: issue id + what shipped/handed off + what's newly unblocked (`bd ready`).

---

## Project conventions (apply while building)

Stack: Laravel 13 / PHP 8.4, MySQL (sqlite in tests), Redis + Horizon · Inertia v3 + React 19 + TS · Tailwind v4 + shadcn · engine at `packages/engine` (roughjs, perfect-freehand, yjs).

- **Architecture:** Route → Controller (thin) → FormRequest `toDto()` → Action(s) → Eloquent. DTOs are typed value objects; never pass FormRequests into Actions. Actions/Services grouped by domain, each gets a test.
- **Laravel 13 attributes** for models/jobs/controllers/commands (`#[Middleware]`, `#[Authorize]`, `#[UseResource]`, etc.). Resources via `--json-api`.
- **Frontend:** function components with typed props, `@/` alias, Inertia `<Form>`/`useForm` + `Link`/`router`. Pages in `resources/js/pages`, components in `resources/js/components`, hooks in `resources/js/hooks`. **kebab-case filenames** (PascalCase identifiers). Read a component before using it.
- **Icons:** Lucide only — no inline SVGs (CSS-shape glyphs are the sanctioned exception). Dark mode required; mobile-first responsive.
- **No code comments** anywhere (user rule) — even if other files have them.
- **Engine ↔ chrome:** the P0.5 issues (`fd-board-context`, `fd-registry`, `fd-primitives`, `fd-tokens`, `fd-store-selectors`) are the substrate most P1+ work builds on — prefer landing them before their dependents (the backlog already encodes this).

## Guardrails (never without explicit user approval)

- Never `npm run build`. Never `migrate:fresh` / `migrate:reset`. Never change dependencies (`composer`/`npm` deps). Never create new top-level directories. Never destructive git (force-push, reset shared history, main merges).
- Some issues explicitly need a decision (e.g. `fd-pdf-export`/`fd-cmd-palette` may need a new dep; `fd-library-be`/`fd-comments-be` add tables/dirs; `fd-design-proposal` is a design gate). For those, surface the decision (`bd human <id>` or ask) before implementing.

## Quick reference

```bash
bd ready                     # claimable work
bd show <id>                 # full issue (design lives here)
bd update <id> --claim       # start
bd blocked                   # what's waiting and on what
bd dep add <a> <b>           # a depends on b (b blocks a)
bd note <id> "..."           # hand-off / progress
bd close <id> --reason "..." # finish
bd epic status               # phase rollups
```
