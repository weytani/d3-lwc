# D3-LWC Chart Index: Next 50 Charts

> Curated from [d3js.org gallery](https://observablehq.com/@d3/gallery) for Salesforce relevance.
> Excludes all map/geographic visualizations.
> Ordered by implementation complexity (1 = simplest, 50 = most complex).
> All charts build on the existing shared architecture: `d3Lib`, `dataService`, `themeService`, `chartUtils`, `D3ChartController`.

## Already Built (10)

| # | Component | Status |
|---|-----------|--------|
| — | `d3Gauge` | Done |
| — | `d3BarChart` | Done |
| — | `d3DonutChart` | Done |
| — | `d3LineChart` | Done |
| — | `d3ScatterPlot` | Done |
| — | `d3Histogram` | Done |
| — | `d3Treemap` | Done |
| — | `d3Sankey` | Done |
| — | `d3ForceGraph` | Done |
| — | `d3Choropleth` | In Progress |

## Already Planned in ROADMAP.md (16)

| # | Chart | Status |
|---|-------|--------|
| — | Funnel | Planned |
| — | Stacked Bar | Planned |
| — | Area | Planned |
| — | Bullet | Planned |
| — | Heatmap | Planned |
| — | Box Plot | Planned |
| — | Radar | Planned |
| — | Waterfall | Planned |
| — | Calendar Heatmap | Planned |
| — | Sparkline Grid | Planned |
| — | Sunburst | Planned |
| — | Chord Diagram | Planned |
| — | Gantt | Planned |
| — | Diverging Bar | Planned |
| — | Bubble | Planned |
| — | Waffle | Planned |

---

## Next 50 Charts

### Tier 1: Simple (Complexity 1–2)

Minor variants of existing components or well-established D3 patterns with minimal new concepts. Each can reuse existing `dataService` and `chartUtils` almost entirely.

| # | Chart | D3 Gallery Ref | Component Name | Salesforce Use Case | New D3 Concepts |
|---|-------|---------------|----------------|--------------------|-----------------|
| 1 | **Horizontal Bar Chart** | Bars → Horizontal bar chart | `d3HorizontalBarChart` | Long field labels (Account Name, Product Name, full picklist values) that clip in vertical bars | Rotate axes from existing `d3BarChart`; bandScale on Y |
| 2 | **Pie Chart** | Radial → Pie chart | `d3PieChart` | Admins who specifically want pie over donut; simpler mental model for part-to-whole | `d3.pie()` + `d3.arc()` — simpler than existing donut (no inner radius) |
| 3 | **Progress Bar (Linear Gauge)** | — (custom) | `d3ProgressBar` | Quota attainment, goal completion, adoption percentage — simpler than gauge for single KPIs | Single rect + target marker; minimal D3 |
| 4 | **Lollipop Chart** | — (custom) | `d3LollipopChart` | Rep leaderboards, ranked metrics — cleaner than bars, less ink | Line + circle per category; extends bar chart pattern |
| 5 | **Dot Plot (Cleveland)** | Dots → Dot plot | `d3DotPlot` | Precise value comparison across categories; better than bars when values are close | Points on categorical Y axis; `d3.scalePoint()` |
| 6 | **Sorted Bar Chart** | Animation → Sortable bar chart | `d3SortedBarChart` | Interactive ranking — sort by name, value, or custom field; animated reordering | `d3.transition()` on bar positions; sort comparators |
| 7 | **Step Chart** | — (custom, `d3.curveStepAfter`) | `d3StepChart` | Stage duration, pricing tiers, discrete state changes over time | `d3.curveStepAfter` on existing line pattern |
| 8 | **Slope Chart** | Lines → Slope chart | `d3SlopeChart` | Period-over-period comparison (Q1 vs Q2, this year vs last year, before/after intervention) | Two vertical axes + connecting lines; `d3.scalePoint()` |
| 9 | **Stacked Horizontal Bar** | Bars → Stacked horizontal bar chart | `d3StackedHorizontalBar` | Composition by category with long labels; multi-field breakdown | `d3.stack()` + horizontal layout |
| 10 | **Icon Array (Unit Chart)** | — (custom) | `d3IconArray` | Executive dashboards — "37 out of 100 deals closed" as filled squares; visceral impact | Grid of rects/symbols; `d3.symbol()` optional |

### Tier 2: Low-Medium (Complexity 3–4)

One or two new D3 concepts beyond existing patterns. May require small `dataService` extensions.

| # | Chart | D3 Gallery Ref | Component Name | Salesforce Use Case | New D3 Concepts |
|---|-------|---------------|----------------|--------------------|-----------------|
| 11 | **Stacked Normalized Horizontal Bar** | Bars → Stacked normalized horizontal bar chart | `d3NormalizedBar` | 100% composition comparison — "what % of each rep's pipeline is in each stage?" | `d3.stack().offset(d3.stackOffsetExpand)` |
| 12 | **Variable-Color Line** | Lines → Variable-color line | `d3VariableColorLine` | Line that turns red below target, green above; threshold-based visual alerts | Gradient stops keyed to data values; `linearGradient` SVG |
| 13 | **Band Chart** | Areas → Band chart | `d3BandChart` | Forecast confidence intervals, acceptable ranges, SLA bounds | `d3.area()` with `y0`/`y1` for upper/lower |
| 14 | **Difference Chart** | Areas → Difference chart | `d3DifferenceChart` | Plan vs actual, budget vs spend — shaded green where actual > plan, red where under | Two-area clip-path technique; positive/negative fills |
| 15 | **Dumbbell Chart** | — (custom) | `d3DumbbellChart` | Before/after, min/max per category, target vs actual per rep — paired dot comparison | Two circles + connecting line per row; `d3.scaleBand()` |
| 16 | **Moving Average Overlay** | Analysis → Moving average | `d3MovingAverage` | Trend smoothing on any time series; 7-day/30-day rolling average on cases, pipeline, revenue | Rolling window computation + secondary line path |
| 17 | **Connected Scatterplot** | Animation → Connected scatterplot | `d3ConnectedScatter` | Customer journey (satisfaction vs spend over time), deal trajectory (probability vs amount over weeks) | Line path connecting chronologically ordered scatter points |
| 18 | **Grouped Horizontal Bar** | — (variant) | `d3GroupedHorizontalBar` | Multi-series side-by-side comparison with long labels; rep × quarter performance | Nested `d3.scaleBand()` + horizontal orientation |
| 19 | **Diverging Stacked Bar** | Bars → Diverging stacked bar chart | `d3DivergingStackedBar` | Likert scale survey results, NPS breakdown, sentiment distribution per category | `d3.stack().offset(d3.stackOffsetDiverging)` |
| 20 | **Radial Bar Chart** | Radial → Radial stacked bar chart | `d3RadialBarChart` | Compact categorical comparison; activity metrics in a dense layout | Polar coordinate transform; `d3.arc()` for bars |

### Tier 3: Medium (Complexity 5–6)

New layout algorithms, moderate interaction patterns, or statistical computation. May require `dataService` or `chartUtils` extensions.

| # | Chart | D3 Gallery Ref | Component Name | Salesforce Use Case | New D3 Concepts |
|---|-------|---------------|----------------|--------------------|-----------------|
| 21 | **Marimekko Chart** | Bars → Marimekko chart | `d3MarimekkoChart` | Market share × segment size; product revenue × category volume — width AND height encode data | Variable-width stacked bars; two-dimensional `d3.stack()` |
| 22 | **Candlestick Chart** | Lines → Candlestick chart | `d3CandlestickChart` | Financial orgs: stock/deal OHLC; any dataset with open/close + high/low ranges per period | Rect (body) + line (wick) per data point; `d3.scaleTime()` |
| 23 | **Streamgraph** | Areas → Streamgraph | `d3Streamgraph` | Composition change over time with organic feel; case volume by type, pipeline by source | `d3.stack().offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut)` |
| 24 | **Ridgeline (Joy) Plot** | Areas → Ridgeline plot | `d3RidgelinePlot` | Compare distributions across categories (deal size by stage, response time by team, score by quarter) | Overlapping `d3.area()` paths with vertical offset per category |
| 25 | **Beeswarm Plot** | Dots → Beeswarm | `d3BeeswarmPlot` | Show individual records avoiding overlap; see every deal, every case, every rep's number | `d3.forceSimulation()` with `forceX`/`forceY` + collision |
| 26 | **Word Cloud** | Fun → Word cloud | `d3WordCloud` | Text field analysis — case descriptions, call notes, survey responses, chatter posts | `d3-cloud` layout algorithm (separate module); text sizing |
| 27 | **Circle Packing** | Hierarchies → Circle packing | `d3CirclePacking` | Hierarchical data as nested circles; alternative to treemap for org/product/territory breakdown | `d3.pack()` layout; nested circle rendering |
| 28 | **Icicle Chart** | Hierarchies → Icicle | `d3IcicleChart` | Top-down rectangular hierarchy; file/category/path analysis with proportional sizing | `d3.partition()` layout; rectangular subdivision |
| 29 | **Kernel Density Plot** | Analysis → Kernel density estimation | `d3KernelDensity` | Smooth distribution curve; better than histogram for comparing shapes of distributions | KDE computation (Epanechnikov/Gaussian kernel); `d3.area()` |
| 30 | **Index Chart** | Interaction → Index chart | `d3IndexChart` | Normalized comparison — "how did each rep/product/region perform relative to their starting point?" | Normalize all series to 100 at reference point; interactive reference selection |

### Tier 4: Medium-High (Complexity 7–8)

Significant interaction patterns, complex layouts, or multiple D3 modules working together.

| # | Chart | D3 Gallery Ref | Component Name | Salesforce Use Case | New D3 Concepts |
|---|-------|---------------|----------------|--------------------|-----------------|
| 31 | **Horizon Chart** | Areas → Horizon chart | `d3HorizonChart` | Dense multi-metric time series dashboard; 20+ metrics in the space of 5 line charts | Band slicing + color layering; mirror negative values |
| 32 | **Zoomable Bar Chart** | Animation → Zoomable bar chart | `d3ZoomableBarChart` | Drill into hierarchical categories (Region → Country → City → Account) with animated transitions | `d3.zoom()` + hierarchical data traversal; animated axis transitions |
| 33 | **Brushable Scatterplot** | Interaction → Brushable scatterplot | `d3BrushableScatter` | Interactive filtering — brush a region to select records, fire Flow/navigation events | `d3.brush()` + selection events; linked highlighting |
| 34 | **Radial Area Chart** | Radial → Radial area chart | `d3RadialAreaChart` | Seasonal/cyclical patterns — monthly revenue, weekly activity, daily patterns in polar layout | Polar `d3.area()` with `d3.scaleRadial()`; angle mapping |
| 35 | **Arc Diagram** | Networks → Arc diagram | `d3ArcDiagram` | Sequential relationships — record handoffs, approval chain, case escalation path | Nodes on line + `d3.arc()` connections; `d3.scalePoint()` |
| 36 | **Hexbin Chart** | Analysis → Hexbin | `d3HexbinChart` | Dense scatter data (1000+ points) — aggregate into hex bins showing density; large opportunity datasets | `d3.hexbin()` module; color + size encoding |
| 37 | **Tidy Tree (Org Chart)** | Hierarchies → Tidy tree | `d3TidyTree` | Reporting structure, approval hierarchies, account team org charts | `d3.tree()` layout; node-link rendering; curved links |
| 38 | **Indented Tree** | Hierarchies → Indented tree | `d3IndentedTree` | Collapsible list view — role hierarchy, product catalog, territory tree | `d3.hierarchy()` + HTML-style indentation; expand/collapse |
| 39 | **Parallel Coordinates** | Lines → Parallel coordinates | `d3ParallelCoords` | High-dimensional exploration — compare accounts across 5+ metrics simultaneously; outlier detection | Multiple parallel `d3.scaleLinear()` axes; polyline paths; `d3.brush()` per axis |
| 40 | **Bar Chart Race** | Animation → Bar chart race | `d3BarChartRace` | Animated leaderboard — rep rankings over quarters, product sales over months, pipeline race | `d3.transition()` chains; data keyframe interpolation; timer-driven updates |

### Tier 5: High (Complexity 9–10)

Complex interaction, multiple D3 force/layout modules, or significant data transformation pipelines.

| # | Chart | D3 Gallery Ref | Component Name | Salesforce Use Case | New D3 Concepts |
|---|-------|---------------|----------------|--------------------|-----------------|
| 41 | **Scatterplot Matrix (SPLOM)** | Dots → Scatterplot matrix | `d3ScatterMatrix` | Multi-variable correlation — all pairwise relationships at a glance across 4-6 fields | Grid of `d3.scaleLinear()` mini-plots; `d3.brush()` cross-filtering; `d3.cross()` |
| 42 | **Parallel Sets** | Analysis → Parallel sets | `d3ParallelSets` | Categorical flow — lead Source → Status → Converted; case Type → Priority → Resolution | `d3.sankey()`-style ribbons between categorical axes; dimension reordering |
| 43 | **Sequences Sunburst** | Interaction → Sequences sunburst | `d3SequencesSunburst` | Path analysis — conversion paths through stages, navigation paths, multi-step funnel variants | `d3.partition()` + breadcrumb trail + percentage computation per path |
| 44 | **Density Contours** | Analysis → Density contours | `d3DensityContours` | 2D hotspot identification — where do deals cluster by size × close date? Activity concentration zones | `d3.contourDensity()` + filled contour rendering |
| 45 | **Collapsible Tree** | Animation → Collapsible tree | `d3CollapsibleTree` | Interactive org chart with expand/collapse + animated node transitions; large hierarchies | `d3.tree()` + toggle children; `d3.transition()` on enter/exit/update |
| 46 | **Cluster Dendrogram** | Hierarchies → Cluster dendrogram | `d3Dendrogram` | Customer/account segmentation; hierarchical clustering results visualization | `d3.cluster()` layout; leaf-aligned nodes; elbow links |
| 47 | **Directed Chord Diagram** | Networks → Directed chord diagram | `d3DirectedChord` | Asymmetric flow — referrals sent vs received, cross-sell direction, department-to-department requests | `d3.chord().padAngle()` with directional ribbons; separate in/out arcs |
| 48 | **Hierarchical Edge Bundling** | Networks → Hierarchical edge bundling | `d3EdgeBundling` | Dependency visualization — who depends on whom, team interaction density, system integration map | `d3.cluster()` radial layout + `d3.lineRadial().curve(d3.curveBundle)` |
| 49 | **Q-Q Plot** | Analysis → Q–Q plot | `d3QQPlot` | Statistical diagnostics — "is this distribution normal?"; data quality assessment, outlier detection | Quantile computation; reference diagonal; confidence band |
| 50 | **Tangled Tree** | Hierarchies → Tangled tree visualization | `d3TangledTree` | Complex multi-parent hierarchies — products in multiple categories, shared account relationships, matrix org structures | Custom layout algorithm for overlapping hierarchy paths; crossing minimization |

---

## Complexity Scoring Criteria

| Factor | Low (1–2) | Medium (5–6) | High (9–10) |
|--------|-----------|-------------|-------------|
| **D3 modules** | 1–2 (scales, shapes) | 3–4 (+ layouts, force) | 5+ (+ brush, zoom, contour) |
| **New shared code** | None needed | Minor `dataService` extension | New utility module |
| **Interaction** | Hover tooltip only | Click drill-down | Brush, zoom, drag, animation |
| **Data transform** | Direct field mapping | Aggregation + stats | Multi-pass computation |
| **Layout algorithm** | Linear/band scales | Hierarchical/radial | Force + constraint solving |
| **Apex changes** | None | Optional optimization | Required new endpoint |

## Implementation Notes

- **Build order follows this index** — start at #1, work down
- Each chart follows the established component pattern (see CLAUDE.md → Architecture)
- Charts 1–10 can likely reuse existing `dataService`/`chartUtils` unchanged
- Charts 11–20 may need minor `dataService` extensions (series field support is added in ROADMAP Week 2)
- Charts 21–30 may need new statistical helpers or layout modules
- Charts 31+ will likely need new shared utilities and potentially new Apex endpoints
- Word Cloud (#26) requires the `d3-cloud` module — add as a static resource alongside `d3.js`
- Hexbin (#36) requires the `d3-hexbin` module — same static resource approach

## Quick Reference: Total Library After Completion

| Phase | Count | Cumulative |
|-------|-------|-----------|
| Already built | 10 | 10 |
| ROADMAP.md (16 charts) | 16 | 26 |
| This index (50 charts) | 50 | 76 |
