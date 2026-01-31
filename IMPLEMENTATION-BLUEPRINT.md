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

### Prompt 17: Gauge Component - Value Display

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge renders basic arc
- Need to display the actual value in the center of the gauge

**Task:**
Add value text display to the gauge center.

**Requirements:**
1. Add to d3Gauge.js renderChart() after drawing arcs:
   - Add centered text group
   - Display currentValue with formatNumber
   - Display optional label from advancedConfig.label
   - Style with SLDS typography classes

2. Add to parsedConfig handling:
   - Support minValue, maxValue overrides
   - Support label property
   - Support valueFormat ('number', 'currency', 'percent')

3. Update Jest tests to verify:
   - Value text is rendered
   - formatNumber is called
   - Label displays when configured

**Reuses:** chartUtils.formatNumber, chartUtils.formatCurrency, chartUtils.formatPercent

**Wiring:** Extends Step 16 gauge rendering
```

---

### Prompt 18: Gauge Component - Theme Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge displays value in arc
- Need full theme integration with gradient support

**Task:**
Integrate theme colors and optional gradients.

**Requirements:**
1. Update renderChart():
   - Use themeService.getColors for arc fill
   - Support advancedConfig.useGradient boolean
   - If gradient, create linearGradient def with theme colors
   - Add subtle shadow/glow effect option

2. Add color zones support:
   - advancedConfig.zones: [{ min: 0, max: 50, color: 'red' }, ...]
   - If zones defined, override theme colors based on currentValue

3. Jest tests:
   - Theme colors applied correctly
   - Custom colors override theme
   - Zones work as expected

**Reuses:** themeService.getColors (Step 11)

**Wiring:** Extends Step 17
```

---

### Prompt 19: Gauge Component - Resize Handling

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge has theme integration
- Need responsive resizing

**Task:**
Implement responsive resize with compact mode.

**Requirements:**
1. Already have createResizeHandler wired - verify it triggers re-render
2. Implement compact mode:
   - If width < 200px: hide label, use smaller font
   - If width < 150px: hide value text, show only arc
3. Add minimum size warning if container too small
4. Ensure smooth transitions on resize (CSS transition on SVG)

5. Jest tests:
   - Resize callback triggers renderChart
   - Compact mode activates at threshold
   - cleanup on disconnectedCallback

**Reuses:** chartUtils.createResizeHandler, chartUtils.shouldUseCompactMode (Step 14)

**Wiring:** Extends Step 18
```

---

### Prompt 20: Gauge Component - App Builder XML Complete

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge has resize handling
- Need complete App Builder configuration

**Task:**
Finalize the meta XML for full App Builder support.

**Requirements:**
1. Update d3Gauge.js-meta.xml:
   - Add all property configurations with proper types
   - Add design attributes for Flow compatibility
   - Ensure recordCollection works in Flow context

2. Properties to expose:
   - soqlQuery (String)
   - valueField (String, required)
   - height (Integer, default 200)
   - theme (String, picklist)
   - minValue (Integer, default 0)
   - maxValue (Integer, default 100)
   - targetRecordId (String)
   - advancedConfig (String)

3. Test in App Builder (manual verification):
   - Component appears in component palette
   - All properties render in property panel
   - Default values work

**Wiring:** Extends Step 19
```

---

### Prompt 21: Gauge Component - SOQL Data Source

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge has App Builder config
- Need to load data from SOQL query

**Task:**
Implement data loading from SOQL via Apex controller.

**Requirements:**
1. Update d3Gauge.js:
   ```javascript
   import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';
   
   async loadData() {
       // Priority: recordCollection > soqlQuery
       if (this.recordCollection && this.recordCollection.length > 0) {
           this.processData(this.recordCollection);
           return;
       }
       
       if (this.soqlQuery) {
           try {
               const result = await executeQuery({ queryString: this.soqlQuery });
               this.processData(result);
           } catch (e) {
               this.error = 'Query failed: ' + e.body?.message || e.message;
           }
       }
   }
   
   processData(records) {
       if (!records || records.length === 0) {
           this.currentValue = 0;
           return;
       }
       // For gauge, use first record's valueField
       const record = records[0];
       this.currentValue = Number(record[this.valueField]) || 0;
   }
   ```

2. Jest tests:
   - Mock executeQuery Apex call
   - Test recordCollection takes priority
   - Test SOQL query fallback
   - Test error handling

**Reuses:** D3ChartController.executeQuery (Step 06)

**Wiring:** Extends Step 20 - now gauge loads real data
```

---

### Prompt 22: Gauge Component - Navigation Click

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge loads data from SOQL
- Need click-to-navigate functionality

**Task:**
Implement navigation on gauge click.

**Requirements:**
1. Import NavigationMixin:
   ```javascript
   import { NavigationMixin } from 'lightning/navigation';
   
   export default class D3Gauge extends NavigationMixin(LightningElement) {
   ```

2. Add click handler to arc:
   ```javascript
   g.append('path')
       .attr('d', arcValue)
       .attr('fill', colors[0])
       .style('cursor', this.targetRecordId ? 'pointer' : 'default')
       .on('click', () => this.handleClick());
   
   handleClick() {
       if (!this.targetRecordId) return;
       
       this[NavigationMixin.Navigate]({
           type: 'standard__recordPage',
           attributes: {
               recordId: this.targetRecordId,
               actionName: 'view'
           }
       });
   }
   ```

3. Jest tests:
   - Click handler fires
   - Navigation called with correct recordId
   - No navigation if targetRecordId empty

**Wiring:** Completes gauge navigation per spec
```

---

### Prompt 23: Gauge Component - Complete Tests

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge has all functionality
- Need comprehensive test coverage

**Task:**
Complete Jest test suite for d3Gauge.

**Requirements:**
1. Test coverage targets:
   - All @api properties
   - Data loading (collection vs SOQL)
   - Rendering lifecycle
   - Theme application
   - Resize behavior
   - Click navigation
   - Error states
   - advancedConfig parsing

2. Add edge case tests:
   - Null/undefined values
   - Invalid SOQL
   - Missing valueField
   - Extreme values (negative, very large)

3. Run: npm test -- --coverage

**Output:**
- >90% code coverage for d3Gauge
- All tests passing

**Wiring:** Gauge component complete - ready for next chart
```

---

### Prompt 24: Bar Chart - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Gauge complete with full test coverage
- Now building d3-bar-chart (first aggregation chart)

**Task:**
Create d3BarChart skeleton following gauge pattern.

**Requirements:**
1. Create force-app/main/default/lwc/d3BarChart/ with:
   - d3BarChart.html (same structure as gauge)
   - d3BarChart.js (skeleton with @api properties)
   - d3BarChart.css (same as gauge)
   - d3BarChart.js-meta.xml (bar-specific properties)

2. Bar-specific @api properties:
   - recordCollection, soqlQuery (same as gauge)
   - groupByField (String, required) - category axis
   - valueField (String, required) - value axis
   - operation (String: Sum/Count/Average)
   - height (Integer, default 300)
   - theme (String)
   - advancedConfig (String)

3. Skeleton should:
   - Load D3
   - Show loading state
   - Call loadData() and renderChart() stubs

**Reuses:** Same structure as d3Gauge (Step 15)

**Wiring:** Foundation for bar chart
```

---

### Prompt 25: Bar Chart - Aggregation Wiring

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart skeleton created
- Need to wire in dataService aggregation

**Task:**
Implement data loading with aggregation.

**Requirements:**
1. Update d3BarChart.js loadData():
   ```javascript
   import { prepareData, aggregateData, OPERATIONS } from 'c/dataService';
   import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';
   
   async loadData() {
       let rawData = [];
       
       if (this.recordCollection?.length > 0) {
           rawData = this.recordCollection;
       } else if (this.soqlQuery) {
           rawData = await executeQuery({ queryString: this.soqlQuery });
       }
       
       // Validate and truncate
       const prepared = prepareData(rawData, {
           requiredFields: [this.groupByField, this.valueField],
           limit: 2000
       });
       
       if (!prepared.valid) {
           this.error = prepared.error;
           return;
       }
       
       if (prepared.truncated) {
           this.showTruncationWarning(prepared.originalCount);
       }
       
       // Aggregate
       this.chartData = aggregateData(
           prepared.data,
           this.groupByField,
           this.valueField,
           this.operation || OPERATIONS.SUM
       );
   }
   ```

2. Add truncation warning toast:
   ```javascript
   import { ShowToastEvent } from 'lightning/platformShowToastEvent';
   
   showTruncationWarning(originalCount) {
       this.dispatchEvent(new ShowToastEvent({
           title: 'Data Truncated',
           message: `Displaying first 2,000 of ${originalCount} records`,
           variant: 'warning'
       }));
   }
   ```

3. Jest tests:
   - Aggregation called with correct params
   - Truncation warning fires when needed
   - Validation errors set this.error

**Reuses:** dataService (Steps 7-9), D3ChartController (Step 6)

**Wiring:** Bar chart now processes real data
```

---

### Prompt 26: Bar Chart - Basic Render

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart has aggregated data in this.chartData
- Need to render bars

**Task:**
Implement basic bar rendering with D3.

**Requirements:**
1. Update renderChart():
   ```javascript
   renderChart() {
       if (!this.chartData?.length || !this.d3) return;
       
       const d3 = this.d3;
       const container = this.refs.container;
       const svg = this.refs.svg;
       
       const { width, height, margins } = calculateDimensions(
           container.clientWidth,
           this.height,
           { top: 20, right: 20, bottom: 50, left: 60 }
       );
       
       d3.select(svg).selectAll('*').remove();
       
       const svgEl = d3.select(svg)
           .attr('width', width + margins.left + margins.right)
           .attr('height', height + margins.top + margins.bottom);
       
       const g = svgEl.append('g')
           .attr('transform', `translate(${margins.left},${margins.top})`);
       
       // Scales
       const x = d3.scaleBand()
           .domain(this.chartData.map(d => d.label))
           .range([0, width])
           .padding(0.2);
       
       const y = d3.scaleLinear()
           .domain([0, d3.max(this.chartData, d => d.value)])
           .nice()
           .range([height, 0]);
       
       // Colors
       const colors = getColors(this.theme, this.chartData.length);
       
       // Bars
       g.selectAll('.bar')
           .data(this.chartData)
           .join('rect')
           .attr('class', 'bar')
           .attr('x', d => x(d.label))
           .attr('y', d => y(d.value))
           .attr('width', x.bandwidth())
           .attr('height', d => height - y(d.value))
           .attr('fill', (d, i) => colors[i]);
   }
   ```

2. Jest tests:
   - SVG elements created
   - Correct number of bars
   - Bars have proper dimensions

**Reuses:** chartUtils.calculateDimensions (Step 14), themeService.getColors (Step 11)

**Wiring:** Bar chart renders visual bars
```

---

### Prompt 27: Bar Chart - Axes and Grid

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart renders bars
- Need axes and optional grid lines

**Task:**
Add X and Y axes with optional grid.

**Requirements:**
1. Add to renderChart() after bars:
   ```javascript
   // X Axis
   g.append('g')
       .attr('class', 'x-axis')
       .attr('transform', `translate(0,${height})`)
       .call(d3.axisBottom(x))
       .selectAll('text')
       .attr('transform', 'rotate(-45)')
       .style('text-anchor', 'end')
       .each(function(d) {
           const text = d3.select(this);
           text.text(truncateLabel(text.text(), 15));
       });
   
   // Y Axis
   g.append('g')
       .attr('class', 'y-axis')
       .call(d3.axisLeft(y).tickFormat(d => formatNumber(d, 0)));
   
   // Grid (if enabled)
   if (this.parsedConfig.showGrid) {
       g.append('g')
           .attr('class', 'grid')
           .call(d3.axisLeft(y)
               .tickSize(-width)
               .tickFormat('')
           )
           .style('stroke-opacity', 0.1);
   }
   ```

2. Add CSS for axis styling (SLDS-like):
   ```css
   .x-axis text, .y-axis text {
       font-size: 12px;
       fill: #706e6b;
   }
   .grid line {
       stroke: #e5e5e5;
   }
   ```

3. Jest tests:
   - Axes render
   - Grid conditional on config
   - Labels truncated

**Reuses:** chartUtils.truncateLabel, chartUtils.formatNumber (Step 12)

**Wiring:** Bar chart has proper axes
```

---

### Prompt 28: Bar Chart - Theme Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart has axes
- Need full theme and tooltip integration

**Task:**
Add theme colors and hover tooltips.

**Requirements:**
1. Add tooltip on hover:
   ```javascript
   // In connectedCallback after D3 loads:
   this.tooltip = createTooltip(this.refs.container);
   
   // In renderChart, update bars:
   g.selectAll('.bar')
       .on('mouseover', (event, d) => {
           const content = buildTooltipContent(d.label, d.value, {
               formatter: formatNumber
           });
           const [x, y] = d3.pointer(event, svg);
           this.tooltip.show(content, x, y);
       })
       .on('mouseout', () => this.tooltip.hide());
   
   // In disconnectedCallback:
   if (this.tooltip) this.tooltip.destroy();
   ```

2. Support customColors from advancedConfig
3. Add hover highlight effect (opacity change)

4. Jest tests:
   - Tooltip shows on hover
   - Custom colors applied
   - Hover effect works

**Reuses:** chartUtils.createTooltip, chartUtils.buildTooltipContent (Step 13)

**Wiring:** Bar chart has interactive tooltips
```

---

### Prompt 29: Bar Chart - Resize Handling

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart has tooltips
- Need responsive resize

**Task:**
Implement responsive behavior.

**Requirements:**
1. Wire createResizeHandler (same pattern as gauge)
2. Compact mode adjustments:
   - width < 400: rotate labels 90°, fewer ticks
   - width < 250: hide axis labels, show only bars
3. Smooth re-render on resize
4. Cleanup on disconnect

**Reuses:** chartUtils.createResizeHandler, shouldUseCompactMode (Step 14)

**Wiring:** Same pattern as gauge Step 19
```

---

### Prompt 30: Bar Chart - App Builder XML

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart has resize handling
- Need complete App Builder config

**Task:**
Finalize meta XML for bar chart.

**Requirements:**
1. Properties:
   - soqlQuery, recordCollection
   - groupByField (required)
   - valueField (required)
   - operation (picklist: Sum, Count, Average)
   - height
   - theme
   - advancedConfig

2. Flow support with proper role attributes
3. All targets enabled

**Wiring:** Same pattern as gauge Step 20
```

---

### Prompt 31: Bar Chart - SOQL Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart has App Builder config
- Need complete SOQL integration

**Task:**
Verify SOQL data loading works end-to-end.

**Requirements:**
1. Already implemented in Step 25 - verify:
   - executeQuery import works
   - Error handling shows in UI
   - Data flows through aggregation

2. Add test with sample SOQL:
   ```
   SELECT StageName, Amount FROM Opportunity WHERE Amount > 0
   ```

3. Jest tests for error scenarios

**Reuses:** D3ChartController.executeQuery (Step 6)

**Wiring:** Bar chart loads real Salesforce data
```

---

### Prompt 32: Bar Chart - Drill-Down Click

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart loads SOQL data
- Need drill-down click interaction

**Task:**
Implement click-to-filter drill-down.

**Requirements:**
1. Add click handler to bars:
   ```javascript
   .on('click', (event, d) => {
       this.dispatchEvent(new CustomEvent('bardrill', {
           detail: {
               label: d.label,
               value: d.value,
               field: this.groupByField
           },
           bubbles: true,
           composed: true
       }));
   });
   ```

2. For App Builder, add optional filterField property that:
   - Updates a parent filter component
   - Or navigates to filtered list view

3. Style: cursor pointer on bars

4. Jest tests:
   - Custom event fired on click
   - Event detail contains correct data

**Wiring:** Bar chart has drill-down per spec
```

---

### Prompt 33: Bar Chart - advancedConfig JSON

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart has drill-down
- Need full advancedConfig support

**Task:**
Support all advanced configuration options.

**Requirements:**
1. Supported advancedConfig properties:
   ```javascript
   {
       "showGrid": true,
       "legendPosition": "bottom", // top, bottom, none
       "customColors": ["#FF0000", "#00FF00"],
       "barRadius": 4, // rounded corners
       "sortOrder": "desc", // asc, desc, none
       "maxBars": 10 // limit visible bars
   }
   ```

2. Implement each option in renderChart()
3. Add legend rendering if position != none

4. Jest tests for each option

**Wiring:** Bar chart fully configurable
```

---

### Prompt 34: Bar Chart - Complete Tests

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart has all features
- Need comprehensive test coverage

**Task:**
Complete test suite for d3BarChart.

**Requirements:**
1. Test all scenarios:
   - Data loading (collection, SOQL, empty)
   - Aggregation (Sum, Count, Average)
   - Rendering (bars, axes, grid, legend)
   - Interactions (hover, click)
   - Resize behavior
   - advancedConfig options
   - Error handling

2. Target >90% coverage

**Output:** Bar chart complete with full tests

**Wiring:** Ready for donut chart
```

---

### Prompt 35: Donut Chart - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3BarChart complete
- Now building d3-donut-chart

**Task:**
Create d3DonutChart skeleton.

**Requirements:**
1. Same folder structure as bar chart
2. Same @api properties (groupByField, valueField, operation)
3. Additional donut-specific properties:
   - innerRadiusRatio (Number, default 0.6)
   - showLabels (Boolean)

**Reuses:** Pattern from Steps 15, 24

**Wiring:** Foundation for donut
```

---

### Prompt 36: Donut Chart - Pie Generator

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3DonutChart skeleton
- Need pie/arc rendering

**Task:**
Implement D3 pie generator for donut.

**Requirements:**
1. Use d3.pie() to generate arc data:
   ```javascript
   const pie = d3.pie()
       .value(d => d.value)
       .sort(null);
   
   const arc = d3.arc()
       .innerRadius(radius * this.innerRadiusRatio)
       .outerRadius(radius);
   
   const arcs = pie(this.chartData);
   ```

2. Render arcs with theme colors
3. Add center text showing total

**Reuses:** themeService.getColors

**Wiring:** Donut renders circular chart
```

---

### Prompt 37: Donut Chart - Slice Interactions

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3DonutChart renders arcs
- Need slice interactions

**Task:**
Add hover and click interactions.

**Requirements:**
1. Hover: 
   - Expand slice slightly (scale transform)
   - Show tooltip with label/value/percentage

2. Click:
   - Dispatch 'slicedrill' custom event
   - Optional: "explode" slice outward

3. Calculate percentages for tooltip

**Reuses:** chartUtils.createTooltip, formatPercent

**Wiring:** Donut has slice interactions
```

---

### Prompt 38: Donut Chart - Legend

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3DonutChart has slice interactions
- Need legend display

**Task:**
Implement legend component.

**Requirements:**
1. Legend positions: top, bottom, right, none
2. Legend items show:
   - Color swatch
   - Label (truncated)
   - Value or percentage

3. Click legend item to toggle slice visibility
4. Responsive: hide legend in compact mode

**Wiring:** Donut has complete legend
```

---

### Prompt 39: Donut Chart - Full Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3DonutChart has legend
- Need complete integration

**Task:**
Complete donut chart with all features.

**Requirements:**
1. Wire up:
   - Data loading (same as bar)
   - App Builder XML
   - Resize handling
   - advancedConfig support

2. Full test suite
3. Verify in App Builder

**Reuses:** All shared modules

**Wiring:** Donut chart complete
```

---

### Prompt 40: Line Chart - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3DonutChart complete
- Now building d3-line-chart for time series

**Task:**
Create d3LineChart skeleton.

**Requirements:**
1. Line-specific @api properties:
   - dateField (String) - X axis
   - valueField (String) - Y axis
   - seriesField (String, optional) - for multiple lines
   - dateFormat (String) - parsing format

2. No aggregation needed for line chart (raw data)

**Wiring:** Foundation for line chart
```

---

### Prompt 41: Line Chart - Time Scale

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3LineChart skeleton
- Need time scale handling

**Task:**
Implement D3 time scale for X axis.

**Requirements:**
1. Parse dates from dateField:
   ```javascript
   const parseDate = d3.timeParse(this.dateFormat || '%Y-%m-%d');
   this.chartData = rawData.map(d => ({
       date: parseDate(d[this.dateField]),
       value: +d[this.valueField],
       series: d[this.seriesField] || 'default'
   })).filter(d => d.date);
   ```

2. Create time scale:
   ```javascript
   const x = d3.scaleTime()
       .domain(d3.extent(this.chartData, d => d.date))
       .range([0, width]);
   ```

3. Format axis ticks appropriately

**Wiring:** Line chart handles dates
```

---

### Prompt 42: Line Chart - Path Render

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3LineChart has time scale
- Need line path rendering

**Task:**
Render line path with D3.

**Requirements:**
1. Create line generator:
   ```javascript
   const line = d3.line()
       .x(d => x(d.date))
       .y(d => y(d.value))
       .curve(d3.curveMonotoneX);
   ```

2. Draw path
3. Add optional area fill
4. Add data points (circles) at each value

**Wiring:** Line chart renders path
```

---

### Prompt 43: Line Chart - Multi-Series

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3LineChart renders single line
- Need multi-series support

**Task:**
Support multiple lines by series field.

**Requirements:**
1. Group data by seriesField
2. Render one line per series with different colors
3. Add legend for series
4. Handle series toggle (click legend to hide/show)

**Reuses:** themeService.getColors

**Wiring:** Line chart supports multiple series
```

---

### Prompt 44: Line Chart - Full Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3LineChart has multi-series
- Need complete integration

**Task:**
Complete line chart with all features.

**Requirements:**
1. Wire up: tooltips, resize, App Builder XML, advancedConfig
2. Drill-down: click point to highlight/filter
3. Full test suite

**Reuses:** All shared modules

**Wiring:** Line chart complete
```

---

### Prompt 45: Histogram - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3LineChart complete
- Now building d3-histogram for distributions

**Task:**
Create d3Histogram skeleton.

**Requirements:**
1. Histogram-specific @api properties:
   - valueField (String) - numeric field to bin
   - binCount (Integer, default 10)
   - binThresholds (String, JSON array of custom thresholds)

2. No groupByField - histogram auto-bins numeric data

**Wiring:** Foundation for histogram
```

---

### Prompt 46: Histogram - Bin Generator

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Histogram skeleton
- Need binning logic

**Task:**
Implement D3 histogram binning.

**Requirements:**
1. Create histogram generator:
   ```javascript
   const values = rawData.map(d => +d[this.valueField]).filter(v => !isNaN(v));
   
   const histogram = d3.histogram()
       .domain(d3.extent(values))
       .thresholds(this.binCount);
   
   this.chartData = histogram(values).map(bin => ({
       x0: bin.x0,
       x1: bin.x1,
       count: bin.length
   }));
   ```

2. Support custom thresholds from binThresholds
3. Render as bar chart (bins on X, count on Y)

**Wiring:** Histogram bins data correctly
```

---

### Prompt 47: Histogram - Full Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Histogram has binning
- Need complete integration

**Task:**
Complete histogram with all features.

**Requirements:**
1. Render bins as bars
2. Tooltips showing range and count
3. Click bin to navigate to filtered list
4. Full test suite

**Reuses:** Bar chart rendering pattern

**Wiring:** Histogram complete
```

---

### Prompt 48: Scatter Plot - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Histogram complete
- Now building d3-scatter-plot

**Task:**
Create d3ScatterPlot skeleton.

**Requirements:**
1. Scatter-specific @api properties:
   - xField (String) - X axis numeric field
   - yField (String) - Y axis numeric field
   - sizeField (String, optional) - bubble size
   - colorField (String, optional) - color by category
   - recordIdField (String, default 'Id') - for navigation

**Wiring:** Foundation for scatter plot
```

---

### Prompt 49: Scatter Plot - Dual Axis

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3ScatterPlot skeleton
- Need dual axis rendering

**Task:**
Implement X and Y axes for correlation display.

**Requirements:**
1. Both axes numeric (linear scale)
2. Support log scale option
3. Render dots at (x, y) coordinates
4. Size by sizeField if provided
5. Color by colorField if provided

**Wiring:** Scatter renders correlation view
```

---

### Prompt 50: Scatter Plot - Full Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3ScatterPlot has dual axis
- Need complete integration

**Task:**
Complete scatter plot with all features.

**Requirements:**
1. Click dot: navigate to record
2. Hover: tooltip with all field values
3. Performance limit: 2000 points max
4. Full test suite

**Wiring:** Scatter plot complete
```

---

### Prompt 51: Treemap - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3ScatterPlot complete
- Now building d3-treemap for hierarchies

**Task:**
Create d3Treemap skeleton.

**Requirements:**
1. Treemap-specific @api properties:
   - hierarchyFields (String) - comma-separated field names for levels
   - valueField (String) - size of rectangles
   - Example: hierarchyFields="Industry,StageName" creates nested view

**Wiring:** Foundation for treemap
```

---

### Prompt 52: Treemap - Hierarchy Generation

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Treemap skeleton
- Need hierarchy data structure

**Task:**
Convert flat data to D3 hierarchy.

**Requirements:**
1. Build nested structure from hierarchyFields:
   ```javascript
   const root = d3.hierarchy(nestedData)
       .sum(d => d.value)
       .sort((a, b) => b.value - a.value);
   
   d3.treemap()
       .size([width, height])
       .padding(2)
       (root);
   ```

2. Render rectangles with labels
3. Color by top-level category

**Wiring:** Treemap renders nested rectangles
```

---

### Prompt 53: Treemap - Full Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Treemap has hierarchy
- Need complete integration

**Task:**
Complete treemap with all features.

**Requirements:**
1. Click: zoom into sub-category (drill-down)
2. Breadcrumb navigation to zoom out
3. Tooltips with full hierarchy path
4. Full test suite

**Wiring:** Treemap complete
```

---

### Prompt 54: Sankey - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Treemap complete
- Now building d3-sankey for flow visualization

**Task:**
Create d3Sankey skeleton.

**Requirements:**
1. Sankey-specific @api properties:
   - sourceField (String) - source node field
   - targetField (String) - target node field
   - valueField (String) - flow value/weight

**Note:** Sankey requires d3-sankey plugin - add as separate static resource

**Wiring:** Foundation for sankey
```

---

### Prompt 55: Sankey - Links and Nodes

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Sankey skeleton
- Need sankey layout

**Task:**
Implement sankey diagram rendering.

**Requirements:**
1. Transform data to nodes/links format:
   ```javascript
   // Unique nodes
   const nodes = [...new Set([
       ...data.map(d => d[this.sourceField]),
       ...data.map(d => d[this.targetField])
   ])].map(name => ({ name }));
   
   // Links with values
   const links = data.map(d => ({
       source: d[this.sourceField],
       target: d[this.targetField],
       value: d[this.valueField]
   }));
   ```

2. Use d3-sankey layout
3. Render nodes as rectangles, links as paths

**Wiring:** Sankey renders flow diagram
```

---

### Prompt 56: Sankey - Full Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Sankey has layout
- Need complete integration

**Task:**
Complete sankey with all features.

**Requirements:**
1. Click link: navigate to junction records
2. Hover: highlight connected paths
3. Full test suite

**Wiring:** Sankey complete
```

---

### Prompt 57: Force Graph - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Sankey complete
- Now building d3-force-graph (most complex)

**Task:**
Create d3ForceGraph skeleton.

**Requirements:**
1. Force-specific @api properties:
   - nodeIdField (String)
   - nodeLabelField (String)
   - sourceField (String) - for relationships
   - targetField (String)
   - nodeTypeField (String, optional) - for coloring

**Performance:** Lower default limit (500 nodes)

**Wiring:** Foundation for force graph
```

---

### Prompt 58: Force Graph - Simulation

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3ForceGraph skeleton
- Need force simulation

**Task:**
Implement D3 force simulation.

**Requirements:**
1. Create simulation:
   ```javascript
   this.simulation = d3.forceSimulation(nodes)
       .force('link', d3.forceLink(links).id(d => d.id))
       .force('charge', d3.forceManyBody().strength(-100))
       .force('center', d3.forceCenter(width/2, height/2))
       .on('tick', () => this.updatePositions());
   ```

2. Render nodes as circles, links as lines
3. Enable drag behavior
4. Stop simulation on disconnect

**Wiring:** Force graph simulates
```

---

### Prompt 59: Force Graph - Full Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3ForceGraph has simulation
- Need complete integration

**Task:**
Complete force graph with all features.

**Requirements:**
1. Click node: navigate to record
2. Hover: highlight connected nodes
3. Zoom/pan support
4. Performance tuning (use DevTools profiler)
5. Full test suite

**Wiring:** Force graph complete
```

---

### Prompt 60: Choropleth - Component Skeleton

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3ForceGraph complete
- Now building d3-choropleth (geo)

**Task:**
Create d3Choropleth skeleton.

**Requirements:**
1. Choropleth-specific @api properties:
   - regionField (String) - matches TopoJSON region IDs
   - valueField (String) - color intensity
   - geoType (String) - 'us-states', 'world', 'custom'

**Note:** Need TopoJSON static resources for map data

**Wiring:** Foundation for choropleth
```

---

### Prompt 61: Choropleth - TopoJSON Rendering

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Choropleth skeleton
- Need geo rendering

**Task:**
Implement map rendering with TopoJSON.

**Requirements:**
1. Add TopoJSON static resources:
   - us-states.json (US state boundaries)
   - world.json (country boundaries)

2. Load and render:
   ```javascript
   import { loadScript } from 'lightning/platformResourceLoader';
   import TOPOJSON from '@salesforce/resourceUrl/topojson';
   import US_STATES from '@salesforce/resourceUrl/usStates';
   
   // Use d3.geoPath() with appropriate projection
   const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
   const path = d3.geoPath().projection(projection);
   ```

3. Color regions by value using color scale

**Wiring:** Choropleth renders map
```

---

### Prompt 62: Choropleth - Full Integration

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: d3Choropleth renders map
- Need complete integration

**Task:**
Complete choropleth with all features.

**Requirements:**
1. Click region: zoom to sub-regions or filter
2. Hover: tooltip with region name and value
3. Color legend
4. Full test suite

**Wiring:** Choropleth complete - all 10 charts done!
```

---

### Prompt 63: Showcase FlexiPage

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: All 10 chart components complete
- Need showcase page

**Task:**
Create FlexiPage with all charts.

**Requirements:**
1. Create: force-app/main/default/flexipages/D3_Chart_Showcase.flexipage-meta.xml
2. Layout: 2-column grid
3. Include one instance of each chart:
   - d3Gauge (with sample value)
   - d3BarChart (Opportunity by Stage)
   - d3DonutChart (Account by Industry)
   - d3LineChart (Opportunity by CloseDate)
   - d3Histogram (Opportunity Amount distribution)
   - d3ScatterPlot (Amount vs Probability)
   - d3Treemap (Account hierarchy)
   - d3Sankey (Lead to Opportunity flow)
   - d3ForceGraph (Contact relationships)
   - d3Choropleth (Account by BillingState)

4. Each chart pre-configured with sample SOQL

**Wiring:** Showcase demonstrates all components
```

---

### Prompt 64: Showcase Sample Data

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: Showcase FlexiPage created
- Need sample data for demo

**Task:**
Create sample data and queries for showcase.

**Requirements:**
1. Create Apex data factory for sample records (optional)
2. Or use standard objects with common queries:
   ```
   Gauge: SELECT COUNT() FROM Lead WHERE Status = 'Open'
   Bar: SELECT StageName, SUM(Amount) FROM Opportunity GROUP BY StageName
   Donut: SELECT Industry, COUNT(Id) FROM Account GROUP BY Industry
   etc.
   ```

3. Document sample queries in README

**Wiring:** Showcase has working demo data
```

---

### Prompt 65: Final Integration Tests

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: Showcase with sample data
- Need final verification

**Task:**
Run full integration test suite.

**Requirements:**
1. All Jest tests pass: npm test
2. All Apex tests pass: sf apex run test
3. Deploy to scratch org: sf project deploy start
4. Manual verification in App Builder
5. Performance check with Chrome DevTools

**Output:** All tests green, deployment successful

**Wiring:** Project ready for release
```

---

### Prompt 66: Documentation

```text
You are continuing the D3.js LWC chart library project.

**Context:**
- Previous: All tests pass, deployment works
- Need user documentation

**Task:**
Create comprehensive README and docs.

**Requirements:**
1. Update README.md:
   - Project overview
   - Installation instructions
   - Component reference (all 10 charts)
   - Configuration options
   - advancedConfig JSON reference
   - Examples for each chart

2. Create CHANGELOG.md
3. Create CONTRIBUTING.md (if open source)

4. Add JSDoc comments to all JS files
5. Add ApexDoc comments to Apex classes

**Output:** Complete documentation

**Wiring:** Project complete!
```

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
