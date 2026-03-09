<!-- ABOUTME: Persistent architecture decision document for the d3-lwc chart library. -->
<!-- ABOUTME: Covers data flow, capacity limits, sampling, security, and component patterns. -->

# D3 LWC Chart Library — Architecture Decisions

This document captures the **why** behind key architecture decisions so future sessions don't re-derive them.

---

## 1. Data Flow Architecture

Every chart loads data through a 3-priority system. The priority order exists because each tier offers progressively less efficiency — we always prefer the most efficient path available.

### Priority 1: `recordCollection` (client-side aggregation)

When a parent component or Flow provides data directly via the `@api recordCollection` property, the chart skips all server calls. Data is validated, truncated to `MAX_RECORDS` (2,000), and aggregated client-side via `dataService.aggregateData()`.

**Why this is first:** Zero wire calls. The data is already in the browser. This is the path for Flow screen components and composite dashboards where a parent component manages data fetching.

### Priority 2: Server-side aggregation (`getAggregatedData`)

When `objectApiName`, `groupByField`, `valueField`, and `operation` are all configured, the chart calls `D3ChartController.getAggregatedData()`. The server builds a `GROUP BY` query, runs it, and returns pre-bucketed `{label, value}` pairs (max 200 groups).

**Why this is preferred over raw SOQL:** The server processes millions of records and returns ~50-200 aggregated rows. The client never sees the raw data. This eliminates the 2,000-record client-side truncation problem entirely — a `GROUP BY` over 500K Opportunities returns the same ~15 stage buckets regardless of total volume.

### Priority 3: SOQL fallback (`executeQuery` + client aggregation)

When only `soqlQuery` is set (no `objectApiName`), the chart calls `D3ChartController.executeQuery()`, which returns raw records (max 10,000 server-side, truncated to 2,000 client-side), then aggregates them in the browser.

**Why this exists:** Backward compatibility and ad-hoc use. Some consumers paste a SOQL string without configuring the full field set. The trade-off is that client-side aggregation can only process 2,000 records, so results may be incomplete for large datasets.

### Apex Methods Summary

| Method                                                                             | Purpose                                                   | Returns                                      | Limit                             |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- | --------------------------------- |
| `executeQuery(queryString)`                                                        | Raw SOQL execution with FLS                               | `List<SObject>`                              | 10,000 rows (auto-appended LIMIT) |
| `getAggregatedData(objectName, groupByField, valueField, operation, filterClause)` | Server-side GROUP BY                                      | `List<Map<String, Object>>` [{label, value}] | 200 groups                        |
| `getStatistics(queryString, valueField)`                                           | Descriptive stats (count, min, max, mean, median, stdDev) | `Map<String, Decimal>`                       | Bounded by query LIMIT            |
| `getCorrelation(queryString, xField, yField)`                                      | Pearson r, slope, intercept                               | `Map<String, Decimal>`                       | Bounded by query LIMIT            |

`getStatistics` and `getCorrelation` both fetch raw records server-side and compute results in Apex. They exist because computing population standard deviation or Pearson correlation on 10K records in Apex is cheaper than transferring 10K records to the browser for JavaScript math.

---

## 2. Visual Capacity Limits

`CHART_LIMITS` in `dataService.js` defines per-chart-type record caps. The key insight: **charts become useless beyond their visual comprehension ceiling.** More data doesn't help the visualization — it makes it worse. A global cap would be either too generous for some charts or too restrictive for others.

### Limits Table

| Chart Type    | Limit    | Reasoning                                                                                                                                        |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BAR`         | `null`   | Server GROUP BY; no raw records needed. Returns ~50-200 groups.                                                                                  |
| `DONUT`       | `null`   | Server GROUP BY; same rationale as bar.                                                                                                          |
| `TREEMAP`     | `null`   | Server GROUP BY; same rationale as bar.                                                                                                          |
| `HISTOGRAM`   | `10,000` | Needs raw values for binning math, but values are bucketed into ~20-50 visual bins. More raw data = better distribution accuracy.                |
| `SCATTER`     | `5,000`  | Points overlap beyond ~1K; `SVG_ELEMENT_CAP` (500) handles rendering separately via sampling. The 5K cap bounds data transfer, not SVG elements. |
| `LINE`        | `1,000`  | Time series with >1K points should be downsampled. Human eyes can't distinguish 1,000+ line segments.                                            |
| `FORCE_GRAPH` | `500`    | Force simulation is O(n log n) per tick. 500 nodes is the practical ceiling before the simulation becomes sluggish.                              |
| `GAUGE`       | `1`      | Single value display.                                                                                                                            |
| `CHOROPLETH`  | `500`    | Bounded by the number of geographic regions on the map.                                                                                          |
| `SANKEY`      | `1,000`  | Flow diagrams become unreadable beyond ~1K links.                                                                                                |

**Decision:** Aggregation charts (bar, donut, treemap) have `null` limits because they use server-side GROUP BY — the raw record count is irrelevant. The server handles millions of records and returns a handful of groups. New charts should add their entry to `CHART_LIMITS` based on visual capacity analysis, not a blanket default.

---

## 3. SVG Sampling Strategy

### The Problem

Scatter plots can have 5,000 data points, but rendering 5,000 SVG `<circle>` elements degrades browser performance (DOM size, event listeners, repaint cost). Naive truncation (take first N) distorts the distribution — it shows a biased slice of the data rather than its shape.

### The Solution: Stratified Sampling

`sampleData()` in `dataService.js` implements stratified sampling:

1. **Sort** all points by the specified field (typically the x-axis).
2. **Take evenly-spaced samples** across the sorted range (step = total / target count).
3. **Always include first and last points** to preserve the data extent (min/max).

This preserves the distribution shape because samples are drawn uniformly across the value range, not from one end. A scatter plot with 5,000 points sampled to 500 looks nearly identical to the full dataset.

### Why 500?

`SVG_ELEMENT_CAP = 500` was chosen as the rendering cap because:

- 500 SVG circles render smoothly with tooltips and hover effects across all browsers.
- Above ~800 elements, mobile Safari and older machines show noticeable jank on hover.
- 500 points are visually dense enough that adding more doesn't reveal additional patterns — the scatter cloud is already fully formed.

### Sampling vs. Truncation

| Approach         | Distribution preserved?          | Extent preserved?                | Use case                             |
| ---------------- | -------------------------------- | -------------------------------- | ------------------------------------ |
| `truncateData()` | No — biased toward early records | No                               | Record count guardrail (prevent OOM) |
| `sampleData()`   | Yes — stratified across range    | Yes — always includes first/last | SVG element count reduction          |

`truncateData()` is a safety valve applied early in the pipeline. `sampleData()` is a visual optimization applied just before rendering. They serve different purposes and are not interchangeable.

---

## 4. Server-Side vs. Client-Side Processing

### When to use server-side (Apex)

| Need                              | Apex Method         | Why server-side wins                                                      |
| --------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| Aggregation (bar, donut, treemap) | `getAggregatedData` | GROUP BY can process the full table; client would need all raw rows first |
| Descriptive statistics            | `getStatistics`     | stdDev over 10K records is cheaper in Apex than transferring 10K records  |
| Correlation / regression          | `getCorrelation`    | Same rationale — compute-heavy math on large datasets belongs server-side |

### When to use client-side (JavaScript)

| Need                              | Client Function       | Why client-side is acceptable                                                              |
| --------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| Aggregation of `recordCollection` | `aggregateData()`     | Data is already in the browser; no wire call savings possible                              |
| Histogram binning                 | Chart component logic | Binning depends on D3 scale configuration (bin count, domain) which is a rendering concern |
| Scatter point rendering           | Chart component logic | Individual points must be positioned by D3 scales                                          |

### Decision Rule

**If the computation reduces data volume (aggregation, statistics), do it server-side.** The wire transfer savings outweigh the Apex CPU cost. **If the computation is a rendering concern (binning, scaling, positioning), do it client-side.** Apex doesn't know about the chart's pixel dimensions or D3 scale configuration.

---

## 5. Security Model

### Record-Level Security

`D3ChartController` is declared `with sharing`. All SOQL executes in the context of the running user's sharing rules. There is no escape hatch.

### Field-Level Security

Every query result passes through `Security.stripInaccessible(AccessType.READABLE, results)` before being returned to the client. Fields the user cannot read are silently stripped. The one exception: `AggregateResult` records are not supported by `stripInaccessible` (Salesforce platform limitation), so they bypass this check. This is acceptable because `getAggregatedData` validates object and field existence via Schema describe before building the query.

### SOQL Injection Prevention

Three layers protect against injection:

1. **Query shape validation:** `executeQuery` rejects any input that doesn't start with `SELECT`. This prevents DML injection (`INSERT`, `UPDATE`, `DELETE`).

2. **Filter clause sanitization** (in `getAggregatedData`): The optional `filterClause` parameter is stripped of semicolons and checked against a blocklist of DML keywords (`INSERT`, `UPDATE`, `DELETE`, `UPSERT`, `MERGE`).

3. **Schema validation** (in `getAggregatedData`): `objectName`, `groupByField`, and `valueField` are validated against `Schema.getGlobalDescribe()` and the object's field map. If a field doesn't exist on the object, the request is rejected before any query is built. Field and object names are escaped via `String.escapeSingleQuotes()`.

**Design choice:** `executeQuery` accepts raw SOQL strings, which is inherently riskier than parameterized queries. This trade-off exists because the component needs to support arbitrary SOQL from App Builder configuration. The `with sharing` + `stripInaccessible` combination ensures the user can never see data they shouldn't, even if the query itself is broadly scoped.

---

## 6. Shared Module Responsibilities

### `d3Lib` — D3.js Loader

**What:** Singleton loader for D3.js v7 from static resources. Tries `loadScript` first (production path), falls back to `fetch` + `eval` for CSP-restricted environments (local dev preview).

**Why singleton:** D3 attaches to `window.d3`. Loading it twice is wasteful and can cause version conflicts. The singleton pattern (`loadPromise` guard) ensures exactly one load regardless of how many chart components are on the page.

**API:** `loadD3(this)` for first load, `getD3()` for cached access, `resetD3()` for test teardown.

**Where new functionality goes:** Only D3 loading concerns. Do not add chart-specific logic here.

### `dataService` — Data Processing

**What:** Validation (`validateData`, `validateFields`), truncation (`truncateData`), sampling (`sampleData`), aggregation (`aggregateData`), and the `CHART_LIMITS` / `SVG_ELEMENT_CAP` constants.

**Why separate:** Data processing is chart-agnostic. Every chart needs validation and truncation. Keeping it in one module prevents 10+ charts from each implementing their own bounds checking.

**Where new functionality goes:** Any data transformation that applies to 2+ chart types. Chart-specific transforms (e.g., histogram binning) stay in the chart component.

### `chartUtils` — Rendering Utilities

**What:** Number formatters (`formatNumber`, `formatCurrency`, `formatPercent`), label truncation, SLDS-styled tooltip creation, `ResizeObserver` management (`createResizeHandler`), dimension calculation, layout retry (`createLayoutRetry`).

**Why separate:** These are DOM/rendering concerns shared across all charts. Formatting and tooltips are standardized for visual consistency.

**Where new functionality goes:** Any rendering utility needed by 2+ charts. Tooltip variants, new formatters, accessibility helpers.

### `themeService` — Color Palettes

**What:** Four predefined palettes (Salesforce Standard, Warm, Cool, Vibrant), color cycling for datasets with more categories than palette colors, `createColorScale` for mapping labels to colors.

**Why separate:** Color management is a cross-cutting concern. Centralizing it ensures all charts on a page use the same palette when configured with the same theme.

**Where new functionality goes:** New palettes, accessibility-focused color schemes (colorblind-safe), dark mode support.

### Module Dependency Direction

```
Chart Component
  ├── d3Lib         (loads D3)
  ├── dataService   (processes data)
  ├── themeService  (provides colors)
  └── chartUtils    (formatting, tooltips, resize)
```

Shared modules do not depend on each other. Chart components depend on all four. This flat dependency graph keeps modules independently testable.

---

## 7. Component Lifecycle Pattern

Every chart follows a three-phase lifecycle with a layout retry mechanism:

### `connectedCallback` — Load Dependencies and Data

```
connectedCallback()
  → loadD3(this)           // async, singleton
  → loadData()             // 3-priority system (see section 1)
  → isLoading = false      // triggers re-render
```

All async work happens here. If anything fails, `this.error` is set and the template shows the error state. The chart container is not yet in the DOM during this callback, so no rendering happens here.

### `renderedCallback` — Initialize Chart (with layout retry)

```
renderedCallback()
  → if (showChart && !chartRendered):
      → initializeChart()  // measures container, creates SVG
      → if container width === 0:
          → createLayoutRetry(container, onLayout)
```

**Why layout retry exists:** In some Lightning contexts (App Builder preview, flex layouts, Local Dev Server), the container has zero width on first render because CSS layout hasn't completed. The `createLayoutRetry` utility uses `requestAnimationFrame` to poll the container (up to 60 frames, ~1 second at 60fps) until it has non-zero width. This avoids the alternative — setting arbitrary `setTimeout` delays that would be too short for some contexts and too long for others.

**The `chartRendered` guard:** Prevents re-initialization on every re-render. LWC calls `renderedCallback` whenever any tracked property changes. Without the guard, the chart would be destroyed and recreated on every state update.

### `disconnectedCallback` — Cleanup

```
disconnectedCallback()
  → _layoutRetry.cancel()      // stop RAF polling
  → resizeHandler.disconnect() // stop ResizeObserver
  → tooltip.destroy()          // remove tooltip from DOM
```

**Why explicit cleanup matters:** `ResizeObserver` and `requestAnimationFrame` callbacks hold references to the component. Without cleanup, removed components would leak memory and potentially throw errors when callbacks fire on a destroyed component.

### State Machine

```
┌──────────┐    connectedCallback     ┌──────────┐
│  LOADING │ ────────────────────────► │  READY   │
│(isLoading│   D3 loaded + data       │(showChart│
│  = true) │   fetched                │  = true) │
└──────────┘                          └────┬─────┘
      │                                    │
      │  error thrown                      │  renderedCallback
      ▼                                    ▼
┌──────────┐                          ┌──────────┐
│  ERROR   │                          │ RENDERED │
│(hasError │                          │(chartRen-│
│  = true) │                          │dered=true│
└──────────┘                          └──────────┘
```

The template uses conditional rendering (`if:true={isLoading}`, `if:true={hasError}`, `if:true={showChart}`) to display the appropriate state. Only one state is visible at a time.
