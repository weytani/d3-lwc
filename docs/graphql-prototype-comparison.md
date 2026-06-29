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

Approach B found `@api filterClause` orphaned on the gantt: the old SOQL-fragment
filter prop still appeared in App Builder metadata but was no longer read anywhere —
`graphqlFilter` replaced its role. The prototype REMOVED both the `@api filterClause`
field and its `<property>` block from the meta XML. The lasting lesson: replacing a
data path requires auditing and removing orphaned config props per chart before
exposing the component to admins — an admin-visible field that the component silently
ignores is a real UX defect, and the cleanup cost must be counted in the replace-cost
column. This cost point therefore stands even though the specific prop is now clean.

## Aggregate-shape verification result

**VERIFIED against a live org** (AGENT, orgfarm dev-ed, UI API GraphQL endpoint
`/services/data/v65.0/graphql`). The gate caught a real divergence: the encoded
best-known shape was **wrong in two ways**, now corrected and confirmed.

The encoded query placed the aggregate under `uiapi.query.<Object>(groupBy: …)` with
the group key at `node.<groupByField>`. The live org rejected this
(`Unknown field argument 'groupBy'` on `uiapi/query`; `Field 'aggregate' … is
undefined`). Schema introspection revealed the real structure: aggregates live under
a separate `uiapi.aggregate` root, and the node carries an extra `aggregate { }`
wrapper holding both the grouping key and the measures:

```
uiapi { aggregate { Opportunity(groupBy: { StageName: {} }, first: 2000) {
  edges { node { aggregate {
    StageName { value }          // grouping key — node.aggregate.<groupByField>.value
    Amount { sum { value } }     // measure    — node.aggregate.<valueField>.<fn>.value
  } } } } } }
```

The corrected query returned **10 real StageName groups with grouped Amount sums**
(e.g. Proposal/Price Quote $2,343,664). Two functions were fixed accordingly:
`buildAggregateQuery` (root `query`→`aggregate`, node `aggregate { }` wrapper) and
`normalizeAggregate` (`uiapi.aggregate` path, group key under `node.aggregate`); their
unit tests and the bar chart's GraphQL test mock were updated to the verified
envelope. The measure path (`node.aggregate.<valueField>.<fn>.value`) was already
correct.

The **record-query** envelope (Approach B / gantt —
`data.uiapi.query.<Object>.edges[].node.<field>.value`) was also confirmed live (an
Account record query returned exactly that shape); no change was needed. The
pre-authorized raw-row fallback was **not** required — the aggregate API works, it
simply lives at a different path than first encoded.

## Live-org deploy + render verification

**Approach A (bar) — fully verified end-to-end.** `graphqlService` + `d3BarChart`
were deployed to a live org, and the bar chart was placed on a Lightning page with
`fetchMode=graphql`, `objectApiName=Opportunity`, `groupByField=StageName`,
`valueField=Amount`, `operation=Sum`. The component **rendered 10 bars from live
Opportunity data** (one per stage, Amount-sum y-axis to ~$6M, "Closed Won" tallest)
with **zero console errors**. This confirms the two layers the API check could not:
the `lightning/graphql` `gql` tag accepts a fully-interpolated query string
(`gql\`${queryString}\``, not just fragment interpolation), and the full
wire→normalize→D3 pipeline works on the real adapter. The `fetchMode` property was
selectable in App Builder, confirming the meta exposure.

**Approach B (gantt) — replace-cost confirmed on deploy.** Deploying the gantt
changes **failed**: Salesforce refused to remove the `soqlQuery` and `filterClause`
property tags because an existing Lightning page (`d3_lwc_phase3`) references them
(`You can't remove the property tag … The component is in use on one or more
Lightning pages`). Because deploys are transactional, the whole gantt deploy rolled
back. This is the orphaned-config / migration burden predicted above, now empirical:
**Approach B cannot be deployed to a chart already in use without first removing it
from every referencing page** — a migration step Approach A never incurs. This
strengthens the "risk to existing consumers" and "reversibility" rows of the cost
table with a concrete failure mode.

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
