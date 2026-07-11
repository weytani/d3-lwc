# GraphQL-Only Standalone Charts (v3 line) — Design

**Date:** 2026-07-11
**Status:** Approved by David (execution ordered 2026-07-11)
**Predecessor:** v2.1-consolidation branch (40 charts, additive `fetchMode` GraphQL support, unreleased)

## Goal

Every chart LWC becomes a fully standalone bundle: copy one folder into any
SFDX project (plus the `d3` static resource) and it works. All self-fetching
goes through the `lightning/graphql` wire adapter. The Apex controller and the
five shared service LWCs are dissolved.

## Decisions (with David, 2026-07-09 → 2026-07-11)

1. **Baseline:** release v2.1.0 first (docs + tag from `v2.1-consolidation`),
   then start the v3 line from master.
2. **Data inputs per converted chart:** `recordCollection` (Flow/parent) stays;
   GraphQL wire becomes the only self-fetch path; `soqlQuery` and `fetchMode`
   are removed; `D3ChartController` + tests are deleted when the last chart
   converts.
3. **Admin free-text query capability is preserved** via a new `graphqlQuery`
   @api text property on every converted chart (see "Admin query escape
   hatch"). Raw SOQL cannot survive without Apex — verified, see Research.
4. **Inlining:** each bundle gets local module files containing only what that
   chart actually uses from the former shared modules (used-subset inlining).
   The `d3` static resource (285 KB D3 v7 build) remains the single shared
   deploy artifact.
5. **Execution:** wave-parallel worktrees; one reference conversion
   (d3BarChart) produces a recipe doc that is reviewed — including non-code
   artifacts (meta.xml, apiVersion, jest config) — before any fan-out.
   Merges land serially on the v3 integration branch.
6. **Versioning:** one release per converted chart. v3.0.0 = paradigm shift +
   first chart (d3BarChart). Each subsequent chart is a minor bump (v3.1.0,
   v3.2.0, …). Changelog names the chart whose API broke in each release.

## Research findings (verified 2026-07-11)

Local evidence (live-verified on AGENT, API 65.0) + current Salesforce docs:

- **No raw SOQL without Apex.** No supported mechanism exists for an LWC to
  execute a SOQL string without an Apex controller (docs + open IdeaExchange).
  Dropping Apex therefore changes the admin query language to GraphQL.
- **Dynamic queries:** v2 `lightning/graphql` + API ≥ 65.0 supports JS string
  interpolation inside the `gql` tagged template. Docs bless identifier
  interpolation; our charts already interpolate a _complete_ built query
  string (`` gql`${queryString}` ``) and this is live-verified — the admin
  free-text property uses the same mechanism. Undocumented-pattern risk is
  accepted; Wave 0 live-verifies it explicitly.
- **Capability losses vs SOQL+Apex** (accepted): UI-API-queryable objects
  only; 2,000 records per query (matches the library's existing client-side
  `MAX_RECORDS = 2000` truncation); no OFFSET / backward pagination /
  `FIELDS()` / `toLabel()` / `FORMAT()` / HAVING; bounded semi-joins.
- **Capabilities retained:** aggregates (sum/avg/min/max/count/countDistinct)
  with groupBy/ROLLUP/CUBE, `like` filters, relative date literals, AND/OR/NOT
  nesting, parent traversal (5 levels), child subqueries (1 level), ORDER BY.
- **Server-side statistics regression** (accepted): histogram
  `getStatistics` and scatter `getCorrelation` Apex endpoints go away; those
  charts compute client-side from GraphQL-fetched rows (their `graphql`
  fetchMode already works this way today), subject to the 2,000-record cap
  and the documented Count-bounded caveats.

## End-state bundle architecture

Each `d3XxxChart` bundle contains, self-contained:

```
d3XxxChart/
  d3XxxChart.js            # component: wire, config, render orchestration
  d3XxxChart.html
  d3XxxChart.css
  d3XxxChart.js-meta.xml   # App Builder surface (apiVersion 65)
  d3Loader.js              # inlined from d3Lib: loadD3 singleton + CSP fallback
  theme.js                 # inlined palettes/helpers this chart uses
  data.js                  # inlined validation/aggregation subset it uses
  utils.js                 # inlined chartUtils subset it uses
  graphql.js               # inlined query builders + normalizers it uses
  __tests__/               # unit + integration + e2e tiers, bundle-local
```

Naming of the local files may be tuned in Wave 0 (single `support.js` is
allowed if the used subset is tiny); the invariant is **no `c/…` imports of
shared service components** and no `@salesforce/apex` imports.

- `import { loadD3 } from "./d3Loader"` etc. — intra-bundle relative imports.
- Each bundle keeps its own module-scoped D3 singleton; `loadD3` checks
  `window.d3` first so co-located charts on one page don't re-eval the
  static resource.
- @api surface after conversion: everything except `soqlQuery` + `fetchMode`,
  plus new `graphqlQuery`.

## Admin query escape hatch (`graphqlQuery`)

- New @api text property, App Builder-exposed, on every converted chart.
- Admin pastes a complete UI API GraphQL document. When set (non-blank), it
  overrides the structured builder properties as the query source.
- Results normalize through the bundle's generic normalizer
  (`normalizeRecordsGeneric` lineage) so any object key under
  `data.uiapi.query.<Object>` is accepted.
- Wire `errors` surface in the chart's existing error state (same UX as bad
  SOQL today). Help text documents: UI-API objects only, ≤ 2,000 records,
  GraphQL syntax.

## Conversion recipe (per chart — Wave 0 hardens this)

1. Worktree + branch off the v3 integration branch.
2. TDD: rewrite bundle tests to intra-bundle imports; add `graphqlQuery`
   override tests; remove `soqlQuery`/`fetchMode`/Apex-mock tests; RED first.
3. Inline used-subset modules; strip `c/d3Lib`, `c/themeService`,
   `c/dataService`, `c/chartUtils`, `c/graphqlService`, `@salesforce/apex`
   imports; delete apex/auto branches (`fetchMode` conditionals collapse to
   the graphql path + recordCollection priority).
4. Meta.xml: drop `soqlQuery`/`fetchMode` properties, add `graphqlQuery`;
   apiVersion 65 pinned.
5. Chart-clone hygiene scan (repo CLAUDE.md checklist) — donor-string grep,
   dead-surface check on every remaining @api property.
6. Full `npm test` green + `npx eslint` on touched dirs.
7. Merge serially to the v3 branch; live-deploy to AGENT — use
   `scripts/deploy-property-removal.sh` (detach → bundle deploy → reattach)
   for any chart placed on a flexipage; screenshot render check.
8. Release: CHANGELOG entry, version bump, tag `v3.N.0`, push, GitHub
   Release, `scripts/sync-to-agentforce.sh`.

## Wave plan

- **Wave 0 (serial):** d3BarChart — most battle-tested GraphQL path. Produces
  `docs/conversion-recipe.md`. Recipe review gate (logic + non-code
  artifacts) before any fan-out. Ships as v3.0.0.
- **Waves 1–N (parallel worktrees, serial merge/release):** family groups —
  bar family (sortedBar, horizontalBar, stackedBar, stackedHorizontalBar,
  normalizedBar, divergingBar, lollipop, bullet, progress), line/time family
  (line, area, step, difference, slope, sparklineGrid, variableColorLine,
  calendarHeatmap, gantt), distribution (histogram, boxPlot, dotPlot,
  scatter, bubble), part-to-whole (pie, donut, waffle, iconArray, gauge,
  treemap, sunburst), relational/specialty (heatmap, chord, sankey,
  forceGraph, radar, choropleth, funnel, waterfall, band).
  Wave size ~5; each chart = one worktree = one subagent = one release.
- **Teardown (final wave):** delete `d3Lib`, `themeService`, `dataService`,
  `chartUtils`, `graphqlService` bundles + their suites; delete
  `D3ChartController` + test (deploy destructive changes to AGENT); update
  README/ARCHITECTURE/CLAUDE.md/sync script; final release closes the line.

## Testing

- TDD per chart; all three tiers stay per bundle (unit / integration / e2e).
- Shared-module suites remain until teardown; coverage of inlined subsets
  lives in each bundle's own tests from Wave 0 onward.
- Full suite must be green at every serial merge; lint-staged hooks enforced
  (no `--no-verify`, ever).
- Live-org verification per release (render + zero console errors), since
  jest mocks cannot validate GraphQL envelope shapes (playbook lesson).

## Risks

- **Whole-string `gql` interpolation is undocumented** — mitigated: same
  mechanism as shipped builders, live-verified per release; if Salesforce
  tightens it, the structured builders break too, so no _added_ exposure.
- **Divergence across 40 inlined copies** — accepted consequence of
  standalone; recipe pins canonical subsets at conversion time.
- **~40 detach/reattach live deploys** — scripted; flexipage XML detach
  remains a judgment edit per the playbook.
- **agentforce-dev sync** consumes property removals — its pages confirmed
  free of placed gantt references (2026-07-01 investigation); re-check per
  wave for other charts.
