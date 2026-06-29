# GraphQL Self-Fetch Prototype — A vs B Comparison

## What was built

- `graphqlService` (shared): record + aggregate query builders, structured-filter
  mapper, normalizers. Unit-tested in isolation (128 lines impl, 203 lines tests).
- Approach A (additive) on `d3BarChart`: new `fetchMode="graphql"` path alongside
  the existing recordCollection/Apex paths. (Note: the prop was named `fetchMode`,
  **not** `dataSource` — LWC raises compile error LWC1107 for `@api` properties
  starting with `data`. Any spec/plan reference to `dataSource` is stale doc-drift.)
- Approach B (replace) on `d3GanttChart`: GraphQL is the only server path; Apex
  imports and `soqlQuery` removed.

## Cost comparison

| Dimension                  | A (bar, additive)                                                      | B (gantt, replace)                                                                        |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Lines added (prod)         | +86 lines in `d3BarChart.js`, 0 deletions                              | 113 lines changed in `d3GanttChart.js` (net mix of additions + deletions); meta XML −9    |
| Test lines added/removed   | +111 lines (new `d3BarChart.graphql.test.js`), 0 lines removed         | e2e −58 lines (file deleted), integration −45 lines, unit file net −153 lines (266 churn) |
| Tests removed/added        | 0 removed; 2 new GraphQL tests added (99 bar total)                    | 10 Apex-path tests removed, 2 GraphQL tests added (net −8); gantt suite now 54 tests      |
| Capabilities lost          | none (Apex kept as escape hatch)                                       | arbitrary-SOQL `soqlQuery` escape hatch + typed `getDateRangeData` date-range endpoint    |
| Control-flow change        | imperative + reactive coexist                                          | imperative → reactive only                                                                |
| Risk to existing consumers | none                                                                   | breaks any consumer needing non-UI-API objects or complex WHERE clauses                   |
| Reversibility              | trivial (additive paths can be removed without touching existing code) | requires restoring the Apex import path, deleted tests, and orphaned config props         |

### Deviation discovered during Approach B build

Approach B left `@api filterClause` orphaned on the gantt: the old SOQL-fragment
filter prop still appears in App Builder metadata but is no longer read anywhere —
`graphqlFilter` replaced its role. This is a real replace-cost: replacing a data
path leaves orphaned configuration properties that need explicit migration or
follow-up cleanup before consumers can safely upgrade. This prop was not removed
during the prototype to keep the scope bounded, but it must be addressed before
any production rollout of Approach B.

## Aggregate-shape verification result

**PENDING — NOT YET VERIFIED.**

The GraphQL aggregate response envelope (`node.aggregate.<field>.<fn>.value`)
used by the bar chart's `normalizeAggregate` is the best-known shape based on
Salesforce documentation, but was **not** confirmed against a live scratch org —
no authorized org was available during the build. The query string is structurally
well-formed (brace-balanced, verified locally), and the normalizer correctly
extracts `node.aggregate[valueField][operation].value`.

Live scratch-org verification remains a **required gate before any production
rollout**. If the actual response envelope differs, the pre-authorized fallback is
a raw-row GraphQL fetch combined with the bar chart's existing client-side
`_aggregateRawData` method — no new logic needed.

## Recommendation for the remaining 28 charts

**Default to Approach A (additive).**

The cost table is clear: Approach A adds a new capability without removing
anything. Every existing consumer continues to work unchanged. The Apex path
remains the escape hatch for objects not exposed through the GraphQL UI API, for
queries requiring complex WHERE clauses, or for any scenario where GraphQL's
query-builder constraints are insufficient. The test suite grows (not shrinks),
preserving the safety net. The one real cost is a modestly larger per-chart
surface (roughly +86 prod lines per chart) and a minor UX nit — the component
renders a brief "no-data" state before the wire resolves, which is acceptable in
all Salesforce Lightning contexts.

**Reserve Approach B (replace) only when:**

1. The chart's domain is proven never to need non-UI-API objects or arbitrary SOQL
   (i.e., the Apex escape hatch has no realistic use case for that chart).
2. The team explicitly accepts the deleted tests, the lost `soqlQuery` capability,
   and commits to following up on any orphaned configuration properties before
   shipping to consumers.

Even in those cases, the team should weigh whether the simplified control flow is
worth the reduced test coverage and irreversibility. Approach A's "imperative +
reactive coexist" model is slightly more complex to read, but significantly safer
to ship and easier to roll back.

**Implementation path for the remaining 28 charts:** add `graphqlService` as a
shared import (already built), wire `fetchMode="graphql"` alongside the existing
`recordCollection`/`soqlQuery` branches, and write 2–3 focused GraphQL tests per
chart. Aggregate-shape verification (above) must be cleared in a live org before
merging any chart that uses `buildAggregateQuery` + `normalizeAggregate`.
