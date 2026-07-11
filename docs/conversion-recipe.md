# Per-Chart GraphQL-Standalone Conversion Recipe

Hardened in Wave 0 on **d3BarChart** (branch `v3/d3BarChart-standalone`). This is
the reproducible procedure for converting one chart bundle into a fully
standalone, GraphQL-only bundle for waves 1–N. It is written from what the bar
conversion actually required, not from what the design predicted. Read the
approved design first: `docs/superpowers/specs/2026-07-11-graphql-standalone-design.md`.

The end state per chart: the bundle folder + the `d3` static resource is
everything. No `c/d3Lib`, `c/dataService`, `c/themeService`, `c/chartUtils`,
`c/graphqlService` imports; no `@salesforce/apex/*` imports; no `soqlQuery` or
`fetchMode`; a new `graphqlQuery` free-text admin override.

---

## 0. Prerequisites

- A worktree + branch off the v3 integration branch (do **not** work in the main
  checkout). Example used in Wave 0:
  `git worktree add ../d3-lwc.worktrees/<chart> v3/<chart>-standalone`
- `node -v` → v20 (jest ran under Node 26 here fine, but SF CLI needs 20).
- `npx jest --silent` green from the start (full suite; ~2.4s / 3,377 tests). The
  suite always runs whole — there is **no per-component narrowing flag**
  (`--testPathPattern` does nothing here). To watch just your bundle while
  iterating, pass a path: `npx jest force-app/main/default/lwc/<chart>`.
- Know your chart's shared-module usage before you start (step 2).

---

## 1. Commit shape (what worked)

Two code commits + one docs commit, in this order:

1. `refactor(<chart>): inline shared-module subsets as bundle-local files`
   — create the bundle-local modules, switch the component to relative imports,
   switch the test mocks from `c/d3Lib` to `../d3Loader`. **No public API change.**
   Full suite stays green. This isolates and de-risks the mechanical inlining and
   proves relative-module mocking resolves.
2. `feat(<chart>): GraphQL-only self-fetch with graphqlQuery override`
   — TDD: rewrite the test tiers to the end state (RED), then remove Apex +
   `soqlQuery` + `fetchMode`, add `graphqlQuery`, edit `.js-meta.xml`. GREEN.
3. `docs(...)` — recipe/CHANGELOG updates as needed.

Splitting (1) from (2) matters: the inlining touches every import line and is
noise in a behavior diff; keeping it separate makes the feat commit reviewable.

---

## 2. Inline the used-subset modules

### 2.1 Decision procedure (how to trace what to copy)

1. Open the component and list its `c/*` imports. For bar:
   `loadD3` (d3Lib); `prepareData, aggregateData, OPERATIONS, MAX_RECORDS`
   (dataService); `getColors, DEFAULT_THEME` (themeService);
   `formatNumber, truncateLabel, createTooltip, createResizeHandler,
buildTooltipContent, createLayoutRetry, applySvgA11y` (chartUtils);
   `buildAggregateQuery, buildRecordQuery, normalizeAggregate, normalizeRecords`
   (graphqlService).
2. For **each** imported symbol, open the shared module and trace its transitive
   closure — every helper and module-level constant it calls. Copy the closure,
   not just the named export. Bar examples:
   - `prepareData` pulls in `validateData`, `validateFields`, `truncateData`,
     `MAX_RECORDS`.
   - `aggregateData` pulls in `OPERATIONS`.
   - `getColors` pulls in `extendColors`, `PALETTES`, `DEFAULT_THEME`.
   - `buildTooltipContent` defaults its formatter to `formatNumber`, so
     `formatNumber` comes too.
   - `buildAggregateQuery`/`buildRecordQuery` pull in `buildWhere` → `formatValue`,
     `OPERATORS`, and `AGG_FN`.
3. **Do NOT copy** exports the chart never touches. Dropped from the bar inlines:
   `getD3`/`resetD3`; `CHART_LIMITS`, `sampleData`, `aggregateSeriesData`,
   `computeQuartiles`, `computeRunningTotal`, `buildMatrix`, `buildHierarchy`,
   `applyFilterClause`; `THEMES`, `createColorScale`, `getSequentialRamp`,
   `SEMANTIC_*`; `formatCurrency`, `formatPercent`, `getContrastColor`,
   `parseDate`, `computeDateExtent`, `calculateDimensions`; `buildMultiGroupQuery`,
   `normalizeMultiGroup`.
4. Rewrite any inlined comment that is now **actively false** in a standalone
   bundle (CLAUDE.md permits removing only false comments). The dataService and
   graphqlService docstrings referenced "prefer server-side getAggregatedData
   Apex" and `(use dataSource="apex")` — those were rewritten to describe the
   client-side / record-query reality. Do not add temporal "copied from X" notes;
   ABOUTMEs must be evergreen ("Bundle-local … for the d3<Chart> bundle").

### 2.2 File layout (design's suggested names — kept verbatim)

```
<chart>/
  d3Loader.js   # loadD3 singleton + CSP fetch/eval fallback
  theme.js      # PALETTES, DEFAULT_THEME, extendColors, getColors
  data.js       # MAX_RECORDS, OPERATIONS, validate/truncate/prepare/aggregate
  utils.js      # formatters, tooltip, resize, layout-retry, applySvgA11y
  graphql.js    # buildWhere/buildRecordQuery/buildAggregateQuery/normalizers
```

Every inlined file starts with a 2-line `// ABOUTME:` header. `graphql.js` (a
bundle-local module) coexists with the platform `lightning/graphql` import — the
compiler distinguishes `./graphql` (relative) from `lightning/graphql` (bare) so
there is no collision; jest's `moduleNameMapper` for `^lightning/graphql$` does
not match the relative path either.

Bar inlined line counts: d3Loader 79, theme 99, data 173, utils 278, graphql 141.

### 2.3 The canonical free-text normalizer

Pin this adapted `normalizeRecordsGeneric` in every bundle's `graphql.js`. It
extends the shared version with **object-key auto-detection** (so a free-text
query targeting any object is accepted) and a **project-all fallback** (project
every node field when `fields` is omitted). Both are needed for the admin
override; the shared version required an explicit object + field list.

```js
export function normalizeRecordsGeneric(data, { objectApiName, fields } = {}) {
  const queryRoot = data?.uiapi?.query;
  if (!queryRoot) return [];
  const key =
    objectApiName && queryRoot[objectApiName]
      ? objectApiName
      : Object.keys(queryRoot)[0];
  if (!key) return [];
  const edges = queryRoot[key]?.edges ?? [];
  return edges.map((e) => {
    const node = e.node ?? {};
    const record = {};
    (fields ?? Object.keys(node)).forEach((f) => {
      record[f] = node[f]?.value ?? null;
    });
    return record;
  });
}
```

---

## 3. Switch imports + test mocks (commit 1)

- Component: `c/d3Lib` → `./d3Loader`, `c/dataService` → `./data`, etc.
- **The one non-obvious move:** the tests mock the loader. Change
  `jest.mock("c/d3Lib", …)` + `import { loadD3 } from "c/d3Lib"` to
  `jest.mock("../d3Loader", …)` + `import { loadD3 } from "../d3Loader"`.
  **A `jest.mock` of a bundle-relative path works**: jest keys the module
  registry by resolved absolute filename, so the test's `../d3Loader` and the
  component's `./d3Loader` are the same module and the mock applies to both.
  Verified in Wave 0 (full suite stayed green after the swap).
- The bar Count path also switched `normalizeRecords` → `normalizeRecordsGeneric`
  in commit 1, because I chose not to inline the gantt-specific `normalizeRecords`.
  Output is identical (`[{ [groupByField]: value }, …]`), so tests stayed green.

Run `npx jest --silent` → must be green before committing.

---

## 4. Component conversion (commit 2, TDD)

### 4.1 Rewrite tests first (RED)

Per tier:

- Delete `@salesforce/apex/*` imports + `jest.mock(...apex..., { virtual: true })`
  and the `mockResolvedValue` lines in `beforeEach`.
- Delete every test that asserts on `executeQuery`/`getAggregatedData`/`soqlQuery`
  behavior or sets `fetchMode`. **Grep for leftovers** — a lingering
  `expect(executeQuery)...` in a test you kept becomes a `ReferenceError` once
  the import is gone. Command:
  `grep -nE 'executeQuery|getAggregatedData|soqlQuery|fetchMode|@salesforce/apex' __tests__/*.js`
- The old "no data source → error" expectation becomes a **no-data state**
  (neither error nor chart), because an un-provisioned wire is not an error.
- Add override coverage to the `.graphql.test.js` tier: (a) free-text
  `graphqlQuery` used verbatim + aggregated client-side, (b) free-text wire
  errors surface, (c) a blank/whitespace `graphqlQuery` falls through to the
  structured builder, (d) `recordCollection` beats a set `graphqlQuery`.
- Convert one happy-path fetch test in `.e2e`/`.integration` from the old
  Apex/SOQL path to a `graphql.emit(...)` wire path so a real self-fetch scenario
  still runs end to end.

Run `npx jest force-app/main/default/lwc/<chart>` → confirm RED is exactly the
structured-wire tests (now un-gated) + the new override tests. If anything else
is red, it is test cruft, not the feature — fix the test.

### 4.2 Implement (GREEN)

Remove the Apex imports and the `soqlQuery`/`fetchMode`/`filterClause` `@api`
properties. `filterClause` was only read by the removed Apex path — dropping it
is a dead-surface removal (hygiene check 3), not a feature cut. Add:

```js
/**
 * Free-text UI API GraphQL document. When non-blank it overrides the
 * structured query builder as the wire's data source; the returned records
 * are aggregated client-side by groupByField/valueField/operation.
 */
@api graphqlQuery = "";

get hasFreeTextQuery() {
  return !!(this.graphqlQuery && this.graphqlQuery.trim());
}
```

**`gqlQuery` getter** — recordCollection wins, then free-text, then structured:

```js
get gqlQuery() {
  // recordCollection wins: skip the wire so it is never the data source.
  if (this.recordCollection && this.recordCollection.length > 0) {
    return undefined;
  }
  // Admin free-text override: pass the document straight to the wire.
  if (this.hasFreeTextQuery) {
    return gql`
      ${this.graphqlQuery}
    `;
  }
  // Structured builder path.
  if (!this.objectApiName || !this.groupByField || !this.operation) {
    return undefined;
  }
  if (this.operation !== OPERATIONS.COUNT && !this.valueField) {
    return undefined;
  }
  let queryString;
  try {
    queryString =
      this.operation === OPERATIONS.COUNT
        ? buildRecordQuery({ objectApiName: this.objectApiName,
            fields: [this.groupByField], filter: this.graphqlFilter,
            first: this.recordLimit || 2000 })
        : buildAggregateQuery({ objectApiName: this.objectApiName,
            groupByField: this.groupByField, valueField: this.valueField,
            operation: this.operation, filter: this.graphqlFilter,
            first: this.recordLimit || 2000 });
  } catch {
    return undefined; // leave the wire un-provisioned; error surfaces below
  }
  return gql`
    ${queryString}
  `;
}
```

**Wire handler** — drop the `fetchMode` gate; guard recordCollection; branch
free-text → generic-normalize + client-aggregate, else the chart's normal path:

```js
@wire(graphql, { query: "$gqlQuery" })
wiredAggregate({ data, errors }) {
  if (this.recordCollection && this.recordCollection.length > 0) return;
  if (errors) { this.error = this._formatGqlErrors(errors); this.isLoading = false; return; }
  if (!data) return; // initial undefined emission
  try {
    let normalized;
    if (this.hasFreeTextQuery) {
      const fields = this.operation === OPERATIONS.COUNT
        ? [this.groupByField]
        : [this.groupByField, this.valueField];
      const records = normalizeRecordsGeneric(data, { objectApiName: this.objectApiName, fields });
      normalized = this._aggregateRawData(records);
    } else if (this.operation === OPERATIONS.COUNT) {
      const records = normalizeRecordsGeneric(data, { objectApiName: this.objectApiName, fields: [this.groupByField] });
      normalized = this._aggregateRawData(records);
    } else {
      normalized = normalizeAggregate(data, { objectApiName: this.objectApiName,
        groupByField: this.groupByField, valueField: this.valueField, operation: this.operation });
    }
    if (!normalized.length) this.error = "No data after aggregation";
    else { this.chartData = normalized; this.error = null; this.chartRendered = false; }
  } catch (e) { this.error = e.message; }
  this.isLoading = false;
}
```

**`loadData`** collapses to recordCollection-only (avoid a trailing `return;` —
ESLint `no-useless-return` fails the lint-staged hook):

```js
async loadData() {
  if (this.recordCollection && this.recordCollection.length > 0) {
    this.chartData = this._aggregateRawData([...this.recordCollection]);
  }
}
```

---

## 5. `.js-meta.xml` diff template

- **Remove** the `soqlQuery` `<property>` (and its "Data Source" comment) and the
  `fetchMode` `<property>`.
- **Add** the `graphqlQuery` property:

```xml
<!-- GraphQL Query Override -->
<property
  name="graphqlQuery"
  type="String"
  label="GraphQL Query"
  description="Optional UI API GraphQL document (a record query) that overrides the query built from the fields above. UI-API-queryable objects only; returns at most 2,000 records; GraphQL syntax. The returned rows are aggregated client-side by <the chart's field mappings>. Leave blank to build the query automatically. Count is bounded to the first Record Limit rows (default 2000)."
/>
```

- **Broaden `objectApiName`** if its label/description only mentioned drill-down —
  it now also drives the self-fetch. Bar's became label "Object API Name",
  description "Object to query. When set (and no records are passed in), the chart
  self-fetches this object via GraphQL. Also used for drill-down navigation…".
- Keep `apiVersion` at **65.0** (floor for dynamic `gql` string interpolation).
- Update `<description>` only if it names SOQL/Apex (bar's did not).

---

## 6. Chart-clone hygiene scan (run before reporting DONE)

Donor here is the **pre-conversion** chart; the leak is Apex/SOQL/fetchMode
strings. Run and report all four:

```bash
# 1. Stale donor strings (source + tests). Expect zero, or an intentional survivor.
cd force-app/main/default/lwc/<chart>
grep -niE 'soql|apex|fetchmode|executequery|getaggregateddata|filterclause|D3ChartController' \
  <chart>.js d3Loader.js data.js theme.js utils.js graphql.js <chart>.js-meta.xml <chart>.html <chart>.css __tests__/*.js
# 2. Stale config keys: confirm every advancedConfig key the tests set is one renderChart reads.
# 3. Dead surface: every @api property AND every <property> in the meta is read by the component.
# 4. Test-name ↔ behavior: each renamed it() asserts what its description claims.
# Import ban:
grep -nE 'from "c/(d3Lib|dataService|themeService|chartUtils|graphqlService)"|@salesforce/apex' \
  <chart>.js d3Loader.js data.js theme.js utils.js graphql.js __tests__/*.js
```

(The repo hook blocks Bash `grep -r`; the commands above are non-recursive on an
explicit file list, which is allowed.) In Wave 0 the only survivor was one
integration-test ABOUTME that still said "Apex … are mocked" — corrected.

---

## 7. Verification gate

```bash
npx jest --silent                                   # FULL suite green (the other charts still use shared modules)
npx eslint force-app/main/default/lwc/<chart>       # exit 0 (do NOT run repo-wide `npm run lint` — stale aura glob)
npx prettier --write <only files you touched>       # never `npm run prettier` (reformats whole repo)
```

Commit; the husky + lint-staged pre-commit hook re-runs prettier/eslint/related
jest on staged files. Never `--no-verify`. Live-org render verification + the
detach/reattach deploy sequencing belong to the **release** step, not the
conversion (SCOPE excludes deploys here).

---

## 8. Known traps

- **`@api` names cannot start with `data` or `on`** (LWC1107) — they collide with
  `data-*` attributes / `on*` handlers. `graphqlQuery` is safe; watch chart props
  like `dataField` in other bundles.
- **Aggregate envelope has a double `aggregate` wrapper:**
  `data.uiapi.aggregate.<Object>.edges[].node.aggregate.<Field>.{value | <fn>.value}`.
  The record envelope does not: `data.uiapi.query.<Object>.edges[].node.<Field>.value`.
  The free-text override targets the **record** envelope (`uiapi.query`) — an admin
  who pastes an aggregate query gets no rows.
- **`lightning/graphql` v2 jest mock is repo-shared** at `__mocks__/lightning/graphql.js`
  via `moduleNameMapper` (the pinned sfdx-lwc-jest only ships the v1 stub). It
  provides `graphql.emit(data)`, `graphql.emitErrors(errs)`, and a `gql` that
  reconstructs the interpolated string. It is **not** part of any bundle — leave it.
- **Whole-string `gql` interpolation (`` gql`${queryString}` ``) is undocumented**
  but is the same mechanism the structured builders already ship; live-verified per
  the design. Wave 0 confirms the jest-level mechanism (the mock reconstructs and
  tests assert the string); **org verification is a release-step task**, not part
  of the conversion.
- **apiVersion 65 floor** for dynamic `gql`. Do not bump or drop it.
- **Relative `jest.mock`** of `../d3Loader` is required and it works (§3). Do not
  try to mock `c/d3Loader` — the loader is bundle-local, not a `c/` module.
- **`no-useless-return`** — the collapsed `loadData` must not end with a bare
  `return;` or the lint-staged hook fails the commit.

---

## 9. Where other charts differ from bar (and what to do)

Bar is an aggregation chart with a Count fallback and drill-down. Adjust per family:

- **No aggregation (line, area, step, scatter, bubble, gauge, bullet, progress,
  sparklineGrid, boxPlot, dotPlot, calendarHeatmap):** these already self-fetch
  raw records via `buildRecordQuery` + a record normalizer, not
  `buildAggregateQuery`/`normalizeAggregate`. Their `gqlQuery` has no aggregate
  branch; `graphqlQuery` free-text should normalize with `normalizeRecordsGeneric`
  and feed the chart's **existing record-shaping** step (there is no client-side
  group-by to run). Inline whichever normalizer the chart actually uses.
- **Two-field / matrix / hierarchy (stackedBar, stackedHorizontalBar, heatmap,
  chord, sunburst, treemap):** they use `buildMultiGroupQuery` +
  `normalizeMultiGroup`, or `buildMatrix`/`buildHierarchy` from dataService. Trace
  and inline those instead of (or in addition to) the single-group builders. The
  free-text override still projects raw records — decide whether the chart can
  aggregate them client-side (`buildMatrix`/`buildHierarchy` accept flat rows) and
  document the contract in the meta help text.
- **Date charts (gantt, calendarHeatmap, line/area time series):** they use
  `normalizeRecords` (gantt-specific `{label,start,end}`) and/or `parseDate` /
  `computeDateExtent` from chartUtils. Inline those; do **not** substitute
  `normalizeRecordsGeneric` blindly where a chart depends on the fixed
  `{label,start,end}` shape.
- **Count-bounded caveat:** any chart whose Count path uses `buildRecordQuery`
  (record query, then client-side count) is bounded to the first `recordLimit`
  (default 2000) rows — GraphQL has no server COUNT here. Keep that sentence in the
  meta help text (bar's `graphqlQuery` and any Count-capable property carry it).
- **Charts with no drill-down:** if a chart has no `objectApiName`-driven
  navigation, `objectApiName` is used **only** to build the query — label it
  plainly ("Object API Name") and don't imply drill-down.

```

```
