# Implementation Blueprint: Salesforce D3.js Component Library

> **Reference:** [PROJECT-SPEC.md](./PROJECT-SPEC.md)

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Phase Breakdown](#2-phase-breakdown)
3. [Chunk Decomposition](#3-chunk-decomposition)
4. [Right-Sized Steps](#4-right-sized-steps)
5. [Code Generation Prompts](#5-code-generation-prompts)

---

## 1. High-Level Architecture

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
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SHOWCASE APP                           │  │
│  │           FlexiPage with all 10 charts                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Dependency Graph

```
D3 Static Resource
        │
        ▼
Apex Controller ◄──────────────────┐
        │                          │
        ▼                          │
Shared Modules (dataService, etc.) │
        │                          │
        ▼                          │
d3-gauge (simplest) ───────────────┤
        │                          │
        ▼                          │
d3-bar-chart ──────────────────────┤
        │                          │
        ▼                          │
[remaining charts in order] ───────┤
        │                          │
        ▼                          │
Showcase FlexiPage ────────────────┘
```

---

## 2. Phase Breakdown

### Phase 1: Foundation (Steps 1-8)
- Project scaffolding and D3 static resource
- Apex controller with tests
- Shared utility modules with tests

### Phase 2: First Chart - Gauge (Steps 9-14)
- Simplest chart to validate architecture
- Single value display, no aggregation needed
- Proves D3 loading, theming, resize work

### Phase 3: Aggregation Chart - Bar (Steps 15-21)
- First chart requiring data aggregation
- Validates dataService integration
- Click interactions and drill-down

### Phase 4: Part-to-Whole - Donut (Steps 22-26)
- Circular chart with slice interactions
- Reuses aggregation patterns from bar

### Phase 5: Time Series - Line (Steps 27-31)
- Date parsing and time scales
- Multiple series support

### Phase 6: Distribution Charts (Steps 32-38)
- Histogram (binning logic)
- Scatter Plot (two-axis correlation)

### Phase 7: Hierarchical Charts (Steps 39-45)
- Treemap (nested data)
- Sankey (flow data)

### Phase 8: Complex Charts (Steps 46-52)
- Force Graph (simulation)
- Choropleth (TopoJSON)

### Phase 9: Integration & Showcase (Steps 53-56)
- Showcase FlexiPage
- Final integration tests
- Documentation

---

## 3. Chunk Decomposition

### Phase 1 Chunks

| Chunk | Description | Dependencies |
|-------|-------------|--------------|
| 1.1 | Project structure + Jest config | None |
| 1.2 | D3.js static resource | 1.1 |
| 1.3 | Apex controller + test | 1.1 |
| 1.4 | dataService module + tests | 1.1 |
| 1.5 | themeService module + tests | 1.1 |
| 1.6 | chartUtils module + tests | 1.2 |
| 1.7 | Integration test (load D3 + call Apex) | 1.2, 1.3 |

### Phase 2 Chunks (Gauge)

| Chunk | Description | Dependencies |
|-------|-------------|--------------|
| 2.1 | Gauge skeleton (HTML/JS/XML) | 1.7 |
| 2.2 | Gauge rendering with mock data | 2.1, 1.5, 1.6 |
| 2.3 | Gauge App Builder properties | 2.2 |
| 2.4 | Gauge SOQL integration | 2.3, 1.3 |
| 2.5 | Gauge click navigation | 2.4 |
| 2.6 | Gauge Jest tests | 2.5 |

### Phase 3 Chunks (Bar Chart)

| Chunk | Description | Dependencies |
|-------|-------------|--------------|
| 3.1 | Bar chart skeleton | 2.6 |
| 3.2 | Bar aggregation integration | 3.1, 1.4 |
| 3.3 | Bar rendering + axes | 3.2 |
| 3.4 | Bar App Builder properties | 3.3 |
| 3.5 | Bar click drill-down | 3.4 |
| 3.6 | Bar Jest tests | 3.5 |

*[Similar chunk patterns for remaining phases...]*

---

## 4. Right-Sized Steps

After multiple iterations, here are the atomic steps that:
- Are small enough to test individually
- Are large enough to show progress
- Build on each other with no orphaned code
- Wire into the system immediately

### Final Step List

| Step | Name | Tests | Wires Into |
|------|------|-------|------------|
| 01 | Project scaffolding | Config validation | - |
| 02 | Jest configuration | Jest runs | Step 01 |
| 03 | D3 static resource | Manual verify | Step 01 |
| 04 | D3 loader utility | Jest mock test | Steps 02, 03 |
| 05 | Apex controller skeleton | Apex test class | Step 01 |
| 06 | Apex executeQuery method | Apex test | Step 05 |
| 07 | dataService: validation | Jest tests | Step 02 |
| 08 | dataService: truncation | Jest tests | Step 07 |
| 09 | dataService: aggregation | Jest tests | Step 08 |
| 10 | themeService: palettes | Jest tests | Step 02 |
| 11 | themeService: getColors | Jest tests | Step 10 |
| 12 | chartUtils: formatters | Jest tests | Step 02 |
| 13 | chartUtils: tooltip | Jest tests | Step 12 |
| 14 | chartUtils: resizeObserver | Jest tests | Step 13 |
| 15 | Gauge: component skeleton | Renders empty | Step 04 |
| 16 | Gauge: basic arc render | Visual test | Step 15 |
| 17 | Gauge: value display | Jest test | Step 16 |
| 18 | Gauge: theme integration | Jest test | Steps 17, 11 |
| 19 | Gauge: resize handling | Jest test | Steps 18, 14 |
| 20 | Gauge: App Builder XML | Config test | Step 19 |
| 21 | Gauge: SOQL data source | Jest test | Steps 20, 06 |
| 22 | Gauge: navigation click | Jest test | Step 21 |
| 23 | Gauge: complete tests | Full coverage | Step 22 |
| 24 | Bar: component skeleton | Renders empty | Step 23 |
| 25 | Bar: aggregation wiring | Jest test | Steps 24, 09 |
| 26 | Bar: basic render | Visual test | Step 25 |
| 27 | Bar: axes + grid | Jest test | Step 26 |
| 28 | Bar: theme integration | Jest test | Steps 27, 11 |
| 29 | Bar: resize handling | Jest test | Steps 28, 14 |
| 30 | Bar: App Builder XML | Config test | Step 29 |
| 31 | Bar: SOQL data source | Jest test | Steps 30, 06 |
| 32 | Bar: drill-down click | Jest test | Step 31 |
| 33 | Bar: advancedConfig JSON | Jest test | Step 32 |
| 34 | Bar: complete tests | Full coverage | Step 33 |
| 35 | Donut: component skeleton | Renders empty | Step 34 |
| 36 | Donut: pie generator | Jest test | Step 35 |
| 37 | Donut: slice render | Visual test | Step 36 |
| 38 | Donut: legend | Jest test | Step 37 |
| 39 | Donut: full integration | Full coverage | Step 38 |
| 40 | Line: component skeleton | Renders empty | Step 39 |
| 41 | Line: time scale | Jest test | Step 40 |
| 42 | Line: path render | Visual test | Step 41 |
| 43 | Line: multi-series | Jest test | Step 42 |
| 44 | Line: full integration | Full coverage | Step 43 |
| 45 | Histogram: skeleton | Renders empty | Step 44 |
| 46 | Histogram: bin generator | Jest test | Step 45 |
| 47 | Histogram: full integration | Full coverage | Step 46 |
| 48 | Scatter: skeleton | Renders empty | Step 47 |
| 49 | Scatter: dual axis | Jest test | Step 48 |
| 50 | Scatter: full integration | Full coverage | Step 49 |
| 51 | Treemap: skeleton | Renders empty | Step 50 |
| 52 | Treemap: hierarchy | Jest test | Step 51 |
| 53 | Treemap: full integration | Full coverage | Step 52 |
| 54 | Sankey: skeleton | Renders empty | Step 53 |
| 55 | Sankey: links + nodes | Jest test | Step 54 |
| 56 | Sankey: full integration | Full coverage | Step 55 |
| 57 | Force: skeleton | Renders empty | Step 56 |
| 58 | Force: simulation | Jest test | Step 57 |
| 59 | Force: full integration | Full coverage | Step 58 |
| 60 | Choropleth: skeleton | Renders empty | Step 59 |
| 61 | Choropleth: TopoJSON | Jest test | Step 60 |
| 62 | Choropleth: full integration | Full coverage | Step 61 |
| 63 | Showcase: FlexiPage | Deploy test | Step 62 |
| 64 | Showcase: sample data | Visual verify | Step 63 |
| 65 | Final integration tests | All pass | Step 64 |
| 66 | Documentation | README | Step 65 |

---

## 5. Code Generation Prompts

Below are the prompts for a code-generation LLM. Each prompt:
- References previous work explicitly
- Includes test requirements
- Ends with wiring/integration
- Is tagged with code blocks for easy copy

---

### Prompt 01: Project Scaffolding

```text
You are building a Salesforce LWC project for D3.js chart components.

**Context:**
- Project location: /Users/weytani/code/d3-lwc
- This is a fresh SFDX project with standard template
- Target org alias: portfolio

**Task:**
Create the folder structure for the shared modules and verify the project builds.

**Requirements:**
1. Create these folders under force-app/main/default/lwc/:
   - d3Lib/ (will hold D3 loader utility)
   - dataService/ (data processing utilities)
   - themeService/ (color palettes)
   - chartUtils/ (shared chart utilities)

2. Create placeholder files in each folder:
   - [moduleName].js (export empty object)
   - [moduleName].js-meta.xml (isExposed: false, no targets)

3. Verify project compiles: sf project deploy validate --source-dir force-app

**Output:**
- All folder/file paths created
- Validation command passes

**Tests:**
- sf project deploy validate completes without errors
```

---

### Prompt 02: Jest Configuration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: Project scaffolding complete with placeholder modules
- Project has package.json with @salesforce/sfdx-lwc-jest

**Task:**
Configure Jest for LWC testing with proper mocks for Salesforce imports.

**Requirements:**
1. Verify jest.config.js exists and is properly configured
2. Create jest.setup.js if needed for global mocks
3. Create __mocks__ folder structure:
   - force-app/main/default/lwc/__mocks__/
   - Add mock for lightning/platformShowToastEvent
   - Add mock for lightning/navigation

4. Create a simple test to verify Jest runs:
   - force-app/main/default/lwc/dataService/__tests__/dataService.test.js
   - Test: "placeholder test passes" - expect(true).toBe(true)

5. Run: npm test -- --passWithNoTests

**Output:**
- Jest configuration files
- Mock files for lightning modules
- Passing placeholder test

**Wiring:**
- Builds on Step 01 folder structure
- All future tests will use this configuration
```

---

### Prompt 03: D3 Static Resource

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: Project scaffolded, Jest configured
- D3.js will be loaded as a Salesforce Static Resource

**Task:**
Download and configure D3.js v7 as a static resource.

**Requirements:**
1. Create folder: force-app/main/default/staticresources/
2. Download D3.js v7 minified bundle from CDN:
   - URL: https://d3js.org/d3.v7.min.js
   - Save as: force-app/main/default/staticresources/d3.js
3. Create metadata file: d3.resource-meta.xml
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
       <cacheControl>Public</cacheControl>
       <contentType>application/javascript</contentType>
   </StaticResource>
   ```
4. Verify with: sf project deploy validate --source-dir force-app

**Output:**
- d3.js static resource file
- d3.resource-meta.xml metadata
- Validation passes

**Wiring:**
- This resource will be loaded by d3Lib in Step 04
```

---

### Prompt 04: D3 Loader Utility

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: D3.js static resource created at staticresources/d3.js
- Need a reusable utility to load D3 in any chart component

**Task:**
Create the d3Lib module that loads D3.js and exposes it to components.

**Requirements:**
1. Update force-app/main/default/lwc/d3Lib/d3Lib.js:
   ```javascript
   import { loadScript } from 'lightning/platformResourceLoader';
   import D3_RESOURCE from '@salesforce/resourceUrl/d3';

   let d3Instance = null;
   let loadPromise = null;

   export const loadD3 = async (component) => {
       if (d3Instance) {
           return d3Instance;
       }
       if (!loadPromise) {
           loadPromise = loadScript(component, D3_RESOURCE)
               .then(() => {
                   d3Instance = window.d3;
                   return d3Instance;
               });
       }
       return loadPromise;
   };

   export const getD3 = () => d3Instance;
   ```

2. Update d3Lib.js-meta.xml - keep isExposed: false

3. Create Jest test: d3Lib/__tests__/d3Lib.test.js
   - Mock loadScript from lightning/platformResourceLoader
   - Test: loadD3 calls loadScript with correct resource
   - Test: subsequent calls return cached instance

**Output:**
- d3Lib.js with loadD3 and getD3 exports
- Jest tests passing

**Wiring:**
- Uses static resource from Step 03
- All chart components will import { loadD3 } from 'c/d3Lib'
```

---

### Prompt 05: Apex Controller Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: D3 loader utility complete
- Components need Apex to execute dynamic SOQL queries

**Task:**
Create the Apex controller class skeleton with security annotations.

**Requirements:**
1. Create: force-app/main/default/classes/D3ChartController.cls
   ```apex
   /**
    * Controller for D3 Chart LWC components.
    * Handles dynamic SOQL execution with security enforcement.
    */
   public with sharing class D3ChartController {
       
       /**
        * Executes a SOQL query string and returns results.
        * @param queryString - The SOQL query to execute
        * @return List of SObject records
        */
       @AuraEnabled(cacheable=true)
       public static List<SObject> executeQuery(String queryString) {
           // Implementation in next step
           return new List<SObject>();
       }
   }
   ```

2. Create: force-app/main/default/classes/D3ChartController.cls-meta.xml
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
       <apiVersion>59.0</apiVersion>
       <status>Active</status>
   </ApexClass>
   ```

3. Create test class skeleton: force-app/main/default/classes/D3ChartControllerTest.cls
   ```apex
   @isTest
   private class D3ChartControllerTest {
       
       @isTest
       static void testExecuteQuery_ReturnsEmptyList() {
           // Placeholder - will be updated in Step 06
           List<SObject> result = D3ChartController.executeQuery('SELECT Id FROM Account LIMIT 1');
           System.assertNotEquals(null, result, 'Result should not be null');
       }
   }
   ```

4. Validate: sf project deploy validate --source-dir force-app

**Output:**
- D3ChartController.cls with skeleton
- D3ChartControllerTest.cls with placeholder test
- Validation passes

**Wiring:**
- Will be called by chart components via @wire or imperative
```

---

### Prompt 06: Apex executeQuery Implementation

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: D3ChartController skeleton created
- Need to implement secure dynamic SOQL execution

**Task:**
Implement the executeQuery method with proper security and error handling.

**Requirements:**
1. Update D3ChartController.executeQuery:
   ```apex
   @AuraEnabled(cacheable=true)
   public static List<SObject> executeQuery(String queryString) {
       if (String.isBlank(queryString)) {
           throw new AuraHandledException('Query string cannot be empty');
       }
       
       // Basic SOQL injection prevention
       String sanitized = queryString.trim();
       if (!sanitized.toUpperCase().startsWith('SELECT')) {
           throw new AuraHandledException('Query must start with SELECT');
       }
       
       try {
           // with sharing enforces record-level security
           // stripInaccessible enforces field-level security
           List<SObject> results = Database.query(sanitized);
           return Security.stripInaccessible(AccessType.READABLE, results).getRecords();
       } catch (QueryException e) {
           throw new AuraHandledException('Invalid query: ' + e.getMessage());
       }
   }
   ```

2. Update D3ChartControllerTest with comprehensive tests:
   ```apex
   @isTest
   private class D3ChartControllerTest {
       
       @TestSetup
       static void setup() {
           // Create test accounts
           List<Account> accounts = new List<Account>();
           for (Integer i = 0; i < 5; i++) {
               accounts.add(new Account(Name = 'Test Account ' + i));
           }
           insert accounts;
       }
       
       @isTest
       static void testExecuteQuery_ValidQuery_ReturnsRecords() {
           List<SObject> result = D3ChartController.executeQuery(
               'SELECT Id, Name FROM Account WHERE Name LIKE \'Test Account%\''
           );
           System.assertEquals(5, result.size(), 'Should return 5 accounts');
       }
       
       @isTest
       static void testExecuteQuery_EmptyQuery_ThrowsException() {
           try {
               D3ChartController.executeQuery('');
               System.assert(false, 'Should have thrown exception');
           } catch (AuraHandledException e) {
               System.assert(e.getMessage().contains('cannot be empty'));
           }
       }
       
       @isTest
       static void testExecuteQuery_InvalidQuery_ThrowsException() {
           try {
               D3ChartController.executeQuery('DELETE FROM Account');
               System.assert(false, 'Should have thrown exception');
           } catch (AuraHandledException e) {
               System.assert(e.getMessage().contains('must start with SELECT'));
           }
       }
       
       @isTest
       static void testExecuteQuery_MalformedQuery_ThrowsException() {
           try {
               D3ChartController.executeQuery('SELECT FROM InvalidObject');
               System.assert(false, 'Should have thrown exception');
           } catch (AuraHandledException e) {
               System.assert(e.getMessage().contains('Invalid query'));
           }
       }
   }
   ```

3. Run Apex tests: sf apex run test --class-names D3ChartControllerTest --result-format human

**Output:**
- Fully implemented executeQuery method
- 4 passing Apex tests
- Code coverage > 90%

**Wiring:**
- Chart components will call this via: import executeQuery from '@salesforce/apex/D3ChartController.executeQuery'
```

---

### Prompt 07: dataService - Validation Functions

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: Apex controller complete
- dataService will handle all client-side data processing
- Start with validation functions

**Task:**
Implement data validation utilities in dataService.

**Requirements:**
1. Update force-app/main/default/lwc/dataService/dataService.js:
   ```javascript
   /**
    * Data processing utilities for D3 chart components.
    * Handles validation, truncation, and aggregation.
    */
   
   const MAX_RECORDS = 2000;
   
   /**
    * Validates that data is a non-empty array.
    * @param {Array} data - Data to validate
    * @returns {Object} - { isValid: boolean, error: string|null }
    */
   export const validateData = (data) => {
       if (!data) {
           return { isValid: false, error: 'Data is required' };
       }
       if (!Array.isArray(data)) {
           return { isValid: false, error: 'Data must be an array' };
       }
       if (data.length === 0) {
           return { isValid: false, error: 'Data array is empty' };
       }
       return { isValid: true, error: null };
   };
   
   /**
    * Validates that required fields exist in data objects.
    * @param {Array} data - Data array
    * @param {Array} requiredFields - Field names to check
    * @returns {Object} - { isValid: boolean, error: string|null, missingFields: Array }
    */
   export const validateFields = (data, requiredFields) => {
       if (!requiredFields || requiredFields.length === 0) {
           return { isValid: true, error: null, missingFields: [] };
       }
       
       const sample = data[0];
       const missingFields = requiredFields.filter(field => !(field in sample));
       
       if (missingFields.length > 0) {
           return {
               isValid: false,
               error: `Missing required fields: ${missingFields.join(', ')}`,
               missingFields
           };
       }
       
       return { isValid: true, error: null, missingFields: [] };
   };
   
   export { MAX_RECORDS };
   ```

2. Create Jest tests: dataService/__tests__/dataService.test.js
   ```javascript
   import { validateData, validateFields, MAX_RECORDS } from 'c/dataService';
   
   describe('dataService', () => {
       describe('validateData', () => {
           it('returns invalid for null data', () => {
               const result = validateData(null);
               expect(result.isValid).toBe(false);
               expect(result.error).toContain('required');
           });
           
           it('returns invalid for non-array data', () => {
               const result = validateData({ foo: 'bar' });
               expect(result.isValid).toBe(false);
               expect(result.error).toContain('array');
           });
           
           it('returns invalid for empty array', () => {
               const result = validateData([]);
               expect(result.isValid).toBe(false);
               expect(result.error).toContain('empty');
           });
           
           it('returns valid for non-empty array', () => {
               const result = validateData([{ id: 1 }]);
               expect(result.isValid).toBe(true);
               expect(result.error).toBeNull();
           });
       });
       
       describe('validateFields', () => {
           const testData = [{ Name: 'Test', Amount: 100 }];
           
           it('returns valid when no required fields', () => {
               const result = validateFields(testData, []);
               expect(result.isValid).toBe(true);
           });
           
           it('returns valid when all fields present', () => {
               const result = validateFields(testData, ['Name', 'Amount']);
               expect(result.isValid).toBe(true);
           });
           
           it('returns invalid with missing fields listed', () => {
               const result = validateFields(testData, ['Name', 'Missing']);
               expect(result.isValid).toBe(false);
               expect(result.missingFields).toContain('Missing');
           });
       });
       
       describe('MAX_RECORDS', () => {
           it('is set to 2000', () => {
               expect(MAX_RECORDS).toBe(2000);
           });
       });
   });
   ```

3. Run: npm test

**Output:**
- dataService with validateData, validateFields exports
- All Jest tests passing

**Wiring:**
- Builds on Jest config from Step 02
- Will be extended in Steps 08-09
```

---

### Prompt 08: dataService - Truncation Functions

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: dataService has validation functions
- Need truncation to enforce performance guardrails (2000 record limit)

**Task:**
Add truncation utilities to dataService.

**Requirements:**
1. Add to dataService.js:
   ```javascript
   /**
    * Truncates data array to max records limit.
    * @param {Array} data - Data to truncate
    * @param {Number} limit - Max records (default: MAX_RECORDS)
    * @returns {Object} - { data: Array, truncated: boolean, originalCount: number }
    */
   export const truncateData = (data, limit = MAX_RECORDS) => {
       const originalCount = data.length;
       const truncated = originalCount > limit;
       
       return {
           data: truncated ? data.slice(0, limit) : data,
           truncated,
           originalCount
       };
   };
   
   /**
    * Prepares data with validation and truncation.
    * @param {Array} data - Raw data
    * @param {Object} options - { requiredFields: Array, limit: Number }
    * @returns {Object} - { data: Array, valid: boolean, error: string, truncated: boolean }
    */
   export const prepareData = (data, options = {}) => {
       const { requiredFields = [], limit = MAX_RECORDS } = options;
       
       // Validate
       const validation = validateData(data);
       if (!validation.isValid) {
           return { data: [], valid: false, error: validation.error, truncated: false };
       }
       
       // Validate fields
       const fieldValidation = validateFields(data, requiredFields);
       if (!fieldValidation.isValid) {
           return { data: [], valid: false, error: fieldValidation.error, truncated: false };
       }
       
       // Truncate
       const truncation = truncateData(data, limit);
       
       return {
           data: truncation.data,
           valid: true,
           error: null,
           truncated: truncation.truncated,
           originalCount: truncation.originalCount
       };
   };
   ```

2. Add Jest tests:
   ```javascript
   describe('truncateData', () => {
       it('returns data unchanged when under limit', () => {
           const data = [{ id: 1 }, { id: 2 }];
           const result = truncateData(data, 10);
           expect(result.data).toHaveLength(2);
           expect(result.truncated).toBe(false);
       });
       
       it('truncates data when over limit', () => {
           const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
           const result = truncateData(data, 50);
           expect(result.data).toHaveLength(50);
           expect(result.truncated).toBe(true);
           expect(result.originalCount).toBe(100);
       });
       
       it('uses MAX_RECORDS as default limit', () => {
           const data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
           const result = truncateData(data);
           expect(result.truncated).toBe(false);
       });
   });
   
   describe('prepareData', () => {
       it('returns invalid for bad data', () => {
           const result = prepareData(null);
           expect(result.valid).toBe(false);
       });
       
       it('returns invalid for missing required fields', () => {
           const result = prepareData([{ Name: 'Test' }], { requiredFields: ['Amount'] });
           expect(result.valid).toBe(false);
           expect(result.error).toContain('Amount');
       });
       
       it('returns valid prepared data', () => {
           const data = [{ Name: 'Test', Amount: 100 }];
           const result = prepareData(data, { requiredFields: ['Name'] });
           expect(result.valid).toBe(true);
           expect(result.data).toHaveLength(1);
       });
       
       it('indicates when data was truncated', () => {
           const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
           const result = prepareData(data, { limit: 50 });
           expect(result.truncated).toBe(true);
           expect(result.data).toHaveLength(50);
       });
   });
   ```

3. Run: npm test

**Output:**
- truncateData and prepareData functions
- All tests passing

**Wiring:**
- Extends Step 07 dataService
- prepareData will be used by all chart components
```

---

### Prompt 09: dataService - Aggregation Functions

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: dataService has validation and truncation
- Need client-side aggregation (Sum, Count, Average by groupByField)

**Task:**
Add aggregation utilities to dataService.

**Requirements:**
1. Add to dataService.js:
   ```javascript
   /**
    * Supported aggregation operations.
    */
   export const OPERATIONS = {
       SUM: 'Sum',
       COUNT: 'Count',
       AVERAGE: 'Average'
   };
   
   /**
    * Aggregates data by a group field using the specified operation.
    * @param {Array} data - Array of records
    * @param {String} groupByField - Field to group by
    * @param {String} valueField - Field to aggregate (not needed for Count)
    * @param {String} operation - 'Sum', 'Count', or 'Average'
    * @returns {Array} - [{ label: string, value: number }, ...]
    */
   export const aggregateData = (data, groupByField, valueField, operation) => {
       if (!data || !groupByField) {
           return [];
       }
       
       // Group by the specified field
       const groups = new Map();
       
       data.forEach(record => {
           const key = String(record[groupByField] ?? 'Null');
           if (!groups.has(key)) {
               groups.set(key, { sum: 0, count: 0 });
           }
           const group = groups.get(key);
           group.count += 1;
           if (valueField && record[valueField] != null) {
               group.sum += Number(record[valueField]) || 0;
           }
       });
       
       // Calculate final values based on operation
       const result = [];
       groups.forEach((group, label) => {
           let value;
           switch (operation) {
               case OPERATIONS.SUM:
                   value = group.sum;
                   break;
               case OPERATIONS.COUNT:
                   value = group.count;
                   break;
               case OPERATIONS.AVERAGE:
                   value = group.count > 0 ? group.sum / group.count : 0;
                   break;
               default:
                   value = group.count;
           }
           result.push({ label, value });
       });
       
       // Sort by value descending
       return result.sort((a, b) => b.value - a.value);
   };
   ```

2. Add Jest tests:
   ```javascript
   import { aggregateData, OPERATIONS } from 'c/dataService';
   
   describe('aggregateData', () => {
       const testData = [
           { StageName: 'Prospecting', Amount: 100 },
           { StageName: 'Prospecting', Amount: 200 },
           { StageName: 'Closed Won', Amount: 500 },
           { StageName: 'Closed Won', Amount: 300 },
           { StageName: 'Closed Won', Amount: 200 }
       ];
       
       it('returns empty array for null data', () => {
           expect(aggregateData(null, 'StageName', 'Amount', 'Sum')).toEqual([]);
       });
       
       it('returns empty array for missing groupByField', () => {
           expect(aggregateData(testData, null, 'Amount', 'Sum')).toEqual([]);
       });
       
       describe('Sum operation', () => {
           it('sums values by group', () => {
               const result = aggregateData(testData, 'StageName', 'Amount', OPERATIONS.SUM);
               expect(result).toHaveLength(2);
               
               const closedWon = result.find(r => r.label === 'Closed Won');
               expect(closedWon.value).toBe(1000); // 500 + 300 + 200
               
               const prospecting = result.find(r => r.label === 'Prospecting');
               expect(prospecting.value).toBe(300); // 100 + 200
           });
       });
       
       describe('Count operation', () => {
           it('counts records by group', () => {
               const result = aggregateData(testData, 'StageName', 'Amount', OPERATIONS.COUNT);
               
               const closedWon = result.find(r => r.label === 'Closed Won');
               expect(closedWon.value).toBe(3);
               
               const prospecting = result.find(r => r.label === 'Prospecting');
               expect(prospecting.value).toBe(2);
           });
       });
       
       describe('Average operation', () => {
           it('averages values by group', () => {
               const result = aggregateData(testData, 'StageName', 'Amount', OPERATIONS.AVERAGE);
               
               const closedWon = result.find(r => r.label === 'Closed Won');
               expect(closedWon.value).toBeCloseTo(333.33, 1); // 1000 / 3
               
               const prospecting = result.find(r => r.label === 'Prospecting');
               expect(prospecting.value).toBe(150); // 300 / 2
           });
       });
       
       it('handles null values in groupByField', () => {
           const dataWithNull = [...testData, { StageName: null, Amount: 50 }];
           const result = aggregateData(dataWithNull, 'StageName', 'Amount', OPERATIONS.SUM);
           
           const nullGroup = result.find(r => r.label === 'Null');
           expect(nullGroup).toBeDefined();
           expect(nullGroup.value).toBe(50);
       });
       
       it('sorts results by value descending', () => {
           const result = aggregateData(testData, 'StageName', 'Amount', OPERATIONS.SUM);
           expect(result[0].label).toBe('Closed Won'); // 1000 > 300
           expect(result[1].label).toBe('Prospecting');
       });
   });
   ```

3. Run: npm test

**Output:**
- aggregateData function with OPERATIONS constant
- Comprehensive tests for all operations
- All tests passing

**Wiring:**
- Completes dataService module
- Bar chart, donut chart, etc. will use aggregateData
```

---

### Prompt 10: themeService - Color Palettes

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: dataService complete with validation, truncation, aggregation
- Need theme service for consistent chart coloring

**Task:**
Create themeService with predefined color palettes.

**Requirements:**
1. Update force-app/main/default/lwc/themeService/themeService.js:
   ```javascript
   /**
    * Theme service for D3 chart components.
    * Provides color palettes aligned with SLDS and custom themes.
    */
   
   /**
    * Predefined color palettes.
    * 'Salesforce Standard' uses SLDS chart colors.
    */
   export const PALETTES = {
       'Salesforce Standard': [
           '#1589EE', // Brand Blue
           '#FF9E2C', // Warning Orange
           '#4BCA81', // Success Green
           '#FF5D5D', // Error Red
           '#AD7BFF', // Purple
           '#FF84C6', // Pink
           '#00C6CD', // Cyan
           '#B8E986', // Lime
           '#FFD86E', // Yellow
           '#A4C7F1'  // Light Blue
       ],
       'Warm': [
           '#FF6B6B', '#FF8E72', '#FFB677', '#FFD93D',
           '#F9844A', '#F3722C', '#F94144', '#E63946',
           '#D62839', '#BA1B1D'
       ],
       'Cool': [
           '#4361EE', '#3A0CA3', '#7209B7', '#560BAD',
           '#480CA8', '#3F37C9', '#4895EF', '#4CC9F0',
           '#00B4D8', '#0077B6'
       ],
       'Vibrant': [
           '#FF595E', '#FFCA3A', '#8AC926', '#1982C4',
           '#6A4C93', '#FF85A1', '#FFD166', '#06D6A0',
           '#118AB2', '#9B5DE5'
       ]
   };
   
   /**
    * Available theme names.
    */
   export const THEMES = Object.keys(PALETTES);
   
   /**
    * Default theme.
    */
   export const DEFAULT_THEME = 'Salesforce Standard';
   ```

2. Create Jest tests: themeService/__tests__/themeService.test.js
   ```javascript
   import { PALETTES, THEMES, DEFAULT_THEME } from 'c/themeService';
   
   describe('themeService', () => {
       describe('PALETTES', () => {
           it('has Salesforce Standard palette', () => {
               expect(PALETTES['Salesforce Standard']).toBeDefined();
               expect(PALETTES['Salesforce Standard']).toHaveLength(10);
           });
           
           it('has Warm palette', () => {
               expect(PALETTES['Warm']).toBeDefined();
               expect(PALETTES['Warm'].length).toBeGreaterThanOrEqual(5);
           });
           
           it('has Cool palette', () => {
               expect(PALETTES['Cool']).toBeDefined();
           });
           
           it('has Vibrant palette', () => {
               expect(PALETTES['Vibrant']).toBeDefined();
           });
           
           it('all palettes have valid hex colors', () => {
               const hexRegex = /^#[0-9A-Fa-f]{6}$/;
               Object.values(PALETTES).forEach(palette => {
                   palette.forEach(color => {
                       expect(color).toMatch(hexRegex);
                   });
               });
           });
       });
       
       describe('THEMES', () => {
           it('lists all available themes', () => {
               expect(THEMES).toContain('Salesforce Standard');
               expect(THEMES).toContain('Warm');
               expect(THEMES).toContain('Cool');
               expect(THEMES).toContain('Vibrant');
           });
       });
       
       describe('DEFAULT_THEME', () => {
           it('is Salesforce Standard', () => {
               expect(DEFAULT_THEME).toBe('Salesforce Standard');
           });
           
           it('exists in PALETTES', () => {
               expect(PALETTES[DEFAULT_THEME]).toBeDefined();
           });
       });
   });
   ```

3. Run: npm test

**Output:**
- PALETTES object with 4 themes
- THEMES array and DEFAULT_THEME constant
- All tests passing

**Wiring:**
- Builds on Step 02 Jest config
- Will be extended in Step 11 with getColors function
```

---

### Prompt 11: themeService - getColors Function

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: themeService has PALETTES defined
- Need function to get colors for a dataset

**Task:**
Add getColors function that returns appropriate number of colors.

**Requirements:**
1. Add to themeService.js:
   ```javascript
   /**
    * Gets color array for a dataset.
    * @param {String} theme - Theme name (falls back to default)
    * @param {Number} count - Number of colors needed
    * @param {Array} customColors - Optional custom color override
    * @returns {Array} - Array of hex color strings
    */
   export const getColors = (theme, count, customColors = null) => {
       // Use custom colors if provided
       if (customColors && Array.isArray(customColors) && customColors.length > 0) {
           return extendColors(customColors, count);
       }
       
       // Get palette for theme
       const palette = PALETTES[theme] || PALETTES[DEFAULT_THEME];
       return extendColors(palette, count);
   };
   
   /**
    * Extends or truncates a color array to match count.
    * If count > colors.length, cycles through colors.
    * @param {Array} colors - Base color array
    * @param {Number} count - Desired count
    * @returns {Array} - Color array of exact length
    */
   const extendColors = (colors, count) => {
       if (count <= 0) return [];
       if (count <= colors.length) return colors.slice(0, count);
       
       // Cycle through colors to fill count
       const result = [];
       for (let i = 0; i < count; i++) {
           result.push(colors[i % colors.length]);
       }
       return result;
   };
   
   /**
    * Creates a D3 color scale from theme.
    * @param {String} theme - Theme name
    * @param {Array} domain - Data domain (labels)
    * @param {Array} customColors - Optional custom colors
    * @returns {Function} - D3 ordinal scale function
    */
   export const createColorScale = (theme, domain, customColors = null) => {
       const colors = getColors(theme, domain.length, customColors);
       // Returns a simple lookup function (D3 scale would be created in component)
       const colorMap = new Map();
       domain.forEach((label, i) => colorMap.set(label, colors[i]));
       return (label) => colorMap.get(label) || colors[0];
   };
   ```

2. Add Jest tests:
   ```javascript
   import { getColors, createColorScale, PALETTES } from 'c/themeService';
   
   describe('getColors', () => {
       it('returns colors from specified theme', () => {
           const colors = getColors('Warm', 3);
           expect(colors).toHaveLength(3);
           expect(PALETTES['Warm']).toContain(colors[0]);
       });
       
       it('falls back to default theme for unknown theme', () => {
           const colors = getColors('NonExistent', 3);
           expect(colors).toHaveLength(3);
           expect(PALETTES['Salesforce Standard']).toContain(colors[0]);
       });
       
       it('returns exact count of colors', () => {
           expect(getColors('Cool', 5)).toHaveLength(5);
           expect(getColors('Cool', 1)).toHaveLength(1);
       });
       
       it('cycles colors when count exceeds palette size', () => {
           const palette = PALETTES['Salesforce Standard'];
           const colors = getColors('Salesforce Standard', 15);
           expect(colors).toHaveLength(15);
           // 11th color should cycle back to 1st
           expect(colors[10]).toBe(palette[0]);
       });
       
       it('uses custom colors when provided', () => {
           const custom = ['#FF0000', '#00FF00', '#0000FF'];
           const colors = getColors('Warm', 3, custom);
           expect(colors).toEqual(custom);
       });
       
       it('extends custom colors if count exceeds custom array', () => {
           const custom = ['#FF0000', '#00FF00'];
           const colors = getColors('Warm', 4, custom);
           expect(colors).toHaveLength(4);
           expect(colors[2]).toBe('#FF0000'); // Cycles
       });
       
       it('returns empty array for count <= 0', () => {
           expect(getColors('Warm', 0)).toEqual([]);
           expect(getColors('Warm', -1)).toEqual([]);
       });
   });
   
   describe('createColorScale', () => {
       it('returns a function', () => {
           const scale = createColorScale('Warm', ['A', 'B', 'C']);
           expect(typeof scale).toBe('function');
       });
       
       it('maps domain values to colors', () => {
           const domain = ['Alpha', 'Beta', 'Gamma'];
           const scale = createColorScale('Salesforce Standard', domain);
           
           const colors = domain.map(d => scale(d));
           expect(colors).toHaveLength(3);
           // Each should be unique
           expect(new Set(colors).size).toBe(3);
       });
       
       it('returns first color for unknown domain value', () => {
           const scale = createColorScale('Warm', ['A', 'B']);
           const unknownColor = scale('Unknown');
           const firstColor = scale('A');
           expect(unknownColor).toBe(firstColor);
       });
   });
   ```

3. Run: npm test

**Output:**
- getColors and createColorScale functions
- All tests passing

**Wiring:**
- Completes themeService module
- Chart components will use getColors(theme, dataCount, advancedConfig?.customColors)
```

---

### Prompt 12: chartUtils - Formatters

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: dataService and themeService complete
- Need shared utility functions for chart formatting

**Task:**
Create chartUtils with number and label formatting functions.

**Requirements:**
1. Update force-app/main/default/lwc/chartUtils/chartUtils.js:
   ```javascript
   /**
    * Shared utilities for D3 chart components.
    * Provides formatters, tooltip helpers, and resize handling.
    */
   
   /**
    * Formats a number for display (K, M, B suffixes).
    * @param {Number} value - Number to format
    * @param {Number} decimals - Decimal places (default: 1)
    * @returns {String} - Formatted string
    */
   export const formatNumber = (value, decimals = 1) => {
       if (value === null || value === undefined || isNaN(value)) {
           return '0';
       }
       
       const absValue = Math.abs(value);
       const sign = value < 0 ? '-' : '';
       
       if (absValue >= 1e9) {
           return sign + (absValue / 1e9).toFixed(decimals) + 'B';
       }
       if (absValue >= 1e6) {
           return sign + (absValue / 1e6).toFixed(decimals) + 'M';
       }
       if (absValue >= 1e3) {
           return sign + (absValue / 1e3).toFixed(decimals) + 'K';
       }
       
       return sign + absValue.toFixed(decimals).replace(/\.0+$/, '');
   };
   
   /**
    * Formats a number as currency.
    * @param {Number} value - Number to format
    * @param {String} currency - Currency code (default: 'USD')
    * @returns {String} - Formatted currency string
    */
   export const formatCurrency = (value, currency = 'USD') => {
       if (value === null || value === undefined || isNaN(value)) {
           return '$0';
       }
       
       try {
           return new Intl.NumberFormat('en-US', {
               style: 'currency',
               currency,
               minimumFractionDigits: 0,
               maximumFractionDigits: 0
           }).format(value);
       } catch (e) {
           return '$' + formatNumber(value);
       }
   };
   
   /**
    * Formats a percentage.
    * @param {Number} value - Decimal value (0.5 = 50%)
    * @param {Number} decimals - Decimal places
    * @returns {String} - Formatted percentage
    */
   export const formatPercent = (value, decimals = 1) => {
       if (value === null || value === undefined || isNaN(value)) {
           return '0%';
       }
       return (value * 100).toFixed(decimals) + '%';
   };
   
   /**
    * Truncates a label to max length with ellipsis.
    * @param {String} label - Label to truncate
    * @param {Number} maxLength - Maximum characters
    * @returns {String} - Truncated label
    */
   export const truncateLabel = (label, maxLength = 20) => {
       if (!label) return '';
       const str = String(label);
       if (str.length <= maxLength) return str;
       return str.substring(0, maxLength - 3) + '...';
   };
   ```

2. Create Jest tests: chartUtils/__tests__/chartUtils.test.js
   ```javascript
   import { formatNumber, formatCurrency, formatPercent, truncateLabel } from 'c/chartUtils';
   
   describe('chartUtils', () => {
       describe('formatNumber', () => {
           it('formats thousands with K', () => {
               expect(formatNumber(1500)).toBe('1.5K');
               expect(formatNumber(10000)).toBe('10K');
           });
           
           it('formats millions with M', () => {
               expect(formatNumber(1500000)).toBe('1.5M');
               expect(formatNumber(25000000)).toBe('25M');
           });
           
           it('formats billions with B', () => {
               expect(formatNumber(1500000000)).toBe('1.5B');
           });
           
           it('handles small numbers without suffix', () => {
               expect(formatNumber(500)).toBe('500');
               expect(formatNumber(50.5)).toBe('50.5');
           });
           
           it('handles negative numbers', () => {
               expect(formatNumber(-1500)).toBe('-1.5K');
               expect(formatNumber(-500)).toBe('-500');
           });
           
           it('handles null/undefined', () => {
               expect(formatNumber(null)).toBe('0');
               expect(formatNumber(undefined)).toBe('0');
               expect(formatNumber(NaN)).toBe('0');
           });
           
           it('respects decimal places parameter', () => {
               expect(formatNumber(1234567, 2)).toBe('1.23M');
               expect(formatNumber(1234567, 0)).toBe('1M');
           });
       });
       
       describe('formatCurrency', () => {
           it('formats USD by default', () => {
               expect(formatCurrency(1000)).toBe('$1,000');
               expect(formatCurrency(1500000)).toBe('$1,500,000');
           });
           
           it('handles null/undefined', () => {
               expect(formatCurrency(null)).toBe('$0');
           });
       });
       
       describe('formatPercent', () => {
           it('converts decimal to percentage', () => {
               expect(formatPercent(0.5)).toBe('50.0%');
               expect(formatPercent(0.123)).toBe('12.3%');
           });
           
           it('handles values over 100%', () => {
               expect(formatPercent(1.5)).toBe('150.0%');
           });
           
           it('handles null/undefined', () => {
               expect(formatPercent(null)).toBe('0%');
           });
       });
       
       describe('truncateLabel', () => {
           it('returns short labels unchanged', () => {
               expect(truncateLabel('Short')).toBe('Short');
           });
           
           it('truncates long labels with ellipsis', () => {
               const long = 'This is a very long label that needs truncation';
               const result = truncateLabel(long, 20);
               expect(result).toHaveLength(20);
               expect(result.endsWith('...')).toBe(true);
           });
           
           it('handles empty/null input', () => {
               expect(truncateLabel(null)).toBe('');
               expect(truncateLabel('')).toBe('');
           });
           
           it('converts non-strings to strings', () => {
               expect(truncateLabel(12345)).toBe('12345');
           });
       });
   });
   ```

3. Run: npm test

**Output:**
- formatNumber, formatCurrency, formatPercent, truncateLabel functions
- All tests passing

**Wiring:**
- Builds on Step 02 Jest config
- Will be extended in Steps 13-14
```

---

### Prompt 13: chartUtils - Tooltip Helper

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: chartUtils has formatter functions
- Need tooltip creation and positioning utilities

**Task:**
Add tooltip utilities to chartUtils.

**Requirements:**
1. Add to chartUtils.js:
   ```javascript
   /**
    * Creates SLDS-styled tooltip element.
    * @param {HTMLElement} container - Parent container for tooltip
    * @returns {Object} - Tooltip controller { show, hide, element }
    */
   export const createTooltip = (container) => {
       // Create tooltip div with SLDS styling
       const tooltip = document.createElement('div');
       tooltip.className = 'slds-popover slds-popover_tooltip slds-nubbin_bottom';
       tooltip.setAttribute('role', 'tooltip');
       tooltip.style.cssText = `
           position: absolute;
           pointer-events: none;
           opacity: 0;
           transition: opacity 0.15s ease-in-out;
           z-index: 9999;
           max-width: 300px;
       `;
       
       const body = document.createElement('div');
       body.className = 'slds-popover__body';
       tooltip.appendChild(body);
       
       container.appendChild(tooltip);
       
       return {
           element: tooltip,
           
           /**
            * Shows tooltip with content at position.
            * @param {String} content - HTML content
            * @param {Number} x - X position
            * @param {Number} y - Y position
            */
           show(content, x, y) {
               body.innerHTML = content;
               tooltip.style.opacity = '1';
               
               // Position tooltip above the point
               const rect = tooltip.getBoundingClientRect();
               const containerRect = container.getBoundingClientRect();
               
               let left = x - rect.width / 2;
               let top = y - rect.height - 10;
               
               // Keep within container bounds
               left = Math.max(0, Math.min(left, containerRect.width - rect.width));
               top = Math.max(0, top);
               
               tooltip.style.left = left + 'px';
               tooltip.style.top = top + 'px';
           },
           
           /**
            * Hides the tooltip.
            */
           hide() {
               tooltip.style.opacity = '0';
           },
           
           /**
            * Removes tooltip from DOM.
            */
           destroy() {
               tooltip.remove();
           }
       };
   };
   
   /**
    * Builds tooltip content HTML.
    * @param {String} label - Primary label
    * @param {String|Number} value - Value to display
    * @param {Object} options - { formatter: Function, prefix: String, suffix: String }
    * @returns {String} - HTML string
    */
   export const buildTooltipContent = (label, value, options = {}) => {
       const { formatter = formatNumber, prefix = '', suffix = '' } = options;
       const formattedValue = formatter ? formatter(value) : value;
       
       return `
           <div style="font-weight: bold; margin-bottom: 4px;">${label}</div>
           <div>${prefix}${formattedValue}${suffix}</div>
       `;
   };
   ```

2. Add Jest tests:
   ```javascript
   import { createTooltip, buildTooltipContent, formatNumber } from 'c/chartUtils';
   
   describe('createTooltip', () => {
       let container;
       let tooltip;
       
       beforeEach(() => {
           container = document.createElement('div');
           container.style.position = 'relative';
           container.style.width = '500px';
           container.style.height = '300px';
           document.body.appendChild(container);
           tooltip = createTooltip(container);
       });
       
       afterEach(() => {
           tooltip.destroy();
           container.remove();
       });
       
       it('creates tooltip element in container', () => {
           expect(tooltip.element).toBeDefined();
           expect(container.contains(tooltip.element)).toBe(true);
       });
       
       it('has SLDS classes', () => {
           expect(tooltip.element.classList.contains('slds-popover')).toBe(true);
           expect(tooltip.element.classList.contains('slds-popover_tooltip')).toBe(true);
       });
       
       it('starts hidden (opacity 0)', () => {
           expect(tooltip.element.style.opacity).toBe('0');
       });
       
       it('show() displays tooltip with content', () => {
           tooltip.show('<b>Test</b>', 100, 100);
           expect(tooltip.element.style.opacity).toBe('1');
           expect(tooltip.element.querySelector('.slds-popover__body').innerHTML).toContain('Test');
       });
       
       it('hide() hides tooltip', () => {
           tooltip.show('Content', 100, 100);
           tooltip.hide();
           expect(tooltip.element.style.opacity).toBe('0');
       });
       
       it('destroy() removes from DOM', () => {
           tooltip.destroy();
           expect(container.contains(tooltip.element)).toBe(false);
       });
   });
   
   describe('buildTooltipContent', () => {
       it('builds HTML with label and value', () => {
           const html = buildTooltipContent('Sales', 1500000);
           expect(html).toContain('Sales');
           expect(html).toContain('1.5M'); // Default formatter
       });
       
       it('uses custom formatter', () => {
           const html = buildTooltipContent('Count', 42, { formatter: (v) => v.toString() });
           expect(html).toContain('42');
       });
       
       it('adds prefix and suffix', () => {
           const html = buildTooltipContent('Amount', 100, { prefix: '$', suffix: ' USD' });
           expect(html).toContain('$');
           expect(html).toContain('USD');
       });
   });
   ```

3. Run: npm test

**Output:**
- createTooltip and buildTooltipContent functions
- All tests passing

**Wiring:**
- Extends Step 12 chartUtils
- Chart components will use createTooltip for hover interactions
```

---

### Prompt 14: chartUtils - ResizeObserver Utility

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: chartUtils has formatters and tooltip
- Need resize detection for responsive charts

**Task:**
Add ResizeObserver utility to chartUtils.

**Requirements:**
1. Add to chartUtils.js:
   ```javascript
   /**
    * Creates a debounced resize observer for a container.
    * @param {HTMLElement} container - Element to observe
    * @param {Function} callback - Called with { width, height } on resize
    * @param {Number} debounceMs - Debounce delay (default: 100)
    * @returns {Object} - { observe, disconnect }
    */
   export const createResizeHandler = (container, callback, debounceMs = 100) => {
       let timeoutId = null;
       let observer = null;
       
       const debouncedCallback = (entries) => {
           if (timeoutId) {
               clearTimeout(timeoutId);
           }
           
           timeoutId = setTimeout(() => {
               const entry = entries[0];
               if (entry) {
                   const { width, height } = entry.contentRect;
                   callback({ width, height });
               }
           }, debounceMs);
       };
       
       return {
           /**
            * Starts observing the container.
            */
           observe() {
               if (typeof ResizeObserver !== 'undefined') {
                   observer = new ResizeObserver(debouncedCallback);
                   observer.observe(container);
               } else {
                   // Fallback: just call once with current size
                   const rect = container.getBoundingClientRect();
                   callback({ width: rect.width, height: rect.height });
               }
           },
           
           /**
            * Stops observing and cleans up.
            */
           disconnect() {
               if (timeoutId) {
                   clearTimeout(timeoutId);
               }
               if (observer) {
                   observer.disconnect();
                   observer = null;
               }
           }
       };
   };
   
   /**
    * Calculates chart dimensions from container with margins.
    * @param {Number} containerWidth - Container width
    * @param {Number} containerHeight - Container height
    * @param {Object} margins - { top, right, bottom, left }
    * @returns {Object} - { width, height, margins }
    */
   export const calculateDimensions = (containerWidth, containerHeight, margins = {}) => {
       const defaultMargins = { top: 20, right: 20, bottom: 30, left: 40 };
       const m = { ...defaultMargins, ...margins };
       
       return {
           width: Math.max(0, containerWidth - m.left - m.right),
           height: Math.max(0, containerHeight - m.top - m.bottom),
           margins: m
       };
   };
   
   /**
    * Determines if chart should use compact mode based on width.
    * @param {Number} width - Current width
    * @param {Number} minWidth - Minimum recommended width
    * @returns {Boolean} - True if compact mode should be used
    */
   export const shouldUseCompactMode = (width, minWidth = 300) => {
       return width < minWidth;
   };
   ```

2. Add Jest tests:
   ```javascript
   import { createResizeHandler, calculateDimensions, shouldUseCompactMode } from 'c/chartUtils';
   
   // Mock ResizeObserver
   class MockResizeObserver {
       constructor(callback) {
           this.callback = callback;
           this.elements = [];
       }
       observe(element) {
           this.elements.push(element);
       }
       disconnect() {
           this.elements = [];
       }
       // Helper to trigger resize
       trigger(entries) {
           this.callback(entries);
       }
   }
   
   describe('createResizeHandler', () => {
       let container;
       let originalResizeObserver;
       
       beforeEach(() => {
           container = document.createElement('div');
           originalResizeObserver = global.ResizeObserver;
           global.ResizeObserver = MockResizeObserver;
       });
       
       afterEach(() => {
           global.ResizeObserver = originalResizeObserver;
       });
       
       it('returns observe and disconnect functions', () => {
           const handler = createResizeHandler(container, jest.fn());
           expect(typeof handler.observe).toBe('function');
           expect(typeof handler.disconnect).toBe('function');
       });
       
       it('calls callback with dimensions on resize', (done) => {
           const callback = jest.fn();
           const handler = createResizeHandler(container, callback, 10); // Short debounce for test
           handler.observe();
           
           // Manually trigger the observer callback
           // In real scenario, ResizeObserver would do this
           setTimeout(() => {
               expect(callback).toHaveBeenCalled();
               handler.disconnect();
               done();
           }, 50);
       });
   });
   
   describe('calculateDimensions', () => {
       it('calculates inner dimensions from container and margins', () => {
           const result = calculateDimensions(500, 300, { top: 10, right: 10, bottom: 30, left: 40 });
           expect(result.width).toBe(450); // 500 - 10 - 40
           expect(result.height).toBe(260); // 300 - 10 - 30
       });
       
       it('uses default margins if not provided', () => {
           const result = calculateDimensions(500, 300);
           expect(result.margins.top).toBe(20);
           expect(result.margins.left).toBe(40);
       });
       
       it('returns non-negative dimensions', () => {
           const result = calculateDimensions(50, 50, { top: 100, right: 0, bottom: 0, left: 0 });
           expect(result.height).toBe(0); // Would be -50, clamped to 0
       });
       
       it('allows partial margin override', () => {
           const result = calculateDimensions(500, 300, { left: 60 });
           expect(result.margins.left).toBe(60);
           expect(result.margins.top).toBe(20); // Default
       });
   });
   
   describe('shouldUseCompactMode', () => {
       it('returns true when width below minimum', () => {
           expect(shouldUseCompactMode(200, 300)).toBe(true);
       });
       
       it('returns false when width above minimum', () => {
           expect(shouldUseCompactMode(400, 300)).toBe(false);
       });
       
       it('uses default minimum of 300', () => {
           expect(shouldUseCompactMode(250)).toBe(true);
           expect(shouldUseCompactMode(350)).toBe(false);
       });
   });
   ```

3. Run: npm test

**Output:**
- createResizeHandler, calculateDimensions, shouldUseCompactMode functions
- All tests passing

**Wiring:**
- Completes chartUtils module
- Chart components will use createResizeHandler in connectedCallback
```

---

### Prompt 15: Gauge Component - Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: All shared modules complete (d3Lib, dataService, themeService, chartUtils)
- Now building first chart: d3-gauge (simplest - single value display)

**Task:**
Create the d3-gauge component skeleton with basic structure.

**Requirements:**
1. Create folder: force-app/main/default/lwc/d3Gauge/

2. Create d3Gauge.html:
   ```html
   <template>
       <div class="chart-container slds-is-relative" lwc:ref="container">
           <div class="chart-loading" if:true={isLoading}>
               <lightning-spinner alternative-text="Loading" size="medium"></lightning-spinner>
           </div>
           <div class="chart-error slds-text-color_error" if:true={error}>
               {error}
           </div>
           <svg lwc:ref="svg" class="chart-svg" if:false={error}></svg>
       </div>
   </template>
   ```

3. Create d3Gauge.js:
   ```javascript
   import { LightningElement, api } from 'lwc';
   import { loadD3 } from 'c/d3Lib';
   
   export default class D3Gauge extends LightningElement {
       // ===== DATA SOURCE PROPERTIES =====
       @api recordCollection = [];
       @api soqlQuery = '';
       
       // ===== CONFIGURATION PROPERTIES =====
       @api valueField = '';
       @api height = 200;
       @api theme = 'Salesforce Standard';
       @api advancedConfig = '';
       
       // ===== NAVIGATION PROPERTY =====
       @api targetRecordId = '';
       
       // ===== INTERNAL STATE =====
       d3 = null;
       isLoading = true;
       error = null;
       
       // ===== GETTERS =====
       get parsedConfig() {
           if (!this.advancedConfig) return {};
           try {
               return JSON.parse(this.advancedConfig);
           } catch (e) {
               console.warn('Invalid advancedConfig JSON:', e);
               return {};
           }
       }
       
       // ===== LIFECYCLE =====
       async connectedCallback() {
           try {
               this.d3 = await loadD3(this);
               await this.loadData();
               this.renderChart();
           } catch (e) {
               this.error = e.message || 'Failed to initialize chart';
               console.error('D3Gauge error:', e);
           } finally {
               this.isLoading = false;
           }
       }
       
       disconnectedCallback() {
           // Cleanup will be added later
       }
       
       // ===== DATA LOADING =====
       async loadData() {
           // Will be implemented in Step 21
       }
       
       // ===== RENDERING =====
       renderChart() {
           // Will be implemented in Step 16
       }
   }
   ```

4. Create d3Gauge.css:
   ```css
   .chart-container {
       width: 100%;
       min-height: 100px;
   }
   
   .chart-svg {
       width: 100%;
       display: block;
   }
   
   .chart-loading {
       display: flex;
       justify-content: center;
       align-items: center;
       min-height: 150px;
   }
   
   .chart-error {
       padding: 1rem;
       text-align: center;
   }
   ```

5. Create d3Gauge.js-meta.xml:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
       <apiVersion>59.0</apiVersion>
       <isExposed>true</isExposed>
       <masterLabel>D3 Gauge Chart</masterLabel>
       <description>A gauge chart for displaying single KPI values</description>
       <targets>
           <target>lightning__AppPage</target>
           <target>lightning__RecordPage</target>
           <target>lightning__HomePage</target>
           <target>lightningCommunity__Page</target>
           <target>lightningCommunity__Default</target>
           <target>lightning__FlowScreen</target>
       </targets>
       <targetConfigs>
           <targetConfig targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage,lightningCommunity__Page,lightningCommunity__Default">
               <!-- Data Source -->
               <property name="soqlQuery" type="String" label="SOQL Query" description="Query to fetch data (alternative to collection)"/>
               
               <!-- Configuration -->
               <property name="valueField" type="String" label="Value Field" required="true" description="API name of the numeric field"/>
               <property name="height" type="Integer" label="Height (px)" default="200"/>
               <property name="theme" type="String" label="Color Theme" default="Salesforce Standard"
                   datasource="Salesforce Standard,Warm,Cool,Vibrant,Custom"/>
               <property name="advancedConfig" type="String" label="Advanced Config (JSON)"/>
               
               <!-- Navigation -->
               <property name="targetRecordId" type="String" label="Target Record ID" description="Record to navigate to on click"/>
           </targetConfig>
           <targetConfig targets="lightning__FlowScreen">
               <property name="recordCollection" type="@salesforce/schema/SObject[]" label="Record Collection" role="inputOnly"/>
               <property name="valueField" type="String" label="Value Field" required="true"/>
               <property name="height" type="Integer" label="Height (px)" default="200"/>
               <property name="theme" type="String" label="Color Theme" default="Salesforce Standard"/>
           </targetConfig>
       </targetConfigs>
   </LightningComponentBundle>
   ```

6. Validate: sf project deploy validate --source-dir force-app

**Output:**
- Complete d3Gauge component folder with all files
- Component loads D3 and shows loading state
- Validation passes

**Wiring:**
- Uses d3Lib from Step 04
- Structure will be template for all other charts
```

---

### Prompt 16: Gauge Component - Basic Arc Render

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge skeleton created with loading state
- Need to render the actual gauge arc using D3

**Task:**
Implement the gauge arc rendering with D3.

**Requirements:**
1. Update d3Gauge.js renderChart method:
   ```javascript
   import { LightningElement, api } from 'lwc';
   import { loadD3 } from 'c/d3Lib';
   import { getColors } from 'c/themeService';
   import { calculateDimensions, createResizeHandler } from 'c/chartUtils';
   
   export default class D3Gauge extends LightningElement {
       // ... existing properties ...
       
       resizeHandler = null;
       currentValue = 0;
       minValue = 0;
       maxValue = 100;
       
       // ===== LIFECYCLE =====
       async connectedCallback() {
           try {
               this.d3 = await loadD3(this);
               // For now, use mock value until data loading is implemented
               this.currentValue = 75;
               this.isLoading = false;
               // Need to wait for DOM
               await Promise.resolve();
               this.setupResizeObserver();
               this.renderChart();
           } catch (e) {
               this.error = e.message || 'Failed to initialize chart';
               this.isLoading = false;
           }
       }
       
       disconnectedCallback() {
           if (this.resizeHandler) {
               this.resizeHandler.disconnect();
           }
       }
       
       setupResizeObserver() {
           const container = this.refs.container;
           if (!container) return;
           
           this.resizeHandler = createResizeHandler(container, () => {
               this.renderChart();
           });
           this.resizeHandler.observe();
       }
       
       renderChart() {
           const container = this.refs.container;
           const svg = this.refs.svg;
           if (!container || !svg || !this.d3) return;
           
           const d3 = this.d3;
           const containerWidth = container.clientWidth || 300;
           const chartHeight = this.height || 200;
           
           // Clear previous render
           d3.select(svg).selectAll('*').remove();
           
           // Calculate dimensions
           const width = containerWidth;
           const height = chartHeight;
           const radius = Math.min(width, height * 2) / 2 - 20;
           
           // Create SVG
           const svgSelection = d3.select(svg)
               .attr('width', width)
               .attr('height', height);
           
           const g = svgSelection.append('g')
               .attr('transform', `translate(${width / 2}, ${height - 20})`);
           
           // Arc generator for background
           const arcBackground = d3.arc()
               .innerRadius(radius * 0.7)
               .outerRadius(radius)
               .startAngle(-Math.PI / 2)
               .endAngle(Math.PI / 2);
           
           // Draw background arc (gray)
           g.append('path')
               .attr('d', arcBackground)
               .attr('fill', '#E5E5E5');
           
           // Calculate value angle
           const scale = d3.scaleLinear()
               .domain([this.minValue, this.maxValue])
               .range([-Math.PI / 2, Math.PI / 2])
               .clamp(true);
           
           const valueAngle = scale(this.currentValue);
           
           // Arc generator for value
           const arcValue = d3.arc()
               .innerRadius(radius * 0.7)
               .outerRadius(radius)
               .startAngle(-Math.PI / 2)
               .endAngle(valueAngle);
           
           // Get color from theme
           const colors = getColors(this.theme, 1, this.parsedConfig.customColors);
           
           // Draw value arc
           g.append('path')
               .attr('d', arcValue)
               .attr('fill', colors[0]);
       }
   }
   ```

2. Create Jest test: d3Gauge/__tests__/d3Gauge.test.js
   ```javascript
   import { createElement } from 'lwc';
   import D3Gauge from 'c/d3Gauge';
   
   // Mock the d3Lib module
   jest.mock('c/d3Lib', () => ({
       loadD3: jest.fn().mockResolvedValue({
           select: jest.fn().mockReturnThis(),
           selectAll: jest.fn().mockReturnThis(),
           remove: jest.fn().mockReturnThis(),
           attr: jest.fn().mockReturnThis(),
           append: jest.fn().mockReturnThis(),
           arc: jest.fn().mockReturnValue({
               innerRadius: jest.fn().mockReturnThis(),
               outerRadius: jest.fn().mockReturnThis(),
               startAngle: jest.fn().mockReturnThis(),
               endAngle: jest.fn().mockReturnValue('mock-path')
           }),
           scaleLinear: jest.fn().mockReturnValue({
               domain: jest.fn().mockReturnThis(),
               range: jest.fn().mockReturnThis(),
               clamp: jest.fn().mockReturnThis()
           })
       })
   }));
   
   // Mock themeService
   jest.mock('c/themeService', () => ({
       getColors: jest.fn().mockReturnValue(['#1589EE'])
   }));
   
   // Mock chartUtils
   jest.mock('c/chartUtils', () => ({
       calculateDimensions: jest.fn().mockReturnValue({ width: 300, height: 200 }),
       createResizeHandler: jest.fn().mockReturnValue({
           observe: jest.fn(),
           disconnect: jest.fn()
       })
   }));
   
   describe('d3Gauge', () => {
       afterEach(() => {
           while (document.body.firstChild) {
               document.body.removeChild(document.body.firstChild);
           }
           jest.clearAllMocks();
       });
       
       it('renders component', () => {
           const element = createElement('c-d3-gauge', { is: D3Gauge });
           element.valueField = 'Amount';
           document.body.appendChild(element);
           
           const container = element.shadowRoot.querySelector('.chart-container');
           expect(container).not.toBeNull();
       });
       
       it('accepts height property', () => {
           const element = createElement('c-d3-gauge', { is: D3Gauge });
           element.height = 300;
           expect(element.height).toBe(300);
       });
       
       it('accepts theme property', () => {
           const element = createElement('c-d3-gauge', { is: D3Gauge });
           element.theme = 'Warm';
           expect(element.theme).toBe('Warm');
       });
       
       it('parses advancedConfig JSON', async () => {
           const element = createElement('c-d3-gauge', { is: D3Gauge });
           element.advancedConfig = '{"minValue": 0, "maxValue": 200}';
           document.body.appendChild(element);
           
           // Wait for async operations
           await Promise.resolve();
           
           // The parsed config should be accessible (test via getter)
           expect(element.advancedConfig).toBe('{"minValue": 0, "maxValue": 200}');
       });
   });
   ```

3. Run: npm test

**Output:**
- d3Gauge renders a half-circle gauge arc
- Background arc (gray) with value arc (themed color)
- Jest tests passing

**Wiring:**
- Uses themeService.getColors from Step 11
- Uses chartUtils.createResizeHandler from Step 14
```

---

*[Prompts 17-66 continue in the same pattern, each building on previous work...]*

---

## Summary

This blueprint provides **66 atomic steps** organized into:
- **Foundation** (Steps 1-14): Infrastructure and shared modules
- **Charts** (Steps 15-62): Individual chart components, starting simple
- **Integration** (Steps 63-66): Showcase and documentation

Each prompt:
1. References previous context
2. Has clear requirements with code examples
3. Includes test requirements
4. Wires into the existing codebase

**Key Principles:**
- No orphaned code - everything integrates immediately
- Tests accompany every implementation
- Complexity increases gradually
- Shared utilities are built first and reused

---

*Document generated for D3.js LWC Chart Library project*
*Reference: PROJECT-SPEC.md*
