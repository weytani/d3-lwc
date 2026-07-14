# Admin Guide: D3 Charts in App Builder & Flow

This guide is for Salesforce **admins** placing D3 chart components on pages
and screens — no code required. If you're converting a chart's implementation
or writing tests, see `docs/conversion-recipe.md` instead; this guide only
covers the admin-facing surface (labels and help text as they appear in the
property panel).

## 1. What these charts are

Each `D3 …` component (e.g. "D3 Sorted Bar Chart", "D3 Line Chart") is a
self-contained Lightning Web Component that renders a D3.js chart. You drag it
onto an **App Page**, **Record Page**, **Home Page**, or a **Flow Screen** in
Lightning App Builder / Flow Builder, point it at data, and it renders — no
Apex class, no custom code, on your part.

As charts are converted to the v3 "standalone" architecture, each one
self-fetches its own data straight from Salesforce over the `lightning/graphql`
wire — the platform enforces field-level security and sharing on that fetch
the same way it does for any other UI API read. There's no custom Apex
controller in the loop for a converted chart.

## 2. The three ways a chart gets its data

This is the core mental model — every chart on an App/Record/Home Page decides
its data source in this **order of precedence**:

1. **`Records` (a record collection) wins.** If a record collection is wired
   into the chart — which is how it always works on a Flow Screen (see §2b) —
   the chart renders exactly what it was given and never queries anything
   itself.
2. **Free-text `GraphQL Query` is next**, if set (see §2c).
3. **Structured self-fetch is the fallback** — the common case on an
   App/Record/Home Page (see §2a).

### 2a. Self-fetch via structured properties (the common case)

Set **Object API Name** plus the chart's field mappings — for an aggregation
chart that's **Group By Field** / **Value Field** + **Aggregation**; for a
time-series chart it's the date/X field + **Value Field** — and the chart
queries Salesforce itself over the GraphQL wire. No `Records` collection and
no free-text query needed. FLS and sharing are enforced by the platform,
exactly as they would be for the running user browsing that object anywhere
else.

### 2b. Records from a Flow

Drop the chart on a **Flow Screen**, add a **Screen** element, and wire a
record collection variable into the chart's **Records** input. The chart
renders whatever the Flow hands it — it does not query Salesforce itself. This
is the `lightning__FlowScreen` target, and it takes a **generic sObject
collection** (any object your Flow's collection variable holds).

### 2c. Free-text GraphQL override (`GraphQL Query`)

Advanced admins can paste a **UI API record query** — a `uiapi.query { ... }`
document — into the **GraphQL Query** property to override the query the
chart would otherwise build. The rules, exactly as the property's help text
states them:

- It must be a **record query** (`uiapi.query`), **not** an aggregate query.
  The free-text override always targets Salesforce's record-query result
  shape; an aggregate query returns a different shape and the chart won't
  find any rows in it.
- The query's node must select the **Group By Field and Value Field** (or, for
  a time-series chart, the **Date Field**, **Value Field**, and **Series
  Field** if used) as **top-level fields** on the node — not nested under
  something else.
- **UI-API-queryable objects only**, and the result is bounded to **at most
  2,000 records**.
- **Footgun (accepted, not guarded at runtime):** if the Value Field is
  missing from the query you pasted, the chart still runs — it just
  aggregates every row to zero rather than raising an error. Double-check
  your field list if a free-text query renders an all-zero chart.
- Leave it blank to have the chart build the query automatically from the
  structured properties (§2a).

## 3. Property reference

Properties below are drawn from the actual `.js-meta.xml` help text of two
converted charts — **D3 Sorted Bar Chart** (an aggregation chart) and **D3
Line Chart** (a time-series chart) — as the canonical examples of each shape.
The exact set on any given chart may differ slightly (a chart-specific knob
like Sort By only exists on charts that can be re-sorted); check that chart's
own property panel for the full list.

### Common to (nearly) every self-fetch-capable chart

| Property         | Label                  | Type     | Default             | What it does                                                                                                                                                                             |
| ---------------- | ---------------------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `objectApiName`  | Object API Name        | Text     | —                   | Object to query. When set (and no records are passed in), the chart self-fetches this object via GraphQL. Also used for drill-down navigation on click.                                  |
| `filterField`    | Filter Field           | Text     | —                   | Field to filter by on drill-down (defaults to the chart's Group By / Date field).                                                                                                        |
| `recordLimit`    | Record Limit           | Number   | —                   | Maximum records to process. Leave empty for the chart's default. (1–10,000)                                                                                                              |
| `graphqlQuery`   | GraphQL Query          | Text     | —                   | Optional override of the built query — see §2c for the full contract and footgun.                                                                                                        |
| `height`         | Height (px)            | Number   | 300                 | Chart height in pixels. (150–800)                                                                                                                                                        |
| `theme`          | Color Theme            | Picklist | Salesforce Standard | Color palette for the chart — Salesforce Standard, Warm, Cool, or Vibrant.                                                                                                               |
| `advancedConfig` | Advanced Config (JSON) | Text     | —                   | Free-form JSON for options a chart doesn't expose as its own property, e.g. `{"showGrid": true, "showLegend": false, "customColors": ["#FF5733"]}`. Exact supported keys vary per chart. |

### Aggregation-chart-specific (bar family: Sorted Bar, Bar, Horizontal Bar, Lollipop, Pie, Donut, Waffle, Funnel, Progress, Gauge, Bullet)

| Property          | Label          | Type     | Default          | What it does                                                                       |
| ----------------- | -------------- | -------- | ---------------- | ---------------------------------------------------------------------------------- |
| `groupByField`    | Group By Field | Text     | e.g. `StageName` | API name of the category field (e.g., StageName).                                  |
| `valueField`      | Value Field    | Text     | e.g. `Amount`    | API name of the numeric field to aggregate (not required for Count).               |
| `operation`       | Aggregation    | Picklist | Sum              | How to aggregate the values — Sum, Count, or Average. See §4 for the Count caveat. |
| `sortBy`\*        | Sort By        | Picklist | value            | Sort bars by category label or by aggregated value.                                |
| `sortDirection`\* | Sort Direction | Picklist | desc             | Ascending or descending sort order.                                                |

\* `sortBy`/`sortDirection` are specific to **D3 Sorted Bar Chart** (any
chart that supports re-sorting) — not every aggregation chart has them.

### Time-series-specific (line family: Line, Area, Step, Difference, Slope, Variable-Color Line, and other date-X-axis charts)

| Property      | Label            | Type     | Default            | What it does                                                                                                                                                |
| ------------- | ---------------- | -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dateField`   | Date Field       | Text     | e.g. `CreatedDate` | API name of the date/datetime field for the X-axis.                                                                                                         |
| `valueField`  | Value Field      | Text     | e.g. `Amount`      | API name of the numeric field for the Y-axis. (On this family `valueField` is a raw Y value, not an aggregate — contrast with the aggregation table above.) |
| `seriesField` | Series Field     | Text     | —                  | Optional field to split into multiple lines (e.g., StageName).                                                                                              |
| `dateFormat`  | Date Format      | Picklist | ISO                | Date format for parsing: ISO (YYYY-MM-DD), US (MM/DD/YYYY), or EU (DD/MM/YYYY).                                                                             |
| `curveType`   | Line Style       | Picklist | monotone           | Line interpolation style — linear, monotone, or step.                                                                                                       |
| `showPoints`  | Show Data Points | Checkbox | true               | Display points on the line for hover interactions.                                                                                                          |
| `showLegend`  | Show Legend      | Checkbox | —                  | Display legend (auto-shown for multi-series).                                                                                                               |

### On a Flow Screen

The Flow-screen property panel is deliberately smaller: self-fetch knobs
(`Object API Name`, `GraphQL Query`, `Filter Field`, `Record Limit`) never
appear there, because the Flow is already supplying the records. What you'll
typically see:

| Property                            | Label            | What it does                                                                                                                                                                                                                                    |
| ----------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recordCollection`                  | Records          | Collection of records to chart, from the Flow. Input-only. Salesforce will ask you to pick the collection's **Record Type** (the sObject it holds) when you wire this up — that's the generic type parameter behind this property, not a query. |
| —                                   | (field mappings) | The same Group By/Value/Operation (aggregation charts) or Date/Value/Series (time-series charts) properties as the App Page panel.                                                                                                              |
| `height`, `theme`, `advancedConfig` | Appearance       | Same as the App Page panel — present when the chart reads `advancedConfig` on this target; some charts omit it here if they don't.                                                                                                              |

Exactly which appearance/render-config properties are exposed varies chart by
chart — check the property panel for the one you dropped onto the screen.

## 4. The Count caveat

On the self-fetch path (§2a), **Count is bounded to the first `Record Limit`
rows** (default 2,000) — GraphQL has no server-side COUNT, so a Count
aggregation fetches raw records up to the limit and counts them client-side.
For an **exact** count on an object with more rows than your Record Limit,
don't rely on the chart's self-fetch: pass records into the chart from a Flow
or a report instead (§2b), where the count reflects whatever collection you
hand it.

## 5. Step-by-step: add a chart to an App Page

1. **Setup → Lightning App Builder** (or click the gear icon on any App,
   Record, or Home page and choose **Edit Page**).
2. Create a **New** page (or open an existing one to edit) — App Page, Record
   Page, or Home Page all work.
3. In the left-hand component palette, open the **Custom** section and find
   the chart you want — it's labeled `D3 <Chart Name>` (e.g. "D3 Sorted Bar
   Chart").
4. **Drag it onto the canvas.**
5. With the component selected, use the **property panel on the right** to
   set **Object API Name** and the field mappings for your chart (§2a/§3), plus
   any appearance options (Height, Theme, Advanced Config).
6. Click **Save**.
7. **Activate** the page (set it as the org default, or assign it to the
   app/profile/record type you need) — a saved-but-inactive page won't show up
   for users.

## 6. Step-by-step: use a chart in a Flow Screen

1. Open **Flow Builder** and create or edit a **Screen Flow**.
2. Add a **Screen** element (or use an existing one).
3. In the screen's component palette, find the same `D3 <Chart Name>`
   component under **Custom** and drag it onto the screen.
4. Wire a **record collection variable** — typically the output of a **Get
   Records** element — into the chart's **Records** property. When prompted,
   pick the **Record Type** matching that collection's object.
5. Set the chart's field mappings and any appearance options exposed on this
   target (§3's Flow Screen table) — note that self-fetch properties
   (Object API Name, GraphQL Query) are **not** available here; the chart is
   working from the records the Flow already fetched.
6. **Save** and **Activate** the flow.

## 7. Troubleshooting

**Blank chart (nothing renders).** Almost always a container that starts at
zero width — most commonly a chart placed inside a **collapsed tab or
accordion section** that isn't visible on first render, so the component never
gets a measurable size to draw into. Try setting the tab/section to expanded
by default, or place the chart on a region that's visible on load. If it still
doesn't render once visible, double-check the field API names you set — a
non-existent field can also leave the chart with nothing to draw.

**"No data" state.** Usually a field-name or aggregation mismatch: the Group
By/Value (or Date/Value) field API names don't exist on the object you set, or
the running user's field-level security blocks one of them, or the aggregation
simply has no matching rows. Verify the field API names against the object's
Setup page and check the running user's field access.

**Free-text `GraphQL Query` returns nothing.** It must be a `uiapi.query`
**record** query — an aggregate query (`uiapi.aggregate ...`) returns a
different result shape the chart doesn't read, so it comes back empty. See §2c
for the exact contract.

**Theme options.** Pick one of the four built-in palettes (Salesforce
Standard, Warm, Cool, Vibrant) via the **Color Theme** property, or set
`customColors` in **Advanced Config (JSON)** for a fully custom palette, e.g.
`{"customColors": ["#FF5733", "#33FF57", "#3357FF"]}`.
