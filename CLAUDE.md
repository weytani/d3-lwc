# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Salesforce Lightning Web Component (LWC) library that wraps D3.js v7 charts for use in Salesforce App Builder, Experience Builder, and Screen Flows. It includes 10 chart components (gauge, bar, donut, line, scatter, histogram, treemap, sankey, force graph, choropleth) plus shared utility modules.

## Commands

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests for a specific component
npm test -- --testPathPattern=d3BarChart

# Run tests with coverage
npm run test:unit:coverage

# Lint JavaScript files
npm run lint

# Format all files
npm run prettier

# Deploy to Salesforce org
sf project deploy start --source-dir force-app -o <org-alias>

# Start local dev server (use Node 20, not 25)
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
sf lightning dev app -o <org-alias>
```

## Architecture

**Data Flow:**
1. Components accept data via `recordCollection` (from Flow/parent) OR `soqlQuery` (SOQL string)
2. If SOQL provided, Apex controller (`D3ChartController.cls`) executes query with sharing
3. JavaScript aggregates raw records client-side using dataService (Sum/Count/Average)
4. D3 renders charts with SLDS styling

**Shared Modules (in `force-app/main/default/lwc/`):**
- `d3Lib` - Loads D3.js from static resource
- `dataService` - Data validation, aggregation, truncation (MAX_RECORDS: 2,000)
- `themeService` - 4 color palettes (Salesforce Standard, Warm, Cool, Vibrant) + custom colors
- `chartUtils` - Number formatting, tooltips, resize handling

**Component Pattern:**
- All chart components use `@api` properties for App Builder configuration
- `advancedConfig` property accepts JSON for advanced options not exposed in UI
- ResizeObserver handles responsive reflow
- Drill-down navigation uses `objectApiName` and `filterField` properties

## Testing

Tests use `sfdx-lwc-jest` (not vanilla Jest). Mocks for Salesforce APIs are in `__mocks__/` and configured in `jest.config.js`. The mock for `@salesforce/apex/D3ChartController.executeQuery` must be set up per-test.

## Key Constraints

- Node.js v20 required for Salesforce CLI compatibility (v25 has issues)
- 2,000 record limit enforced by dataService to prevent browser freezing
- Salesforce API version: 65.0
- D3.js v7 loaded from `staticresources/d3.js`
- All components use SLDS classes for Salesforce UI consistency
