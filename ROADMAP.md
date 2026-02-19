# D3-LWC Chart Roadmap

One chart per week. Each builds on the existing architecture (shared `dataService`, `themeService`, `chartUtils`, Apex controller). Charts are ordered to balance complexity progression with Salesforce relevance.

---

## Current Library Status

| Component | Status |
|-----------|--------|
| `d3Gauge` | Done |
| `d3BarChart` | Done |
| `d3DonutChart` | Done |
| `d3LineChart` | Done |
| `d3ScatterPlot` | Done |
| `d3Histogram` | Done |
| `d3Treemap` | Done |
| `d3Sankey` | Done |
| `d3ForceGraph` | Done |
| `d3Choropleth` | In Progress |

---

## Phase 1: High-Impact Salesforce Essentials (Weeks 1-4)

### Week 1 — Funnel Chart (`d3FunnelChart`)
**Why:** The single most-requested missing chart in Salesforce dashboards. Pipeline stage conversion is the lifeblood of sales orgs.
- Trapezoidal segments sized by value at each stage
- Conversion rate labels between stages
- Click-to-drill into records at each stage
- **Data pattern:** `groupByField` = Stage, `valueField` = count or amount
- **Salesforce use:** Opportunity pipeline, lead conversion, case escalation funnels

### Week 2 — Stacked Bar Chart (`d3StackedBarChart`)
**Why:** The existing bar chart only does single-series. Stacked/grouped bars unlock multi-dimensional comparison — the bread and butter of quarterly reviews.
- Toggle between stacked and grouped mode
- Normalized (100%) stacking option
- Legend with series toggle (click to hide/show)
- **Data pattern:** `groupByField` + `seriesField` + `valueField`
- **Salesforce use:** Revenue by region by quarter, cases by priority by agent, pipeline by stage by owner

### Week 3 — Area Chart (`d3AreaChart`)
**Why:** Complements the existing line chart for cumulative/volume-over-time views. Stacked areas show composition change, which line charts can't communicate clearly.
- Stacked, overlapping, and normalized modes
- Gradient fill with configurable opacity
- Shares date parsing logic with `d3LineChart`
- **Data pattern:** Same as line chart with optional `seriesField`
- **Salesforce use:** Cumulative pipeline, support ticket volume trends, MRR growth

### Week 4 — Bullet Chart (`d3BulletChart`)
**Why:** A direct upgrade to the gauge for KPI-vs-target reporting. Stephen Few's bullet chart packs target, actual, and qualitative ranges into minimal space — perfect for dashboard density.
- Horizontal bar with quantitative scale
- Target marker (vertical line)
- Qualitative ranges (poor/satisfactory/good backgrounds)
- Multiple bullets in a single component (compact list mode)
- **Data pattern:** `valueField` for actual, thresholds via `advancedConfig`
- **Salesforce use:** Quota attainment, KPI scorecards, forecast vs actual

---

## Phase 2: Analytical Depth (Weeks 5-8)

### Week 5 — Heatmap (`d3Heatmap`)
**Why:** Two-dimensional categorical analysis that no other chart in the library covers. Instantly reveals patterns in large datasets where bar/line charts would be overwhelming.
- Color intensity grid (rows x columns)
- Configurable color ramp (sequential or diverging)
- Cell labels with smart contrast (dark text on light cells, vice versa)
- Row/column sorting options
- **Data pattern:** `xField` + `yField` + `valueField`
- **Salesforce use:** Activity by day-of-week × hour, rep × product performance matrix, territory coverage gaps

### Week 6 — Box Plot (`d3BoxPlot`)
**Why:** The only statistical distribution chart currently is the histogram. Box plots let you compare distributions side-by-side — critical for spotting outlier reps, accounts, or deal sizes.
- Whiskers, quartile boxes, median line, outlier dots
- Horizontal or vertical orientation
- Multiple boxes grouped by category
- Tooltip with exact Q1/Q2/Q3/min/max values
- **Data pattern:** Raw (unaggregated) records, `groupByField` + `valueField`
- **Salesforce use:** Deal size spread by stage, response time by team, rep performance variance

### Week 7 — Radar Chart (`d3RadarChart`)
**Why:** Multi-dimensional comparison on a single visual — nothing else in the library does this. Perfect for scorecards and benchmarking.
- Polygon overlays for multiple entities
- 3-8 axes with configurable labels
- Filled or outline mode
- Normalized scaling per axis
- **Data pattern:** Multiple `valueFields` per record, or pivoted data
- **Salesforce use:** Sales rep scorecards (calls, emails, meetings, pipeline, close rate), account health scores, product comparison

### Week 8 — Waterfall Chart (`d3WaterfallChart`)
**Why:** Shows how a starting value is affected by sequential positive/negative changes — the "bridge chart" that finance teams live in.
- Running total with increase (green) and decrease (red) bars
- Floating bars connected by step lines
- Subtotal bars at configurable intervals
- **Data pattern:** Sequential records with positive/negative values
- **Salesforce use:** Pipeline movement (new → won → lost → slipped), revenue bridges, budget variance analysis

---

## Phase 3: Advanced Interactions (Weeks 9-12)

### Week 9 — Calendar Heatmap (`d3CalendarHeatmap`)
**Why:** GitHub-contribution-style view for daily metrics. Turns abstract time-series data into an instantly scannable year view. Nothing else in the library handles daily granularity this well.
- Month/week grid layout (GitHub-style or traditional calendar)
- Color intensity by value
- Tooltip on hover with date + value
- Year navigation
- **Data pattern:** Date field + value field (one value per day)
- **Salesforce use:** Daily activity tracking, task completion patterns, login frequency, case volume by day

### Week 10 — Sparkline Grid (`d3SparklineGrid`)
**Why:** Inline mini-charts that pack dozens of trends into table/list space. The "small multiples" concept is wildly underused in Salesforce despite being one of the most information-dense patterns.
- Tiny line/bar/area charts (no axes, no labels)
- Grid layout: entity name + sparkline + current value
- Win/loss variant (small squares for binary outcomes)
- Configurable reference line (average, target)
- **Data pattern:** Multiple records per entity over time
- **Salesforce use:** Pipeline trend per rep (at a glance), account health over 12 months, weekly case volume per product

### Week 11 — Sunburst Chart (`d3SunburstChart`)
**Why:** The treemap already handles hierarchical data as rectangles. Sunburst adds the radial alternative — better for showing depth of hierarchy and part-to-whole at each level simultaneously.
- Concentric ring segments
- Click-to-zoom into sub-hierarchy
- Breadcrumb trail
- Center label showing selected segment
- **Data pattern:** Same as treemap (flat data with hierarchical grouping)
- **Salesforce use:** Product catalog breakdown, org hierarchy revenue, geographic drill-down (region → country → city)

### Week 12 — Chord Diagram (`d3ChordDiagram`)
**Why:** Visualizes relationships and flows between entities in a circular layout. The Sankey already shows directional flow — chords show mutual/bidirectional relationships, which is a different and valuable perspective.
- Circular layout with arcs per entity
- Ribbons showing flow magnitude between pairs
- Hover to highlight a single entity's connections
- **Data pattern:** Source + target + value (like Sankey but bidirectional)
- **Salesforce use:** Cross-sell between product lines, referral networks, account-to-account relationships, department interaction patterns

---

## Phase 4: Specialized & Polished (Weeks 13-16)

### Week 13 — Gantt Chart (`d3GanttChart`)
**Why:** Timeline/scheduling visualization that Salesforce doesn't offer natively. High demand in professional services, implementation teams, and project-based orgs.
- Horizontal bars on a time axis
- Grouping by category (swimlanes)
- Today-line marker
- Dependency arrows (optional)
- Click to navigate to record
- **Data pattern:** `startDateField` + `endDateField` + `labelField` + optional `groupByField`
- **Salesforce use:** Implementation project timelines, contract periods, campaign schedules, onboarding task tracking

### Week 14 — Diverging Bar Chart (`d3DivergingBarChart`)
**Why:** Centered-axis bar chart that elegantly handles positive/negative data — something the standard bar chart can't do without awkward workarounds.
- Bars extend left (negative) and right (positive) from center axis
- Color-coded by direction
- Sorted by value or alphabetical
- **Data pattern:** `groupByField` + `valueField` (values can be negative)
- **Salesforce use:** NPS scores by segment, win/loss deltas, month-over-month change, sentiment analysis

### Week 15 — Bubble Chart (`d3BubbleChart`)
**Why:** Three-dimensional scatter plot (x, y, size). The existing scatter plot maps two variables — adding a size dimension unlocks portfolio-style analysis.
- Circles positioned by X/Y, sized by Z
- Configurable bubble scaling (area-based, not radius)
- Optional color-by-category
- Collision detection to avoid overlaps (optional force layout)
- **Data pattern:** `xField` + `yField` + `sizeField` + optional `groupByField`
- **Salesforce use:** Account portfolio (revenue vs growth vs employee count), opportunity matrix (probability vs amount vs days open), product performance (units vs revenue vs margin)

### Week 16 — Waffle Chart (`d3WaffleChart`)
**Why:** Clean percentage visualization as a grid of squares. More precise than donuts for showing exact percentages, and more visually engaging than a plain number. Good capstone — simple to build, universally useful.
- 10×10 grid of squares (or configurable)
- Filled squares represent percentage
- Icon variant (fill squares with category icons)
- Multiple waffles side-by-side for comparison
- **Data pattern:** Single value as percentage, or `groupByField` + `valueField` for multi-category
- **Salesforce use:** Quota completion, goal progress, survey response rates, adoption metrics

---

## Implementation Notes

### Consistent with existing patterns
Every new chart should follow the established component lifecycle:
1. `connectedCallback` → load D3 + data
2. `renderedCallback` → layout retry + render
3. `disconnectedCallback` → cleanup
4. Use `dataService.prepareData()` and `dataService.aggregateData()`
5. Use `themeService` for colors
6. Use `chartUtils` for tooltips, resize handling, number formatting

### New shared utilities to build along the way
- **Week 2**: `seriesField` support in `dataService.aggregateData()` (reused by area, radar, heatmap)
- **Week 6**: Statistical functions in `dataService` (quartiles, median — reused by box plot and future stats charts)
- **Week 13**: Date-range utilities in `chartUtils` (reused by calendar heatmap and Gantt)

### Testing target
Maintain the current standard: unit + integration + e2e tests per component. Target 50+ tests per chart to match existing coverage density.

---

## Summary

| Week | Chart | Primary Salesforce Use Case |
|------|-------|-----------------------------|
| 1 | Funnel | Pipeline conversion |
| 2 | Stacked Bar | Multi-dimensional comparison |
| 3 | Area | Cumulative trends |
| 4 | Bullet | KPI vs target |
| 5 | Heatmap | Pattern discovery |
| 6 | Box Plot | Distribution comparison |
| 7 | Radar | Multi-axis scorecards |
| 8 | Waterfall | Bridge / variance analysis |
| 9 | Calendar Heatmap | Daily activity tracking |
| 10 | Sparkline Grid | Small multiples / inline trends |
| 11 | Sunburst | Hierarchical drill-down |
| 12 | Chord Diagram | Relationship networks |
| 13 | Gantt | Project timelines |
| 14 | Diverging Bar | Positive/negative comparison |
| 15 | Bubble | Three-variable analysis |
| 16 | Waffle | Percentage / goal progress |
