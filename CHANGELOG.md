# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-23

First stable release of the D3-LWC chart library: 30 production D3.js v7 chart
components for Salesforce, each usable in Lightning App Builder, Flows, and
Experience Builder via `recordCollection` (Flow/parent) or `soqlQuery` (Apex).

### Added

#### Chart components (30)

- **Comparison & trend** — `d3BarChart`, `d3HorizontalBarChart`, `d3StackedBarChart`,
  `d3DivergingBarChart`, `d3LollipopChart`, `d3LineChart`, `d3AreaChart`
- **Part-to-whole** — `d3PieChart`, `d3DonutChart`, `d3WaffleChart`, `d3FunnelChart`,
  `d3ProgressBar`, `d3Treemap`, `d3SunburstChart`
- **Distribution & correlation** — `d3Histogram`, `d3BoxPlot`, `d3ScatterPlot`, `d3BubbleChart`
- **KPI vs target** — `d3Gauge`, `d3BulletChart`
- **Relationships & flow** — `d3Sankey`, `d3ChordDiagram`, `d3ForceGraph`
- **Time & activity** — `d3GanttChart`, `d3CalendarHeatmap`, `d3SparklineGrid`
- **Matrix & geographic** — `d3Heatmap`, `d3Choropleth`
- **Multi-axis** — `d3RadarChart`
- **Sequential change** — `d3WaterfallChart`

#### Shared architecture

- `d3Lib` — D3.js v7 loader with singleton pattern and fetch+eval fallback for
  CSP-restricted environments.
- `dataService` — data validation, aggregation (Sum/Count/Average), and truncation
  (2,000-record client limit).
- `themeService` — four color palettes (Salesforce Standard, Warm, Cool, Vibrant)
  plus custom colors.
- `chartUtils` — number formatting, tooltips, resize handling, and layout retry.

#### Apex backend

- `D3ChartController` (`with sharing`) — four `@AuraEnabled(cacheable=true)` methods
  with FLS enforcement:
  - `executeQuery` — raw SOQL execution (auto-adds `LIMIT 2000`).
  - `getAggregatedData` — server-side `GROUP BY` aggregation (limit 200 groups).
  - `getStatistics` — server-side count, min, max, mean, median, population stdDev.
  - `getCorrelation` — server-side Pearson r, regression slope, and intercept.

### Notes

- **Tested** — 61 Jest suites / 2,561 tests (unit, integration, and e2e tiers per
  component), all green.
- **Platform** — Salesforce API version 65.0; D3.js v7 served from the `d3` static
  resource; Node.js v20 required for the Salesforce CLI / local dev server.
- **Continuous integration** — GitHub Actions runs the full Jest suite on every push
  and pull request.

[1.0.0]: https://github.com/weytani/d3-lwc/releases/tag/v1.0.0
