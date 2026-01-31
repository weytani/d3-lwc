# Salesforce D3.js Chart Component Library

A suite of Lightning Web Components (LWC) that wrap D3.js charts for use in Salesforce App Builder, Experience Builder, and Screen Flows. Components are drag-and-drop ready, capable of ingesting raw Salesforce record collections, and intelligently handle aggregation client-side.

## 🎯 Features

- **10 Chart Types** (planned): Bar, Line, Donut, Gauge, Scatter, Histogram, Treemap, Sankey, Force Graph, Choropleth
- **Drag-and-Drop Ready**: Fully configurable in Lightning App Builder
- **Smart Aggregation**: Pass raw records, components handle Sum/Count/Average
- **Responsive**: Uses ResizeObserver for adaptive reflow
- **SLDS Styled**: Consistent with Salesforce Lightning Design System
- **Theme Support**: 4 built-in palettes + custom colors via JSON config
- **Performance Guardrails**: 2,000 record limit with user feedback

## 📦 Current Status

| Component | Status | Description |
|-----------|--------|-------------|
| `c-d3-gauge` | ✅ Complete | Single KPI gauge with zones and thresholds |
| `c-d3-bar-chart` | ✅ Complete | Aggregated bar chart with drill-down |
| `c-d3-donut-chart` | 🚧 Planned | Part-to-whole with slice interactions |
| `c-d3-line-chart` | 🚧 Planned | Time series with multi-series support |
| `c-d3-scatter-plot` | 🚧 Planned | Correlation with record navigation |
| `c-d3-histogram` | 🚧 Planned | Distribution with binning |
| `c-d3-treemap` | 🚧 Planned | Hierarchical data visualization |
| `c-d3-sankey` | 🚧 Planned | Flow/process visualization |
| `c-d3-force-graph` | 🚧 Planned | Network graph with simulation |
| `c-d3-choropleth` | 🚧 Planned | Geographic data visualization |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SALESFORCE ORG                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │  Static Resource │    │         Apex Controller          │  │
│  │     (D3.js)      │    │   D3ChartController.cls          │  │
│  └────────┬─────────┘    │   - executeQuery(soql)           │  │
│           │              │   - with sharing (security)      │  │
│           │              └──────────────┬───────────────────┘  │
│           │                             │                       │
│  ┌────────▼─────────────────────────────▼───────────────────┐  │
│  │                    SHARED LWC MODULES                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │ dataService │  │themeService │  │  chartUtils     │   │  │
│  │  │ -aggregate  │  │ -palettes   │  │  -resize        │   │  │
│  │  │ -validate   │  │ -getColors  │  │  -tooltip       │   │  │
│  │  │ -truncate   │  │             │  │  -formatters    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐  │
│  │                    CHART COMPONENTS                       │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  │  │  Gauge  │ │   Bar   │ │  Donut  │ │  Line   │  ...   │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Salesforce CLI (`sf`)
- Node.js v20+ (v25 has compatibility issues with SF CLI)
- A Salesforce org with "Enable Local Development" turned on

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd d3-lwc

# Install dependencies
npm install

# Deploy to your org
sf project deploy start --source-dir force-app -o <your-org-alias>
```

### Running Tests

```bash
npm test
```

### Local Development (Hot Reload)

```bash
# Use Node 20 for Salesforce CLI compatibility
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# Start the Lightning Dev Server
sf lightning dev app -o <your-org-alias>
```

## 📊 Component Usage

### D3 Bar Chart

Aggregates data by a category field and displays as vertical bars.

**App Builder Configuration:**

| Property | Type | Description |
|----------|------|-------------|
| `soqlQuery` | String | SOQL query to fetch data |
| `groupByField` | String | Field to group by (e.g., `StageName`) |
| `valueField` | String | Numeric field to aggregate (e.g., `Amount`) |
| `operation` | Picklist | `Sum`, `Count`, or `Average` |
| `height` | Integer | Chart height in pixels (default: 300) |
| `theme` | Picklist | Color theme |
| `objectApiName` | String | Object for drill-down navigation |
| `advancedConfig` | String | JSON for advanced options |

**Example SOQL:**
```sql
SELECT StageName, Amount FROM Opportunity
```

**Advanced Config JSON:**
```json
{
  "showGrid": true,
  "showLegend": false,
  "customColors": ["#FF5733", "#33FF57", "#3357FF"]
}
```

### D3 Gauge Chart

Displays a single KPI value with optional zones and thresholds.

**App Builder Configuration:**

| Property | Type | Description |
|----------|------|-------------|
| `soqlQuery` | String | Aggregate query (e.g., `SELECT COUNT(Id) total FROM Lead`) |
| `valueField` | String | Field containing the value |
| `minValue` | Integer | Minimum gauge value (default: 0) |
| `maxValue` | Integer | Maximum gauge value (default: 100) |
| `height` | Integer | Chart height in pixels (default: 200) |
| `theme` | Picklist | Color theme |
| `targetRecordId` | String | Record ID for click navigation |
| `advancedConfig` | String | JSON for zones, colors, labels |

**Advanced Config JSON:**
```json
{
  "label": "Lead Count",
  "valueFormat": "number",
  "zones": [
    { "min": 0, "max": 30, "color": "#ff4d4d" },
    { "min": 30, "max": 70, "color": "#ffcc00" },
    { "min": 70, "max": 100, "color": "#4CAF50" }
  ]
}
```

## 🎨 Themes

Four built-in color palettes:

| Theme | Colors |
|-------|--------|
| **Salesforce Standard** | Brand blue, orange, green, red, purple, pink, cyan, lime, yellow, light blue |
| **Warm** | Reds, oranges, yellows |
| **Cool** | Blues, purples, cyans |
| **Vibrant** | High-contrast mixed colors |

Custom colors can be specified via `advancedConfig`:
```json
{
  "customColors": ["#FF5733", "#33FF57", "#3357FF"]
}
```

## 🛠️ Shared Modules

### dataService

Handles data validation, truncation, and aggregation.

```javascript
import { validateData, prepareData, aggregateData, OPERATIONS } from 'c/dataService';

// Validate data
const { isValid, error } = validateData(records);

// Prepare with truncation (2000 record limit)
const { data, truncated } = prepareData(records, { requiredFields: ['Amount'] });

// Aggregate
const chartData = aggregateData(records, 'StageName', 'Amount', OPERATIONS.SUM);
// Returns: [{ label: 'Closed Won', value: 50000 }, ...]
```

### themeService

Provides color palettes and color scale generation.

```javascript
import { getColors, createColorScale, PALETTES, THEMES } from 'c/themeService';

// Get colors for a dataset
const colors = getColors('Warm', 5); // Returns 5 warm colors

// Create a color scale function
const colorScale = createColorScale('Salesforce Standard', ['A', 'B', 'C']);
colorScale('A'); // Returns first color
```

### chartUtils

Shared utilities for formatting, tooltips, and resize handling.

```javascript
import { 
  formatNumber, 
  formatCurrency, 
  formatPercent,
  truncateLabel,
  createTooltip,
  createResizeHandler 
} from 'c/chartUtils';

formatNumber(1500000);  // "1.5M"
formatCurrency(50000);  // "$50,000"
formatPercent(0.75);    // "75.0%"
truncateLabel('Very Long Label', 10); // "Very Lo..."
```

## 📁 Project Structure

```
d3-lwc/
├── force-app/main/default/
│   ├── classes/
│   │   ├── D3ChartController.cls       # Apex controller for SOQL
│   │   └── D3ChartControllerTest.cls   # Apex tests
│   ├── lwc/
│   │   ├── d3Lib/                      # D3.js loader utility
│   │   ├── dataService/                # Data processing utilities
│   │   ├── themeService/               # Color palette management
│   │   ├── chartUtils/                 # Shared chart utilities
│   │   ├── d3Gauge/                    # Gauge chart component
│   │   ├── d3BarChart/                 # Bar chart component
│   │   └── __mocks__/                  # Jest mocks for SF modules
│   └── staticresources/
│       └── d3.js                       # D3.js v7 library
├── jest.config.js                      # Jest configuration
├── package.json
├── PROJECT-SPEC.md                     # Full technical specification
├── IMPLEMENTATION-BLUEPRINT.md         # Step-by-step build plan
└── README.md                           # This file
```

## 🧪 Testing

The project uses Jest with `@salesforce/sfdx-lwc-jest` for unit testing.

```bash
# Run all tests
npm test

# Run tests for a specific component
npm test -- --testPathPattern=d3BarChart

# Run with coverage
npm test -- --coverage
```

**Current Test Coverage:** 145 tests across 6 test suites

## 🔧 Development Notes

### Node.js Version

Salesforce CLI has compatibility issues with Node.js v25. Use Node.js v20:

```bash
# If using Homebrew
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# Or install via nvm/fnm
fnm use 20
```

### Local Dev Server

Enable "Local Development" in your org's Session Settings, then:

```bash
sf lightning dev app -o <org-alias>
```

This provides hot reload for LWC changes without redeploying.

## 📚 References

- [D3.js Documentation](https://d3js.org/)
- [Lightning Web Components Guide](https://developer.salesforce.com/docs/component-library/documentation/en/lwc)
- [SLDS Design Tokens](https://www.lightningdesignsystem.com/design-tokens/)
- [LWC Local Development](https://developer.salesforce.com/docs/platform/lwc/guide/get-started-test-components.html)

## 📄 License

MIT

---

*Built with ⚔️ by Excalibur*
