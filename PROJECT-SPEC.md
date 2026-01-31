# Technical Specification: Salesforce D3.js Component Library

## 1. Executive Summary

Develop a suite of **10 Lightning Web Components (LWC)** that wrap D3.js charts for use in Salesforce App Builder, Experience Builder, and Screen Flows. The components must be "drag-and-drop" ready, capable of ingesting raw Salesforce record collections, and intelligently handling aggregation client-side. The library prioritizes responsiveness (SLDS), performance, and a hybrid configuration model (UI inputs + JSON for advanced settings).

## 2. Component Scope

The library will consist of 10 distinct components.

| Component Name | Chart Category | Interaction Mode | Interaction Action |
| --- | --- | --- | --- |
| `c-d3-bar-chart` | Comparison | Drill-Down | Click Bar → Refine/Filter Data |
| `c-d3-line-chart` | Trend/Time | Drill-Down | Click Point → Highlight Timeline |
| `c-d3-donut-chart` | Part-to-Whole | Drill-Down | Click Slice → Explode/Filter |
| `c-d3-scatter-plot` | Correlation | Navigation | Click Dot → Navigate to Record |
| `c-d3-histogram` | Distribution | Navigation | Click Bin → Navigate to List View |
| `c-d3-treemap` | Hierarchy | Drill-Down | Click Box → Zoom to Sub-category |
| `c-d3-sankey` | Flow/Process | Navigation | Click Path → Nav to Junction Record |
| `c-d3-force-graph` | Network | Navigation | Click Node → Navigate to Record |
| `c-d3-choropleth` | Geospatial | Drill-Down | Click Region → Zoom to Sub-region |
| `c-d3-gauge` | Status/KPI | Navigation | Click Gauge → Nav to Primary Record |

## 3. Technical Architecture

### 3.1 Framework & Libraries

* **Platform:** Lightning Web Components (LWC).
* **Library:** D3.js (latest stable v7/v8).
* **Loading Strategy:** Load D3 as a **Static Resource** using `loadScript`.
* **Styling:** Salesforce Lightning Design System (SLDS) for containers, fonts, and tooltips.

### 3.2 Data Ingestion (Hybrid)

Components must accept data via two primary public properties (`@api`):

1. **`recordCollection` (List<Object>):** Accepts a collection variable (e.g., from a Flow or parent component).
2. **`soqlQuery` (String):** An alternative string property where an Admin can paste a SOQL query.

* *Logic:* If `recordCollection` is empty, execute the `soqlQuery` via an Apex controller.

### 3.3 Data Processing (Client-Side Aggregation)

Components must be "smart." They will accept **raw data rows** and perform aggregation in JavaScript.

* **Required Config Properties:**
    * `groupByField` (String): API name of the category field (e.g., `StageName`).
    * `valueField` (String): API name of the numeric field (e.g., `Amount`).
    * `operation` (String): Picklist (`Sum`, `Count`, `Average`).

* *Example:* If 500 Opportunity rows are passed, the component calculates the Sum of Amount by StageName before rendering.

## 4. Configuration Experience (App Builder)

### 4.1 Primary Controls (Native UI)

The App Builder property panel must expose essential settings as native inputs:

* **Data Source:** Toggle/Input for Collection vs. SOQL.
* **Field Mapping:** Text inputs for `groupByField`, `valueField`, `xAxis`, `yAxis`.
* **Dimensions:** `Height` (Integer).
* **Theme:** Picklist (`Salesforce Standard`, `Warm`, `Cool`, `Vibrant`, `Custom`).

### 4.2 Advanced Controls (JSON Editor)

A single text area (`advancedConfig`) accepts a JSON object for deeper customization.

* **Scope:** Legends, Grid Lines, Tooltip formats, and Custom Color Overrides.
* **Example:**

```json
{
  "legendPosition": "bottom",
  "showGrid": true,
  "customColors": ["#FF5733", "#33FF57"]
}
```

## 5. Responsiveness & Performance

### 5.1 Adaptive Reflow

* Do not simply scale the SVG.
* Use `ResizeObserver` to detect container width.
* **Behavior:** If width drops below the "Minimum Recommended Size" (defined per chart), redraw the chart with reduced complexity (e.g., fewer ticks, hidden legend) to maintain readability.

### 5.2 Performance Guardrails

* **Hard Limit:** Implement a default row limit (e.g., 2,000 records) to prevent browser freezing.
* **User Feedback:** Display a toast/warning if data is truncated ("Displaying first 2,000 records").
* **Tuning:** Use Chrome DevTools Profiler during development to determine the optimal limit for the Force-Directed Graph and Scatter Plot.

## 6. Deliverables

1. **Source Code:** SFDX project structure with all LWC bundles, Apex Controllers, and the D3 Static Resource.
2. **Showcase App:** A "Showcase" folder containing a `flexipage` (Lightning App Page) deployed to the org.
    * This page must feature **one instance of every chart**, pre-configured with dummy data or a sample SOQL query, demonstrating that all 10 components render correctly immediately upon deployment.
