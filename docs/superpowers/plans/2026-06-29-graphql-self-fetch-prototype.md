# GraphQL Self-Fetch Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prototype self-fetching d3-lwc charts via Salesforce's v2 `lightning/graphql` wire adapter — additively on `d3BarChart` (Approach A) and as a full replacement on `d3GanttChart` (Approach B) — so we can choose a library-wide strategy from measured cost.

**Architecture:** A new pure-function `graphqlService` LWC builds dynamic GraphQL query strings and normalizes wire results into the exact shapes the charts already render (`[{label,value}]` for bar, `[{label,start,end}]` for gantt). Each chart owns a reactive `@wire(graphql,…)`; the service owns query construction + normalization and is unit-tested in isolation.

**Tech Stack:** Salesforce LWC (API 65.0), `lightning/graphql` v2 wire adapter, D3 v7, `sfdx-lwc-jest` / Jest, `@salesforce/wire-service-jest-util`.

## Global Constraints

- API version **65.0** (required for v2 `lightning/graphql` dynamic query construction). Do not lower.
- Module is **`lightning/graphql`** (v2), NOT `lightning/uiGraphQLApi` (v1).
- Dynamic queries are built by **JS string interpolation inside the `gql` tagged template** (`gql\`${queryString}\``).
- v2 result shape: records at `data.uiapi.query.{Object}.edges[].node.{Field}.value`.
- Output shapes are fixed by existing chart code: bar → `[{label:string, value:number}]`; gantt → `[{label, start, end}]` with ISO date strings.
- TDD: failing test first, minimal code, green, commit. Test output must be pristine.
- All work on branch `graphql-self-fetch-prototype` (already created). Do NOT touch the other 28 charts, do NOT modify/delete `D3ChartController.cls`, do NOT sync to `agentforce-dev`.
- Existing `d3BarChart` tests MUST stay green (Approach A is additive). `d3GanttChart` Apex-path tests ARE replaced (Approach B).
- Run a single chart's tests with: `npx sfdx-lwc-jest -- --testPathPattern <name>` (note: `--testPathPattern` does not narrow reliably in this repo per project history — verify counts; full suite is `npm run test:unit`).

## File Structure

| File                                                                                  | Responsibility                                                                                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `__mocks__/lightning/graphql.js` (create)                                             | Jest test wire adapter for v2 `lightning/graphql` (emit/emitErrors), since pinned sfdx-lwc-jest ships only the v1 `uiGraphQLApi` stub. |
| `jest.config.js` (modify)                                                             | Map `^lightning/graphql$` to the new mock.                                                                                             |
| `force-app/main/default/lwc/graphqlService/graphqlService.js` (create)                | Pure functions: `buildWhere`, `buildRecordQuery`, `normalizeRecords`, `buildAggregateQuery`, `normalizeAggregate`, `AGG_FN`.           |
| `force-app/main/default/lwc/graphqlService/graphqlService.js-meta.xml` (create)       | LWC metadata (isExposed false).                                                                                                        |
| `force-app/main/default/lwc/graphqlService/__tests__/graphqlService.test.js` (create) | Unit tests for all service functions.                                                                                                  |
| `force-app/main/default/lwc/d3BarChart/d3BarChart.js` (modify)                        | Add `dataSource` prop, `gqlQuery` getter, `@wire` aggregate handler, `loadData` early-return.                                          |
| `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.graphql.test.js` (create) | New GraphQL-path tests (additive).                                                                                                     |
| `force-app/main/default/lwc/d3GanttChart/d3GanttChart.js` (modify)                    | Remove Apex imports; GraphQL becomes the only server path.                                                                             |
| `force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.test.js` (modify)     | Replace Apex-path tests with GraphQL-path tests.                                                                                       |
| `docs/graphql-prototype-comparison.md` (create)                                       | A-vs-B cost memo + rollout recommendation.                                                                                             |

---

## Task 1: GraphQL v2 test harness

**Files:**

- Create: `__mocks__/lightning/graphql.js`
- Modify: `jest.config.js` (moduleNameMapper block, after the existing `lightning/*` entries)
- Test: `__mocks__/lightning/__tests__/graphqlStub.test.js` (create — smoke test the stub)

**Interfaces:**

- Produces: a `lightning/graphql` mock exporting `graphql` (a test wire adapter class with static `emit(value)` / `emitErrors(errors)`), `gql` (a `jest.fn` that reconstructs the interpolated string), and `refreshGraphQL` (`jest.fn`). The `emit(value)` envelope is `{ data: value, errors: undefined }`; `emitErrors(errors)` is `{ data: undefined, errors }`.

- [ ] **Step 1: Write the stub** (mirror the shipped v1 `uiGraphQLApi` stub at `node_modules/@salesforce/sfdx-lwc-jest/src/lightning-stubs/uiGraphQLApi/uiGraphQLApi.js`)

```javascript
// ABOUTME: Jest test wire adapter for the v2 lightning/graphql module.
// ABOUTME: Pinned sfdx-lwc-jest ships only the v1 uiGraphQLApi stub, so this supplies v2.
import { createTestWireAdapter } from "@salesforce/wire-service-jest-util";

export class graphql extends createTestWireAdapter() {
  static emit(value, filterFn) {
    super.emit({ data: value, errors: undefined }, filterFn);
  }

  static emitErrors(errors, filterFn) {
    super.emit({ data: undefined, errors }, filterFn);
  }

  constructor(dataCallback) {
    super(dataCallback);
    graphql.emit(undefined);
  }
}

// gql is a tagged-template function; reconstruct the interpolated query string so
// tests can assert on it if needed.
export const gql = jest.fn((strings, ...values) => {
  if (!Array.isArray(strings)) return strings;
  return strings.reduce(
    (acc, s, i) => acc + s + (i < values.length ? values[i] : ""),
    ""
  );
});

export const refreshGraphQL = jest.fn();
```

- [ ] **Step 2: Register the mock in `jest.config.js`**

Add this entry inside the existing `moduleNameMapper` object (alongside `lightning/navigation`):

```javascript
    "^lightning/graphql$": "<rootDir>/__mocks__/lightning/graphql.js",
```

- [ ] **Step 3: Write the failing smoke test**

```javascript
// ABOUTME: Verifies the lightning/graphql test stub resolves and emits.
import { gql } from "lightning/graphql";

describe("lightning/graphql stub", () => {
  it("reconstructs an interpolated gql query string", () => {
    const objectName = "Opportunity";
    const result = gql`query { uiapi { query { ${objectName} { x } } } }`;
    expect(result).toContain("Opportunity");
  });
});
```

- [ ] **Step 4: Run it (fails until mapping resolves)**

Run: `npx sfdx-lwc-jest -- --testPathPattern graphqlStub`
Expected before mapping: FAIL `Cannot find module 'lightning/graphql'`. After Steps 1–2: PASS.

- [ ] **Step 5: Commit**

```bash
git add __mocks__/lightning/graphql.js jest.config.js __mocks__/lightning/__tests__/graphqlStub.test.js
git commit -m "test(graphql): add v2 lightning/graphql jest wire-adapter stub"
```

---

## Task 2: graphqlService — record query + filter + normalizer

**Files:**

- Create: `force-app/main/default/lwc/graphqlService/graphqlService.js`
- Create: `force-app/main/default/lwc/graphqlService/graphqlService.js-meta.xml`
- Test: `force-app/main/default/lwc/graphqlService/__tests__/graphqlService.test.js`

**Interfaces:**

- Produces:
  - `buildWhere(filter) -> string` — `filter = {field, operator, value}`, `operator ∈ {eq,ne,gt,gte,lt,lte,like,in}`. Returns `""` for falsy filter, else `where: { <field>: { <op>: <value> } }`. Throws on unknown operator.
  - `buildRecordQuery({objectApiName, fields, filter, orderBy, first}) -> string` — full GraphQL query text. `fields` is a string array.
  - `normalizeRecords(data, {objectApiName, labelField, startField, endField}) -> [{label, start, end}]`.

- [ ] **Step 1: Write the meta file**

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <isExposed>false</isExposed>
</LightningComponentBundle>
```

- [ ] **Step 2: Write failing tests for `buildWhere` and `buildRecordQuery`**

```javascript
// ABOUTME: Unit tests for the graphqlService query builders and normalizers.
import {
  buildWhere,
  buildRecordQuery,
  normalizeRecords
} from "c/graphqlService";

describe("buildWhere", () => {
  it("returns empty string for no filter", () => {
    expect(buildWhere(null)).toBe("");
    expect(buildWhere({})).toBe("");
  });

  it("quotes string values", () => {
    expect(buildWhere({ field: "Stage", operator: "eq", value: "Won" })).toBe(
      'where: { Stage: { eq: "Won" } }'
    );
  });

  it("leaves numeric values unquoted", () => {
    expect(buildWhere({ field: "Amount", operator: "gt", value: 100 })).toBe(
      "where: { Amount: { gt: 100 } }"
    );
  });

  it("throws on an unsupported operator", () => {
    expect(() =>
      buildWhere({ field: "X", operator: "between", value: 1 })
    ).toThrow("Unsupported filter operator: between");
  });
});

describe("buildRecordQuery", () => {
  it("builds a record query with fields, filter, orderBy, and first", () => {
    const q = buildRecordQuery({
      objectApiName: "Project__c",
      fields: ["Name", "Project_Start__c", "Project_End__c"],
      filter: { field: "Status__c", operator: "eq", value: "Active" },
      orderBy: "Project_Start__c",
      first: 500
    });
    expect(q).toContain("Project__c(");
    expect(q).toContain('where: { Status__c: { eq: "Active" } }');
    expect(q).toContain("orderBy: { Project_Start__c: { order: ASC } }");
    expect(q).toContain("first: 500");
    expect(q).toContain("Name { value }");
    expect(q).toContain("edges { node {");
  });

  it("omits the argument list when no filter/orderBy/first given", () => {
    const q = buildRecordQuery({
      objectApiName: "Account",
      fields: ["Name"]
    });
    expect(q).toContain("Account { edges");
    expect(q).not.toContain("(");
  });

  it("throws when objectApiName or fields are missing", () => {
    expect(() => buildRecordQuery({ fields: ["Name"] })).toThrow(
      "objectApiName is required"
    );
    expect(() => buildRecordQuery({ objectApiName: "Account" })).toThrow(
      "fields are required"
    );
  });
});

describe("normalizeRecords", () => {
  it("maps edges to {label,start,end} using ISO string values", () => {
    const data = {
      uiapi: {
        query: {
          Project__c: {
            edges: [
              {
                node: {
                  Name: { value: "Apollo" },
                  Project_Start__c: { value: "2026-01-01" },
                  Project_End__c: { value: "2026-03-01" }
                }
              }
            ]
          }
        }
      }
    };
    expect(
      normalizeRecords(data, {
        objectApiName: "Project__c",
        labelField: "Name",
        startField: "Project_Start__c",
        endField: "Project_End__c"
      })
    ).toEqual([{ label: "Apollo", start: "2026-01-01", end: "2026-03-01" }]);
  });

  it("returns [] when the object node is absent", () => {
    expect(
      normalizeRecords(
        { uiapi: { query: {} } },
        {
          objectApiName: "Project__c",
          labelField: "Name",
          startField: "s",
          endField: "e"
        }
      )
    ).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx sfdx-lwc-jest -- --testPathPattern graphqlService`
Expected: FAIL `Cannot find module 'c/graphqlService'`.

- [ ] **Step 4: Implement `graphqlService.js` (record portion)**

```javascript
// ABOUTME: Builds dynamic Salesforce GraphQL (v2) query strings from chart config.
// ABOUTME: Pure functions only — no @wire, no DOM — so they unit-test in isolation.

const OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "like", "in"];

function formatValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(", ")}]`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // GraphQL string literal; escape embedded quotes.
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

/**
 * Builds a GraphQL `where:` fragment from a structured filter.
 * @param {{field:string, operator:string, value:*}|null} filter
 * @returns {string} `where: { Field: { op: value } }` or "".
 */
export function buildWhere(filter) {
  if (!filter || !filter.field || !filter.operator) return "";
  if (!OPERATORS.includes(filter.operator)) {
    throw new Error(`Unsupported filter operator: ${filter.operator}`);
  }
  return `where: { ${filter.field}: { ${filter.operator}: ${formatValue(filter.value)} } }`;
}

/**
 * Builds a raw-record GraphQL query string.
 * @param {{objectApiName:string, fields:string[], filter?:object, orderBy?:string, first?:number}} config
 * @returns {string}
 */
export function buildRecordQuery({
  objectApiName,
  fields,
  filter,
  orderBy,
  first
}) {
  if (!objectApiName) throw new Error("objectApiName is required");
  if (!fields || !fields.length) throw new Error("fields are required");

  const args = [];
  const where = buildWhere(filter);
  if (where) args.push(where);
  if (orderBy) args.push(`orderBy: { ${orderBy}: { order: ASC } }`);
  if (first) args.push(`first: ${first}`);
  const argStr = args.length ? `(${args.join(", ")})` : "";

  const fieldSel = fields.map((f) => `${f} { value }`).join(" ");
  return `query { uiapi { query { ${objectApiName}${argStr} { edges { node { ${fieldSel} } } } } } }`;
}

/**
 * Normalizes a record-query wire result into [{label,start,end}] for the gantt chart.
 * @param {object} data wire `data` ({uiapi:{query:{Object:{edges:[...]}}}})
 * @param {{objectApiName:string, labelField:string, startField:string, endField:string}} cfg
 * @returns {Array<{label:*, start:*, end:*}>}
 */
export function normalizeRecords(
  data,
  { objectApiName, labelField, startField, endField }
) {
  const edges = data?.uiapi?.query?.[objectApiName]?.edges ?? [];
  return edges.map((e) => ({
    label: e.node[labelField]?.value ?? null,
    start: e.node[startField]?.value ?? null,
    end: e.node[endField]?.value ?? null
  }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx sfdx-lwc-jest -- --testPathPattern graphqlService`
Expected: PASS (all `buildWhere`/`buildRecordQuery`/`normalizeRecords` tests green).

- [ ] **Step 6: Commit**

```bash
git add force-app/main/default/lwc/graphqlService
git commit -m "feat(graphqlService): add record query builder, filter, and normalizer"
```

---

## Task 3: graphqlService — aggregate query + normalizer

**Files:**

- Modify: `force-app/main/default/lwc/graphqlService/graphqlService.js`
- Test: `force-app/main/default/lwc/graphqlService/__tests__/graphqlService.test.js` (append)

**Interfaces:**

- Consumes: `buildWhere` (Task 2).
- Produces:
  - `AGG_FN` — map `{Sum:"sum", Average:"avg", Min:"min", Max:"max"}`.
  - `buildAggregateQuery({objectApiName, groupByField, valueField, operation, filter, first}) -> string`. Throws for an operation not in `AGG_FN` (e.g. `Count`) with a message directing to `dataSource="apex"`.
  - `normalizeAggregate(data, {objectApiName, groupByField, valueField, operation}) -> [{label, value}]`.

> **⚠ VERIFY-IN-SCRATCH-ORG (do this Step 0, before trusting the encoded shape):** The aggregate response envelope below (`node.aggregate.<field>.<fn>.value` and the `groupBy: { <field>: {} }` argument) is the best-known shape from the Salesforce GraphQL aggregate docs but could NOT be extracted verbatim. Before finalizing, run the encoded `buildAggregateQuery` output against a scratch org (GraphQL Composer or a throwaway LWC) on `Opportunity` grouped by `StageName` summing `Amount`, and confirm the exact nesting. The aggregate JSON path lives in exactly ONE place (`normalizeAggregate`) and the query fragment in ONE place (`buildAggregateQuery`) — adjust both if the live shape differs. **Pre-authorized fallback if aggregate is unworkable for the configured field:** switch the bar prototype (Task 4) to a raw-row GraphQL fetch via `buildRecordQuery` + the chart's existing `_aggregateRawData` client aggregation, and record the deviation in the comparison memo (Task 6). Do not get blocked here.

- [ ] **Step 1: Write failing tests for the aggregate functions**

```javascript
import {
  buildAggregateQuery,
  normalizeAggregate,
  AGG_FN
} from "c/graphqlService";

describe("buildAggregateQuery", () => {
  it("builds a groupBy + sum query", () => {
    const q = buildAggregateQuery({
      objectApiName: "Opportunity",
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Sum",
      first: 2000
    });
    expect(q).toContain("Opportunity(");
    expect(q).toContain("groupBy: { StageName: {} }");
    expect(q).toContain("first: 2000");
    expect(q).toContain("StageName { value }");
    expect(q).toContain("aggregate { Amount { sum { value } } }");
  });

  it("includes a where filter when provided", () => {
    const q = buildAggregateQuery({
      objectApiName: "Opportunity",
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Average",
      filter: { field: "IsClosed", operator: "eq", value: true }
    });
    expect(q).toContain("avg { value }");
    expect(q).toContain("where: { IsClosed: { eq: true } }");
  });

  it("throws for an unsupported operation (e.g. Count)", () => {
    expect(() =>
      buildAggregateQuery({
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Count"
      })
    ).toThrow(/Count/);
  });
});

describe("normalizeAggregate", () => {
  it("maps grouped aggregate edges to [{label,value}]", () => {
    const data = {
      uiapi: {
        query: {
          Opportunity: {
            edges: [
              {
                node: {
                  StageName: { value: "Prospecting" },
                  aggregate: { Amount: { sum: { value: 1000 } } }
                }
              },
              {
                node: {
                  StageName: { value: "Closed Won" },
                  aggregate: { Amount: { sum: { value: 5000 } } }
                }
              }
            ]
          }
        }
      }
    };
    expect(
      normalizeAggregate(data, {
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum"
      })
    ).toEqual([
      { label: "Prospecting", value: 1000 },
      { label: "Closed Won", value: 5000 }
    ]);
  });
});

describe("AGG_FN", () => {
  it("maps chart operations to GraphQL aggregate functions", () => {
    expect(AGG_FN).toEqual({
      Sum: "sum",
      Average: "avg",
      Min: "min",
      Max: "max"
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx sfdx-lwc-jest -- --testPathPattern graphqlService`
Expected: FAIL — `buildAggregateQuery`/`normalizeAggregate`/`AGG_FN` are not exported.

- [ ] **Step 3: Append the aggregate implementation to `graphqlService.js`**

```javascript
/** Chart aggregate operation -> GraphQL aggregate function. Count is intentionally
 * excluded in the prototype (see buildAggregateQuery). */
export const AGG_FN = { Sum: "sum", Average: "avg", Min: "min", Max: "max" };

/**
 * Builds a grouped-aggregate GraphQL query string.
 * @param {{objectApiName:string, groupByField:string, valueField:string,
 *          operation:string, filter?:object, first?:number}} config
 * @returns {string}
 */
export function buildAggregateQuery({
  objectApiName,
  groupByField,
  valueField,
  operation,
  filter,
  first = 2000
}) {
  if (!objectApiName || !groupByField || !valueField || !operation) {
    throw new Error(
      "objectApiName, groupByField, valueField, and operation are required"
    );
  }
  const fn = AGG_FN[operation];
  if (!fn) {
    throw new Error(
      `Aggregate operation not supported on the GraphQL path in this prototype: ${operation} (use dataSource="apex")`
    );
  }

  const args = [`groupBy: { ${groupByField}: {} }`];
  const where = buildWhere(filter);
  if (where) args.push(where);
  if (first) args.push(`first: ${first}`);

  return `query { uiapi { query { ${objectApiName}(${args.join(", ")}) { edges { node { ${groupByField} { value } aggregate { ${valueField} { ${fn} { value } } } } } } } } }`;
}

/**
 * Normalizes a grouped-aggregate wire result into [{label,value}] for the bar chart.
 * @param {object} data wire `data`
 * @param {{objectApiName:string, groupByField:string, valueField:string, operation:string}} cfg
 * @returns {Array<{label:*, value:*}>}
 */
export function normalizeAggregate(
  data,
  { objectApiName, groupByField, valueField, operation }
) {
  const fn = AGG_FN[operation];
  const edges = data?.uiapi?.query?.[objectApiName]?.edges ?? [];
  return edges.map((e) => ({
    label: e.node[groupByField]?.value ?? null,
    value: e.node.aggregate?.[valueField]?.[fn]?.value ?? null
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx sfdx-lwc-jest -- --testPathPattern graphqlService`
Expected: PASS (all service tests green).

- [ ] **Step 5: Commit**

```bash
git add force-app/main/default/lwc/graphqlService
git commit -m "feat(graphqlService): add groupBy aggregate query builder and normalizer"
```

---

## Task 4: Approach A — d3BarChart additive GraphQL path

**Files:**

- Modify: `force-app/main/default/lwc/d3BarChart/d3BarChart.js`
- Test: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.graphql.test.js` (create)

**Interfaces:**

- Consumes: `buildAggregateQuery`, `normalizeAggregate` (Task 3); `gql`, `graphql` (`lightning/graphql`).
- Produces: a new `@api dataSource` property (`"auto"`|`"apex"`|`"graphql"`, default `"auto"`) and `@api graphqlFilter` (structured `{field,operator,value}` object). When `dataSource==="graphql"`, the chart self-fetches; all other values preserve existing behavior.

- [ ] **Step 1: Write the failing GraphQL-path test**

```javascript
// ABOUTME: Tests the additive GraphQL self-fetch path on d3BarChart (Approach A).
import { createElement } from "lwc";
import D3BarChart from "c/d3BarChart";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Minimal chainable D3 stub: every call returns the same chainable object.
function makeD3Stub() {
  const chain = new Proxy(function () {}, {
    get: () => () => chain,
    apply: () => chain
  });
  return chain;
}

const AGG_RESPONSE = {
  uiapi: {
    query: {
      Opportunity: {
        edges: [
          {
            node: {
              StageName: { value: "Prospecting" },
              aggregate: { Amount: { sum: { value: 1000 } } }
            }
          },
          {
            node: {
              StageName: { value: "Closed Won" },
              aggregate: { Amount: { sum: { value: 5000 } } }
            }
          }
        ]
      }
    }
  }
};

async function flushPromises() {
  return Promise.resolve();
}

describe("d3BarChart GraphQL path (Approach A)", () => {
  beforeEach(() => {
    loadD3.mockResolvedValue(makeD3Stub());
  });

  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("renders the chart container when GraphQL aggregate data arrives", async () => {
    const element = createElement("c-d3-bar-chart", { is: D3BarChart });
    element.dataSource = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises(); // connectedCallback (loadD3 + loadData early-return)
    graphql.emit(AGG_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(element.shadowRoot.querySelector(".chart-error")).toBeNull();
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-bar-chart", { is: D3BarChart });
    element.dataSource = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-error")).not.toBeNull();
  });
});
```

> Before writing this test, open `d3BarChart.html` and confirm the error element's CSS class (used above as `.chart-error`). If it differs, use the actual selector — do not invent one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx sfdx-lwc-jest -- --testPathPattern d3BarChart.graphql`
Expected: FAIL — `dataSource` is ignored; `loadData` throws "No data source provided" and no GraphQL handling exists.

- [ ] **Step 3: Add imports and the `dataSource`/`graphqlFilter` props**

In `d3BarChart.js`, add after the existing `@salesforce/apex` imports (around line 24):

```javascript
import { gql, graphql } from "lightning/graphql";
import { buildAggregateQuery, normalizeAggregate } from "c/graphqlService";
```

Add to the PUBLIC API PROPERTIES block (after `filterClause`, around line 65):

```javascript
  /** Data source selector: "auto" (default, existing priority order), "apex", or "graphql". */
  @api dataSource = "auto";

  /** Structured filter for the GraphQL path: { field, operator, value }. */
  @api graphqlFilter;
```

- [ ] **Step 4: Add the reactive query getter, the wire, and the error formatter**

Add these members to the class (e.g. just below the GETTERS block, before LIFECYCLE HOOKS):

```javascript
  /**
   * Reactive GraphQL query for the self-fetch path. Returns undefined (so the wire
   * is skipped) unless dataSource is "graphql" and all required config is present.
   */
  get gqlQuery() {
    if (this.dataSource !== "graphql") return undefined;
    if (!this.objectApiName || !this.groupByField || !this.valueField || !this.operation) {
      return undefined;
    }
    let queryString;
    try {
      queryString = buildAggregateQuery({
        objectApiName: this.objectApiName,
        groupByField: this.groupByField,
        valueField: this.valueField,
        operation: this.operation,
        filter: this.graphqlFilter,
        first: this.recordLimit || 2000
      });
    } catch (e) {
      // Unsupported operation/config: leave the wire un-provisioned; error surfaces below.
      return undefined;
    }
    return gql`${queryString}`;
  }

  @wire(graphql, { query: "$gqlQuery" })
  wiredAggregate({ data, errors }) {
    if (this.dataSource !== "graphql") return;
    if (errors) {
      this.error = this._formatGqlErrors(errors);
      this.isLoading = false;
      return;
    }
    if (!data) return; // initial undefined emission
    try {
      const normalized = normalizeAggregate(data, {
        objectApiName: this.objectApiName,
        groupByField: this.groupByField,
        valueField: this.valueField,
        operation: this.operation
      });
      if (!normalized.length) {
        this.error = "No data after aggregation";
      } else {
        this.chartData = normalized;
        this.error = null;
        this.chartRendered = false; // force renderedCallback to re-initialize the SVG
      }
    } catch (e) {
      this.error = e.message;
    }
    this.isLoading = false;
  }

  _formatGqlErrors(errors) {
    const list = Array.isArray(errors) ? errors : [errors];
    return list.map((e) => e?.message || e).join("; ") || "GraphQL error";
  }
```

Add `wire` to the existing `lwc` import (change `import { LightningElement, api, track } from "lwc";` to include `wire`):

```javascript
import { LightningElement, api, track, wire } from "lwc";
```

- [ ] **Step 5: Make `loadData` early-return on the GraphQL path**

At the top of `loadData()` (around line 169), add before "Priority 1":

```javascript
// GraphQL path is handled reactively by the @wire(graphql) — nothing to do here.
if (this.dataSource === "graphql") {
  return;
}
```

- [ ] **Step 6: Run the new test AND the full existing bar suite**

Run: `npx sfdx-lwc-jest -- --testPathPattern d3BarChart`
Expected: PASS — both new GraphQL tests AND all existing `d3BarChart.test.js` / `integration` / `e2e` tests green (Approach A added nothing destructive).

- [ ] **Step 7: Commit**

```bash
git add force-app/main/default/lwc/d3BarChart
git commit -m "feat(d3BarChart): add additive GraphQL self-fetch path (Approach A)"
```

---

## Task 5: Approach B — d3GanttChart GraphQL replacement

**Files:**

- Modify: `force-app/main/default/lwc/d3GanttChart/d3GanttChart.js`
- Modify: `force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.test.js`

**Interfaces:**

- Consumes: `buildRecordQuery`, `normalizeRecords` (Task 2); `gql`, `graphql` (`lightning/graphql`).
- Produces: a gantt chart whose ONLY server data path is GraphQL. `recordCollection` data-in is retained. The `soqlQuery` prop and Apex imports are removed.

- [ ] **Step 1: Replace the Apex-path tests with a failing GraphQL-path test**

In `d3GanttChart.test.js`, remove the `jest.mock(...executeQuery...)` / `jest.mock(...getDateRangeData...)` blocks and any test asserting the Apex paths, then add (mirror the d3 stub + flushPromises helpers from Task 4's test):

```javascript
import { graphql } from "lightning/graphql";

const GANTT_RESPONSE = {
  uiapi: {
    query: {
      Project__c: {
        edges: [
          {
            node: {
              Name: { value: "Apollo" },
              Project_Start__c: { value: "2026-01-01" },
              Project_End__c: { value: "2026-03-01" }
            }
          }
        ]
      }
    }
  }
};

describe("d3GanttChart GraphQL path (Approach B)", () => {
  it("renders when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-gantt-chart", { is: D3GanttChart });
    element.objectApiName = "Project__c";
    element.labelField = "Name";
    element.startDateField = "Project_Start__c";
    element.endDateField = "Project_End__c";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(GANTT_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(element.shadowRoot.querySelector(".chart-error")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx sfdx-lwc-jest -- --testPathPattern d3GanttChart`
Expected: FAIL — gantt still imports Apex and has no GraphQL handling; the removed `jest.mock` for Apex will also break old tests (expected — they are being replaced).

- [ ] **Step 3: Rewrite the gantt data layer**

In `d3GanttChart.js`:

Replace the `lwc` import and remove the Apex imports (lines 5, 18–19):

```javascript
import { LightningElement, api, track, wire } from "lwc";
```

Delete:

```javascript
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getDateRangeData from "@salesforce/apex/D3ChartController.getDateRangeData";
```

Add:

```javascript
import { gql, graphql } from "lightning/graphql";
import { buildRecordQuery, normalizeRecords } from "c/graphqlService";
```

Remove the `@api soqlQuery = ...` property (it has no GraphQL equivalent — documented loss). Add a structured filter prop near `filterClause`:

```javascript
  /** Structured filter for the GraphQL path: { field, operator, value }. */
  @api graphqlFilter;
```

Replace the body of `loadData()` so the only paths are `recordCollection` then GraphQL (the `@wire` does the fetch; `loadData` only handles the data-in case):

```javascript
  async loadData() {
    // Priority 1: recordCollection (client-side date parsing)
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.chartData = this._prepareDateRows([...this.recordCollection]);
      if (this.chartData.length === 0) {
        throw new Error("No tasks with valid start and end dates");
      }
      return;
    }
    // Otherwise the GraphQL @wire fetches reactively (see wiredTasks). Nothing to do.
  }
```

Add the reactive query getter, wire, and error formatter (mirror Task 4):

```javascript
  get gqlQuery() {
    if (this.recordCollection && this.recordCollection.length > 0) return undefined;
    if (!this.objectApiName || !this.labelField || !this.startDateField || !this.endDateField) {
      return undefined;
    }
    let queryString;
    try {
      queryString = buildRecordQuery({
        objectApiName: this.objectApiName,
        fields: [this.labelField, this.startDateField, this.endDateField],
        filter: this.graphqlFilter,
        orderBy: this.startDateField,
        first: this.recordLimit || 2000
      });
    } catch (e) {
      return undefined;
    }
    return gql`${queryString}`;
  }

  @wire(graphql, { query: "$gqlQuery" })
  wiredTasks({ data, errors }) {
    if (this.recordCollection && this.recordCollection.length > 0) return;
    if (errors) {
      this.error = this._formatGqlErrors(errors);
      this.isLoading = false;
      return;
    }
    if (!data) return;
    try {
      const rows = normalizeRecords(data, {
        objectApiName: this.objectApiName,
        labelField: this.labelField,
        startField: this.startDateField,
        endField: this.endDateField
      });
      const prepared = this._prepareDateRows(rows);
      if (!prepared.length) {
        this.error = "No tasks with valid start and end dates";
      } else {
        this.chartData = prepared;
        this.error = null;
        this.chartRendered = false;
      }
    } catch (e) {
      this.error = e.message;
    }
    this.isLoading = false;
  }

  _formatGqlErrors(errors) {
    const list = Array.isArray(errors) ? errors : [errors];
    return list.map((e) => e?.message || e).join("; ") || "GraphQL error";
  }
```

> Note: `_prepareDateRows` already accepts `[{label,start,end}]` ISO rows (that is the exact shape `getDateRangeData` returned), so it needs no change.

- [ ] **Step 4: Run the gantt suite to verify green**

Run: `npx sfdx-lwc-jest -- --testPathPattern d3GanttChart`
Expected: PASS — the new GraphQL test passes and no Apex-path test remains.

- [ ] **Step 5: Update the gantt meta XML if `soqlQuery` was exposed as a property**

Open `d3GanttChart.js-meta.xml`; if a `soqlQuery` property is declared in any `targetConfig`, remove it so the bundle still deploys. Run no test (metadata-only), but confirm the file is valid XML.

- [ ] **Step 6: Commit**

```bash
git add force-app/main/default/lwc/d3GanttChart
git commit -m "feat(d3GanttChart): replace Apex data path with GraphQL self-fetch (Approach B)"
```

---

## Task 6: Comparison memo + full-suite verification

**Files:**

- Create: `docs/graphql-prototype-comparison.md`

**Interfaces:** none (documentation + verification task).

- [ ] **Step 1: Run the entire test suite**

Run: `npm run test:unit`
Expected: PASS, pristine output. If anything failed, fix before continuing (do not write the memo against a red suite).

- [ ] **Step 2: Gather the diff metrics**

```bash
git diff --stat master...graphql-self-fetch-prototype
```

Record: lines added for Approach A (bar — should be additive only), lines added/removed for Approach B (gantt — should show deletions), and the new `graphqlService` size.

- [ ] **Step 3: Write the comparison memo**

```markdown
# GraphQL Self-Fetch Prototype — A vs B Comparison

## What was built

- `graphqlService` (shared): record + aggregate query builders, structured-filter
  mapper, normalizers. Unit-tested in isolation.
- Approach A (additive) on `d3BarChart`: new `dataSource="graphql"` path alongside
  the existing recordCollection/Apex paths.
- Approach B (replace) on `d3GanttChart`: GraphQL is the only server path; Apex
  imports and `soqlQuery` removed.

## Cost comparison

| Dimension                  | A (bar, additive)             | B (gantt, replace)                        |
| -------------------------- | ----------------------------- | ----------------------------------------- |
| Lines added                | <fill from git diff --stat>   | <fill>                                    |
| Lines/tests removed        | 0                             | <fill>                                    |
| Capabilities lost          | none (Apex kept)              | arbitrary SOQL, typed date-range endpoint |
| Control-flow change        | imperative + reactive coexist | imperative → reactive                     |
| Risk to existing consumers | none                          | breaks non-UI-API objects / complex WHERE |
| Reversibility              | trivial                       | requires restoring Apex path              |

## Aggregate-shape verification result

<Record what the scratch-org check in Task 3 Step 0 found: confirmed shape, or the
fallback to raw-rows + client aggregation, and why.>

## Recommendation for the remaining 28 charts

<Additive (A) vs replace (B), with the reasoning grounded in the table above.>
```

Fill every `<...>` with real values from Steps 1–2 and the Task 3 verification.

- [ ] **Step 4: Commit**

```bash
git add docs/graphql-prototype-comparison.md
git commit -m "docs(graphql): add A-vs-B prototype comparison memo"
```

---

## Self-Review

- **Spec coverage:** §1 goal → Tasks 4/5; §2 decisions (v2 module, `dataSource` prop) → Tasks 1/4; §3 guardrails → Global Constraints + task scoping; §4 `graphqlService` → Tasks 2/3; §4.3 filter model → `buildWhere` (Task 2); §5 Approach A → Task 4; §6 Approach B → Task 5; §7 reactive @wire → wire handlers in Tasks 4/5; §8 test strategy → Task 1 harness + per-task tests; §9 done → Task 6 memo; §10 risks (aggregate shape) → Task 3 Step 0 verify + fallback. All covered.
- **Placeholder scan:** the only intentional `<...>` placeholders are in the memo template (Task 6), which the executor fills from real metrics — not plan-level gaps.
- **Type consistency:** `buildAggregateQuery`/`normalizeAggregate` use `{objectApiName, groupByField, valueField, operation}` consistently; `buildRecordQuery`/`normalizeRecords` use `{objectApiName, fields|labelField/startField/endField}` consistently; `AGG_FN` keys (`Sum/Average/Min/Max`) match the chart `operation` values; `gqlQuery`/`wiredAggregate`/`wiredTasks`/`_formatGqlErrors` names are consistent across Tasks 4–5.
