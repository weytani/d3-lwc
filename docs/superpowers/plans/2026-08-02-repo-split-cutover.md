# d3-lwc Repo Split Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `weytani/d3-lwc` into two published full-history repos — `d3-lwc-soql` (main cut at the `v2.1.0` tag) and `d3-lwc-graphql` (main cut at the `v3-standalone` tip) — with inherited tags renamed `legacy/v*`, repo identity established, and the original repo archived.

**Architecture:** Bare `--mirror` clones of the local repo receive branch/tag surgery, then mirror-push to freshly created GitHub repos; working clones land at `~/code/d3-lwc-soql` and `~/code/d3-lwc-graphql`. Spec: `docs/superpowers/specs/2026-08-02-repo-split-soql-graphql-design.md` (approved 2026-08-02).

**Tech Stack:** git, gh CLI, npm/jest (verification only — no chart code changes in this plan).

## Global Constraints

- Both new repos are **public** — no org credentials, org URLs, or record data in any committed file.
- Old repo is the program of record for the split spec; it is archived only after both new repos verify green.
- All inherited `v*` tags become `legacy/v*` in both new repos; each repo's own semver starts later at v1.0.0 (release trains, not this plan).
- All branches ride along into both clones; none are deleted anywhere.
- Conventional commits, imperative mood. NEVER `--no-verify`; pre-commit hooks (husky + lint-staged) must pass.
- Node 20 for anything touching `sf` CLI; jest runs on the default node.
- The Bash tool runs zsh — quote globs, no `timeout`/`gtimeout`.
- No chart code, test, or doc-content changes in this plan beyond the exact files listed (identity files only). The strip stream and consolidation stream have their own plans.

---

### Task 1: Pre-flight safety net (old repo)

**Files:**

- Modify: `force-app/main/default/flexipages/d3_lwc_phase2.flexipage-meta.xml` (commit the existing uncommitted edit as-is; do not change its content)

**Interfaces:**

- Consumes: `~/code/d3-lwc` on branch `v3-standalone` with exactly one uncommitted change (the flexipage detach-edit).
- Produces: old repo fully clean and fully pushed; `$GRAPHQL_TIP_SHA` and `$SOQL_FORK_SHA` recorded for later assertions.

- [ ] **Step 1: Verify gh auth and that the target repo names are free**

Run:

```bash
gh auth status
gh repo view weytani/d3-lwc-soql 2>&1 | head -2 || true
gh repo view weytani/d3-lwc-graphql 2>&1 | head -2 || true
```

Expected: auth OK with repo scope; both `gh repo view` calls fail with "Could not resolve to a Repository" (names free). If either repo already exists, STOP and report.

- [ ] **Step 2: Inspect and commit the parked flexipage edit**

Run: `cd ~/code/d3-lwc && git diff force-app/main/default/flexipages/d3_lwc_phase2.flexipage-meta.xml`

Expected: a small (±5 line) edit consistent with a mid-release-train component detach (removed/edited `<componentInstance>` content for a converted chart). Commit it as-is — the graphql consolidation gate re-derives flexipage final state later:

```bash
git add force-app/main/default/flexipages/d3_lwc_phase2.flexipage-meta.xml
git commit -m "wip(flexipage): park mid-train d3_lwc_phase2 detach state for the repo split"
```

If the diff is instead unrelated junk (whitespace-only, editor artifact), discard with `git checkout -- <file>` and say so in the report.

- [ ] **Step 3: Push everything and record fork SHAs**

```bash
cd ~/code/d3-lwc
git push origin master v3-standalone
git push origin --tags
GRAPHQL_TIP_SHA=$(git rev-parse v3-standalone)
SOQL_FORK_SHA=$(git rev-parse 'v2.1.0^{commit}')
echo "graphql tip: $GRAPHQL_TIP_SHA"; echo "soql fork: $SOQL_FORK_SHA"
```

Expected: pushes succeed; both SHAs print. Report both SHAs — later tasks assert against them.

- [ ] **Step 4: Verify clean state**

Run: `git status --short` → empty (ignoring the worktree dir); `git log origin/v3-standalone --oneline -1` matches local tip.

### Task 2: Park and prune the worktrees (old repo)

**Files:** none in the main checkout; WIP commits may land on `v3/*` branches.

**Interfaces:**

- Consumes: `~/code/d3-lwc.worktrees/` with ~12 worktrees.
- Produces: zero registered worktrees; every branch's final state committed so it rides into the mirrors.

- [ ] **Step 1: Park any dirty worktree state as WIP commits on its own branch**

```bash
cd ~/code/d3-lwc
git worktree list --porcelain | awk '/^worktree /{print $2}' | grep -v "^$HOME/code/d3-lwc$" | while read -r wt; do
  if [ -n "$(git -C "$wt" status --porcelain)" ]; then
    git -C "$wt" add -A
    git -C "$wt" commit -m "wip: park $(basename "$wt") worktree state at repo split" || echo "PARK FAILED: $wt"
  fi
done
```

Expected: each dirty worktree gets one WIP commit on its checked-out `v3/*` branch (hooks run normally; if a hook fails in a worktree, STOP and report that worktree rather than bypassing). Clean worktrees are untouched.

- [ ] **Step 2: Remove all worktrees and the container dir**

```bash
cd ~/code/d3-lwc
git worktree list --porcelain | awk '/^worktree /{print $2}' | grep -v "^$HOME/code/d3-lwc$" | while read -r wt; do git worktree remove "$wt"; done
git worktree prune
rmdir ~/code/d3-lwc.worktrees 2>/dev/null || ls -la ~/code/d3-lwc.worktrees
```

Expected: `git worktree list` shows only `~/code/d3-lwc`; the container dir is gone (or listed for manual inspection if non-empty — report leftovers, do not `rm -rf` blind).

- [ ] **Step 3: Verify**

Run: `git worktree list` → exactly one line. `git branch | wc -l` unchanged from Task 1 (branches survive worktree removal).

### Task 3: Publish d3-lwc-graphql (mirror surgery + push)

**Files:** none in the old repo; a temporary bare mirror.

**Interfaces:**

- Consumes: `$GRAPHQL_TIP_SHA` from Task 1.
- Produces: `github.com/weytani/d3-lwc-graphql` (public), default branch `main` at `$GRAPHQL_TIP_SHA`, 14 `legacy/v*` tags, zero `v*` tags, all branches present.

- [ ] **Step 1: Mirror-clone and perform surgery**

```bash
MIR=$(mktemp -d)/d3-lwc-graphql-mirror.git
git clone --mirror ~/code/d3-lwc "$MIR"
cd "$MIR"
git branch main v3-standalone
for t in $(git tag -l 'v*'); do git tag "legacy/$t" "$t" && git tag -d "$t"; done
git symbolic-ref HEAD refs/heads/main
git tag -l 'v*' | wc -l          # expect 0
git tag -l 'legacy/v*' | wc -l   # expect 14
git rev-parse main               # expect $GRAPHQL_TIP_SHA
```

- [ ] **Step 2: Create the GitHub repo and mirror-push**

```bash
gh repo create weytani/d3-lwc-graphql --public \
  --description "Standalone D3.js chart LWCs for Salesforce — GraphQL wire only, zero dependencies beyond the d3 static resource"
cd "$MIR" && git push --mirror https://github.com/weytani/d3-lwc-graphql.git
gh repo edit weytani/d3-lwc-graphql --default-branch main
```

- [ ] **Step 3: Verify remote state**

```bash
gh repo view weytani/d3-lwc-graphql --json defaultBranchRef,visibility -q '{default: .defaultBranchRef.name, vis: .visibility}'
git ls-remote --tags https://github.com/weytani/d3-lwc-graphql.git | grep -c 'legacy/v'
git ls-remote --tags https://github.com/weytani/d3-lwc-graphql.git | grep -vc 'legacy/'
```

Expected: `{default: main, vis: PUBLIC}`; 14 legacy tag refs (28 lines if annotated-tag peel lines counted — count unique tag names, not lines); zero non-legacy tags.

### Task 4: Working clone + suite green (d3-lwc-graphql)

**Interfaces:**

- Produces: `~/code/d3-lwc-graphql` working clone on `main`, full jest suite green.

- [ ] **Step 1: Clone and assert lineage**

```bash
git clone https://github.com/weytani/d3-lwc-graphql.git ~/code/d3-lwc-graphql
cd ~/code/d3-lwc-graphql
git rev-parse HEAD   # must equal $GRAPHQL_TIP_SHA
git tag -l 'v*' | wc -l   # expect 0
```

- [ ] **Step 2: Install and run the full suite**

```bash
cd ~/code/d3-lwc-graphql && npm ci && npx jest --silent
```

Expected: full suite green (at the v3-standalone tip; report the exact suites/tests counts). If anything fails, STOP — the fork point itself is broken and that's a finding, not something to fix here.

### Task 5: Repo identity commit (d3-lwc-graphql)

**Files:**

- Modify: `package.json` (name/version), `CLAUDE.md` (prepend identity section), `README.md` (prepend split banner), `CHANGELOG.md` (prepend unreleased + legacy mapping)
- Delete: `scripts/sync-to-agentforce.sh` (spec §6: sync belongs to the soql line)

**Interfaces:**

- Produces: the repo self-describes; later plans (consolidation stream) rely on `CLAUDE.md` naming and the spec/recipe paths it cites.

- [ ] **Step 1: package.json**

Edit `name` to `"d3-lwc-graphql"` and `version` to `"1.0.0-dev"` (was `d3-lwc` / `3.9.0`). Touch nothing else.

- [ ] **Step 2: Prepend to CLAUDE.md (above the existing content, which stays until the stream's docs work rewrites it)**

```markdown
# d3-lwc-graphql

In this repo the agent is **GRAPH GRAVEDIGGER** and David is **Bigg DR NODEZILLA**.

Split 2026-08-02 from `weytani/d3-lwc` (now archived) at the `v3-standalone` tip; inherited
release tags live under `legacy/*`. Sibling repo: `weytani/d3-lwc-soql` (shared-module
Apex/SOQL line). Development happens on `main`; other inherited branches are inert history.

**What this repo is:** every chart becomes a fully standalone GraphQL-only LWC bundle —
self-fetches via the `lightning/graphql` wire, no Apex, no shared `c/` modules; the only
dependency is the `d3` static resource. 16/40 charts are converted (bar, sortedBar,
horizontalBar, stackedBar, stackedHorizontalBar, normalizedBar, line, area, step,
variableColorLine, sparklineGrid, pie, donut, lollipop, funnel, waffle). v1.0.0 ships after
the consolidation gate; the remaining 24 convert in waves; the final purge release deletes
the shared modules and all Apex.

- Program of record: `docs/superpowers/specs/2026-08-02-repo-split-soql-graphql-design.md`
- Per-chart conversion recipe: `docs/conversion-recipe.md`
- NOTE: the sections below predate the split and describe the hybrid architecture — still
  accurate for the 24 unconverted charts; superseded per chart as conversions land.

---
```

- [ ] **Step 3: Prepend to README.md**

```markdown
> **Repo split (2026-08-02):** this is **d3-lwc-graphql** — the standalone GraphQL-only line
> of the former `weytani/d3-lwc` (archived). Each converted chart is a self-contained LWC
> bundle whose only dependency is the `d3` static resource. For the shared-module Apex/SOQL
> line, see [`weytani/d3-lwc-soql`](https://github.com/weytani/d3-lwc-soql). Conversion
> status: 16/40 standalone; inherited release tags preserved as `legacy/*`.
```

- [ ] **Step 4: Prepend to CHANGELOG.md (after the header intro, before the 3.9.0 entry)**

```markdown
## [Unreleased]

Repo split from `weytani/d3-lwc` at the `v3-standalone` tip. This repo's own semver line
starts at 1.0.0 (consolidation gate). Inherited tags are preserved as `legacy/v*`:

| Legacy tag                      | Meaning                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| `legacy/v1.0.0`                 | d3-lwc 30-chart hybrid release                                  |
| `legacy/v1.1.0`                 | GraphQL self-fetch added to bar (fetchMode)                     |
| `legacy/v2.0.0`                 | gantt GraphQL-only (first breaking release)                     |
| `legacy/v2.1.0`                 | 40 charts, hybrid fetchMode — d3-lwc-soql fork point            |
| `legacy/v3.0.0`–`legacy/v3.9.0` | per-chart standalone conversions — the line this repo continues |
```

- [ ] **Step 5: Delete the sync script, commit, push**

```bash
cd ~/code/d3-lwc-graphql
git rm scripts/sync-to-agentforce.sh
git add package.json CLAUDE.md README.md CHANGELOG.md
git commit -m "chore: establish d3-lwc-graphql repo identity post-split"
git push origin main
```

Expected: hooks pass; push succeeds. Run `npx jest --silent` once more — still green (identity files don't touch code, this catches accidents).

### Task 6: Publish d3-lwc-soql (mirror surgery + push)

**Interfaces:**

- Consumes: `$SOQL_FORK_SHA` from Task 1.
- Produces: `github.com/weytani/d3-lwc-soql` (public), default branch `main` at `$SOQL_FORK_SHA` (the v2.1.0 commit), 14 `legacy/v*` tags, all branches present.

- [ ] **Step 1: Mirror-clone and surgery (main BEFORE tag rename — it's cut from the v2.1.0 tag)**

```bash
MIR2=$(mktemp -d)/d3-lwc-soql-mirror.git
git clone --mirror ~/code/d3-lwc "$MIR2"
cd "$MIR2"
git branch main "$(git rev-parse 'v2.1.0^{commit}')"
for t in $(git tag -l 'v*'); do git tag "legacy/$t" "$t" && git tag -d "$t"; done
git symbolic-ref HEAD refs/heads/main
git rev-parse main   # expect $SOQL_FORK_SHA
git tag -l 'v*' | wc -l && git tag -l 'legacy/v*' | wc -l   # expect 0, then 14
```

- [ ] **Step 2: Create and mirror-push**

```bash
gh repo create weytani/d3-lwc-soql --public \
  --description "40 D3.js chart LWCs for Salesforce — shared-module architecture, Apex/SOQL data layer"
cd "$MIR2" && git push --mirror https://github.com/weytani/d3-lwc-soql.git
gh repo edit weytani/d3-lwc-soql --default-branch main
```

- [ ] **Step 3: Verify remote state** — same three checks as Task 3 Step 3, against `d3-lwc-soql`.

### Task 7: Working clone + suite green (d3-lwc-soql)

- [ ] **Step 1: Clone and assert lineage**

```bash
git clone https://github.com/weytani/d3-lwc-soql.git ~/code/d3-lwc-soql
cd ~/code/d3-lwc-soql
git rev-parse HEAD   # must equal $SOQL_FORK_SHA
```

- [ ] **Step 2: Install and run the full suite**

```bash
cd ~/code/d3-lwc-soql && npm ci && npx jest --silent
```

Expected: green — this is the released v2.1.0 state (133 suites / 3,384 tests; report actual counts). STOP on any failure (broken fork point = finding).

### Task 8: Repo identity commit (d3-lwc-soql)

**Files:**

- Modify: `package.json`, `CLAUDE.md` (prepend), `README.md` (prepend), `CHANGELOG.md` (prepend)
- Create: `docs/superpowers/specs/2026-08-02-repo-split-soql-graphql-design.md` (copied verbatim from the old repo — the v2.1.0 cut predates it)

**Interfaces:**

- Produces: repo self-describes; the strip-stream plan relies on the spec being present at this path.

- [ ] **Step 1: package.json** — `name`: `"d3-lwc-soql"`, `version`: `"1.0.0-dev"` (was `2.1.0`).

- [ ] **Step 2: Copy the spec in**

```bash
mkdir -p ~/code/d3-lwc-soql/docs/superpowers/specs
cp ~/code/d3-lwc/docs/superpowers/specs/2026-08-02-repo-split-soql-graphql-design.md \
   ~/code/d3-lwc-soql/docs/superpowers/specs/
```

- [ ] **Step 3: Prepend to CLAUDE.md**

```markdown
# d3-lwc-soql

In this repo the agent is **QUERYSAURUS WRECKS** and David is **Bigg DR SOQLSLAM**.

Split 2026-08-02 from `weytani/d3-lwc` (now archived) at the `v2.1.0` tag — the last point
where all 40 charts carry the SOQL/Apex path. Inherited release tags live under `legacy/*`.
Sibling repo: `weytani/d3-lwc-graphql` (standalone GraphQL-only line). Development happens
on `main`; other inherited branches are inert history.

**What this repo is:** the shared-module Apex/SOQL chart library — `recordCollection` and
`soqlQuery` via `D3ChartController`, server-side aggregation endpoints, shared `d3Lib`/
`dataService`/`themeService`/`chartUtils`. Roadmap: v1.0.0 = strip the hybrid GraphQL path
(`graphqlService`, per-chart `fetchMode`) from all 40 charts; v1.1.0 = backport the v3 §4.3
render-orchestration hardening. This repo keeps the agentforce-dev sync
(`scripts/sync-to-agentforce.sh`).

- Program of record: `docs/superpowers/specs/2026-08-02-repo-split-soql-graphql-design.md`
- NOTE: the sections below predate the split — architecture/sync/gotcha sections remain
  accurate; graphQL/fetchMode mentions describe the hybrid state the strip sweep removes.

---
```

- [ ] **Step 4: Prepend to README.md**

```markdown
> **Repo split (2026-08-02):** this is **d3-lwc-soql** — the shared-module Apex/SOQL line
> of the former `weytani/d3-lwc` (archived). 40 charts, `soqlQuery` + `recordCollection`
> data paths, server-side aggregation. For the standalone GraphQL-only line, see
> [`weytani/d3-lwc-graphql`](https://github.com/weytani/d3-lwc-graphql). Inherited release
> tags preserved as `legacy/*`; the hybrid GraphQL path is being stripped for this repo's
> v1.0.0.
```

- [ ] **Step 5: Prepend to CHANGELOG.md** — same `## [Unreleased]` block and legacy-tag table as Task 5 Step 4, with the last table row reading: `per-chart standalone conversions — continued in d3-lwc-graphql, not in this repo`.

- [ ] **Step 6: Commit and push**

```bash
cd ~/code/d3-lwc-soql
git add package.json CLAUDE.md README.md CHANGELOG.md docs/superpowers/specs/
git commit -m "chore: establish d3-lwc-soql repo identity post-split"
git push origin main
```

Then `npx jest --silent` once more — still green.

### Task 9: Decommission the old repo

**Files:**

- Modify: `README.md` on `master` of `~/code/d3-lwc` (prepend archive banner)

- [ ] **Step 1: Archive banner commit on master**

```bash
cd ~/code/d3-lwc && git checkout master
```

Prepend to `README.md`:

```markdown
> **ARCHIVED (2026-08-02).** This repo split into two successors and receives no further
> development: [`d3-lwc-soql`](https://github.com/weytani/d3-lwc-soql) (shared-module
> Apex/SOQL line, forked at v2.1.0) and
> [`d3-lwc-graphql`](https://github.com/weytani/d3-lwc-graphql) (standalone GraphQL-only
> line, forked at the v3-standalone tip). Design:
> `docs/superpowers/specs/2026-08-02-repo-split-soql-graphql-design.md` (on the
> `v3-standalone` branch).
```

```bash
git add README.md
git commit -m "docs: archive pointer — repo split into d3-lwc-soql and d3-lwc-graphql"
git push origin master
```

- [ ] **Step 2: Archive on GitHub (only after Tasks 4 and 7 verified green)**

```bash
gh repo archive weytani/d3-lwc --yes
gh repo view weytani/d3-lwc --json isArchived -q .isArchived   # expect true
```

- [ ] **Step 3: Return the local checkout to `v3-standalone`** (its role now is read-only reference): `git checkout v3-standalone`.

### Task 10: Workspace + memory bookkeeping

**Files:**

- Modify: `~/code/CLAUDE.md` (Project Directory table)
- Modify: `~/.claude/projects/-Users-weytani/memory/project_d3_lwc.md`, `MEMORY.md` (hook line)

- [ ] **Step 1: Update the workspace Project Directory table** — replace the `d3-lwc` row with:

```markdown
| `d3-lwc-soql` | D3 chart LWCs — shared-module Apex/SOQL line (40 charts) | Split from d3-lwc @v2.1.0. Branch: main |
| `d3-lwc-graphql` | D3 chart LWCs — standalone GraphQL-only line (16/40 converted) | Split from d3-lwc @v3-standalone. Branch: main |
| `d3-lwc` | ARCHIVED — split into the two repos above | Read-only reference |
```

- [ ] **Step 2: Update Auto Memory** — append the split record (date, fork SHAs, legacy-tag scheme, repo URLs, roadmap pointers) to `project_d3_lwc.md`; update the MEMORY.md Active-Projects hook line for the D3 library to name both repos and their next gates (soql: strip sweep → v1.0.0; graphql: consolidation gate → v1.0.0).

- [ ] **Step 3: Report** — final summary with both repo URLs, fork SHAs, suite counts, and any deviations (dirty worktrees parked, flexipage triage outcome, leftover files).
