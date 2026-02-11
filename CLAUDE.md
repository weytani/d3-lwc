# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Salesforce LWC library providing 10 D3.js chart components for use in Lightning App Builder, Flows, and Experience Builder. Each chart accepts data via `recordCollection` (from Flow/parent) or `soqlQuery` (Apex-backed SOQL).

## Commands

```bash
npm test                                        # Run all unit tests
npm test -- --testPathPattern=d3BarChart         # Run tests for a specific component
npm run test:unit:watch                         # Watch mode
npm run test:unit:coverage                      # With coverage report
npm run lint                                    # ESLint
npm run prettier                                # Format all files
npm run prettier:verify                         # Check formatting

# Deploy to Salesforce org
sf project deploy start --source-dir force-app -o <org-alias>

# Start local dev server (use Node 20, not 25)
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
sf lightning dev app -o <org-alias>
```

Pre-commit hook (husky + lint-staged) auto-runs Prettier, ESLint, and related Jest tests on staged files.

## Architecture

### Data Flow

1. `recordCollection` (direct data) or `soqlQuery` → Apex `D3ChartController.executeQuery()`
2. `dataService.validateData()` → `validateFields()` → `truncateData()` (2,000 record limit) → `aggregateData()`
3. Processed data → D3 renders into an empty `<div>` in the component template

### Shared Modules

- `d3Lib` — D3.js loader with singleton pattern and fetch+eval fallback for CSP-restricted environments. Use `loadD3(this)` first call, `getD3()` after, `resetD3()` in tests.
- `dataService` — Data validation, aggregation (Sum/Count/Average), truncation (MAX_RECORDS: 2,000)
- `themeService` — 4 color palettes (Salesforce Standard, Warm, Cool, Vibrant) + custom colors
- `chartUtils` — Number formatting, tooltips, resize handling, layout retry

### Chart Component Pattern

Every chart component follows this structure:
- **@api properties**: `recordCollection`, `soqlQuery`, field mappings (`groupByField`/`valueField` or `xField`/`yField`), `operation`, `height`, `theme`, `advancedConfig` (JSON string), `objectApiName`/`filterField` for drill-down
- **Lifecycle**: `connectedCallback` loads D3 + fetches data; `renderedCallback` initializes chart with layout retry for container measurement; `disconnectedCallback` cleans up ResizeObserver
- **State guards**: `chartRendered` flag prevents re-rendering; `_layoutRetry` handles cases where container has no dimensions yet

### Apex Controller

`D3ChartController` (`with sharing`) — `executeQuery(queryString)` is `@AuraEnabled(cacheable=true)`. Validates SOQL starts with SELECT, auto-adds LIMIT 2000 (skips for aggregates), enforces FLS via `Security.stripInaccessible()`.

### Testing

- Mocks in `__mocks__/` for `lightning/platformResourceLoader`, `lightning/navigation`, `lightning/platformShowToastEvent`, and `@salesforce/apex/D3ChartController.executeQuery`
- Tests create a mock D3 factory with chainable method stubs (since D3 isn't available in jsdom)
- Jest config extends `@salesforce/sfdx-lwc-jest/config` with custom `moduleNameMapper` for the mocks above

### Conventions

- Component names prefixed with `d3` (e.g., `d3BarChart`)
- `// ABOUTME:` comments at top of component files for component-level documentation
- Constants use UPPER_SNAKE_CASE (`MAX_RECORDS`, `OPERATIONS`, `PALETTES`)
- HTML templates use SLDS classes with conditional rendering for loading/error/no-data/chart states

## Key Constraints

- Node.js v20 required for Salesforce CLI compatibility (v25 has issues)
- D3.js v7 loaded from `staticresources/d3.js`
- Salesforce API version: 65.0
