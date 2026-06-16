# Phase 3 Charts — Design Spec

- **Date:** 2026-06-15
- **Status:** Approved (design); pending implementation plan
- **Branch:** `phase3-charts` (off `master`)
- **Owner:** David

## 1. Goal

Add the next **10 chart components** to the d3-lwc library, shipped as a **full release package** (components + all three test tiers + a Phase 3 showcase flexipage + rebuilt SFDMU demo data + new Apex), and sync the result one-way to `agentforce-dev`. This takes the library from **20 → 30** chart components.

## 2. The 10 charts (selected)

Strategy: **finish the ROADMAP, then start the CHART-INDEX** (David's choice). The two backlog docs disagreed on order; we resolved in favor of finishing the higher-value ROADMAP charts first, then the simplest index charts.

**From ROADMAP (Weeks 11–16):** Sunburst · Chord Diagram · Gantt · Diverging Bar · Bubble · Waffle
**From CHART-INDEX Tier-1 (#1–4):** Horizontal Bar · Pie · Progress Bar · Lollipop

## 3. Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Selection strategy | Finish ROADMAP (6) + CHART-INDEX Tier-1 #1–4 (4) |
| 2 | Deliverable scope | Full release package (components + tests + flexipage + SFDMU data + Apex) |
| 3 | Test tiers | **Full 3-tier (unit + integration + e2e) for all 10** — honors the global no-exceptions testing rule |
| 4 | Apex for raw-row charts | **Add typed endpoints** `getDateRangeData` (Gantt) + `getXYData` (Bubble) |
| 5 | Demo data | **Rebuild generator + extend schema** — custom fields on existing objects, not new objects |

## 4. Current architecture (ground truth — verified from source, not docs)

> The ROADMAP/README/CLAUDE.md descriptions are stale in several places (see §10). The facts below were read directly from the code.

### 4.1 The cloneable component scaffold

Every chart is `export default class D3X extends NavigationMixin(LightningElement)` and copies this structure verbatim; only `renderChart()` and a few `@api` fields differ.

- **Imports:** `c/d3Lib` (`loadD3`), `c/dataService` (`prepareData`, `aggregateData`/etc., `OPERATIONS`, `MAX_RECORDS`/`CHART_LIMITS`), `c/themeService` (`getColors`, `DEFAULT_THEME`, …), `c/chartUtils` (formatters, `createTooltip`, `createResizeHandler`, `createLayoutRetry`, `buildTooltipContent`), `lightning/navigation`, and the Apex methods used.
- **Universal `@api`:** `recordCollection = []`, `soqlQuery`, `height`, `theme = DEFAULT_THEME`, `advancedConfig = "{}"`, `recordLimit`, `objectApiName = ""`, `filterField = ""`. Aggregation family adds `groupByField`, `valueField`, `operation = OPERATIONS.SUM`, `filterClause = ""`. Scatter/xy family uses `xAxisField`/`yAxisField`/`xAxisLabel`/`yAxisLabel`/`recordIdField = "Id"` (**note: real code uses `xAxisField`/`yAxisField`, NOT `xField`/`yField` as CLAUDE.md claims**).
- **`@track`:** `isLoading = true`, `error = null`, `chartData = []`.
- **Private fields:** `d3 = null`, `svg = null`, `tooltip = null`, `resizeHandler = null`, `chartRendered = false`, `_layoutRetry = null`, `_config = {}`, `_configParsed = false`.
- **Getters (verbatim in all):** `containerStyle`, `hasError`, `hasData`, `showChart`, `config` (lazy `JSON.parse(advancedConfig)` with try/catch → `{}`).
- **Lifecycle:**
  - `connectedCallback`: `this.d3 = await loadD3(this)` → `await this.loadData()` → `finally { isLoading = false }`. **No rendering here.**
  - `renderedCallback`: `if (showChart && !chartRendered) chartRendered = initializeChart()`; if it returns false and no retry in flight, start `createLayoutRetry`. **`initializeChart()` MUST return a boolean.**
  - `disconnectedCallback`: `_layoutRetry?.cancel()`; `cleanup()`.
- **`initializeChart()`:** `querySelector(".chart-container")`; `if (width === 0) return false`; `createTooltip`; `renderChart(width)`; `createResizeHandler(...).observe()`; `return true`.
- **`renderChart(width)`:** `d3.select(container).select("svg").remove()` first (idempotent — runs on init AND every resize); append svg+g with margin transform; colors from `getColors(theme, count, config.customColors)`.
- **`loadData()` 3-source cascade:** (1) `recordCollection` present → client-side `prepareData` + aggregate; (2) server path when `objectApiName && groupByField && valueField && operation` → `getAggregatedData({ objectName: this.objectApiName, groupByField, valueField, operation, filterClause: this.filterClause || null })`; (3) `soqlQuery` → `executeQuery({ queryString })` → client process; (4) else `throw new Error("No data source provided…")`.
- **HTML template:** single `.slds-card` root → 4-way conditional: `isLoading` (spinner) / `hasError` (`utility:error` + `{error}`) / `hasData` (`<div class="chart-container" lwc:dom="manual" style={containerStyle}>`) / else no-data (`utility:chart`). The mount div MUST be exactly `class="chart-container" lwc:dom="manual"`.
- **Meta:** `apiVersion 65.0` (Phase 2 standard), `isExposed true`, `masterLabel` friendly name, targets AppPage/RecordPage/HomePage, `targetConfigs` expose each `@api` as `<property>` (with `datasource="Sum,Count,Average"` / `datasource="Salesforce Standard,Warm,Cool,Vibrant"`, `min`/`max` on Integers). `recordCollection` is NOT exposed (Flow/programmatic only). Use `// ABOUTME:` line-comment header (2 lines).

### 4.2 Shared module API surface (exact)

**`dataService`** — `MAX_RECORDS = 2000`; `CHART_LIMITS` (per-chart cap map; **no Phase-3 keys exist yet**); `OPERATIONS = {SUM:"Sum",COUNT:"Count",AVERAGE:"Average"}` (only these three — no Min/Max/Median; unknown op silently falls back to Count); `SVG_ELEMENT_CAP = 500`. Functions: `validateData`, `validateFields` (inspects `data[0]` only), `truncateData`, `prepareData(data,{requiredFields,limit})`, `sampleData(data,sortField,limit)`, `aggregateData(data,groupByField,valueField,operation)` → `[{label,value}]` sorted value-desc, `aggregateSeriesData(data,groupByField,seriesField,valueField,operation)` → flat `[{label,series,value}]` (NOT nested/pivoted), `computeQuartiles(data,valueField)`, `computeRunningTotal(data)`. Null group keys collapse to a literal `"Null"` bucket.

**`chartUtils`** — `formatNumber(v,decimals=1)`, `formatCurrency(v,currency="USD")`, `formatPercent(v,decimals=1)` (**input is a 0–1 decimal**), `truncateLabel(label,max=20)`, `createTooltip(container)` → `{show(html,x,y),hide(),destroy()}`, `buildTooltipContent(label,value,{formatter,prefix,suffix})`, `createResizeHandler(container,cb,debounceMs=250)` → `{observe(),disconnect()}`, `calculateDimensions(w,h,margins)`, `shouldUseCompactMode(width,min=300)`, `createLayoutRetry(container,onLayout,{maxAttempts=60})` → `{cancel()}`, `getContrastColor(hex)` → `#000`/`#fff`, `buildCalendarGrid(year)`. **No date-range/scaleTime helper exists.**

**`themeService`** — `PALETTES` (4 named, 10 hex each; key `"Salesforce Standard"` has a space), `THEMES`, `DEFAULT_THEME = "Salesforce Standard"`, `getColors(theme,count,custom=null)`, `createColorScale(theme,domain,custom=null)` (label→color Map; unseen labels fall back to colors[0] — build full domain first), `getColor(theme,index=0,custom=null)`, `SEMANTIC_COLORS = {positive:"#4BCA81",negative:"#FF5D5D",neutral:"#B0C4DE",subtotal:"#1589EE"}`, `getSequentialRamp(hue,steps)` (hue ∈ blue/green/red).

**`d3Lib`** — `loadD3(component)` (singleton; loadScript → fetch+eval → CDN fallback; **d3 v7.9.0**, full namespace), `getD3()`, `resetD3()` (tests only — chart tests mock `c/d3Lib` entirely and never call it).

### 4.3 Apex (`D3ChartController`, `public with sharing`, FLS via `Security.stripInaccessible`)

- `executeQuery(queryString)` → `List<SObject>`; auto-appends `LIMIT 10000` (the real cap; CLAUDE.md "2000" is the separate client-side number).
- `getAggregatedData(objectName, groupByField, valueField, operation, filterClause)` → `[{label,value}]`, LIMIT 200 groups, ORDER BY aggregate DESC.
- `getMultiGroupData(objectName, groupByField, seriesField, valueField, operation, filterClause)` → `[{label,series,value}]`, LIMIT 2000, ORDER BY groupByField. **Exists** (commit f2a9d16).
- `getCorrelation(queryString, xField, yField)` → `{r,slope,intercept}`.
- `getStatistics(queryString, valueField)` → `{count,min,max,mean,median,stdDev}` (no quartiles).
- Helpers: `hasAggregateFunctions`, `buildException`, injection guard (strips `;`, blocks DML keywords, `escapeSingleQuotes`). AggregateResult rows bypass `stripInaccessible`.

## 5. Per-chart specs

| Chart | Component | Clone donor | Data path | New D3 | New code |
|-------|-----------|-------------|-----------|--------|----------|
| Horizontal Bar | `d3HorizontalBarChart` | `d3BarChart` | `getAggregatedData` | bandScale on Y | none (axis swap) |
| Pie | `d3PieChart` | `d3DonutChart` | `getAggregatedData` | `d3.pie`+`d3.arc` | none (no inner radius) |
| Lollipop | `d3LollipopChart` | `d3BarChart` | `getAggregatedData` | line+circle | none |
| Progress Bar | `d3ProgressBar` | `d3BulletChart` | `getAggregatedData` (1 row) | rect+marker | config `target` |
| Diverging Bar | `d3DivergingBarChart` | `d3BarChart` | `getAggregatedData` (signed) | centered linear domain | symmetric domain `[-max\|v\|,+max\|v\|]` inline; `SEMANTIC_COLORS` |
| Waffle | `d3WaffleChart` | `d3DonutChart` | `getAggregatedData` Count | grid of rects | 10×10 cell allocator (inline); `getContrastColor` |
| Sunburst | `d3SunburstChart` | `d3Treemap` | `getMultiGroupData` / client nest | `d3.partition`+`d3.arc`+`d3.hierarchy` | shared `buildHierarchy` (new); arc render |
| Bubble | `d3BubbleChart` | `d3ScatterPlot` | **`getXYData`** (new) / `executeQuery` | `d3.scaleSqrt` | `@api sizeField` (+`sizeLabel`); area-radius scale |
| Chord | `d3ChordDiagram` | *(new)* | `getMultiGroupData` | `d3.chord`+`d3.ribbon`+`d3.arc` | shared `buildMatrix` (new) |
| Gantt | `d3GanttChart` | *(new)* | **`getDateRangeData`** (new) / `executeQuery` | `d3.scaleTime` | date-range util (new); `@api startDateField`/`endDateField`/`labelField` |

**Notes**
- Chord: `getMultiGroupData` already returns a `{label(source), series(target), value}` edge list — `buildMatrix` pivots it into a square `number[][]` + index→label map for `d3.chord()`. No new Apex.
- Sunburst: mirrors `d3Treemap`'s three data paths (`hierarchyData` @api, server single-level via `getAggregatedData`, client nest). Two-level hierarchy via `getMultiGroupData`. We add a **shared** `buildHierarchy` to `dataService` for the new chart to use rather than refactoring the working Treemap.
- Progress Bar / Diverging Bar / Waffle / Pie / Horizontal Bar / Lollipop: all single-dimension aggregation — `getAggregatedData` covers them; no new Apex.

## 6. Shared infrastructure changes (additive — existing working charts untouched)

1. **`dataService`:** add 10 `CHART_LIMITS` keys (aggregation charts → `null`; Bubble/Chord/Sunburst/Gantt → bounded raw caps). Add `buildMatrix(edges, srcKey, tgtKey, valKey)` → `{matrix, labels}`. Add `buildHierarchy(rows, fields[], valueField, operation)` → nested `{name, children}`.
2. **`chartUtils`:** add `parseDate(value)` and `computeDateExtent(rows, startField, endField)` → `[minDate, maxDate]` for Gantt's `d3.scaleTime` domain.
3. **`D3ChartController` (Apex):** add `getDateRangeData(objectName, labelField, startField, endField, filterClause)` → `[{label,start,end}]` and `getXYData(objectName, xField, yField, sizeField, labelField, filterClause)` → `[{x,y,size,label}]`. Reuse the existing Schema-describe validation + injection guard + `stripInaccessible`. Add ~16 methods to `D3ChartControllerTest`.
4. **`jest.config.js`:** add `moduleNameMapper` entries for `getMultiGroupData` (missing today), `getDateRangeData`, `getXYData`. Add matching `__mocks__/@salesforce/apex/D3ChartController.*.js` stubs.
5. **Pre-flight:** verify `force-app/main/default/staticresources/d3.js` is the full v7.9.0 build (contains `d3.chord`, `d3.partition`, `d3.ribbon`, `d3.scaleTime`) before the charts that depend on them are built.

## 7. Demo data & showcase

- **Schema (custom fields on existing objects):** `Opportunity.Project_Start__c` (Date), `Opportunity.Project_End__c` (Date) for Gantt; `Opportunity.Forecast_Units__c` (Number) for Bubble's 3rd dimension. Chord reuses existing picklists (`StageName × LeadSource`) via `getMultiGroupData` — no schema. Field metadata committed under `force-app/main/default/objects/Opportunity/fields/`.
- **Generator:** rebuild `sfdmu/generate_data.py` (uv + faker, per the original plan). Recover `export.json` from git and extend it with the new fields. Regenerate the gitignored CSVs (`Account.csv`, `Opportunity.csv`).
- **Showcase flexipage:** `force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml` — clone the Phase 2 file (single `main` region, `flexipage:defaultAppHomeTemplate`, `<type>AppPage</type>`); `masterLabel` = `d3-lwc Phase 3`; one `<itemInstances>` block per new chart with demo props (`<identifier>` = `c_` + componentName; values are strings). Each chart must list `lightning__AppPage` in its meta to be placeable.

## 8. Testing strategy (full 3-tier, TDD, pristine output)

Reference donors with all three tiers: `d3BarChart`, `d3DonutChart`, `d3Gauge`. **Note:** a chart's *component* donor (§5) may differ from its *test-tier* donor — e.g. Bubble clones `d3ScatterPlot` for the component, but Scatter is unit-only, so its integration/e2e suites are templated from `d3BarChart`/`d3DonutChart`/`d3Gauge`, not Scatter. Per new chart:

- **Unit (`*.test.js`):** mock `c/d3Lib`, Apex methods, `lightning/*`. Describe taxonomy to mirror: initialization, data handling, data edge cases, aggregation operations, configuration, themes, click/events, tooltip behavior, responsive behavior (incl. RAF layout-retry), error recovery, rendering details (assert the chart's actual `d3.*` calls), server aggregation, getters, cleanup.
- **Integration (`*.integration.test.js`):** mock ONLY `c/d3Lib` + Apex + `lightning/navigation` + `lightning/platformShowToastEvent`; run **real** `dataService`/`themeService`/`chartUtils`. Assert real aggregated/sorted values and real palette hex (`#1589EE` SF Standard, `#FF6B6B` Warm) flow into `mockD3.data()`. Use `flushPromises = () => new Promise(process.nextTick)` so it survives `jest.useFakeTimers()` in the resize-debounce test.
- **E2E (`*.e2e.test.js`):** full lifecycle (create → load → render → assert SVG + data bound + spinner gone + no error), cleanup-on-disconnect, multi-component isolation, data-flow verification (exact values), truncation semantics.

**Mechanics:** each chart needs its OWN inline `createMockD3()` extended with exactly its D3 primitives (arc/pie/scaleSqrt/scaleTime/chord/ribbon/partition/etc.) — mismatch throws `is not a function`. Scale mocks are callable `jest.fn()` with chainable setters attached. `createChart()` helper appends to body + `await flushPromises()` **twice**. `beforeEach`: stub `Element.prototype.getBoundingClientRect` (non-zero width) + `global.ResizeObserver`; spy/silence `console.error` & `console.warn`. `afterEach`: drain `document.body`, restore spies, `jest.clearAllMocks()`. Error-path tests assert the console spy WAS called; success/e2e assert it was NOT. **Update README's exact test/suite counts** when done.

## 9. Build sequencing (subagent-driven)

1. **Branch:** `phase3-charts` off `master`.
2. **Foundation (sequential — shared files):** `dataService` (`CHART_LIMITS`, `buildMatrix`, `buildHierarchy`); `chartUtils` (date-range utils); Apex (`getDateRangeData`, `getXYData` + tests); `jest.config.js` + `__mocks__`; custom-field metadata; SFDMU generator + `export.json` + CSVs; d3-static-resource full-build check. Each with TDD.
3. **Charts (easiest → hardest, one subagent per chart, full 3-tier TDD, cloning the donor):** Pie → Horizontal Bar → Lollipop → Progress Bar → Diverging Bar → Waffle → Sunburst → Bubble → Chord → Gantt.
4. **Integration:** Phase 3 flexipage; update README (counts + 30-chart tables), ROADMAP + CHART-INDEX status; fix + extend `scripts/sync-to-agentforce.sh`; merge-sync metas + classes + services + components + tests + mocks to `agentforce-dev`.

## 10. Risks / known stale-doc traps

- **ROADMAP Week 13 lie:** "date-range utilities in chartUtils" do NOT exist — Gantt builds them (§6.2).
- **Test reality:** only 3/21 charts have all tiers; README "all tiers/component" is aspirational. We raise the bar for the new 10.
- **SFDMU absent:** `generate_data.py` was never committed; `export.json` removed (git-recoverable); CSVs gitignored. Rebuild required.
- **`sync-to-agentforce.sh` stale:** `CHART_COMPONENTS` lists only the original 10 (skips all Phase-2 charts). Fix + extend, or new charts silently don't sync.
- **Meta merge:** `agentforce-dev` metas carry `lightningCommunity__Page`/`FlowScreen` targets the d3-lwc copies lack — MERGE, never replace.
- **API surface mismatches:** scatter uses `xAxisField`/`yAxisField` (not `xField`/`yField`); Apex param is `objectName` (not `objectApiName`); `formatPercent` wants a 0–1 decimal; unknown `operation` silently → Count; `createColorScale` falls back to colors[0] for unseen labels (build full domain first).
- **`getMultiGroupData` has no `moduleNameMapper` entry** in `jest.config.js` today — wire it before Chord/Sunburst tests run.
- **`apiVersion` drift:** new component metas = 65.0; the Apex controller meta is pinned 59.0.

## 11. Definition of done

- 10 new chart components, each cloning its donor and following §4.1, deployable to a scratch/dev org.
- Full 3-tier tests per chart, all green, **pristine output** (no leaked console errors); README counts updated to match.
- New Apex endpoints + tests; `jest.config.js` + `__mocks__` wired.
- Custom fields + rebuilt SFDMU generator + regenerated CSVs; Phase 3 showcase flexipage renders all 10 against demo data.
- `sync-to-agentforce.sh` fixed + extended; metadata merge-synced to `agentforce-dev`.
- ROADMAP + CHART-INDEX status updated (these 10 marked Done).
