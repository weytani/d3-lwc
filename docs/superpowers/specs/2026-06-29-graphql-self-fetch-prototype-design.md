<!-- ABOUTME: Design spec for prototyping GraphQL self-fetch in d3-lwc charts. -->
<!-- ABOUTME: Approach A (additive) on the bar chart and Approach B (replace) on the gantt chart. -->

# GraphQL Self-Fetch Prototype — Design Spec

**Date:** 2026-06-29
**Status:** Approved for implementation planning
**Scope:** Two prototypes only — not a library-wide rollout.

## 1. Goal

Make a d3-lwc chart "stand on its own" inside Salesforce: drop it on any App Builder
page, Experience site, or Flow screen and have it **fetch its own data declaratively
via Salesforce's GraphQL wire adapter**, with no `D3ChartController` Apex class to
deploy or maintain. FLS/sharing are enforced automatically by the platform on the
GraphQL path, so the hand-rolled `Security.stripInaccessible` logic is not needed there.

This spec prototypes **two integration strategies** so we can pick one for the other 28
charts based on real, measured cost rather than speculation:

- **Approach A (additive)** on `d3BarChart` — an _aggregating_ chart.
- **Approach B (replace)** on `d3GanttChart` — a _raw-row_ chart.

The two chart types are deliberately different: bar exercises GraphQL `groupBy` +
aggregate functions; gantt exercises raw record fetch with filter/order/pagination.

## 2. Confirmed decisions

1. **Module: v2 `lightning/graphql`** (not v1 `lightning/uiGraphQLApi`). v2 supports
   **dynamic query construction**, which a config-driven chart requires (the object and
   fields are chosen at runtime in App Builder, not hard-coded in a `gql` template).
2. **Path selection in A: an explicit `@api dataSource` property** (`"auto"` default),
   not auto-detection. Behavior must be legible in App Builder, not inferred from which
   props happen to be set.

## 3. Scope guardrails (YAGNI / non-goals)

In scope:

- A new shared `graphqlService` LWC module.
- GraphQL self-fetch on `d3BarChart` (additive) and `d3GanttChart` (replace).
- Tests for all new code; existing bar tests stay green.
- A short comparison memo quantifying A-vs-B cost.

Explicitly **out of scope** (do not do in this work):

- Propagating GraphQL to the other 28 charts.
- Deleting or modifying `D3ChartController.cls` (it remains the escape hatch).
- Syncing changes to `agentforce-dev`.
- Supporting arbitrary SOQL `filterClause` on the GraphQL path (see §6).
- Mutations, pagination UI, or external (non-Salesforce) GraphQL endpoints.

All work happens on one branch off `master`.

## 4. Shared core — `graphqlService` LWC

New module at `force-app/main/default/lwc/graphqlService/`, sibling to `dataService`.
It is **pure functions** (no `@wire`, no DOM) so it is unit-testable in isolation — this
is where most of the TDD value sits. The charts own the `@wire`; the service owns query
construction and result normalization.

### 4.1 Query builders

```
buildAggregateQuery(config) -> { query, variables }
  // config: { objectApiName, groupByField, valueField, operation, filter }
  // operation in {Sum, Count, Average, Min, Max}
  // Produces a v2 dynamic GraphQL query using groupBy + the aggregate function.

buildRecordQuery(config) -> { query, variables }
  // config: { objectApiName, fields[], filter, orderBy, first }
  // Produces a v2 dynamic GraphQL query for raw rows.
```

### 4.2 Normalizers (output shapes are dictated by existing chart code)

```
normalizeAggregate(graphqlResult, config) -> [{ label: string, value: number }]
  // Matches what dataService.aggregateData and D3ChartController.getAggregatedData
  // already return; d3BarChart assigns this directly to this.chartData.

normalizeRecords(graphqlResult, config) -> [{ label, start, end }]  // for gantt
  // Matches the [{label, start, end}] ISO-string shape that
  // D3ChartController.getDateRangeData returns and d3GanttChart._prepareDateRows
  // already consumes. (For a general record query the shape is the consumer's
  // field set; gantt's consumer is _prepareDateRows.)
```

### 4.3 Filter model

`graphqlService` accepts a **structured** filter only:

```
filter: { field: string, operator: 'eq'|'ne'|'gt'|'gte'|'lt'|'lte'|'like'|'in', value: any }
```

It maps to the GraphQL `where` input. Arbitrary SOQL `WHERE` fragments (the current
`@api filterClause`) are **not** translated — this is a real capability gap the
prototype is meant to surface, and a core reason the Apex path is kept as an escape
hatch in Approach A.

## 5. Approach A — `d3BarChart` (additive)

- Add `@api dataSource = "auto"` with values `auto` | `apex` | `graphql`. `"auto"`
  reproduces today's exact priority order (`recordCollection` → Apex aggregate → SOQL).
  `"graphql"` selects the new path.
- Add a reactive getter `_gqlQuery` that calls `graphqlService.buildAggregateQuery`
  from the configured props, and a `@wire(graphql, { query: '$_gqlQuery' })`.
- On wire `data`: `normalizeAggregate` → assign to `this.chartData` → reuse the existing
  `renderChart` pipeline. On wire `errors`: route through the existing error display.
- The existing `recordCollection`, `getAggregatedData`, and `executeQuery` paths are
  **untouched**. All current `d3BarChart` tests must stay green. New tests are purely
  additive.

**What A demonstrates:** GraphQL added with zero removal and the Apex escape hatch
intact. The cost is additive surface (one prop, one getter, one wire, normalizer).

## 6. Approach B — `d3GanttChart` (replace)

- **Remove** the `executeQuery` and `getDateRangeData` imports. The `recordCollection`
  data-in path stays.
- GraphQL `@wire(graphql, { query: '$_gqlQuery' })` becomes the **only** server path.
  `_gqlQuery` calls `graphqlService.buildRecordQuery` with
  `{ objectApiName, fields: [labelField, startDateField, endDateField], filter,
orderBy: startDateField, first: recordLimit }`.
- On wire `data`: `normalizeRecords` → `[{label, start, end}]` → existing
  `_prepareDateRows`. On wire `errors`: existing error display.
- The existing Apex-path gantt tests are **deleted/replaced** with GraphQL-path tests.

**What B demonstrates honestly:** the rip-and-replace cost — deleted tests, deleted
imports, imperative→reactive control-flow change, and **lost capability**: the
arbitrary-SOQL `soqlQuery` escape hatch and the typed date-range server endpoint are
gone. If a consumer needed a non-UI-API object or a complex WHERE clause, B breaks them.

## 7. Reactive `@wire` vs imperative `loadData`

Today's data fetch is imperative (`await executeQuery(...)` inside `connectedCallback`).
The GraphQL adapter is a reactive `@wire` — it re-runs whenever its inputs change, which
gives free auto-refresh but is a different control-flow shape. Both prototypes introduce
a reactive query getter; empty/error states are routed through each chart's existing
error-display path so behavior stays consistent with the other data paths.

## 8. Test strategy (TDD)

- **`graphqlService`** — unit tests for each builder and normalizer (pure functions:
  config in, query/variables out; raw GraphQL result in, normalized array out).
  This is the bulk of the coverage and is written first.
- **Wire-adapter test harness** — v2 `lightning/graphql` has **no** shipped
  `sfdx-lwc-jest` stub (only v1 `uiGraphQLApi` ships one). Add
  `__mocks__/lightning/graphql.js` mirroring the shipped v1 stub via
  `createTestWireAdapter` from `@salesforce/wire-service-jest-util`, and register it in
  `jest.config.js` `moduleNameMapper`. (This is an LWC test wire adapter, not a business
  mock — consistent with the project's existing `__mocks__/` Apex stubs.)
- **`d3BarChart`** — new GraphQL-path integration test using the wire test adapter's
  `.emit()` / `.emitErrors()`; all existing tests remain green.
- **`d3GanttChart`** — replace Apex-path tests with GraphQL-path tests.
- Full suite (`npm run test:unit`) green; output pristine.

## 9. Definition of done

- `graphqlService` exists with builders + normalizers and passing unit tests.
- `d3BarChart` renders from a GraphQL-stubbed wire via `dataSource="graphql"`; existing
  tests still pass.
- `d3GanttChart` renders solely from GraphQL; old Apex-path tests replaced.
- A memo at `docs/graphql-prototype-comparison.md` quantifying:
  - **A's additive cost:** lines/props added, nothing removed, escape hatch kept.
  - **B's replace cost:** lines/tests/imports removed, capabilities lost, control-flow
    change.
  - A rollout recommendation for the remaining 28 charts.

## 10. Known risks / limitations

- **UI API coverage:** GraphQL runs on the UI API, so big objects, external objects, and
  some system fields are unqueryable. The Apex path (kept in A, removed in B) is the only
  way to reach those.
- **Aggregate field/operator support** on the wire adapter must be confirmed against the
  configured object during implementation; not all fields aggregate.
- **v2 stub maintenance:** the hand-written `__mocks__/lightning/graphql.js` must track
  the real adapter's `{ data, errors }` emission contract.
