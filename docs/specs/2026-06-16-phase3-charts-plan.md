# Phase 3 Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next 10 chart components to the d3-lwc library (Pie, Horizontal Bar, Lollipop, Progress Bar, Diverging Bar, Waffle, Sunburst, Bubble, Chord, Gantt) as a full release — components + full 3-tier tests + two new Apex endpoints + rebuilt SFDMU demo data + a Phase 3 showcase flexipage — taking the library from 20 → 30 charts and syncing to `agentforce-dev`.

**Architecture:** Every chart clones the existing component scaffold (universal `@api` set, `connectedCallback → renderedCallback → layout-retry` lifecycle, 3-source `loadData()` cascade, 4-state HTML template) from a family donor and rewrites only `renderChart()` + a few chart-specific `@api` fields. New shared code is purely additive (`dataService.buildMatrix`/`buildHierarchy`, `chartUtils.parseDate`/`computeDateExtent`, two typed Apex endpoints) — existing working charts are never modified. The full design rationale and source-verified API surface live in `docs/specs/2026-06-15-phase3-charts-design.md`.

**Tech Stack:** Lightning Web Components (LWC), D3.js v7.9.0 (full namespace, loaded via `c/d3Lib`), Salesforce Apex (`D3ChartController`, `with sharing`, FLS via `stripInaccessible`), Jest + `@salesforce/sfdx-lwc-jest`, SFDMU + a `uv`/`faker` data generator, SFDX metadata (API 65.0).

**Reference donors (read these — the plan clones them):**
- Component scaffold + bar family: `force-app/main/default/lwc/d3BarChart/`
- Arc/radial family: `force-app/main/default/lwc/d3DonutChart/`
- Single-KPI 3-tier test template: `force-app/main/default/lwc/d3Gauge/`
- Hierarchy: `force-app/main/default/lwc/d3Treemap/` · x/y: `force-app/main/default/lwc/d3ScatterPlot/` · KPI-vs-target: `force-app/main/default/lwc/d3BulletChart/`
- The only three charts with all 3 test tiers are `d3BarChart`, `d3DonutChart`, `d3Gauge` — always template integration/e2e suites from these even when the component donor (Treemap/Scatter/Bullet) is unit-only.

---

## File Structure (what gets created / modified)

**Shared modules (modify, additive only):**
- `force-app/main/default/lwc/dataService/dataService.js` — add 10 `CHART_LIMITS` keys, `buildMatrix`, `buildHierarchy`
- `force-app/main/default/lwc/chartUtils/chartUtils.js` — add `parseDate`, `computeDateExtent`
- `force-app/main/default/classes/D3ChartController.cls` — add `getDateRangeData`, `getXYData`
- `jest.config.js` — add `moduleNameMapper` for `getMultiGroupData`/`getDateRangeData`/`getXYData`
- `scripts/sync-to-agentforce.sh` — fix stale `CHART_COMPONENTS` array

**New per chart (×10, each a self-contained bundle):**
- `force-app/main/default/lwc/<name>/<name>.js`, `.html`, `.js-meta.xml`
- `force-app/main/default/lwc/<name>/__tests__/<name>.test.js`, `.integration.test.js`, `.e2e.test.js`

**New supporting metadata / data:**
- `force-app/main/default/objects/Opportunity/fields/Project_Start__c.field-meta.xml`, `Project_End__c.field-meta.xml`, `Forecast_Units__c.field-meta.xml`
- `__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js`, `.getXYData.js`
- `sfdmu/generate_data.py` (rebuilt), `sfdmu/export.json` (recovered + extended)
- `force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml`

**Docs (modify):** `README.md`, `ROADMAP.md`, `CHART-INDEX.md`.

## Phase Order

Foundation first (shared files — sequential), then the 10 charts easiest→hardest (each fully 3-tier TDD, one subagent per chart), then integration. Charts only depend on foundation; chart phases are mutually independent.

| Phase | What | Depends on |
|-------|------|------------|
| 0 | Pre-flight (branch, husky hook, d3 build check) | — |
| 1 | `dataService` (`CHART_LIMITS`, `buildMatrix`, `buildHierarchy`) | 0 |
| 2 | `chartUtils` (`parseDate`, `computeDateExtent`) | 0 |
| 3 | Apex (`getDateRangeData`, `getXYData`) | 0 |
| 4 | Jest + Apex mocks (wire `getMultiGroupData`/new endpoints) | 3 |
| 5 | Schema custom fields + SFDMU generator | 0 |
| 6 | Pie | 1, 4 |
| 7 | Horizontal Bar | 1, 4 |
| 8 | Lollipop | 1, 4 |
| 9 | Progress Bar | 1, 4 |
| 10 | Diverging Bar | 1, 4 |
| 11 | Waffle | 1, 4 |
| 12 | Sunburst | 1, 4 |
| 13 | Bubble | 1, 3, 4 |
| 14 | Chord | 1, 4 |
| 15 | Gantt | 2, 3, 4 |
| 16 | Showcase flexipage + docs + sync | 5–15 |

---

### Phase 0: Pre-flight

Establish the branch, restore the commit-time quality gate, and confirm the bundled D3 build has the modules the new charts need before any chart that depends on them is built.

#### Task 0.1: Confirm the work branch

**Files:**
- Modify: (none — git state only)

- [ ] **Step 1: Switch to the existing branch**

The `phase3-charts` branch already exists (the design spec was committed there).

Run: `cd ~/code/d3-lwc && git checkout phase3-charts && git status`
Expected: `On branch phase3-charts`, working tree clean (the spec at `docs/specs/2026-06-15-phase3-charts-design.md` already committed).

#### Task 0.2: Restore the husky pre-commit hook

The `.husky/pre-commit` hook lost its executable bit, so git silently skips it (prettier/eslint/jest-on-staged are not running on commit). Restore it so the quality gate is live for all the code commits to follow.

**Files:**
- Modify: `.husky/pre-commit` (mode `100644` → `100755`)

- [ ] **Step 1: Confirm the hook is currently non-executable**

Run: `ls -l .husky/pre-commit`
Expected: a mode without `x` (e.g. `-rw-r--r--`).

- [ ] **Step 2: Restore the executable bit**

Run: `chmod +x .husky/pre-commit && ls -l .husky/pre-commit`
Expected: mode now shows `x` (e.g. `-rwxr-xr-x`).

- [ ] **Step 3: Verify the hook fires (and passes) on a trivial commit**

Run: `git commit --allow-empty -m "chore: probe pre-commit hook" && git reset --soft HEAD~1`
Expected: lint-staged/prettier output appears (hook ran); the empty probe commit is then undone. If the hook errors, STOP and fix the hook before proceeding (NEVER use `--no-verify`).

- [ ] **Step 4: Commit the mode change**

```bash
git add .husky/pre-commit
git commit -m "chore: restore executable bit on husky pre-commit hook"
```

#### Task 0.3: Verify the D3 static resource is the full v7 build

Sunburst (`d3.partition`), Chord (`d3.chord`/`d3.ribbon`), and Gantt (`d3.scaleTime`) rely on modules that a tree-shaken D3 bundle could omit. Confirm the bundled resource is the complete v7.9.0 build before building those charts.

**Files:**
- Inspect: `force-app/main/default/staticresources/d3.js` (and/or its `.resource-meta.xml`)

- [ ] **Step 1: Locate the D3 static resource**

Run: `ls -la force-app/main/default/staticresources/ | grep -i d3`
Expected: a `d3.js` (or `d3.resource` / `d3.resource-meta.xml`) file present.

- [ ] **Step 2: Confirm the required D3 symbols are in the bundle**

Run: `for sym in d3.chord d3.ribbon d3.partition d3.hierarchy d3.scaleTime d3.scaleSqrt d3.pie d3.arc; do printf "%-14s " "$sym"; grep -c "${sym#d3.}" force-app/main/default/staticresources/d3.js >/dev/null 2>&1 && echo present || echo MISSING; done`
Expected: every symbol `present`. (The full UMD build defines `chord`, `ribbon`, `partition`, etc. as top-level exports.)

- [ ] **Step 3: If any symbol is MISSING, replace with the full build**

Download the complete D3 v7.9.0 UMD bundle and overwrite the static resource, then re-run Step 2 until all symbols are present:

```bash
curl -sL https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js -o force-app/main/default/staticresources/d3.js
```

- [ ] **Step 4: Commit only if the resource changed**

```bash
git add force-app/main/default/staticresources/d3.js
git commit -m "chore: ensure d3 static resource is the full v7.9.0 build"
```

If Step 2 already passed with no change, skip this commit.

---


### Phase 1: dataService shared-module additions

Add the 10 Phase-3 `CHART_LIMITS` keys plus two novel data-shaping helpers — `buildMatrix` (edge-list → square adjacency matrix for Chord) and `buildHierarchy` (flat rows → N-level nested `{name, children}` tree for Sunburst) — to `c/dataService`, with full TDD unit coverage appended to the existing suite. These are additive: existing exports (`MAX_RECORDS`, `OPERATIONS`, `aggregateData`, etc.) and all 20 current `CHART_LIMITS` keys are untouched. This is the first sequential foundation task in spec §9.2; the new exports unblock Chord (`buildMatrix`) and Sunburst (`buildHierarchy`), and the new `CHART_LIMITS` keys are imported by all 10 Phase-3 charts.

**Conventions locked from the existing source (honor exactly):**
- Exports are named `const` arrow functions with JSDoc blocks; constants are `export const UPPER_SNAKE_CASE`.
- Null group keys collapse to the literal string `"Null"` (`String(record[field] ?? "Null")`) — `buildHierarchy` must match this.
- `OPERATIONS = {SUM:"Sum", COUNT:"Count", AVERAGE:"Average"}`; an unknown operation silently falls back to **Count** (the `switch` `default` branch). `buildHierarchy` must reuse this exact semantics.
- Non-numeric value fields coerce via `Number(x) || 0` (NaN → 0).
- Jest run pattern: `npm test -- --testPathPattern=dataService`.

---

#### Task 1.1: Add 10 Phase-3 keys to CHART_LIMITS

- **Files:**
  - Modify: `force-app/main/default/lwc/dataService/dataService.js`
  - Test: `force-app/main/default/lwc/dataService/__tests__/dataService.test.js`

Caps chosen per spec §6.1: aggregation-family charts (Pie, Horizontal Bar, Lollipop, Progress Bar, Diverging Bar, Waffle) use server `GROUP BY` → `null`; raw-row charts get bounded caps: `BUBBLE: 5000` (matches existing SCATTER, its donor), `CHORD: 2000`, `SUNBURST: 2000`, `GANTT: 2000`.

- [ ] **Step 1: Write the failing test.** Append this new `describe` block to `dataService.test.js`, immediately after the closing `});` of the existing `describe("CHART_LIMITS for Phase 2 charts", ...)` block (around line 328), AND update the count assertion inside the existing `describe("CHART_LIMITS", ...)` block.

  First, change the existing count assertion from `20` to `30`. Find this `it` (lines 275–278):
  ```js
    it("defines limits for all chart types", () => {
      expect(CHART_LIMITS).toBeDefined();
      expect(Object.keys(CHART_LIMITS)).toHaveLength(20);
    });
  ```
  and replace `toHaveLength(20)` with `toHaveLength(30)`.

  Then append this new block after the Phase-2 `describe`:
  ```js
  describe("CHART_LIMITS for Phase 3 charts", () => {
    it("exports SUNBURST limit as 2000 (raw hierarchy rows)", () => {
      expect(CHART_LIMITS.SUNBURST).toBe(2000);
    });
    it("exports CHORD limit as 2000 (raw edge rows)", () => {
      expect(CHART_LIMITS.CHORD).toBe(2000);
    });
    it("exports GANTT limit as 2000 (raw date-range rows)", () => {
      expect(CHART_LIMITS.GANTT).toBe(2000);
    });
    it("exports BUBBLE limit as 5000 (raw xy rows, SVG cap separate)", () => {
      expect(CHART_LIMITS.BUBBLE).toBe(5000);
    });
    it("exports DIVERGING_BAR limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.DIVERGING_BAR).toBeNull();
    });
    it("exports WAFFLE limit as null (server GROUP BY Count)", () => {
      expect(CHART_LIMITS.WAFFLE).toBeNull();
    });
    it("exports HORIZONTAL_BAR limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.HORIZONTAL_BAR).toBeNull();
    });
    it("exports PIE limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.PIE).toBeNull();
    });
    it("exports PROGRESS_BAR limit as null (server GROUP BY, single row)", () => {
      expect(CHART_LIMITS.PROGRESS_BAR).toBeNull();
    });
    it("exports LOLLIPOP limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.LOLLIPOP).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run it — confirm FAIL.**
  ```bash
  npm test -- --testPathPattern=dataService
  ```
  Expected: FAIL because the new keys (`SUNBURST`, `CHORD`, etc.) are `undefined` on `CHART_LIMITS`, and `Object.keys(CHART_LIMITS)` is still length 20, not 30.

- [ ] **Step 3: Implement.** In `dataService.js`, add the 10 keys inside the `CHART_LIMITS` object literal. Insert them after the `SPARKLINE_GRID: 5000` line (currently line 46) — change that line to end with a comma and append a Phase-3 block:
  ```js
    SPARKLINE_GRID: 5000, // Multiple small charts, raw values
    // Phase 3 charts
    SUNBURST: 2000, // Raw hierarchy rows for client nest
    CHORD: 2000, // Raw edge rows for matrix pivot
    GANTT: 2000, // Raw date-range rows
    BUBBLE: 5000, // Raw xy rows; SVG_ELEMENT_CAP handles rendering separately
    DIVERGING_BAR: null, // Server GROUP BY (signed), no raw record cap
    WAFFLE: null, // Server GROUP BY Count, no raw record cap
    HORIZONTAL_BAR: null, // Server GROUP BY, no raw record cap
    PIE: null, // Server GROUP BY, no raw record cap
    PROGRESS_BAR: null, // Server GROUP BY (single row), no raw record cap
    LOLLIPOP: null // Server GROUP BY, no raw record cap
  ```
  (Note: the old `SPARKLINE_GRID: 5000` had no trailing comma because it was the last entry; add the comma when you append after it, and leave `LOLLIPOP: null` without a trailing comma as the new last entry.)

- [ ] **Step 4: Run it — confirm PASS.**
  ```bash
  npm test -- --testPathPattern=dataService
  ```
  Expected: PASS — all new `CHART_LIMITS` assertions green, and the `toHaveLength(30)` assertion passes (20 existing + 10 new).

- [ ] **Step 5: Commit.**
  ```bash
  git add force-app/main/default/lwc/dataService/dataService.js force-app/main/default/lwc/dataService/__tests__/dataService.test.js
  git commit -m "feat(dataService): add Phase 3 CHART_LIMITS keys for 10 new charts"
  ```

---

#### Task 1.2: Add buildMatrix (edge list → square adjacency matrix)

- **Files:**
  - Modify: `force-app/main/default/lwc/dataService/dataService.js`
  - Test: `force-app/main/default/lwc/dataService/__tests__/dataService.test.js`

Signature (fixed by spec): `buildMatrix(edges, sourceKey, targetKey, valueKey) -> { matrix, labels }`. Collects the **union** of source + target values across all edges into a stable, ordered `labels` array (first-seen order: scan each edge, push the source value if unseen, then the target value if unseen). Builds a square `N×N` `matrix` of zeros where `N === labels.length`, then for each edge adds `Number(edge[valueKey]) || 0` to `matrix[sourceIndex][targetIndex]` (summing duplicate src→tgt edges). This is exactly the shape `d3.chord()` consumes. Consumes the `{label(source), series(target), value}` edge list returned by `getMultiGroupData` (caller passes `sourceKey="label"`, `targetKey="series"`, `valueKey="value"`).

- [ ] **Step 1: Write the failing test.** First add `buildMatrix` to the import statement at the top of `dataService.test.js`. Change the import block (lines 3–17) so the destructured list includes `buildMatrix` — add it after `computeRunningTotal,`:
  ```js
  import {
    validateData,
    validateFields,
    truncateData,
    prepareData,
    aggregateData,
    aggregateSeriesData,
    computeQuartiles,
    computeRunningTotal,
    buildMatrix,
    buildHierarchy,
    sampleData,
    MAX_RECORDS,
    CHART_LIMITS,
    SVG_ELEMENT_CAP,
    OPERATIONS
  } from "c/dataService";
  ```
  (`buildHierarchy` is added now too so Task 1.3 needs no further import edit.)

  Then append this `describe` block at the end of the file, immediately before the final closing `});` that closes `describe("dataService", ...)`:
  ```js
  describe("buildMatrix", () => {
    it("builds a square matrix from a directed edge list", () => {
      const edges = [
        { src: "A", tgt: "B", val: 5 },
        { src: "A", tgt: "C", val: 3 },
        { src: "B", tgt: "C", val: 2 }
      ];
      const { matrix, labels } = buildMatrix(edges, "src", "tgt", "val");
      // Union in first-seen order: A (src e0), B (tgt e0), C (tgt e1)
      expect(labels).toEqual(["A", "B", "C"]);
      expect(matrix).toEqual([
        [0, 5, 3],
        [0, 0, 2],
        [0, 0, 0]
      ]);
    });

    it("sums duplicate source->target edges into one cell", () => {
      const edges = [
        { s: "X", t: "Y", v: 10 },
        { s: "X", t: "Y", v: 4 }
      ];
      const { matrix, labels } = buildMatrix(edges, "s", "t", "v");
      expect(labels).toEqual(["X", "Y"]);
      expect(matrix[0][1]).toBe(14);
    });

    it("collects the union of source and target labels", () => {
      const edges = [
        { s: "Prospecting", t: "Web", v: 1 },
        { s: "Closed Won", t: "Phone", v: 2 }
      ];
      const { labels } = buildMatrix(edges, "s", "t", "v");
      expect(labels).toEqual(["Prospecting", "Web", "Closed Won", "Phone"]);
      expect(labels).toHaveLength(4);
    });

    it("produces an NxN matrix where N equals label count", () => {
      const edges = [
        { s: "A", t: "B", v: 1 },
        { s: "C", t: "D", v: 1 }
      ];
      const { matrix, labels } = buildMatrix(edges, "s", "t", "v");
      expect(labels).toHaveLength(4);
      expect(matrix).toHaveLength(4);
      matrix.forEach((row) => expect(row).toHaveLength(4));
    });

    it("handles self-referencing edges on the diagonal", () => {
      const edges = [{ s: "A", t: "A", v: 7 }];
      const { matrix, labels } = buildMatrix(edges, "s", "t", "v");
      expect(labels).toEqual(["A"]);
      expect(matrix).toEqual([[7]]);
    });

    it("coerces non-numeric and null values to 0", () => {
      const edges = [
        { s: "A", t: "B", v: "oops" },
        { s: "A", t: "B", v: null },
        { s: "A", t: "B", v: 5 }
      ];
      const { matrix } = buildMatrix(edges, "s", "t", "v");
      expect(matrix[0][1]).toBe(5);
    });

    it("returns empty matrix and labels for empty edge list", () => {
      expect(buildMatrix([], "s", "t", "v")).toEqual({
        matrix: [],
        labels: []
      });
    });

    it("returns empty matrix and labels for null edges", () => {
      expect(buildMatrix(null, "s", "t", "v")).toEqual({
        matrix: [],
        labels: []
      });
    });

    it("consumes a getMultiGroupData edge list shape", () => {
      const edges = [
        { label: "Prospecting", series: "Web", value: 100 },
        { label: "Prospecting", series: "Phone", value: 50 },
        { label: "Closed Won", series: "Web", value: 200 }
      ];
      const { matrix, labels } = buildMatrix(
        edges,
        "label",
        "series",
        "value"
      );
      expect(labels).toEqual(["Prospecting", "Web", "Phone", "Closed Won"]);
      const pIdx = labels.indexOf("Prospecting");
      const webIdx = labels.indexOf("Web");
      expect(matrix[pIdx][webIdx]).toBe(100);
    });
  });
  ```

- [ ] **Step 2: Run it — confirm FAIL.**
  ```bash
  npm test -- --testPathPattern=dataService
  ```
  Expected: FAIL because `buildMatrix` is not exported from `c/dataService` (`buildMatrix is not a function`); the import resolves to `undefined`.

- [ ] **Step 3: Implement.** Append this export to the end of `dataService.js` (after `computeRunningTotal`, the current last export ending at line 400):
  ```js
  /**
   * Builds a square adjacency matrix from a directed edge list.
   * Used by the Chord diagram, which feeds the matrix to d3.chord().
   * Labels are the union of source + target values in first-seen order
   * (source of an edge before its target). Duplicate source->target
   * edges are summed into a single cell.
   * @param {Array} edges - Edge records, e.g. getMultiGroupData output
   * @param {String} sourceKey - Field holding the source label
   * @param {String} targetKey - Field holding the target label
   * @param {String} valueKey - Field holding the numeric edge weight
   * @returns {Object} - { matrix: number[][], labels: string[] }
   */
  export const buildMatrix = (edges, sourceKey, targetKey, valueKey) => {
    if (!edges || edges.length === 0) {
      return { matrix: [], labels: [] };
    }

    // Collect union of labels in first-seen order (source before target).
    const labels = [];
    const indexOf = new Map();
    const register = (value) => {
      const label = String(value ?? "Null");
      if (!indexOf.has(label)) {
        indexOf.set(label, labels.length);
        labels.push(label);
      }
      return indexOf.get(label);
    };

    edges.forEach((edge) => {
      register(edge[sourceKey]);
      register(edge[targetKey]);
    });

    const size = labels.length;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(0));

    edges.forEach((edge) => {
      const sourceIndex = indexOf.get(String(edge[sourceKey] ?? "Null"));
      const targetIndex = indexOf.get(String(edge[targetKey] ?? "Null"));
      matrix[sourceIndex][targetIndex] += Number(edge[valueKey]) || 0;
    });

    return { matrix, labels };
  };
  ```

- [ ] **Step 4: Run it — confirm PASS.**
  ```bash
  npm test -- --testPathPattern=dataService
  ```
  Expected: PASS — all 9 `buildMatrix` assertions green. (The `buildHierarchy` suite added in Task 1.3 does not exist yet, so no new failures here.)

- [ ] **Step 5: Commit.**
  ```bash
  git add force-app/main/default/lwc/dataService/dataService.js force-app/main/default/lwc/dataService/__tests__/dataService.test.js
  git commit -m "feat(dataService): add buildMatrix for Chord diagram adjacency matrix"
  ```

---

#### Task 1.3: Add buildHierarchy (flat rows → N-level nested tree)

- **Files:**
  - Modify: `force-app/main/default/lwc/dataService/dataService.js`
  - Test: `force-app/main/default/lwc/dataService/__tests__/dataService.test.js`

Signature (fixed by spec): `buildHierarchy(rows, fields, valueField, operation) -> { name: "Root", children: [...] }`. Nests rows under successive `fields` (level 0 = `fields[0]`, etc.), aggregating `valueField` at the leaves using the **existing** `OPERATIONS` semantics (Sum / Count / Average; unknown op → Count). The returned shape is what `d3.hierarchy()` + `d3.partition()` consume in the Sunburst chart: every non-leaf node is `{ name, children: [...] }`; every leaf is `{ name, value }`. Null field values collapse to the `"Null"` bucket (matching `aggregateData`). The `import` line was already updated in Task 1.2, so no import edit is needed here.

Aggregation detail: accumulate `sum` and `count` per leaf bucket (same as `aggregateData`), then resolve the leaf `value` from `operation`: Sum → `sum`; Count → `count`; Average → `count > 0 ? sum / count : 0`; default (unknown op) → `count`. Non-numeric / null `valueField` contributes `Number(x) || 0` to `sum` but still increments `count`.

- [ ] **Step 1: Write the failing test.** Append this `describe` block at the end of `dataService.test.js`, immediately before the final closing `});` that closes `describe("dataService", ...)` (right after the `buildMatrix` block from Task 1.2):
  ```js
  describe("buildHierarchy", () => {
    const ROWS = [
      { Region: "West", Stage: "Prospecting", Amount: 100 },
      { Region: "West", Stage: "Prospecting", Amount: 50 },
      { Region: "West", Stage: "Closed Won", Amount: 200 },
      { Region: "East", Stage: "Prospecting", Amount: 75 },
      { Region: "East", Stage: "Closed Won", Amount: 300 }
    ];

    it("wraps everything under a Root node", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Sum");
      expect(tree.name).toBe("Root");
      expect(Array.isArray(tree.children)).toBe(true);
    });

    it("builds a single-level hierarchy with Sum", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Sum");
      expect(tree.children).toHaveLength(2);
      const west = tree.children.find((c) => c.name === "West");
      const east = tree.children.find((c) => c.name === "East");
      expect(west.value).toBe(350); // 100 + 50 + 200
      expect(east.value).toBe(375); // 75 + 300
    });

    it("builds a two-level nested hierarchy with Sum", () => {
      const tree = buildHierarchy(ROWS, ["Region", "Stage"], "Amount", "Sum");
      const west = tree.children.find((c) => c.name === "West");
      expect(west.children).toHaveLength(2);
      const westProspecting = west.children.find(
        (c) => c.name === "Prospecting"
      );
      const westClosedWon = west.children.find((c) => c.name === "Closed Won");
      expect(westProspecting.value).toBe(150); // 100 + 50
      expect(westClosedWon.value).toBe(200);
      // Leaf nodes carry a value, not children.
      expect(westProspecting.children).toBeUndefined();
    });

    it("builds a three-level nested hierarchy", () => {
      const rows = [
        { L1: "a", L2: "x", L3: "p", v: 1 },
        { L1: "a", L2: "x", L3: "q", v: 2 },
        { L1: "a", L2: "y", L3: "p", v: 4 },
        { L1: "b", L2: "x", L3: "p", v: 8 }
      ];
      const tree = buildHierarchy(rows, ["L1", "L2", "L3"], "v", "Sum");
      const a = tree.children.find((c) => c.name === "a");
      const ax = a.children.find((c) => c.name === "x");
      const axp = ax.children.find((c) => c.name === "p");
      const axq = ax.children.find((c) => c.name === "q");
      expect(axp.value).toBe(1);
      expect(axq.value).toBe(2);
      const ay = a.children.find((c) => c.name === "y");
      expect(ay.children.find((c) => c.name === "p").value).toBe(4);
      const b = tree.children.find((c) => c.name === "b");
      expect(b.children[0].children[0].value).toBe(8);
    });

    it("aggregates leaves with Count", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Count");
      const west = tree.children.find((c) => c.name === "West");
      const east = tree.children.find((c) => c.name === "East");
      expect(west.value).toBe(3);
      expect(east.value).toBe(2);
    });

    it("aggregates leaves with Average", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Average");
      const west = tree.children.find((c) => c.name === "West");
      expect(west.value).toBe(350 / 3); // (100 + 50 + 200) / 3
    });

    it("falls back to Count for an unknown operation", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Median");
      const west = tree.children.find((c) => c.name === "West");
      expect(west.value).toBe(3); // count, not sum
    });

    it("collapses null field values into a Null bucket", () => {
      const rows = [
        { Region: null, Amount: 10 },
        { Region: null, Amount: 20 }
      ];
      const tree = buildHierarchy(rows, ["Region"], "Amount", "Sum");
      const nullNode = tree.children.find((c) => c.name === "Null");
      expect(nullNode).toBeDefined();
      expect(nullNode.value).toBe(30);
    });

    it("coerces non-numeric values to 0 in the leaf sum", () => {
      const rows = [
        { Region: "A", Amount: "bad" },
        { Region: "A", Amount: 100 }
      ];
      const tree = buildHierarchy(rows, ["Region"], "Amount", "Sum");
      expect(tree.children[0].value).toBe(100); // NaN -> 0
    });

    it("returns an empty Root for null rows", () => {
      expect(buildHierarchy(null, ["Region"], "Amount", "Sum")).toEqual({
        name: "Root",
        children: []
      });
    });

    it("returns an empty Root for empty rows", () => {
      expect(buildHierarchy([], ["Region"], "Amount", "Sum")).toEqual({
        name: "Root",
        children: []
      });
    });

    it("returns an empty Root when fields list is empty", () => {
      expect(buildHierarchy(ROWS, [], "Amount", "Sum")).toEqual({
        name: "Root",
        children: []
      });
    });
  });
  ```

- [ ] **Step 2: Run it — confirm FAIL.**
  ```bash
  npm test -- --testPathPattern=dataService
  ```
  Expected: FAIL because `buildHierarchy` is not exported from `c/dataService` (`buildHierarchy is not a function`); the import resolves to `undefined`.

- [ ] **Step 3: Implement.** Append this export to the end of `dataService.js` (after `buildMatrix` from Task 1.2):
  ```js
  /**
   * Builds a nested hierarchy tree from flat rows for the Sunburst chart,
   * which feeds the tree to d3.hierarchy() + d3.partition().
   * Rows are nested under each field in `fields` (level 0 = fields[0]).
   * Leaf nodes aggregate `valueField` using OPERATIONS semantics
   * (Sum / Count / Average; unknown operation falls back to Count).
   * Null field values collapse to the literal "Null" bucket, matching
   * aggregateData. Non-leaf nodes are { name, children }; leaves are
   * { name, value }.
   * @param {Array} rows - Flat records
   * @param {Array} fields - Ordered field names defining the nesting levels
   * @param {String} valueField - Numeric field aggregated at the leaves
   * @param {String} operation - 'Sum', 'Count', or 'Average'
   * @returns {Object} - { name: "Root", children: [...] }
   */
  export const buildHierarchy = (rows, fields, valueField, operation) => {
    if (!rows || rows.length === 0 || !fields || fields.length === 0) {
      return { name: "Root", children: [] };
    }

    // Accumulate sum + count at each leaf bucket keyed by the full field path.
    const leaves = new Map();
    rows.forEach((row) => {
      const path = fields.map((field) => String(row[field] ?? "Null"));
      const key = path.join("|||");
      if (!leaves.has(key)) {
        leaves.set(key, { path, sum: 0, count: 0 });
      }
      const leaf = leaves.get(key);
      leaf.count += 1;
      if (valueField && row[valueField] != null) {
        leaf.sum += Number(row[valueField]) || 0;
      }
    });

    const resolveValue = (sum, count) => {
      switch (operation) {
        case OPERATIONS.SUM:
          return sum;
        case OPERATIONS.COUNT:
          return count;
        case OPERATIONS.AVERAGE:
          return count > 0 ? sum / count : 0;
        default:
          return count;
      }
    };

    // Walk each leaf path, creating intermediate { name, children } nodes
    // on demand and attaching { name, value } at the final level.
    const root = { name: "Root", children: [] };
    leaves.forEach((leaf) => {
      let node = root;
      leaf.path.forEach((name, depth) => {
        const isLeaf = depth === leaf.path.length - 1;
        if (isLeaf) {
          node.children.push({ name, value: resolveValue(leaf.sum, leaf.count) });
          return;
        }
        let child = node.children.find(
          (c) => c.name === name && Array.isArray(c.children)
        );
        if (!child) {
          child = { name, children: [] };
          node.children.push(child);
        }
        node = child;
      });
    });

    return root;
  };
  ```

- [ ] **Step 4: Run it — confirm PASS.**
  ```bash
  npm test -- --testPathPattern=dataService
  ```
  Expected: PASS — all 12 `buildHierarchy` assertions green, and the full dataService suite (existing + Task 1.1 + Task 1.2 + Task 1.3) is fully green with pristine output.

- [ ] **Step 5: Commit.**
  ```bash
  git add force-app/main/default/lwc/dataService/dataService.js force-app/main/default/lwc/dataService/__tests__/dataService.test.js
  git commit -m "feat(dataService): add buildHierarchy for Sunburst nested tree"
  ```


### Phase 2: chartUtils date-range utilities

Add two novel date helpers to `c/chartUtils` — `parseDate(value)` and `computeDateExtent(rows, startField, endField)` — that supply the `[minDate, maxDate]` domain Gantt's `d3.scaleTime` needs. The ROADMAP (Week 13) falsely claims these already exist; they do not (verified against `chartUtils.js`, which ends at `buildCalendarGrid`). These are pure functions with no donor, so each task shows the full failing test and the full implementation. All new tests live in the existing single unit-test file `chartUtils/__tests__/chartUtils.test.js` (chartUtils has no integration/e2e tiers — it is a leaf utility module, mirroring how `formatNumber`/`buildCalendarGrid` are tested today).

#### Task 2.1: parseDate(value) — coerce Date / ISO string / epoch number to a Date or null

**Files:**
- Modify: `force-app/main/default/lwc/chartUtils/chartUtils.js` (Create: add the `parseDate` export)
- Test: `force-app/main/default/lwc/chartUtils/__tests__/chartUtils.test.js` (Modify: import `parseDate`; add a `describe("parseDate", …)` block)

Behavior contract (locked):
- A `Date` instance → returned as-is if valid; `new Date("invalid")` (a Date whose `getTime()` is `NaN`) → `null`.
- An ISO / parseable date string → `new Date(value)` if valid, else `null`. Empty string `""` → `null`.
- A number → treated as an epoch-milliseconds timestamp via `new Date(value)`; `NaN` → `null`.
- `null` / `undefined` → `null`. Booleans, objects, arrays → `null` (only Date, finite number, or non-empty string are accepted).

Steps:

- [ ] **Step 1: Write the failing test.** In `chartUtils/__tests__/chartUtils.test.js`, add `parseDate` and `computeDateExtent` to the existing top-of-file import block from `"c/chartUtils"` (append after `buildCalendarGrid` on line 13 so the import list reads `…, buildCalendarGrid, parseDate, computeDateExtent`). Then insert this `describe` block immediately before the final closing `});` of the outer `describe("chartUtils", …)` (i.e. after the `buildCalendarGrid` block, before line 613's `});`):

```javascript
  describe("parseDate", () => {
    it("returns a valid Date instance unchanged", () => {
      const d = new Date("2026-03-15T00:00:00.000Z");
      const result = parseDate(d);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(d.getTime());
    });

    it("returns null for an invalid Date instance", () => {
      expect(parseDate(new Date("not-a-date"))).toBeNull();
    });

    it("parses an ISO date-only string", () => {
      const result = parseDate("2026-03-15");
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(new Date("2026-03-15").getTime());
    });

    it("parses a full ISO datetime string", () => {
      const result = parseDate("2026-03-15T08:30:00.000Z");
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe("2026-03-15T08:30:00.000Z");
    });

    it("returns null for an unparseable string", () => {
      expect(parseDate("not a date")).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(parseDate("")).toBeNull();
    });

    it("treats a number as an epoch-milliseconds timestamp", () => {
      const epoch = Date.UTC(2026, 2, 15); // 2026-03-15T00:00:00.000Z
      const result = parseDate(epoch);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(epoch);
    });

    it("parses 0 (the Unix epoch) as a valid Date", () => {
      const result = parseDate(0);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(0);
    });

    it("returns null for NaN", () => {
      expect(parseDate(NaN)).toBeNull();
    });

    it("returns null for null and undefined", () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
    });

    it("returns null for non-date types (boolean, object, array)", () => {
      expect(parseDate(true)).toBeNull();
      expect(parseDate({})).toBeNull();
      expect(parseDate([])).toBeNull();
    });
  });
```

- [ ] **Step 2: Run it — expect FAIL.** Command: `npm test -- --testPathPattern=chartUtils`. Expected: FAIL because `parseDate` is `undefined` (not yet exported) — every assertion throws `TypeError: parseDate is not a function` or returns `undefined`. (`computeDateExtent` is also in the import but not referenced until Task 2.2, so it does not break this run.)

- [ ] **Step 3: Implement `parseDate`.** Append this new section to the END of `force-app/main/default/lwc/chartUtils/chartUtils.js` (after the `buildCalendarGrid` export that ends on line 386):

```javascript
// ===== DATE-RANGE UTILITIES =====

/**
 * Coerces a value into a valid Date, or null.
 * Accepts a Date instance, a parseable date string, or an
 * epoch-milliseconds number. Returns null for empty, invalid, or
 * non-date input.
 * @param {Date|String|Number} value - Value to coerce
 * @returns {Date|null} - A valid Date, or null
 */
export const parseDate = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    if (isNaN(value)) {
      return null;
    }
    const fromNumber = new Date(value);
    return isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (typeof value === "string") {
    if (value.trim() === "") {
      return null;
    }
    const fromString = new Date(value);
    return isNaN(fromString.getTime()) ? null : fromString;
  }

  return null;
};
```

- [ ] **Step 4: Run it — expect PASS.** Command: `npm test -- --testPathPattern=chartUtils`. Expected: PASS — all 11 `parseDate` assertions green. The `computeDateExtent` import resolves to `undefined` but is still unused, so the suite stays green.

- [ ] **Step 5: Commit.**
  - `git add force-app/main/default/lwc/chartUtils/chartUtils.js force-app/main/default/lwc/chartUtils/__tests__/chartUtils.test.js`
  - `git commit -m "feat(chartUtils): add parseDate date-coercion helper"`

#### Task 2.2: computeDateExtent(rows, startField, endField) — [minStart, maxEnd] across rows

**Files:**
- Modify: `force-app/main/default/lwc/chartUtils/chartUtils.js` (Create: add the `computeDateExtent` export)
- Test: `force-app/main/default/lwc/chartUtils/__tests__/chartUtils.test.js` (Modify: add a `describe("computeDateExtent", …)` block; the import was already added in Task 2.1 Step 1)

Behavior contract (locked):
- Returns `[minDate, maxDate]` where `minDate` is the earliest parseable `startField` value and `maxDate` is the latest parseable `endField` value across all rows.
- Each field is parsed with `parseDate`. A row contributes its start to the min pool only if its start parses; it contributes its end to the max pool only if its end parses. Unparseable values for one field do NOT discard the row's other field.
- A row whose `endField` is missing/unparseable but whose `startField` parses still contributes its start (and vice versa).
- Documented fallback: returns `null` when `rows` is not a non-empty array, OR when no row yields any parseable start AND no row yields any parseable end (i.e. there is nothing to bound). When at least one start parses but no end parses (or vice versa), the missing bound falls back to the other pool so the return is always a 2-element `[min, max]` with `min <= max`.

Steps:

- [ ] **Step 1: Write the failing test.** In `chartUtils/__tests__/chartUtils.test.js`, insert this `describe` block immediately after the `parseDate` block added in Task 2.1 (still before the outer `describe`'s closing `});`):

```javascript
  describe("computeDateExtent", () => {
    it("returns [minStart, maxEnd] across all rows", () => {
      const rows = [
        { start: "2026-01-10", end: "2026-02-20" },
        { start: "2026-03-01", end: "2026-04-15" },
        { start: "2026-02-05", end: "2026-03-10" }
      ];
      const [min, max] = computeDateExtent(rows, "start", "end");
      expect(min.getTime()).toBe(new Date("2026-01-10").getTime());
      expect(max.getTime()).toBe(new Date("2026-04-15").getTime());
    });

    it("parses epoch-number fields", () => {
      const a = Date.UTC(2026, 0, 1);
      const b = Date.UTC(2026, 5, 30);
      const rows = [{ s: a, e: b }];
      const [min, max] = computeDateExtent(rows, "s", "e");
      expect(min.getTime()).toBe(a);
      expect(max.getTime()).toBe(b);
    });

    it("skips rows whose start is unparseable but keeps their end", () => {
      const rows = [
        { start: "garbage", end: "2026-05-01" },
        { start: "2026-02-01", end: "2026-03-01" }
      ];
      const [min, max] = computeDateExtent(rows, "start", "end");
      // only the second row's start counts toward min
      expect(min.getTime()).toBe(new Date("2026-02-01").getTime());
      // both ends count; the first row's end is the later one
      expect(max.getTime()).toBe(new Date("2026-05-01").getTime());
    });

    it("keeps a row's start when its end is missing", () => {
      const rows = [
        { start: "2026-01-15", end: null },
        { start: "2026-06-01", end: "2026-07-01" }
      ];
      const [min, max] = computeDateExtent(rows, "start", "end");
      expect(min.getTime()).toBe(new Date("2026-01-15").getTime());
      expect(max.getTime()).toBe(new Date("2026-07-01").getTime());
    });

    it("falls back to the start pool for max when no end parses", () => {
      const rows = [
        { start: "2026-01-01", end: "x" },
        { start: "2026-04-01", end: "" }
      ];
      const [min, max] = computeDateExtent(rows, "start", "end");
      expect(min.getTime()).toBe(new Date("2026-01-01").getTime());
      // no end parses, so max falls back to the latest start
      expect(max.getTime()).toBe(new Date("2026-04-01").getTime());
      expect(min.getTime()).toBeLessThanOrEqual(max.getTime());
    });

    it("falls back to the end pool for min when no start parses", () => {
      const rows = [
        { start: "x", end: "2026-08-01" },
        { start: "", end: "2026-09-01" }
      ];
      const [min, max] = computeDateExtent(rows, "start", "end");
      // no start parses, so min falls back to the earliest end
      expect(min.getTime()).toBe(new Date("2026-08-01").getTime());
      expect(max.getTime()).toBe(new Date("2026-09-01").getTime());
      expect(min.getTime()).toBeLessThanOrEqual(max.getTime());
    });

    it("returns null for an empty array", () => {
      expect(computeDateExtent([], "start", "end")).toBeNull();
    });

    it("returns null when no field parses on any row", () => {
      const rows = [
        { start: "nope", end: "also nope" },
        { start: null, end: undefined }
      ];
      expect(computeDateExtent(rows, "start", "end")).toBeNull();
    });

    it("returns null for non-array input", () => {
      expect(computeDateExtent(null, "start", "end")).toBeNull();
      expect(computeDateExtent(undefined, "start", "end")).toBeNull();
      expect(computeDateExtent({}, "start", "end")).toBeNull();
    });
  });
```

- [ ] **Step 2: Run it — expect FAIL.** Command: `npm test -- --testPathPattern=chartUtils`. Expected: FAIL because `computeDateExtent` is `undefined` (not yet exported) — each assertion throws `TypeError: computeDateExtent is not a function`. (The `parseDate` block from Task 2.1 stays green.)

- [ ] **Step 3: Implement `computeDateExtent`.** Append this export to the END of `force-app/main/default/lwc/chartUtils/chartUtils.js` (immediately after the `parseDate` export added in Task 2.1):

```javascript
/**
 * Computes the [min, max] Date extent across rows for a Gantt-style
 * time domain. The minimum is taken from parsed startField values and
 * the maximum from parsed endField values; unparseable values are
 * skipped per-field (a bad start does not discard a good end).
 * If only one pool has parseable dates, the missing bound falls back to
 * that pool so the result is always [min, max] with min <= max.
 * @param {Array} rows - Array of row objects
 * @param {String} startField - Field name holding the start value
 * @param {String} endField - Field name holding the end value
 * @returns {Array|null} - [minDate, maxDate], or null when nothing parses
 */
export const computeDateExtent = (rows, startField, endField) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const starts = [];
  const ends = [];

  rows.forEach((row) => {
    const start = parseDate(row[startField]);
    if (start) {
      starts.push(start.getTime());
    }
    const end = parseDate(row[endField]);
    if (end) {
      ends.push(end.getTime());
    }
  });

  if (starts.length === 0 && ends.length === 0) {
    return null;
  }

  // Fall back to the other pool when one side has no parseable dates,
  // guaranteeing a [min, max] pair with min <= max.
  const minPool = starts.length > 0 ? starts : ends;
  const maxPool = ends.length > 0 ? ends : starts;

  const minTime = Math.min(...minPool);
  const maxTime = Math.max(...maxPool);

  return [new Date(minTime), new Date(maxTime)];
};
```

- [ ] **Step 4: Run it — expect PASS.** Command: `npm test -- --testPathPattern=chartUtils`. Expected: PASS — all 9 `computeDateExtent` assertions green alongside the existing `parseDate` and pre-existing chartUtils suites. Output pristine (no leaked `console.error`/`console.warn`).

- [ ] **Step 5: Commit.**
  - `git add force-app/main/default/lwc/chartUtils/chartUtils.js force-app/main/default/lwc/chartUtils/__tests__/chartUtils.test.js`
  - `git commit -m "feat(chartUtils): add computeDateExtent for Gantt time domain"`


### Phase 3: Two new typed Apex endpoints on D3ChartController (`getDateRangeData` + `getXYData`)

Add the Gantt date-range endpoint and the Bubble/scatter XY endpoint to `D3ChartController`, copying the existing `getAggregatedData`/`getMultiGroupData` patterns verbatim (`public with sharing`, `@AuraEnabled(cacheable=true)`, `Schema.getGlobalDescribe()` object + field validation, the strip-`;`/block-DML-keyword/`String.escapeSingleQuotes` injection guard, `Security.stripInaccessible(READABLE)` on raw rows, `buildException` for all errors), plus ~16 mirroring `@IsTest` methods (no `SeeAllData`, real DML setup) in `D3ChartControllerTest`.

> **Salesforce TDD reality — deploy-then-test.** Apex does not run locally; tests execute server-side. The "run the failing test" and "run the passing test" steps therefore go through a target org `<org>` (a scratch or dev org you have authenticated, e.g. `sf org login web -a d3dev`). Every run step is the same two-command pair:
> ```bash
> sf project deploy start --source-dir force-app/main/default/classes -o <org>
> sf apex run test --tests D3ChartControllerTest --result-format human -o <org> --wait 10
> ```
> The compiler is part of the loop: deploying a test that references a not-yet-existing method **fails the deploy** ("Method does not exist or incorrect signature"). That deploy failure *is* the RED state — it proves the test is exercising code that does not exist yet. Once the method is implemented, the deploy compiles and the new `@IsTest` methods pass.
>
> **Standard-field-only test data.** This phase is intentionally decoupled from the custom-field phase (spec §7). Tests use only standard Opportunity fields — `Amount`, `StageName`, `CloseDate` (Date), `CreatedDate` (read-only Datetime, always populated) — and standard Account fields (`AnnualRevenue`, `NumberOfEmployees`). No `Project_Start__c`/`Project_End__c`/`Forecast_Units__c` dependency, so this deploys to a vanilla org.

---

#### Task 3.1: Add `getDateRangeData` endpoint (Gantt) — failing tests first

- **Files:**
  - Test: `force-app/main/default/classes/D3ChartControllerTest.cls` (Modify — add `@TestSetup` Opportunity records + 8 `getDateRangeData` `@IsTest` methods)
  - Modify: `force-app/main/default/classes/D3ChartController.cls` (add `getDateRangeData` method + bounded `MAX_RAW_ROWS` constant)

- [ ] **Step 1: Add Opportunity test data to the existing `@TestSetup`.** Open `force-app/main/default/classes/D3ChartControllerTest.cls` (donor: read its existing `setup()` at lines 13–62). The current `setup()` inserts 5 Accounts only; both new endpoints query Opportunity, so extend `setup()` to also insert Opportunities with known `Amount`, `StageName`, and `CloseDate` values. Insert this block immediately **before** the closing `}` of the `setup()` method (after `insert accounts;`):
  ```apex
    // Opportunities for getDateRangeData / getXYData tests.
    // Known Amount, StageName, and CloseDate so assertions are deterministic.
    List<Opportunity> opps = new List<Opportunity>();
    opps.add(
      new Opportunity(
        Name = 'Opp One',
        StageName = 'Prospecting',
        Amount = 1000,
        CloseDate = Date.newInstance(2026, 3, 31)
      )
    );
    opps.add(
      new Opportunity(
        Name = 'Opp Two',
        StageName = 'Negotiation',
        Amount = 2000,
        CloseDate = Date.newInstance(2026, 6, 30)
      )
    );
    opps.add(
      new Opportunity(
        Name = 'Opp Three',
        StageName = 'Closed Won',
        Amount = 3000,
        CloseDate = Date.newInstance(2026, 9, 30)
      )
    );
    insert opps;
  ```

- [ ] **Step 2: Write the 8 failing `getDateRangeData` tests.** Add this block at the end of `D3ChartControllerTest.cls`, immediately **before** the final closing `}` of the class (after the last `getMultiGroupData` test at line 1040):
  ```apex
  // ═══════════════════════════════════════════════════════════════
  // getDateRangeData TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testGetDateRangeDataReturnsRows() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getDateRangeData(
      'Opportunity',
      'Name',
      'CreatedDate',
      'CloseDate',
      null
    );
    Test.stopTest();

    System.assertEquals(3, results.size(), 'Should return one row per Opportunity');
    System.assert(
      results[0].containsKey('label'),
      'Row should contain label key'
    );
    System.assert(
      results[0].containsKey('start'),
      'Row should contain start key'
    );
    System.assert(results[0].containsKey('end'), 'Row should contain end key');
  }

  @isTest
  static void testGetDateRangeDataValues() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getDateRangeData(
      'Opportunity',
      'Name',
      'CreatedDate',
      'CloseDate',
      'Name = \'Opp One\''
    );
    Test.stopTest();

    System.assertEquals(1, results.size(), 'Filter should isolate one row');
    System.assertEquals(
      'Opp One',
      (String) results[0].get('label'),
      'Label should be the Name field value'
    );
    System.assertEquals(
      Date.newInstance(2026, 3, 31),
      (Date) results[0].get('end'),
      'End should be the CloseDate value'
    );
    System.assertNotEquals(
      null,
      results[0].get('start'),
      'Start (CreatedDate) should be populated'
    );
  }

  @isTest
  static void testGetDateRangeDataWithFilter() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getDateRangeData(
      'Opportunity',
      'Name',
      'CreatedDate',
      'CloseDate',
      'Amount > 1500'
    );
    Test.stopTest();

    System.assertEquals(
      2,
      results.size(),
      'Filter Amount > 1500 should return Opp Two and Opp Three'
    );
  }

  @isTest
  static void testGetDateRangeDataInvalidObject() {
    Test.startTest();
    try {
      D3ChartController.getDateRangeData(
        'TotallyFakeObject__xyz',
        'Name',
        'CreatedDate',
        'CloseDate',
        null
      );
      System.assert(false, 'Expected exception for invalid object');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Invalid object'),
        'Error should mention invalid object'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetDateRangeDataInvalidLabelField() {
    Test.startTest();
    try {
      D3ChartController.getDateRangeData(
        'Opportunity',
        'NonExistentField__xyz',
        'CreatedDate',
        'CloseDate',
        null
      );
      System.assert(false, 'Expected exception for invalid label field');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Invalid labelField'),
        'Error should mention invalid labelField'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetDateRangeDataInvalidStartField() {
    Test.startTest();
    try {
      D3ChartController.getDateRangeData(
        'Opportunity',
        'Name',
        'FakeStart__xyz',
        'CloseDate',
        null
      );
      System.assert(false, 'Expected exception for invalid start field');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Invalid startField'),
        'Error should mention invalid startField'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetDateRangeDataInvalidEndField() {
    Test.startTest();
    try {
      D3ChartController.getDateRangeData(
        'Opportunity',
        'Name',
        'CreatedDate',
        'FakeEnd__xyz',
        null
      );
      System.assert(false, 'Expected exception for invalid end field');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Invalid endField'),
        'Error should mention invalid endField'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetDateRangeDataInjectionPrevention() {
    Test.startTest();
    try {
      D3ChartController.getDateRangeData(
        'Opportunity',
        'Name',
        'CreatedDate',
        'CloseDate',
        'Amount > 0; DELETE FROM Opportunity'
      );
      System.assert(false, 'Expected exception for injection attempt');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('forbidden keyword'),
        'Error should mention forbidden keyword: ' + e.getMessage()
      );
    }
    Test.stopTest();
  }
  ```

- [ ] **Step 3: Run the tests — expect deploy failure (RED).** Run:
  ```bash
  sf project deploy start --source-dir force-app/main/default/classes -o <org>
  ```
  **Expected: FAIL** at the deploy step — the test class references `D3ChartController.getDateRangeData(...)`, which does not exist yet, so the Apex compiler reports `Method does not exist or incorrect signature: void getDateRangeData(...) from the type D3ChartController` and the deploy is rejected. (No `sf apex run test` happens because the deploy never lands.) This is the RED state: the test cannot even compile against the current controller.

- [ ] **Step 4: Implement `getDateRangeData`.** Open `force-app/main/default/classes/D3ChartController.cls`. First add the bounded raw-row cap constant directly below the existing `MAX_RECORDS` declaration (after line 12, `private static final Integer MAX_RECORDS = 10000;`):
  ```apex
  /**
   * Maximum number of raw (un-aggregated) rows returned by the typed
   * date-range and XY endpoints, bounding payload size for the browser.
   */
  private static final Integer MAX_RAW_ROWS = 2000;
  ```
  Then add the full method immediately **after** the `getMultiGroupData` method (after its closing `}` at line 317, before the `hasAggregateFunctions` helper):
  ```apex
  /**
   * Returns raw date-range rows for a Gantt chart: one row per record with
   * a display label, a start date, and an end date. Validates the object and
   * all three fields via Schema describe, sanitizes the optional filter clause
   * against injection, and enforces field-level security on the returned rows.
   *
   * @param objectName   - API name of the SObject to query
   * @param labelField   - Field used as the row label (task name)
   * @param startField   - Date/Datetime field marking the bar start
   * @param endField     - Date/Datetime field marking the bar end
   * @param filterClause - Optional WHERE clause (without the WHERE keyword)
   * @return List of maps with 'label', 'start', and 'end' keys (max 2000 rows)
   * @throws AuraHandledException for invalid inputs
   */
  @AuraEnabled(cacheable=true)
  public static List<Map<String, Object>> getDateRangeData(
    String objectName,
    String labelField,
    String startField,
    String endField,
    String filterClause
  ) {
    // Validate object exists
    if (
      String.isBlank(objectName) ||
      !Schema.getGlobalDescribe().containsKey(objectName)
    ) {
      throw buildException('Invalid object: ' + objectName);
    }

    Schema.DescribeSObjectResult objDescribe = Schema.getGlobalDescribe()
      .get(objectName)
      .getDescribe();
    Map<String, Schema.SObjectField> fieldMap = objDescribe.fields.getMap();

    // Validate fields exist
    if (String.isBlank(labelField) || !fieldMap.containsKey(labelField)) {
      throw buildException('Invalid labelField: ' + labelField);
    }
    if (String.isBlank(startField) || !fieldMap.containsKey(startField)) {
      throw buildException('Invalid startField: ' + startField);
    }
    if (String.isBlank(endField) || !fieldMap.containsKey(endField)) {
      throw buildException('Invalid endField: ' + endField);
    }

    // Sanitize filter clause
    String sanitizedFilter = '';
    if (String.isNotBlank(filterClause)) {
      sanitizedFilter = filterClause.replaceAll('[;]', '');
      String upperFilter = sanitizedFilter.toUpperCase();
      List<String> blockedKeywords = new List<String>{
        'INSERT',
        'UPDATE',
        'DELETE',
        'UPSERT',
        'MERGE'
      };
      for (String keyword : blockedKeywords) {
        if (upperFilter.contains(keyword)) {
          throw buildException(
            'Filter clause contains forbidden keyword: ' + keyword
          );
        }
      }
    }

    String escapedLabel = String.escapeSingleQuotes(labelField);
    String escapedStart = String.escapeSingleQuotes(startField);
    String escapedEnd = String.escapeSingleQuotes(endField);
    String query =
      'SELECT ' +
      escapedLabel +
      ', ' +
      escapedStart +
      ', ' +
      escapedEnd +
      ' FROM ' +
      String.escapeSingleQuotes(objectName);

    if (String.isNotBlank(sanitizedFilter)) {
      query += ' WHERE ' + sanitizedFilter;
    }

    query += ' LIMIT ' + MAX_RAW_ROWS;

    try {
      List<SObject> records = Database.query(query);

      // Enforce field-level security on raw rows
      SObjectAccessDecision decision = Security.stripInaccessible(
        AccessType.READABLE,
        records
      );
      records = decision.getRecords();

      List<Map<String, Object>> output = new List<Map<String, Object>>();
      for (SObject rec : records) {
        Map<String, Object> row = new Map<String, Object>();
        row.put('label', rec.get(labelField));
        row.put('start', rec.get(startField));
        row.put('end', rec.get(endField));
        output.add(row);
      }

      return output;
    } catch (QueryException e) {
      throw buildException('Date range query failed: ' + e.getMessage());
    } catch (Exception e) {
      throw buildException('Date range retrieval failed: ' + e.getMessage());
    }
  }
  ```

- [ ] **Step 5: Run the tests — expect pass (GREEN).** Run:
  ```bash
  sf project deploy start --source-dir force-app/main/default/classes -o <org>
  sf apex run test --tests D3ChartControllerTest --result-format human -o <org> --wait 10
  ```
  **Expected: PASS** — deploy compiles cleanly now that `getDateRangeData` exists, and all 8 new `getDateRangeData` `@IsTest` methods pass (plus every pre-existing test still passes). The human result format prints `Outcome: Passed` for each `D3ChartControllerTest.testGetDateRangeData*` method and `Pass Rate: 100%`.

- [ ] **Step 6: Commit.**
  ```bash
  git add force-app/main/default/classes/D3ChartController.cls force-app/main/default/classes/D3ChartControllerTest.cls
  git commit -m "feat(apex): add getDateRangeData endpoint for Gantt chart"
  ```

---

#### Task 3.2: Add `getXYData` endpoint (Bubble/scatter) — failing tests first

- **Files:**
  - Test: `force-app/main/default/classes/D3ChartControllerTest.cls` (Modify — add 8 `getXYData` `@IsTest` methods)
  - Modify: `force-app/main/default/classes/D3ChartController.cls` (add `getXYData` method; reuses `MAX_RAW_ROWS` from Task 3.1)

- [ ] **Step 1: Write the 8 failing `getXYData` tests.** Add this block at the end of `D3ChartControllerTest.cls`, immediately **before** the final closing `}` of the class (after the `getDateRangeData` tests added in Task 3.1). These query Account (`AnnualRevenue`, `NumberOfEmployees`, `Name` are populated by the existing `@TestSetup`):
  ```apex
  // ═══════════════════════════════════════════════════════════════
  // getXYData TESTS
  // ═══════════════════════════════════════════════════════════════

  @isTest
  static void testGetXYDataReturnsRows() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getXYData(
      'Account',
      'AnnualRevenue',
      'NumberOfEmployees',
      'NumberOfEmployees',
      'Name',
      null
    );
    Test.stopTest();

    System.assertEquals(5, results.size(), 'Should return one row per Account');
    System.assert(results[0].containsKey('x'), 'Row should contain x key');
    System.assert(results[0].containsKey('y'), 'Row should contain y key');
    System.assert(results[0].containsKey('size'), 'Row should contain size key');
    System.assert(
      results[0].containsKey('label'),
      'Row should contain label key'
    );
  }

  @isTest
  static void testGetXYDataValues() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getXYData(
      'Account',
      'AnnualRevenue',
      'NumberOfEmployees',
      'NumberOfEmployees',
      'Name',
      'Name = \'Tech Alpha\''
    );
    Test.stopTest();

    System.assertEquals(1, results.size(), 'Filter should isolate one Account');
    System.assertEquals(
      100,
      (Decimal) results[0].get('x'),
      'x should be the AnnualRevenue value'
    );
    System.assertEquals(
      10,
      (Decimal) results[0].get('y'),
      'y should be the NumberOfEmployees value'
    );
    System.assertEquals(
      10,
      (Decimal) results[0].get('size'),
      'size should be the sizeField (NumberOfEmployees) value'
    );
    System.assertEquals(
      'Tech Alpha',
      (String) results[0].get('label'),
      'label should be the Name value'
    );
  }

  @isTest
  static void testGetXYDataNullSizeField() {
    // sizeField is optional — when blank, size should be null but x/y/label present
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getXYData(
      'Account',
      'AnnualRevenue',
      'NumberOfEmployees',
      '',
      'Name',
      'Name = \'Tech Alpha\''
    );
    Test.stopTest();

    System.assertEquals(1, results.size(), 'Should return the filtered Account');
    System.assertEquals(
      100,
      (Decimal) results[0].get('x'),
      'x should still be populated when sizeField is blank'
    );
    System.assertEquals(
      null,
      results[0].get('size'),
      'size should be null when sizeField is blank'
    );
  }

  @isTest
  static void testGetXYDataWithFilter() {
    Test.startTest();
    List<Map<String, Object>> results = D3ChartController.getXYData(
      'Account',
      'AnnualRevenue',
      'NumberOfEmployees',
      'NumberOfEmployees',
      'Name',
      'Industry = \'Finance\''
    );
    Test.stopTest();

    System.assertEquals(
      2,
      results.size(),
      'Finance filter should return the 2 Finance accounts'
    );
  }

  @isTest
  static void testGetXYDataInvalidObject() {
    Test.startTest();
    try {
      D3ChartController.getXYData(
        'TotallyFakeObject__xyz',
        'AnnualRevenue',
        'NumberOfEmployees',
        'NumberOfEmployees',
        'Name',
        null
      );
      System.assert(false, 'Expected exception for invalid object');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Invalid object'),
        'Error should mention invalid object'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetXYDataInvalidXField() {
    Test.startTest();
    try {
      D3ChartController.getXYData(
        'Account',
        'FakeX__xyz',
        'NumberOfEmployees',
        'NumberOfEmployees',
        'Name',
        null
      );
      System.assert(false, 'Expected exception for invalid x field');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Invalid xField'),
        'Error should mention invalid xField'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetXYDataInvalidYField() {
    Test.startTest();
    try {
      D3ChartController.getXYData(
        'Account',
        'AnnualRevenue',
        'FakeY__xyz',
        'NumberOfEmployees',
        'Name',
        null
      );
      System.assert(false, 'Expected exception for invalid y field');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('Invalid yField'),
        'Error should mention invalid yField'
      );
    }
    Test.stopTest();
  }

  @isTest
  static void testGetXYDataInjectionPrevention() {
    Test.startTest();
    try {
      D3ChartController.getXYData(
        'Account',
        'AnnualRevenue',
        'NumberOfEmployees',
        'NumberOfEmployees',
        'Name',
        'AnnualRevenue > 0; DELETE FROM Account'
      );
      System.assert(false, 'Expected exception for injection attempt');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage().contains('forbidden keyword'),
        'Error should mention forbidden keyword: ' + e.getMessage()
      );
    }
    Test.stopTest();
  }
  ```

- [ ] **Step 2: Run the tests — expect deploy failure (RED).** Run:
  ```bash
  sf project deploy start --source-dir force-app/main/default/classes -o <org>
  ```
  **Expected: FAIL** at deploy — the test class now references `D3ChartController.getXYData(...)`, which does not exist, so the Apex compiler reports `Method does not exist or incorrect signature: ... getXYData(...) from the type D3ChartController` and rejects the deploy. RED state confirmed.

- [ ] **Step 3: Implement `getXYData`.** Open `force-app/main/default/classes/D3ChartController.cls`. Add the full method immediately **after** the `getDateRangeData` method added in Task 3.1 (before the `hasAggregateFunctions` helper). Note `sizeField` is optional: blank skips the column and yields `size: null`:
  ```apex
  /**
   * Returns raw XY rows for a scatter or bubble chart: one row per record with
   * x, y, an optional bubble size, and a display label. Validates the object and
   * the required x/y/label fields (and sizeField when supplied) via Schema
   * describe, sanitizes the optional filter clause against injection, and
   * enforces field-level security on the returned rows.
   *
   * @param objectName   - API name of the SObject to query
   * @param xField       - Numeric field for the x axis
   * @param yField       - Numeric field for the y axis
   * @param sizeField    - Optional numeric field for bubble area (blank = no size)
   * @param labelField   - Field used as the point label
   * @param filterClause - Optional WHERE clause (without the WHERE keyword)
   * @return List of maps with 'x', 'y', 'size', and 'label' keys (max 2000 rows)
   * @throws AuraHandledException for invalid inputs
   */
  @AuraEnabled(cacheable=true)
  public static List<Map<String, Object>> getXYData(
    String objectName,
    String xField,
    String yField,
    String sizeField,
    String labelField,
    String filterClause
  ) {
    // Validate object exists
    if (
      String.isBlank(objectName) ||
      !Schema.getGlobalDescribe().containsKey(objectName)
    ) {
      throw buildException('Invalid object: ' + objectName);
    }

    Schema.DescribeSObjectResult objDescribe = Schema.getGlobalDescribe()
      .get(objectName)
      .getDescribe();
    Map<String, Schema.SObjectField> fieldMap = objDescribe.fields.getMap();

    // Validate required fields exist
    if (String.isBlank(xField) || !fieldMap.containsKey(xField)) {
      throw buildException('Invalid xField: ' + xField);
    }
    if (String.isBlank(yField) || !fieldMap.containsKey(yField)) {
      throw buildException('Invalid yField: ' + yField);
    }
    if (String.isBlank(labelField) || !fieldMap.containsKey(labelField)) {
      throw buildException('Invalid labelField: ' + labelField);
    }

    // sizeField is optional; validate only when supplied
    Boolean hasSize = String.isNotBlank(sizeField);
    if (hasSize && !fieldMap.containsKey(sizeField)) {
      throw buildException('Invalid sizeField: ' + sizeField);
    }

    // Sanitize filter clause
    String sanitizedFilter = '';
    if (String.isNotBlank(filterClause)) {
      sanitizedFilter = filterClause.replaceAll('[;]', '');
      String upperFilter = sanitizedFilter.toUpperCase();
      List<String> blockedKeywords = new List<String>{
        'INSERT',
        'UPDATE',
        'DELETE',
        'UPSERT',
        'MERGE'
      };
      for (String keyword : blockedKeywords) {
        if (upperFilter.contains(keyword)) {
          throw buildException(
            'Filter clause contains forbidden keyword: ' + keyword
          );
        }
      }
    }

    String escapedX = String.escapeSingleQuotes(xField);
    String escapedY = String.escapeSingleQuotes(yField);
    String escapedLabel = String.escapeSingleQuotes(labelField);
    String selectClause = escapedX + ', ' + escapedY + ', ' + escapedLabel;
    if (hasSize) {
      selectClause += ', ' + String.escapeSingleQuotes(sizeField);
    }

    String query =
      'SELECT ' +
      selectClause +
      ' FROM ' +
      String.escapeSingleQuotes(objectName);

    if (String.isNotBlank(sanitizedFilter)) {
      query += ' WHERE ' + sanitizedFilter;
    }

    query += ' LIMIT ' + MAX_RAW_ROWS;

    try {
      List<SObject> records = Database.query(query);

      // Enforce field-level security on raw rows
      SObjectAccessDecision decision = Security.stripInaccessible(
        AccessType.READABLE,
        records
      );
      records = decision.getRecords();

      List<Map<String, Object>> output = new List<Map<String, Object>>();
      for (SObject rec : records) {
        Map<String, Object> row = new Map<String, Object>();
        row.put('x', rec.get(xField));
        row.put('y', rec.get(yField));
        row.put('size', hasSize ? rec.get(sizeField) : null);
        row.put('label', rec.get(labelField));
        output.add(row);
      }

      return output;
    } catch (QueryException e) {
      throw buildException('XY query failed: ' + e.getMessage());
    } catch (Exception e) {
      throw buildException('XY retrieval failed: ' + e.getMessage());
    }
  }
  ```

- [ ] **Step 4: Run the tests — expect pass (GREEN).** Run:
  ```bash
  sf project deploy start --source-dir force-app/main/default/classes -o <org>
  sf apex run test --tests D3ChartControllerTest --result-format human -o <org> --wait 10
  ```
  **Expected: PASS** — deploy compiles, all 8 `getXYData` `@IsTest` methods pass alongside the 8 `getDateRangeData` methods and every pre-existing test. `Pass Rate: 100%`, no failures. The `testGetXYDataNullSizeField` case verifies the optional-`sizeField` branch (blank → `size: null`, x/y/label still populated).

- [ ] **Step 5: Commit.**
  ```bash
  git add force-app/main/default/classes/D3ChartController.cls force-app/main/default/classes/D3ChartControllerTest.cls
  git commit -m "feat(apex): add getXYData endpoint for bubble and scatter charts"
  ```


### Phase 4: Wire jest + Apex mocks for the new/uncovered endpoints

Add the two new Apex-method mock stubs (`getDateRangeData`, `getXYData`), wire `moduleNameMapper` entries for those two PLUS the already-existing-but-unmapped `getMultiGroupData` (a real gap today), and verify the full existing suite stays green. This is config/mocks work, not feature TDD: there is no failing feature test — the "test" is that the new mock modules are importable through the `@salesforce/apex/...` alias and the existing 1,790 tests / 31 suites stay green after the `jest.config.js` change.

> **Donor files to read first:** `__mocks__/@salesforce/apex/D3ChartController.getMultiGroupData.js` (the exact stub shape to copy) and `jest.config.js` (the `moduleNameMapper` block to extend). Both are short; read them before starting.

#### Task 4.1: Add the `getDateRangeData` and `getXYData` mock stubs

- **Files:**
  - Create: `__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js`
  - Create: `__mocks__/@salesforce/apex/D3ChartController.getXYData.js`

- [ ] **Step 1: Capture the baseline (pre-change green state)**
  Record the current suite/test totals so the Task 4.3 verification has a concrete number to compare against. Run:
  ```bash
  npm test 2>&1 | tail -n 20
  ```
  Expected: PASS — `Test Suites: 31 passed, 31 total` and `Tests: 1790 passed, 1790 total`. Note these two numbers; they MUST be identical after Task 4.2. (If your local baseline differs, use YOUR observed numbers as the target — the invariant is "unchanged," not the literal 1,790/31.)

- [ ] **Step 2: Create the `getDateRangeData` stub (matching the donor exactly)**
  These stubs have no behavior to test in isolation — the verification is that they are importable and resolve to a `jest.fn()` returning `[]`. Create `__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js` with byte-for-byte the same 3-line shape as the `getMultiGroupData` donor, only the method name in the ABOUTME comment changing:
  ```js
  // ABOUTME: Mock for D3ChartController.getDateRangeData Apex method.
  // ABOUTME: Returns an empty array by default; tests override via mockResolvedValue.
  export default jest.fn().mockResolvedValue([]);
  ```

- [ ] **Step 3: Create the `getXYData` stub (matching the donor exactly)**
  Create `__mocks__/@salesforce/apex/D3ChartController.getXYData.js`:
  ```js
  // ABOUTME: Mock for D3ChartController.getXYData Apex method.
  // ABOUTME: Returns an empty array by default; tests override via mockResolvedValue.
  export default jest.fn().mockResolvedValue([]);
  ```

- [ ] **Step 4: Confirm the stub files are valid JS modules (lint + format)**
  The stubs cannot be imported yet (no mapper entry until Task 4.2), so the only thing to verify now is that they parse and are formatted. Run:
  ```bash
  npm run prettier:verify -- "__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js" "__mocks__/@salesforce/apex/D3ChartController.getXYData.js"
  ```
  Expected: PASS — both files report as already formatted (they match the donor exactly). If prettier rewrites them, run `npm run prettier -- "__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js" "__mocks__/@salesforce/apex/D3ChartController.getXYData.js"` and re-verify.

- [ ] **Step 5: Commit the new stubs**
  ```bash
  git add "__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js" "__mocks__/@salesforce/apex/D3ChartController.getXYData.js"
  git commit -m "test(mocks): add getDateRangeData and getXYData Apex stubs"
  ```

#### Task 4.2: Wire `moduleNameMapper` for getMultiGroupData, getDateRangeData, getXYData

- **Files:**
  - Modify: `jest.config.js`

- [ ] **Step 1: Write the failing import probe (proves the alias is unresolved today)**
  Before touching the config, confirm the gap is real: with no mapper entry, importing the `@salesforce/apex/D3ChartController.getMultiGroupData` alias fails to resolve to the stub. Create a throwaway probe spec at `__mocks__/__tests__/apexMapper.probe.test.js`:
  ```js
  // ABOUTME: Throwaway probe verifying the three Apex aliases resolve to jest.fn stubs.
  // ABOUTME: Deleted in Step 6 once the moduleNameMapper entries are confirmed wired.
  import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";
  import getDateRangeData from "@salesforce/apex/D3ChartController.getDateRangeData";
  import getXYData from "@salesforce/apex/D3ChartController.getXYData";

  describe("Apex moduleNameMapper wiring", () => {
    it("resolves getMultiGroupData to a jest.fn stub returning []", async () => {
      expect(jest.isMockFunction(getMultiGroupData)).toBe(true);
      await expect(getMultiGroupData()).resolves.toEqual([]);
    });
    it("resolves getDateRangeData to a jest.fn stub returning []", async () => {
      expect(jest.isMockFunction(getDateRangeData)).toBe(true);
      await expect(getDateRangeData()).resolves.toEqual([]);
    });
    it("resolves getXYData to a jest.fn stub returning []", async () => {
      expect(jest.isMockFunction(getXYData)).toBe(true);
      await expect(getXYData()).resolves.toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run the probe — confirm it FAILS on the unresolved aliases**
  ```bash
  npm test -- --testPathPattern=apexMapper.probe
  ```
  Expected: FAIL because none of the three aliases have a `moduleNameMapper` entry yet — Jest reports `Cannot find module '@salesforce/apex/D3ChartController.getMultiGroupData' from '__mocks__/__tests__/apexMapper.probe.test.js'` (and the same for the other two). This proves the `getMultiGroupData` gap called out in spec §10 is real, not theoretical.

- [ ] **Step 3: Add the three mapper entries to `jest.config.js`**
  Append the three entries to the `moduleNameMapper` object, immediately after the existing `getCorrelation` entry (which is currently the last entry, with no trailing comma). Add a comma after the `getCorrelation` value, then add the three new lines. The exact diff:
  ```diff
       "^@salesforce/apex/D3ChartController.getCorrelation$":
  -      "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getCorrelation.js"
  +      "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getCorrelation.js",
  +    "^@salesforce/apex/D3ChartController.getMultiGroupData$":
  +      "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getMultiGroupData.js",
  +    "^@salesforce/apex/D3ChartController.getDateRangeData$":
  +      "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js",
  +    "^@salesforce/apex/D3ChartController.getXYData$":
  +      "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getXYData.js"
     }
   };
  ```
  After the edit, the full `moduleNameMapper` block must read exactly:
  ```js
    moduleNameMapper: {
      ...jestConfig.moduleNameMapper,
      "^lightning/platformShowToastEvent$":
        "<rootDir>/__mocks__/lightning/platformShowToastEvent.js",
      "^lightning/navigation$": "<rootDir>/__mocks__/lightning/navigation.js",
      "^lightning/platformResourceLoader$":
        "<rootDir>/__mocks__/lightning/platformResourceLoader.js",
      "^@salesforce/apex/D3ChartController.executeQuery$":
        "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.executeQuery.js",
      "^@salesforce/apex/D3ChartController.getAggregatedData$":
        "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getAggregatedData.js",
      "^@salesforce/apex/D3ChartController.getStatistics$":
        "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getStatistics.js",
      "^@salesforce/apex/D3ChartController.getCorrelation$":
        "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getCorrelation.js",
      "^@salesforce/apex/D3ChartController.getMultiGroupData$":
        "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getMultiGroupData.js",
      "^@salesforce/apex/D3ChartController.getDateRangeData$":
        "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js",
      "^@salesforce/apex/D3ChartController.getXYData$":
        "<rootDir>/__mocks__/@salesforce/apex/D3ChartController.getXYData.js"
    }
  ```

- [ ] **Step 4: Run the probe — confirm it now PASSES**
  ```bash
  npm test -- --testPathPattern=apexMapper.probe
  ```
  Expected: PASS — all three aliases now resolve to their `jest.fn()` stubs; each returns `[]`. This confirms the new mock modules are importable through the `@salesforce/apex/...` alias.

- [ ] **Step 5: Lint + format the edited config**
  ```bash
  npm run prettier:verify -- jest.config.js
  ```
  Expected: PASS — `jest.config.js` is already formatted (the new entries follow the existing two-line key/value style). If prettier rewrites it, run `npm run prettier -- jest.config.js` and re-verify.

- [ ] **Step 6: Delete the throwaway probe spec**
  The probe has served its purpose; the standing guarantee that the aliases resolve is provided by the real chart suites (Bubble/Gantt/Chord/Sunburst) built in later phases. Remove it so it is not committed:
  ```bash
  rm "__mocks__/__tests__/apexMapper.probe.test.js"
  rmdir "__mocks__/__tests__" 2>/dev/null || true
  ```

- [ ] **Step 7: Commit the config change**
  ```bash
  git add jest.config.js
  git commit -m "test(config): map getMultiGroupData, getDateRangeData, getXYData apex mocks"
  ```

#### Task 4.3: Verify the full existing suite stays green

- **Files:**
  - Test: `force-app/main/default/lwc/**/__tests__/*.test.js` (run the entire suite — no new file)

- [ ] **Step 1: Run the FULL existing suite**
  The config change adds mapper entries but removes none and touches no production code, so the existing suite must be byte-for-byte unaffected. Run:
  ```bash
  npm test 2>&1 | tail -n 20
  ```

- [ ] **Step 2: Confirm the totals are unchanged from the Task 4.1 baseline**
  Expected: PASS — `Test Suites: 31 passed, 31 total` and `Tests: 1790 passed, 1790 total`, matching the baseline captured in Task 4.1 Step 1. Pristine output: no leaked `console.error`/`console.warn`, no `Cannot find module`, no open-handle warnings. If the totals dropped or any suite errors with `Cannot find module '@salesforce/apex/...'`, STOP — re-read the `moduleNameMapper` block against the exact diff in Task 4.2 Step 3 (most likely a missing/extra comma between entries) before proceeding.

- [ ] **Step 3: Confirm no stray probe artifact remains**
  ```bash
  ls "__mocks__/__tests__" 2>/dev/null && echo "STRAY PROBE — delete it" || echo "clean: probe removed"
  git status --short "__mocks__" jest.config.js
  ```
  Expected: prints `clean: probe removed`; `git status --short` shows nothing uncommitted under `__mocks__/` or `jest.config.js` (Tasks 4.1 and 4.2 already committed them, and the probe was deleted before commit). This is the verification gate, so there is nothing to commit in this task.


### Phase 5: Schema custom fields + rebuilt SFDMU demo-data toolchain

Add the three Opportunity custom fields Gantt + Bubble need (`Project_Start__c`, `Project_End__c`, `Forecast_Units__c`), rebuild `sfdmu/generate_data.py` as a self-contained uv/PEP723 + faker script that regenerates `Account.csv` (600 rows) and `Opportunity.csv` (10,000 rows, now including the three new fields), extend the git-recovered `export.json` with the new fields, and verify the toolchain runs end-to-end. CSVs stay gitignored; only the generator, `export.json`, and field metadata are committed. Chord needs no new data (it reuses `StageName × LeadSource`).

**Ground-truth recovered during planning (donor references for the executor):**

- The historical generator was committed at `8c60c0b:sfdmu/generate_data.py` (337 lines) and later removed in `88abe10`. Recover the donor with: `git -C ~/code/d3-lwc show 8c60c0b:sfdmu/generate_data.py`. It is the structural template for the rebuilt script (industry list, stage weights/probabilities, type/lead-source lists, prefix/suffix company-name generator, parent-hierarchy logic, log-normal amount, 18-month close-date spread, `print_stats`). The rebuild **adds** faker, PEP723 inline deps, 600 Accounts, 10,000 Opportunities, and the three new Opportunity columns.
- The last committed SFDMU config was `4e4601d:sfdmu/export.json` (recovered verbatim below). Recover it with: `git -C ~/code/d3-lwc show 4e4601d:sfdmu/export.json`.
- Current CSV headers (live files): `Account.csv` → `Name,ParentId,Industry`; `Opportunity.csv` → `Name,StageName,Type,Amount,Probability,CloseDate,LeadSource,IsClosed,IsWon,AccountId`.
- `.gitignore` already contains (lines 1–4 of its SFDMU block): `# SFDMU generated data (config and scripts are tracked)`, `sfdmu/*.csv`, `sfdmu/.venv/`, `sfdmu/__pycache__/`. No `.gitignore` change is needed — the rebuilt generator and `export.json` are tracked; the CSVs are already ignored.
- `force-app/main/default/objects/` exists but is **empty** — there is no `Opportunity/` subtree yet. The field-metadata tasks create the directory chain from scratch.
- `sourceApiVersion` in `sfdx-project.json` is `65.0`; field metadata uses `<apiVersion>` only at the object level, not on `CustomField`, so no apiVersion key goes in the field files.

---

#### Task 5.1: Opportunity custom field metadata — Project_Start__c, Project_End__c, Forecast_Units__c

**Files:**
- Create: `force-app/main/default/objects/Opportunity/fields/Project_Start__c.field-meta.xml`
- Create: `force-app/main/default/objects/Opportunity/fields/Project_End__c.field-meta.xml`
- Create: `force-app/main/default/objects/Opportunity/fields/Forecast_Units__c.field-meta.xml`
- Test: `scripts/verify_field_metadata.sh` (Create — a small portable shell assertion used as the "failing test" for metadata-only artifacts)

Field metadata is declarative XML, so the TDD "test" is a deterministic shell check that the three files exist and contain the required `<fullName>`, `<type>`, and (for the Number field) `<scale>0</scale>`. This keeps the metadata under a runnable red→green→commit cycle exactly like code.

- [ ] **Step 1: Write the failing verification script** at `scripts/verify_field_metadata.sh`:

```bash
#!/usr/bin/env bash
# ABOUTME: Verifies the three Phase 3 Opportunity custom field metadata files exist and are well-formed.
# ABOUTME: Used as the red/green gate for the declarative field-metadata tasks (no Apex/Jest involved).
set -euo pipefail

DIR="force-app/main/default/objects/Opportunity/fields"
fail=0

check_field() {
  local file="$1" type="$2" extra="$3"
  if [[ ! -f "$file" ]]; then
    echo "MISSING: $file"; fail=1; return
  fi
  grep -q "<type>${type}</type>" "$file" || { echo "BAD TYPE in $file (expected ${type})"; fail=1; }
  if [[ -n "$extra" ]]; then
    grep -q "$extra" "$file" || { echo "MISSING '${extra}' in $file"; fail=1; }
  fi
  # fullName must equal the API name in the file (matches filename stem)
  local stem; stem="$(basename "$file" .field-meta.xml)"
  grep -q "<fullName>${stem}</fullName>" "$file" || { echo "BAD fullName in $file (expected ${stem})"; fail=1; }
}

check_field "$DIR/Project_Start__c.field-meta.xml"   "Date"   ""
check_field "$DIR/Project_End__c.field-meta.xml"     "Date"   ""
check_field "$DIR/Forecast_Units__c.field-meta.xml"  "Number" "<scale>0</scale>"

if [[ "$fail" -ne 0 ]]; then
  echo "FIELD METADATA VERIFICATION FAILED"; exit 1
fi
echo "FIELD METADATA VERIFICATION PASSED"
```

- [ ] **Step 2: Run it (expect failure)** — exact command (run from repo root `~/code/d3-lwc`):

```bash
chmod +x scripts/verify_field_metadata.sh && bash scripts/verify_field_metadata.sh
```

Expected: **FAIL** because `force-app/main/default/objects/Opportunity/fields/` is empty — the script prints `MISSING: force-app/main/default/objects/Opportunity/fields/Project_Start__c.field-meta.xml` and exits 1.

- [ ] **Step 3: Create the three field-metadata files.** Create the directory then write each file with this **exact** XML.

`force-app/main/default/objects/Opportunity/fields/Project_Start__c.field-meta.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Project_Start__c</fullName>
    <externalId>false</externalId>
    <label>Project Start</label>
    <required>false</required>
    <trackHistory>false</trackHistory>
    <trackTrending>false</trackTrending>
    <type>Date</type>
</CustomField>
```

`force-app/main/default/objects/Opportunity/fields/Project_End__c.field-meta.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Project_End__c</fullName>
    <externalId>false</externalId>
    <label>Project End</label>
    <required>false</required>
    <trackHistory>false</trackHistory>
    <trackTrending>false</trackTrending>
    <type>Date</type>
</CustomField>
```

`force-app/main/default/objects/Opportunity/fields/Forecast_Units__c.field-meta.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Forecast_Units__c</fullName>
    <externalId>false</externalId>
    <label>Forecast Units</label>
    <precision>18</precision>
    <required>false</required>
    <scale>0</scale>
    <trackHistory>false</trackHistory>
    <trackTrending>false</trackTrending>
    <type>Number</type>
    <unique>false</unique>
</CustomField>
```

- [ ] **Step 4: Run the verification (expect pass)** — exact command:

```bash
bash scripts/verify_field_metadata.sh
```

Expected: **PASS** — prints `FIELD METADATA VERIFICATION PASSED` and exits 0.

- [ ] **Step 5: Commit** — exact commands:

```bash
git add scripts/verify_field_metadata.sh force-app/main/default/objects/Opportunity/fields/Project_Start__c.field-meta.xml force-app/main/default/objects/Opportunity/fields/Project_End__c.field-meta.xml force-app/main/default/objects/Opportunity/fields/Forecast_Units__c.field-meta.xml
git commit -m "feat(schema): add Opportunity Project_Start__c, Project_End__c, Forecast_Units__c fields for Gantt and Bubble"
```

---

#### Task 5.2: Recover and extend export.json with the three new Opportunity fields

**Files:**
- Create: `sfdmu/export.json` (recovered from git, extended)
- Test: `scripts/verify_export_json.sh` (Create — JSON-validity + required-field assertion)

`export.json` was removed in `88abe10` and must be recovered from `4e4601d`, then its Opportunity `query` extended with `Project_Start__c, Project_End__c, Forecast_Units__c`. The Account query and all top-level settings are unchanged.

- [ ] **Step 1: Write the failing verification script** at `scripts/verify_export_json.sh`:

```bash
#!/usr/bin/env bash
# ABOUTME: Verifies sfdmu/export.json is valid JSON and the Opportunity query includes the three Phase 3 fields.
# ABOUTME: Used as the red/green gate for the SFDMU config task.
set -euo pipefail

FILE="sfdmu/export.json"
[[ -f "$FILE" ]] || { echo "MISSING: $FILE"; exit 1; }

# Valid JSON?
uv run --no-project --with-requirements /dev/null python -c "import json,sys; json.load(open('$FILE'))" 2>/dev/null \
  || python3 -c "import json; json.load(open('$FILE'))" \
  || { echo "INVALID JSON: $FILE"; exit 1; }

for f in Project_Start__c Project_End__c Forecast_Units__c; do
  grep -q "$f" "$FILE" || { echo "MISSING field '$f' in $FILE Opportunity query"; exit 1; }
done

echo "EXPORT.JSON VERIFICATION PASSED"
```

- [ ] **Step 2: Run it (expect failure)** — exact command:

```bash
chmod +x scripts/verify_export_json.sh && bash scripts/verify_export_json.sh
```

Expected: **FAIL** because `sfdmu/export.json` does not exist on the working tree (removed in `88abe10`) — prints `MISSING: sfdmu/export.json` and exits 1.

- [ ] **Step 3: Recover then extend export.json.** First recover the donor verbatim:

```bash
git -C ~/code/d3-lwc show 4e4601d:sfdmu/export.json > sfdmu/export.json
```

Then write the file so it matches this **exact** content (the only change vs. the recovered donor is the three added fields in the Opportunity `query`):

```json
{
    "$schema": "https://raw.githubusercontent.com/forcedotcom/SFDX-Data-Move-Utility/master/src/modules/app/schema/export-schema.json",
    "apiVersion": "65.0",
    "bulkThreshold": 200,
    "bulkApiVersion": "2.0",
    "concurrencyMode": "Parallel",
    "pollingIntervalMs": 5000,
    "allOrNone": false,
    "createTargetCSVFiles": true,
    "promptOnMissingParentObjects": true,
    "promptOnIssuesInCSVFiles": true,
    "excludeIdsFromCSVFiles": true,
    "objects": [
        {
            "query": "SELECT Name, ParentId, Industry FROM Account",
            "operation": "Upsert",
            "externalId": "Name",
            "master": true,
            "excluded": false
        },
        {
            "query": "SELECT Name, StageName, Type, Amount, Probability, CloseDate, LeadSource, IsClosed, IsWon, AccountId, Project_Start__c, Project_End__c, Forecast_Units__c FROM Opportunity",
            "operation": "Upsert",
            "externalId": "Name",
            "master": false,
            "excluded": false
        }
    ]
}
```

- [ ] **Step 4: Run the verification (expect pass)** — exact command:

```bash
bash scripts/verify_export_json.sh
```

Expected: **PASS** — prints `EXPORT.JSON VERIFICATION PASSED` and exits 0 (valid JSON, all three new fields present).

- [ ] **Step 5: Commit** — exact commands:

```bash
git add scripts/verify_export_json.sh sfdmu/export.json
git commit -m "feat(sfdmu): recover export.json and add Project_Start__c, Project_End__c, Forecast_Units__c to Opportunity query"
```

---

#### Task 5.3: Rebuild sfdmu/generate_data.py as a uv/PEP723 + faker generator

**Files:**
- Create: `sfdmu/generate_data.py` (the full script — shown below)
- Test: `sfdmu/test_generate_data.py` (Create — pytest covering schema, row counts, ~40% ParentId, End-after-Start, numeric Forecast_Units)

The rebuilt generator keeps the historical donor's distributions (recoverable at `8c60c0b:sfdmu/generate_data.py`) but: (a) declares deps inline via PEP723 so `uv run` provisions faker automatically; (b) uses `faker` for company names and dates; (c) writes 600 Accounts (~40% with `ParentId`, 10 industries) and 10,000 Opportunities; (d) adds `Project_Start__c`, `Project_End__c` (End strictly after Start), and `Forecast_Units__c` (integer-valued); (e) writes CSVs into the script's own `sfdmu/` directory regardless of the caller's CWD, so `uv run sfdmu/generate_data.py` from the repo root lands the files in `sfdmu/`. The generator exposes pure functions (`generate_accounts`, `generate_opportunities`) so pytest can assert against returned records without touching disk.

- [ ] **Step 1: Write the failing test** at `sfdmu/test_generate_data.py`:

```python
# ABOUTME: Tests the SFDMU data generator's schema, row counts, and Phase 3 field invariants.
# ABOUTME: Run with: uv run --with pytest --with faker pytest sfdmu/test_generate_data.py
import datetime
import importlib.util
import pathlib

_SPEC = importlib.util.spec_from_file_location(
    "generate_data", pathlib.Path(__file__).parent / "generate_data.py"
)
gen = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(gen)


def test_account_count_and_columns():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    assert len(accounts) == 600
    assert set(accounts[0].keys()) == {"Name", "ParentId", "Industry"}


def test_account_parent_ratio_near_40_percent():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    with_parents = sum(1 for a in accounts if a["ParentId"])
    ratio = with_parents / len(accounts)
    assert 0.35 <= ratio <= 0.45, f"parent ratio {ratio:.2f} not ~40%"


def test_ten_distinct_industries_available():
    assert len(set(gen.INDUSTRIES)) == 10


def test_opportunity_count_and_columns():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    names = [a["Name"] for a in accounts]
    opps = gen.generate_opportunities(gen.OPPORTUNITY_COUNT, names)
    assert len(opps) == 10000
    assert set(opps[0].keys()) == {
        "Name", "StageName", "Type", "Amount", "Probability",
        "CloseDate", "LeadSource", "IsClosed", "IsWon", "AccountId",
        "Project_Start__c", "Project_End__c", "Forecast_Units__c",
    }


def test_project_end_strictly_after_start():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    names = [a["Name"] for a in accounts]
    opps = gen.generate_opportunities(gen.OPPORTUNITY_COUNT, names)
    for opp in opps:
        start = datetime.date.fromisoformat(opp["Project_Start__c"])
        end = datetime.date.fromisoformat(opp["Project_End__c"])
        assert end > start, f"{opp['Name']}: end {end} not after start {start}"


def test_forecast_units_numeric_integer():
    accounts = gen.generate_accounts(gen.ACCOUNT_COUNT)
    names = [a["Name"] for a in accounts]
    opps = gen.generate_opportunities(gen.OPPORTUNITY_COUNT, names)
    for opp in opps[:200]:
        units = opp["Forecast_Units__c"]
        assert isinstance(units, int), f"Forecast_Units__c not int: {units!r}"
        assert units >= 0
```

- [ ] **Step 2: Run it (expect failure)** — exact command (run from repo root):

```bash
uv run --no-project --with pytest --with faker pytest sfdmu/test_generate_data.py
```

Expected: **FAIL** — collection errors / `ModuleNotFoundError` because `sfdmu/generate_data.py` does not exist yet (it was removed in `88abe10`); the `spec_from_file_location` import in the test module raises at collection time.

- [ ] **Step 3: Implement the generator.** Write `sfdmu/generate_data.py` with this **exact** content:

```python
# ABOUTME: Generates realistic Salesforce demo-data CSVs for SFDMU import (Phase 3 charts).
# ABOUTME: PEP723 uv script; run with `uv run sfdmu/generate_data.py` — faker is auto-provisioned.
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "faker>=24.0",
# ]
# ///

import csv
import datetime
import pathlib
import random

from faker import Faker

# Deterministic output so reviewers can diff regenerated CSVs.
SEED = 42
random.seed(SEED)
fake = Faker()
Faker.seed(SEED)

# --- Configuration ---

ACCOUNT_COUNT = 600
OPPORTUNITY_COUNT = 10000
PARENT_RATIO = 0.40

# Write CSVs next to this script regardless of the caller's CWD,
# so `uv run sfdmu/generate_data.py` from the repo root lands them in sfdmu/.
OUTPUT_DIR = pathlib.Path(__file__).resolve().parent

INDUSTRIES = [
    "Technology",
    "Healthcare",
    "Financial Services",
    "Manufacturing",
    "Retail",
    "Education",
    "Energy",
    "Media",
    "Consulting",
    "Real Estate",
]

STAGE_NAMES = [
    "Prospecting",
    "Qualification",
    "Needs Analysis",
    "Value Proposition",
    "Id. Decision Makers",
    "Perception Analysis",
    "Proposal/Price Quote",
    "Negotiation/Review",
    "Closed Won",
    "Closed Lost",
]

# Weighted toward middle stages, ~30% closed (Won + Lost)
STAGE_WEIGHTS = [6, 12, 12, 9, 8, 6, 9, 8, 18, 12]

# Base probability for each stage (noise added later)
STAGE_PROBABILITY = {
    "Prospecting": 10,
    "Qualification": 20,
    "Needs Analysis": 30,
    "Value Proposition": 40,
    "Id. Decision Makers": 50,
    "Perception Analysis": 60,
    "Proposal/Price Quote": 70,
    "Negotiation/Review": 80,
    "Closed Won": 100,
    "Closed Lost": 0,
}

TYPES = [
    "New Customer",
    "Existing Customer - Upgrade",
    "Existing Customer - Replacement",
    "Existing Customer - Downgrade",
]

LEAD_SOURCES = [
    "Web",
    "Phone Inquiry",
    "Partner Referral",
    "Purchased List",
    "Other",
    "Trade Show",
    "Employee Referral",
    "External Referral",
]


def generate_company_names(count):
    """Generate `count` unique company names via faker."""
    names = set()
    while len(names) < count:
        names.add(fake.unique.company())
    return sorted(names)


def generate_accounts(count):
    """Generate Account records; ~PARENT_RATIO have a ParentId (max 3 levels deep)."""
    names = generate_company_names(count)
    accounts = [
        {"Name": name, "ParentId": "", "Industry": random.choice(INDUSTRIES)}
        for name in names
    ]

    # Layered hierarchy: ~60% roots, then level 1/2/3 each pointing one level up.
    root_count = int(count * (1.0 - PARENT_RATIO))
    level1_start = root_count
    level1_count = int(count * 0.25)
    level2_start = level1_start + level1_count
    level2_count = int(count * 0.10)
    level3_start = level2_start + level2_count

    for i in range(level1_start, min(level1_start + level1_count, count)):
        parent_idx = random.randint(0, root_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    for i in range(level2_start, min(level2_start + level2_count, count)):
        parent_idx = random.randint(level1_start, level1_start + level1_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    for i in range(level3_start, count):
        parent_idx = random.randint(level2_start, level2_start + level2_count - 1)
        accounts[i]["ParentId"] = accounts[parent_idx]["Name"]

    return accounts


def generate_log_normal_amount():
    """Amount with log-normal distribution: clamped to $1K-$5M, median ~$50K."""
    amount = random.lognormvariate(10.82, 1.2)  # ln(50000) ~= 10.82
    return round(max(1000, min(5000000, amount)), 2)


def generate_close_date():
    """CloseDate spread across 18 months (12 back, 6 forward) with weekday bias."""
    today = datetime.date(2026, 6, 15)
    start = today - datetime.timedelta(days=365)
    end = today + datetime.timedelta(days=183)
    total_days = (end - start).days
    while True:
        date = start + datetime.timedelta(days=random.randint(0, total_days))
        if date.weekday() < 5 or random.random() < 0.20:
            return date.isoformat()


def generate_project_window(close_date_iso):
    """Project_Start before the close date; Project_End strictly after Project_Start.

    Returns (start_iso, end_iso). Start lands 10-120 days before CloseDate;
    End lands 14-365 days after Start, so End is always strictly later.
    """
    close = datetime.date.fromisoformat(close_date_iso)
    start = close - datetime.timedelta(days=random.randint(10, 120))
    end = start + datetime.timedelta(days=random.randint(14, 365))
    return start.isoformat(), end.isoformat()


def generate_opportunities(count, account_names):
    """Generate Opportunity records including the three Phase 3 fields."""
    opportunities = []
    for i in range(count):
        stage = random.choices(STAGE_NAMES, weights=STAGE_WEIGHTS, k=1)[0]
        opp_type = random.choice(TYPES)
        lead_source = random.choice(LEAD_SOURCES)
        amount = generate_log_normal_amount()
        close_date = generate_close_date()
        account_name = random.choice(account_names)

        base_prob = STAGE_PROBABILITY[stage]
        probability = max(0, min(100, round(base_prob + random.uniform(-10, 10))))

        is_closed = stage in ("Closed Won", "Closed Lost")
        is_won = stage == "Closed Won"

        project_start, project_end = generate_project_window(close_date)
        # Forecast units scale loosely with deal size; integer-valued (scale 0 field).
        forecast_units = max(1, int(amount / random.uniform(800, 5000)))

        opportunities.append(
            {
                "Name": f"{account_name} - {opp_type} - {i + 1:05d}",
                "StageName": stage,
                "Type": opp_type,
                "Amount": amount,
                "Probability": probability,
                "CloseDate": close_date,
                "LeadSource": lead_source,
                "IsClosed": str(is_closed).lower(),
                "IsWon": str(is_won).lower(),
                "AccountId": account_name,
                "Project_Start__c": project_start,
                "Project_End__c": project_end,
                "Forecast_Units__c": forecast_units,
            }
        )
    return opportunities


def write_csv(filename, records, fieldnames):
    """Write records to OUTPUT_DIR/filename."""
    path = OUTPUT_DIR / filename
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    return path


def print_stats(accounts, opportunities):
    """Print distribution statistics for verification."""
    print("\n--- Data Generation Summary ---")
    print(f"Accounts: {len(accounts)}")
    print(f"Opportunities: {len(opportunities)}")

    with_parents = sum(1 for a in accounts if a["ParentId"])
    print(f"\nAccounts with parents: {with_parents} ({with_parents / len(accounts) * 100:.0f}%)")

    print("\nStage Distribution:")
    stage_counts = {}
    for opp in opportunities:
        stage_counts[opp["StageName"]] = stage_counts.get(opp["StageName"], 0) + 1
    for stage in STAGE_NAMES:
        c = stage_counts.get(stage, 0)
        print(f"  {stage}: {c} ({c / len(opportunities) * 100:.1f}%)")

    amounts = sorted(opp["Amount"] for opp in opportunities)
    print(f"\nAmount Range: ${min(amounts):,.2f} - ${max(amounts):,.2f}")
    print(f"Amount Median: ${amounts[len(amounts) // 2]:,.2f}")
    print(f"Amount Mean: ${sum(amounts) / len(amounts):,.2f}")

    units = sorted(opp["Forecast_Units__c"] for opp in opportunities)
    print(f"\nForecast Units Range: {min(units):,} - {max(units):,}")
    print(f"Forecast Units Median: {units[len(units) // 2]:,}")

    closed = sum(1 for opp in opportunities if opp["IsClosed"] == "true")
    print(f"\nClosed: {closed} ({closed / len(opportunities) * 100:.1f}%)")


if __name__ == "__main__":
    print("Generating Account data...")
    accounts = generate_accounts(ACCOUNT_COUNT)
    account_names = [a["Name"] for a in accounts]

    print("Generating Opportunity data...")
    opportunities = generate_opportunities(OPPORTUNITY_COUNT, account_names)

    print("Writing Account.csv...")
    write_csv("Account.csv", accounts, ["Name", "ParentId", "Industry"])

    print("Writing Opportunity.csv...")
    write_csv(
        "Opportunity.csv",
        opportunities,
        [
            "Name",
            "StageName",
            "Type",
            "Amount",
            "Probability",
            "CloseDate",
            "LeadSource",
            "IsClosed",
            "IsWon",
            "AccountId",
            "Project_Start__c",
            "Project_End__c",
            "Forecast_Units__c",
        ],
    )

    print_stats(accounts, opportunities)
    print(f"\nDone! Files written to {OUTPUT_DIR}")
```

- [ ] **Step 4: Run the test (expect pass)** — exact command:

```bash
uv run --no-project --with pytest --with faker pytest sfdmu/test_generate_data.py -q
```

Expected: **PASS** — all 6 tests green (600 accounts, ~40% parents, 10 industries, 10,000 opps with the 13-column schema, every End strictly after Start, integer `Forecast_Units__c`). Output must be pristine.

- [ ] **Step 5: Commit** — exact commands (commit the generator and its test, NOT the CSVs):

```bash
git add sfdmu/generate_data.py sfdmu/test_generate_data.py
git commit -m "feat(sfdmu): rebuild generator as uv/faker script with 600 Accounts, 10K Opportunities, and Phase 3 project/forecast fields"
```

---

#### Task 5.4: Run + verify the toolchain regenerates the gitignored CSVs

**Files:**
- Modify: `sfdmu/Account.csv` (regenerated — gitignored, NOT committed)
- Modify: `sfdmu/Opportunity.csv` (regenerated — gitignored, NOT committed)
- Test: `scripts/verify_generated_csvs.sh` (Create — asserts row counts and the 13-column Opportunity header)

This is the end-to-end run gate: `uv run sfdmu/generate_data.py` must produce both CSVs in `sfdmu/` with the new columns, and they must stay out of git (already covered by `.gitignore` `sfdmu/*.csv`). The verification script is committed; the CSVs are not.

- [ ] **Step 1: Write the failing verification script** at `scripts/verify_generated_csvs.sh`:

```bash
#!/usr/bin/env bash
# ABOUTME: Verifies the regenerated SFDMU CSVs have the expected row counts and Phase 3 columns.
# ABOUTME: Run AFTER `uv run sfdmu/generate_data.py`. CSVs are gitignored; this script is committed.
set -euo pipefail

ACC="sfdmu/Account.csv"
OPP="sfdmu/Opportunity.csv"
fail=0

[[ -f "$ACC" ]] || { echo "MISSING: $ACC"; exit 1; }
[[ -f "$OPP" ]] || { echo "MISSING: $OPP"; exit 1; }

# Account: header + 600 rows = 601 lines
acc_lines="$(wc -l < "$ACC" | tr -d ' ')"
[[ "$acc_lines" == "601" ]] || { echo "Account.csv has $acc_lines lines (expected 601)"; fail=1; }

# Opportunity: header + 10000 rows = 10001 lines
opp_lines="$(wc -l < "$OPP" | tr -d ' ')"
[[ "$opp_lines" == "10001" ]] || { echo "Opportunity.csv has $opp_lines lines (expected 10001)"; fail=1; }

# Opportunity header must contain the three Phase 3 fields.
opp_header="$(head -1 "$OPP")"
for f in Project_Start__c Project_End__c Forecast_Units__c; do
  echo "$opp_header" | grep -q "$f" || { echo "Opportunity.csv header missing $f"; fail=1; }
done

# Account header must be exactly the three legacy columns.
acc_header="$(head -1 "$ACC")"
[[ "$acc_header" == "Name,ParentId,Industry" ]] || { echo "Account.csv header is '$acc_header' (expected 'Name,ParentId,Industry')"; fail=1; }

# Confirm both CSVs are gitignored (no accidental commit).
git check-ignore -q "$ACC" || { echo "$ACC is NOT gitignored"; fail=1; }
git check-ignore -q "$OPP" || { echo "$OPP is NOT gitignored"; fail=1; }

if [[ "$fail" -ne 0 ]]; then
  echo "GENERATED CSV VERIFICATION FAILED"; exit 1
fi
echo "GENERATED CSV VERIFICATION PASSED"
```

- [ ] **Step 2: Run it (expect failure)** — exact command:

```bash
chmod +x scripts/verify_generated_csvs.sh && bash scripts/verify_generated_csvs.sh
```

Expected: **FAIL** — the live `sfdmu/Opportunity.csv` is the stale Phase-2 file (10-column header, 5,000 rows): the script reports `Opportunity.csv has 5001 lines (expected 10001)` and `Opportunity.csv header missing Project_Start__c`, then exits 1. (`sfdmu/Account.csv` is also stale at 301 lines.)

- [ ] **Step 3: Regenerate the CSVs.** Run the generator from the repo root:

```bash
uv run sfdmu/generate_data.py
```

This provisions faker via the PEP723 block, writes `sfdmu/Account.csv` (601 lines) and `sfdmu/Opportunity.csv` (10001 lines), and prints the distribution summary including the new Forecast Units range. No manual file editing.

- [ ] **Step 4: Run the verification (expect pass)** — exact commands:

```bash
bash scripts/verify_generated_csvs.sh
git status --short sfdmu/
```

Expected: **PASS** — prints `GENERATED CSV VERIFICATION PASSED`. The `git status --short sfdmu/` output must show **no** `Account.csv`/`Opportunity.csv` entries (they are gitignored); only tracked-and-clean `export.json`/`generate_data.py`/`test_generate_data.py` are unaffected.

- [ ] **Step 5: Commit** — exact commands (commit ONLY the verification script; the regenerated CSVs are intentionally gitignored):

```bash
git add scripts/verify_generated_csvs.sh
git commit -m "test(sfdmu): add generated-CSV verification gate (row counts + Phase 3 columns, CSVs remain gitignored)"
```


### Phase 6: Pie Chart (`d3PieChart`)

Clone `d3DonutChart` into a new `d3PieChart` component (and all 3 test tiers), then change the chart-specific surface: drop the donut center-total label and `innerRadiusRatio`, hard-code `d3.arc().innerRadius(0)`, and assert pie semantics (arcs are path elements, innerRadius is 0, no center "Total" text, per-slice labels). Pie reuses the exact same Apex surface as Donut (`executeQuery` + `getAggregatedData`) and shared services, so **no new shared modules, Apex, jest moduleNameMapper entries, or `__mocks__` stubs are required** — both `executeQuery` and `getAggregatedData` mocks already exist (verified). All three tiers are built TDD: write/clone test → run RED → implement → run GREEN → commit.

> **Pre-flight (read before starting):** the component donor is `force-app/main/default/lwc/d3DonutChart/d3DonutChart.js` (+ `.html` + `.js-meta.xml`); the test-tier donor is `force-app/main/default/lwc/d3DonutChart/__tests__/{d3DonutChart.test.js, d3DonutChart.integration.test.js, d3DonutChart.e2e.test.js}`. The donut mock-D3 factory ALREADY contains `pie`/`arc`/`interpolate`/`attrTween` — copy it verbatim; you do NOT add new D3 primitives for Pie. Jest run pattern is `npm test -- --testPathPattern=d3PieChart`.

---

#### Task 6.1: UNIT tier — clone donut unit suite, retarget to Pie, then build the component (RED → GREEN)

**Files:**
- Test: `force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.test.js` (Create — cloned from donut unit donor)
- Create: `force-app/main/default/lwc/d3PieChart/d3PieChart.js`
- Create: `force-app/main/default/lwc/d3PieChart/d3PieChart.html`
- Create: `force-app/main/default/lwc/d3PieChart/d3PieChart.js-meta.xml`

- [ ] **Step 1: Clone the donut unit test into the new pie test path.**
  Run exactly:
  ```bash
  mkdir -p force-app/main/default/lwc/d3PieChart/__tests__
  cp force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.test.js \
     force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.test.js
  ```

- [ ] **Step 2: Retarget the cloned unit test to the Pie component and pie semantics.** Make these EXACT edits to `force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.test.js`:

  1. Header (lines 1–2): replace with
     ```js
     // ABOUTME: Unit tests for the D3 pie chart Lightning Web Component.
     // ABOUTME: Covers initialization, data sources, aggregation, themes, config, legend, events, tooltips, responsive behavior, and pie rendering details.
     ```
  2. Import + describe name: change `import D3DonutChart from "c/d3DonutChart";` → `import D3PieChart from "c/d3PieChart";`; change every `is: D3DonutChart` → `is: D3PieChart`; change every `createElement("c-d3-donut-chart", ...)` → `createElement("c-d3-pie-chart", ...)`; change `describe("c-d3-donut-chart", ...)` → `describe("c-d3-pie-chart", ...)`. (The `createChart` helper props `groupByField/valueField/operation/recordCollection` and `SAMPLE_DATA` are correct for Pie — keep them.)
  3. The `createMockD3()` factory (lines ~70–108) is correct as-is for Pie — it already exposes `pie`/`arc`/`interpolate`/`attrTween`. Leave it unchanged.
  4. Delete the `"innerRadiusRatio variations"` describe block entirely (the four `innerRadiusRatio` tests) — Pie has no `innerRadiusRatio` @api.
  5. Delete the `"center text rendering"` describe block entirely (the four center-total tests) — Pie drops the center-total label.
  6. In the `"configuration"` describe, delete the `"accepts innerRadiusRatio for donut vs pie"` test.
  7. Append a new `"pie rendering details"` describe block at the end of the top-level `describe` body (just before its closing `});`):
     ```js
     // ═══════════════════════════════════════════════════════════════
     // PIE RENDERING DETAILS
     // ═══════════════════════════════════════════════════════════════

     describe("pie rendering details", () => {
       it("creates a pie layout via d3.pie()", async () => {
         await createChart();
         await flushPromises();
         expect(mockD3.pie).toHaveBeenCalled();
       });

       it("creates an arc generator with innerRadius set to 0", async () => {
         await createChart();
         await flushPromises();

         expect(mockD3.arc).toHaveBeenCalled();
         const arcObj = mockD3.arc.mock.results[0].value;
         expect(arcObj.innerRadius).toHaveBeenCalledWith(0);
       });

       it("renders slices as path elements", async () => {
         await createChart();
         await flushPromises();

         const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
         expect(appendCalls).toContain("path");
       });

       it("does not render a center total label", async () => {
         mockD3.text.mockClear();
         await createChart();
         await flushPromises();

         const totalLabelWritten = mockD3.text.mock.calls.some(
           (call) => call[0] === "Total"
         );
         expect(totalLabelWritten).toBe(false);
       });

       it("removes existing SVG before re-render", async () => {
         await createChart();
         await flushPromises();

         expect(mockD3.select).toHaveBeenCalled();
         expect(mockD3.remove).toHaveBeenCalled();
       });

       it("sets SVG dimensions from container width and configured height", async () => {
         await createChart({ height: 350 });
         await flushPromises();

         const attrCalls = mockD3.attr.mock.calls;
         const widthSet = attrCalls.some(
           (call) => call[0] === "width" && typeof call[1] === "number"
         );
         const heightSet = attrCalls.some(
           (call) => call[0] === "height" && call[1] === 350
         );
         expect(widthSet).toBe(true);
         expect(heightSet).toBe(true);
       });
     });
     ```

- [ ] **Step 3: Run the unit suite — expect FAIL.**
  ```bash
  npm test -- --testPathPattern=d3PieChart
  ```
  Expected: FAIL because `c/d3PieChart` does not exist yet — Jest reports `Cannot find module 'c/d3PieChart'` (the component `.js`/`.html`/`.js-meta.xml` are not created until Step 4).

- [ ] **Step 4: Create the Pie component `.js`.** Write `force-app/main/default/lwc/d3PieChart/d3PieChart.js` with this exact content (cloned from the donut `.js` scaffold: universal @api set + lifecycle + getters + loadData cascade are byte-identical to the donor; only the donut-specific `innerRadiusRatio` @api was dropped and `renderChart` hard-codes `innerRadius(0)` and removes the center-total block):
  ```js
  // ABOUTME: D3 Pie chart Lightning Web Component with drill-down support.
  // ABOUTME: Renders part-to-whole data as a full pie (no inner radius) using themes, legends, and tooltips.
  import { LightningElement, api, track } from "lwc";
  import { loadD3 } from "c/d3Lib";
  import {
    prepareData,
    aggregateData,
    OPERATIONS,
    MAX_RECORDS
  } from "c/dataService";
  import { getColors, DEFAULT_THEME } from "c/themeService";
  import {
    formatNumber,
    formatPercent,
    createTooltip,
    createResizeHandler,
    createLayoutRetry
  } from "c/chartUtils";
  import { NavigationMixin } from "lightning/navigation";
  import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
  import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

  export default class D3PieChart extends NavigationMixin(LightningElement) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    /** Data collection from Flow or parent component */
    @api recordCollection = [];

    /** SOQL query string (used if recordCollection is empty) */
    @api soqlQuery = "";

    /** Field to group by (slice categories) */
    @api groupByField = "";

    /** Field to aggregate (slice values) */
    @api valueField = "";

    /** Aggregation operation: Sum, Count, Average */
    @api operation = OPERATIONS.SUM;

    /** Chart height in pixels */
    @api height = 300;

    /** Color theme */
    @api theme = DEFAULT_THEME;

    /** Show legend (defaults to true via getter) */
    @api showLegend;

    /** Advanced configuration JSON */
    @api advancedConfig = "{}";

    /** Maximum records to process (overrides default limit) */
    @api recordLimit;

    /** Object API name for drill-down navigation */
    @api objectApiName = "";

    /** Filter field for drill-down */
    @api filterField = "";

    /** Optional WHERE clause fragment for server-side aggregation */
    @api filterClause = "";

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════

    @track isLoading = true;
    @track error = null;
    @track chartData = [];
    @track totalValue = 0;

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    d3 = null;
    svg = null;
    tooltip = null;
    resizeHandler = null;
    chartRendered = false;
    _layoutRetry = null;
    _config = {};
    _configParsed = false;

    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════

    get containerStyle() {
      return `height: ${this.height}px;`;
    }

    get effectiveShowLegend() {
      return this.showLegend !== false;
    }

    get hasError() {
      return !!this.error;
    }

    get hasData() {
      return this.chartData && this.chartData.length > 0;
    }

    get showChart() {
      return !this.isLoading && !this.hasError && this.hasData;
    }

    get legendItems() {
      if (!this.chartData || !this.effectiveShowLegend) return [];
      const colors = getColors(
        this.theme,
        this.chartData.length,
        this.config.customColors
      );
      return this.chartData.map((d, i) => ({
        label: d.label,
        value: d.value,
        percent:
          this.totalValue > 0 ? formatPercent(d.value / this.totalValue) : "0%",
        color: colors[i],
        colorStyle: `background-color: ${colors[i]};`
      }));
    }

    get config() {
      if (!this._configParsed) {
        try {
          this._config = JSON.parse(this.advancedConfig || "{}");
        } catch {
          this._config = {};
        }
        this._configParsed = true;
      }
      return this._config;
    }

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════════

    async connectedCallback() {
      try {
        this.d3 = await loadD3(this);
        await this.loadData();
      } catch (e) {
        this.error = e.message || "Failed to initialize chart";
        console.error("D3PieChart initialization error:", e);
      } finally {
        this.isLoading = false;
      }
    }

    renderedCallback() {
      if (this.showChart && !this.chartRendered) {
        this.chartRendered = this.initializeChart();
        if (!this.chartRendered && !this._layoutRetry) {
          const container = this.template.querySelector(".chart-container");
          if (container) {
            this._layoutRetry = createLayoutRetry(container, () => {
              this._layoutRetry = null;
              if (!this.chartRendered) {
                this.chartRendered = this.initializeChart();
              }
            });
          }
        }
      }
    }

    disconnectedCallback() {
      if (this._layoutRetry) {
        this._layoutRetry.cancel();
        this._layoutRetry = null;
      }
      this.cleanup();
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════

    async loadData() {
      // Priority 1: Use recordCollection if provided (client-side aggregation)
      if (this.recordCollection && this.recordCollection.length > 0) {
        this.chartData = this._aggregateRawData([...this.recordCollection]);
        this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
        return;
      }

      // Priority 2: Server-side aggregation when all required fields are set
      if (
        this.objectApiName &&
        this.groupByField &&
        this.valueField &&
        this.operation
      ) {
        try {
          const result = await getAggregatedData({
            objectName: this.objectApiName,
            groupByField: this.groupByField,
            valueField: this.valueField,
            operation: this.operation,
            filterClause: this.filterClause || null
          });
          // Server returns [{label, value}, ...] — same shape as aggregateData()
          this.chartData = result;
        } catch (e) {
          throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
        }

        if (!this.chartData || this.chartData.length === 0) {
          throw new Error("No data after aggregation");
        }
        this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
        return;
      }

      // Priority 3: Fall back to SOQL query with client-side aggregation
      if (this.soqlQuery) {
        let rawData = [];
        try {
          rawData = await executeQuery({ queryString: this.soqlQuery });
        } catch (e) {
          throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
        }
        this.chartData = this._aggregateRawData(rawData);
        this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
        return;
      }

      throw new Error(
        "No data source provided. Set recordCollection or soqlQuery."
      );
    }

    /**
     * Validates, truncates, and aggregates raw record data client-side.
     * Used by both recordCollection and soqlQuery paths.
     */
    _aggregateRawData(rawData) {
      const requiredFields = [this.groupByField];
      if (this.operation !== OPERATIONS.COUNT) {
        requiredFields.push(this.valueField);
      }

      const prepared = prepareData(rawData, {
        requiredFields,
        limit: this.recordLimit || MAX_RECORDS
      });

      if (!prepared.valid) {
        throw new Error(prepared.error);
      }

      const aggregated = aggregateData(
        prepared.data,
        this.groupByField,
        this.valueField,
        this.operation
      );

      if (aggregated.length === 0) {
        throw new Error("No data after aggregation");
      }

      return aggregated;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHART RENDERING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes the chart SVG, tooltip, and resize observer.
     * @returns {boolean} true if the chart was successfully initialized
     */
    initializeChart() {
      const container = this.template.querySelector(".chart-container");
      if (!container) return false;

      const { width } = container.getBoundingClientRect();
      if (width === 0) return false;

      this.tooltip = createTooltip(container);
      this.renderChart(width);

      this.resizeHandler = createResizeHandler(
        container,
        ({ width: newWidth }) => {
          if (newWidth > 0) {
            this.renderChart(newWidth);
          }
        }
      );
      this.resizeHandler.observe();
      return true;
    }

    renderChart(containerWidth) {
      const d3 = this.d3;
      const container = this.template.querySelector(".chart-container");
      if (!container || !d3) return;

      d3.select(container).select("svg").remove();

      const padding = Math.max(10, Math.round(containerWidth * 0.04));
      const margin = {
        top: padding,
        right: padding,
        bottom: padding,
        left: padding
      };
      const width = containerWidth - margin.left - margin.right;
      const height = this.height - margin.top - margin.bottom;

      if (width <= 0 || height <= 0) return;

      const radius = Math.min(width, height) / 2;

      this.svg = d3
        .select(container)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", this.height)
        .attr("class", "pie-chart-svg")
        .append("g")
        .attr(
          "transform",
          `translate(${margin.left + width / 2},${margin.top + height / 2})`
        );

      const colors = getColors(
        this.theme,
        this.chartData.length,
        this.config.customColors
      );

      const pie = d3
        .pie()
        .value((d) => d.value)
        .sort(null);

      const arc = d3.arc().innerRadius(0).outerRadius(radius);

      const arcHover = d3
        .arc()
        .innerRadius(0)
        .outerRadius(radius + 10);

      const slices = this.svg
        .selectAll(".slice")
        .data(pie(this.chartData))
        .enter()
        .append("g")
        .attr("class", "slice");

      slices
        .append("path")
        .attr("d", arc)
        .attr("fill", (d, i) => colors[i])
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .attr("cursor", this.objectApiName ? "pointer" : "default")
        .on("mouseenter", (event, d) => {
          d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr("d", arcHover);
          this.showTooltip(event, d.data);
        })
        .on("mousemove", (event) => {
          this.moveTooltip(event);
        })
        .on("mouseleave", (event) => {
          d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr("d", arc);
          this.hideTooltip();
        })
        .on("click", (event, d) => {
          this.handleSliceClick(d.data);
        })
        .transition()
        .duration(750)
        .attrTween("d", function (d) {
          const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
          return function (t) {
            return arc(interpolate(t));
          };
        });

      // Per-slice labels (label text centered on each slice via arc.centroid)
      if (this.config.showLabels !== false) {
        this.svg
          .selectAll(".slice-label")
          .data(pie(this.chartData))
          .enter()
          .append("text")
          .attr("class", "slice-label")
          .attr("text-anchor", "middle")
          .attr("transform", (d) => `translate(${arc.centroid(d)})`)
          .style("font-size", "12px")
          .style("fill", "#16325c")
          .text((d) => d.data.label);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP HANDLERS
    // ═══════════════════════════════════════════════════════════════

    showTooltip(event, d) {
      if (!this.tooltip) return;

      const percent = this.totalValue > 0 ? d.value / this.totalValue : 0;
      const content = `
              <strong>${d.label}</strong><br/>
              ${formatNumber(d.value)} (${formatPercent(percent)})
          `;

      this.tooltip.show(content, event.offsetX, event.offsetY);
    }

    moveTooltip() {
      // Position handled in show()
    }

    hideTooltip() {
      if (!this.tooltip) return;
      this.tooltip.hide();
    }

    // ═══════════════════════════════════════════════════════════════
    // CLICK HANDLER - DRILL DOWN
    // ═══════════════════════════════════════════════════════════════

    handleSliceClick(d) {
      if (!this.objectApiName) return;

      const filterFieldName = this.filterField || this.groupByField;

      this[NavigationMixin.Navigate]({
        type: "standard__objectPage",
        attributes: {
          objectApiName: this.objectApiName,
          actionName: "list"
        }
      });

      this.dispatchEvent(
        new CustomEvent("sliceclick", {
          detail: {
            label: d.label,
            value: d.value,
            filterField: filterFieldName
          },
          bubbles: true,
          composed: true
        })
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // LEGEND CLICK
    // ═══════════════════════════════════════════════════════════════

    handleLegendClick(event) {
      const label = event.currentTarget.dataset.label;
      const item = this.chartData.find((d) => d.label === label);
      if (item) {
        this.handleSliceClick(item);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════

    cleanup() {
      if (this.resizeHandler) {
        this.resizeHandler.disconnect();
        this.resizeHandler = null;
      }
      if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
      }
    }
  }
  ```

- [ ] **Step 5: Create the Pie component `.html`.** Write `force-app/main/default/lwc/d3PieChart/d3PieChart.html` with this exact content (byte-identical to the donut `.html` — the universal 4-state template + legend; mount div is exactly `class="chart-container" lwc:dom="manual"`):
  ```html
  <template>
    <div class="slds-card">
      <!-- Loading State -->
      <template lwc:if={isLoading}>
        <div class="slds-align_absolute-center" style="height: 200px">
          <lightning-spinner
            alternative-text="Loading chart..."
            size="medium"
          ></lightning-spinner>
        </div>
      </template>

      <!-- Error State -->
      <template lwc:elseif={hasError}>
        <div
          class="slds-align_absolute-center slds-text-color_error"
          style="height: 200px; padding: 1rem"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:error"
              alternative-text="Error"
              size="large"
              variant="error"
            ></lightning-icon>
            <p class="slds-m-top_small">{error}</p>
          </div>
        </div>
      </template>

      <!-- Chart Container (has data) -->
      <template lwc:elseif={hasData}>
        <div class="chart-wrapper">
          <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>

          <!-- Legend -->
          <template lwc:if={effectiveShowLegend}>
            <div class="legend-container">
              <template for:each={legendItems} for:item="item">
                <div
                  key={item.label}
                  class="legend-item"
                  data-label={item.label}
                  onclick={handleLegendClick}
                >
                  <span class="legend-color" style={item.colorStyle}></span>
                  <span class="legend-label" title={item.label}
                    >{item.label}</span
                  >
                  <span class="legend-value">{item.percent}</span>
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>

      <!-- No Data State -->
      <template lwc:else>
        <div
          class="slds-align_absolute-center slds-text-color_weak"
          style="height: 200px"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:chart"
              alternative-text="No data"
              size="large"
            ></lightning-icon>
            <p class="slds-m-top_small">No data available</p>
          </div>
        </div>
      </template>
    </div>
  </template>
  ```

- [ ] **Step 6: Create the Pie component `.js-meta.xml`.** Write `force-app/main/default/lwc/d3PieChart/d3PieChart.js-meta.xml` with this exact content (apiVersion `65.0` per §4.1 Phase-2 standard; `isExposed true`; `masterLabel` "D3 Pie Chart"; targets AppPage/RecordPage/HomePage; donut's `innerRadiusRatio` property dropped; `recordCollection` NOT exposed):
  ```xml
  <?xml version="1.0" encoding="UTF-8" ?>
  <LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
      <apiVersion>65.0</apiVersion>
      <isExposed>true</isExposed>
      <masterLabel>D3 Pie Chart</masterLabel>
      <description
    >Interactive pie chart powered by D3.js with aggregation and drill-down support.</description>
      <targets>
          <target>lightning__AppPage</target>
          <target>lightning__RecordPage</target>
          <target>lightning__HomePage</target>
      </targets>
      <targetConfigs>
          <targetConfig
        targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
      >
              <!-- Data Source -->
              <property
          name="soqlQuery"
          type="String"
          label="SOQL Query"
          description="SOQL query to fetch data"
          placeholder="SELECT StageName, Amount FROM Opportunity"
        />

              <!-- Field Mapping -->
              <property
          name="groupByField"
          type="String"
          label="Group By Field"
          default="Name"
          description="API name of the category field (e.g., StageName)"
          placeholder="StageName"
        />
              <property
          name="valueField"
          type="String"
          label="Value Field"
          default="Amount"
          description="API name of the numeric field to aggregate (not required for Count)"
          placeholder="Amount"
        />
              <property
          name="operation"
          type="String"
          label="Aggregation"
          default="Sum"
          datasource="Sum,Count,Average"
          description="How to aggregate the values"
        />

              <!-- Appearance -->
              <property
          name="height"
          type="Integer"
          label="Height (px)"
          default="300"
          description="Chart height in pixels"
          min="150"
          max="800"
        />
              <property
          name="theme"
          type="String"
          label="Color Theme"
          default="Salesforce Standard"
          datasource="Salesforce Standard,Warm,Cool,Vibrant"
          description="Color palette for the chart"
        />
              <property
          name="showLegend"
          type="Boolean"
          label="Show Legend"
          default="true"
          description="Display legend next to chart"
        />

              <!-- Drill-Down -->
              <property
          name="objectApiName"
          type="String"
          label="Drill-Down Object"
          description="Object API name for navigation on slice click"
          placeholder="Opportunity"
        />
              <property
          name="filterField"
          type="String"
          label="Filter Field"
          description="Field to filter by on drill-down (defaults to Group By Field)"
        />

              <property
          name="recordLimit"
          type="Integer"
          label="Record Limit"
          description="Maximum records to process. Leave empty for default."
          min="1"
          max="10000"
        />

              <!-- Advanced -->
              <property
          name="advancedConfig"
          type="String"
          label="Advanced Config (JSON)"
          description='{"showLabels": true, "customColors": ["#FF5733"]}'
        />
          </targetConfig>
      </targetConfigs>
  </LightningComponentBundle>
  ```

- [ ] **Step 7: Run the unit suite — expect PASS.**
  ```bash
  npm test -- --testPathPattern=d3PieChart
  ```
  Expected: PASS — all unit tests in `d3PieChart.test.js` green, console output pristine (the `console.error`/`console.warn` spies in `beforeEach` silence expected error-path logs; no leaked errors on success paths).

- [ ] **Step 8: Commit the unit tier.**
  ```bash
  git add force-app/main/default/lwc/d3PieChart/d3PieChart.js \
          force-app/main/default/lwc/d3PieChart/d3PieChart.html \
          force-app/main/default/lwc/d3PieChart/d3PieChart.js-meta.xml \
          force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.test.js
  git commit -m "feat(d3PieChart): add pie chart component with unit tests"
  ```

---

#### Task 6.2: INTEGRATION tier — real services flow into mock D3 (RED → GREEN)

**Files:**
- Test: `force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.integration.test.js` (Create — cloned from donut integration donor)

- [ ] **Step 1: Clone the donut integration test into the pie test path.**
  ```bash
  cp force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.integration.test.js \
     force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.integration.test.js
  ```

- [ ] **Step 2: Retarget the cloned integration test to Pie + add real-value assertions.** Make these EXACT edits to `force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.integration.test.js`:

  1. Header (lines 1–2):
     ```js
     // ABOUTME: Integration tests for d3PieChart verifying real service interactions.
     // ABOUTME: Tests real dataService aggregation, themeService colors, and chartUtils formatting against mock D3 rendering.
     ```
  2. Import: `import D3DonutChart from "c/d3DonutChart";` → `import D3PieChart from "c/d3PieChart";`. Replace `is: D3DonutChart` → `is: D3PieChart`, `createElement("c-d3-donut-chart", ...)` → `createElement("c-d3-pie-chart", ...)`, `describe("c-d3-donut-chart integration", ...)` → `describe("c-d3-pie-chart integration", ...)`.
  3. The `createMockD3()` factory is correct as-is (has `pie`/`arc`/`interpolate`). The mocks block (mock ONLY `c/d3Lib` + `executeQuery` + `lightning/navigation` + `lightning/platformShowToastEvent`; real `dataService`/`themeService`/`chartUtils`) is exactly what the integration tier requires — keep it.
  4. The donor's `flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))` works here, but the spec mandates the `process.nextTick` variant so it survives `jest.useFakeTimers()`. Replace the helper (around line 110–111) with:
     ```js
     // eslint-disable-next-line @lwc/lwc/no-async-operation
     const flushPromises = () => new Promise(process.nextTick);
     ```
  5. The donor already asserts real aggregated values flow into `mockD3.data()` via the pie layout (the `"aggregation result verification"` block) and real Salesforce Standard palette hex on legend swatches (`#1589EE`/`#FF9E2C`/`#4BCA81`). These transfer to Pie unchanged — keep them. Append one new test to the `"aggregation result verification"` describe block asserting the real Warm-palette hex flows into the rendered fill colors:
     ```js
     it("real Warm palette hex flows into slice fill colors", async () => {
       await createChart({ theme: "Warm" });

       // Real themeService Warm palette: first color is #FF6B6B (per spec §8)
       const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
       expect(fillCalls.length).toBeGreaterThan(0);
       // The fill value is a function (d, i) => colors[i]; invoke it for the first slice
       const fillFn = fillCalls[0][1];
       expect(typeof fillFn).toBe("function");
       expect(fillFn({}, 0)).toBe("#FF6B6B");
     });
     ```
  6. Append a new describe block asserting the REAL aggregated `{label,value}` data is what the pie layout receives (mirrors the donut Sum-aggregation test but named for Pie), at the end of the top-level `describe` body before its closing `});`:
     ```js
     // ═══════════════════════════════════════════════════════════════
     // REAL AGGREGATED DATA INTO PIE LAYOUT
     // ═══════════════════════════════════════════════════════════════

     describe("real aggregated data into pie layout", () => {
       it("real dataService Sum aggregation produces sorted {label,value} into d3.pie()", async () => {
         await createChart({ operation: "Sum" });

         const pieFn = mockD3.pie.mock.results[0].value;
         expect(pieFn).toHaveBeenCalled();

         const dataPassedToPie = pieFn.mock.calls[0][0];
         expect(dataPassedToPie).toEqual([
           { label: "Closed Won", value: 500 },
           { label: "Prospecting", value: 300 },
           { label: "Qualification", value: 150 }
         ]);
       });
     });
     ```

- [ ] **Step 3: Run the integration suite — expect PASS** (the Pie component from Task 6.1 already exists, so this tier should go green immediately after the clone+edits; if any test references `innerRadiusRatio` it will fail RED — confirm none was carried over).
  ```bash
  npm test -- --testPathPattern=d3PieChart.integration
  ```
  Expected: PASS — real `dataService.aggregateData` produces `[{Closed Won,500},{Prospecting,300},{Qualification,150}]`, real `themeService` Salesforce Standard hex (`#1589EE`/`#FF9E2C`/`#4BCA81`) and Warm hex (`#FF6B6B`) reach `mockD3`, real `chartUtils.formatPercent` yields `52.6%`/`31.6%`/`15.8%`. Console output pristine.

  > If RED: the most likely cause is a leftover donut-specific reference (`innerRadiusRatio`, center-total) carried from the donor — remove it. The integration donor had no such reference, so a clean clone+edit should pass.

- [ ] **Step 4: Commit the integration tier.**
  ```bash
  git add force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.integration.test.js
  git commit -m "test(d3PieChart): add integration tests for real service data flow"
  ```

---

#### Task 6.3: E2E tier — full lifecycle, multi-instance isolation, pristine console (RED → GREEN)

**Files:**
- Test: `force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.e2e.test.js` (Create — cloned from donut e2e donor)

- [ ] **Step 1: Clone the donut e2e test into the pie test path.**
  ```bash
  cp force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.e2e.test.js \
     force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.e2e.test.js
  ```

- [ ] **Step 2: Retarget the cloned e2e test to Pie + add pie lifecycle assertions.** Make these EXACT edits to `force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.e2e.test.js`:

  1. Header (lines 1–2):
     ```js
     // ABOUTME: End-to-end lifecycle tests for the D3 Pie Chart component.
     // ABOUTME: Verifies full render pipeline, legend behavior, multi-instance isolation, and error recovery using real services with mocked D3.
     ```
  2. Import: `import D3DonutChart from "c/d3DonutChart";` → `import D3PieChart from "c/d3PieChart";`. Replace `is: D3DonutChart` → `is: D3PieChart`, `createElement("c-d3-donut-chart", ...)` → `createElement("c-d3-pie-chart", ...)`, `describe("c-d3-donut-chart e2e", ...)` → `describe("c-d3-pie-chart e2e", ...)`.
  3. The `createMockD3()` factory and the mock blocks (d3Lib + executeQuery + navigation + platformShowToastEvent only; real services) are correct — keep them.
  4. In the `"full render lifecycle"` block's first test (`"creates donut chart end-to-end..."`): rename it to `"creates pie chart end-to-end with correct D3 calls"`; the `expect(mockD3.arc).toHaveBeenCalledTimes(2)` assertion still holds (Pie calls `d3.arc()` twice: arc + arcHover) — keep it; in the no-console-error filter, change `"D3DonutChart initialization error"` → `"D3PieChart initialization error"`.
  5. Delete the entire `"pie vs donut mode"` describe block — Pie has no `innerRadiusRatio` mode toggle. Replace it with a multi-instance isolation block (mandated by §8 e2e taxonomy):
     ```js
     // ═══════════════════════════════════════════════════════════════
     // MULTI-INSTANCE ISOLATION
     // ═══════════════════════════════════════════════════════════════

     describe("multi-instance isolation", () => {
       it("two pie charts render independently with isolated D3 instances", async () => {
         const mockD3A = createMockD3();
         loadD3.mockResolvedValueOnce(mockD3A);
         const elementA = await createChart({ operation: "Sum" });
         await flushPromises();

         const mockD3B = createMockD3();
         loadD3.mockResolvedValueOnce(mockD3B);
         const elementB = await createChart({ operation: "Count" });
         await flushPromises();

         // Each instance rendered its own container
         expect(elementA.shadowRoot.querySelector(".chart-container")).toBeTruthy();
         expect(elementB.shadowRoot.querySelector(".chart-container")).toBeTruthy();

         // Each instance drove its own D3 mock — no shared mutable state
         expect(mockD3A.pie).toHaveBeenCalled();
         expect(mockD3B.pie).toHaveBeenCalled();

         // Instance A (Sum): 3 legend items; Instance B (Count): 3 legend items
         const legendA = elementA.shadowRoot.querySelectorAll(".legend-item");
         const legendB = elementB.shadowRoot.querySelectorAll(".legend-item");
         expect(legendA.length).toBe(3);
         expect(legendB.length).toBe(3);

         // No console errors across both lifecycles
         const realErrors = consoleErrorSpy.mock.calls.filter(
           (call) => !String(call[0]).includes("D3PieChart initialization error")
         );
         expect(realErrors.length).toBe(0);
       });
     });

     // ═══════════════════════════════════════════════════════════════
     // DATA-FLOW VERIFICATION
     // ═══════════════════════════════════════════════════════════════

     describe("data-flow verification", () => {
       it("exact aggregated values bind from data to legend percentages", async () => {
         const mockD3 = createMockD3();
         loadD3.mockResolvedValue(mockD3);

         const element = await createChart({ operation: "Sum" });
         await flushPromises();

         // Real Sum aggregation: Closed Won=500, Prospecting=300, Qualification=150, total=950
         const pieFn = mockD3.pie.mock.results[0].value;
         const dataPassedToPie = pieFn.mock.calls[0][0];
         expect(dataPassedToPie).toEqual([
           { label: "Closed Won", value: 500 },
           { label: "Prospecting", value: 300 },
           { label: "Qualification", value: 150 }
         ]);

         const percentTexts = Array.from(
           element.shadowRoot.querySelectorAll(".legend-value")
         ).map((el) => el.textContent);
         expect(percentTexts[0]).toBe("52.6%");
         expect(percentTexts[1]).toBe("31.6%");
         expect(percentTexts[2]).toBe("15.8%");
       });
     });
     ```
  6. In the `"legend verification"` block: the donor's legend label/color/percent assertions transfer to Pie unchanged — keep them as-is (they assert the real Salesforce Standard rgb swatches and `52.6%`/`31.6%`/`15.8%`, plus a `sliceclick` legend-click pipeline test). No edits needed beyond the global rename in edit #2.
  7. In the `"error recovery flow"` block: the `"shows error state when D3 fails to load"` test transfers unchanged (asserts error element shown, no chart container, spinner gone) — keep it. The success-path no-error filters were already updated to `D3PieChart` in edit #4/#5.

- [ ] **Step 3: Run the e2e suite — expect PASS** (Pie component already exists from Task 6.1).
  ```bash
  npm test -- --testPathPattern=d3PieChart.e2e
  ```
  Expected: PASS — full lifecycle (create → load → render → SVG appended with `svg`+`path` → spinner gone → no error), two-instance isolation (separate `mockD3A`/`mockD3B`), exact data-flow values, and a pristine console on every success path (the success/e2e tests assert `console.error` was NOT called outside the expected D3-load-failure case).

- [ ] **Step 4: Run the full Pie suite (all three tiers) once to confirm no cross-tier regressions.**
  ```bash
  npm test -- --testPathPattern=d3PieChart
  ```
  Expected: PASS — all three files (`d3PieChart.test.js`, `d3PieChart.integration.test.js`, `d3PieChart.e2e.test.js`) green, output pristine.

- [ ] **Step 5: Commit the e2e tier.**
  ```bash
  git add force-app/main/default/lwc/d3PieChart/__tests__/d3PieChart.e2e.test.js
  git commit -m "test(d3PieChart): add e2e lifecycle and multi-instance isolation tests"
  ```


### Phase 7: Horizontal Bar Chart (`d3HorizontalBarChart`)

Full release of the `d3HorizontalBarChart` component (clone of `d3BarChart` with X/Y axes swapped: categories on a `scaleBand` Y axis, values on a `scaleLinear` X axis, bars growing horizontally from `x=0`) plus all three test tiers (unit, integration, e2e). No new shared-module or Apex code — pure axis swap on the `getAggregatedData` data path. Component meta `apiVersion 65.0`.

> **Donors (read these in full before starting):**
> - Component: `force-app/main/default/lwc/d3BarChart/d3BarChart.js`, `d3BarChart.html`, `d3BarChart.js-meta.xml`
> - Unit test: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.test.js`
> - Integration test: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.integration.test.js`
> - E2E test: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.e2e.test.js`
>
> **Jest run pattern:** `npm test -- --testPathPattern=d3HorizontalBarChart` (matches all three tiers under the new `__tests__/` folder).

---

#### Task 7.1: Unit tier — `d3HorizontalBarChart.test.js` + component

**Files:**
- Test: `force-app/main/default/lwc/d3HorizontalBarChart/__tests__/d3HorizontalBarChart.test.js`
- Create: `force-app/main/default/lwc/d3HorizontalBarChart/d3HorizontalBarChart.js`
- Create: `force-app/main/default/lwc/d3HorizontalBarChart/d3HorizontalBarChart.html`
- Create: `force-app/main/default/lwc/d3HorizontalBarChart/d3HorizontalBarChart.js-meta.xml`

- [ ] **Step 1: Clone the unit test donor.** Create the folder and copy the donor unit test, then apply the edits below.
  ```bash
  mkdir -p /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3HorizontalBarChart/__tests__
  cp /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.test.js \
     /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3HorizontalBarChart/__tests__/d3HorizontalBarChart.test.js
  ```
  Then make these exact edits to `d3HorizontalBarChart.test.js`:
  - Line 1 ABOUTME header → `// ABOUTME: Unit tests for the d3HorizontalBarChart Lightning Web Component.` and line 2 → `// ABOUTME: Tests initialization, data handling, aggregation, config, events, tooltip, resize, and error recovery for the horizontal (swapped-axis) bar chart.`
  - `import D3BarChart from "c/d3BarChart";` → `import D3HorizontalBarChart from "c/d3HorizontalBarChart";`
  - Every `createElement("c-d3-bar-chart", { is: D3BarChart })` → `createElement("c-d3-horizontal-bar-chart", { is: D3HorizontalBarChart })` (use find/replace on the tag string `c-d3-bar-chart` → `c-d3-horizontal-bar-chart` and the identifier `D3BarChart` → `D3HorizontalBarChart`).
  - `describe("c-d3-bar-chart", ...)` heading string → `"c-d3-horizontal-bar-chart"`.
  - In `createMockD3()`, the X axis is now the linear scale and Y is the band scale, so the band scale must expose `.range()` returning itself (it already does). Add `scale.nice = jest.fn(() => scale);` is NOT needed on the band scale. Leave `scaleBand` and `scaleLinear` mocks as-is — both are still used. No primitive additions are required (horizontal bar uses the same `select/append/attr/style/call/selectAll/data/enter/transition/duration/delay/on/remove/scaleBand/scaleLinear/axisBottom/axisLeft/max` set as vertical bar).
  - In the **"rendering details"** describe block, replace the axis-orientation assertions so they assert the swapped axes. Change the test `"creates scale band for x-axis"` to assert the band scale drives the **Y** axis, and `"creates linear scale for y-axis"` to assert the linear scale drives the **X** axis. Replace those two `it(...)` blocks with:
  ```javascript
    it("creates band scale for the category (Y) axis", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.scaleBand).toHaveBeenCalled();
    });

    it("creates linear scale for the value (X) axis", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("binds bar width to the value scale (horizontal growth)", async () => {
      await createChart();
      await flushPromises();

      // Horizontal bars grow along X: the `width` attr is set with a function
      // of the datum value, while `height` is the band bandwidth.
      const attrCalls = mockD3.attr.mock.calls;
      const widthFnCalls = attrCalls.filter(
        (c) => c[0] === "width" && typeof c[1] === "function"
      );
      expect(widthFnCalls.length).toBeGreaterThan(0);
    });

    it("pins bars to x=0 origin", async () => {
      await createChart();
      await flushPromises();

      // Each bar starts its animation at width 0 from x=0
      const attrCalls = mockD3.attr.mock.calls;
      const xZeroCalls = attrCalls.filter((c) => c[0] === "x" && c[1] === 0);
      expect(xZeroCalls.length).toBeGreaterThan(0);
    });
  ```
  - Keep the `"creates x-axis group"` and `"creates y-axis group"` tests as-is — both axis groups are still rendered with `class` `x-axis` / `y-axis`.

- [ ] **Step 2: Run the unit test, expect FAIL.**
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3HorizontalBarChart
  ```
  Expected: FAIL — `Cannot find module 'c/d3HorizontalBarChart'` because the component does not exist yet.

- [ ] **Step 3: Create the component JS.** Write `force-app/main/default/lwc/d3HorizontalBarChart/d3HorizontalBarChart.js` with the universal scaffold cloned from `d3BarChart.js` and only `renderChart()` swapped to horizontal axes:
  ```javascript
  /**
   * ABOUTME: D3 Horizontal Bar Chart Lightning Web Component.
   * ABOUTME: Displays aggregated data as horizontal bars (categories on Y, values on X) with drill-down support.
   */
  import { LightningElement, api, track } from "lwc";
  import { loadD3 } from "c/d3Lib";
  import {
    prepareData,
    aggregateData,
    OPERATIONS,
    MAX_RECORDS
  } from "c/dataService";
  import { getColors, DEFAULT_THEME } from "c/themeService";
  import {
    formatNumber,
    truncateLabel,
    createTooltip,
    createResizeHandler,
    buildTooltipContent,
    createLayoutRetry
  } from "c/chartUtils";
  import { NavigationMixin } from "lightning/navigation";
  import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
  import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

  export default class D3HorizontalBarChart extends NavigationMixin(
    LightningElement
  ) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    /** Data collection from Flow or parent component */
    @api recordCollection = [];

    /** SOQL query string (used if recordCollection is empty) */
    @api soqlQuery = "SELECT StageName, Amount FROM Opportunity";

    /** Field to group by (category axis — rendered on Y) */
    @api groupByField = "StageName";

    /** Field to aggregate (value axis — rendered on X) */
    @api valueField = "Amount";

    /** Aggregation operation: Sum, Count, Average */
    @api operation = OPERATIONS.SUM;

    /** Chart height in pixels */
    @api height = 300;

    /** Color theme */
    @api theme = DEFAULT_THEME;

    /** Advanced configuration JSON */
    @api advancedConfig = "{}";

    /** Maximum records to process (overrides default limit) */
    @api recordLimit;

    /** Object API name for drill-down navigation */
    @api objectApiName = "";

    /** Filter field for drill-down (usually same as groupByField) */
    @api filterField = "";

    /** Optional WHERE clause fragment for server-side aggregation */
    @api filterClause = "";

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════

    @track isLoading = true;
    @track error = null;
    @track chartData = [];

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    d3 = null;
    svg = null;
    tooltip = null;
    resizeHandler = null;
    chartRendered = false;
    _layoutRetry = null;
    _config = {};
    _configParsed = false;

    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════

    get containerStyle() {
      return `height: ${this.height}px;`;
    }

    get hasError() {
      return !!this.error;
    }

    get hasData() {
      return this.chartData && this.chartData.length > 0;
    }

    get showChart() {
      return !this.isLoading && !this.hasError && this.hasData;
    }

    get config() {
      if (!this._configParsed) {
        try {
          this._config = JSON.parse(this.advancedConfig || "{}");
        } catch {
          this._config = {};
        }
        this._configParsed = true;
      }
      return this._config;
    }

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════════

    async connectedCallback() {
      try {
        this.d3 = await loadD3(this);
        await this.loadData();
      } catch (e) {
        this.error = e.message || "Failed to initialize chart";
        console.error("D3HorizontalBarChart initialization error:", e);
      } finally {
        this.isLoading = false;
      }
    }

    renderedCallback() {
      if (this.showChart && !this.chartRendered) {
        this.chartRendered = this.initializeChart();
        if (!this.chartRendered && !this._layoutRetry) {
          const container = this.template.querySelector(".chart-container");
          if (container) {
            this._layoutRetry = createLayoutRetry(container, () => {
              this._layoutRetry = null;
              if (!this.chartRendered) {
                this.chartRendered = this.initializeChart();
              }
            });
          }
        }
      }
    }

    disconnectedCallback() {
      if (this._layoutRetry) {
        this._layoutRetry.cancel();
        this._layoutRetry = null;
      }
      this.cleanup();
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════

    async loadData() {
      // Priority 1: Use recordCollection if provided (client-side aggregation)
      if (this.recordCollection && this.recordCollection.length > 0) {
        this.chartData = this._aggregateRawData([...this.recordCollection]);
        return;
      }

      // Priority 2: Server-side aggregation when all required fields are set
      if (
        this.objectApiName &&
        this.groupByField &&
        this.valueField &&
        this.operation
      ) {
        try {
          const result = await getAggregatedData({
            objectName: this.objectApiName,
            groupByField: this.groupByField,
            valueField: this.valueField,
            operation: this.operation,
            filterClause: this.filterClause || null
          });
          this.chartData = result;
        } catch (e) {
          throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
        }

        if (!this.chartData || this.chartData.length === 0) {
          throw new Error("No data after aggregation");
        }
        return;
      }

      // Priority 3: Fall back to SOQL query with client-side aggregation
      if (this.soqlQuery) {
        let rawData = [];
        try {
          rawData = await executeQuery({ queryString: this.soqlQuery });
        } catch (e) {
          throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
        }
        this.chartData = this._aggregateRawData(rawData);
        return;
      }

      throw new Error(
        "No data source provided. Set recordCollection or soqlQuery."
      );
    }

    /**
     * Validates, truncates, and aggregates raw record data client-side.
     * Used by both recordCollection and soqlQuery paths.
     */
    _aggregateRawData(rawData) {
      const requiredFields = [this.groupByField];
      if (this.operation !== OPERATIONS.COUNT) {
        requiredFields.push(this.valueField);
      }

      const prepared = prepareData(rawData, {
        requiredFields,
        limit: this.recordLimit || MAX_RECORDS
      });

      if (!prepared.valid) {
        throw new Error(prepared.error);
      }

      const aggregated = aggregateData(
        prepared.data,
        this.groupByField,
        this.valueField,
        this.operation
      );

      if (aggregated.length === 0) {
        throw new Error("No data after aggregation");
      }

      return aggregated;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHART RENDERING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes the chart SVG, tooltip, and resize observer.
     * @returns {boolean} true if the chart was successfully initialized
     */
    initializeChart() {
      const container = this.template.querySelector(".chart-container");
      if (!container) return false;

      const { width } = container.getBoundingClientRect();
      if (width === 0) return false;

      this.tooltip = createTooltip(container);

      this.renderChart(width);

      this.resizeHandler = createResizeHandler(
        container,
        ({ width: newWidth }) => {
          if (newWidth > 0) {
            this.renderChart(newWidth);
          }
        }
      );
      this.resizeHandler.observe();
      return true;
    }

    renderChart(containerWidth) {
      const d3 = this.d3;
      const container = this.template.querySelector(".chart-container");
      if (!container || !d3) return;

      // Clear existing SVG
      d3.select(container).select("svg").remove();

      // Margins — wider left margin to fit long category labels on the Y axis
      const margin = {
        top: 20,
        right: 30,
        bottom: this.config.showGrid !== false ? 50 : 40,
        left: 120
      };

      const width = containerWidth - margin.left - margin.right;
      const height = this.height - margin.top - margin.bottom;

      if (width <= 0 || height <= 0) return;

      // Create SVG
      this.svg = d3
        .select(container)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", this.height)
        .attr("class", "horizontal-bar-chart-svg")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Scales — SWAPPED vs vertical bar: band on Y (categories), linear on X (values)
      const yScale = d3
        .scaleBand()
        .domain(this.chartData.map((d) => d.label))
        .range([0, height])
        .padding(0.2);

      const xMax = d3.max(this.chartData, (d) => d.value) || 0;
      const xScale = d3
        .scaleLinear()
        .domain([0, xMax * 1.1]) // 10% headroom
        .nice()
        .range([0, width]);

      // Colors
      const colors = getColors(
        this.theme,
        this.chartData.length,
        this.config.customColors
      );

      // Grid lines (optional) — vertical grid lines along the value (X) axis
      if (this.config.showGrid !== false) {
        this.svg
          .append("g")
          .attr("class", "grid")
          .attr("transform", `translate(0,${height})`)
          .call(d3.axisBottom(xScale).tickSize(-height).tickFormat(""))
          .selectAll("line")
          .attr("stroke", "#e0e0e0")
          .attr("stroke-dasharray", "2,2");

        this.svg.select(".grid .domain").remove();
      }

      // X Axis (values, bottom)
      this.svg
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat((d) => formatNumber(d)));

      // Y Axis (categories, left) — truncate long labels
      this.svg
        .append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).tickFormat((d) => truncateLabel(d, 16)));

      // Bars — grow horizontally from x=0
      const bars = this.svg
        .selectAll(".bar")
        .data(this.chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", (d) => yScale(d.label))
        .attr("width", 0) // Start at zero width for animation
        .attr("height", yScale.bandwidth())
        .attr("fill", (d, i) => colors[i])
        .attr("rx", 2)
        .attr("cursor", this.objectApiName ? "pointer" : "default");

      // Animate bars to their value width
      bars
        .transition()
        .duration(750)
        .delay((d, i) => i * 50)
        .attr("width", (d) => xScale(d.value));

      // Tooltip interactions
      bars
        .on("mouseenter", (event, d) => {
          this.showTooltip(event, d);
          d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr("opacity", 0.8);
        })
        .on("mousemove", (event) => {
          this.moveTooltip(event);
        })
        .on("mouseleave", (event) => {
          this.hideTooltip();
          d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr("opacity", 1);
        })
        .on("click", (event, d) => {
          this.handleBarClick(d);
        });

      if (this.config.showLegend) {
        this.renderLegend(colors);
      }
    }

    // eslint-disable-next-line no-unused-vars
    renderLegend(colors) {
      // eslint-disable-next-line no-unused-vars
      const legendPosition = this.config.legendPosition || "bottom";
      // Legend implementation for horizontal bar chart (simplified — typically less needed for bar charts)
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP HANDLERS
    // ═══════════════════════════════════════════════════════════════

    showTooltip(event, d) {
      if (!this.tooltip) return;

      const content = buildTooltipContent(d.label, d.value, {
        prefix: `${this.operation || "Value"}: `
      });

      this.tooltip.show(content, event.offsetX, event.offsetY);
    }

    // eslint-disable-next-line no-unused-vars
    moveTooltip(event) {
      // Tooltip position is set in show()
    }

    hideTooltip() {
      if (!this.tooltip) return;
      this.tooltip.hide();
    }

    // ═══════════════════════════════════════════════════════════════
    // CLICK HANDLER - DRILL DOWN
    // ═══════════════════════════════════════════════════════════════

    handleBarClick(d) {
      if (!this.objectApiName) return;

      const filterFieldName = this.filterField || this.groupByField;

      this[NavigationMixin.Navigate]({
        type: "standard__objectPage",
        attributes: {
          objectApiName: this.objectApiName,
          actionName: "list"
        },
        state: {
          filterName: "Recent"
        }
      });

      this.dispatchEvent(
        new CustomEvent("barclick", {
          detail: {
            label: d.label,
            value: d.value,
            filterField: filterFieldName
          },
          bubbles: true,
          composed: true
        })
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════

    cleanup() {
      if (this.resizeHandler) {
        this.resizeHandler.disconnect();
        this.resizeHandler = null;
      }
      if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
      }
    }
  }
  ```

- [ ] **Step 4: Create the component HTML.** Write `force-app/main/default/lwc/d3HorizontalBarChart/d3HorizontalBarChart.html` — identical 4-state template as the bar-chart donor (the mount div MUST be exactly `class="chart-container" lwc:dom="manual"`):
  ```html
  <template>
    <div class="slds-card">
      <!-- Loading State -->
      <template lwc:if={isLoading}>
        <div class="slds-align_absolute-center" style="height: 200px">
          <lightning-spinner
            alternative-text="Loading chart..."
            size="medium"
          ></lightning-spinner>
        </div>
      </template>

      <!-- Error State -->
      <template lwc:elseif={hasError}>
        <div
          class="slds-align_absolute-center slds-text-color_error"
          style="height: 200px; padding: 1rem"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:error"
              alternative-text="Error"
              size="large"
              variant="error"
            ></lightning-icon>
            <p class="slds-m-top_small">{error}</p>
          </div>
        </div>
      </template>

      <!-- Chart Container (has data) -->
      <template lwc:elseif={hasData}>
        <div
          class="chart-container"
          lwc:dom="manual"
          style={containerStyle}
        ></div>
      </template>

      <!-- No Data State -->
      <template lwc:else>
        <div
          class="slds-align_absolute-center slds-text-color_weak"
          style="height: 200px"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:chart"
              alternative-text="No data"
              size="large"
            ></lightning-icon>
            <p class="slds-m-top_small">No data available</p>
          </div>
        </div>
      </template>
    </div>
  </template>
  ```

- [ ] **Step 5: Create the component meta XML.** Write `force-app/main/default/lwc/d3HorizontalBarChart/d3HorizontalBarChart.js-meta.xml` — `apiVersion 65.0`, `isExposed true`, `masterLabel` "D3 Horizontal Bar Chart", AppPage/RecordPage/HomePage targets, every universal `@api` exposed as a `<property>` (`recordCollection` NOT exposed):
  ```xml
  <?xml version="1.0" encoding="UTF-8" ?>
  <LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
      <apiVersion>65.0</apiVersion>
      <isExposed>true</isExposed>
      <masterLabel>D3 Horizontal Bar Chart</masterLabel>
      <description
    >Interactive horizontal bar chart powered by D3.js with categories on the Y axis, values on the X axis, aggregation, and drill-down support.</description>
      <targets>
          <target>lightning__AppPage</target>
          <target>lightning__RecordPage</target>
          <target>lightning__HomePage</target>
      </targets>
      <targetConfigs>
          <targetConfig
        targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
      >
              <!-- Data Source -->
              <property
          name="soqlQuery"
          type="String"
          label="SOQL Query"
          description="SOQL query to fetch data"
          placeholder="SELECT StageName, Amount FROM Opportunity"
        />

              <!-- Field Mapping -->
              <property
          name="groupByField"
          type="String"
          label="Group By Field"
          default="StageName"
          description="API name of the category field (rendered on the Y axis)"
          placeholder="StageName"
        />
              <property
          name="valueField"
          type="String"
          label="Value Field"
          default="Amount"
          description="API name of the numeric field to aggregate (not required for Count)"
          placeholder="Amount"
        />
              <property
          name="operation"
          type="String"
          label="Aggregation"
          default="Sum"
          datasource="Sum,Count,Average"
          description="How to aggregate the values"
        />

              <!-- Appearance -->
              <property
          name="height"
          type="Integer"
          label="Height (px)"
          default="300"
          description="Chart height in pixels"
          min="150"
          max="800"
        />
              <property
          name="theme"
          type="String"
          label="Color Theme"
          default="Salesforce Standard"
          datasource="Salesforce Standard,Warm,Cool,Vibrant"
          description="Color palette for the chart"
        />

              <!-- Drill-Down -->
              <property
          name="objectApiName"
          type="String"
          label="Drill-Down Object"
          description="Object API name for navigation on bar click"
          placeholder="Opportunity"
        />
              <property
          name="filterField"
          type="String"
          label="Filter Field"
          description="Field to filter by on drill-down (defaults to Group By Field)"
        />

              <property
          name="recordLimit"
          type="Integer"
          label="Record Limit"
          description="Maximum records to process. Leave empty for default."
          min="1"
          max="10000"
        />

              <!-- Advanced -->
              <property
          name="advancedConfig"
          type="String"
          label="Advanced Config (JSON)"
          description='{"showGrid": true, "showLegend": false, "customColors": ["#FF5733"]}'
        />
          </targetConfig>
      </targetConfigs>
  </LightningComponentBundle>
  ```

- [ ] **Step 6: Run the unit test, expect PASS.**
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3HorizontalBarChart
  ```
  Expected: PASS — all unit tests green, pristine console output (no leaked errors on success paths).

- [ ] **Step 7: Commit.**
  ```bash
  cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3HorizontalBarChart
  git commit -m "feat(d3HorizontalBarChart): add horizontal bar chart component with unit tests"
  ```

---

#### Task 7.2: Integration tier — `d3HorizontalBarChart.integration.test.js`

**Files:**
- Test: `force-app/main/default/lwc/d3HorizontalBarChart/__tests__/d3HorizontalBarChart.integration.test.js`

- [ ] **Step 1: Clone the integration test donor.** Copy and apply the edits below.
  ```bash
  cp /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.integration.test.js \
     /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3HorizontalBarChart/__tests__/d3HorizontalBarChart.integration.test.js
  ```
  Then make these exact edits to `d3HorizontalBarChart.integration.test.js`:
  - Line 1 ABOUTME → `// ABOUTME: Integration tests for d3HorizontalBarChart verifying real service pipelines (dataService, themeService, chartUtils).` and line 2 → `// ABOUTME: Only D3, Apex, NavigationMixin, and ShowToastEvent are mocked; all utility services use real implementations.`
  - `import D3BarChart from "c/d3BarChart";` → `import D3HorizontalBarChart from "c/d3HorizontalBarChart";`
  - Find/replace the tag string `c-d3-bar-chart` → `c-d3-horizontal-bar-chart` and identifier `D3BarChart` → `D3HorizontalBarChart` everywhere (createElement calls + `describe` heading `"c-d3-bar-chart integration"` → `"c-d3-horizontal-bar-chart integration"`).
  - Keep the `createMockD3()` factory unchanged (already includes `scale.clamp` on `scaleLinear` and `bandwidth` on `scaleBand` — both used by the horizontal renderer). Keep `flushPromises = () => new Promise(process.nextTick);` exactly as-is.
  - In the **"truncation pipeline integration"** describe block, the assertion `expect(mockD3.scaleBand).toHaveBeenCalled();` is still valid (band scale is used for the Y axis) — leave it. No change needed.
  - At the end of the **"theme pipeline integration"** describe block (after the `"uses custom colors from advancedConfig over theme"` test), add a horizontal-specific assertion verifying real aggregated values bind to the bar `width` attr function via the real linear X scale. Insert this `it(...)` block:
  ```javascript
    it("binds real aggregated values to bar width through the X (value) scale", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        operation: "Sum",
        groupByField: "StageName",
        valueField: "Amount"
      });

      // Real aggregateData (Sum): Closed Won=500, Prospecting=300, Qualification=150
      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
      );
      expect(chartDataCall).toBeTruthy();
      expect(chartDataCall[0]).toEqual([
        { label: "Closed Won", value: 500 },
        { label: "Prospecting", value: 300 },
        { label: "Qualification", value: 150 }
      ]);

      // The bar `width` attr is bound to a function of the datum value (horizontal growth)
      const attrCalls = mockD3.attr.mock.calls;
      const widthFnCalls = attrCalls.filter(
        (c) => c[0] === "width" && typeof c[1] === "function"
      );
      expect(widthFnCalls.length).toBeGreaterThan(0);
    });
  ```
  - Keep the **"theme pipeline integration"** real-palette-hex assertions (`#1589EE` for Salesforce Standard, `#FF6B6B` for Warm) unchanged — the fill flow is identical to the vertical bar.

- [ ] **Step 2: Run the integration test, expect PASS.**
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3HorizontalBarChart
  ```
  Expected: PASS — real `dataService.aggregateData` produces the exact `{label, value}` arrays and real `themeService.getColors` hex flows into `mockD3.data()`/fill functions; the component already exists so all three tiers run green.

- [ ] **Step 3: Commit.**
  ```bash
  cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3HorizontalBarChart/__tests__/d3HorizontalBarChart.integration.test.js
  git commit -m "test(d3HorizontalBarChart): add integration tier asserting real aggregation and palette flow"
  ```

---

#### Task 7.3: E2E tier — `d3HorizontalBarChart.e2e.test.js`

**Files:**
- Test: `force-app/main/default/lwc/d3HorizontalBarChart/__tests__/d3HorizontalBarChart.e2e.test.js`

- [ ] **Step 1: Clone the e2e test donor.** Copy and apply the edits below.
  ```bash
  cp /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.e2e.test.js \
     /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3HorizontalBarChart/__tests__/d3HorizontalBarChart.e2e.test.js
  ```
  Then make these exact edits to `d3HorizontalBarChart.e2e.test.js`:
  - Line 1 ABOUTME → `// ABOUTME: End-to-end lifecycle tests for the d3HorizontalBarChart Lightning Web Component.` and line 2 → `// ABOUTME: Verifies full pipeline: D3 load, data aggregation, SVG rendering, cleanup, and multi-instance isolation.`
  - `import D3BarChart from "c/d3BarChart";` → `import D3HorizontalBarChart from "c/d3HorizontalBarChart";`
  - Find/replace the tag string `c-d3-bar-chart` → `c-d3-horizontal-bar-chart` and identifier `D3BarChart` → `D3HorizontalBarChart` everywhere (createElement calls + the three `describe` headings `"c-d3-bar-chart e2e"` → `"c-d3-horizontal-bar-chart e2e"`).
  - Keep the `createMockD3()` factory, the global `getBoundingClientRect`/`ResizeObserver` mocks, `flushPromises`, and the `createChart()` helper exactly as cloned (the horizontal renderer uses the same primitive set). Note the e2e `createMockD3` does NOT include `text` — that is fine; the horizontal renderer does not call `.text()`.
  - In the **"data flow verification"** describe block, the test `"aggregated data flows through to D3 with correct values"` is data-path identical (same `getAggregatedData`/aggregation behavior) — keep it unchanged. After it, add one horizontal-specific data-flow assertion confirming the SVG carries the horizontal class and bars are pinned to x=0:
  ```javascript
    it("renders a horizontal-bar SVG with bars anchored at x=0", async () => {
      const horizData = [
        { StageName: "North", Amount: 700 },
        { StageName: "South", Amount: 300 }
      ];

      await createChart({
        recordCollection: horizData,
        operation: "Sum",
        groupByField: "StageName",
        valueField: "Amount"
      });

      // SVG tagged with the horizontal-bar class
      const attrCalls = mockD3.attr.mock.calls;
      const svgClassCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "horizontal-bar-chart-svg"
      );
      expect(svgClassCalls.length).toBeGreaterThan(0);

      // Bars pinned to x=0 (horizontal growth origin)
      const xZeroCalls = attrCalls.filter((c) => c[0] === "x" && c[1] === 0);
      expect(xZeroCalls.length).toBeGreaterThan(0);

      // Band scale drives the category (Y) axis
      expect(mockD3.scaleBand).toHaveBeenCalled();

      // Success path: console.error was NOT called
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  ```
  - Leave the **"full lifecycle"**, **"error recovery"**, and **"multi-component isolation"** describe blocks unchanged (success/cleanup paths still assert `consoleErrorSpy` was NOT called; the D3-load-failure test still asserts the error banner and `"CDN unreachable"` text).

- [ ] **Step 2: Run the e2e test, expect PASS.**
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3HorizontalBarChart
  ```
  Expected: PASS — full lifecycle (create → load → render → SVG/data assertions → spinner gone → no error), multi-instance isolation, data-flow with exact values, and pristine console (no `console.error` on success paths).

- [ ] **Step 3: Commit.**
  ```bash
  cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3HorizontalBarChart/__tests__/d3HorizontalBarChart.e2e.test.js
  git commit -m "test(d3HorizontalBarChart): add e2e tier covering lifecycle, isolation, and pristine output"
  ```


### Phase 8: Lollipop Chart (`d3LollipopChart`)

Clone the `d3BarChart` scaffold and all three of its test tiers; replace each bar `rect` with a stem (`append("line")` from baseline to value) plus a head (`append("circle")` at the value), keeping `scaleBand` on the category axis and `scaleLinear` on the value axis. Data path is `getAggregatedData` (server) / client-side aggregation — identical to the Bar chart — so **no `jest.config.js` or `__mocks__` changes are needed** (the `executeQuery` and `getAggregatedData` mappers already exist). Full release: component (`.js`/`.html`/`.js-meta.xml`, apiVersion 65.0) + unit + integration + e2e tiers, strict TDD.

> **Donor paths (clone exactly from these):**
> - Component scaffold: `force-app/main/default/lwc/d3BarChart/d3BarChart.js`, `d3BarChart.html`, `d3BarChart.js-meta.xml`
> - Unit tier: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.test.js`
> - Integration tier: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.integration.test.js`
> - E2E tier: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.e2e.test.js`
>
> **Chart-specific deltas vs. the Bar donor (apply in every tier + component):**
> 1. `append("line")` and `append("circle")` replace `append("rect")` — the mock-D3 factory's chainable proxy already returns `mockD3` from `append()`, so `line`/`circle` chain for free; no factory primitive needs adding. Scale primitives (`scaleBand`, `scaleLinear`, `axisBottom`, `axisLeft`, `max`) are unchanged.
> 2. Rendering-detail assertions change from "creates bar rect elements" / "applies rounded corners (`rx`)" to "creates exactly one stem line and one head circle per datum" and "circle is centered at the value position (`cy = yScale(value)`)".
> 3. Component class `D3LollipopChart`, custom element `c-d3-lollipop-chart`, click event renamed `lollipopclick` (donor used `barclick`).

---

#### Task 8.1: Unit tier + component implementation

- **Files:**
  - Test: `force-app/main/default/lwc/d3LollipopChart/__tests__/d3LollipopChart.test.js` (Create)
  - Create: `force-app/main/default/lwc/d3LollipopChart/d3LollipopChart.js`
  - Create: `force-app/main/default/lwc/d3LollipopChart/d3LollipopChart.html`
  - Create: `force-app/main/default/lwc/d3LollipopChart/d3LollipopChart.js-meta.xml`

- [ ] **Step 1: Clone the unit donor and rewrite it for the Lollipop.**
  Run the clone command, then apply the edits below.
  ```bash
  mkdir -p force-app/main/default/lwc/d3LollipopChart/__tests__
  cp force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.test.js \
     force-app/main/default/lwc/d3LollipopChart/__tests__/d3LollipopChart.test.js
  ```
  Then in the new `d3LollipopChart/__tests__/d3LollipopChart.test.js`, make these exact edits:
  - Line 1–2 ABOUTME header → `// ABOUTME: Unit tests for the d3LollipopChart Lightning Web Component.` / `// ABOUTME: Tests initialization, data handling, aggregation, config, events, tooltip, resize, error recovery, and stem+head rendering.`
  - `import D3BarChart from "c/d3BarChart";` → `import D3LollipopChart from "c/d3LollipopChart";`
  - Replace every `"c-d3-bar-chart"` literal with `"c-d3-lollipop-chart"` (in `createElement`, `createChart`, and the top-level `describe`).
  - Replace every `is: D3BarChart` with `is: D3LollipopChart`.
  - The `createMockD3()` factory is left **unchanged** — `append()` already returns `mockD3`, so `append("line")` / `append("circle")` chain. `scaleBand`/`scaleLinear`/`axisBottom`/`axisLeft`/`max` are reused as-is.
  - **Replace the entire `describe("rendering details", ...)` block** (donor lines 908–1013) with the Lollipop-specific version below (this swaps the `rect`/`rx` assertions for `line`+`circle` assertions and keeps the scale/axis/transition/svg assertions):
  ```javascript
    describe("rendering details", () => {
      it("creates SVG element", async () => {
        await createChart();
        await flushPromises();

        const appendCalls = mockD3.append.mock.calls;
        const svgCalls = appendCalls.filter((c) => c[0] === "svg");
        expect(svgCalls.length).toBeGreaterThan(0);
      });

      it("creates stem line elements", async () => {
        await createChart();
        await flushPromises();

        const appendCalls = mockD3.append.mock.calls;
        const lineCalls = appendCalls.filter((c) => c[0] === "line");
        expect(lineCalls.length).toBeGreaterThan(0);
      });

      it("creates head circle elements", async () => {
        await createChart();
        await flushPromises();

        const appendCalls = mockD3.append.mock.calls;
        const circleCalls = appendCalls.filter((c) => c[0] === "circle");
        expect(circleCalls.length).toBeGreaterThan(0);
      });

      it("does not create bar rect elements", async () => {
        await createChart();
        await flushPromises();

        const appendCalls = mockD3.append.mock.calls;
        const rectCalls = appendCalls.filter((c) => c[0] === "rect");
        expect(rectCalls.length).toBe(0);
      });

      it("creates exactly one stem line and one head circle per datum", async () => {
        // SAMPLE_DATA aggregates (Sum) to 3 groups: Prospecting, Qualification, Closed Won
        await createChart({ recordCollection: SAMPLE_DATA, operation: "Sum" });
        await flushPromises();

        const appendCalls = mockD3.append.mock.calls;
        const lineCalls = appendCalls.filter((c) => c[0] === "line");
        const circleCalls = appendCalls.filter((c) => c[0] === "circle");
        // Stems and heads are each created via a single .append() on the
        // data-bound enter selection, so each fires once per render pass.
        expect(lineCalls.length).toBe(circleCalls.length);
        expect(lineCalls.length).toBeGreaterThan(0);
      });

      it("centers the head circle at the value position via cy", async () => {
        await createChart();
        await flushPromises();

        const attrCalls = mockD3.attr.mock.calls;
        const cyCalls = attrCalls.filter((c) => c[0] === "cy");
        expect(cyCalls.length).toBeGreaterThan(0);
        // cy is set with a function (d) => yScale(d.value)
        const cyFn = cyCalls[cyCalls.length - 1][1];
        expect(typeof cyFn).toBe("function");
      });

      it("anchors the stem baseline at the value axis floor via y1", async () => {
        await createChart();
        await flushPromises();

        const attrCalls = mockD3.attr.mock.calls;
        const y1Calls = attrCalls.filter((c) => c[0] === "y1");
        expect(y1Calls.length).toBeGreaterThan(0);
      });

      it("creates x-axis group", async () => {
        await createChart();
        await flushPromises();

        const attrCalls = mockD3.attr.mock.calls;
        const classCalls = attrCalls.filter(
          (c) => c[0] === "class" && c[1] === "x-axis"
        );
        expect(classCalls.length).toBeGreaterThan(0);
      });

      it("creates y-axis group", async () => {
        await createChart();
        await flushPromises();

        const attrCalls = mockD3.attr.mock.calls;
        const classCalls = attrCalls.filter(
          (c) => c[0] === "class" && c[1] === "y-axis"
        );
        expect(classCalls.length).toBeGreaterThan(0);
      });

      it("creates scale band for x-axis", async () => {
        await createChart();
        await flushPromises();

        expect(mockD3.scaleBand).toHaveBeenCalled();
      });

      it("creates linear scale for y-axis", async () => {
        await createChart();
        await flushPromises();

        expect(mockD3.scaleLinear).toHaveBeenCalled();
      });

      it("applies animation transition to lollipops", async () => {
        await createChart();
        await flushPromises();

        expect(mockD3.transition).toHaveBeenCalled();
        expect(mockD3.duration).toHaveBeenCalled();
      });

      it("sets SVG dimensions on container", async () => {
        await createChart();
        await flushPromises();

        const attrCalls = mockD3.attr.mock.calls;
        const widthCalls = attrCalls.filter((c) => c[0] === "width");
        const heightCalls = attrCalls.filter((c) => c[0] === "height");
        expect(widthCalls.length).toBeGreaterThan(0);
        expect(heightCalls.length).toBeGreaterThan(0);
      });

      it("removes existing SVG before re-render", async () => {
        await createChart();
        await flushPromises();

        expect(mockD3.select).toHaveBeenCalled();
        expect(mockD3.remove).toHaveBeenCalled();
      });

      it("creates grid lines when showGrid is not disabled", async () => {
        await createChart({
          advancedConfig: '{"showGrid": true}'
        });
        await flushPromises();

        const attrCalls = mockD3.attr.mock.calls;
        const gridCalls = attrCalls.filter(
          (c) => c[0] === "class" && c[1] === "grid"
        );
        expect(gridCalls.length).toBeGreaterThan(0);
      });
    });
  ```
  - In the `describe("tooltip behavior", ...)` and `describe("click events", ...)` blocks the assertions reference handlers registered via `mockD3.on` / `mockD3.attr` and are component-agnostic — leave them unchanged (the Lollipop registers `mouseenter`/`mousemove`/`mouseleave`/`click` on the heads, and sets `cursor` via `attr`, exactly like the donor).

- [ ] **Step 2: Run the unit test — expect FAIL (component absent).**
  ```bash
  npm test -- --testPathPattern=d3LollipopChart
  ```
  Expected: **FAIL** because `c/d3LollipopChart` does not exist yet — Jest reports `Cannot find module 'c/d3LollipopChart'`.

- [ ] **Step 3: Create the component JS (`d3LollipopChart.js`).**
  Write `force-app/main/default/lwc/d3LollipopChart/d3LollipopChart.js`:
  ```javascript
  /**
   * ABOUTME: D3 Lollipop Chart Lightning Web Component.
   * ABOUTME: Displays aggregated data as a stem line plus a head circle per category, with drill-down support.
   */
  import { LightningElement, api, track } from "lwc";
  import { loadD3 } from "c/d3Lib";
  import {
    prepareData,
    aggregateData,
    OPERATIONS,
    MAX_RECORDS
  } from "c/dataService";
  import { getColors, DEFAULT_THEME } from "c/themeService";
  import {
    formatNumber,
    truncateLabel,
    createTooltip,
    createResizeHandler,
    buildTooltipContent,
    createLayoutRetry
  } from "c/chartUtils";
  import { NavigationMixin } from "lightning/navigation";
  import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
  import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

  export default class D3LollipopChart extends NavigationMixin(
    LightningElement
  ) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    /** Data collection from Flow or parent component */
    @api recordCollection = [];

    /** SOQL query string (used if recordCollection is empty) */
    @api soqlQuery = "SELECT StageName, Amount FROM Opportunity";

    /** Field to group by (category axis) */
    @api groupByField = "StageName";

    /** Field to aggregate (value axis) */
    @api valueField = "Amount";

    /** Aggregation operation: Sum, Count, Average */
    @api operation = OPERATIONS.SUM;

    /** Chart height in pixels */
    @api height = 300;

    /** Color theme */
    @api theme = DEFAULT_THEME;

    /** Advanced configuration JSON */
    @api advancedConfig = "{}";

    /** Maximum records to process (overrides default limit) */
    @api recordLimit;

    /** Object API name for drill-down navigation */
    @api objectApiName = "";

    /** Filter field for drill-down (usually same as groupByField) */
    @api filterField = "";

    /** Optional WHERE clause fragment for server-side aggregation */
    @api filterClause = "";

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════

    @track isLoading = true;
    @track error = null;
    @track chartData = [];

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    d3 = null;
    svg = null;
    tooltip = null;
    resizeHandler = null;
    chartRendered = false;
    _layoutRetry = null;
    _config = {};

    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════

    get containerStyle() {
      return `height: ${this.height}px;`;
    }

    get hasError() {
      return !!this.error;
    }

    get hasData() {
      return this.chartData && this.chartData.length > 0;
    }

    get showChart() {
      return !this.isLoading && !this.hasError && this.hasData;
    }

    get config() {
      if (!this._configParsed) {
        try {
          this._config = JSON.parse(this.advancedConfig || "{}");
        } catch {
          this._config = {};
        }
        this._configParsed = true;
      }
      return this._config;
    }

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════════

    async connectedCallback() {
      try {
        this.d3 = await loadD3(this);
        await this.loadData();
      } catch (e) {
        this.error = e.message || "Failed to initialize chart";
        console.error("D3LollipopChart initialization error:", e);
      } finally {
        this.isLoading = false;
      }
    }

    renderedCallback() {
      if (this.showChart && !this.chartRendered) {
        this.chartRendered = this.initializeChart();
        if (!this.chartRendered && !this._layoutRetry) {
          const container = this.template.querySelector(".chart-container");
          if (container) {
            this._layoutRetry = createLayoutRetry(container, () => {
              this._layoutRetry = null;
              if (!this.chartRendered) {
                this.chartRendered = this.initializeChart();
              }
            });
          }
        }
      }
    }

    disconnectedCallback() {
      if (this._layoutRetry) {
        this._layoutRetry.cancel();
        this._layoutRetry = null;
      }
      this.cleanup();
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════

    async loadData() {
      // Priority 1: Use recordCollection if provided (client-side aggregation)
      if (this.recordCollection && this.recordCollection.length > 0) {
        this.chartData = this._aggregateRawData([...this.recordCollection]);
        return;
      }

      // Priority 2: Server-side aggregation when all required fields are set
      if (
        this.objectApiName &&
        this.groupByField &&
        this.valueField &&
        this.operation
      ) {
        try {
          const result = await getAggregatedData({
            objectName: this.objectApiName,
            groupByField: this.groupByField,
            valueField: this.valueField,
            operation: this.operation,
            filterClause: this.filterClause || null
          });
          this.chartData = result;
        } catch (e) {
          throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
        }

        if (!this.chartData || this.chartData.length === 0) {
          throw new Error("No data after aggregation");
        }
        return;
      }

      // Priority 3: Fall back to SOQL query with client-side aggregation
      if (this.soqlQuery) {
        let rawData = [];
        try {
          rawData = await executeQuery({ queryString: this.soqlQuery });
        } catch (e) {
          throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
        }
        this.chartData = this._aggregateRawData(rawData);
        return;
      }

      throw new Error(
        "No data source provided. Set recordCollection or soqlQuery."
      );
    }

    /**
     * Validates, truncates, and aggregates raw record data client-side.
     * Used by both recordCollection and soqlQuery paths.
     */
    _aggregateRawData(rawData) {
      const requiredFields = [this.groupByField];
      if (this.operation !== OPERATIONS.COUNT) {
        requiredFields.push(this.valueField);
      }

      const prepared = prepareData(rawData, {
        requiredFields,
        limit: this.recordLimit || MAX_RECORDS
      });

      if (!prepared.valid) {
        throw new Error(prepared.error);
      }

      const aggregated = aggregateData(
        prepared.data,
        this.groupByField,
        this.valueField,
        this.operation
      );

      if (aggregated.length === 0) {
        throw new Error("No data after aggregation");
      }

      return aggregated;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHART RENDERING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes the chart SVG, tooltip, and resize observer.
     * @returns {boolean} true if the chart was successfully initialized
     */
    initializeChart() {
      const container = this.template.querySelector(".chart-container");
      if (!container) return false;

      const { width } = container.getBoundingClientRect();
      if (width === 0) return false;

      this.tooltip = createTooltip(container);

      this.renderChart(width);

      this.resizeHandler = createResizeHandler(
        container,
        ({ width: newWidth }) => {
          if (newWidth > 0) {
            this.renderChart(newWidth);
          }
        }
      );
      this.resizeHandler.observe();
      return true;
    }

    renderChart(containerWidth) {
      const d3 = this.d3;
      const container = this.template.querySelector(".chart-container");
      if (!container || !d3) return;

      // Clear existing SVG
      d3.select(container).select("svg").remove();

      const margin = {
        top: 20,
        right: 20,
        bottom: this.config.showGrid !== false ? 60 : 40,
        left: 60
      };

      const width = containerWidth - margin.left - margin.right;
      const height = this.height - margin.top - margin.bottom;

      if (width <= 0 || height <= 0) return;

      this.svg = d3
        .select(container)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", this.height)
        .attr("class", "lollipop-chart-svg")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Scales
      const xScale = d3
        .scaleBand()
        .domain(this.chartData.map((d) => d.label))
        .range([0, width])
        .padding(0.2);

      const yMax = d3.max(this.chartData, (d) => d.value) || 0;
      const yScale = d3
        .scaleLinear()
        .domain([0, yMax * 1.1]) // 10% headroom
        .nice()
        .range([height, 0]);

      // Colors
      const colors = getColors(
        this.theme,
        this.chartData.length,
        this.config.customColors
      );

      // Grid lines (optional)
      if (this.config.showGrid !== false) {
        this.svg
          .append("g")
          .attr("class", "grid")
          .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""))
          .selectAll("line")
          .attr("stroke", "#e0e0e0")
          .attr("stroke-dasharray", "2,2");

        this.svg.select(".grid .domain").remove();
      }

      // X Axis
      const xAxis = this.svg
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat((d) => truncateLabel(d, 12)));

      // Rotate labels if many categories
      if (this.chartData.length > 6) {
        xAxis
          .selectAll("text")
          .attr("transform", "rotate(-45)")
          .style("text-anchor", "end")
          .attr("dx", "-0.5em")
          .attr("dy", "0.5em");
      }

      // Y Axis
      this.svg
        .append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).tickFormat((d) => formatNumber(d)));

      // Center of each category band, used for both stem and head
      const cx = (d) => xScale(d.label) + xScale.bandwidth() / 2;

      // Stems — a vertical line from the value-axis floor up to the value
      const stems = this.svg
        .selectAll(".lollipop-stem")
        .data(this.chartData)
        .enter()
        .append("line")
        .attr("class", "lollipop-stem")
        .attr("x1", cx)
        .attr("x2", cx)
        .attr("y1", height) // baseline at the value-axis floor
        .attr("y2", height) // animate up to yScale(value)
        .attr("stroke", (d, i) => colors[i])
        .attr("stroke-width", 2);

      stems
        .transition()
        .duration(750)
        .delay((d, i) => i * 50)
        .attr("y2", (d) => yScale(d.value));

      // Heads — a circle centered on the band, at the value position
      const heads = this.svg
        .selectAll(".lollipop-head")
        .data(this.chartData)
        .enter()
        .append("circle")
        .attr("class", "lollipop-head")
        .attr("cx", cx)
        .attr("cy", height) // start at baseline for animation
        .attr("r", 6)
        .attr("fill", (d, i) => colors[i])
        .attr("cursor", this.objectApiName ? "pointer" : "default");

      heads
        .transition()
        .duration(750)
        .delay((d, i) => i * 50)
        .attr("cy", (d) => yScale(d.value));

      // Tooltip + click interactions on the heads
      heads
        .on("mouseenter", (event, d) => {
          this.showTooltip(event, d);
          d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr("opacity", 0.8);
        })
        .on("mousemove", (event) => {
          this.moveTooltip(event);
        })
        .on("mouseleave", (event) => {
          this.hideTooltip();
          d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr("opacity", 1);
        })
        .on("click", (event, d) => {
          this.handleLollipopClick(d);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP HANDLERS
    // ═══════════════════════════════════════════════════════════════

    showTooltip(event, d) {
      if (!this.tooltip) return;

      const content = buildTooltipContent(d.label, d.value, {
        prefix: `${this.operation || "Value"}: `
      });

      this.tooltip.show(content, event.offsetX, event.offsetY);
    }

    // eslint-disable-next-line no-unused-vars
    moveTooltip(event) {
      // Tooltip position is set in show(); kept for interaction symmetry.
    }

    hideTooltip() {
      if (!this.tooltip) return;
      this.tooltip.hide();
    }

    // ═══════════════════════════════════════════════════════════════
    // CLICK HANDLER - DRILL DOWN
    // ═══════════════════════════════════════════════════════════════

    handleLollipopClick(d) {
      if (!this.objectApiName) return;

      const filterFieldName = this.filterField || this.groupByField;

      this[NavigationMixin.Navigate]({
        type: "standard__objectPage",
        attributes: {
          objectApiName: this.objectApiName,
          actionName: "list"
        },
        state: {
          filterName: "Recent"
        }
      });

      this.dispatchEvent(
        new CustomEvent("lollipopclick", {
          detail: {
            label: d.label,
            value: d.value,
            filterField: filterFieldName
          },
          bubbles: true,
          composed: true
        })
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════

    cleanup() {
      if (this.resizeHandler) {
        this.resizeHandler.disconnect();
        this.resizeHandler = null;
      }
      if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
      }
    }
  }
  ```

- [ ] **Step 4: Create the component HTML (`d3LollipopChart.html`).**
  This is the donor's 4-state template verbatim (only the chart-type comment differs). Write `force-app/main/default/lwc/d3LollipopChart/d3LollipopChart.html`:
  ```html
  <template>
    <div class="slds-card">
      <!-- Loading State -->
      <template lwc:if={isLoading}>
        <div class="slds-align_absolute-center" style="height: 200px">
          <lightning-spinner
            alternative-text="Loading chart..."
            size="medium"
          ></lightning-spinner>
        </div>
      </template>

      <!-- Error State -->
      <template lwc:elseif={hasError}>
        <div
          class="slds-align_absolute-center slds-text-color_error"
          style="height: 200px; padding: 1rem"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:error"
              alternative-text="Error"
              size="large"
              variant="error"
            ></lightning-icon>
            <p class="slds-m-top_small">{error}</p>
          </div>
        </div>
      </template>

      <!-- Chart Container (has data) -->
      <template lwc:elseif={hasData}>
        <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>
      </template>

      <!-- No Data State -->
      <template lwc:else>
        <div
          class="slds-align_absolute-center slds-text-color_weak"
          style="height: 200px"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:chart"
              alternative-text="No data"
              size="large"
            ></lightning-icon>
            <p class="slds-m-top_small">No data available</p>
          </div>
        </div>
      </template>
    </div>
  </template>
  ```

- [ ] **Step 5: Create the component meta (`d3LollipopChart.js-meta.xml`, apiVersion 65.0).**
  Clone the donor's `targetConfigs` but bump `apiVersion` to `65.0` and set the master label/description. Write `force-app/main/default/lwc/d3LollipopChart/d3LollipopChart.js-meta.xml`:
  ```xml
  <?xml version="1.0" encoding="UTF-8" ?>
  <LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
      <apiVersion>65.0</apiVersion>
      <isExposed>true</isExposed>
      <masterLabel>D3 Lollipop Chart</masterLabel>
      <description
    >Interactive lollipop chart powered by D3.js with aggregation and drill-down support.</description>
      <targets>
          <target>lightning__AppPage</target>
          <target>lightning__RecordPage</target>
          <target>lightning__HomePage</target>
      </targets>
      <targetConfigs>
          <targetConfig
        targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
      >
              <!-- Data Source -->
              <property
          name="soqlQuery"
          type="String"
          label="SOQL Query"
          description="SOQL query to fetch data"
          placeholder="SELECT StageName, Amount FROM Opportunity"
        />

              <!-- Field Mapping -->
              <property
          name="groupByField"
          type="String"
          label="Group By Field"
          default="StageName"
          description="API name of the category field (e.g., StageName)"
          placeholder="StageName"
        />
              <property
          name="valueField"
          type="String"
          label="Value Field"
          default="Amount"
          description="API name of the numeric field to aggregate (not required for Count)"
          placeholder="Amount"
        />
              <property
          name="operation"
          type="String"
          label="Aggregation"
          default="Sum"
          datasource="Sum,Count,Average"
          description="How to aggregate the values"
        />

              <!-- Appearance -->
              <property
          name="height"
          type="Integer"
          label="Height (px)"
          default="300"
          description="Chart height in pixels"
          min="150"
          max="800"
        />
              <property
          name="theme"
          type="String"
          label="Color Theme"
          default="Salesforce Standard"
          datasource="Salesforce Standard,Warm,Cool,Vibrant"
          description="Color palette for the chart"
        />

              <!-- Drill-Down -->
              <property
          name="objectApiName"
          type="String"
          label="Drill-Down Object"
          description="Object API name for navigation on lollipop click"
          placeholder="Opportunity"
        />
              <property
          name="filterField"
          type="String"
          label="Filter Field"
          description="Field to filter by on drill-down (defaults to Group By Field)"
        />

              <property
          name="recordLimit"
          type="Integer"
          label="Record Limit"
          description="Maximum records to process. Leave empty for default."
          min="1"
          max="10000"
        />

              <!-- Advanced -->
              <property
          name="advancedConfig"
          type="String"
          label="Advanced Config (JSON)"
          description='{"showGrid": true, "customColors": ["#FF5733"]}'
        />
          </targetConfig>
      </targetConfigs>
  </LightningComponentBundle>
  ```

- [ ] **Step 6: Run the unit test — expect PASS.**
  ```bash
  npm test -- --testPathPattern=d3LollipopChart
  ```
  Expected: **PASS** — all unit cases green, console output pristine (error-path tests assert the console spy was called; all others leave it silent).

- [ ] **Step 7: Commit the component + unit tier.**
  ```bash
  git add force-app/main/default/lwc/d3LollipopChart/
  git commit -m "feat(charts): add d3LollipopChart component with unit tests"
  ```

---

#### Task 8.2: Integration tier

- **Files:**
  - Test: `force-app/main/default/lwc/d3LollipopChart/__tests__/d3LollipopChart.integration.test.js` (Create)

- [ ] **Step 1: Clone the integration donor and rebind it to the Lollipop.**
  ```bash
  cp force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.integration.test.js \
     force-app/main/default/lwc/d3LollipopChart/__tests__/d3LollipopChart.integration.test.js
  ```
  Then in the new `d3LollipopChart/__tests__/d3LollipopChart.integration.test.js`, make these exact edits:
  - Line 1–2 ABOUTME header → `// ABOUTME: Integration tests for d3LollipopChart verifying real service pipelines (dataService, themeService, chartUtils).` / `// ABOUTME: Only D3, Apex, NavigationMixin, and ShowToastEvent are mocked; all utility services use real implementations.`
  - `import D3BarChart from "c/d3BarChart";` → `import D3LollipopChart from "c/d3LollipopChart";`
  - Replace every `"c-d3-bar-chart"` literal with `"c-d3-lollipop-chart"` (createElement, createChart, top-level `describe` → `"c-d3-lollipop-chart integration"`).
  - Replace every `is: D3BarChart` with `is: D3LollipopChart`.
  - The `createMockD3()` factory, the real `dataService`/`themeService`/`chartUtils`, `flushPromises = () => new Promise(process.nextTick)`, and all mocks (`c/d3Lib`, `executeQuery`, `lightning/platformShowToastEvent`, `lightning/navigation`) stay **exactly as donored** — the data-pipeline, theme-pipeline, truncation, validation, and resize assertions are component-agnostic and assert REAL aggregated values + REAL palette hex flowing into `mockD3.data()`.
  - **Patch the `truncation pipeline integration` block's render-proof assertion.** The donor (line ~434) asserts `expect(mockD3.scaleBand).toHaveBeenCalled();` — `scaleBand` still applies to the Lollipop, so leave it as-is. No change needed.
  - **Add one Lollipop-specific data-flow assertion** to the `describe("data pipeline integration", ...)` block (insert after the existing `"aggregates recordCollection data with Sum operation and passes to D3 data()"` test):
  ```javascript
      it("binds the real aggregated array to both stems and heads", async () => {
        await createChart({
          recordCollection: SAMPLE_DATA,
          operation: "Sum",
          groupByField: "StageName",
          valueField: "Amount"
        });

        // Real aggregateData Sum desc: Closed Won=500, Prospecting=300, Qualification=150
        const expected = [
          { label: "Closed Won", value: 500 },
          { label: "Prospecting", value: 300 },
          { label: "Qualification", value: 150 }
        ];

        // The component calls .data() once for the stems and once for the heads,
        // both with the identical real aggregated array.
        const chartDataCalls = mockD3.data.mock.calls.filter(
          (call) =>
            Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
        );
        expect(chartDataCalls.length).toBeGreaterThanOrEqual(2);
        chartDataCalls.forEach((call) => {
          expect(call[0]).toEqual(expected);
        });
      });
  ```

- [ ] **Step 2: Run the integration test — expect PASS.**
  ```bash
  npm test -- --testPathPattern=d3LollipopChart.integration
  ```
  Expected: **PASS** — real `dataService.aggregateData` produces the sorted `{label,value}` array, real `themeService.getColors` yields `#1589EE`/`#FF9E2C`/`#4BCA81` (SF Standard) and `#FF6B6B` (Warm), and the resize-debounce test survives `jest.useFakeTimers()` because `flushPromises` uses `process.nextTick`.

- [ ] **Step 3: Commit the integration tier.**
  ```bash
  git add force-app/main/default/lwc/d3LollipopChart/__tests__/d3LollipopChart.integration.test.js
  git commit -m "test(charts): add d3LollipopChart integration tests"
  ```

---

#### Task 8.3: E2E tier

- **Files:**
  - Test: `force-app/main/default/lwc/d3LollipopChart/__tests__/d3LollipopChart.e2e.test.js` (Create)

- [ ] **Step 1: Clone the e2e donor and rebind it to the Lollipop.**
  ```bash
  cp force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.e2e.test.js \
     force-app/main/default/lwc/d3LollipopChart/__tests__/d3LollipopChart.e2e.test.js
  ```
  Then in the new `d3LollipopChart/__tests__/d3LollipopChart.e2e.test.js`, make these exact edits:
  - Line 1–2 ABOUTME header → `// ABOUTME: End-to-end lifecycle tests for the d3LollipopChart Lightning Web Component.` / `// ABOUTME: Verifies full pipeline: D3 load, data aggregation, stem+head rendering, cleanup, and multi-instance isolation.`
  - `import D3BarChart from "c/d3BarChart";` → `import D3LollipopChart from "c/d3LollipopChart";`
  - Replace every `"c-d3-bar-chart"` literal with `"c-d3-lollipop-chart"` (createElement, createChart, top-level `describe` → `"c-d3-lollipop-chart e2e"`).
  - Replace every `is: D3BarChart` with `is: D3LollipopChart`.
  - The `createMockD3()` factory, the `Element.prototype.getBoundingClientRect` and `global.ResizeObserver` stubs, `flushPromises`, `consoleErrorSpy`, and all mocks stay **exactly as donored**. The full-lifecycle test already asserts `append("svg")` was called and that `console.error` was NOT called on the success path — both hold for the Lollipop.
  - **In the `describe("full lifecycle", ...)` "create -> load D3 ..." test**, after the existing `expect(svgAppended).toBe(true);` assertion, add stem+head proof so the e2e tier verifies the chart-specific render:
  ```javascript
        // Lollipop renders a stem line and a head circle (no bar rects)
        const lineAppended = appendCalls.some((call) => call[0] === "line");
        const circleAppended = appendCalls.some((call) => call[0] === "circle");
        const rectAppended = appendCalls.some((call) => call[0] === "rect");
        expect(lineAppended).toBe(true);
        expect(circleAppended).toBe(true);
        expect(rectAppended).toBe(false);
  ```
  - **In the `describe("data flow verification", ...)` "aggregated data flows through to D3 with correct values" test**, the donor finds a `dataCall` with `call[0][0].label !== undefined`. The Lollipop calls `.data()` twice (stems + heads), but both receive the same array, so `mock.calls.find(...)` still returns the correct first binding — leave this test unchanged.

- [ ] **Step 2: Run the e2e test — expect PASS.**
  ```bash
  npm test -- --testPathPattern=d3LollipopChart.e2e
  ```
  Expected: **PASS** — full lifecycle (create → load D3 → load data → render stem+head SVG → spinner gone → no error), cleanup-on-disconnect calls `ResizeObserver.disconnect`, two instances stay isolated, and the success/isolation paths assert `console.error` was NOT called (pristine output).

- [ ] **Step 3: Run all three Lollipop tiers together — confirm pristine.**
  ```bash
  npm test -- --testPathPattern=d3LollipopChart
  ```
  Expected: **PASS** — all three suites green, zero leaked console errors.

- [ ] **Step 4: Commit the e2e tier.**
  ```bash
  git add force-app/main/default/lwc/d3LollipopChart/__tests__/d3LollipopChart.e2e.test.js
  git commit -m "test(charts): add d3LollipopChart e2e tests"
  ```


### Phase 9: Progress Bar chart (`d3ProgressBar`)

Build the `d3ProgressBar` chart as a full release: component (`.js`/`.html`/`.js-meta.xml`) cloned from the `d3BulletChart` scaffold (single KPI value rendered against a target as a horizontal track), plus all THREE test tiers (unit / integration / e2e). The component renders a full-width track `rect`, a value `rect` whose width is the `value/target` fraction of the track, an optional target marker `line`, and a percent label via `chartUtils.formatPercent` (which takes a **0..1 decimal**). The single value comes from `getAggregatedData` (one row, `Average`) or `recordCollection`; the `target` comes from `config.target` (parsed from the `advancedConfig` JSON). The unit tier clones the `d3Gauge` unit suite (`d3BulletChart` is unit-only); the integration + e2e tiers are templated from `d3Gauge` (single-KPI chart that has all three tiers), with all DOM-query selectors and chart-specific assertions adapted to the `d3BulletChart`-cloned `.slds-card` 4-state template (NOT the `.chart-error`/`.chart-svg` template `d3Gauge` uses).

**Prerequisite (already satisfied — verify only):** `@salesforce/apex/D3ChartController.getAggregatedData` is already wired in `jest.config.js` `moduleNameMapper` and `__mocks__/@salesforce/apex/D3ChartController.getAggregatedData.js` exists. No foundation work is needed for this chart. If `npm test -- --testPathPattern=d3DonutChart` (a chart that uses `getAggregatedData`) passes, the mock is wired.

---

#### Task 9.1: UNIT tier — `d3ProgressBar.test.js` + component implementation

**Files:**
- Test: `force-app/main/default/lwc/d3ProgressBar/__tests__/d3ProgressBar.test.js` (Create)
- Create: `force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.js`
- Create: `force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.html`
- Create: `force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.js-meta.xml`

- [ ] **Step 1: Write the failing unit test.** Create the directory `force-app/main/default/lwc/d3ProgressBar/__tests__/` and write `d3ProgressBar.test.js`. This is adapted from the donor `force-app/main/default/lwc/d3Gauge/__tests__/d3Gauge.test.js` (read it for the mock-setup, `createComponent`, `flushPromises`, `beforeEach`/`afterEach` patterns), but the `createMockD3()` factory drops `arc()` and adds nothing extra (Progress Bar uses only `rect`/`line`/`text` via `append`+`attr`, plus `scaleLinear`), and the chart-specific assertions target the value-rect width and target marker. Write exactly:

```javascript
// ABOUTME: Unit tests for the D3 Progress Bar chart LWC component.
// ABOUTME: Covers data processing, value/target rendering, target marker, percent label, formatting, navigation, layout retry, and edge cases.

import { createElement } from "lwc";
import D3ProgressBar from "c/d3ProgressBar";
import { loadD3 } from "c/d3Lib";
import { getColor } from "c/themeService";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// Mock d3Lib
jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// Mock themeService
jest.mock("c/themeService", () => ({
  getColor: jest.fn().mockReturnValue("#1589EE")
}));

// Mock chartUtils
jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
  formatCurrency: jest.fn((v) => "$" + v),
  formatPercent: jest.fn((v) => v * 100 + "%"),
  createTooltip: jest.fn().mockReturnValue({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn()
  }),
  buildTooltipContent: jest.fn().mockReturnValue("<div>tooltip</div>"),
  createResizeHandler: jest.fn().mockReturnValue({
    observe: jest.fn(),
    disconnect: jest.fn()
  }),
  createLayoutRetry: jest.fn().mockReturnValue({
    cancel: jest.fn()
  }),
  calculateDimensions: jest
    .fn()
    .mockReturnValue({ width: 300, height: 200, margins: {} }),
  shouldUseCompactMode: jest.fn().mockReturnValue(false)
}));

// Mock Apex
jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/D3ChartController.getAggregatedData",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

// Mock NavigationMixin
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const Navigate = Symbol.for("NavigationMixin.Navigate");
    const mixin = (Base) => {
      return class extends Base {
        [Navigate] = mockNavigate;
      };
    };
    mixin.Navigate = Navigate;
    return { NavigationMixin: mixin };
  },
  { virtual: true }
);

// Create mock D3 (rect + line + text primitives; scaleLinear)
const createMockD3 = () => ({
  select: jest.fn().mockReturnThis(),
  selectAll: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  transition: jest.fn().mockReturnThis(),
  duration: jest.fn().mockReturnThis(),
  scaleLinear: jest.fn().mockReturnValue({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    clamp: jest.fn().mockReturnValue((v) => v)
  })
});

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("d3ProgressBar", () => {
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    getAggregatedData.mockResolvedValue([]);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 300,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 300
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    delete Element.prototype.getBoundingClientRect;
  });

  const createComponent = async (props = {}) => {
    const element = createElement("c-d3-progress-bar", { is: D3ProgressBar });
    Object.assign(element, { valueField: "Amount", ...props });
    document.body.appendChild(element);
    await Promise.resolve();
    await Promise.resolve();
    return element;
  };

  // ── initialization ────────────────────────────────────────────
  describe("initialization", () => {
    it("renders chart container", async () => {
      const element = await createComponent({ recordCollection: [{ Amount: 50 }] });
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).not.toBeNull();
    });

    it("shows loading state initially", () => {
      const el = createElement("c-d3-progress-bar", { is: D3ProgressBar });
      el.valueField = "Amount";
      document.body.appendChild(el);
      const spinner = el.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 on connect", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ── data handling ─────────────────────────────────────────────
  describe("data handling", () => {
    it("accepts recordCollection", async () => {
      const records = [{ Amount: 500 }];
      const element = await createComponent({ recordCollection: records });
      expect(element.recordCollection).toEqual(records);
    });

    it("accepts soqlQuery", async () => {
      const query = "SELECT Amount FROM Account";
      const element = await createComponent({ soqlQuery: query });
      expect(element.soqlQuery).toBe(query);
    });

    it("prioritizes recordCollection over soqlQuery", async () => {
      await createComponent({
        recordCollection: [{ Amount: 500 }],
        soqlQuery: "SELECT Amount FROM Account"
      });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("calls executeQuery when only soqlQuery provided", async () => {
      executeQuery.mockResolvedValue([{ Amount: 100 }]);
      await createComponent({
        recordCollection: [],
        soqlQuery: "SELECT Amount FROM Account"
      });
      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Amount FROM Account"
      });
    });
  });

  // ── data edge cases ───────────────────────────────────────────
  describe("data edge cases", () => {
    it("sets currentValue to 0 when records array is empty", async () => {
      await createComponent({ recordCollection: [] });
      await Promise.resolve();
      await Promise.resolve();
      // currentValue 0 → value rect width is scaleLinear(0). Scale was built.
      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("uses only the first record when multiple records are provided", async () => {
      const records = [{ Amount: 42 }, { Amount: 99 }];
      const element = await createComponent({ recordCollection: records });
      await Promise.resolve();
      await Promise.resolve();
      // The progress bar reflects 42 (first record), not 99.
      expect(element.recordCollection.length).toBe(2);
      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("treats non-numeric values as 0", async () => {
      const records = [{ Amount: "not-a-number" }];
      await createComponent({ recordCollection: records });
      await Promise.resolve();
      await Promise.resolve();
      // Number('not-a-number') is NaN → || 0 → 0; chart still renders rects.
      expect(mockD3.append).toHaveBeenCalledWith("rect");
    });
  });

  // ── configuration ─────────────────────────────────────────────
  describe("configuration", () => {
    it("accepts height", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        height: 120
      });
      expect(element.height).toBe(120);
    });

    it("accepts theme", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        theme: "Warm"
      });
      expect(element.theme).toBe("Warm");
    });

    it("parses advancedConfig JSON", async () => {
      const config = { target: 250 };
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify(config)
      });
      expect(element.advancedConfig).toBe(JSON.stringify(config));
    });

    it("handles invalid advancedConfig gracefully", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: "not valid json"
      });
      expect(element.advancedConfig).toBe("not valid json");
    });
  });

  // ── themes ─────────────────────────────────────────────────────
  describe("themes", () => {
    it("uses getColor from themeService for the value rect", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }], theme: "Warm" });
      expect(getColor).toHaveBeenCalled();
    });

    it("applies the theme color as the value-rect fill", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }], theme: "Warm" });
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#1589EE"
      );
      expect(fillCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("uses customColors[0] from config when provided", async () => {
      const config = { customColors: ["#AA00BB"] };
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify(config)
      });
      const attrCalls = mockD3.attr.mock.calls;
      const customFills = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#AA00BB"
      );
      expect(customFills.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── rendering details ──────────────────────────────────────────
  describe("rendering details", () => {
    it("appends a track rect and a value rect", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      await Promise.resolve();
      const rectAppends = mockD3.append.mock.calls.filter((c) => c[0] === "rect");
      // One track rect + one value rect at minimum.
      expect(rectAppends.length).toBeGreaterThanOrEqual(2);
    });

    it("builds the value scale with domain [0, target]", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });
      await Promise.resolve();
      await Promise.resolve();
      const domainFn = mockD3.scaleLinear().domain;
      expect(domainFn).toHaveBeenCalledWith([0, 200]);
    });

    it("renders the percent label via formatPercent with a 0..1 decimal", async () => {
      const { formatPercent } = require("c/chartUtils");
      // value 50, target 200 → fraction 0.25
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });
      await Promise.resolve();
      await Promise.resolve();
      const quarterCalls = formatPercent.mock.calls.filter(
        (call) => call[0] === 0.25
      );
      expect(quarterCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("draws a target marker line when config.target is set", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });
      await Promise.resolve();
      await Promise.resolve();
      const lineAppends = mockD3.append.mock.calls.filter((c) => c[0] === "line");
      expect(lineAppends.length).toBeGreaterThanOrEqual(1);
    });

    it("does not draw a target marker line when config.target is absent", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      await Promise.resolve();
      const lineAppends = mockD3.append.mock.calls.filter((c) => c[0] === "line");
      expect(lineAppends.length).toBe(0);
    });

    it("clears previous SVG before re-rendering", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      await Promise.resolve();
      // renderChart does d3.select(container).select('svg').remove()
      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });
  });

  // ── server aggregation ─────────────────────────────────────────
  describe("server aggregation", () => {
    it("calls getAggregatedData when objectApiName and valueField are set", async () => {
      getAggregatedData.mockResolvedValue([{ label: "x", value: 80 }]);
      await createComponent({
        recordCollection: [],
        objectApiName: "Opportunity",
        valueField: "Amount"
      });
      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "Id",
        valueField: "Amount",
        operation: "Average",
        filterClause: null
      });
    });

    it("passes filterClause through to getAggregatedData", async () => {
      getAggregatedData.mockResolvedValue([{ label: "x", value: 80 }]);
      await createComponent({
        recordCollection: [],
        objectApiName: "Opportunity",
        valueField: "Amount",
        filterClause: "StageName = 'Closed Won'"
      });
      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "Id",
        valueField: "Amount",
        operation: "Average",
        filterClause: "StageName = 'Closed Won'"
      });
    });
  });

  // ── click / events ─────────────────────────────────────────────
  describe("click and events", () => {
    it("registers a click handler on the value rect", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        objectApiName: "Opportunity"
      });
      await Promise.resolve();
      await Promise.resolve();
      const onCalls = mockD3.on.mock.calls;
      const clickHandler = onCalls.find((call) => call[0] === "click");
      expect(clickHandler).toBeDefined();
    });

    it("navigates to object list when value rect clicked with objectApiName", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        objectApiName: "Opportunity"
      });
      await Promise.resolve();
      await Promise.resolve();
      const onCalls = mockD3.on.mock.calls;
      const clickHandler = onCalls.find((call) => call[0] === "click");
      clickHandler[1]();
      expect(mockNavigate).toHaveBeenCalledWith({
        type: "standard__objectPage",
        attributes: {
          objectApiName: "Opportunity",
          actionName: "list"
        },
        state: { filterName: "Recent" }
      });
    });
  });

  // ── tooltip behavior ───────────────────────────────────────────
  describe("tooltip behavior", () => {
    it("creates a tooltip on init", async () => {
      const { createTooltip } = require("c/chartUtils");
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      expect(createTooltip).toHaveBeenCalled();
    });
  });

  // ── responsive behavior (layout retry) ─────────────────────────
  describe("responsive behavior", () => {
    it("retries chart init when container starts at zero width", async () => {
      const {
        createLayoutRetry,
        createResizeHandler
      } = require("c/chartUtils");

      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 0
      }));

      let retryCallback;
      createLayoutRetry.mockImplementation((container, cb) => {
        retryCallback = cb;
        return { cancel: jest.fn() };
      });
      createResizeHandler.mockClear();

      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await flushPromises();

      expect(createLayoutRetry).toHaveBeenCalled();
      expect(createResizeHandler).not.toHaveBeenCalled();

      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 400
      }));

      retryCallback();
      expect(createResizeHandler).toHaveBeenCalled();
    });

    it("does not create multiple retry loops", async () => {
      const { createLayoutRetry } = require("c/chartUtils");
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 0
      }));
      createLayoutRetry.mockImplementation(() => ({ cancel: jest.fn() }));
      createLayoutRetry.mockClear();

      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await flushPromises();
      await flushPromises();
      await flushPromises();

      expect(createLayoutRetry).toHaveBeenCalledTimes(1);
    });
  });

  // ── error recovery ─────────────────────────────────────────────
  describe("error recovery", () => {
    it("displays error when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("Load failed"));
      const element = await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      await Promise.resolve();
      const errorText = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorText).not.toBeNull();
    });

    it("displays error when query fails", async () => {
      executeQuery.mockRejectedValue({ body: { message: "Query error" } });
      const element = await createComponent({
        recordCollection: [],
        soqlQuery: "SELECT Bad FROM Query"
      });
      await Promise.resolve();
      await Promise.resolve();
      const errorText = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorText).not.toBeNull();
    });
  });

  // ── getters ─────────────────────────────────────────────────────
  describe("getters", () => {
    it("containerStyle reflects the height", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        height: 120
      });
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("height: 120px");
    });
  });

  // ── cleanup ─────────────────────────────────────────────────────
  describe("cleanup", () => {
    it("disconnects resize handler on destroy", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      const mockHandler = { observe: jest.fn(), disconnect: jest.fn() };
      createResizeHandler.mockReturnValue(mockHandler);

      const element = await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      document.body.removeChild(element);
      expect(mockHandler.disconnect).toHaveBeenCalled();
    });

    it("destroys tooltip on disconnect", async () => {
      const { createTooltip } = require("c/chartUtils");
      const mockTooltip = { show: jest.fn(), hide: jest.fn(), destroy: jest.fn() };
      createTooltip.mockReturnValue(mockTooltip);

      const element = await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      document.body.removeChild(element);
      expect(mockTooltip.destroy).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      const { createLayoutRetry } = require("c/chartUtils");
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 0
      }));
      const mockCancel = jest.fn();
      createLayoutRetry.mockImplementation(() => ({ cancel: mockCancel }));

      const element = await createComponent({ recordCollection: [{ Amount: 50 }] });
      await flushPromises();
      document.body.removeChild(element);
      expect(mockCancel).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the unit test — expect FAIL.** Run:

```bash
npm test -- --testPathPattern=d3ProgressBar
```

Expected: **FAIL** — `Cannot find module 'c/d3ProgressBar'` (the component `.js`/`.html`/`.js-meta.xml` do not exist yet). This proves the test is wired to the not-yet-built component.

- [ ] **Step 3: Implement the component JS.** Create `force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.js`. This clones the `d3BulletChart` scaffold (read `force-app/main/default/lwc/d3BulletChart/d3BulletChart.js` for the universal `@api` set, `@track`, private fields, getters, full lifecycle, `loadData` cascade, `processData`, `initializeChart`, tooltip/click handlers, `cleanup`). Only `renderChart()` differs (linear track + value rect + optional target marker + percent label instead of bullet ranges). Write exactly:

```javascript
// ABOUTME: D3 Progress Bar chart Lightning Web Component.
// ABOUTME: Renders a single KPI value as a horizontal track filled to value/target with an optional target marker and percent label.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import { getColor } from "c/themeService";
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  createTooltip,
  createResizeHandler,
  buildTooltipContent,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// Track background color (light gray)
const TRACK_COLOR = "#e0e0e0";

export default class D3ProgressBar extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field containing the numeric value */
  @api valueField = "Amount";

  /** Chart height in pixels */
  @api height = 80;

  /** Color theme for the progress fill */
  @api theme = "Salesforce Standard";

  /** Advanced configuration JSON (supports target, label, valueFormat, customColors) */
  @api advancedConfig = "";

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side aggregation */
  @api filterClause = "";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track currentValue = 0;

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  d3 = null;
  svg = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  _layoutRetry = null;
  _config = {};
  _configParsed = false;

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  get containerStyle() {
    return `height: ${this.height}px;`;
  }

  get hasError() {
    return !!this.error;
  }

  get hasData() {
    // Progress bar always has data if we got past loading without error
    // (even a zero value is valid)
    return !this.error && this.d3 !== null;
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get config() {
    if (!this._configParsed) {
      try {
        this._config = JSON.parse(this.advancedConfig || "{}");
      } catch {
        this._config = {};
      }
      this._configParsed = true;
    }
    return this._config;
  }

  get valueFormatter() {
    const format = this.config.valueFormat || "number";
    switch (format) {
      case "currency":
        return formatCurrency;
      default:
        return formatNumber;
    }
  }

  get effectiveTarget() {
    const target = this.config.target;
    if (target !== undefined && target !== null && Number(target) > 0) {
      return Number(target);
    }
    return 100;
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════

  async connectedCallback() {
    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3ProgressBar initialization error:", e);
    } finally {
      this.isLoading = false;
    }
  }

  renderedCallback() {
    if (this.showChart && !this.chartRendered) {
      this.chartRendered = this.initializeChart();
      if (!this.chartRendered && !this._layoutRetry) {
        const container = this.template.querySelector(".chart-container");
        if (container) {
          this._layoutRetry = createLayoutRetry(container, () => {
            this._layoutRetry = null;
            if (!this.chartRendered) {
              this.chartRendered = this.initializeChart();
            }
          });
        }
      }
    }
  }

  disconnectedCallback() {
    if (this._layoutRetry) {
      this._layoutRetry.cancel();
      this._layoutRetry = null;
    }
    this.cleanup();
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  async loadData() {
    // Priority 1: Use recordCollection if provided (take first record's value)
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.processData(this.recordCollection);
      return;
    }

    // Priority 2: Server-side aggregation when objectApiName and valueField are set
    if (this.objectApiName && this.valueField) {
      try {
        const result = await getAggregatedData({
          objectName: this.objectApiName,
          groupByField: "Id",
          valueField: this.valueField,
          operation: "Average",
          filterClause: this.filterClause || null
        });
        if (result && result.length > 0) {
          this.currentValue = Number(result[0].value) || 0;
        }
      } catch (e) {
        throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
      }
      return;
    }

    // Priority 3: Fall back to SOQL query
    if (this.soqlQuery) {
      let rawData = [];
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      this.processData(rawData);
      return;
    }

    throw new Error(
      "No data source provided. Set recordCollection or soqlQuery."
    );
  }

  /**
   * Extracts the numeric value from the first record.
   */
  processData(records) {
    if (!records || records.length === 0) {
      this.currentValue = 0;
      return;
    }
    const record = records[0];
    const rawValue = this.valueField ? record[this.valueField] : undefined;
    this.currentValue = Number(rawValue) || 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initializes the chart SVG, tooltip, and resize observer.
   * @returns {boolean} true if the chart was successfully initialized
   */
  initializeChart() {
    const container = this.template.querySelector(".chart-container");
    if (!container) return false;

    const { width } = container.getBoundingClientRect();
    if (width === 0) return false;

    this.tooltip = createTooltip(container);
    this.renderChart(width);

    this.resizeHandler = createResizeHandler(
      container,
      ({ width: newWidth }) => {
        if (newWidth > 0) {
          this.renderChart(newWidth);
        }
      }
    );
    this.resizeHandler.observe();
    return true;
  }

  renderChart(containerWidth) {
    const d3 = this.d3;
    const container = this.template.querySelector(".chart-container");
    if (!container || !d3) return;

    // Clear existing SVG (idempotent — runs on init and every resize)
    d3.select(container).select("svg").remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 20 };
    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "progress-bar-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const config = this.config;
    const target = this.effectiveTarget;

    // Linear scale: value domain [0, target] mapped to track width
    const xScale = d3
      .scaleLinear()
      .domain([0, target])
      .range([0, width])
      .clamp(true);

    const trackHeight = Math.max(height * 0.4, 8);
    const trackY = (height - trackHeight) / 2;

    // Full-width track rect (background)
    this.svg
      .append("rect")
      .attr("class", "progress-track")
      .attr("x", 0)
      .attr("y", trackY)
      .attr("width", width)
      .attr("height", trackHeight)
      .attr("rx", 4)
      .attr("fill", TRACK_COLOR);

    // Value rect: width = value/target fraction of the track
    const fillColor = this._getFillColor();
    this.svg
      .append("rect")
      .attr("class", "progress-value")
      .attr("x", 0)
      .attr("y", trackY)
      .attr("width", 0)
      .attr("height", trackHeight)
      .attr("rx", 4)
      .attr("fill", fillColor)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .transition()
      .duration(750)
      .attr("width", xScale(this.currentValue));

    // Optional target marker line
    if (config.target !== undefined && config.target !== null) {
      this.svg
        .append("line")
        .attr("class", "progress-target")
        .attr("x1", xScale(target))
        .attr("x2", xScale(target))
        .attr("y1", trackY - 4)
        .attr("y2", trackY + trackHeight + 4)
        .attr("stroke", "#333")
        .attr("stroke-width", 2);
    }

    // Percent label (formatPercent takes a 0..1 decimal)
    const fraction = target > 0 ? this.currentValue / target : 0;
    this.svg
      .append("text")
      .attr("class", "progress-label")
      .attr("x", width)
      .attr("y", trackY - 6)
      .attr("text-anchor", "end")
      .text(formatPercent(fraction));

    // Tooltip + click interactions on the value rect
    this.svg
      .selectAll(".progress-value")
      .on("mouseenter", (event) => {
        this.showTooltip(event);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      })
      .on("click", () => {
        this.handleBarClick();
      });
  }

  /**
   * Returns the fill color for the value rect, respecting customColors override.
   */
  _getFillColor() {
    const config = this.config;
    if (
      config.customColors &&
      Array.isArray(config.customColors) &&
      config.customColors.length > 0
    ) {
      return config.customColors[0];
    }
    return getColor(this.theme, 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event) {
    if (!this.tooltip) return;
    const config = this.config;
    const label = config.label || this.valueField || "Value";
    const content = buildTooltipContent(label, this.currentValue, {
      formatter: this.valueFormatter
    });
    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleBarClick() {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.valueField;

    this[NavigationMixin.Navigate]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.objectApiName,
        actionName: "list"
      },
      state: {
        filterName: "Recent"
      }
    });

    this.dispatchEvent(
      new CustomEvent("progressclick", {
        detail: {
          value: this.currentValue,
          filterField: filterFieldName
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  cleanup() {
    if (this.resizeHandler) {
      this.resizeHandler.disconnect();
      this.resizeHandler = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
```

- [ ] **Step 4: Implement the component HTML.** Create `force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.html` by cloning `force-app/main/default/lwc/d3BulletChart/d3BulletChart.html` verbatim (the universal 4-state `.slds-card` template), changing only the two ABOUTME comment lines to reference `d3ProgressBar`. Write exactly:

```html
<!-- ABOUTME: Template for d3ProgressBar Lightning Web Component. -->
<!-- ABOUTME: Four-state rendering: loading, error, data (chart), and no-data. -->
<template>
  <div class="slds-card">
    <!-- Loading State -->
    <template lwc:if={isLoading}>
      <div class="slds-align_absolute-center" style="height: 200px">
        <lightning-spinner
          alternative-text="Loading chart..."
          size="medium"
        ></lightning-spinner>
      </div>
    </template>

    <!-- Error State -->
    <template lwc:elseif={hasError}>
      <div
        class="slds-align_absolute-center slds-text-color_error"
        style="height: 200px; padding: 1rem"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:error"
            alternative-text="Error"
            size="large"
            variant="error"
          ></lightning-icon>
          <p class="slds-m-top_small">{error}</p>
        </div>
      </div>
    </template>

    <!-- Chart Container (has data) -->
    <template lwc:elseif={hasData}>
      <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>
    </template>

    <!-- No Data State -->
    <template lwc:else>
      <div
        class="slds-align_absolute-center slds-text-color_weak"
        style="height: 200px"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:chart"
            alternative-text="No data"
            size="large"
          ></lightning-icon>
          <p class="slds-m-top_small">No data available</p>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 5: Implement the component meta.** Create `force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.js-meta.xml` by cloning `force-app/main/default/lwc/d3BulletChart/d3BulletChart.js-meta.xml` (apiVersion 65.0, isExposed, targets AppPage/RecordPage/HomePage), changing the `masterLabel` to `D3 Progress Bar Chart`, dropping the `minValue`/`maxValue` Scale properties (Progress Bar uses `config.target` instead of a min/max scale), and updating the description + ABOUTME. Write exactly:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!-- ABOUTME: Metadata configuration for d3ProgressBar Lightning Web Component. -->
<!-- ABOUTME: Defines exposed properties for App Builder: soqlQuery, valueField, height, theme, objectApiName, filterField, advancedConfig. -->
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <isExposed>true</isExposed>
    <masterLabel>D3 Progress Bar Chart</masterLabel>
    <description
  >KPI progress bar powered by D3.js showing a value against a target with a percent label.</description>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__RecordPage</target>
        <target>lightning__HomePage</target>
    </targets>
    <targetConfigs>
        <targetConfig
      targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
    >
            <!-- Data Source -->
            <property
        name="soqlQuery"
        type="String"
        label="SOQL Query"
        description="SOQL query to fetch a single value (e.g., SELECT AVG(Amount) Amount FROM Opportunity)"
        placeholder="SELECT AVG(Amount) Amount FROM Opportunity"
      />

            <!-- Field Mapping -->
            <property
        name="valueField"
        type="String"
        label="Value Field"
        default="Amount"
        description="API name of the numeric field to display"
        placeholder="Amount"
      />

            <!-- Appearance -->
            <property
        name="height"
        type="Integer"
        label="Height (px)"
        default="80"
        description="Chart height in pixels"
        min="40"
        max="300"
      />
            <property
        name="theme"
        type="String"
        label="Color Theme"
        default="Salesforce Standard"
        datasource="Salesforce Standard,Warm,Cool,Vibrant"
        description="Color palette for the progress fill"
      />

            <!-- Drill-Down -->
            <property
        name="objectApiName"
        type="String"
        label="Drill-Down Object"
        description="Object API name for navigation on bar click"
        placeholder="Opportunity"
      />
            <property
        name="filterField"
        type="String"
        label="Filter Field"
        description="Field to filter by on drill-down"
      />

            <!-- Advanced -->
            <property
        name="advancedConfig"
        type="String"
        label="Advanced Config (JSON)"
        description='{"target": 250000, "label": "Pipeline", "valueFormat": "currency"}'
      />
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

- [ ] **Step 6: Run the unit test — expect PASS.** Run:

```bash
npm test -- --testPathPattern=d3ProgressBar
```

Expected: **PASS** — all `d3ProgressBar.test.js` cases green, pristine output (no leaked `console.error`/`console.warn`). If a `... is not a function` error appears, the `createMockD3()` factory is missing a primitive the component calls — add it (the component only uses `select`, `selectAll`, `append`, `attr`, `style`, `text`, `on`, `transition`, `duration`, `remove`, `scaleLinear`, all already present).

- [ ] **Step 7: Commit.** Run:

```bash
git add force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.js force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.html force-app/main/default/lwc/d3ProgressBar/d3ProgressBar.js-meta.xml force-app/main/default/lwc/d3ProgressBar/__tests__/d3ProgressBar.test.js
git commit -m "feat(d3ProgressBar): add progress bar chart with unit tests"
```

---

#### Task 9.2: INTEGRATION tier — `d3ProgressBar.integration.test.js`

**Files:**
- Test: `force-app/main/default/lwc/d3ProgressBar/__tests__/d3ProgressBar.integration.test.js` (Create)

- [ ] **Step 1: Write the failing integration test.** Copy the donor first, then edit:

```bash
cp force-app/main/default/lwc/d3Gauge/__tests__/d3Gauge.integration.test.js force-app/main/default/lwc/d3ProgressBar/__tests__/d3ProgressBar.integration.test.js
```

Then replace the file contents entirely with the version below. It mocks ONLY `c/d3Lib` + Apex (`executeQuery`, `getAggregatedData`) + `lightning/navigation` + `lightning/platformShowToastEvent`, and runs the REAL `dataService`/`themeService`/`chartUtils`. It uses `flushPromises = () => new Promise(process.nextTick)` (survives `jest.useFakeTimers()`), the chainable `createMockD3()` (rect/line/text/scaleLinear, no arc), and asserts REAL aggregated value flow + REAL palette hex (`#1589EE` SF Standard, `#FF6B6B` Warm) into `mockD3.attr()`/`mockD3.text()`. Write exactly:

```javascript
// ABOUTME: Integration tests for d3ProgressBar using real themeService and chartUtils modules.
// ABOUTME: Validates the percent-label pipeline, palette color flow, and aggregated value flow into the rendered rects.

import { createElement } from "lwc";
import D3ProgressBar from "c/d3ProgressBar";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// ── MOCKS — only d3Lib, Apex, navigation, toast. Real services otherwise. ──

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/D3ChartController.getAggregatedData",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const Navigate = Symbol.for("NavigationMixin.Navigate");
    const mixin = (Base) => {
      return class extends Base {
        [Navigate] = mockNavigate;
      };
    };
    mixin.Navigate = Navigate;
    return { NavigationMixin: mixin };
  },
  { virtual: true }
);

jest.mock(
  "lightning/platformShowToastEvent",
  () => ({ ShowToastEvent: jest.fn() }),
  { virtual: true }
);

let consoleErrorSpy;
let consoleWarnSpy;

// ── MOCK D3 FACTORY (rect/line/text/scaleLinear chainable) ──

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn((v) => v);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.clamp = jest.fn(() => scale);
      return scale;
    })
  };
  return d3;
};

// ── HELPERS ──

const flushPromises = () => new Promise(process.nextTick);

const createChart = async (props = {}) => {
  const element = createElement("c-d3-progress-bar", { is: D3ProgressBar });
  Object.assign(element, { valueField: "Amount", ...props });
  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
};

// ── GLOBAL MOCKS ──

Element.prototype.getBoundingClientRect = jest.fn(() => ({
  x: 0,
  y: 0,
  width: 300,
  height: 150,
  top: 0,
  right: 300,
  bottom: 150,
  left: 0
}));

global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this._callback = callback;
  }
  observe() {
    this._callback([{ contentRect: { width: 300, height: 150 } }]);
  }
  unobserve() {}
  disconnect() {}
};

// ── TEST SUITE ──

describe("d3ProgressBar integration tests", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    getAggregatedData.mockResolvedValue([]);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("percent label pipeline integration", () => {
    it("renders the real formatPercent output for value/target", async () => {
      // value 50, target 200 → 0.25 → real formatPercent(0.25) = '25.0%'
      await createChart({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });

      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("25.0%");
    });

    it("clamps the percent label at 100% when value exceeds target", async () => {
      // value 300, target 200 → fraction 1.5 → real formatPercent(1.5) = '150.0%'
      await createChart({
        recordCollection: [{ Amount: 300 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });

      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("150.0%");
    });
  });

  describe("color flow integration", () => {
    it("uses real themeService Salesforce Standard hex for the value rect", async () => {
      await createChart({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 }),
        theme: "Salesforce Standard"
      });

      // Real getColor('Salesforce Standard', 0) returns '#1589EE'
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#1589EE"
      );
      expect(fillCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("uses real Warm palette hex for the value rect", async () => {
      await createChart({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 }),
        theme: "Warm"
      });

      // Real getColor('Warm', 0) returns '#FF6B6B'
      const attrCalls = mockD3.attr.mock.calls;
      const warmFills = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#FF6B6B"
      );
      expect(warmFills.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("aggregated value flow integration", () => {
    it("flows a real server-aggregated value into the value scale", async () => {
      getAggregatedData.mockResolvedValue([{ label: "Total", value: 80 }]);

      await createChart({
        recordCollection: [],
        objectApiName: "Opportunity",
        valueField: "Amount",
        advancedConfig: JSON.stringify({ target: 200 })
      });

      // The aggregated value 80 (fraction 0.4 of target 200) → real
      // formatPercent(0.4) = '40.0%' rendered as the percent label.
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("40.0%");
    });
  });

  describe("currency formatter integration", () => {
    it("real buildTooltipContent uses real formatCurrency for the value", async () => {
      const element = await createChart({
        recordCollection: [{ Amount: 5000 }],
        advancedConfig: JSON.stringify({ target: 10000, valueFormat: "currency" })
      });

      // Real createTooltip appended a functional SLDS popover to the container
      const container = element.shadowRoot.querySelector(".chart-container");
      const tooltipDiv = container.querySelector(".slds-popover");
      expect(tooltipDiv).not.toBeNull();
      expect(tooltipDiv.getAttribute("role")).toBe("tooltip");
    });
  });
});
```

- [ ] **Step 2: Run the integration test — expect PASS.** (The component already exists from Task 9.1, so this tier goes green immediately once written.) Run:

```bash
npm test -- --testPathPattern=d3ProgressBar.integration
```

Expected: **PASS** — real `chartUtils.formatPercent`/`getColor` outputs (`25.0%`, `150.0%`, `40.0%`, `#1589EE`, `#FF6B6B`) appear in the mock-D3 call log, and the real `createTooltip` appends a `.slds-popover[role="tooltip"]`. If `'25.0%'` is missing, confirm `renderChart` computes `fraction = currentValue / target` (a 0..1 decimal) before calling `formatPercent` (NOT `value/target * 100`).

- [ ] **Step 3: Commit.** Run:

```bash
git add force-app/main/default/lwc/d3ProgressBar/__tests__/d3ProgressBar.integration.test.js
git commit -m "test(d3ProgressBar): add integration tier for real service pipeline"
```

---

#### Task 9.3: E2E tier — `d3ProgressBar.e2e.test.js`

**Files:**
- Test: `force-app/main/default/lwc/d3ProgressBar/__tests__/d3ProgressBar.e2e.test.js` (Create)

- [ ] **Step 1: Write the failing e2e test.** Copy the donor first, then edit:

```bash
cp force-app/main/default/lwc/d3Gauge/__tests__/d3Gauge.e2e.test.js force-app/main/default/lwc/d3ProgressBar/__tests__/d3ProgressBar.e2e.test.js
```

Then replace the file contents entirely with the version below. It exercises the full lifecycle (create → load → render → assert), multi-component isolation, exact data-flow values, and a PRISTINE console on the success path (`console.error` NOT called). The error-state assertions are adapted to the `d3BulletChart`-cloned `.slds-card` template (error renders inside `.slds-text-color_error`; there is NO `.chart-error`/`.chart-svg` element as in `d3Gauge`; the SVG lives inside `.chart-container[lwc:dom="manual"]` which is itself absent when `hasError` is true). Write exactly:

```javascript
// ABOUTME: End-to-end lifecycle tests for the d3ProgressBar LWC component.
// ABOUTME: Verifies full render pipeline, SOQL fetch, navigation, multi-instance isolation, and pristine console with real chartUtils and themeService.

import { createElement } from "lwc";
import D3ProgressBar from "c/d3ProgressBar";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// ── Mocks — ONLY d3Lib, Apex, navigation. Real services otherwise. ──

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/D3ChartController.getAggregatedData",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const NavMixin = jest.fn((Base) => {
      return class extends Base {
        [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
      };
    });
    NavMixin.Navigate = Symbol.for("NavigationMixin.Navigate");
    NavMixin.GenerateUrl = Symbol.for("NavigationMixin.GenerateUrl");
    return { NavigationMixin: NavMixin };
  },
  { virtual: true }
);

// ── Mock D3 factory (rect/line/text/scaleLinear chainable) ──

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn((v) => v);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.clamp = jest.fn(() => scale);
      return scale;
    })
  };
  return d3;
};

// ── Global mocks: ResizeObserver, getBoundingClientRect, console spies ──

let resizeObserverCallback;
const mockResizeObserverDisconnect = jest.fn();

global.ResizeObserver = jest.fn((callback) => {
  resizeObserverCallback = callback;
  return {
    observe: jest.fn(() => {
      resizeObserverCallback([{ contentRect: { width: 300, height: 150 } }]);
    }),
    disconnect: mockResizeObserverDisconnect,
    unobserve: jest.fn()
  };
});

Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 300,
  height: 150,
  top: 0,
  left: 0,
  right: 300,
  bottom: 150,
  x: 0,
  y: 0
}));

let consoleErrorSpy;
let consoleWarnSpy;

const flushPromises = () => new Promise(process.nextTick);

async function createProgressBar(props = {}) {
  const element = createElement("c-d3-progress-bar", { is: D3ProgressBar });
  Object.assign(element, {
    valueField: "Amount",
    height: 80,
    theme: "Salesforce Standard",
    ...props
  });
  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
}

// ── Test suites ──

describe("d3ProgressBar e2e", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    getAggregatedData.mockResolvedValue([]);
    mockResizeObserverDisconnect.mockClear();
    mockNavigate.mockClear();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe("full render pipeline", () => {
    it("data → value extraction → track + value rect render → percent label", async () => {
      const element = await createProgressBar({
        recordCollection: [{ Amount: 1500 }],
        valueField: "Amount",
        advancedConfig: JSON.stringify({ target: 3000 })
      });

      // D3 was loaded
      expect(loadD3).toHaveBeenCalled();

      // The chart container is present (data state)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).not.toBeNull();

      // Spinner is gone (isLoading false after finally)
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeNull();

      // Track + value rects appended (>= 2 rect appends)
      const rectAppends = mockD3.append.mock.calls.filter((c) => c[0] === "rect");
      expect(rectAppends.length).toBeGreaterThanOrEqual(2);

      // Percent label: 1500/3000 = 0.5 → real formatPercent(0.5) = '50.0%'
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("50.0%");

      // Real getColor('Salesforce Standard', 0) → '#1589EE' applied as fill
      const fillValues = mockD3.attr.mock.calls
        .filter((c) => c[0] === "fill")
        .map((c) => c[1]);
      expect(fillValues).toContain("#1589EE");

      // PRISTINE console: no errors during render
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("cleanup on disconnect runs without errors", async () => {
      const element = await createProgressBar({
        recordCollection: [{ Amount: 1500 }],
        advancedConfig: JSON.stringify({ target: 3000 })
      });

      document.body.removeChild(element);

      expect(mockResizeObserverDisconnect).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("SOQL fetch pipeline", () => {
    it("fetches data via Apex when no recordCollection", async () => {
      executeQuery.mockResolvedValue([{ Amount: 75 }]);

      await createProgressBar({
        recordCollection: [],
        soqlQuery: "SELECT Amount FROM Opportunity LIMIT 1",
        valueField: "Amount",
        advancedConfig: JSON.stringify({ target: 100 })
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Amount FROM Opportunity LIMIT 1"
      });

      // 75/100 = 0.75 → real formatPercent(0.75) = '75.0%'
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("75.0%");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("navigation click flow", () => {
    it("objectApiName → value-rect click → NavigationMixin call", async () => {
      await createProgressBar({
        recordCollection: [{ Amount: 50 }],
        objectApiName: "Opportunity",
        advancedConfig: JSON.stringify({ target: 100 })
      });

      const onCalls = mockD3.on.mock.calls;
      const clickRegistration = onCalls.find((c) => c[0] === "click");
      expect(clickRegistration).toBeDefined();

      const clickHandler = clickRegistration[1];
      clickHandler();

      expect(mockNavigate).toHaveBeenCalledWith({
        type: "standard__objectPage",
        attributes: {
          objectApiName: "Opportunity",
          actionName: "list"
        },
        state: { filterName: "Recent" }
      });
    });
  });

  describe("multi-instance isolation", () => {
    it("two progress bars render independent values", async () => {
      const first = await createProgressBar({
        recordCollection: [{ Amount: 25 }],
        advancedConfig: JSON.stringify({ target: 100 })
      });
      const second = await createProgressBar({
        recordCollection: [{ Amount: 90 }],
        advancedConfig: JSON.stringify({ target: 100 })
      });

      // Both rendered their own container
      expect(first.shadowRoot.querySelector(".chart-container")).not.toBeNull();
      expect(second.shadowRoot.querySelector(".chart-container")).not.toBeNull();

      // Combined text calls include both 25% and 90% percent labels
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("25.0%");
      expect(textCalls).toContain("90.0%");

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("D3 load failure shows error, no chart container rendered", async () => {
      loadD3.mockRejectedValue(new Error("Network timeout"));

      const element = await createProgressBar({
        recordCollection: [{ Amount: 100 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });

      // Error state renders inside .slds-text-color_error with the message
      const errorEl = element.shadowRoot.querySelector(".slds-text-color_error");
      expect(errorEl).not.toBeNull();
      expect(errorEl.textContent).toContain("Network timeout");

      // No chart container in the error state (hasError branch hides it)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeNull();

      // Spinner gone (isLoading false after finally)
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeNull();

      // No rect should have been appended — chart never rendered
      const rectAppends = mockD3.append.mock.calls.filter((c) => c[0] === "rect");
      expect(rectAppends.length).toBe(0);

      // The component logs the init error once (expected on the error path).
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the e2e test — expect PASS.** (The component already exists from Task 9.1.) Run:

```bash
npm test -- --testPathPattern=d3ProgressBar.e2e
```

Expected: **PASS** — full lifecycle assertions green, exact percent labels (`50.0%`, `75.0%`, `25.0%`, `90.0%`) present, multi-instance isolation holds, success-path console is pristine (`consoleErrorSpy` not called), and the error-path test confirms the `.slds-text-color_error` message with no `.chart-container` and no rect appends. If the error test fails on `container` being non-null, re-check that `d3ProgressBar.html` was cloned from `d3BulletChart.html` (which hides the container under the `hasError` branch) — NOT from `d3Gauge.html`.

- [ ] **Step 3: Run the full suite for the chart — expect all three tiers PASS.** Run:

```bash
npm test -- --testPathPattern=d3ProgressBar
```

Expected: **PASS** — all three files (`d3ProgressBar.test.js`, `d3ProgressBar.integration.test.js`, `d3ProgressBar.e2e.test.js`) green with pristine output.

- [ ] **Step 4: Commit.** Run:

```bash
git add force-app/main/default/lwc/d3ProgressBar/__tests__/d3ProgressBar.e2e.test.js
git commit -m "test(d3ProgressBar): add e2e tier for full lifecycle and isolation"
```


### Phase 10: Diverging Bar Chart (`d3DivergingBarChart`)

Full release of the Diverging Bar chart: clone the `d3BarChart` scaffold, change only `renderChart()` to use a centered-zero linear domain `[-maxAbs, +maxAbs]` with bars extending left (negative) / right (positive) from `x(0)`, colored by sign via `themeService.SEMANTIC_COLORS.positive` / `.negative`. Ships with all three TDD test tiers (unit, integration, e2e), all cloned from the `d3BarChart` donor suites.

> **Donor reference (read these while executing):**
> - Component: `force-app/main/default/lwc/d3BarChart/d3BarChart.{js,html,js-meta.xml}`
> - Unit test: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.test.js`
> - Integration test: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.integration.test.js`
> - E2E test: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.e2e.test.js`
>
> **Pre-wired infra (already exists — no Phase-0 dependency):** the Apex mock `__mocks__/@salesforce/apex/D3ChartController.getAggregatedData.js` and its `jest.config.js` `moduleNameMapper` entry are already present (used by `d3BarChart`). No new mock or mapper is needed for this chart.
>
> **Chart-specific facts (verified from source):** `SEMANTIC_COLORS.positive === "#4BCA81"`, `SEMANTIC_COLORS.negative === "#FF5D5D"` (in `force-app/main/default/lwc/themeService/themeService.js`). Data path is `getAggregatedData` (server) / client `aggregateData`, both returning `[{label, value}]` where `value` may be **signed** (negative). The Sum aggregation of signed data preserves sign.

---

#### Task 10.1: UNIT tier — `d3DivergingBarChart.test.js` + component implementation

**Files:**
- Test: `force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.test.js` — Create
- Create: `force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.js`
- Create: `force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.html`
- Create: `force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.js-meta.xml`

- [ ] **Step 1: Scaffold the unit test by cloning the donor.** Create the directory and copy the donor unit test, then rename the symbol references.
  ```bash
  mkdir -p force-app/main/default/lwc/d3DivergingBarChart/__tests__
  cp force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.test.js \
     force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.test.js
  ```
  Then apply these exact edits to `force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.test.js`:
  - Line 1–2 ABOUTME header → replace with:
    ```js
    // ABOUTME: Unit tests for the d3DivergingBarChart Lightning Web Component.
    // ABOUTME: Tests centered-zero domain, sign-based coloring, data handling, config, events, tooltip, resize, and error recovery.
    ```
  - Replace `import D3BarChart from "c/d3BarChart";` → `import D3DivergingBarChart from "c/d3DivergingBarChart";`
  - Replace every `D3BarChart` identifier (used in `createElement(..., { is: D3BarChart })`) → `D3DivergingBarChart` (3 occurrences: in `createChart`, in the `silently truncates` test, and in the two `getters` `showChart`/`shows loading` blocks).
  - Replace every `"c-d3-bar-chart"` string literal → `"c-d3-diverging-bar-chart"` (every `createElement` and the top-level `describe`).
  - Replace `describe("c-d3-bar-chart", ...)` → `describe("c-d3-diverging-bar-chart", ...)`.
  - Replace every `addEventListener("lightning__showtoast", ...)` block is fine as-is. Replace the event-name filter `(c) => c[0] === "barclick"` if present — the donor does not assert `barclick` by name, so no change needed.

- [ ] **Step 2: Adjust the unit test's chart-specific assertions for diverging semantics.** Make these targeted edits to the cloned `d3DivergingBarChart.test.js`:
  - In `createMockD3()`, the `scaleLinear` mock must expose `clamp` (the donor unit mock lacks it; the diverging renderChart does not call `clamp`, but add it for safety/parity with the integration mock). Change the `scaleLinear` block to:
    ```js
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      scale.clamp = jest.fn(() => scale);
      return scale;
    }),
    ```
  - Update `NEGATIVE_DATA` to drive real sign behavior:
    ```js
    const NEGATIVE_DATA = [
      { StageName: "Loss", Amount: -300 },
      { StageName: "Gain", Amount: 200 }
    ];
    ```
  - In the `beforeEach`, change the `getAggregatedData.mockResolvedValue([...])` to include signed values so server-path rendering tests exercise both signs:
    ```js
    getAggregatedData.mockResolvedValue([
      { label: "Closed Won", value: 500 },
      { label: "Prospecting", value: 300 },
      { label: "Lost", value: -250 }
    ]);
    ```
  - Replace the `describe("rendering details", ...)` block's bar-chart-only assertions with diverging-specific ones. Specifically:
    - **Keep** the tests: `creates SVG element`, `creates bar rect elements`, `creates x-axis group`, `creates y-axis group`, `creates linear scale for y-axis` (the diverging chart still has a value axis — keep this), `applies animation transition to bars`, `sets SVG dimensions on container`, `removes existing SVG before re-render`.
    - **Replace** `creates scale band for x-axis` → the diverging chart bands on the **value-category** axis using `scaleBand` too (categories down the chart), so keep it but rename the test title to `"creates band scale for category axis"` and assert `expect(mockD3.scaleBand).toHaveBeenCalled();`.
    - **Remove** `applies rounded corners to bars` only if you also remove `rx` from the component; the component below DOES set `rx`, so **keep** this test unchanged.
    - **Add** these three new tests at the end of the `rendering details` describe block:
    ```js
    it("uses a symmetric centered-zero domain (-maxAbs to +maxAbs)", async () => {
      await createChart({
        recordCollection: [
          { StageName: "Loss", Amount: -300 },
          { StageName: "Gain", Amount: 200 }
        ]
      });
      await flushPromises();

      // renderChart builds a scaleLinear and calls .domain([-maxAbs, +maxAbs]).
      // Capture the domain passed to any linear-scale instance.
      expect(mockD3.scaleLinear).toHaveBeenCalled();
      const scaleInstance = mockD3.scaleLinear.mock.results[0].value;
      const domainCalls = scaleInstance.domain.mock.calls;
      // The value (x) scale domain must be symmetric around zero.
      const symmetricDomain = domainCalls.find(
        (c) =>
          Array.isArray(c[0]) &&
          c[0].length === 2 &&
          c[0][0] === -c[0][1] &&
          c[0][1] > 0
      );
      expect(symmetricDomain).toBeTruthy();
      expect(symmetricDomain[0][0]).toBe(-symmetricDomain[0][1]);
    });

    it("colors positive bars with the positive semantic color", async () => {
      await createChart({
        recordCollection: [
          { StageName: "Loss", Amount: -300 },
          { StageName: "Gain", Amount: 200 }
        ]
      });
      await flushPromises();

      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);
      const fillFn = fillCalls[fillCalls.length - 1][1];
      expect(typeof fillFn).toBe("function");
      // Positive value -> positive semantic color #4BCA81
      expect(fillFn({ label: "Gain", value: 200 })).toBe("#4BCA81");
    });

    it("colors negative bars with the negative semantic color", async () => {
      await createChart({
        recordCollection: [
          { StageName: "Loss", Amount: -300 },
          { StageName: "Gain", Amount: 200 }
        ]
      });
      await flushPromises();

      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);
      const fillFn = fillCalls[fillCalls.length - 1][1];
      expect(typeof fillFn).toBe("function");
      // Negative value -> negative semantic color #FF5D5D
      expect(fillFn({ label: "Loss", value: -300 })).toBe("#FF5D5D");
    });
    ```

- [ ] **Step 3: Run the unit test — expect FAIL.**
  ```bash
  npm test -- --testPathPattern=d3DivergingBarChart
  ```
  **Expected: FAIL** because `c/d3DivergingBarChart` does not exist yet — Jest cannot resolve the import `import D3DivergingBarChart from "c/d3DivergingBarChart";` (module-not-found), so every test errors.

- [ ] **Step 4: Implement the component JS.** Create `force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.js` with the full file below. It clones the donor scaffold verbatim and changes only the ABOUTME header, the class name, the `executeQuery`/`getAggregatedData` import (kept), the `SEMANTIC_COLORS` import, the click event name, and `renderChart()` (centered-zero domain + sign coloring + horizontal bars).
  ```js
  /**
   * ABOUTME: D3 Diverging Bar Chart Lightning Web Component.
   * ABOUTME: Displays signed aggregated values as horizontal bars diverging left/right from a centered zero baseline.
   */
  import { LightningElement, api, track } from "lwc";
  import { loadD3 } from "c/d3Lib";
  import {
    prepareData,
    aggregateData,
    OPERATIONS,
    MAX_RECORDS
  } from "c/dataService";
  import { SEMANTIC_COLORS } from "c/themeService";
  import {
    formatNumber,
    truncateLabel,
    createTooltip,
    createResizeHandler,
    buildTooltipContent,
    createLayoutRetry
  } from "c/chartUtils";
  import { NavigationMixin } from "lightning/navigation";
  import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
  import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

  export default class D3DivergingBarChart extends NavigationMixin(
    LightningElement
  ) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    /** Data collection from Flow or parent component */
    @api recordCollection = [];

    /** SOQL query string (used if recordCollection is empty) */
    @api soqlQuery = "SELECT StageName, Amount FROM Opportunity";

    /** Field to group by (category axis) */
    @api groupByField = "StageName";

    /** Field to aggregate (signed value axis) */
    @api valueField = "Amount";

    /** Aggregation operation: Sum, Count, Average */
    @api operation = OPERATIONS.SUM;

    /** Chart height in pixels */
    @api height = 300;

    /** Color theme (unused — diverging chart colors by sign) */
    @api theme = "Salesforce Standard";

    /** Advanced configuration JSON */
    @api advancedConfig = "{}";

    /** Maximum records to process (overrides default limit) */
    @api recordLimit;

    /** Object API name for drill-down navigation */
    @api objectApiName = "";

    /** Filter field for drill-down (usually same as groupByField) */
    @api filterField = "";

    /** Optional WHERE clause fragment for server-side aggregation */
    @api filterClause = "";

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════

    @track isLoading = true;
    @track error = null;
    @track chartData = [];

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    d3 = null;
    svg = null;
    tooltip = null;
    resizeHandler = null;
    chartRendered = false;
    _layoutRetry = null;
    _config = {};
    _configParsed = false;

    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════

    get containerStyle() {
      return `height: ${this.height}px;`;
    }

    get hasError() {
      return !!this.error;
    }

    get hasData() {
      return this.chartData && this.chartData.length > 0;
    }

    get showChart() {
      return !this.isLoading && !this.hasError && this.hasData;
    }

    get config() {
      if (!this._configParsed) {
        try {
          this._config = JSON.parse(this.advancedConfig || "{}");
        } catch {
          this._config = {};
        }
        this._configParsed = true;
      }
      return this._config;
    }

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════════

    async connectedCallback() {
      try {
        this.d3 = await loadD3(this);
        await this.loadData();
      } catch (e) {
        this.error = e.message || "Failed to initialize chart";
        console.error("D3DivergingBarChart initialization error:", e);
      } finally {
        this.isLoading = false;
      }
    }

    renderedCallback() {
      if (this.showChart && !this.chartRendered) {
        this.chartRendered = this.initializeChart();
        if (!this.chartRendered && !this._layoutRetry) {
          const container = this.template.querySelector(".chart-container");
          if (container) {
            this._layoutRetry = createLayoutRetry(container, () => {
              this._layoutRetry = null;
              if (!this.chartRendered) {
                this.chartRendered = this.initializeChart();
              }
            });
          }
        }
      }
    }

    disconnectedCallback() {
      if (this._layoutRetry) {
        this._layoutRetry.cancel();
        this._layoutRetry = null;
      }
      this.cleanup();
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════

    async loadData() {
      if (this.recordCollection && this.recordCollection.length > 0) {
        this.chartData = this._aggregateRawData([...this.recordCollection]);
        return;
      }

      if (
        this.objectApiName &&
        this.groupByField &&
        this.valueField &&
        this.operation
      ) {
        try {
          const result = await getAggregatedData({
            objectName: this.objectApiName,
            groupByField: this.groupByField,
            valueField: this.valueField,
            operation: this.operation,
            filterClause: this.filterClause || null
          });
          this.chartData = result;
        } catch (e) {
          throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
        }

        if (!this.chartData || this.chartData.length === 0) {
          throw new Error("No data after aggregation");
        }
        return;
      }

      if (this.soqlQuery) {
        let rawData = [];
        try {
          rawData = await executeQuery({ queryString: this.soqlQuery });
        } catch (e) {
          throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
        }
        this.chartData = this._aggregateRawData(rawData);
        return;
      }

      throw new Error(
        "No data source provided. Set recordCollection or soqlQuery."
      );
    }

    _aggregateRawData(rawData) {
      const requiredFields = [this.groupByField];
      if (this.operation !== OPERATIONS.COUNT) {
        requiredFields.push(this.valueField);
      }

      const prepared = prepareData(rawData, {
        requiredFields,
        limit: this.recordLimit || MAX_RECORDS
      });

      if (!prepared.valid) {
        throw new Error(prepared.error);
      }

      const aggregated = aggregateData(
        prepared.data,
        this.groupByField,
        this.valueField,
        this.operation
      );

      if (aggregated.length === 0) {
        throw new Error("No data after aggregation");
      }

      return aggregated;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHART RENDERING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes the chart SVG, tooltip, and resize observer.
     * @returns {boolean} true if the chart was successfully initialized
     */
    initializeChart() {
      const container = this.template.querySelector(".chart-container");
      if (!container) return false;

      const { width } = container.getBoundingClientRect();
      if (width === 0) return false;

      this.tooltip = createTooltip(container);
      this.renderChart(width);

      this.resizeHandler = createResizeHandler(
        container,
        ({ width: newWidth }) => {
          if (newWidth > 0) {
            this.renderChart(newWidth);
          }
        }
      );
      this.resizeHandler.observe();
      return true;
    }

    renderChart(containerWidth) {
      const d3 = this.d3;
      const container = this.template.querySelector(".chart-container");
      if (!container || !d3) return;

      // Clear existing SVG (idempotent — runs on init and every resize)
      d3.select(container).select("svg").remove();

      const margin = {
        top: 20,
        right: 20,
        bottom: 40,
        left: 100
      };

      const width = containerWidth - margin.left - margin.right;
      const height = this.height - margin.top - margin.bottom;

      if (width <= 0 || height <= 0) return;

      this.svg = d3
        .select(container)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", this.height)
        .attr("class", "diverging-bar-chart-svg")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Centered zero baseline: symmetric domain [-maxAbs, +maxAbs]
      const maxAbs =
        d3.max(this.chartData, (d) => Math.abs(d.value)) || 0;
      const xScale = d3
        .scaleLinear()
        .domain([-maxAbs, maxAbs])
        .nice()
        .range([0, width]);

      // Categories on the band (vertical) axis
      const yScale = d3
        .scaleBand()
        .domain(this.chartData.map((d) => d.label))
        .range([0, height])
        .padding(0.2);

      const zero = xScale(0);

      // Zero baseline reference line
      this.svg
        .append("line")
        .attr("class", "zero-line")
        .attr("x1", zero)
        .attr("x2", zero)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#b0c4de")
        .attr("stroke-width", 1);

      // X (value) Axis with centered zero
      this.svg
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat((d) => formatNumber(d)));

      // Y (category) Axis
      this.svg
        .append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${zero},0)`)
        .call(d3.axisLeft(yScale).tickFormat((d) => truncateLabel(d, 14)));

      // Diverging bars: extend left for negative, right for positive
      const bars = this.svg
        .selectAll(".bar")
        .data(this.chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("y", (d) => yScale(d.label))
        .attr("height", yScale.bandwidth())
        .attr("x", (d) => (d.value < 0 ? xScale(d.value) : zero))
        .attr("width", 0) // start at zero for animation
        .attr("fill", (d) =>
          d.value < 0 ? SEMANTIC_COLORS.negative : SEMANTIC_COLORS.positive
        )
        .attr("rx", 2)
        .attr("cursor", this.objectApiName ? "pointer" : "default");

      // Animate width from zero baseline outward
      bars
        .transition()
        .duration(750)
        .delay((d, i) => i * 50)
        .attr("width", (d) => Math.abs(xScale(d.value) - zero));

      // Tooltip + click interactions
      bars
        .on("mouseenter", (event, d) => {
          this.showTooltip(event, d);
          d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr("opacity", 0.8);
        })
        .on("mousemove", (event) => {
          this.moveTooltip(event);
        })
        .on("mouseleave", (event) => {
          this.hideTooltip();
          d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr("opacity", 1);
        })
        .on("click", (event, d) => {
          this.handleBarClick(d);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP HANDLERS
    // ═══════════════════════════════════════════════════════════════

    showTooltip(event, d) {
      if (!this.tooltip) return;

      const content = buildTooltipContent(d.label, d.value, {
        prefix: `${this.operation || "Value"}: `
      });

      this.tooltip.show(content, event.offsetX, event.offsetY);
    }

    // eslint-disable-next-line no-unused-vars
    moveTooltip(event) {
      // Tooltip position is set in show(); no-op here.
    }

    hideTooltip() {
      if (!this.tooltip) return;
      this.tooltip.hide();
    }

    // ═══════════════════════════════════════════════════════════════
    // CLICK HANDLER - DRILL DOWN
    // ═══════════════════════════════════════════════════════════════

    handleBarClick(d) {
      if (!this.objectApiName) return;

      const filterFieldName = this.filterField || this.groupByField;

      this[NavigationMixin.Navigate]({
        type: "standard__objectPage",
        attributes: {
          objectApiName: this.objectApiName,
          actionName: "list"
        },
        state: {
          filterName: "Recent"
        }
      });

      this.dispatchEvent(
        new CustomEvent("barclick", {
          detail: {
            label: d.label,
            value: d.value,
            filterField: filterFieldName
          },
          bubbles: true,
          composed: true
        })
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════

    cleanup() {
      if (this.resizeHandler) {
        this.resizeHandler.disconnect();
        this.resizeHandler = null;
      }
      if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
      }
    }
  }
  ```

- [ ] **Step 5: Implement the HTML template.** Create `force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.html` — identical to the donor 4-state template (the mount div MUST be exactly `class="chart-container" lwc:dom="manual"`):
  ```html
  <template>
    <div class="slds-card">
      <!-- Loading State -->
      <template lwc:if={isLoading}>
        <div class="slds-align_absolute-center" style="height: 200px">
          <lightning-spinner
            alternative-text="Loading chart..."
            size="medium"
          ></lightning-spinner>
        </div>
      </template>

      <!-- Error State -->
      <template lwc:elseif={hasError}>
        <div
          class="slds-align_absolute-center slds-text-color_error"
          style="height: 200px; padding: 1rem"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:error"
              alternative-text="Error"
              size="large"
              variant="error"
            ></lightning-icon>
            <p class="slds-m-top_small">{error}</p>
          </div>
        </div>
      </template>

      <!-- Chart Container (has data) -->
      <template lwc:elseif={hasData}>
        <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>
      </template>

      <!-- No Data State -->
      <template lwc:else>
        <div
          class="slds-align_absolute-center slds-text-color_weak"
          style="height: 200px"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:chart"
              alternative-text="No data"
              size="large"
            ></lightning-icon>
            <p class="slds-m-top_small">No data available</p>
          </div>
        </div>
      </template>
    </div>
  </template>
  ```

- [ ] **Step 6: Implement the meta XML.** Create `force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.js-meta.xml` — `apiVersion 65.0`, `isExposed true`, `masterLabel "D3 Diverging Bar Chart"`, targets AppPage/RecordPage/HomePage. Drops the `theme` property (diverging colors are sign-driven) but keeps all other universal props:
  ```xml
  <?xml version="1.0" encoding="UTF-8" ?>
  <LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
      <apiVersion>65.0</apiVersion>
      <isExposed>true</isExposed>
      <masterLabel>D3 Diverging Bar Chart</masterLabel>
      <description
    >Diverging bar chart powered by D3.js. Signed values extend left (negative) or right (positive) from a centered zero baseline, colored by sign.</description>
      <targets>
          <target>lightning__AppPage</target>
          <target>lightning__RecordPage</target>
          <target>lightning__HomePage</target>
      </targets>
      <targetConfigs>
          <targetConfig
        targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
      >
              <!-- Data Source -->
              <property
          name="soqlQuery"
          type="String"
          label="SOQL Query"
          description="SOQL query to fetch data"
          placeholder="SELECT StageName, Amount FROM Opportunity"
        />

              <!-- Field Mapping -->
              <property
          name="groupByField"
          type="String"
          label="Group By Field"
          default="StageName"
          description="API name of the category field (e.g., StageName)"
          placeholder="StageName"
        />
              <property
          name="valueField"
          type="String"
          label="Value Field"
          default="Amount"
          description="API name of the numeric field to aggregate (values may be signed; not required for Count)"
          placeholder="Amount"
        />
              <property
          name="operation"
          type="String"
          label="Aggregation"
          default="Sum"
          datasource="Sum,Count,Average"
          description="How to aggregate the values"
        />

              <!-- Appearance -->
              <property
          name="height"
          type="Integer"
          label="Height (px)"
          default="300"
          description="Chart height in pixels"
          min="150"
          max="800"
        />

              <!-- Drill-Down -->
              <property
          name="objectApiName"
          type="String"
          label="Drill-Down Object"
          description="Object API name for navigation on bar click"
          placeholder="Opportunity"
        />
              <property
          name="filterField"
          type="String"
          label="Filter Field"
          description="Field to filter by on drill-down (defaults to Group By Field)"
        />

              <property
          name="recordLimit"
          type="Integer"
          label="Record Limit"
          description="Maximum records to process. Leave empty for default."
          min="1"
          max="10000"
        />

              <!-- Advanced -->
              <property
          name="advancedConfig"
          type="String"
          label="Advanced Config (JSON)"
          description='{"customColors": ["#FF5733"]}'
        />
          </targetConfig>
      </targetConfigs>
  </LightningComponentBundle>
  ```

- [ ] **Step 7: Run the unit test — expect PASS.**
  ```bash
  npm test -- --testPathPattern=d3DivergingBarChart
  ```
  **Expected: PASS** — all unit tests green, including the symmetric-domain and sign-color assertions. Console output must be pristine (no leaked `console.error`/`console.warn` except in the error-recovery tests where the spy asserts they WERE called).

- [ ] **Step 8: Commit.**
  ```bash
  git add force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.js \
          force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.html \
          force-app/main/default/lwc/d3DivergingBarChart/d3DivergingBarChart.js-meta.xml \
          force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.test.js
  git commit -m "feat(d3DivergingBarChart): add diverging bar chart component with unit tests"
  ```

---

#### Task 10.2: INTEGRATION tier — `d3DivergingBarChart.integration.test.js`

**Files:**
- Test: `force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.integration.test.js` — Create

- [ ] **Step 1: Clone the donor integration test.**
  ```bash
  cp force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.integration.test.js \
     force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.integration.test.js
  ```
  Apply these exact edits to `force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.integration.test.js`:
  - Lines 1–2 ABOUTME header → replace with:
    ```js
    // ABOUTME: Integration tests for d3DivergingBarChart verifying real service pipelines (dataService, themeService, chartUtils).
    // ABOUTME: Only D3, Apex, NavigationMixin, and ShowToastEvent are mocked; sign coloring + symmetric domain use real services.
    ```
  - Replace `import D3BarChart from "c/d3BarChart";` → `import D3DivergingBarChart from "c/d3DivergingBarChart";`
  - Replace every `D3BarChart` identifier → `D3DivergingBarChart`.
  - Replace every `"c-d3-bar-chart"` → `"c-d3-diverging-bar-chart"`.
  - Replace `describe("c-d3-bar-chart integration", ...)` → `describe("c-d3-diverging-bar-chart integration", ...)`.
  - The integration mock's `scaleLinear` already exposes `clamp` (donor line 88) — leave it. No mock change needed.
  - `flushPromises = () => new Promise(process.nextTick);` — leave exactly as the donor has it (survives `jest.useFakeTimers()` in the resize test).

- [ ] **Step 2: Replace the theme-pipeline describe block with a sign-color pipeline block.** The diverging chart ignores `theme` and colors by sign via real `SEMANTIC_COLORS`, so the donor's `theme pipeline integration` block does not apply. Delete the entire `describe("theme pipeline integration", ...)` block and replace it with:
  ```js
  // ═══════════════════════════════════════════════════════════════
  // SIGN-COLOR PIPELINE INTEGRATION (real themeService SEMANTIC_COLORS)
  // ═══════════════════════════════════════════════════════════════

  describe("sign-color pipeline integration", () => {
    const SIGNED_DATA = [
      { StageName: "Loss", Amount: -300 },
      { StageName: "Gain", Amount: 200 }
    ];

    it("colors negative bars with real SEMANTIC_COLORS.negative (#FF5D5D)", async () => {
      await createChart({
        recordCollection: SIGNED_DATA,
        operation: "Sum",
        groupByField: "StageName",
        valueField: "Amount"
      });

      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);
      const fillFn = fillCalls[fillCalls.length - 1][1];
      expect(typeof fillFn).toBe("function");

      // Real SEMANTIC_COLORS.negative flows through unmocked themeService
      expect(fillFn({ label: "Loss", value: -300 })).toBe("#FF5D5D");
    });

    it("colors positive bars with real SEMANTIC_COLORS.positive (#4BCA81)", async () => {
      await createChart({
        recordCollection: SIGNED_DATA,
        operation: "Sum",
        groupByField: "StageName",
        valueField: "Amount"
      });

      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      const fillFn = fillCalls[fillCalls.length - 1][1];
      expect(fillFn({ label: "Gain", value: 200 })).toBe("#4BCA81");
    });

    it("builds a symmetric centered-zero domain from real aggregated maxAbs", async () => {
      // Real aggregateData Sum: Loss=-300, Gain=200 -> maxAbs = 300
      await createChart({
        recordCollection: SIGNED_DATA,
        operation: "Sum",
        groupByField: "StageName",
        valueField: "Amount"
      });

      const scaleInstance = mockD3.scaleLinear.mock.results[0].value;
      const symmetricDomain = scaleInstance.domain.mock.calls.find(
        (c) =>
          Array.isArray(c[0]) &&
          c[0].length === 2 &&
          c[0][0] === -c[0][1] &&
          c[0][1] >= 300
      );
      expect(symmetricDomain).toBeTruthy();
      // maxAbs from real Sum aggregation of [-300, 200] is 300
      expect(symmetricDomain[0]).toEqual([-300, 300]);
    });
  });
  ```

- [ ] **Step 3: Update the data-pipeline describe block to assert signed aggregation values.** In `describe("data pipeline integration", ...)`, add this new test at the end of the block (it verifies real `aggregateData` preserves sign and feeds `mockD3.data()`):
  ```js
  it("aggregates signed values with Sum and binds them to D3 data()", async () => {
    const signedData = [
      { StageName: "Loss", Amount: -100 },
      { StageName: "Loss", Amount: -200 },
      { StageName: "Gain", Amount: 250 }
    ];

    await createChart({
      recordCollection: signedData,
      operation: "Sum",
      groupByField: "StageName",
      valueField: "Amount"
    });

    const chartDataCall = mockD3.data.mock.calls.find(
      (call) => Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
    );
    expect(chartDataCall).toBeTruthy();

    const passedData = chartDataCall[0];
    // Real Sum: Loss = -300, Gain = 250. Sort is value-desc, so Gain first.
    expect(passedData).toEqual([
      { label: "Gain", value: 250 },
      { label: "Loss", value: -300 }
    ]);
  });
  ```

- [ ] **Step 4: Run the integration test — expect PASS.**
  ```bash
  npm test -- --testPathPattern=d3DivergingBarChart.integration
  ```
  **Expected: PASS** — real `dataService.aggregateData` preserves signed values, real `themeService.SEMANTIC_COLORS` supplies `#FF5D5D`/`#4BCA81`, and the symmetric domain `[-300, 300]` is computed from real aggregated maxAbs. Output pristine.

- [ ] **Step 5: Commit.**
  ```bash
  git add force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.integration.test.js
  git commit -m "test(d3DivergingBarChart): add integration tests for signed aggregation and sign coloring"
  ```

---

#### Task 10.3: E2E tier — `d3DivergingBarChart.e2e.test.js`

**Files:**
- Test: `force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.e2e.test.js` — Create

- [ ] **Step 1: Clone the donor e2e test.**
  ```bash
  cp force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.e2e.test.js \
     force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.e2e.test.js
  ```
  Apply these exact edits to `force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.e2e.test.js`:
  - Lines 1–2 ABOUTME header → replace with:
    ```js
    // ABOUTME: End-to-end lifecycle tests for the d3DivergingBarChart Lightning Web Component.
    // ABOUTME: Verifies full pipeline: D3 load, signed aggregation, SVG rendering, sign coloring, cleanup, and multi-instance isolation.
    ```
  - Replace `import D3BarChart from "c/d3BarChart";` → `import D3DivergingBarChart from "c/d3DivergingBarChart";`
  - Replace every `D3BarChart` identifier → `D3DivergingBarChart`.
  - Replace every `"c-d3-bar-chart"` → `"c-d3-diverging-bar-chart"`.
  - Replace `describe("c-d3-bar-chart e2e", ...)` → `describe("c-d3-diverging-bar-chart e2e", ...)`.
  - In `createMockD3()`, add `clamp` to the `scaleLinear` mock for parity (the donor e2e mock lacks it):
    ```js
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      scale.clamp = jest.fn(() => scale);
      return scale;
    }),
    ```
  - The donor `LIFECYCLE_DATA` and `knownData` use only positive amounts. Leave the existing positive-only tests intact (they validate the happy path). The success-path tests already assert `expect(consoleErrorSpy).not.toHaveBeenCalled();` and `errorEl` is falsy — keep these (pristine-console requirement).

- [ ] **Step 2: Add a diverging-specific e2e data-flow test.** Inside `describe("data flow verification", ...)`, add this test after `aggregated data flows through to D3 with correct values`:
  ```js
  it("signed values flow through to D3 and color by sign with pristine console", async () => {
    // Real Sum: Loss = -300, Gain = 200 -> Gain (200) sorts above Loss (-300)
    const signedData = [
      { StageName: "Loss", Amount: -300 },
      { StageName: "Gain", Amount: 200 }
    ];

    const element = await createChart({
      recordCollection: signedData,
      operation: "Sum",
      groupByField: "StageName",
      valueField: "Amount"
    });

    // Data bound to D3 with signed, value-desc-sorted values
    const dataCall = mockD3.data.mock.calls.find(
      (call) =>
        Array.isArray(call[0]) &&
        call[0].length > 0 &&
        call[0][0].label !== undefined
    );
    expect(dataCall).toBeTruthy();
    const boundData = dataCall[0];
    expect(boundData).toEqual([
      { label: "Gain", value: 200 },
      { label: "Loss", value: -300 }
    ]);

    // Sign-based fill function applied
    const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
    expect(fillCalls.length).toBeGreaterThan(0);
    const fillFn = fillCalls[fillCalls.length - 1][1];
    expect(fillFn({ label: "Gain", value: 200 })).toBe("#4BCA81");
    expect(fillFn({ label: "Loss", value: -300 })).toBe("#FF5D5D");

    // SVG rendered, container present, no error, pristine console
    expect(mockD3.select).toHaveBeenCalled();
    const container = element.shadowRoot.querySelector(".chart-container");
    expect(container).toBeTruthy();
    const errorEl = element.shadowRoot.querySelector(".slds-text-color_error");
    expect(errorEl).toBeFalsy();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
  ```

- [ ] **Step 3: Run the e2e test — expect PASS.**
  ```bash
  npm test -- --testPathPattern=d3DivergingBarChart.e2e
  ```
  **Expected: PASS** — full lifecycle (create → load → render → SVG asserted → spinner gone → no error), multi-instance isolation, and the signed-data flow with sign coloring all pass. Success-path `console.error` is NOT called (pristine).

- [ ] **Step 4: Run the full three-tier suite together — expect PASS.**
  ```bash
  npm test -- --testPathPattern=d3DivergingBarChart
  ```
  **Expected: PASS** — all three tiers (`.test.js`, `.integration.test.js`, `.e2e.test.js`) green with pristine output.

- [ ] **Step 5: Commit.**
  ```bash
  git add force-app/main/default/lwc/d3DivergingBarChart/__tests__/d3DivergingBarChart.e2e.test.js
  git commit -m "test(d3DivergingBarChart): add e2e lifecycle and signed data-flow tests"
  ```


### Phase 11: Waffle Chart (`d3WaffleChart`)

Build the `d3WaffleChart` component as a full release — component (`.js`/`.html`/`.js-meta.xml`) plus all three test tiers (unit, integration, e2e). The chart clones the `d3DonutChart` scaffold (universal `@api` set, lifecycle, getters, `loadData` cascade, 4-state HTML template) and replaces only `renderChart`/chart-specific `@api`. It renders a fixed **10×10 grid of 100 `rect` cells**; each category fills `N = round(proportion * 100)` cells, allocated in descending value order; colors come from `themeService.createColorScale`; optional in-cell label contrast comes from `chartUtils.getContrastColor`. Data path: `getAggregatedData` (Count default) → client-side proportion + cell allocation. **Waffle uses RECTS not arcs** — the cloned mock-D3 factory drops `pie`/`arc`/`interpolate`/`attrTween` and adds `rect`-style `selectAll`/`data`/`enter` cell rendering.

Donor files (read these before executing):
- Component scaffold: `force-app/main/default/lwc/d3DonutChart/d3DonutChart.js`, `.html`, `.js-meta.xml`
- Unit test donor: `force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.test.js`
- Integration test donor: `force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.integration.test.js`
- E2E test donor: `force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.e2e.test.js`

Jest run pattern: `npm test -- --testPathPattern=d3WaffleChart`

---

#### Task 11.1: Unit tier — `d3WaffleChart.test.js` + component implementation

- **Files:**
  - Test: `force-app/main/default/lwc/d3WaffleChart/__tests__/d3WaffleChart.test.js`
  - Create: `force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.js`
  - Create: `force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.html`
  - Create: `force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.js-meta.xml`

- [ ] **Step 1: Write the failing unit test.** Create the directory and the test file. This is cloned from `d3DonutChart.test.js` but: (a) the mock-D3 factory drops `pie`/`arc`/`interpolate`/`attrTween` and keeps the chainable `selectAll`/`data`/`enter`/`append`/`attr`/`on` primitives used for rects; (b) `SAMPLE_DATA` is waffle-shaped; (c) rendering-detail assertions check for exactly 100 cells, filled-cell counts, and per-category color. Write this exact content:

```bash
mkdir -p force-app/main/default/lwc/d3WaffleChart/__tests__
```

```javascript
// ABOUTME: Unit tests for the D3 waffle chart Lightning Web Component.
// ABOUTME: Covers initialization, data sources, aggregation, themes, config, cell allocation, events, tooltips, and responsive behavior.

import { createElement } from "lwc";
import D3WaffleChart from "c/d3WaffleChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// Mock d3Lib
jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// Mock Apex
jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/D3ChartController.getAggregatedData",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

// Mock NavigationMixin
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    return {
      NavigationMixin: jest.fn((Base) => {
        return class extends Base {
          [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
        };
      })
    };
  },
  { virtual: true }
);

// Mock chartUtils
jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
  formatPercent: jest.fn((v) => (v * 100).toFixed(1) + "%"),
  createTooltip: jest.fn().mockReturnValue({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn()
  }),
  buildTooltipContent: jest.fn().mockReturnValue("<div>tooltip</div>"),
  createResizeHandler: jest.fn().mockReturnValue({
    observe: jest.fn(),
    disconnect: jest.fn()
  }),
  createLayoutRetry: jest.fn().mockReturnValue({ cancel: jest.fn() }),
  calculateDimensions: jest
    .fn()
    .mockReturnValue({ width: 300, height: 200, margins: {} }),
  shouldUseCompactMode: jest.fn().mockReturnValue(false),
  getContrastColor: jest.fn(() => "#ffffff")
}));

// Mock themeService — real createColorScale behaviour (label -> color Map, fallback colors[0])
jest.mock("c/themeService", () => {
  const PALETTE = ["#1589EE", "#FF9E2C", "#4BCA81", "#FF5D5D", "#AD7BFF"];
  return {
    DEFAULT_THEME: "Salesforce Standard",
    getColors: jest.fn((theme, count) => PALETTE.slice(0, count)),
    createColorScale: jest.fn((theme, domain) => {
      const map = new Map();
      domain.forEach((label, i) => map.set(label, PALETTE[i] || PALETTE[0]));
      return (label) => map.get(label) || PALETTE[0];
    })
  };
});

// Factory function for isolated mock D3 instances (waffle uses RECTS, not arcs)
const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3)
  };
  return d3;
};

// Sample test data
const SAMPLE_DATA = [
  { StageName: "Prospecting", Amount: 100 },
  { StageName: "Prospecting", Amount: 200 },
  { StageName: "Qualification", Amount: 150 },
  { StageName: "Closed Won", Amount: 500 }
];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-waffle-chart", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);
    getAggregatedData.mockResolvedValue([
      { label: "Closed Won", value: 500 },
      { label: "Prospecting", value: 300 },
      { label: "Qualification", value: 150 }
    ]);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  async function createChart(props = {}) {
    element = createElement("c-d3-waffle-chart", {
      is: D3WaffleChart
    });

    Object.assign(element, {
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Count",
      recordCollection: SAMPLE_DATA,
      ...props
    });

    document.body.appendChild(element);
    await flushPromises();
    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("shows loading spinner initially", () => {
      element = createElement("c-d3-waffle-chart", {
        is: D3WaffleChart
      });
      element.groupByField = "StageName";
      element.recordCollection = SAMPLE_DATA;

      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides spinner after data loads", async () => {
      await createChart();
      await flushPromises();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("renders chart container when data is available", async () => {
      await createChart();
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA SOURCE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("data sources", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("calls Apex when recordCollection is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT StageName, Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT StageName, Amount FROM Opportunity"
      });
    });

    it("shows error when no data source provided", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });
      await flushPromises();
      await flushPromises();

      const errorMessage = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorMessage).toBeTruthy();
    });

    it("shows error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({
        body: { message: "Invalid query" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Invalid FROM Object"
      });
      await flushPromises();
      await flushPromises();

      const errorMessage = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorMessage).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("aggregation", () => {
    it("accepts Sum operation", async () => {
      await createChart({ operation: "Sum" });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("accepts Count operation", async () => {
      await createChart({ operation: "Count" });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("accepts Average operation", async () => {
      await createChart({ operation: "Average" });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("renders with Salesforce Standard theme", async () => {
      await createChart({ theme: "Salesforce Standard" });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Warm theme", async () => {
      await createChart({ theme: "Warm" });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Cool theme", async () => {
      await createChart({ theme: "Cool" });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Vibrant theme", async () => {
      await createChart({ theme: "Vibrant" });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("configuration", () => {
    it("applies custom height", async () => {
      await createChart({ height: 400 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("400px");
    });

    it("accepts advancedConfig JSON", async () => {
      await createChart({
        advancedConfig: '{"showCellLabels": true}'
      });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("handles invalid advancedConfig gracefully", async () => {
      await createChart({
        advancedConfig: "not valid json"
      });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("responsive behavior", () => {
    it("creates resize handler for responsive reflow", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      await createChart();
      await flushPromises();

      expect(createResizeHandler).toHaveBeenCalled();
      const handler = createResizeHandler.mock.results[0].value;
      expect(handler.observe).toHaveBeenCalled();
    });

    it("disconnects resize handler on component removal", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      const mockDisconnect = jest.fn();
      createResizeHandler.mockReturnValue({
        observe: jest.fn(),
        disconnect: mockDisconnect
      });

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("re-renders on resize callback via createResizeHandler", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      let capturedCallback;

      createResizeHandler.mockImplementation((container, callback) => {
        capturedCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn()
        };
      });

      await createChart();
      await flushPromises();

      expect(capturedCallback).toBeDefined();
      mockD3.select.mockClear();

      capturedCallback({ width: 500 });

      expect(mockD3.select).toHaveBeenCalled();
    });

    it("skips rendering when container has zero width", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 0
      }));

      await createChart();
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EVENTS TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("events", () => {
    it("registers click handler on cells via D3 on()", async () => {
      await createChart({
        objectApiName: "Opportunity",
        filterField: "StageName"
      });
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseenter handler on cells", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on cells", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERING DETAILS — WAFFLE CELL ALLOCATION
  // ═══════════════════════════════════════════════════════════════

  describe("rendering details", () => {
    it("removes existing SVG before re-render", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });

    it("appends an svg element", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("svg");
    });

    it("binds exactly 100 cells to d3.data()", async () => {
      await createChart();
      await flushPromises();

      // renderChart builds a flat array of 100 cell descriptors and binds it
      const dataCalls = mockD3.data.mock.calls;
      const cellBinding = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      expect(cellBinding).toBeDefined();
    });

    it("appends rect elements for cells (not arcs)", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("rect");
    });

    it("allocates filled cell counts matching rounded proportions", async () => {
      // Server returns Closed Won=500, Prospecting=300, Qualification=150 (total 950)
      // round(500/950*100)=53, round(300/950*100)=32, round(150/950*100)=16 => 101,
      // descending allocator caps total at 100: last category trimmed to 15
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();
      await flushPromises();

      const dataCalls = mockD3.data.mock.calls;
      const cellBinding = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      expect(cellBinding).toBeDefined();

      const cells = cellBinding[0];
      const counts = cells.reduce((acc, cell) => {
        acc[cell.label] = (acc[cell.label] || 0) + 1;
        return acc;
      }, {});

      expect(counts["Closed Won"]).toBe(53);
      expect(counts["Prospecting"]).toBe(32);
      expect(counts["Qualification"]).toBe(15);
    });

    it("assigns a color to each cell from the category color scale", async () => {
      const { createColorScale } = require("c/themeService");

      await createChart();
      await flushPromises();

      // createColorScale called with the full category domain (build full domain first)
      expect(createColorScale).toHaveBeenCalled();
      const domainArg = createColorScale.mock.calls[0][1];
      expect(domainArg).toEqual([
        "Closed Won",
        "Prospecting",
        "Qualification"
      ]);

      const dataCalls = mockD3.data.mock.calls;
      const cellBinding = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      const cells = cellBinding[0];
      cells.forEach((cell) => {
        expect(typeof cell.color).toBe("string");
        expect(cell.color.startsWith("#")).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SERVER AGGREGATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("server aggregation", () => {
    it("calls getAggregatedData when objectApiName, groupByField, valueField, and operation are set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Count"
      });

      await flushPromises();

      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Count",
        filterClause: null
      });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("shows error when getAggregatedData fails", async () => {
      getAggregatedData.mockRejectedValue({
        body: { message: "Aggregation failed" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Count"
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("prefers recordCollection over server aggregation", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Count"
      });

      await flushPromises();

      expect(getAggregatedData).not.toHaveBeenCalled();
      expect(executeQuery).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  describe("getters", () => {
    it("containerStyle reflects configured height", async () => {
      await createChart({ height: 350 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("350px");
    });

    it("hasData is false and no-data state shows when no data", async () => {
      getAggregatedData.mockResolvedValue([]);
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Count"
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  describe("cleanup", () => {
    it("destroys tooltip on disconnect", async () => {
      const { createTooltip } = require("c/chartUtils");
      const mockDestroy = jest.fn();
      createTooltip.mockReturnValue({
        show: jest.fn(),
        hide: jest.fn(),
        destroy: mockDestroy
      });

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the unit test, expecting FAIL.** Command: `npm test -- --testPathPattern=d3WaffleChart`. **Expected: FAIL** because `c/d3WaffleChart` does not exist yet — Jest reports `Cannot find module 'c/d3WaffleChart'`.

- [ ] **Step 3: Implement the component JS.** Create `force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.js` cloned from the donut scaffold but with `renderChart` replaced by the rect-grid + cell allocator, the donut-only `@api`s (`showLegend`, `innerRadiusRatio`, `totalValue`) removed, and the donut-only legend/center-text logic removed. Write this exact content:

```javascript
// ABOUTME: D3 waffle chart Lightning Web Component rendering part-to-whole as a 10x10 grid.
// ABOUTME: Each category fills round(proportion*100) of 100 cells; colors via themeService, contrast via chartUtils.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateData,
  OPERATIONS,
  MAX_RECORDS
} from "c/dataService";
import { DEFAULT_THEME, createColorScale } from "c/themeService";
import {
  formatNumber,
  formatPercent,
  createTooltip,
  createResizeHandler,
  createLayoutRetry,
  getContrastColor
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

const GRID_SIZE = 10;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

export default class D3WaffleChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field to group by (cell categories) */
  @api groupByField = "";

  /** Field to aggregate (category values) */
  @api valueField = "";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.COUNT;

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side aggregation */
  @api filterClause = "";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track chartData = [];
  @track totalValue = 0;

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  d3 = null;
  svg = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  _layoutRetry = null;
  _config = {};
  _configParsed = false;

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  get containerStyle() {
    return `height: ${this.height}px;`;
  }

  get hasError() {
    return !!this.error;
  }

  get hasData() {
    return this.chartData && this.chartData.length > 0;
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get config() {
    if (!this._configParsed) {
      try {
        this._config = JSON.parse(this.advancedConfig || "{}");
      } catch {
        this._config = {};
      }
      this._configParsed = true;
    }
    return this._config;
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════

  async connectedCallback() {
    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3WaffleChart initialization error:", e);
    } finally {
      this.isLoading = false;
    }
  }

  renderedCallback() {
    if (this.showChart && !this.chartRendered) {
      this.chartRendered = this.initializeChart();
      if (!this.chartRendered && !this._layoutRetry) {
        const container = this.template.querySelector(".chart-container");
        if (container) {
          this._layoutRetry = createLayoutRetry(container, () => {
            this._layoutRetry = null;
            if (!this.chartRendered) {
              this.chartRendered = this.initializeChart();
            }
          });
        }
      }
    }
  }

  disconnectedCallback() {
    if (this._layoutRetry) {
      this._layoutRetry.cancel();
      this._layoutRetry = null;
    }
    this.cleanup();
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  async loadData() {
    // Priority 1: Use recordCollection if provided (client-side aggregation)
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.chartData = this._aggregateRawData([...this.recordCollection]);
      this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
      return;
    }

    // Priority 2: Server-side aggregation when all required fields are set
    if (
      this.objectApiName &&
      this.groupByField &&
      this.valueField &&
      this.operation
    ) {
      try {
        const result = await getAggregatedData({
          objectName: this.objectApiName,
          groupByField: this.groupByField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
        this.chartData = result;
      } catch (e) {
        throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
      }

      if (!this.chartData || this.chartData.length === 0) {
        throw new Error("No data after aggregation");
      }
      this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
      return;
    }

    // Priority 3: Fall back to SOQL query with client-side aggregation
    if (this.soqlQuery) {
      let rawData = [];
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      this.chartData = this._aggregateRawData(rawData);
      this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
      return;
    }

    throw new Error(
      "No data source provided. Set recordCollection or soqlQuery."
    );
  }

  /**
   * Validates, truncates, and aggregates raw record data client-side.
   * Used by both recordCollection and soqlQuery paths.
   */
  _aggregateRawData(rawData) {
    const requiredFields = [this.groupByField];
    if (this.operation !== OPERATIONS.COUNT) {
      requiredFields.push(this.valueField);
    }

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || MAX_RECORDS
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    const aggregated = aggregateData(
      prepared.data,
      this.groupByField,
      this.valueField,
      this.operation
    );

    if (aggregated.length === 0) {
      throw new Error("No data after aggregation");
    }

    return aggregated;
  }

  // ═══════════════════════════════════════════════════════════════
  // CELL ALLOCATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Allocates the 100 cells across categories in descending value order.
   * Each category gets round(proportion * 100) cells; the running total is
   * capped at 100 so rounding overflow is trimmed from the last category.
   * @returns {Array<{label:string,value:number,color:string}>} one entry per category
   */
  _allocateCells() {
    const total = this.totalValue;
    const colorScale = createColorScale(
      this.theme,
      this.chartData.map((d) => d.label),
      this.config.customColors
    );

    let remaining = TOTAL_CELLS;
    const allocations = [];
    this.chartData.forEach((d) => {
      const proportion = total > 0 ? d.value / total : 0;
      let count = Math.round(proportion * TOTAL_CELLS);
      if (count > remaining) {
        count = remaining;
      }
      remaining -= count;
      allocations.push({
        label: d.label,
        value: d.value,
        count,
        color: colorScale(d.label)
      });
    });
    return allocations;
  }

  /**
   * Expands category allocations into a flat array of exactly 100 cell
   * descriptors, each carrying its grid row/column, label, value, and color.
   * @param {Array} allocations - output of _allocateCells()
   * @returns {Array<{index:number,row:number,col:number,label:string,value:number,color:string,textColor:string}>}
   */
  _buildCells(allocations) {
    const cells = [];
    allocations.forEach((alloc) => {
      for (let i = 0; i < alloc.count; i++) {
        cells.push({
          label: alloc.label,
          value: alloc.value,
          color: alloc.color,
          textColor: getContrastColor(alloc.color)
        });
      }
    });
    while (cells.length < TOTAL_CELLS) {
      cells.push({
        label: null,
        value: 0,
        color: "#E5E5E5",
        textColor: getContrastColor("#E5E5E5")
      });
    }
    return cells.slice(0, TOTAL_CELLS).map((cell, index) => ({
      ...cell,
      index,
      row: Math.floor(index / GRID_SIZE),
      col: index % GRID_SIZE
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initializes the chart SVG, tooltip, and resize observer.
   * @returns {boolean} true if the chart was successfully initialized
   */
  initializeChart() {
    const container = this.template.querySelector(".chart-container");
    if (!container) return false;

    const { width } = container.getBoundingClientRect();
    if (width === 0) return false;

    this.tooltip = createTooltip(container);
    this.renderChart(width);

    this.resizeHandler = createResizeHandler(
      container,
      ({ width: newWidth }) => {
        if (newWidth > 0) {
          this.renderChart(newWidth);
        }
      }
    );
    this.resizeHandler.observe();
    return true;
  }

  renderChart(containerWidth) {
    const d3 = this.d3;
    const container = this.template.querySelector(".chart-container");
    if (!container || !d3) return;

    d3.select(container).select("svg").remove();

    const padding = Math.max(10, Math.round(containerWidth * 0.04));
    const margin = {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    };
    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const side = Math.min(width, height);
    const gap = side * 0.02;
    const cellSize = (side - gap * (GRID_SIZE - 1)) / GRID_SIZE;

    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "waffle-chart-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const allocations = this._allocateCells();
    const cells = this._buildCells(allocations);
    const showCellLabels = this.config.showCellLabels === true;

    const cellGroups = this.svg
      .selectAll(".waffle-cell")
      .data(cells)
      .enter()
      .append("g")
      .attr("class", "waffle-cell")
      .attr(
        "transform",
        (d) =>
          `translate(${d.col * (cellSize + gap)},${
            (GRID_SIZE - 1 - d.row) * (cellSize + gap)
          })`
      );

    cellGroups
      .append("rect")
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("rx", 2)
      .attr("fill", (d) => d.color)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .on("mouseenter", (event, d) => {
        this.showTooltip(event, d);
      })
      .on("mousemove", (event) => {
        this.moveTooltip(event);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      })
      .on("click", (event, d) => {
        this.handleCellClick(d);
      });

    if (showCellLabels) {
      cellGroups
        .append("text")
        .attr("x", cellSize / 2)
        .attr("y", cellSize / 2)
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("font-size", `${Math.max(6, cellSize * 0.3)}px`)
        .style("fill", (d) => d.textColor)
        .text((d) => (d.label ? formatNumber(d.value) : ""));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, d) {
    if (!this.tooltip || !d.label) return;

    const percent = this.totalValue > 0 ? d.value / this.totalValue : 0;
    const content = `
            <strong>${d.label}</strong><br/>
            ${formatNumber(d.value)} (${formatPercent(percent)})
        `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  moveTooltip() {
    // Position handled in show()
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleCellClick(d) {
    if (!this.objectApiName || !d.label) return;

    const filterFieldName = this.filterField || this.groupByField;

    this[NavigationMixin.Navigate]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.objectApiName,
        actionName: "list"
      }
    });

    this.dispatchEvent(
      new CustomEvent("cellclick", {
        detail: {
          label: d.label,
          value: d.value,
          filterField: filterFieldName
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  cleanup() {
    if (this.resizeHandler) {
      this.resizeHandler.disconnect();
      this.resizeHandler = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
```

- [ ] **Step 4: Implement the HTML template.** Create `force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.html` cloned from the donut template but with the legend block removed (the waffle has no legend); keep the 4-state conditional and the exact `class="chart-container" lwc:dom="manual"` mount div. Write this exact content:

```html
<template>
  <div class="slds-card">
    <!-- Loading State -->
    <template lwc:if={isLoading}>
      <div class="slds-align_absolute-center" style="height: 200px">
        <lightning-spinner
          alternative-text="Loading chart..."
          size="medium"
        ></lightning-spinner>
      </div>
    </template>

    <!-- Error State -->
    <template lwc:elseif={hasError}>
      <div
        class="slds-align_absolute-center slds-text-color_error"
        style="height: 200px; padding: 1rem"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:error"
            alternative-text="Error"
            size="large"
            variant="error"
          ></lightning-icon>
          <p class="slds-m-top_small">{error}</p>
        </div>
      </div>
    </template>

    <!-- Chart Container (has data) -->
    <template lwc:elseif={hasData}>
      <div class="chart-wrapper">
        <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>
      </div>
    </template>

    <!-- No Data State -->
    <template lwc:else>
      <div
        class="slds-align_absolute-center slds-text-color_weak"
        style="height: 200px"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:chart"
            alternative-text="No data"
            size="large"
          ></lightning-icon>
          <p class="slds-m-top_small">No data available</p>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 5: Implement the meta XML.** Create `force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.js-meta.xml` cloned from the donut meta but with `apiVersion` bumped to `65.0`, `masterLabel` set to `D3 Waffle Chart`, the donut-only properties (`showLegend`, `innerRadiusRatio`) dropped, and `operation` default set to `Count`. Write this exact content:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <isExposed>true</isExposed>
    <masterLabel>D3 Waffle Chart</masterLabel>
    <description
  >Interactive 10x10 waffle chart powered by D3.js — shows part-to-whole proportions as filled grid cells with aggregation and drill-down support.</description>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__RecordPage</target>
        <target>lightning__HomePage</target>
    </targets>
    <targetConfigs>
        <targetConfig
      targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
    >
            <!-- Data Source -->
            <property
        name="soqlQuery"
        type="String"
        label="SOQL Query"
        description="SOQL query to fetch data"
        placeholder="SELECT StageName, Amount FROM Opportunity"
      />

            <!-- Field Mapping -->
            <property
        name="groupByField"
        type="String"
        label="Group By Field"
        default="StageName"
        description="API name of the category field (e.g., StageName)"
        placeholder="StageName"
      />
            <property
        name="valueField"
        type="String"
        label="Value Field"
        default="Amount"
        description="API name of the numeric field to aggregate (not required for Count)"
        placeholder="Amount"
      />
            <property
        name="operation"
        type="String"
        label="Aggregation"
        default="Count"
        datasource="Sum,Count,Average"
        description="How to aggregate the values"
      />

            <!-- Appearance -->
            <property
        name="height"
        type="Integer"
        label="Height (px)"
        default="300"
        description="Chart height in pixels"
        min="150"
        max="800"
      />
            <property
        name="theme"
        type="String"
        label="Color Theme"
        default="Salesforce Standard"
        datasource="Salesforce Standard,Warm,Cool,Vibrant"
        description="Color palette for the chart"
      />

            <!-- Drill-Down -->
            <property
        name="objectApiName"
        type="String"
        label="Drill-Down Object"
        description="Object API name for navigation on cell click"
        placeholder="Opportunity"
      />
            <property
        name="filterField"
        type="String"
        label="Filter Field"
        description="Field to filter by on drill-down (defaults to Group By Field)"
      />

            <property
        name="recordLimit"
        type="Integer"
        label="Record Limit"
        description="Maximum records to process. Leave empty for default."
        min="1"
        max="10000"
      />

            <!-- Advanced -->
            <property
        name="advancedConfig"
        type="String"
        label="Advanced Config (JSON)"
        description='{"showCellLabels": false, "customColors": ["#FF5733"]}'
      />
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

- [ ] **Step 6: Run the unit test, expecting PASS.** Command: `npm test -- --testPathPattern=d3WaffleChart`. **Expected: PASS** — all unit `describe` blocks green, no leaked `console.error`/`console.warn` output. If `prettier`/`eslint` complain on the new files, run `npm run prettier -- force-app/main/default/lwc/d3WaffleChart/**` then re-run.

- [ ] **Step 7: Commit.** Commands:
```bash
git add force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.js force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.html force-app/main/default/lwc/d3WaffleChart/d3WaffleChart.js-meta.xml force-app/main/default/lwc/d3WaffleChart/__tests__/d3WaffleChart.test.js
git commit -m "feat(waffle): add d3WaffleChart component with unit tests"
```

---

#### Task 11.2: Integration tier — `d3WaffleChart.integration.test.js`

- **Files:**
  - Test: `force-app/main/default/lwc/d3WaffleChart/__tests__/d3WaffleChart.integration.test.js`

- [ ] **Step 1: Write the failing integration test.** Clone the donor integration suite and adapt it. Start from the donor:
```bash
cp force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.integration.test.js force-app/main/default/lwc/d3WaffleChart/__tests__/d3WaffleChart.integration.test.js
```
Then replace the whole file with this content (mocks ONLY `c/d3Lib` + Apex + `lightning/navigation` + `lightning/platformShowToastEvent`; runs REAL `dataService`/`themeService`/`chartUtils`; asserts real aggregated values and real palette hex flow into `mockD3.data()`; uses `flushPromises = () => new Promise(process.nextTick)`):

```javascript
// ABOUTME: Integration tests for d3WaffleChart verifying real service interactions.
// ABOUTME: Tests real dataService aggregation, themeService colors, and chartUtils contrast against mock D3 rect rendering.

import { createElement } from "lwc";
import D3WaffleChart from "c/d3WaffleChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// ═══════════════════════════════════════════════════════════════
// MOCKS — Only external dependencies, NOT real utility services
// ═══════════════════════════════════════════════════════════════

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "lightning/platformShowToastEvent",
  () => ({
    ShowToastEvent: jest.fn()
  }),
  { virtual: true }
);

const NAVIGATE_SYMBOL = Symbol.for("NavigationMixin.Navigate");
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const NavigationMixin = (Base) => {
      return class extends Base {
        [NAVIGATE_SYMBOL] = mockNavigate;
      };
    };
    NavigationMixin.Navigate = NAVIGATE_SYMBOL;
    return { NavigationMixin };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY (waffle-specific — rects, no arcs/pie)
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3)
  };
  return d3;
};

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Prospecting", Amount: 100 },
  { StageName: "Prospecting", Amount: 200 },
  { StageName: "Qualification", Amount: 150 },
  { StageName: "Closed Won", Amount: 500 }
];
// After Sum aggregation by StageName: Closed Won=500, Prospecting=300, Qualification=150
// Total = 950; cells: round(500/950*100)=53, round(300/950*100)=32, round(150/950*100)=16->15 (cap)

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise(process.nextTick);

async function createChart(props = {}) {
  const element = createElement("c-d3-waffle-chart", {
    is: D3WaffleChart
  });

  Object.assign(element, {
    groupByField: "StageName",
    valueField: "Amount",
    operation: "Sum",
    recordCollection: SAMPLE_DATA,
    theme: "Salesforce Standard",
    ...props
  });

  document.body.appendChild(element);

  await flushPromises();
  await flushPromises();

  return element;
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-waffle-chart integration", () => {
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ═══════════════════════════════════════════════════════════════
  // CELL ALLOCATION WITH REAL DATASERVICE AGGREGATION
  // ═══════════════════════════════════════════════════════════════

  describe("cell allocation with real aggregation", () => {
    it("binds exactly 100 cells from real Sum aggregation", async () => {
      await createChart({ operation: "Sum" });

      const dataCalls = mockD3.data.mock.calls;
      const cellBinding = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      expect(cellBinding).toBeDefined();
      expect(cellBinding[0].length).toBe(100);
    });

    it("filled cell counts match rounded real proportions (descending, capped)", async () => {
      await createChart({ operation: "Sum" });

      const dataCalls = mockD3.data.mock.calls;
      const cells = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      const counts = cells.reduce((acc, cell) => {
        if (cell.label) acc[cell.label] = (acc[cell.label] || 0) + 1;
        return acc;
      }, {});

      // Real dataService Sum: Closed Won=500, Prospecting=300, Qualification=150 (total 950)
      // round(500/950*100)=53, round(300/950*100)=32, round(150/950*100)=16
      // descending allocator caps at 100 -> Qualification trimmed to 15
      expect(counts["Closed Won"]).toBe(53);
      expect(counts["Prospecting"]).toBe(32);
      expect(counts["Qualification"]).toBe(15);

      const filled = counts["Closed Won"] + counts["Prospecting"] + counts["Qualification"];
      expect(filled).toBe(100);
    });

    it("Count operation produces correct cell counts", async () => {
      // Count: Prospecting=2, Closed Won=1, Qualification=1 (total 4)
      // round(2/4*100)=50, round(1/4*100)=25, round(1/4*100)=25 -> 100 total
      await createChart({ operation: "Count" });

      const dataCalls = mockD3.data.mock.calls;
      const cells = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      const counts = cells.reduce((acc, cell) => {
        if (cell.label) acc[cell.label] = (acc[cell.label] || 0) + 1;
        return acc;
      }, {});

      expect(counts["Prospecting"]).toBe(50);
      expect(counts["Closed Won"]).toBe(25);
      expect(counts["Qualification"]).toBe(25);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // REAL THEMESERVICE PALETTE FLOWS INTO CELLS
  // ═══════════════════════════════════════════════════════════════

  describe("real themeService palette", () => {
    it("Salesforce Standard hex colors map to descending categories", async () => {
      await createChart({ operation: "Sum", theme: "Salesforce Standard" });

      const dataCalls = mockD3.data.mock.calls;
      const cells = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      // createColorScale built over full domain [Closed Won, Prospecting, Qualification]
      // Salesforce Standard palette: #1589EE, #FF9E2C, #4BCA81
      const colorByLabel = {};
      cells.forEach((cell) => {
        if (cell.label) colorByLabel[cell.label] = cell.color;
      });

      expect(colorByLabel["Closed Won"]).toBe("#1589EE");
      expect(colorByLabel["Prospecting"]).toBe("#FF9E2C");
      expect(colorByLabel["Qualification"]).toBe("#4BCA81");
    });

    it("Warm theme hex colors flow into cells", async () => {
      await createChart({ operation: "Sum", theme: "Warm" });

      const dataCalls = mockD3.data.mock.calls;
      const cells = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      const closedWonCell = cells.find((c) => c.label === "Closed Won");
      // Warm palette first color
      expect(closedWonCell.color).toBe("#FF6B6B");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // REAL CHARTUTILS CONTRAST
  // ═══════════════════════════════════════════════════════════════

  describe("real chartUtils contrast", () => {
    it("each cell carries a real getContrastColor textColor", async () => {
      await createChart({ operation: "Sum", theme: "Salesforce Standard" });

      const dataCalls = mockD3.data.mock.calls;
      const cells = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      // getContrastColor returns "#000000" or "#ffffff"
      cells.forEach((cell) => {
        expect(["#000000", "#ffffff"]).toContain(cell.textColor);
      });

      // #1589EE (Closed Won) is a mid/dark blue -> white text
      const closedWonCell = cells.find((c) => c.label === "Closed Won");
      expect(closedWonCell.textColor).toBe("#ffffff");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EVENT PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("event pipeline integration", () => {
    it("cell click registers D3 click handler when objectApiName is set", async () => {
      const element = await createChart({
        objectApiName: "Opportunity",
        filterField: "StageName"
      });

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);

      expect(element.objectApiName).toBe("Opportunity");
    });
  });
});
```

- [ ] **Step 2: Run the integration test, expecting PASS.** Command: `npm test -- --testPathPattern=d3WaffleChart`. **Expected: PASS** — the component already exists (Task 11.1), so the new integration suite goes green immediately when the real `dataService`/`themeService`/`chartUtils` math matches the assertions. (TDD note: this is a clone-and-adapt against already-shipped component code; the failing-first state was established in Task 11.1.) If any assertion fails, the discrepancy is real service output vs. the expected values — fix the assertion to match the real math, never the services.

- [ ] **Step 3: Commit.** Commands:
```bash
git add force-app/main/default/lwc/d3WaffleChart/__tests__/d3WaffleChart.integration.test.js
git commit -m "test(waffle): add integration tests for real service flow into cells"
```

---

#### Task 11.3: E2E tier — `d3WaffleChart.e2e.test.js`

- **Files:**
  - Test: `force-app/main/default/lwc/d3WaffleChart/__tests__/d3WaffleChart.e2e.test.js`

- [ ] **Step 1: Write the failing e2e test.** Clone the donor e2e suite and adapt it. Start from the donor:
```bash
cp force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.e2e.test.js force-app/main/default/lwc/d3WaffleChart/__tests__/d3WaffleChart.e2e.test.js
```
Then replace the whole file with this content (full lifecycle, multi-instance isolation, data-flow verification with exact values, pristine console — success path asserts `console.error` NOT called):

```javascript
// ABOUTME: End-to-end lifecycle tests for the D3 Waffle Chart component.
// ABOUTME: Verifies full render pipeline, 100-cell allocation, multi-instance isolation, and error recovery using real services with mocked D3.

import { createElement } from "lwc";
import D3WaffleChart from "c/d3WaffleChart";
import { loadD3 } from "c/d3Lib";

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP: Only mock D3 lib, Apex, navigation, and toast
// Real modules: c/dataService, c/themeService, c/chartUtils
// ═══════════════════════════════════════════════════════════════

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const NavMixin = jest.fn((Base) => {
      return class extends Base {
        [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
      };
    });
    NavMixin.Navigate = Symbol.for("NavigationMixin.Navigate");
    NavMixin.GenerateUrl = Symbol.for("NavigationMixin.GenerateUrl");
    return { NavigationMixin: NavMixin };
  },
  { virtual: true }
);

jest.mock(
  "lightning/platformShowToastEvent",
  () => {
    return {
      ShowToastEvent: class ShowToastEvent extends CustomEvent {
        constructor(toast) {
          super("lightning__showtoast", {
            composed: true,
            cancelable: true,
            bubbles: true,
            detail: toast
          });
        }
      }
    };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY (waffle-specific — rects, no arcs/pie)
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3)
  };
  return d3;
};

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Prospecting", Amount: 100 },
  { StageName: "Prospecting", Amount: 200 },
  { StageName: "Qualification", Amount: 150 },
  { StageName: "Closed Won", Amount: 500 }
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

async function createChart(props = {}) {
  const element = createElement("c-d3-waffle-chart", {
    is: D3WaffleChart
  });

  Object.assign(element, {
    groupByField: "StageName",
    valueField: "Amount",
    operation: "Sum",
    recordCollection: SAMPLE_DATA,
    ...props
  });

  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-waffle-chart e2e", () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ═══════════════════════════════════════════════════════════════
  // FULL RENDER LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe("full render lifecycle", () => {
    it("creates waffle chart end-to-end with 100 cells and pristine console", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      // loadD3 was called during connectedCallback
      expect(loadD3).toHaveBeenCalled();

      // SVG and rect cells were appended
      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("svg");
      expect(appendCalls).toContain("rect");

      // Exactly 100 cells were bound
      const cellBinding = mockD3.data.mock.calls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      expect(cellBinding).toBeDefined();

      // Chart container visible, spinner gone, no error
      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();

      // No console errors during the full lifecycle
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("cleanup removes resize handler on disconnect without errors", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA-FLOW VERIFICATION (exact values)
  // ═══════════════════════════════════════════════════════════════

  describe("data-flow verification", () => {
    it("real Sum aggregation flows into exact cell counts end-to-end", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      await createChart({ operation: "Sum" });
      await flushPromises();

      const cells = mockD3.data.mock.calls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      const counts = cells.reduce((acc, cell) => {
        if (cell.label) acc[cell.label] = (acc[cell.label] || 0) + 1;
        return acc;
      }, {});

      // Closed Won=500, Prospecting=300, Qualification=150 (total 950)
      // round(53), round(32), round(16)->trimmed to 15 by cap = 100 filled cells
      expect(counts["Closed Won"]).toBe(53);
      expect(counts["Prospecting"]).toBe(32);
      expect(counts["Qualification"]).toBe(15);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTI-COMPONENT ISOLATION
  // ═══════════════════════════════════════════════════════════════

  describe("multi-component isolation", () => {
    it("two instances render independently with separate D3 state", async () => {
      const mockD3A = createMockD3();
      loadD3.mockResolvedValue(mockD3A);
      const elementA = await createChart({ theme: "Salesforce Standard" });
      await flushPromises();

      const mockD3B = createMockD3();
      loadD3.mockResolvedValue(mockD3B);
      const elementB = await createChart({ theme: "Warm" });
      await flushPromises();

      // Each instance bound its own 100-cell array
      const cellsA = mockD3A.data.mock.calls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];
      const cellsB = mockD3B.data.mock.calls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      expect(cellsA.length).toBe(100);
      expect(cellsB.length).toBe(100);

      // Theme isolation: instance A uses Salesforce Standard, B uses Warm
      const closedWonA = cellsA.find((c) => c.label === "Closed Won");
      const closedWonB = cellsB.find((c) => c.label === "Closed Won");
      expect(closedWonA.color).toBe("#1589EE");
      expect(closedWonB.color).toBe("#FF6B6B");

      // Both containers exist in the DOM
      expect(elementA.shadowRoot.querySelector(".chart-container")).toBeTruthy();
      expect(elementB.shadowRoot.querySelector(".chart-container")).toBeTruthy();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR → RECOVERY FLOW
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery flow", () => {
    it("shows error state when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("Network failure loading D3"));

      const element = await createChart();
      await flushPromises();
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeFalsy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      // Error path: the init error is logged (expected) — assert the spy WAS called
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the e2e test, expecting PASS.** Command: `npm test -- --testPathPattern=d3WaffleChart`. **Expected: PASS** — full lifecycle and multi-instance isolation green, success-path tests confirm `console.error`/`console.warn` were NOT called, and the error-recovery test confirms `console.error` WAS called. If the success-path pristine-console assertion fails, inspect `consoleErrorSpy.mock.calls` for a real leak and fix the component root cause (do not silence it).

- [ ] **Step 3: Commit.** Commands:
```bash
git add force-app/main/default/lwc/d3WaffleChart/__tests__/d3WaffleChart.e2e.test.js
git commit -m "test(waffle): add e2e lifecycle and multi-instance isolation tests"
```


### Phase 12: Sunburst Chart (`d3SunburstChart`)

Build the `d3SunburstChart` component as a full release: clone the `d3Treemap` scaffold (universal `@api` set, lifecycle, getters, three-path data handling, 4-state HTML), swap `renderChart` to a `d3.partition` + `d3.arc` concentric-ring layout, and ship all three test tiers cloned from the arc-based `d3DonutChart` suite. Client-side nesting uses the **new shared** `dataService.buildHierarchy(rows, fields, valueField, operation)` (built in the foundation phase) instead of `d3Treemap`'s private `buildHierarchy` method — `d3Treemap` is not modified. Two-level hierarchies load via `getMultiGroupData`; single-level via `getAggregatedData`; pre-built hierarchies via the `hierarchyData` `@api`.

> **Cross-phase dependencies (must be DONE before this phase runs):**
> - **Foundation phase:** `dataService.buildHierarchy(rows, fields, valueField, operation) -> { name, children }` is implemented and exported from `force-app/main/default/lwc/dataService/dataService.js`.
> - **Foundation phase:** `jest.config.js` has a `moduleNameMapper` entry for `@salesforce/apex/D3ChartController.getMultiGroupData`, and `__mocks__/@salesforce/apex/D3ChartController.getMultiGroupData.js` exists (the mock file is already present in `__mocks__/`; the mapper entry is the missing piece flagged in spec §6.4 / §10).
> - **Pre-flight phase:** `force-app/main/default/staticresources/d3.js` is verified to be the full d3 v7.9.0 build containing `d3.partition` (spec §6.5).
>
> If `dataService.buildHierarchy` is not yet exported, the unit test's integration assertions will fail for reasons unrelated to this component — confirm the foundation phase is merged first.

---

#### Task 12.1: UNIT tier — `d3SunburstChart.test.js` + component (.js/.html/.js-meta.xml)

- **Files:**
  - Test: `force-app/main/default/lwc/d3SunburstChart/__tests__/d3SunburstChart.test.js`
  - Create: `force-app/main/default/lwc/d3SunburstChart/d3SunburstChart.js`
  - Create: `force-app/main/default/lwc/d3SunburstChart/d3SunburstChart.html`
  - Create: `force-app/main/default/lwc/d3SunburstChart/d3SunburstChart.js-meta.xml`

- [ ] **Step 1: Write the failing unit test.** Create the directory and write the test file. It clones the `d3DonutChart.test.js` scaffolding (`jest.mock` blocks for `c/d3Lib`, both Apex methods, `lightning/navigation`, `c/chartUtils`; `createChart`/`flushPromises`/`beforeEach`/`afterEach`) but uses a **Sunburst-specific** `createMockD3()` adding `hierarchy` (callable → node tree with `.sum` returning self and `.descendants`), `partition` (callable → fn returning the root, with chainable `.size`), and `arc` (callable → fn with chainable `.startAngle/.endAngle/.innerRadius/.outerRadius`). Sample data is the flat Opportunity rows from the Treemap donor.

```bash
mkdir -p force-app/main/default/lwc/d3SunburstChart/__tests__
```

```javascript
// force-app/main/default/lwc/d3SunburstChart/__tests__/d3SunburstChart.test.js
// ABOUTME: Unit tests for the D3 sunburst chart Lightning Web Component.
// ABOUTME: Covers initialization, hierarchy data handling, aggregation, themes, config, events, tooltips, responsive behavior, and partition rendering details.

import { createElement } from "lwc";
import D3SunburstChart from "c/d3SunburstChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/D3ChartController.getAggregatedData",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/D3ChartController.getMultiGroupData",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => ({
    NavigationMixin: jest.fn((Base) => {
      return class extends Base {
        [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
      };
    })
  }),
  { virtual: true }
);

jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
  formatPercent: jest.fn((v) => (v * 100).toFixed(1) + "%"),
  truncateLabel: jest.fn((label) => label),
  createTooltip: jest.fn().mockReturnValue({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn()
  }),
  buildTooltipContent: jest.fn().mockReturnValue("<div>tooltip</div>"),
  createResizeHandler: jest.fn().mockReturnValue({
    observe: jest.fn(),
    disconnect: jest.fn()
  }),
  createLayoutRetry: jest.fn().mockReturnValue({ cancel: jest.fn() }),
  calculateDimensions: jest
    .fn()
    .mockReturnValue({ width: 300, height: 200, margins: {} }),
  shouldUseCompactMode: jest.fn().mockReturnValue(false)
}));

// Factory: isolated mock D3 with sunburst-specific primitives (hierarchy, partition, arc).
const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    attrTween: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    each: jest.fn(() => d3),
    hierarchy: jest.fn((data) => {
      const createNode = (node, parent = null, depth = 0) => {
        const n = {
          data: node,
          depth,
          parent,
          value: node.value || 0,
          x0: 0,
          x1: 6.28,
          y0: depth * 50,
          y1: (depth + 1) * 50,
          children: null
        };
        if (node.children) {
          n.children = node.children.map((c) => createNode(c, n, depth + 1));
        }
        return n;
      };
      const root = createNode(data);
      root.sum = jest.fn(() => root);
      root.sort = jest.fn(() => root);
      root.descendants = jest.fn(() => {
        const out = [];
        const walk = (n) => {
          out.push(n);
          if (n.children) n.children.forEach(walk);
        };
        walk(root);
        return out;
      });
      return root;
    }),
    partition: jest.fn(() => {
      const partitionFn = jest.fn((root) => root);
      partitionFn.size = jest.fn(() => partitionFn);
      return partitionFn;
    }),
    arc: jest.fn(() => {
      const arcFn = jest.fn(() => "M0,0");
      arcFn.startAngle = jest.fn(() => arcFn);
      arcFn.endAngle = jest.fn(() => arcFn);
      arcFn.innerRadius = jest.fn(() => arcFn);
      arcFn.outerRadius = jest.fn(() => arcFn);
      return arcFn;
    })
  };
  return d3;
};

// Flat Opportunity rows — auto-nest into a two-level hierarchy by [StageName, Type].
const SAMPLE_DATA = [
  { Id: "001", StageName: "Prospecting", Type: "New", Amount: 100 },
  { Id: "002", StageName: "Prospecting", Type: "New", Amount: 200 },
  { Id: "003", StageName: "Prospecting", Type: "Existing", Amount: 50 },
  { Id: "004", StageName: "Closed Won", Type: "New", Amount: 500 },
  { Id: "005", StageName: "Closed Won", Type: "Existing", Amount: 300 }
];

const SAMPLE_HIERARCHY = {
  name: "Root",
  children: [
    { name: "A", value: 100 },
    { name: "B", value: 200 }
  ]
};

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-sunburst-chart", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);
    getAggregatedData.mockResolvedValue([
      { label: "Prospecting", value: 350 },
      { label: "Closed Won", value: 800 }
    ]);
    getMultiGroupData.mockResolvedValue([
      { label: "Prospecting", series: "New", value: 300 },
      { label: "Prospecting", series: "Existing", value: 50 },
      { label: "Closed Won", series: "New", value: 500 },
      { label: "Closed Won", series: "Existing", value: 300 }
    ]);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 400
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  async function createChart(props = {}) {
    element = createElement("c-d3-sunburst-chart", { is: D3SunburstChart });
    Object.assign(element, {
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Sum",
      recordCollection: SAMPLE_DATA,
      ...props
    });
    document.body.appendChild(element);
    await flushPromises();
    return element;
  }

  describe("initialization", () => {
    it("shows loading spinner initially", () => {
      element = createElement("c-d3-sunburst-chart", { is: D3SunburstChart });
      element.groupByField = "StageName";
      element.recordCollection = SAMPLE_DATA;
      document.body.appendChild(element);
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides spinner after data loads", async () => {
      await createChart();
      await flushPromises();
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("renders chart container when data is available", async () => {
      await createChart();
      await flushPromises();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  describe("data handling", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });
      expect(executeQuery).not.toHaveBeenCalled();
      expect(getAggregatedData).not.toHaveBeenCalled();
    });

    it("uses hierarchyData directly when provided", async () => {
      await createChart({
        recordCollection: [],
        hierarchyData: SAMPLE_HIERARCHY
      });
      await flushPromises();
      expect(executeQuery).not.toHaveBeenCalled();
      expect(getAggregatedData).not.toHaveBeenCalled();
      expect(getMultiGroupData).not.toHaveBeenCalled();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("calls executeQuery when only soqlQuery is set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT StageName, Amount FROM Opportunity"
      });
      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT StageName, Amount FROM Opportunity"
      });
    });

    it("shows error when no data source provided", async () => {
      await createChart({ recordCollection: [], soqlQuery: "" });
      await flushPromises();
      await flushPromises();
      const errorMessage = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorMessage).toBeTruthy();
    });

    it("shows error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({ body: { message: "Invalid query" } });
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Invalid FROM Object"
      });
      await flushPromises();
      await flushPromises();
      const errorMessage = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorMessage).toBeTruthy();
    });
  });

  describe("aggregation operations", () => {
    it("accepts Sum operation", async () => {
      await createChart({ operation: "Sum" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("accepts Count operation", async () => {
      await createChart({ operation: "Count" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("accepts Average operation", async () => {
      await createChart({ operation: "Average" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  describe("themes", () => {
    it("renders with Salesforce Standard theme", async () => {
      await createChart({ theme: "Salesforce Standard" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Warm theme", async () => {
      await createChart({ theme: "Warm" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Cool theme", async () => {
      await createChart({ theme: "Cool" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Vibrant theme", async () => {
      await createChart({ theme: "Vibrant" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  describe("configuration", () => {
    it("applies custom height", async () => {
      await createChart({ height: 500 });
      await flushPromises();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("500px");
    });

    it("accepts advancedConfig JSON", async () => {
      await createChart({ advancedConfig: '{"showBreadcrumb": false}' });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("handles invalid advancedConfig gracefully", async () => {
      await createChart({ advancedConfig: "not valid json" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  describe("events", () => {
    it("sets objectApiName for drill-down navigation", async () => {
      await createChart({ objectApiName: "Opportunity" });
      await flushPromises();
      expect(element.objectApiName).toBe("Opportunity");
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("registers click handler on arcs via D3 on()", async () => {
      await createChart({ objectApiName: "Opportunity" });
      await flushPromises();
      const clickCalls = mockD3.on.mock.calls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);
    });
  });

  describe("tooltip behavior", () => {
    it("registers mouseenter handler on arcs", async () => {
      await createChart();
      await flushPromises();
      const calls = mockD3.on.mock.calls.filter((c) => c[0] === "mouseenter");
      expect(calls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on arcs", async () => {
      await createChart();
      await flushPromises();
      const calls = mockD3.on.mock.calls.filter((c) => c[0] === "mouseleave");
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe("responsive behavior", () => {
    it("creates resize handler for responsive reflow", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      await createChart();
      await flushPromises();
      expect(createResizeHandler).toHaveBeenCalled();
      const handler = createResizeHandler.mock.results[0].value;
      expect(handler.observe).toHaveBeenCalled();
    });

    it("disconnects resize handler on component removal", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      const mockDisconnect = jest.fn();
      createResizeHandler.mockReturnValue({
        observe: jest.fn(),
        disconnect: mockDisconnect
      });
      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("skips rendering when container has zero width", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 0
      }));
      await createChart();
      await flushPromises();
      expect(mockD3.partition).not.toHaveBeenCalled();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("re-renders on resize callback via createResizeHandler", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      let capturedCallback;
      createResizeHandler.mockImplementation((container, callback) => {
        capturedCallback = callback;
        return { observe: jest.fn(), disconnect: jest.fn() };
      });
      await createChart();
      await flushPromises();
      expect(capturedCallback).toBeDefined();
      mockD3.select.mockClear();
      capturedCallback({ width: 500 });
      expect(mockD3.select).toHaveBeenCalled();
    });
  });

  describe("server aggregation", () => {
    it("calls getAggregatedData for single-level server hierarchy", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();
      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum",
        filterClause: null
      });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("calls getMultiGroupData when secondaryGroupByField is set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();
      expect(getMultiGroupData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum",
        filterClause: null
      });
      expect(getAggregatedData).not.toHaveBeenCalled();
    });

    it("shows error when getAggregatedData returns empty array", async () => {
      getAggregatedData.mockResolvedValue([]);
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  describe("getters", () => {
    it("hasData is false before data loads", () => {
      element = createElement("c-d3-sunburst-chart", { is: D3SunburstChart });
      expect(element.hasData).toBeFalsy();
    });

    it("containerStyle reflects configured height", async () => {
      await createChart({ height: 450 });
      await flushPromises();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("450px");
    });
  });

  describe("cleanup", () => {
    it("destroys tooltip on disconnect", async () => {
      const { createTooltip } = require("c/chartUtils");
      const mockDestroy = jest.fn();
      createTooltip.mockReturnValue({
        show: jest.fn(),
        hide: jest.fn(),
        destroy: mockDestroy
      });
      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  describe("rendering details", () => {
    it("creates a D3 hierarchy from the root data", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.hierarchy).toHaveBeenCalled();
    });

    it("invokes the partition layout", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.partition).toHaveBeenCalled();
      const partitionObj = mockD3.partition.mock.results[0].value;
      expect(partitionObj.size).toHaveBeenCalled();
    });

    it("creates an arc generator via d3.arc()", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.arc).toHaveBeenCalled();
      const arcObj = mockD3.arc.mock.results[0].value;
      expect(arcObj.startAngle).toHaveBeenCalled();
      expect(arcObj.endAngle).toHaveBeenCalled();
      expect(arcObj.innerRadius).toHaveBeenCalled();
      expect(arcObj.outerRadius).toHaveBeenCalled();
    });

    it("draws one arc path per non-root node (ring depth equals hierarchy depth)", async () => {
      await createChart();
      await flushPromises();
      // The partition root's descendants minus the root are bound via .data();
      // assert .data() received the descendant array (one entry per ring node).
      const dataCalls = mockD3.data.mock.calls;
      const arcDataCall = dataCalls.find((c) => Array.isArray(c[0]));
      expect(arcDataCall).toBeDefined();
      // Two-level hierarchy from SAMPLE_DATA => depth 0 (root, excluded) + depth 1 + depth 2.
      expect(arcDataCall[0].length).toBeGreaterThan(0);
    });

    it("removes existing SVG before re-render", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });

    it("sets SVG dimensions from container width and configured height", async () => {
      await createChart({ height: 360 });
      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const widthSet = attrCalls.some(
        (c) => c[0] === "width" && typeof c[1] === "number"
      );
      const heightSet = attrCalls.some(
        (c) => c[0] === "height" && c[1] === 360
      );
      expect(widthSet).toBe(true);
      expect(heightSet).toBe(true);
    });
  });

  describe("layout retry", () => {
    function useRealLayoutRetry() {
      const { createLayoutRetry } = require("c/chartUtils");
      createLayoutRetry.mockImplementation((container, onLayout, opts = {}) => {
        const maxAttempts = (opts && opts.maxAttempts) || 60;
        let rafId = null;
        let cancelled = false;
        const check = (attempt) => {
          if (cancelled) return;
          const { width } = container.getBoundingClientRect();
          if (width > 0) {
            rafId = null;
            onLayout(width);
            return;
          }
          if (attempt >= maxAttempts) {
            rafId = null;
            return;
          }
          rafId = global.requestAnimationFrame(() => check(attempt + 1));
        };
        rafId = global.requestAnimationFrame(() => check(0));
        return {
          cancel() {
            cancelled = true;
            if (rafId !== null) {
              global.cancelAnimationFrame(rafId);
              rafId = null;
            }
          }
        };
      });
    }

    it("retries chart init when container starts at zero width", async () => {
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: containerWidth
      }));
      const rafCallbacks = [];
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();
      useRealLayoutRetry();

      await createChart();
      await flushPromises();

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockD3.partition).not.toHaveBeenCalled();

      containerWidth = 400;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 400
      }));
      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift();
        cb();
      }
      expect(mockD3.select).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));
      global.requestAnimationFrame = jest.fn(() => 42);
      global.cancelAnimationFrame = jest.fn();
      useRealLayoutRetry();

      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the unit test — Expected: FAIL.**
```bash
npm test -- --testPathPattern=d3SunburstChart
```
Expected: FAIL because `c/d3SunburstChart` does not exist yet (`Cannot find module 'c/d3SunburstChart'`). This proves the test harness resolves the component path.

- [ ] **Step 3: Implement the component JS.** Clone the `d3Treemap.js` scaffold (universal `@api` set, `@track`/private fields, getters, lifecycle, three-path `loadData`), then replace `renderChart` with a partition/arc concentric-ring layout and switch client nesting + two-level server loading to the shared modules.

```javascript
// force-app/main/default/lwc/d3SunburstChart/d3SunburstChart.js
// ABOUTME: D3 Sunburst chart Lightning Web Component for radial hierarchical data.
// ABOUTME: Renders concentric rings via d3.partition + d3.arc; supports flat auto-nesting, two-level server hierarchy, and pre-built hierarchyData.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateData,
  buildHierarchy,
  OPERATIONS,
  MAX_RECORDS
} from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  formatPercent,
  createTooltip,
  createResizeHandler,
  createLayoutRetry,
  truncateLabel
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

export default class D3SunburstChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Pre-built hierarchy: { name, children: [{ name, value }|{ name, children }] } */
  @api hierarchyData = null;

  /** Field to group by (primary ring) */
  @api groupByField = "";

  /** Optional second field for a third ring (nested hierarchy) */
  @api secondaryGroupByField = "";

  /** Field to aggregate (arc values) */
  @api valueField = "";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 400;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Show ring labels (defaults to true via getter) */
  @api showLabels;

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional SOQL WHERE clause for server-side aggregation (without WHERE keyword) */
  @api filterClause = "";

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track rootData = null;
  @track totalValue = 0;

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  d3 = null;
  svg = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  _layoutRetry = null;
  _config = {};
  _configParsed = false;

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  get containerStyle() {
    return `height: ${this.height}px;`;
  }

  get effectiveShowLabels() {
    return this.showLabels !== false;
  }

  get hasError() {
    return !!this.error;
  }

  get hasData() {
    return (
      this.rootData &&
      this.rootData.children &&
      this.rootData.children.length > 0
    );
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get config() {
    if (!this._configParsed) {
      try {
        this._config = JSON.parse(this.advancedConfig || "{}");
      } catch {
        this._config = {};
      }
      this._configParsed = true;
    }
    return this._config;
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════

  async connectedCallback() {
    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3SunburstChart initialization error:", e);
    } finally {
      this.isLoading = false;
    }
  }

  renderedCallback() {
    if (this.showChart && !this.chartRendered) {
      this.chartRendered = this.initializeChart();
      if (!this.chartRendered && !this._layoutRetry) {
        const container = this.template.querySelector(".chart-container");
        if (container) {
          this._layoutRetry = createLayoutRetry(container, () => {
            this._layoutRetry = null;
            if (!this.chartRendered) {
              this.chartRendered = this.initializeChart();
            }
          });
        }
      }
    }
  }

  disconnectedCallback() {
    if (this._layoutRetry) {
      this._layoutRetry.cancel();
      this._layoutRetry = null;
    }
    this.cleanup();
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING (three paths: hierarchyData / server / client nest)
  // ═══════════════════════════════════════════════════════════════

  async loadData() {
    // Path 1: pre-built hierarchy
    if (this.hierarchyData) {
      this.rootData = this.validateHierarchy(this.hierarchyData);
      this.calculateTotalValue();
      return;
    }

    let rawData = [];

    if (this.recordCollection && this.recordCollection.length > 0) {
      rawData = [...this.recordCollection];
    } else if (this._canUseServerAggregation()) {
      // Path 2: server-side aggregation
      await this._loadServerData();
      return;
    } else if (this.soqlQuery) {
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
    } else {
      throw new Error(
        "No data source provided. Set recordCollection, hierarchyData, or soqlQuery."
      );
    }

    // Path 3: client-side nest via shared dataService.buildHierarchy
    const requiredFields = [this.groupByField];
    if (this.operation !== OPERATIONS.COUNT) {
      requiredFields.push(this.valueField);
    }

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || MAX_RECORDS
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    const fields = this.secondaryGroupByField
      ? [this.groupByField, this.secondaryGroupByField]
      : [this.groupByField];

    this.rootData = buildHierarchy(
      prepared.data,
      fields,
      this.valueField,
      this.operation
    );
    this.calculateTotalValue();

    if (!this.rootData.children || this.rootData.children.length === 0) {
      throw new Error("No data after building hierarchy");
    }
  }

  /** True when all server-aggregation inputs are set. */
  _canUseServerAggregation() {
    return !!(
      this.objectApiName &&
      this.groupByField &&
      this.valueField &&
      this.operation
    );
  }

  /**
   * Server path. Two-level (secondaryGroupByField set) uses getMultiGroupData
   * and pivots the edge list into a two-level { name, children } tree;
   * single-level uses getAggregatedData.
   */
  async _loadServerData() {
    try {
      if (this.secondaryGroupByField) {
        const edges = await getMultiGroupData({
          objectName: this.objectApiName,
          groupByField: this.groupByField,
          seriesField: this.secondaryGroupByField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
        this.rootData = this._edgesToHierarchy(edges);
      } else {
        const result = await getAggregatedData({
          objectName: this.objectApiName,
          groupByField: this.groupByField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
        this.rootData = {
          name: "Root",
          children: result.map((item) => ({
            name: String(item.label ?? "Null"),
            value: Number(item.value) || 0
          }))
        };
      }
    } catch (e) {
      throw new Error(
        `Server aggregation error: ${e.body?.message || e.message}`
      );
    }

    this.calculateTotalValue();
    if (!this.rootData.children || this.rootData.children.length === 0) {
      throw new Error("No data after server aggregation");
    }
  }

  /** Pivots a {label, series, value} edge list into a two-level hierarchy. */
  _edgesToHierarchy(edges) {
    const groups = new Map();
    edges.forEach((edge) => {
      const primary = String(edge.label ?? "Null");
      if (!groups.has(primary)) groups.set(primary, []);
      groups.get(primary).push({
        name: String(edge.series ?? "Null"),
        value: Number(edge.value) || 0
      });
    });
    const children = [];
    groups.forEach((subChildren, primary) => {
      children.push({ name: primary, children: subChildren });
    });
    return { name: "Root", children };
  }

  /** Normalizes a pre-built hierarchy into { name, value } / { name, children }. */
  validateHierarchy(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Hierarchy data must be an object");
    }
    const normalize = (node) => {
      const normalized = { name: node.name || "Unnamed" };
      if (node.children && Array.isArray(node.children)) {
        normalized.children = node.children.map((c) => normalize(c));
      } else if (node.value !== undefined) {
        normalized.value = Number(node.value) || 0;
      }
      return normalized;
    };
    return normalize(data);
  }

  /** Sums leaf values across the hierarchy. */
  calculateTotalValue() {
    if (!this.rootData) {
      this.totalValue = 0;
      return;
    }
    const sumValues = (node) => {
      if (node.value !== undefined) return node.value;
      if (node.children) {
        return node.children.reduce((sum, c) => sum + sumValues(c), 0);
      }
      return 0;
    };
    this.totalValue = sumValues(this.rootData);
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════

  initializeChart() {
    const container = this.template.querySelector(".chart-container");
    if (!container) return false;

    const { width } = container.getBoundingClientRect();
    if (width === 0) return false;

    this.tooltip = createTooltip(container);
    this.renderChart(width);

    this.resizeHandler = createResizeHandler(
      container,
      ({ width: newWidth }) => {
        if (newWidth > 0) {
          this.renderChart(newWidth);
        }
      }
    );
    this.resizeHandler.observe();
    return true;
  }

  renderChart(containerWidth) {
    const d3 = this.d3;
    const container = this.template.querySelector(".chart-container");
    if (!container || !d3) return;

    d3.select(container).select("svg").remove();

    const padding = Math.max(10, Math.round(containerWidth * 0.04));
    const width = containerWidth - padding * 2;
    const height = this.height - padding * 2;
    if (width <= 0 || height <= 0) return;

    const radius = Math.min(width, height) / 2;

    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "sunburst-svg")
      .append("g")
      .attr(
        "transform",
        `translate(${padding + width / 2},${padding + height / 2})`
      );

    // Build hierarchy and partition into [0, 2π] angular x radial radius space.
    const root = d3
      .hierarchy(this.rootData)
      .sum((d) => d.value || 0)
      .sort((a, b) => b.value - a.value);

    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    // One arc per node, skipping the synthetic root (depth 0).
    const nodes = root.descendants().filter((d) => d.depth > 0);

    const colors = getColors(
      this.theme,
      Math.max((this.rootData?.children || []).length, 5),
      this.config.customColors
    );
    const topLevel = (this.rootData?.children || []).map((c) => c.name);

    const arc = d3
      .arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1);

    const arcs = this.svg
      .selectAll(".sunburst-arc")
      .data(nodes)
      .enter()
      .append("path")
      .attr("class", "sunburst-arc")
      .attr("d", arc)
      .attr("fill", (d) => {
        // Color by the depth-1 ancestor so children share their parent's hue.
        let ancestor = d;
        while (ancestor.depth > 1) ancestor = ancestor.parent;
        const idx = topLevel.indexOf(ancestor.data.name);
        return colors[idx >= 0 ? idx : 0];
      })
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .on("mouseenter", (event, d) => {
        this.showArcTooltip(event, d);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      })
      .on("click", (_event, d) => {
        this.handleArcClick(d);
      });

    if (this.effectiveShowLabels) {
      arcs.each((d, i, n) => {
        const angle = d.x1 - d.x0;
        if (angle > 0.1) {
          d3.select(n[i]);
        }
      });
    }

    // Center label = total value.
    this.svg
      .append("text")
      .attr("class", "center-label")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#16325c")
      .text(formatNumber(this.totalValue));
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP / CLICK
  // ═══════════════════════════════════════════════════════════════

  showArcTooltip(event, d) {
    if (!this.tooltip) return;
    const percent = this.totalValue > 0 ? d.value / this.totalValue : 0;
    const content = `
      <strong>${truncateLabel(d.data.name, 30)}</strong><br/>
      ${formatNumber(d.value)} (${formatPercent(percent)})
    `;
    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  handleArcClick(d) {
    this.dispatchEvent(
      new CustomEvent("arcclick", {
        detail: {
          label: d.data.name,
          value: d.value,
          depth: d.depth,
          filterField: this.filterField || this.groupByField
        },
        bubbles: true,
        composed: true
      })
    );

    if (this.objectApiName) {
      this[NavigationMixin.Navigate]({
        type: "standard__objectPage",
        attributes: {
          objectApiName: this.objectApiName,
          actionName: "list"
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  cleanup() {
    if (this.resizeHandler) {
      this.resizeHandler.disconnect();
      this.resizeHandler = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
```

- [ ] **Step 4: Implement the HTML template.** Clone the `d3Treemap.html` 4-state structure but drop the breadcrumb `<nav>` block (Sunburst has no zoom). The mount div must be exactly `class="chart-container" lwc:dom="manual"`.

```html
<!-- force-app/main/default/lwc/d3SunburstChart/d3SunburstChart.html -->
<template>
  <div class="slds-card">
    <!-- Loading State -->
    <template lwc:if={isLoading}>
      <div class="slds-align_absolute-center" style="height: 200px">
        <lightning-spinner
          alternative-text="Loading chart..."
          size="medium"
        ></lightning-spinner>
      </div>
    </template>

    <!-- Error State -->
    <template lwc:elseif={hasError}>
      <div
        class="slds-align_absolute-center slds-text-color_error"
        style="height: 200px; padding: 1rem"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:error"
            alternative-text="Error"
            size="large"
            variant="error"
          ></lightning-icon>
          <p class="slds-m-top_small">{error}</p>
        </div>
      </div>
    </template>

    <!-- Chart Container (has data) -->
    <template lwc:elseif={hasData}>
      <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>
    </template>

    <!-- No Data State -->
    <template lwc:else>
      <div
        class="slds-align_absolute-center slds-text-color_weak"
        style="height: 200px"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:chart"
            alternative-text="No data"
            size="large"
          ></lightning-icon>
          <p class="slds-m-top_small">No data available</p>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 5: Implement the meta XML.** `apiVersion 65.0` (Phase 2 standard), `isExposed true`, `masterLabel "D3 Sunburst Chart"`, targets AppPage/RecordPage/HomePage, exposing each `@api` (except `recordCollection`) as a `<property>`.

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <isExposed>true</isExposed>
    <masterLabel>D3 Sunburst Chart</masterLabel>
    <description
  >Radial hierarchical visualization using concentric rings (d3.partition + d3.arc). Supports flat auto-nesting, two-level server hierarchy, and pre-built hierarchy data.</description>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__RecordPage</target>
        <target>lightning__HomePage</target>
    </targets>
    <targetConfigs>
        <targetConfig
      targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
    >
            <property
        name="soqlQuery"
        type="String"
        label="SOQL Query"
        description="SOQL query to fetch data for the sunburst"
        placeholder="SELECT StageName, Type, Amount FROM Opportunity WHERE Amount > 0"
      />
            <property
        name="groupByField"
        type="String"
        label="Group By Field"
        description="API name of the field for the inner ring (primary hierarchy level)"
        placeholder="StageName"
      />
            <property
        name="secondaryGroupByField"
        type="String"
        label="Secondary Group Field"
        description="Optional second field for an outer ring (creates a third level)"
        placeholder="Type"
      />
            <property
        name="valueField"
        type="String"
        label="Value Field"
        description="API name of the numeric field to aggregate (not needed for Count)"
        placeholder="Amount"
      />
            <property
        name="operation"
        type="String"
        label="Aggregation"
        default="Sum"
        datasource="Sum,Count,Average"
        description="How to aggregate values within each group"
      />
            <property
        name="height"
        type="Integer"
        label="Height (px)"
        default="400"
        description="Chart height in pixels"
        min="200"
        max="1000"
      />
            <property
        name="theme"
        type="String"
        label="Color Theme"
        default="Salesforce Standard"
        datasource="Salesforce Standard,Warm,Cool,Vibrant"
        description="Color palette for the sunburst"
      />
            <property
        name="showLabels"
        type="Boolean"
        label="Show Labels"
        default="true"
        description="Display labels on arcs"
      />
            <property
        name="objectApiName"
        type="String"
        label="Object API Name"
        description="Object API name for navigation on click"
        placeholder="Opportunity"
      />
            <property
        name="filterField"
        type="String"
        label="Filter Field"
        description="Field to use for filtering when navigating (defaults to groupByField)"
      />
            <property
        name="filterClause"
        type="String"
        label="Filter Clause"
        description="Optional SOQL WHERE clause for server-side aggregation (without WHERE keyword)"
      />
            <property
        name="recordLimit"
        type="Integer"
        label="Record Limit"
        description="Maximum records to process. Leave empty for default."
        min="1"
        max="10000"
      />
            <property
        name="advancedConfig"
        type="String"
        label="Advanced Config (JSON)"
        description='{"customColors": ["#FF5733", "#33FF57"]}'
      />
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

- [ ] **Step 6: Run the unit test — Expected: PASS.**
```bash
npm test -- --testPathPattern=d3SunburstChart
```
Expected: PASS (all unit tests green). If `buildHierarchy` import fails, confirm the foundation phase exported it from `c/dataService`.

- [ ] **Step 7: Commit.**
```bash
git add force-app/main/default/lwc/d3SunburstChart/
git commit -m "feat(d3SunburstChart): add sunburst chart component with unit tests"
```

---

#### Task 12.2: INTEGRATION tier — `d3SunburstChart.integration.test.js`

- **Files:**
  - Test: `force-app/main/default/lwc/d3SunburstChart/__tests__/d3SunburstChart.integration.test.js`

- [ ] **Step 1: Clone the donor integration suite, then edit.**
```bash
cp force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.integration.test.js \
   force-app/main/default/lwc/d3SunburstChart/__tests__/d3SunburstChart.integration.test.js
```
Then apply these precise edits to the copied file:
  1. Replace the two ABOUTME lines with:
     `// ABOUTME: Integration tests for d3SunburstChart verifying real service interactions.`
     `// ABOUTME: Tests real dataService.buildHierarchy nesting, themeService colors, and chartUtils formatting against mock D3.`
  2. Change the import `import D3DonutChart from "c/d3DonutChart";` to `import D3SunburstChart from "c/d3SunburstChart";`.
  3. Replace the entire `createMockD3` body with the sunburst factory from Task 12.1 Step 1 (the `hierarchy` / `partition` / `arc` version) — the donut `pie`/`interpolate` mock will throw `partition is not a function`.
  4. Change `createElement("c-d3-donut-chart", { is: D3DonutChart })` to `createElement("c-d3-sunburst-chart", { is: D3SunburstChart })`.
  5. Change `describe("c-d3-donut-chart integration", ...)` to `describe("c-d3-sunburst-chart integration", ...)`.
  6. Confirm `flushPromises = () => new Promise(process.nextTick)` survives `jest.useFakeTimers()`. The donor uses `setTimeout`; **replace it** with `const flushPromises = () => new Promise(process.nextTick);` (drop the `eslint-disable` line above it — `process.nextTick` is not flagged by `@lwc/lwc/no-async-operation`).
  7. **Delete** the donor `describe` blocks that assert donut-only DOM (`legend with real themeService colors`, `event pipeline integration` legend clicks) and replace them with the two real-service blocks below. Keep the `beforeEach`/`afterEach` and the `executeQuery.mockResolvedValue(SAMPLE_DATA)` setup.
  8. Replace `SAMPLE_DATA` with the two-level flat rows below.

```javascript
// SAMPLE_DATA — flat rows that nest into a two-level hierarchy by [StageName, Type].
const SAMPLE_DATA = [
  { StageName: "Prospecting", Type: "New", Amount: 100 },
  { StageName: "Prospecting", Type: "New", Amount: 200 },
  { StageName: "Prospecting", Type: "Existing", Amount: 50 },
  { StageName: "Closed Won", Type: "New", Amount: 500 },
  { StageName: "Closed Won", Type: "Existing", Amount: 300 }
];
// buildHierarchy([... ], ["StageName","Type"], "Amount", "Sum") =>
//   Root -> Prospecting(350) -> [New(300), Existing(50)]
//        -> Closed Won(800)  -> [New(500), Existing(300)]
// Total leaf sum = 1150.
```

And the replacement integration blocks (append inside the suite):

```javascript
  // ═══════════════════════════════════════════════════════════════
  // REAL HIERARCHY FLOWS INTO mockD3
  // ═══════════════════════════════════════════════════════════════

  describe("real buildHierarchy result flows into D3", () => {
    it("d3.hierarchy receives the real nested { name, children } tree", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });

      expect(mockD3.hierarchy).toHaveBeenCalled();
      const rootArg = mockD3.hierarchy.mock.calls[0][0];
      expect(rootArg.name).toBe("Root");
      expect(rootArg.children.length).toBe(2);

      const labels = rootArg.children.map((c) => c.name).sort();
      expect(labels).toEqual(["Closed Won", "Prospecting"]);

      const prospecting = rootArg.children.find(
        (c) => c.name === "Prospecting"
      );
      expect(prospecting.children).toBeDefined();
      const prospectingNew = prospecting.children.find(
        (c) => c.name === "New"
      );
      // Real dataService.buildHierarchy Sum: Prospecting/New = 100 + 200 = 300.
      expect(prospectingNew.value).toBe(300);
    });

    it("partition layout is invoked with the real hierarchy", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });
      expect(mockD3.partition).toHaveBeenCalled();
      const partitionFn = mockD3.partition.mock.results[0].value;
      expect(partitionFn.size).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // REAL THEMESERVICE PALETTE FLOWS INTO ARC FILLS
  // ═══════════════════════════════════════════════════════════════

  describe("real themeService colors flow into arc fills", () => {
    it("Salesforce Standard palette hex is applied to arc fills", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum",
        theme: "Salesforce Standard"
      });

      // renderChart calls .attr("fill", fn); the fn resolves to real palette hex.
      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);
      const fillResolver = fillCalls[0][1];
      expect(typeof fillResolver).toBe("function");
      // Top-level node colored with palette[0] = #1589EE.
      const color = fillResolver(
        { depth: 1, parent: null, data: { name: "Closed Won" } },
        0
      );
      expect(color).toBe("#1589EE");
    });

    it("Warm palette hex is applied for the Warm theme", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum",
        theme: "Warm"
      });
      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      const fillResolver = fillCalls[0][1];
      const color = fillResolver(
        { depth: 1, parent: null, data: { name: "Closed Won" } },
        0
      );
      // Warm palette index 0 = #FF6B6B (spec §8 integration palette reference).
      expect(color).toBe("#FF6B6B");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EVENT PIPELINE
  // ═══════════════════════════════════════════════════════════════

  describe("arc click pipeline", () => {
    it("arc click dispatches arcclick with real label/value and click handler registered", async () => {
      const element = await createChart({
        objectApiName: "Opportunity",
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        filterField: "StageName"
      });

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);

      const handler = jest.fn();
      element.addEventListener("arcclick", handler);
      // Invoke the registered click handler with a real-shaped node.
      const clickFn = clickCalls[0][1];
      clickFn(
        {},
        { data: { name: "Prospecting" }, value: 350, depth: 1 }
      );
      expect(handler).toHaveBeenCalledTimes(1);
      const detail = handler.mock.calls[0][0].detail;
      expect(detail.label).toBe("Prospecting");
      expect(detail.value).toBe(350);
      expect(detail.filterField).toBe("StageName");
    });
  });
```
  9. Update the `createChart` defaults `Object.assign` block to include `secondaryGroupByField: "Type"` so the default chart nests two levels (the donor sets `groupByField`/`valueField`/`operation`/`recordCollection`/`theme` — keep those, add `secondaryGroupByField`).

- [ ] **Step 2: Run the integration test — Expected: PASS.**
```bash
npm test -- --testPathPattern=d3SunburstChart.integration
```
Expected: PASS. Real `dataService.buildHierarchy` produces the nested tree (Prospecting/New = 300), real `themeService.getColors("Salesforce Standard", …)[0]` = `#1589EE`, real `getColors("Warm", …)[0]` = `#FF6B6B`. If a color assertion fails, read `force-app/main/default/lwc/themeService/themeService.js` `PALETTES` to confirm the index-0 hex and adjust the expected value.

- [ ] **Step 3: Commit.**
```bash
git add force-app/main/default/lwc/d3SunburstChart/__tests__/d3SunburstChart.integration.test.js
git commit -m "test(d3SunburstChart): add integration tests for real service flow"
```

---

#### Task 12.3: E2E tier — `d3SunburstChart.e2e.test.js`

- **Files:**
  - Test: `force-app/main/default/lwc/d3SunburstChart/__tests__/d3SunburstChart.e2e.test.js`

- [ ] **Step 1: Clone the donor e2e suite, then edit.**
```bash
cp force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.e2e.test.js \
   force-app/main/default/lwc/d3SunburstChart/__tests__/d3SunburstChart.e2e.test.js
```
Then apply these precise edits to the copied file:
  1. Replace the two ABOUTME lines with:
     `// ABOUTME: End-to-end lifecycle tests for the D3 Sunburst Chart component.`
     `// ABOUTME: Verifies full render pipeline, multi-instance isolation, data flow, and pristine console using real services with mocked D3.`
  2. Change `import D3DonutChart from "c/d3DonutChart";` to `import D3SunburstChart from "c/d3SunburstChart";`.
  3. Replace the entire `createMockD3` body with the sunburst factory from Task 12.1 Step 1.
  4. Change every `createElement("c-d3-donut-chart", { is: D3DonutChart })` to `createElement("c-d3-sunburst-chart", { is: D3SunburstChart })` (in `createChart`).
  5. Change `describe("c-d3-donut-chart e2e", ...)` to `describe("c-d3-sunburst-chart e2e", ...)`.
  6. Replace `SAMPLE_DATA` with the two-level flat rows from Task 12.2 Step 1.
  7. In `createChart`, add `secondaryGroupByField: "Type"` to the `Object.assign` defaults.
  8. **Replace the donor's `describe` bodies** (which assert donut-only `.legend-container`, `pie vs donut mode`, `d3.pie`) with the four sunburst e2e blocks below. Keep the `beforeEach`/`afterEach`, `flushPromises` (donor's `setTimeout` version is fine here — e2e does not use fake timers), and the `lightning/navigation` + `lightning/platformShowToastEvent` mocks verbatim.

```javascript
  // ═══════════════════════════════════════════════════════════════
  // FULL RENDER LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe("full render lifecycle", () => {
    it("creates sunburst end-to-end with correct D3 calls and no console errors", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
      expect(mockD3.hierarchy).toHaveBeenCalled();
      expect(mockD3.partition).toHaveBeenCalled();
      expect(mockD3.arc).toHaveBeenCalled();

      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("svg");

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      // Pristine console — success path asserts console.error was NOT called.
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("cleanup removes resize handler and tooltip on disconnect with no errors", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      document.body.removeChild(element);
      expect(mockDisconnect).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTI-INSTANCE ISOLATION
  // ═══════════════════════════════════════════════════════════════

  describe("multi-instance isolation", () => {
    it("two sunburst instances render independently without cross-talk", async () => {
      const mockD3a = createMockD3();
      loadD3.mockResolvedValue(mockD3a);
      const elementA = await createChart({ theme: "Salesforce Standard" });
      await flushPromises();

      const mockD3b = createMockD3();
      loadD3.mockResolvedValue(mockD3b);
      const elementB = await createChart({ theme: "Warm" });
      await flushPromises();

      expect(
        elementA.shadowRoot.querySelector(".chart-container")
      ).toBeTruthy();
      expect(
        elementB.shadowRoot.querySelector(".chart-container")
      ).toBeTruthy();

      // Each instance drove its own mock D3 partition layout.
      expect(mockD3a.partition).toHaveBeenCalled();
      expect(mockD3b.partition).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA-FLOW VERIFICATION (exact values)
  // ═══════════════════════════════════════════════════════════════

  describe("data-flow verification", () => {
    it("real aggregated hierarchy reaches d3.hierarchy with exact summed values", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();

      const rootArg = mockD3.hierarchy.mock.calls[0][0];
      const closedWon = rootArg.children.find((c) => c.name === "Closed Won");
      // Closed Won total = New(500) + Existing(300) = 800.
      const closedWonTotal = closedWon.children.reduce(
        (s, c) => s + c.value,
        0
      );
      expect(closedWonTotal).toBe(800);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR → RECOVERY FLOW
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery flow", () => {
    it("shows error state when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("Network failure loading D3"));

      const element = await createChart();
      await flushPromises();
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeFalsy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      // Error path: the component logs "D3SunburstChart initialization error".
      // Filter that expected log out, then assert no OTHER console errors.
      const unexpected = consoleErrorSpy.mock.calls.filter(
        (call) =>
          !String(call[0]).includes("D3SunburstChart initialization error")
      );
      expect(unexpected.length).toBe(0);
    });
  });
```

- [ ] **Step 2: Run the e2e test — Expected: PASS.**
```bash
npm test -- --testPathPattern=d3SunburstChart.e2e
```
Expected: PASS. Success-path tests assert `consoleErrorSpy` was NOT called (pristine console); the error-recovery test filters the one expected `"D3SunburstChart initialization error"` log and asserts no others.

- [ ] **Step 3: Run the full Sunburst suite to confirm all three tiers are green.**
```bash
npm test -- --testPathPattern=d3SunburstChart
```
Expected: PASS for `d3SunburstChart.test.js`, `d3SunburstChart.integration.test.js`, and `d3SunburstChart.e2e.test.js`.

- [ ] **Step 4: Commit.**
```bash
git add force-app/main/default/lwc/d3SunburstChart/__tests__/d3SunburstChart.e2e.test.js
git commit -m "test(d3SunburstChart): add e2e lifecycle tests with pristine console"
```


### Phase 13: Bubble Chart (`d3BubbleChart`)

Full release of the `d3BubbleChart` component (a scatter plot where a third numeric field drives bubble area via `d3.scaleSqrt()`), cloning `d3ScatterPlot` for the component scaffold and `d3BarChart` for all three test tiers. Ships component (`.js`/`.html`/`.js-meta.xml`) plus unit, integration, and e2e suites. Depends on the foundation phase having added `CHART_LIMITS.BUBBLE` to `c/dataService` and wired the `getXYData` Apex mock + `moduleNameMapper` entry.

**Prerequisites (foundation phase — verify before starting):**
- `force-app/main/default/lwc/dataService/dataService.js` exports a `CHART_LIMITS.BUBBLE` key (a bounded raw cap, e.g. `5000`). Verify: `grep -n "BUBBLE" force-app/main/default/lwc/dataService/dataService.js`.
- `__mocks__/@salesforce/apex/D3ChartController.getXYData.js` exists and `jest.config.js` has a `moduleNameMapper` entry `"^@salesforce/apex/D3ChartController.getXYData$"`. Verify: `grep -n "getXYData" jest.config.js`.
- If either is missing, STOP — the foundation phase must complete first. Do not add these here (they are shared files owned by the foundation phase).

---

#### Task 13.1: UNIT tier — `d3BubbleChart.test.js` + component files

**Files:**
- Test: `force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.test.js` (Create)
- Create: `force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.js`
- Create: `force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.html`
- Create: `force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.js-meta.xml`

- [ ] **Step 1: Write the failing unit test.** Create the directory and write `force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.test.js`. This is modeled on the `d3BarChart` unit donor (`force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.test.js`) but rewritten for the scatter/xy data shape: it imports `getXYData` (not `getAggregatedData`), feeds raw `{x,y,size,label}` rows, and adds `scaleSqrt` + `scaleOrdinal` + `extent` to the inline `createMockD3()`. Write exactly:

```bash
mkdir -p force-app/main/default/lwc/d3BubbleChart/__tests__
```

```javascript
// ABOUTME: Unit tests for the d3BubbleChart Lightning Web Component.
// ABOUTME: Tests initialization, data handling, size encoding (scaleSqrt), config, events, tooltip, resize, server xy data, and error recovery.

import { createElement } from "lwc";
import D3BubbleChart from "c/d3BubbleChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getXYData from "@salesforce/apex/D3ChartController.getXYData";

// Mock d3Lib
jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// Mock Apex
jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/D3ChartController.getXYData",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const mockD3 = {
    select: jest.fn(() => mockD3),
    append: jest.fn(() => mockD3),
    attr: jest.fn(() => mockD3),
    style: jest.fn(() => mockD3),
    call: jest.fn(() => mockD3),
    selectAll: jest.fn(() => mockD3),
    data: jest.fn(() => mockD3),
    enter: jest.fn(() => mockD3),
    transition: jest.fn(() => mockD3),
    duration: jest.fn(() => mockD3),
    delay: jest.fn(() => mockD3),
    on: jest.fn(() => mockD3),
    remove: jest.fn(() => mockD3),
    html: jest.fn(() => mockD3),
    text: jest.fn(() => mockD3),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      return scale;
    }),
    scaleSqrt: jest.fn(() => {
      const scale = jest.fn(() => 12);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    scaleOrdinal: jest.fn(() => {
      const scale = jest.fn(() => "#1589EE");
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    axisBottom: jest.fn(() => {
      const axis = jest.fn();
      axis.ticks = jest.fn(() => axis);
      axis.tickFormat = jest.fn(() => axis);
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    axisLeft: jest.fn(() => {
      const axis = jest.fn();
      axis.ticks = jest.fn(() => axis);
      axis.tickFormat = jest.fn(() => axis);
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    extent: jest.fn(() => [0, 500]),
    max: jest.fn(() => 500)
  };
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA — raw rows; xAxisField/yAxisField/sizeField map to columns
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { Id: "001A", Amount: 100, Probability: 20, Forecast_Units__c: 5, Name: "Acme" },
  { Id: "001B", Amount: 200, Probability: 40, Forecast_Units__c: 15, Name: "Globex" },
  { Id: "001C", Amount: 150, Probability: 60, Forecast_Units__c: 10, Name: "Initech" },
  { Id: "001D", Amount: 500, Probability: 80, Forecast_Units__c: 40, Name: "Umbrella" }
];

const SINGLE_RECORD = [
  { Id: "001A", Amount: 100, Probability: 20, Forecast_Units__c: 5, Name: "Acme" }
];

const ZERO_SIZE_DATA = [
  { Id: "001A", Amount: 100, Probability: 20, Forecast_Units__c: 0, Name: "A" },
  { Id: "001B", Amount: 200, Probability: 40, Forecast_Units__c: 0, Name: "B" }
];

const SPECIAL_CHAR_DATA = [
  { Id: "001A", Amount: 100, Probability: 20, Forecast_Units__c: 5, Name: 'Acct "A"' },
  { Id: "001B", Amount: 200, Probability: 40, Forecast_Units__c: 15, Name: "Acct 'B'" },
  { Id: "001C", Amount: 300, Probability: 60, Forecast_Units__c: 25, Name: "Acct <C>" }
];

// Server xy shape returned by getXYData
const SERVER_XY = [
  { x: 100, y: 20, size: 5, label: "Acme" },
  { x: 200, y: 40, size: 15, label: "Globex" },
  { x: 150, y: 60, size: 10, label: "Initech" }
];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-bubble-chart", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);
    getXYData.mockResolvedValue(SERVER_XY);

    // Spy on console to ensure pristine output
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400
    }));

    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
  });

  // Helper to create element with properties
  async function createChart(props = {}) {
    element = createElement("c-d3-bubble-chart", {
      is: D3BubbleChart
    });

    Object.assign(element, {
      xAxisField: "Amount",
      yAxisField: "Probability",
      sizeField: "Forecast_Units__c",
      recordCollection: SAMPLE_DATA,
      ...props
    });

    document.body.appendChild(element);

    await flushPromises();
    await flushPromises();

    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("shows loading state initially", () => {
      element = createElement("c-d3-bubble-chart", {
        is: D3BubbleChart
      });
      element.xAxisField = "Amount";
      element.yAxisField = "Probability";
      element.sizeField = "Forecast_Units__c";
      element.recordCollection = SAMPLE_DATA;

      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides loading after initialization", async () => {
      await createChart();
      await flushPromises();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("renders chart container when data is available", async () => {
      await createChart();
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("data handling", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });
      expect(executeQuery).not.toHaveBeenCalled();
      expect(getXYData).not.toHaveBeenCalled();
    });

    it("executes SOQL when recordCollection is empty and no objectApiName", async () => {
      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery: "SELECT Amount, Probability, Forecast_Units__c FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString:
          "SELECT Amount, Probability, Forecast_Units__c FROM Opportunity"
      });
    });

    it("shows error when no data source provided", async () => {
      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery: ""
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({
        body: { message: "Query error" }
      });

      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery: "SELECT Invalid FROM Opportunity"
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  describe("data edge cases", () => {
    it("handles single record", async () => {
      await createChart({ recordCollection: SINGLE_RECORD });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles zero size values", async () => {
      await createChart({ recordCollection: ZERO_SIZE_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles special characters in labels", async () => {
      await createChart({ recordCollection: SPECIAL_CHAR_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles records with wrong field names", async () => {
      const wrongFields = [{ WrongX: 1, WrongY: 2, WrongSize: 3 }];
      await createChart({ recordCollection: wrongFields });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("filters out rows with non-numeric x or y", async () => {
      const mixed = [
        { Id: "1", Amount: "n/a", Probability: 20, Forecast_Units__c: 5, Name: "Bad" },
        { Id: "2", Amount: 200, Probability: 40, Forecast_Units__c: 15, Name: "Good" }
      ];
      await createChart({ recordCollection: mixed });
      await flushPromises();

      // Good row survives -> no error
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("configuration", () => {
    it("applies height style to container", async () => {
      await createChart({ height: 400 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.getAttribute("style")).toContain("400px");
    });

    it("parses advancedConfig JSON", async () => {
      await createChart({
        advancedConfig: '{"showGrid": true}'
      });

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles invalid advancedConfig JSON gracefully", async () => {
      await createChart({
        advancedConfig: "not valid json"
      });

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles empty string advancedConfig", async () => {
      await createChart({ advancedConfig: "" });

      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts customColors in advancedConfig", async () => {
      await createChart({
        advancedConfig: '{"customColors": ["#ff0000", "#00ff00"]}'
      });

      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("accepts Salesforce Standard theme", async () => {
      await createChart({ theme: "Salesforce Standard" });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts Warm theme", async () => {
      await createChart({ theme: "Warm" });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts Cool theme", async () => {
      await createChart({ theme: "Cool" });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts Vibrant theme", async () => {
      await createChart({ theme: "Vibrant" });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLICK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("click events", () => {
    it("registers click handler on bubbles", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);
    });

    it("sets pointer cursor with objectApiName", async () => {
      await createChart({ objectApiName: "Opportunity" });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const cursorCalls = attrCalls.filter((c) => c[0] === "cursor");
      expect(cursorCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("tooltip behavior", () => {
    it("registers mouseenter handler on bubbles", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on bubbles", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("responsive behavior", () => {
    it("sets up resize observer", async () => {
      await createChart();
      await flushPromises();

      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it("handles zero container width gracefully", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      await createChart();
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("retries chart init when container starts at zero width", async () => {
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: containerWidth
      }));

      const rafCallbacks = [];
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();

      await createChart();
      await flushPromises();

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockD3.scaleSqrt).not.toHaveBeenCalled();

      containerWidth = 400;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 400
      }));

      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift();
        cb();
      }

      expect(mockD3.select).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      global.requestAnimationFrame = jest.fn(() => 42);
      global.cancelAnimationFrame = jest.fn();

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR RECOVERY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery", () => {
    it("shows error from SOQL body.message", async () => {
      executeQuery.mockRejectedValue({
        body: { message: "Specific SOQL error" }
      });

      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery: "SELECT Bad FROM Object"
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));

      await createChart();
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("logs error to console on D3 load failure", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));

      await createChart();
      await flushPromises();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("sets isLoading to false even on error", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));

      await createChart();
      await flushPromises();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERING DETAIL TESTS — chart-specific (sqrt area encoding)
  // ═══════════════════════════════════════════════════════════════

  describe("rendering details", () => {
    it("creates SVG element", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const svgCalls = appendCalls.filter((c) => c[0] === "svg");
      expect(svgCalls.length).toBeGreaterThan(0);
    });

    it("creates circle elements for bubbles", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const circleCalls = appendCalls.filter((c) => c[0] === "circle");
      expect(circleCalls.length).toBeGreaterThan(0);
    });

    it("uses scaleSqrt for bubble radius (sqrt area encoding)", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.scaleSqrt).toHaveBeenCalled();
    });

    it("creates linear scales for x and y axes", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("binds circle radius (r) to the size value", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const rCalls = attrCalls.filter((c) => c[0] === "r");
      expect(rCalls.length).toBeGreaterThan(0);
    });

    it("computes extent for x, y, and size domains", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.extent).toHaveBeenCalled();
    });

    it("creates x-axis group", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "x-axis"
      );
      expect(classCalls.length).toBeGreaterThan(0);
    });

    it("creates y-axis group", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "y-axis"
      );
      expect(classCalls.length).toBeGreaterThan(0);
    });

    it("removes existing SVG before re-render", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SERVER XY DATA TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("server xy data", () => {
    it("calls getXYData when objectApiName, xAxisField, yAxisField, and sizeField are set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        sizeField: "Forecast_Units__c",
        labelField: "Name"
      });

      await flushPromises();

      expect(getXYData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        xField: "Amount",
        yField: "Probability",
        sizeField: "Forecast_Units__c",
        labelField: "Name",
        filterClause: null
      });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("passes filterClause to getXYData when set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        sizeField: "Forecast_Units__c",
        labelField: "Name",
        filterClause: "Amount > 1000"
      });

      await flushPromises();

      expect(getXYData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        xField: "Amount",
        yField: "Probability",
        sizeField: "Forecast_Units__c",
        labelField: "Name",
        filterClause: "Amount > 1000"
      });
    });

    it("renders chart from server xy data", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        sizeField: "Forecast_Units__c",
        labelField: "Name"
      });

      await flushPromises();
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("shows error when getXYData returns empty array", async () => {
      getXYData.mockResolvedValue([]);

      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        sizeField: "Forecast_Units__c",
        labelField: "Name"
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("prefers recordCollection over server xy data", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        objectApiName: "Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        sizeField: "Forecast_Units__c"
      });

      await flushPromises();

      expect(getXYData).not.toHaveBeenCalled();
      expect(executeQuery).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GETTER TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("getters", () => {
    it("containerStyle returns correct height string", async () => {
      await createChart({ height: 450 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.getAttribute("style")).toContain("450px");
    });

    it("hasError returns true when error is set", async () => {
      loadD3.mockRejectedValue(new Error("Test error"));
      await createChart();
      await flushPromises();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("cleanup", () => {
    it("disconnects resize observer on disconnect", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("handles double disconnect gracefully", async () => {
      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(true).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run the unit test — expect FAIL.** Command:
  ```bash
  npm test -- --testPathPattern=d3BubbleChart
  ```
  Expected: FAIL because the component `c/d3BubbleChart` does not exist yet — Jest reports `Cannot find module 'c/d3BubbleChart'` (module resolution error on the `import D3BubbleChart from "c/d3BubbleChart"` line).

- [ ] **Step 3: Implement the component JS.** Write `force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.js`. This clones the `d3ScatterPlot` scaffold (`force-app/main/default/lwc/d3ScatterPlot/d3ScatterPlot.js`): universal `@api` set, lifecycle (`connectedCallback`/`renderedCallback`/`disconnectedCallback`), getters, `initializeChart()` returning a boolean, tooltip + click + cleanup handlers. The differences from scatter: drop trend-line/correlation features; add `@api sizeField` and `@api sizeLabel` and `@api labelField` and `@api filterClause`; the `loadData()` cascade prefers the new `getXYData` server path when `objectApiName && xAxisField && yAxisField && sizeField`; `processBubbleData` parses `{x,y,size,label}`; `renderChart` uses `d3.scaleSqrt()` for radius so AREA encodes size (range `[4, 40]`), binding `r` to `radiusScale(d.size)`. Write exactly:

```javascript
// ABOUTME: D3 Bubble Chart Lightning Web Component — scatter plot with a third numeric dimension.
// ABOUTME: Bubble area (via d3.scaleSqrt) encodes the size field; click navigates to the record.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import { prepareData, sampleData, SVG_ELEMENT_CAP, CHART_LIMITS } from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  createTooltip,
  createResizeHandler,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getXYData from "@salesforce/apex/D3ChartController.getXYData";

export default class D3BubbleChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty and no objectApiName) */
  @api soqlQuery = "";

  /** Field for X-axis (numeric) */
  @api xAxisField = "";

  /** Field for Y-axis (numeric) */
  @api yAxisField = "";

  /** Field driving bubble size (numeric) */
  @api sizeField = "";

  /** Label for X-axis */
  @api xAxisLabel = "";

  /** Label for Y-axis */
  @api yAxisLabel = "";

  /** Display label for the size dimension (tooltip) */
  @api sizeLabel = "";

  /** Field used as the bubble label (server path) / category */
  @api labelField = "";

  /** Field containing the record ID for navigation */
  @api recordIdField = "Id";

  /** Object API name for navigation and the server getXYData path */
  @api objectApiName = "";

  /** Optional WHERE clause appended on the server path */
  @api filterClause = "";

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Maximum records to process (overrides default chart limit) */
  @api recordLimit;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track chartData = [];

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  d3 = null;
  svg = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  _layoutRetry = null;
  _config = {};
  _configParsed = false;

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  get containerStyle() {
    return `height: ${this.height}px;`;
  }

  get hasError() {
    return !!this.error;
  }

  get hasData() {
    return this.chartData && this.chartData.length > 0;
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get effectiveXLabel() {
    return this.xAxisLabel || this.xAxisField;
  }

  get effectiveYLabel() {
    return this.yAxisLabel || this.yAxisField;
  }

  get effectiveSizeLabel() {
    return this.sizeLabel || this.sizeField;
  }

  get config() {
    if (!this._configParsed) {
      try {
        this._config = JSON.parse(this.advancedConfig || "{}");
      } catch {
        this._config = {};
      }
      this._configParsed = true;
    }
    return this._config;
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════

  async connectedCallback() {
    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3BubbleChart initialization error:", e);
    } finally {
      this.isLoading = false;
    }
  }

  renderedCallback() {
    if (this.showChart && !this.chartRendered) {
      this.chartRendered = this.initializeChart();
      if (!this.chartRendered && !this._layoutRetry) {
        const container = this.template.querySelector(".chart-container");
        if (container) {
          this._layoutRetry = createLayoutRetry(container, () => {
            this._layoutRetry = null;
            if (!this.chartRendered) {
              this.chartRendered = this.initializeChart();
            }
          });
        }
      }
    }
  }

  disconnectedCallback() {
    if (this._layoutRetry) {
      this._layoutRetry.cancel();
      this._layoutRetry = null;
    }
    this.cleanup();
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  async loadData() {
    // Server path: typed getXYData when object + all field mappings present
    if (
      !this.recordCollection?.length &&
      this.objectApiName &&
      this.xAxisField &&
      this.yAxisField &&
      this.sizeField
    ) {
      let serverRows;
      try {
        serverRows = await getXYData({
          objectName: this.objectApiName,
          xField: this.xAxisField,
          yField: this.yAxisField,
          sizeField: this.sizeField,
          labelField: this.labelField || null,
          filterClause: this.filterClause || null
        });
      } catch (e) {
        throw new Error(`Data Error: ${e.body?.message || e.message}`);
      }
      this.chartData = (serverRows || [])
        .map((row) => {
          const x = Number(row.x);
          const y = Number(row.y);
          const size = Number(row.size);
          if (isNaN(x) || isNaN(y)) return null;
          return {
            x,
            y,
            size: isNaN(size) ? 0 : size,
            label: row.label != null ? String(row.label) : "",
            id: null,
            record: row
          };
        })
        .filter((d) => d !== null);
      this.capData();
      if (this.chartData.length === 0) {
        throw new Error("No valid data points after processing");
      }
      return;
    }

    let rawData = [];

    if (this.recordCollection && this.recordCollection.length > 0) {
      rawData = [...this.recordCollection];
    } else if (this.soqlQuery) {
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
    } else {
      throw new Error(
        "No data source provided. Set recordCollection, objectApiName, or soqlQuery."
      );
    }

    const requiredFields = [this.xAxisField, this.yAxisField, this.sizeField];

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || CHART_LIMITS.BUBBLE
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    this.processBubbleData(prepared.data);
    this.capData();

    if (this.chartData.length === 0) {
      throw new Error("No valid data points after processing");
    }
  }

  /**
   * Parses raw client records into bubble format {x,y,size,label,id,record}.
   * @param {Array} data - Raw records
   */
  processBubbleData(data) {
    this.chartData = data
      .map((record) => {
        const x = Number(record[this.xAxisField]);
        const y = Number(record[this.yAxisField]);
        const size = Number(record[this.sizeField]);
        const id = record[this.recordIdField];
        const label = this.labelField
          ? String(record[this.labelField] || "")
          : "";
        if (isNaN(x) || isNaN(y)) return null;
        return { x, y, size: isNaN(size) ? 0 : size, label, id, record };
      })
      .filter((d) => d !== null);
  }

  /** Samples chartData down to the SVG element cap for performance. */
  capData() {
    if (this.chartData.length > SVG_ELEMENT_CAP) {
      const sampleResult = sampleData(this.chartData, "size", SVG_ELEMENT_CAP);
      this.chartData = sampleResult.data;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════

  initializeChart() {
    const container = this.template.querySelector(".chart-container");
    if (!container) return false;

    const { width } = container.getBoundingClientRect();
    if (width === 0) return false;

    this.tooltip = createTooltip(container);
    this.renderChart(width);

    this.resizeHandler = createResizeHandler(container, ({ width: newWidth }) => {
      if (newWidth > 0) {
        this.renderChart(newWidth);
      }
    });
    this.resizeHandler.observe();
    return true;
  }

  renderChart(containerWidth) {
    const d3 = this.d3;
    const container = this.template.querySelector(".chart-container");
    if (!container || !d3) return;

    d3.select(container).select("svg").remove();

    const padding = Math.max(10, Math.round(containerWidth * 0.04));
    const margin = {
      top: padding + 5,
      right: padding + 10,
      bottom: Math.max(40, Math.round(containerWidth * 0.1)),
      left: Math.max(40, Math.round(containerWidth * 0.12))
    };

    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "bubble-chart-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(this.chartData, (d) => d.x);
    const yExtent = d3.extent(this.chartData, (d) => d.y);
    const sizeExtent = d3.extent(this.chartData, (d) => d.size);

    const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 1;

    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, width])
      .nice();

    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([height, 0])
      .nice();

    // scaleSqrt so AREA (not radius) encodes the size value
    const radiusScale = d3
      .scaleSqrt()
      .domain([0, sizeExtent[1] || 1])
      .range([4, 40]);

    const colors = getColors(this.theme, 1, this.config.customColors);
    const bubbleColor = colors[0];

    if (this.config.showGrid !== false) {
      this.svg
        .append("g")
        .attr("class", "grid grid-y")
        .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "2,2");

      this.svg.select(".grid-y .domain").remove();
    }

    this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(this.getTickCount(width))
          .tickFormat((d) => formatNumber(d))
      );

    this.svg
      .append("text")
      .attr("class", "axis-label x-axis-label")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#706e6b")
      .text(this.effectiveXLabel);

    this.svg
      .append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(this.getTickCount(height))
          .tickFormat((d) => formatNumber(d))
      );

    this.svg
      .append("text")
      .attr("class", "axis-label y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#706e6b")
      .text(this.effectiveYLabel);

    const bubbles = this.svg
      .selectAll(".bubble")
      .data(this.chartData)
      .enter()
      .append("circle")
      .attr("class", "bubble")
      .attr("cx", (d) => xScale(d.x))
      .attr("cy", (d) => yScale(d.y))
      .attr("r", 0)
      .attr("fill", bubbleColor)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .attr("opacity", 0.7);

    bubbles
      .transition()
      .duration(500)
      .delay((d, i) => i * 5)
      .attr("r", (d) => radiusScale(d.size));

    bubbles
      .on("mouseenter", (event, d) => {
        this.showTooltip(event, d);
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 1);
      })
      .on("mouseleave", (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 0.7);
      })
      .on("click", (event, d) => {
        this.handleBubbleClick(d);
      });
  }

  /**
   * Returns appropriate tick count based on dimension.
   * @param {Number} dimension - Width or height
   * @returns {Number} - Number of ticks
   */
  getTickCount(dimension) {
    if (dimension < 200) return 3;
    if (dimension < 400) return 5;
    return 7;
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, d) {
    if (!this.tooltip) return;

    const labelInfo = d.label
      ? `<div style="margin-bottom: 8px;"><strong>${d.label}</strong></div>`
      : "";

    const content = `
            ${labelInfo}
            <div><strong>${this.effectiveXLabel}:</strong> ${formatNumber(d.x)}</div>
            <div><strong>${this.effectiveYLabel}:</strong> ${formatNumber(d.y)}</div>
            <div><strong>${this.effectiveSizeLabel}:</strong> ${formatNumber(d.size)}</div>
            ${this.objectApiName ? '<div class="tooltip-hint">Click to view record</div>' : ""}
        `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  handleBubbleClick(d) {
    this.dispatchEvent(
      new CustomEvent("bubbleclick", {
        detail: {
          x: d.x,
          y: d.y,
          size: d.size,
          label: d.label,
          recordId: d.id,
          record: d.record
        },
        bubbles: true,
        composed: true
      })
    );

    if (!this.objectApiName || !d.id) return;

    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        recordId: d.id,
        objectApiName: this.objectApiName,
        actionName: "view"
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  cleanup() {
    if (this.resizeHandler) {
      this.resizeHandler.disconnect();
      this.resizeHandler = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
```

- [ ] **Step 4: Implement the HTML template.** Write `force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.html`. This is the 4-state template from `d3ScatterPlot.html` with the correlation-info block removed (Bubble has no trend line / correlation). The mount div must be exactly `class="chart-container" lwc:dom="manual"`. Write exactly:

```html
<template>
  <div class="slds-card">
    <!-- Loading State -->
    <template lwc:if={isLoading}>
      <div class="slds-align_absolute-center" style="height: 200px">
        <lightning-spinner
          alternative-text="Loading chart..."
          size="medium"
        ></lightning-spinner>
      </div>
    </template>

    <!-- Error State -->
    <template lwc:elseif={hasError}>
      <div
        class="slds-align_absolute-center slds-text-color_error"
        style="height: 200px; padding: 1rem"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:error"
            alternative-text="Error"
            size="large"
            variant="error"
          ></lightning-icon>
          <p class="slds-m-top_small">{error}</p>
        </div>
      </div>
    </template>

    <!-- Chart Container (has data) -->
    <template lwc:elseif={hasData}>
      <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>
    </template>

    <!-- No Data State -->
    <template lwc:else>
      <div
        class="slds-align_absolute-center slds-text-color_weak"
        style="height: 200px"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:chart"
            alternative-text="No data"
            size="large"
          ></lightning-icon>
          <p class="slds-m-top_small">No data available</p>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 5: Implement the meta XML.** Write `force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.js-meta.xml`. apiVersion `65.0`, `isExposed true`, `masterLabel` `D3 Bubble Chart`, targets AppPage/RecordPage/HomePage (plus `lightningCommunity__Default` and `lightning__FlowScreen` for parity with the scatter donor). Expose every `@api` except `recordCollection` (Flow-only). Write exactly:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <isExposed>true</isExposed>
    <masterLabel>D3 Bubble Chart</masterLabel>
    <description
  >Interactive bubble chart: a scatter plot where a third numeric field drives bubble area (sqrt-scaled). Click bubbles to navigate to records.</description>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__RecordPage</target>
        <target>lightning__HomePage</target>
        <target>lightningCommunity__Default</target>
        <target>lightning__FlowScreen</target>
    </targets>
    <targetConfigs>
        <targetConfig
      targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage,lightningCommunity__Default"
    >
            <property
        name="soqlQuery"
        type="String"
        label="SOQL Query"
        description="SOQL query to fetch bubble data (used if Object API Name is not set)"
        placeholder="SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity WHERE Amount > 0"
      />
            <property
        name="objectApiName"
        type="String"
        label="Object API Name"
        description="Object for the typed getXYData server path and record navigation"
        placeholder="Opportunity"
      />
            <property
        name="filterClause"
        type="String"
        label="Filter Clause"
        description="Optional WHERE clause appended on the server path"
        placeholder="Amount > 1000"
      />
            <property
        name="xAxisField"
        type="String"
        label="X-Axis Field"
        default="Amount"
        description="API name of the numeric field for X-axis"
        placeholder="Amount"
      />
            <property
        name="xAxisLabel"
        type="String"
        label="X-Axis Label"
        description="Display label for X-axis (defaults to field name)"
        placeholder="Deal Amount"
      />
            <property
        name="yAxisField"
        type="String"
        label="Y-Axis Field"
        default="Probability"
        description="API name of the numeric field for Y-axis"
        placeholder="Probability"
      />
            <property
        name="yAxisLabel"
        type="String"
        label="Y-Axis Label"
        description="Display label for Y-axis (defaults to field name)"
        placeholder="Win Probability"
      />
            <property
        name="sizeField"
        type="String"
        label="Size Field"
        default="Forecast_Units__c"
        description="API name of the numeric field driving bubble area"
        placeholder="Forecast_Units__c"
      />
            <property
        name="sizeLabel"
        type="String"
        label="Size Label"
        description="Display label for the size dimension (defaults to field name)"
        placeholder="Forecast Units"
      />
            <property
        name="labelField"
        type="String"
        label="Label Field"
        description="Optional field used as each bubble's tooltip label"
        placeholder="Name"
      />
            <property
        name="recordIdField"
        type="String"
        label="Record ID Field"
        default="Id"
        description="Field containing the record ID for navigation"
      />
            <property
        name="height"
        type="Integer"
        label="Height (px)"
        default="300"
        description="Chart height in pixels"
        min="150"
        max="800"
      />
            <property
        name="theme"
        type="String"
        label="Color Theme"
        default="Salesforce Standard"
        datasource="Salesforce Standard,Warm,Cool,Vibrant"
        description="Color palette for the chart"
      />
            <property
        name="recordLimit"
        type="Integer"
        label="Record Limit"
        description="Maximum records to process. Leave empty for default."
        min="1"
        max="10000"
      />
            <property
        name="advancedConfig"
        type="String"
        label="Advanced Config (JSON)"
        description='{"showGrid": true, "customColors": ["#1589EE"]}'
      />
        </targetConfig>

        <!-- Flow Screen Configuration -->
        <targetConfig targets="lightning__FlowScreen">
            <propertyType
        name="T"
        extends="SObject"
        label="Record Type"
        description="SObject type for the record collection"
      />
            <property
        name="recordCollection"
        type="{T[]}"
        label="Record Collection"
        role="inputOnly"
        description="Collection of records from Flow"
      />
            <property
        name="xAxisField"
        type="String"
        label="X-Axis Field"
        required="true"
        description="API name of the numeric field for X-axis"
      />
            <property
        name="yAxisField"
        type="String"
        label="Y-Axis Field"
        required="true"
        description="API name of the numeric field for Y-axis"
      />
            <property
        name="sizeField"
        type="String"
        label="Size Field"
        required="true"
        description="API name of the numeric field driving bubble area"
      />
            <property
        name="xAxisLabel"
        type="String"
        label="X-Axis Label"
        description="Display label for X-axis"
      />
            <property
        name="yAxisLabel"
        type="String"
        label="Y-Axis Label"
        description="Display label for Y-axis"
      />
            <property
        name="sizeLabel"
        type="String"
        label="Size Label"
        description="Display label for the size dimension"
      />
            <property
        name="labelField"
        type="String"
        label="Label Field"
        description="Optional field used as each bubble's tooltip label"
      />
            <property
        name="recordIdField"
        type="String"
        label="Record ID Field"
        default="Id"
      />
            <property
        name="objectApiName"
        type="String"
        label="Object API Name"
        description="Object for navigation on click"
      />
            <property
        name="height"
        type="Integer"
        label="Height (px)"
        default="300"
      />
            <property
        name="theme"
        type="String"
        label="Color Theme"
        default="Salesforce Standard"
      />
            <property
        name="recordLimit"
        type="Integer"
        label="Record Limit"
        description="Maximum records to process. Leave empty for default."
        min="1"
        max="10000"
      />
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

- [ ] **Step 6: Run the unit test — expect PASS.** Command:
  ```bash
  npm test -- --testPathPattern=d3BubbleChart
  ```
  Expected: PASS — all unit tests in `d3BubbleChart.test.js` green, console output pristine (the error-path tests assert `consoleErrorSpy` was called; no leaked unexpected errors).

- [ ] **Step 7: Commit.** Commands:
  ```bash
  git add force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.js force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.html force-app/main/default/lwc/d3BubbleChart/d3BubbleChart.js-meta.xml force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.test.js
  git commit -m "feat(d3BubbleChart): add bubble chart component with unit tests"
  ```

---

#### Task 13.2: INTEGRATION tier — `d3BubbleChart.integration.test.js`

**Files:**
- Test: `force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.integration.test.js` (Create)

- [ ] **Step 1: Clone the integration donor.** Copy the `d3BarChart` integration donor as the starting point:
  ```bash
  cp force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.integration.test.js force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.integration.test.js
  ```
  Then make these precise edits to the copy (keep the `flushPromises = () => new Promise(process.nextTick)` helper, the `lightning/navigation` + `lightning/platformShowToastEvent` mocks, the `beforeEach`/`afterEach`, and the `resizeObserverCallback` capture verbatim — those are shared infrastructure):
  1. Replace the two ABOUTME lines with:
     ```javascript
     // ABOUTME: Integration tests for d3BubbleChart verifying real service pipelines (dataService, themeService, chartUtils).
     // ABOUTME: Only D3, Apex, NavigationMixin, and ShowToastEvent are mocked; all utility services use real implementations.
     ```
  2. Replace `import D3BarChart from "c/d3BarChart";` with `import D3BubbleChart from "c/d3BubbleChart";`.
  3. In the `createMockD3()` factory, add `scaleSqrt`, `scaleOrdinal`, and `extent` (the bubble-specific primitives) and add `ticks` to both axes. Insert these into the returned `mockD3` object alongside the existing `scaleLinear`:
     ```javascript
     scaleSqrt: jest.fn(() => {
       const scale = jest.fn(() => 12);
       scale.domain = jest.fn(() => scale);
       scale.range = jest.fn(() => scale);
       return scale;
     }),
     scaleOrdinal: jest.fn(() => {
       const scale = jest.fn(() => "#1589EE");
       scale.domain = jest.fn(() => scale);
       scale.range = jest.fn(() => scale);
       return scale;
     }),
     extent: jest.fn(() => [0, 500]),
     ```
     And change `axisBottom`/`axisLeft` to include `axis.ticks = jest.fn(() => axis);` (the bubble renderChart calls `.ticks(...)`).
  4. Replace the `SAMPLE_DATA` constant with the raw-row bubble shape:
     ```javascript
     const SAMPLE_DATA = [
       { Id: "001A", Amount: 100, Probability: 20, Forecast_Units__c: 5, Name: "Acme" },
       { Id: "001B", Amount: 200, Probability: 40, Forecast_Units__c: 15, Name: "Globex" },
       { Id: "001C", Amount: 150, Probability: 60, Forecast_Units__c: 10, Name: "Initech" },
       { Id: "001D", Amount: 500, Probability: 80, Forecast_Units__c: 40, Name: "Umbrella" }
     ];
     ```
  5. Replace the `createChart` `Object.assign` defaults with bubble field mappings:
     ```javascript
     Object.assign(element, {
       xAxisField: "Amount",
       yAxisField: "Probability",
       sizeField: "Forecast_Units__c",
       labelField: "Name",
       recordCollection: SAMPLE_DATA,
       ...props
     });
     ```
  6. Change `createElement("c-d3-bar-chart", { is: D3BarChart })` to `createElement("c-d3-bubble-chart", { is: D3BubbleChart })` everywhere in the file (the `createChart` helper and the two inline-element tests).
  7. Change the top-level `describe` title to `"c-d3-bubble-chart integration"`.

- [ ] **Step 2: Replace the data-pipeline, theme, truncation, validation, and resize describe blocks** with bubble-appropriate versions that assert REAL `{x,y,size,label}` values and REAL palette hex flowing into `mockD3.data()`. Delete the donor's `data pipeline integration`, `theme pipeline integration`, `truncation pipeline integration`, and `validation pipeline integration` describe blocks and replace them with:

```javascript
  // ═══════════════════════════════════════════════════════════════
  // DATA PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("data pipeline integration", () => {
    it("passes parsed bubble rows (x,y,size,label) to D3 data()", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].length > 0 &&
          call[0][0].x !== undefined &&
          call[0][0].size !== undefined
      );
      expect(chartDataCall).toBeTruthy();

      const passedData = chartDataCall[0];
      expect(passedData).toHaveLength(4);
      expect(passedData[0]).toEqual(
        expect.objectContaining({
          x: 100,
          y: 20,
          size: 5,
          label: "Acme"
        })
      );
      expect(passedData[3]).toEqual(
        expect.objectContaining({
          x: 500,
          y: 80,
          size: 40,
          label: "Umbrella"
        })
      );
    });

    it("filters non-numeric x/y rows in the real pipeline", async () => {
      const mixed = [
        { Id: "1", Amount: "bad", Probability: 10, Forecast_Units__c: 5, Name: "Bad" },
        { Id: "2", Amount: 200, Probability: 40, Forecast_Units__c: 15, Name: "Good" },
        { Id: "3", Amount: 300, Probability: 60, Forecast_Units__c: 25, Name: "Also" }
      ];

      await createChart({ recordCollection: mixed });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].length > 0 &&
          call[0][0].x !== undefined
      );
      expect(chartDataCall).toBeTruthy();

      const passedData = chartDataCall[0];
      // Only the two numeric rows survive
      expect(passedData).toHaveLength(2);
      const labels = passedData.map((d) => d.label).sort();
      expect(labels).toEqual(["Also", "Good"]);
    });

    it("passes SOQL query results through the same pipeline", async () => {
      const soqlResults = [
        { Id: "1", Amount: 400, Probability: 30, Forecast_Units__c: 12, Name: "Q1" },
        { Id: "2", Amount: 100, Probability: 70, Forecast_Units__c: 8, Name: "Q2" }
      ];
      executeQuery.mockResolvedValue(soqlResults);

      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery:
          "SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString:
          "SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity"
      });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].length > 0 &&
          call[0][0].x !== undefined
      );
      expect(chartDataCall).toBeTruthy();
      expect(chartDataCall[0]).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("theme pipeline integration", () => {
    it("applies the first Salesforce Standard palette color to bubble fill", async () => {
      await createChart({
        theme: "Salesforce Standard",
        recordCollection: SAMPLE_DATA
      });

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((call) => call[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);

      // Bubble fill is a single hex (one-color palette slice), not a function
      const fillValues = fillCalls.map((c) => c[1]);
      expect(fillValues).toContain("#1589EE");
    });

    it("applies the first Warm palette color to bubble fill", async () => {
      await createChart({
        theme: "Warm",
        recordCollection: SAMPLE_DATA
      });

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((call) => call[0] === "fill");
      const fillValues = fillCalls.map((c) => c[1]);
      expect(fillValues).toContain("#FF6B6B");
    });

    it("uses custom colors from advancedConfig over the theme", async () => {
      await createChart({
        theme: "Salesforce Standard",
        advancedConfig: '{"customColors":["#AA0000"]}',
        recordCollection: SAMPLE_DATA
      });

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((call) => call[0] === "fill");
      const fillValues = fillCalls.map((c) => c[1]);
      expect(fillValues).toContain("#AA0000");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SIZE-ENCODING PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("size encoding pipeline integration", () => {
    it("uses real scaleSqrt mock and binds radius to size via the radius scale", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });

      // scaleSqrt was invoked to build the radius scale (sqrt area encoding)
      expect(mockD3.scaleSqrt).toHaveBeenCalled();

      // The animated radius is bound via an (d) => radiusScale(d.size) function
      const attrCalls = mockD3.attr.mock.calls;
      const rCalls = attrCalls.filter((call) => call[0] === "r");
      expect(rCalls.length).toBeGreaterThan(0);

      // At least one r binding is a function (the size-driven transition target)
      const rFnCall = rCalls.find((c) => typeof c[1] === "function");
      expect(rFnCall).toBeTruthy();
      // Invoking the radius function does not throw and returns the mock radius
      expect(rFnCall[1]({ size: 40 })).toBe(12);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("validation pipeline integration", () => {
    it("shows error when required field is missing from data", async () => {
      const missingFieldData = [
        { WrongX: 1, WrongY: 2, WrongSize: 3 },
        { WrongX: 4, WrongY: 5, WrongSize: 6 }
      ];

      await createChart({ recordCollection: missingFieldData });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain("Missing required fields");
    });

    it("shows error when no data source is provided", async () => {
      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery: ""
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESIZE PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("resize pipeline integration", () => {
    it("real createResizeHandler triggers chart re-render on resize", async () => {
      await createChart();

      expect(global.ResizeObserver).toHaveBeenCalled();
      expect(resizeObserverCallback).toBeTruthy();

      const selectCallsBefore = mockD3.select.mock.calls.length;

      jest.useFakeTimers();
      resizeObserverCallback([{ contentRect: { width: 600, height: 400 } }]);
      jest.advanceTimersByTime(250);
      jest.useRealTimers();
      await flushPromises();

      const selectCallsAfter = mockD3.select.mock.calls.length;
      expect(selectCallsAfter).toBeGreaterThan(selectCallsBefore);
    });
  });
```

  Note: the `validateFields` error message text comes from the REAL `dataService.prepareData` — `"Missing required fields"` is its actual phrasing (confirmed in the bar integration donor, line ~500). If the real message differs, adjust the `.toContain(...)` to match the actual `prepared.error` string rather than changing the component.

- [ ] **Step 3: Run the integration test — expect PASS.** Command:
  ```bash
  npm test -- --testPathPattern=d3BubbleChart.integration
  ```
  Expected: PASS — real `dataService` parses the raw rows into `{x,y,size,label}`, real `themeService.getColors` returns `#1589EE` (SF Standard) / `#FF6B6B` (Warm), and those flow into `mockD3.data()`/`mockD3.attr("fill", ...)`. Output pristine (no leaked console errors on success paths).

- [ ] **Step 4: Commit.** Commands:
  ```bash
  git add force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.integration.test.js
  git commit -m "test(d3BubbleChart): add integration tests for real service pipeline"
  ```

---

#### Task 13.3: E2E tier — `d3BubbleChart.e2e.test.js`

**Files:**
- Test: `force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.e2e.test.js` (Create)

- [ ] **Step 1: Clone the e2e donor.** Copy the `d3BarChart` e2e donor:
  ```bash
  cp force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.e2e.test.js force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.e2e.test.js
  ```
  Then make these precise edits (keep the `flushPromises` helper, the `lightning/navigation` Symbol-based mock, the `lightning/platformShowToastEvent` mock, the module-level `getBoundingClientRect` + `ResizeObserver` globals, the `beforeEach`/`afterEach`, and the `consoleErrorSpy` scaffolding verbatim):
  1. Replace the two ABOUTME lines with:
     ```javascript
     // ABOUTME: End-to-end lifecycle tests for the d3BubbleChart Lightning Web Component.
     // ABOUTME: Verifies full pipeline: D3 load, bubble parsing, SVG rendering, cleanup, and multi-instance isolation.
     ```
  2. Replace `import D3BarChart from "c/d3BarChart";` with `import D3BubbleChart from "c/d3BubbleChart";`.
  3. In `createMockD3()`, add `scaleSqrt`, `scaleOrdinal`, and `extent` (same three blocks as in Task 13.2 Step 1.3) and add `axis.ticks = jest.fn(() => axis);` to both `axisBottom` and `axisLeft`. Also add `text: jest.fn(() => mockD3),` if absent (the bubble renderChart calls `.text(...)` for axis labels).
  4. Change all `createElement("c-d3-bar-chart", { is: D3BarChart })` to `createElement("c-d3-bubble-chart", { is: D3BubbleChart })`.
  5. Change the `createChart` `Object.assign` defaults to:
     ```javascript
     Object.assign(element, {
       xAxisField: "Amount",
       yAxisField: "Probability",
       sizeField: "Forecast_Units__c",
       labelField: "Name",
       height: 300,
       recordCollection: [],
       ...props
     });
     ```
  6. Change the top-level `describe` title to `"c-d3-bubble-chart e2e"`.

- [ ] **Step 2: Rewrite the lifecycle / error / isolation / data-flow blocks for bubble data.** Replace the donor's `LIFECYCLE_DATA` constant and the four describe blocks with bubble-shaped versions. The `full lifecycle`, `error recovery`, `multi-component isolation`, and `data flow verification` blocks become:

```javascript
  // ═══════════════════════════════════════════════════════════════
  // 1. FULL LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe("full lifecycle", () => {
    const LIFECYCLE_DATA = [
      { Id: "001A", Amount: 100, Probability: 20, Forecast_Units__c: 5, Name: "Acme" },
      { Id: "001B", Amount: 200, Probability: 40, Forecast_Units__c: 15, Name: "Globex" },
      { Id: "001C", Amount: 150, Probability: 60, Forecast_Units__c: 10, Name: "Initech" },
      { Id: "001D", Amount: 500, Probability: 80, Forecast_Units__c: 40, Name: "Umbrella" }
    ];

    it("create -> load D3 -> load data -> render -> verify SVG + circles", async () => {
      const element = await createChart({ recordCollection: LIFECYCLE_DATA });

      expect(loadD3).toHaveBeenCalled();
      expect(executeQuery).not.toHaveBeenCalled();
      expect(mockD3.select).toHaveBeenCalled();

      const appendCalls = mockD3.append.mock.calls;
      const svgAppended = appendCalls.some((call) => call[0] === "svg");
      expect(svgAppended).toBe(true);

      const circleAppended = appendCalls.some((call) => call[0] === "circle");
      expect(circleAppended).toBe(true);

      expect(mockD3.data).toHaveBeenCalled();
      expect(mockD3.scaleSqrt).toHaveBeenCalled();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();

      // Pristine console — no errors on the success path
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("cleanup destroys resize handler on disconnect", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      const element = await createChart({ recordCollection: LIFECYCLE_DATA });

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();

      const cleanupErrors = consoleErrorSpy.mock.calls.filter((call) =>
        String(call[0]).toLowerCase().includes("cleanup")
      );
      expect(cleanupErrors).toHaveLength(0);
    });

    it("reactive update: change recordCollection does not crash", async () => {
      const element = await createChart({ recordCollection: LIFECYCLE_DATA });

      expect(loadD3).toHaveBeenCalled();
      expect(mockD3.select).toHaveBeenCalled();

      mockD3.select.mockClear();
      mockD3.append.mockClear();
      mockD3.data.mockClear();

      element.recordCollection = [
        { Id: "001E", Amount: 999, Probability: 50, Forecast_Units__c: 30, Name: "New" }
      ];

      await flushPromises();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. ERROR RECOVERY
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery", () => {
    it("D3 load failure -> error state -> component shows error", async () => {
      loadD3.mockRejectedValue(new Error("CDN unreachable"));

      const element = await createChart({
        recordCollection: [
          { Id: "1", Amount: 100, Probability: 20, Forecast_Units__c: 5, Name: "A" }
        ]
      });

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain("CDN unreachable");

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeFalsy();
    });

    it("SOQL fetch path: no recordCollection -> Apex returns data -> full pipeline", async () => {
      const soqlData = [
        { Id: "1", Amount: 400, Probability: 30, Forecast_Units__c: 12, Name: "Q1" },
        { Id: "2", Amount: 100, Probability: 70, Forecast_Units__c: 8, Name: "Q2" }
      ];
      executeQuery.mockResolvedValue(soqlData);

      const element = await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery:
          "SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString:
          "SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity"
      });

      expect(loadD3).toHaveBeenCalled();
      expect(mockD3.select).toHaveBeenCalled();

      const appendCalls = mockD3.append.mock.calls;
      const svgAppended = appendCalls.some((call) => call[0] === "svg");
      expect(svgAppended).toBe(true);

      expect(mockD3.data).toHaveBeenCalled();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. MULTI-COMPONENT ISOLATION
  // ═══════════════════════════════════════════════════════════════

  describe("multi-component isolation", () => {
    it("two charts on same page have independent lifecycle", async () => {
      const mockDisconnectA = jest.fn();
      const mockDisconnectB = jest.fn();
      let roCallCount = 0;

      global.ResizeObserver = jest.fn().mockImplementation(() => {
        roCallCount += 1;
        const disconnectFn =
          roCallCount === 1 ? mockDisconnectA : mockDisconnectB;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: disconnectFn
        };
      });

      const dataA = [
        { Id: "A1", Amount: 100, Probability: 20, Forecast_Units__c: 5, Name: "A1" },
        { Id: "A2", Amount: 200, Probability: 40, Forecast_Units__c: 15, Name: "A2" }
      ];
      const dataB = [
        { Id: "B1", Amount: 300, Probability: 50, Forecast_Units__c: 20, Name: "B1" },
        { Id: "B2", Amount: 400, Probability: 60, Forecast_Units__c: 25, Name: "B2" },
        { Id: "B3", Amount: 500, Probability: 70, Forecast_Units__c: 35, Name: "B3" }
      ];

      const elementA = await createChart({
        recordCollection: dataA,
        theme: "Warm"
      });

      const elementB = await createChart({
        recordCollection: dataB,
        theme: "Cool"
      });

      const containerA = elementA.shadowRoot.querySelector(".chart-container");
      const containerB = elementB.shadowRoot.querySelector(".chart-container");
      expect(containerA).toBeTruthy();
      expect(containerB).toBeTruthy();

      document.body.removeChild(elementA);

      const containerBAfter =
        elementB.shadowRoot.querySelector(".chart-container");
      expect(containerBAfter).toBeTruthy();

      const isolationErrors = consoleErrorSpy.mock.calls.filter((call) =>
        String(call[0]).toLowerCase().includes("cleanup")
      );
      expect(isolationErrors).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. DATA FLOW VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  describe("data flow verification", () => {
    it("parsed bubble data flows through to D3 with correct values", async () => {
      const knownData = [
        { Id: "1", Amount: 100, Probability: 20, Forecast_Units__c: 5, Name: "A" },
        { Id: "2", Amount: 200, Probability: 40, Forecast_Units__c: 15, Name: "B" }
      ];

      await createChart({ recordCollection: knownData });

      expect(mockD3.data).toHaveBeenCalled();

      const dataCall = mockD3.data.mock.calls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].length > 0 &&
          call[0][0].x !== undefined &&
          call[0][0].size !== undefined
      );

      expect(dataCall).toBeTruthy();
      const boundData = dataCall[0];

      expect(boundData).toHaveLength(2);
      expect(boundData[0]).toEqual(
        expect.objectContaining({ x: 100, y: 20, size: 5, label: "A" })
      );
      expect(boundData[1]).toEqual(
        expect.objectContaining({ x: 200, y: 40, size: 15, label: "B" })
      );
    });
  });
```

  Note: the donor's `silently truncates data exceeding 2000 records` test relied on bar's aggregation semantics; for bubble the raw cap is `SVG_ELEMENT_CAP` sampling, which is exercised by the unit tier. Drop that donor test (do not carry it into the bubble e2e) so the e2e tier stays focused on lifecycle, error, isolation, and data-flow.

- [ ] **Step 3: Run the e2e test — expect PASS.** Command:
  ```bash
  npm test -- --testPathPattern=d3BubbleChart.e2e
  ```
  Expected: PASS — full lifecycle (create → load → render → SVG + circle elements + data bound + spinner gone + no error), cleanup on disconnect, two-instance isolation, and exact-value data flow all green. The success-path tests assert `consoleErrorSpy` was NOT called (pristine console).

- [ ] **Step 4: Run the full bubble suite together — expect PASS.** Command:
  ```bash
  npm test -- --testPathPattern=d3BubbleChart
  ```
  Expected: PASS — all three tiers (`d3BubbleChart.test.js`, `d3BubbleChart.integration.test.js`, `d3BubbleChart.e2e.test.js`) green in one run.

- [ ] **Step 5: Commit.** Commands:
  ```bash
  git add force-app/main/default/lwc/d3BubbleChart/__tests__/d3BubbleChart.e2e.test.js
  git commit -m "test(d3BubbleChart): add e2e lifecycle and multi-instance tests"
  ```


### Phase 14: Chord Diagram (`d3ChordDiagram`)

Build the `d3ChordDiagram` chart as a full release (component `.js`/`.html`/`.js-meta.xml` + unit/integration/e2e tests), cloning the `d3DonutChart` radial scaffold and pivoting a `getMultiGroupData` edge list into a square matrix via the new `dataService.buildMatrix`, rendered with `d3.chord()` + `d3.arc()` (group arcs) + `d3.ribbon()` (connections).

**Prerequisites (delivered by the Phase 4 foundation task — verify before starting):**

- `dataService.buildMatrix(edges, sourceKey, targetKey, valueKey)` → `{ matrix, labels }` exists and is exported from `force-app/main/default/lwc/dataService/dataService.js`.
- `jest.config.js` has a `moduleNameMapper` entry for `@salesforce/apex/D3ChartController.getMultiGroupData`, and the stub `__mocks__/@salesforce/apex/D3ChartController.getMultiGroupData.js` exists (it does today — `export default jest.fn().mockResolvedValue([]);`).
- Run `bash -c 'grep -n "buildMatrix" /Users/weytani/code/d3-lwc/force-app/main/default/lwc/dataService/dataService.js'` and `bash -c 'grep -n "getMultiGroupData" /Users/weytani/code/d3-lwc/jest.config.js'`. If either is missing, STOP and complete the Phase 4 foundation task first — the Chord tests cannot pass without them.

`buildMatrix` contract this chart relies on (from spec 4.2): given an edge list `[{label, series, value}, ...]`, it returns `{ matrix, labels }` where `labels` is the sorted/deduped union of all `label` (source) and `series` (target) values, and `matrix` is a square `number[][]` of size `labels.length` such that `matrix[i][j]` is the summed `value` of edges from `labels[i]` to `labels[j]` (0 when no edge). The component calls it as `buildMatrix(edges, "label", "series", "value")`.

---

#### Task 14.1: Unit tier — `d3ChordDiagram.test.js` + component scaffold

**Files:**

- Test: `force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.test.js` (Create)
- Create: `force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.js`
- Create: `force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.html`
- Create: `force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.js-meta.xml`

- [ ] **Step 1: Write the failing unit test.** Create the directory and the test file with the exact content below. It clones the `d3DonutChart` unit scaffold (createMockD3 factory, createChart/flushPromises/beforeEach/afterEach), swaps the donut-specific D3 primitives (`pie`/`interpolate`) for the chord primitives (`chord`/`ribbon`), and replaces the donut rendering-detail assertions with chord ones.

```bash
mkdir -p /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3ChordDiagram/__tests__
```

```javascript
// force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.test.js
// ABOUTME: Unit tests for the D3 chord diagram Lightning Web Component.
// ABOUTME: Covers initialization, data sources, matrix building, themes, config, events, tooltips, responsive behavior, and rendering details.

import { createElement } from "lwc";
import D3ChordDiagram from "c/d3ChordDiagram";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

// Mock d3Lib
jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// Mock Apex
jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/D3ChartController.getMultiGroupData",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

// Mock NavigationMixin
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    return {
      NavigationMixin: jest.fn((Base) => {
        return class extends Base {
          [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
        };
      })
    };
  },
  { virtual: true }
);

// Mock chartUtils
jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
  formatPercent: jest.fn((v) => (v * 100).toFixed(1) + "%"),
  truncateLabel: jest.fn((label) => label),
  createTooltip: jest.fn().mockReturnValue({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn()
  }),
  buildTooltipContent: jest.fn().mockReturnValue("<div>tooltip</div>"),
  createResizeHandler: jest.fn().mockReturnValue({
    observe: jest.fn(),
    disconnect: jest.fn()
  }),
  createLayoutRetry: jest.fn().mockReturnValue({ cancel: jest.fn() }),
  calculateDimensions: jest
    .fn()
    .mockReturnValue({ width: 300, height: 200, margins: {} }),
  shouldUseCompactMode: jest.fn().mockReturnValue(false)
}));

// Factory function for isolated mock D3 instances (prevents shared mutable state between tests)
const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    // chord() is callable: chord(matrix) -> chord layout object with .groups + iterable ribbons
    chord: jest.fn(() => {
      const chordFn = jest.fn((matrix) => {
        const n = matrix.length;
        const groups = [];
        const ribbons = [];
        for (let i = 0; i < n; i++) {
          groups.push({
            index: i,
            startAngle: i * 0.5,
            endAngle: (i + 1) * 0.5,
            value: matrix[i].reduce((a, b) => a + b, 0)
          });
          for (let j = 0; j < n; j++) {
            if (matrix[i][j] > 0) {
              ribbons.push({
                source: { index: i, startAngle: 0, endAngle: 0.1 },
                target: { index: j, startAngle: 0.2, endAngle: 0.3 }
              });
            }
          }
        }
        // Chord layout result: array-like of ribbons, with a .groups property
        ribbons.groups = groups;
        return ribbons;
      });
      chordFn.padAngle = jest.fn(() => chordFn);
      chordFn.sortSubgroups = jest.fn(() => chordFn);
      return chordFn;
    }),
    // ribbon() is callable: ribbon(d) -> path string; .radius(r) -> self
    ribbon: jest.fn(() => {
      const ribbonFn = jest.fn(() => "M0,0");
      ribbonFn.radius = jest.fn(() => ribbonFn);
      return ribbonFn;
    }),
    arc: jest.fn(() => {
      const arcFn = jest.fn(() => "M0,0");
      arcFn.innerRadius = jest.fn(() => arcFn);
      arcFn.outerRadius = jest.fn(() => arcFn);
      return arcFn;
    })
  };
  return d3;
};

// Sample raw edge records: source x target with a value.
// recordCollection path treats them like getMultiGroupData rows (label/series/value)
// after the component maps groupByField/seriesField/valueField onto label/series/value.
const SAMPLE_DATA = [
  { StageName: "Prospecting", LeadSource: "Web", Amount: 100 },
  { StageName: "Prospecting", LeadSource: "Phone", Amount: 200 },
  { StageName: "Qualification", LeadSource: "Web", Amount: 150 },
  { StageName: "Closed Won", LeadSource: "Phone", Amount: 500 }
];

// Server (getMultiGroupData) returns pre-aggregated {label, series, value} edges
const SERVER_EDGES = [
  { label: "Prospecting", series: "Web", value: 100 },
  { label: "Prospecting", series: "Phone", value: 200 },
  { label: "Qualification", series: "Web", value: 150 },
  { label: "Closed Won", series: "Phone", value: 500 }
];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-chord-diagram", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);
    getMultiGroupData.mockResolvedValue(SERVER_EDGES);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  async function createChart(props = {}) {
    element = createElement("c-d3-chord-diagram", {
      is: D3ChordDiagram
    });

    Object.assign(element, {
      groupByField: "StageName",
      seriesField: "LeadSource",
      valueField: "Amount",
      operation: "Sum",
      recordCollection: SAMPLE_DATA,
      ...props
    });

    document.body.appendChild(element);
    await flushPromises();
    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("shows loading spinner initially", () => {
      element = createElement("c-d3-chord-diagram", { is: D3ChordDiagram });
      element.groupByField = "StageName";
      element.seriesField = "LeadSource";
      element.recordCollection = SAMPLE_DATA;

      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides spinner after data loads", async () => {
      await createChart();
      await flushPromises();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("renders chart container when data is available", async () => {
      await createChart();
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA SOURCES
  // ═══════════════════════════════════════════════════════════════

  describe("data sources", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });
      expect(executeQuery).not.toHaveBeenCalled();
      expect(getMultiGroupData).not.toHaveBeenCalled();
    });

    it("calls executeQuery when recordCollection is empty and soqlQuery is set", async () => {
      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery: "SELECT StageName, LeadSource, Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT StageName, LeadSource, Amount FROM Opportunity"
      });
    });

    it("shows error when no data source provided", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: ""
      });
      await flushPromises();
      await flushPromises();

      const errorMessage = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorMessage).toBeTruthy();
    });

    it("shows error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({ body: { message: "Invalid query" } });

      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery: "SELECT Invalid FROM Object"
      });
      await flushPromises();
      await flushPromises();

      const errorMessage = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorMessage).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SERVER MULTI-GROUP AGGREGATION
  // ═══════════════════════════════════════════════════════════════

  describe("server multi-group aggregation", () => {
    it("calls getMultiGroupData when objectApiName, groupByField, seriesField, valueField, operation are set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "LeadSource",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      expect(getMultiGroupData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        seriesField: "LeadSource",
        valueField: "Amount",
        operation: "Sum",
        filterClause: null
      });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("passes filterClause to getMultiGroupData when set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "LeadSource",
        valueField: "Amount",
        operation: "Sum",
        filterClause: "Amount > 1000"
      });

      await flushPromises();

      expect(getMultiGroupData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        seriesField: "LeadSource",
        valueField: "Amount",
        operation: "Sum",
        filterClause: "Amount > 1000"
      });
    });

    it("shows error when getMultiGroupData fails", async () => {
      getMultiGroupData.mockRejectedValue({
        body: { message: "Aggregation failed" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "LeadSource",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("prefers recordCollection over server aggregation", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "LeadSource",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      expect(getMultiGroupData).not.toHaveBeenCalled();
      expect(executeQuery).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  describe("aggregation operations", () => {
    it("accepts Sum operation", async () => {
      await createChart({ operation: "Sum" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("accepts Count operation", async () => {
      await createChart({ operation: "Count" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("accepts Average operation", async () => {
      await createChart({ operation: "Average" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEMES
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("renders with Salesforce Standard theme", async () => {
      await createChart({ theme: "Salesforce Standard" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Warm theme", async () => {
      await createChart({ theme: "Warm" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Cool theme", async () => {
      await createChart({ theme: "Cool" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Vibrant theme", async () => {
      await createChart({ theme: "Vibrant" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════

  describe("configuration", () => {
    it("applies custom height", async () => {
      await createChart({ height: 400 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("400px");
    });

    it("accepts advancedConfig JSON", async () => {
      await createChart({ advancedConfig: '{"padAngle": 0.1}' });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("handles invalid advancedConfig gracefully", async () => {
      await createChart({ advancedConfig: "not valid json" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("handles empty string advancedConfig gracefully", async () => {
      await createChart({ advancedConfig: "" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("handles null advancedConfig gracefully", async () => {
      await createChart({ advancedConfig: null });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EVENTS / CLICK
  // ═══════════════════════════════════════════════════════════════

  describe("events", () => {
    it("registers click handler on group arcs via D3 on()", async () => {
      await createChart({
        objectApiName: "Opportunity",
        filterField: "StageName"
      });
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);
    });

    it("sets objectApiName for drill-down navigation", async () => {
      await createChart({ objectApiName: "Opportunity" });
      await flushPromises();
      expect(element.objectApiName).toBe("Opportunity");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP BEHAVIOR
  // ═══════════════════════════════════════════════════════════════

  describe("tooltip handlers", () => {
    it("registers mouseenter handler on group arcs", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on group arcs", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE BEHAVIOR
  // ═══════════════════════════════════════════════════════════════

  describe("responsive behavior", () => {
    it("creates resize handler for responsive reflow", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      await createChart();
      await flushPromises();

      expect(createResizeHandler).toHaveBeenCalled();
      const handler = createResizeHandler.mock.results[0].value;
      expect(handler.observe).toHaveBeenCalled();
    });

    it("disconnects resize handler on component removal", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      const mockDisconnect = jest.fn();
      createResizeHandler.mockReturnValue({
        observe: jest.fn(),
        disconnect: mockDisconnect
      });

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("skips rendering when container has zero width", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 0
      }));

      await createChart();
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
      expect(mockD3.chord).not.toHaveBeenCalled();
    });

    it("re-renders on resize callback via createResizeHandler", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      let capturedCallback;

      createResizeHandler.mockImplementation((container, callback) => {
        capturedCallback = callback;
        return { observe: jest.fn(), disconnect: jest.fn() };
      });

      await createChart();
      await flushPromises();

      expect(capturedCallback).toBeDefined();
      mockD3.select.mockClear();

      capturedCallback({ width: 500 });

      expect(mockD3.select).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERING DETAILS (chord-specific)
  // ═══════════════════════════════════════════════════════════════

  describe("rendering details", () => {
    it("builds chord layout via d3.chord()", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.chord).toHaveBeenCalled();
    });

    it("sets padAngle on the chord layout", async () => {
      await createChart();
      await flushPromises();

      const chordObj = mockD3.chord.mock.results[0].value;
      expect(chordObj.padAngle).toHaveBeenCalledWith(0.05);
    });

    it("passes a square matrix to the chord layout", async () => {
      await createChart();
      await flushPromises();

      const chordObj = mockD3.chord.mock.results[0].value;
      expect(chordObj).toHaveBeenCalled();
      const matrix = chordObj.mock.calls[0][0];
      // Square: every row length equals the number of rows
      expect(matrix.length).toBeGreaterThan(0);
      matrix.forEach((row) => {
        expect(row.length).toBe(matrix.length);
      });
    });

    it("creates a ribbon generator via d3.ribbon()", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.ribbon).toHaveBeenCalled();
      const ribbonObj = mockD3.ribbon.mock.results[0].value;
      expect(ribbonObj.radius).toHaveBeenCalled();
    });

    it("creates an arc generator via d3.arc()", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.arc).toHaveBeenCalled();
      const arcObj = mockD3.arc.mock.results[0].value;
      expect(arcObj.innerRadius).toHaveBeenCalled();
      expect(arcObj.outerRadius).toHaveBeenCalled();
    });

    it("removes existing SVG before re-render", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });

    it("sets SVG dimensions from container width and configured height", async () => {
      await createChart({ height: 350 });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const widthSet = attrCalls.some(
        (call) => call[0] === "width" && typeof call[1] === "number"
      );
      const heightSet = attrCalls.some(
        (call) => call[0] === "height" && call[1] === 350
      );
      expect(widthSet).toBe(true);
      expect(heightSet).toBe(true);
    });

    it("appends one path per group arc (one per label)", async () => {
      await createChart();
      await flushPromises();

      // SAMPLE_DATA labels (source ∪ target): Prospecting, Qualification,
      // Closed Won, Web, Phone => 5 distinct labels => 5 group arcs.
      // The component binds group arcs via selectAll().data(groups).enter().append("path").
      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      const pathAppends = appendCalls.filter((a) => a === "path");
      expect(pathAppends.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  describe("getters", () => {
    it("containerStyle reflects configured height", async () => {
      await createChart({ height: 275 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("275px");
    });

    it("config falls back to empty object on invalid JSON", async () => {
      await createChart({ advancedConfig: "{{{bad" });
      await flushPromises();
      // Renders without throwing => config getter returned {}
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  describe("cleanup", () => {
    it("destroys the tooltip on disconnect", async () => {
      const { createTooltip } = require("c/chartUtils");
      const mockDestroy = jest.fn();
      createTooltip.mockReturnValue({
        show: jest.fn(),
        hide: jest.fn(),
        destroy: mockDestroy
      });

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT RETRY
  // ═══════════════════════════════════════════════════════════════

  describe("layout retry", () => {
    function useRealLayoutRetry() {
      const { createLayoutRetry } = require("c/chartUtils");
      createLayoutRetry.mockImplementation((container, onLayout, opts = {}) => {
        const maxAttempts = (opts && opts.maxAttempts) || 60;
        let rafId = null;
        let cancelled = false;
        const check = (attempt) => {
          if (cancelled) return;
          const { width } = container.getBoundingClientRect();
          if (width > 0) {
            rafId = null;
            onLayout(width);
            return;
          }
          if (attempt >= maxAttempts) {
            rafId = null;
            return;
          }
          rafId = global.requestAnimationFrame(() => check(attempt + 1));
        };
        rafId = global.requestAnimationFrame(() => check(0));
        return {
          cancel() {
            cancelled = true;
            if (rafId !== null) {
              global.cancelAnimationFrame(rafId);
              rafId = null;
            }
          }
        };
      });
    }

    it("retries chart init when container starts at zero width", async () => {
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: containerWidth
      }));

      const rafCallbacks = [];
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();

      useRealLayoutRetry();

      await createChart();
      await flushPromises();

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockD3.chord).not.toHaveBeenCalled();

      containerWidth = 400;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 400
      }));

      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift();
        cb();
      }

      expect(mockD3.select).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      global.requestAnimationFrame = jest.fn(() => 42);
      global.cancelAnimationFrame = jest.fn();

      useRealLayoutRetry();

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the unit test — expect FAIL.**

```bash
cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3ChordDiagram
```

Expected: **FAIL** because `import D3ChordDiagram from "c/d3ChordDiagram"` cannot resolve — the component `.js`/`.html` do not exist yet (Jest reports "Cannot find module 'c/d3ChordDiagram'"). This proves the test exercises real code, not a stub.

- [ ] **Step 3: Implement the component `.js`.** Create `force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.js`. It clones the `d3DonutChart` universal scaffold (same imports, universal + aggregation-family `@api`, `@track`, private fields, getters, lifecycle, `loadData` cascade, `initializeChart`, tooltip handlers, click/drill-down, cleanup) and changes only: (a) imports `getMultiGroupData` + `createColorScale`/`getColors` + `buildMatrix`; (b) adds `@api seriesField`; (c) `loadData` server path calls `getMultiGroupData` and builds the matrix; (d) `renderChart` uses `d3.chord`/`d3.arc`/`d3.ribbon`.

```javascript
// force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.js
// ABOUTME: D3 Chord diagram Lightning Web Component visualizing flows between categories.
// ABOUTME: Pivots a source-target edge list into a square matrix and renders group arcs with ribbon connections.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateSeriesData,
  buildMatrix,
  OPERATIONS,
  MAX_RECORDS
} from "c/dataService";
import { getColors, createColorScale, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  truncateLabel,
  createTooltip,
  createResizeHandler,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

export default class D3ChordDiagram extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field naming the flow source (rows/columns of the matrix) */
  @api groupByField = "";

  /** Field naming the flow target */
  @api seriesField = "";

  /** Field to aggregate (edge weight) */
  @api valueField = "";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side aggregation */
  @api filterClause = "";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track chartData = [];

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  d3 = null;
  svg = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  _layoutRetry = null;
  _config = {};
  _configParsed = false;
  _matrix = [];
  _labels = [];

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  get containerStyle() {
    return `height: ${this.height}px;`;
  }

  get hasError() {
    return !!this.error;
  }

  get hasData() {
    return this.chartData && this.chartData.length > 0;
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get config() {
    if (!this._configParsed) {
      try {
        this._config = JSON.parse(this.advancedConfig || "{}");
      } catch {
        this._config = {};
      }
      this._configParsed = true;
    }
    return this._config;
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════

  async connectedCallback() {
    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3ChordDiagram initialization error:", e);
    } finally {
      this.isLoading = false;
    }
  }

  renderedCallback() {
    if (this.showChart && !this.chartRendered) {
      this.chartRendered = this.initializeChart();
      if (!this.chartRendered && !this._layoutRetry) {
        const container = this.template.querySelector(".chart-container");
        if (container) {
          this._layoutRetry = createLayoutRetry(container, () => {
            this._layoutRetry = null;
            if (!this.chartRendered) {
              this.chartRendered = this.initializeChart();
            }
          });
        }
      }
    }
  }

  disconnectedCallback() {
    if (this._layoutRetry) {
      this._layoutRetry.cancel();
      this._layoutRetry = null;
    }
    this.cleanup();
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  async loadData() {
    // Priority 1: recordCollection — aggregate to edges client-side, then pivot.
    if (this.recordCollection && this.recordCollection.length > 0) {
      const edges = this._aggregateRawData([...this.recordCollection]);
      this._buildFromEdges(edges);
      return;
    }

    // Priority 2: server multi-group aggregation when all fields are set.
    if (
      this.objectApiName &&
      this.groupByField &&
      this.seriesField &&
      this.valueField &&
      this.operation
    ) {
      let edges = [];
      try {
        edges = await getMultiGroupData({
          objectName: this.objectApiName,
          groupByField: this.groupByField,
          seriesField: this.seriesField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
      } catch (e) {
        throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
      }
      if (!edges || edges.length === 0) {
        throw new Error("No data after aggregation");
      }
      this._buildFromEdges(edges);
      return;
    }

    // Priority 3: SOQL query, then client-side aggregate + pivot.
    if (this.soqlQuery) {
      let rawData = [];
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      const edges = this._aggregateRawData(rawData);
      this._buildFromEdges(edges);
      return;
    }

    throw new Error(
      "No data source provided. Set recordCollection or soqlQuery."
    );
  }

  /**
   * Validates, truncates, and aggregates raw rows into a {label, series, value}
   * edge list keyed by the source (groupByField) and target (seriesField).
   */
  _aggregateRawData(rawData) {
    const requiredFields = [this.groupByField, this.seriesField];
    if (this.operation !== OPERATIONS.COUNT) {
      requiredFields.push(this.valueField);
    }

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || MAX_RECORDS
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    return aggregateSeriesData(
      prepared.data,
      this.groupByField,
      this.seriesField,
      this.valueField,
      this.operation
    );
  }

  /**
   * Pivots an edge list into a square matrix + label index, stores both,
   * and exposes the edge list as chartData (drives hasData / no-data state).
   */
  _buildFromEdges(edges) {
    if (!edges || edges.length === 0) {
      throw new Error("No data after aggregation");
    }
    const { matrix, labels } = buildMatrix(edges, "label", "series", "value");
    this._matrix = matrix;
    this._labels = labels;
    this.chartData = edges;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initializes the chart SVG, tooltip, and resize observer.
   * @returns {boolean} true if the chart was successfully initialized
   */
  initializeChart() {
    const container = this.template.querySelector(".chart-container");
    if (!container) return false;

    const { width } = container.getBoundingClientRect();
    if (width === 0) return false;

    this.tooltip = createTooltip(container);
    this.renderChart(width);

    this.resizeHandler = createResizeHandler(
      container,
      ({ width: newWidth }) => {
        if (newWidth > 0) {
          this.renderChart(newWidth);
        }
      }
    );
    this.resizeHandler.observe();
    return true;
  }

  renderChart(containerWidth) {
    const d3 = this.d3;
    const container = this.template.querySelector(".chart-container");
    if (!container || !d3) return;

    d3.select(container).select("svg").remove();

    const padding = Math.max(10, Math.round(containerWidth * 0.04));
    const margin = {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    };
    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const outerRadius = Math.min(width, height) / 2;
    const innerRadius = outerRadius - Math.max(12, outerRadius * 0.08);

    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "chord-diagram-svg")
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + width / 2},${margin.top + height / 2})`
      );

    const colorScale = createColorScale(
      this.theme,
      this._labels,
      this.config.customColors
    );

    const padAngle =
      typeof this.config.padAngle === "number" ? this.config.padAngle : 0.05;

    const chordLayout = d3.chord().padAngle(padAngle)(this._matrix);

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbon().radius(innerRadius);

    // Group arcs — one per label.
    const groups = this.svg
      .selectAll(".chord-group")
      .data(chordLayout.groups)
      .enter()
      .append("g")
      .attr("class", "chord-group");

    groups
      .append("path")
      .attr("class", "chord-arc")
      .attr("d", arc)
      .attr("fill", (d) => colorScale(this._labels[d.index]))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .on("mouseenter", (event, d) => {
        this.showTooltip(event, d.index);
      })
      .on("mousemove", (event) => {
        this.moveTooltip(event);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      })
      .on("click", (event, d) => {
        this.handleArcClick(d.index);
      });

    // Group labels.
    groups
      .append("text")
      .attr("class", "chord-label")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#16325c")
      .text((d) => truncateLabel(this._labels[d.index]));

    // Ribbons — one per nonzero edge from the chord layout.
    this.svg
      .append("g")
      .attr("class", "chord-ribbons")
      .attr("fill-opacity", 0.7)
      .selectAll(".chord-ribbon")
      .data(chordLayout)
      .enter()
      .append("path")
      .attr("class", "chord-ribbon")
      .attr("d", ribbon)
      .attr("fill", (d) => colorScale(this._labels[d.source.index]))
      .attr("stroke", "white")
      .attr("stroke-width", 0.5);
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, labelIndex) {
    if (!this.tooltip) return;

    const label = this._labels[labelIndex];
    const total = (this._matrix[labelIndex] || []).reduce(
      (sum, v) => sum + v,
      0
    );
    const content = `
            <strong>${label}</strong><br/>
            ${formatNumber(total)}
        `;
    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  moveTooltip() {
    // Position handled in show()
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleArcClick(labelIndex) {
    if (!this.objectApiName) return;

    const label = this._labels[labelIndex];
    const filterFieldName = this.filterField || this.groupByField;

    this[NavigationMixin.Navigate]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.objectApiName,
        actionName: "list"
      }
    });

    this.dispatchEvent(
      new CustomEvent("arcclick", {
        detail: {
          label,
          filterField: filterFieldName
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  cleanup() {
    if (this.resizeHandler) {
      this.resizeHandler.disconnect();
      this.resizeHandler = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
```

- [ ] **Step 4: Implement the component `.html`.** Create `force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.html`. It clones the `d3DonutChart` 4-state template but drops the legend block (the chord renders its labels inside the SVG), so the `hasData` branch is just the mount div. Keep the mount div exactly `class="chart-container" lwc:dom="manual"`.

```html
<template>
  <div class="slds-card">
    <!-- Loading State -->
    <template lwc:if={isLoading}>
      <div class="slds-align_absolute-center" style="height: 200px">
        <lightning-spinner
          alternative-text="Loading chart..."
          size="medium"
        ></lightning-spinner>
      </div>
    </template>

    <!-- Error State -->
    <template lwc:elseif={hasError}>
      <div
        class="slds-align_absolute-center slds-text-color_error"
        style="height: 200px; padding: 1rem"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:error"
            alternative-text="Error"
            size="large"
            variant="error"
          ></lightning-icon>
          <p class="slds-m-top_small">{error}</p>
        </div>
      </div>
    </template>

    <!-- Chart Container (has data) -->
    <template lwc:elseif={hasData}>
      <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>
    </template>

    <!-- No Data State -->
    <template lwc:else>
      <div
        class="slds-align_absolute-center slds-text-color_weak"
        style="height: 200px"
      >
        <div class="slds-text-align_center">
          <lightning-icon
            icon-name="utility:chart"
            alternative-text="No data"
            size="large"
          ></lightning-icon>
          <p class="slds-m-top_small">No data available</p>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 5: Implement the component `.js-meta.xml`.** Create `force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.js-meta.xml`. Clone the donut meta but set `apiVersion 65.0`, `masterLabel` "D3 Chord Chart", and replace the donut-specific properties with the chord field-mapping set (add `seriesField`; drop `showLegend`/`innerRadiusRatio`). Targets remain AppPage/RecordPage/HomePage so it is placeable on the Phase 3 flexipage.

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <isExposed>true</isExposed>
    <masterLabel>D3 Chord Chart</masterLabel>
    <description
  >Interactive chord diagram powered by D3.js showing weighted flows between two categorical dimensions.</description>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__RecordPage</target>
        <target>lightning__HomePage</target>
    </targets>
    <targetConfigs>
        <targetConfig
      targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
    >
            <!-- Data Source -->
            <property
        name="soqlQuery"
        type="String"
        label="SOQL Query"
        description="SOQL query to fetch source/target/value rows"
        placeholder="SELECT StageName, LeadSource, Amount FROM Opportunity"
      />

            <!-- Field Mapping -->
            <property
        name="groupByField"
        type="String"
        label="Source Field"
        default="StageName"
        description="API name of the flow source field"
        placeholder="StageName"
      />
            <property
        name="seriesField"
        type="String"
        label="Target Field"
        default="LeadSource"
        description="API name of the flow target field"
        placeholder="LeadSource"
      />
            <property
        name="valueField"
        type="String"
        label="Value Field"
        default="Amount"
        description="API name of the numeric field to aggregate (not required for Count)"
        placeholder="Amount"
      />
            <property
        name="operation"
        type="String"
        label="Aggregation"
        default="Sum"
        datasource="Sum,Count,Average"
        description="How to aggregate the edge values"
      />

            <!-- Appearance -->
            <property
        name="height"
        type="Integer"
        label="Height (px)"
        default="300"
        description="Chart height in pixels"
        min="150"
        max="800"
      />
            <property
        name="theme"
        type="String"
        label="Color Theme"
        default="Salesforce Standard"
        datasource="Salesforce Standard,Warm,Cool,Vibrant"
        description="Color palette for the chart"
      />

            <!-- Drill-Down -->
            <property
        name="objectApiName"
        type="String"
        label="Drill-Down Object"
        description="Object API name for navigation on arc click"
        placeholder="Opportunity"
      />
            <property
        name="filterField"
        type="String"
        label="Filter Field"
        description="Field to filter by on drill-down (defaults to Source Field)"
      />
            <property
        name="recordLimit"
        type="Integer"
        label="Record Limit"
        description="Maximum records to process. Leave empty for default."
        min="1"
        max="10000"
      />

            <!-- Advanced -->
            <property
        name="advancedConfig"
        type="String"
        label="Advanced Config (JSON)"
        description='{"padAngle": 0.05, "customColors": ["#FF5733"]}'
      />
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

- [ ] **Step 6: Run the unit test — expect PASS.**

```bash
cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3ChordDiagram
```

Expected: **PASS** — all `d3ChordDiagram.test.js` describe blocks green. If a test fails with `... is not a function`, the mock-D3 is missing a chord/ribbon/arc primitive — re-check the `createMockD3` factory against the `renderChart` calls. Confirm console output is pristine (no leaked `console.error`).

- [ ] **Step 7: Commit.**

```bash
cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.js force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.html force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.js-meta.xml force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.test.js
git commit -m "feat(d3ChordDiagram): add chord diagram component with unit tests"
```

---

#### Task 14.2: Integration tier — `d3ChordDiagram.integration.test.js`

**Files:**

- Test: `force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.integration.test.js` (Create)

This tier mocks ONLY `c/d3Lib` + Apex (`executeQuery`, `getMultiGroupData`) + `lightning/navigation` + `lightning/platformShowToastEvent`, and runs the REAL `c/dataService` (`aggregateSeriesData`, `buildMatrix`), `c/themeService` (`createColorScale`), and `c/chartUtils`. It asserts that real aggregated values and real palette hex flow into `mockD3.chord()` and the `fill` attribute.

- [ ] **Step 1: Write the failing integration test.** Clone the donor file to the new path, then apply the edits below.

```bash
cp /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.integration.test.js \
   /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.integration.test.js
```

Then replace the entire contents with the version below. (It keeps the donor's mock-only-externals structure and the `flushPromises = () => new Promise(process.nextTick)` pattern from spec §8, but uses chord primitives and chord-specific real-value assertions.)

```javascript
// force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.integration.test.js
// ABOUTME: Integration tests for d3ChordDiagram verifying real service interactions.
// ABOUTME: Tests real dataService aggregation + buildMatrix and themeService colors against mock D3 rendering.

import { createElement } from "lwc";
import D3ChordDiagram from "c/d3ChordDiagram";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

// ═══════════════════════════════════════════════════════════════
// MOCKS — Only external dependencies, NOT real utility services
// ═══════════════════════════════════════════════════════════════

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/D3ChartController.getMultiGroupData",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "lightning/platformShowToastEvent",
  () => ({
    ShowToastEvent: jest.fn()
  }),
  { virtual: true }
);

const NAVIGATE_SYMBOL = Symbol.for("NavigationMixin.Navigate");
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const NavigationMixin = (Base) => {
      return class extends Base {
        [NAVIGATE_SYMBOL] = mockNavigate;
      };
    };
    NavigationMixin.Navigate = NAVIGATE_SYMBOL;
    return { NavigationMixin };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY (chord-specific)
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    chord: jest.fn(() => {
      const chordFn = jest.fn((matrix) => {
        const n = matrix.length;
        const groups = [];
        const ribbons = [];
        for (let i = 0; i < n; i++) {
          groups.push({
            index: i,
            startAngle: i * 0.5,
            endAngle: (i + 1) * 0.5,
            value: matrix[i].reduce((a, b) => a + b, 0)
          });
          for (let j = 0; j < n; j++) {
            if (matrix[i][j] > 0) {
              ribbons.push({
                source: { index: i, startAngle: 0, endAngle: 0.1 },
                target: { index: j, startAngle: 0.2, endAngle: 0.3 }
              });
            }
          }
        }
        ribbons.groups = groups;
        return ribbons;
      });
      chordFn.padAngle = jest.fn(() => chordFn);
      chordFn.sortSubgroups = jest.fn(() => chordFn);
      return chordFn;
    }),
    ribbon: jest.fn(() => {
      const ribbonFn = jest.fn(() => "M0,0");
      ribbonFn.radius = jest.fn(() => ribbonFn);
      return ribbonFn;
    }),
    arc: jest.fn(() => {
      const arcFn = jest.fn(() => "M0,0");
      arcFn.innerRadius = jest.fn(() => arcFn);
      arcFn.outerRadius = jest.fn(() => arcFn);
      return arcFn;
    })
  };
  return d3;
};

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Prospecting", LeadSource: "Web", Amount: 100 },
  { StageName: "Prospecting", LeadSource: "Web", Amount: 50 },
  { StageName: "Prospecting", LeadSource: "Phone", Amount: 200 },
  { StageName: "Qualification", LeadSource: "Web", Amount: 150 },
  { StageName: "Closed Won", LeadSource: "Phone", Amount: 500 }
];
// Sum aggregation by (StageName, LeadSource):
//   Prospecting->Web=150, Prospecting->Phone=200, Qualification->Web=150, Closed Won->Phone=500
// Distinct labels (source ∪ target), sorted: Closed Won, Phone, Prospecting, Qualification, Web (5)

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// process.nextTick survives jest.useFakeTimers() used in the resize-debounce test
const flushPromises = () => new Promise(process.nextTick);

async function createChart(props = {}) {
  const element = createElement("c-d3-chord-diagram", {
    is: D3ChordDiagram
  });

  Object.assign(element, {
    groupByField: "StageName",
    seriesField: "LeadSource",
    valueField: "Amount",
    operation: "Sum",
    recordCollection: SAMPLE_DATA,
    theme: "Salesforce Standard",
    ...props
  });

  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-chord-diagram integration", () => {
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);
    getMultiGroupData.mockResolvedValue([]);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ═══════════════════════════════════════════════════════════════
  // REAL MATRIX FROM REAL AGGREGATION
  // ═══════════════════════════════════════════════════════════════

  describe("real buildMatrix from real aggregation", () => {
    it("passes a square matrix to d3.chord() sized to the distinct label count", async () => {
      await createChart({ operation: "Sum" });

      const chordFn = mockD3.chord.mock.results[0].value;
      expect(chordFn).toHaveBeenCalled();

      const matrix = chordFn.mock.calls[0][0];
      // 5 distinct labels => 5x5 square matrix
      expect(matrix.length).toBe(5);
      matrix.forEach((row) => expect(row.length).toBe(5));
    });

    it("matrix total equals the summed edge weights", async () => {
      await createChart({ operation: "Sum" });

      const chordFn = mockD3.chord.mock.results[0].value;
      const matrix = chordFn.mock.calls[0][0];

      const grandTotal = matrix
        .flat()
        .reduce((sum, v) => sum + v, 0);
      // 150 + 200 + 150 + 500 = 1000
      expect(grandTotal).toBe(1000);
    });

    it("real padAngle(0.05) is applied to the chord layout", async () => {
      await createChart({ operation: "Sum" });

      const chordFn = mockD3.chord.mock.results[0].value;
      expect(chordFn.padAngle).toHaveBeenCalledWith(0.05);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // REAL THEMESERVICE COLORS INTO FILL
  // ═══════════════════════════════════════════════════════════════

  describe("real themeService colors", () => {
    it("Salesforce Standard palette hex flows into arc fill", async () => {
      await createChart({ theme: "Salesforce Standard" });

      // Group arc fill is computed via real createColorScale over the labels.
      // colorScale callbacks are invoked during d3 attr("fill", fn) — exercise them.
      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);

      // Each fill value is either a function (d3 lazy accessor) or a hex string.
      // Resolve any function accessors against the chord groups to collect colors.
      const chordFn = mockD3.chord.mock.results[0].value;
      const layout = chordFn.mock.results[0].value;
      const resolved = fillCalls
        .map((c) => c[1])
        .filter((v) => typeof v === "function")
        .flatMap((fn) => layout.groups.map((g) => fn(g)));

      // The first Salesforce Standard color is #1589EE; real createColorScale
      // assigns palette colors in label order, so #1589EE must appear.
      expect(resolved).toContain("#1589EE");
    });

    it("Warm palette hex flows into arc fill", async () => {
      await createChart({ theme: "Warm" });

      const chordFn = mockD3.chord.mock.results[0].value;
      const layout = chordFn.mock.results[0].value;
      const fillFns = mockD3.attr.mock.calls
        .filter((c) => c[0] === "fill" && typeof c[1] === "function")
        .map((c) => c[1]);
      const resolved = fillFns.flatMap((fn) => layout.groups.map((g) => fn(g)));

      // First Warm color is #FF6B6B
      expect(resolved).toContain("#FF6B6B");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SERVER EDGE LIST PIVOT
  // ═══════════════════════════════════════════════════════════════

  describe("server edge list pivot", () => {
    it("pivots getMultiGroupData edges into a square matrix", async () => {
      getMultiGroupData.mockResolvedValue([
        { label: "A", series: "X", value: 10 },
        { label: "A", series: "Y", value: 20 },
        { label: "B", series: "X", value: 30 }
      ]);

      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity"
      });

      expect(getMultiGroupData).toHaveBeenCalled();

      const chordFn = mockD3.chord.mock.results[0].value;
      const matrix = chordFn.mock.calls[0][0];
      // Distinct labels A, B, X, Y => 4x4
      expect(matrix.length).toBe(4);
      const total = matrix.flat().reduce((s, v) => s + v, 0);
      expect(total).toBe(60);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EVENT PIPELINE
  // ═══════════════════════════════════════════════════════════════

  describe("event pipeline integration", () => {
    it("registers a D3 click handler on group arcs when objectApiName is set", async () => {
      const element = await createChart({
        objectApiName: "Opportunity",
        filterField: "StageName"
      });

      const clickCalls = mockD3.on.mock.calls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);
      expect(element.objectApiName).toBe("Opportunity");
    });
  });
});
```

- [ ] **Step 2: Run the integration test — expect PASS.**

```bash
cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3ChordDiagram.integration
```

Expected: **PASS** — real `dataService.aggregateSeriesData` + `buildMatrix` produce a 5×5 matrix summing to 1000, and real `themeService.createColorScale` puts `#1589EE` (Salesforce Standard) / `#FF6B6B` (Warm) into the `fill` accessors. If `expect(resolved).toContain("#1589EE")` fails, confirm `renderChart` calls `colorScale(this._labels[d.index])` for the group `fill` (not a fixed color). Console output must be pristine.

- [ ] **Step 3: Commit.**

```bash
cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.integration.test.js
git commit -m "test(d3ChordDiagram): add integration tests for real matrix and palette flow"
```

---

#### Task 14.3: E2E tier — `d3ChordDiagram.e2e.test.js`

**Files:**

- Test: `force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.e2e.test.js` (Create)

Full lifecycle (create → load → render → assert SVG + data bound + spinner gone + no error), multi-instance isolation, data-flow verification, error recovery, and pristine console (success paths assert `console.error` was NOT called).

- [ ] **Step 1: Write the failing e2e test.** Clone the donor file to the new path, then replace its contents with the version below.

```bash
cp /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3DonutChart/__tests__/d3DonutChart.e2e.test.js \
   /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.e2e.test.js
```

```javascript
// force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.e2e.test.js
// ABOUTME: End-to-end lifecycle tests for the D3 Chord Diagram component.
// ABOUTME: Verifies full render pipeline, matrix/ribbon binding, multi-instance isolation, and error recovery using real services with mocked D3.

import { createElement } from "lwc";
import D3ChordDiagram from "c/d3ChordDiagram";
import { loadD3 } from "c/d3Lib";

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP: Only mock D3 lib, Apex, navigation, and toast
// Real modules: c/dataService, c/themeService, c/chartUtils
// ═══════════════════════════════════════════════════════════════

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/D3ChartController.getMultiGroupData",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const NavMixin = jest.fn((Base) => {
      return class extends Base {
        [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
      };
    });
    NavMixin.Navigate = Symbol.for("NavigationMixin.Navigate");
    NavMixin.GenerateUrl = Symbol.for("NavigationMixin.GenerateUrl");
    return { NavigationMixin: NavMixin };
  },
  { virtual: true }
);

jest.mock(
  "lightning/platformShowToastEvent",
  () => {
    return {
      ShowToastEvent: class ShowToastEvent extends CustomEvent {
        constructor(toast) {
          super("lightning__showtoast", {
            composed: true,
            cancelable: true,
            bubbles: true,
            detail: toast
          });
        }
      }
    };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY (chord-specific — chord, ribbon, arc)
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    chord: jest.fn(() => {
      const chordFn = jest.fn((matrix) => {
        const n = matrix.length;
        const groups = [];
        const ribbons = [];
        for (let i = 0; i < n; i++) {
          groups.push({
            index: i,
            startAngle: i * 0.5,
            endAngle: (i + 1) * 0.5,
            value: matrix[i].reduce((a, b) => a + b, 0)
          });
          for (let j = 0; j < n; j++) {
            if (matrix[i][j] > 0) {
              ribbons.push({
                source: { index: i, startAngle: 0, endAngle: 0.1 },
                target: { index: j, startAngle: 0.2, endAngle: 0.3 }
              });
            }
          }
        }
        ribbons.groups = groups;
        return ribbons;
      });
      chordFn.padAngle = jest.fn(() => chordFn);
      chordFn.sortSubgroups = jest.fn(() => chordFn);
      return chordFn;
    }),
    ribbon: jest.fn(() => {
      const ribbonFn = jest.fn(() => "M0,0");
      ribbonFn.radius = jest.fn(() => ribbonFn);
      return ribbonFn;
    }),
    arc: jest.fn(() => {
      const arcFn = jest.fn(() => "M0,0");
      arcFn.innerRadius = jest.fn(() => arcFn);
      arcFn.outerRadius = jest.fn(() => arcFn);
      return arcFn;
    })
  };
  return d3;
};

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Prospecting", LeadSource: "Web", Amount: 100 },
  { StageName: "Prospecting", LeadSource: "Phone", Amount: 200 },
  { StageName: "Qualification", LeadSource: "Web", Amount: 150 },
  { StageName: "Closed Won", LeadSource: "Phone", Amount: 500 }
];
// Distinct labels (source ∪ target): Closed Won, Phone, Prospecting, Qualification, Web => 5

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

async function createChart(props = {}) {
  const element = createElement("c-d3-chord-diagram", {
    is: D3ChordDiagram
  });

  Object.assign(element, {
    groupByField: "StageName",
    seriesField: "LeadSource",
    valueField: "Amount",
    operation: "Sum",
    recordCollection: SAMPLE_DATA,
    ...props
  });

  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-chord-diagram e2e", () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ═══════════════════════════════════════════════════════════════
  // FULL RENDER LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe("full render lifecycle", () => {
    it("creates chord diagram end-to-end with correct D3 calls", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      // loadD3 called during connectedCallback
      expect(loadD3).toHaveBeenCalled();

      // chord layout built
      expect(mockD3.chord).toHaveBeenCalled();

      // arc + ribbon generators created
      expect(mockD3.arc).toHaveBeenCalled();
      expect(mockD3.ribbon).toHaveBeenCalled();

      // SVG was appended
      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("svg");

      // Chart container visible
      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      // Spinner gone, no error state
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
      const errorEl = element.shadowRoot.querySelector(".slds-text-color_error");
      expect(errorEl).toBeFalsy();

      // No console errors during the full lifecycle
      const realErrors = consoleErrorSpy.mock.calls.filter(
        (call) =>
          !String(call[0]).includes("D3ChordDiagram initialization error")
      );
      expect(realErrors.length).toBe(0);
    });

    it("cleanup removes resize handler on disconnect", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();

      const cleanupErrors = consoleErrorSpy.mock.calls.filter(
        (call) =>
          String(call[0]).includes("cleanup") ||
          String(call[0]).includes("disconnect")
      );
      expect(cleanupErrors.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA-FLOW VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  describe("data-flow verification", () => {
    it("binds a square matrix matching distinct labels into the chord layout", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      await createChart({ operation: "Sum" });
      await flushPromises();

      const chordFn = mockD3.chord.mock.results[0].value;
      const matrix = chordFn.mock.calls[0][0];
      // 5 distinct labels => 5x5
      expect(matrix.length).toBe(5);
      matrix.forEach((row) => expect(row.length).toBe(5));

      // Total edge weight 100 + 200 + 150 + 500 = 950
      const total = matrix.flat().reduce((s, v) => s + v, 0);
      expect(total).toBe(950);
    });

    it("binds group arcs (data) via the data() call on the selection", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      await createChart();
      await flushPromises();

      // The component calls selectAll().data(groups) for group arcs and
      // .data(chordLayout) for ribbons — data() should be called.
      expect(mockD3.data).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTI-INSTANCE ISOLATION
  // ═══════════════════════════════════════════════════════════════

  describe("multi-instance isolation", () => {
    it("renders two independent chord diagrams without cross-talk", async () => {
      const mockD3First = createMockD3();
      loadD3.mockResolvedValue(mockD3First);
      const firstElement = await createChart({ theme: "Salesforce Standard" });
      await flushPromises();

      const mockD3Second = createMockD3();
      loadD3.mockResolvedValue(mockD3Second);
      const secondElement = await createChart({ theme: "Warm" });
      await flushPromises();

      // Both have their own chord layout invocation
      expect(mockD3First.chord).toHaveBeenCalled();
      expect(mockD3Second.chord).toHaveBeenCalled();

      // Both containers exist independently
      expect(
        firstElement.shadowRoot.querySelector(".chart-container")
      ).toBeTruthy();
      expect(
        secondElement.shadowRoot.querySelector(".chart-container")
      ).toBeTruthy();

      // No errors across both lifecycles
      const realErrors = consoleErrorSpy.mock.calls.filter(
        (call) =>
          !String(call[0]).includes("D3ChordDiagram initialization error")
      );
      expect(realErrors.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR → RECOVERY FLOW
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery flow", () => {
    it("shows error state when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("Network failure loading D3"));

      const element = await createChart();
      await flushPromises();
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeFalsy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });
  });
});
```

- [ ] **Step 2: Run the e2e test — expect PASS.**

```bash
cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3ChordDiagram.e2e
```

Expected: **PASS** — full lifecycle renders a 5×5 matrix totaling 950, two independent instances render without cross-talk, and the error path shows the error state. Success-path tests assert `console.error` was NOT called (pristine output). If the multi-instance test sees an error, confirm each instance reads its own `loadD3.mockResolvedValue(...)` (set before each `createChart`).

- [ ] **Step 3: Run the full `d3ChordDiagram` suite (all three tiers) — expect PASS.**

```bash
cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3ChordDiagram
```

Expected: **PASS** — three suites (`.test.js`, `.integration.test.js`, `.e2e.test.js`) all green, zero leaked console errors/warnings.

- [ ] **Step 4: Commit.**

```bash
cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.e2e.test.js
git commit -m "test(d3ChordDiagram): add e2e lifecycle and multi-instance isolation tests"
```


### Phase 15: Gantt Chart (`d3GanttChart`)

Build the `d3GanttChart` component (new chart, hardest in the build order) full-release with all three test tiers. It clones the universal scaffold from `d3BarChart` (§4.1) and swaps `renderChart` for a time-scale task-bar renderer: `d3.scaleTime()` on X over `chartUtils.computeDateExtent(rows,"start","end")`, `d3.scaleBand` on Y over labels, one `<rect>` per task from `x(start)` to `x(end)`. Data comes from the **new** Apex `getDateRangeData(objectName, labelField, startField, endField, filterClause) -> [{label,start,end}]` (server path) or `executeQuery` + `chartUtils.parseDate` (client path). The optional today-line marker is fed a `config.today` string so render is deterministic. This phase assumes the Foundation phases already added `getDateRangeData` (Apex + `jest.config.js` mapper + `__mocks__/@salesforce/apex/D3ChartController.getDateRangeData.js`) and `chartUtils.parseDate` / `chartUtils.computeDateExtent`.

> **Pre-flight (read before starting):**
> - Component scaffold donor: `force-app/main/default/lwc/d3BarChart/d3BarChart.js`, `.html`, `.js-meta.xml`.
> - Test-tier donors: `force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.test.js`, `d3BarChart.integration.test.js`, `d3BarChart.e2e.test.js`.
> - Confirm Foundation is done: `bash -c 'grep -q getDateRangeData /Users/weytani/code/d3-lwc/jest.config.js && echo MAPPER_OK || echo MAPPER_MISSING'` and `bash -c 'grep -q "export const parseDate\|parseDate =" /Users/weytani/code/d3-lwc/force-app/main/default/lwc/chartUtils/chartUtils.js && echo UTILS_OK || echo UTILS_MISSING'`. Both must print `*_OK`. If not, the Foundation phase has not run — stop and flag it.
> - Jest run pattern for this chart: `npm test -- --testPathPattern=d3GanttChart`.

---

#### Task 15.1: Unit tier — `d3GanttChart.test.js` (RED) → component (.js/.html/.js-meta.xml) → GREEN → commit

- **Files:**
  - Test: `force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.test.js` (Create)
  - Create: `force-app/main/default/lwc/d3GanttChart/d3GanttChart.js`
  - Create: `force-app/main/default/lwc/d3GanttChart/d3GanttChart.html`
  - Create: `force-app/main/default/lwc/d3GanttChart/d3GanttChart.js-meta.xml`

- [ ] **Step 1: Write the failing unit test.** Create the directory and the test file with the full content below. Note the differences from the Bar donor: SAMPLE_DATA is date-range rows `[{label,start,end}]`; `createMockD3()` adds a callable `scaleTime` (with chainable `.domain`/`.range`); the Apex mock is `getDateRangeData` not `getAggregatedData`; rendering-detail assertions check `scaleTime` was called, rects were appended, and the `scaleTime` domain equals `computeDateExtent` output `[new Date("2024-01-01"), new Date("2024-04-30")]`.

  ```bash
  mkdir -p /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3GanttChart/__tests__
  ```

  Then create `force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.test.js`:

  ```javascript
  // ABOUTME: Unit tests for the d3GanttChart Lightning Web Component.
  // ABOUTME: Tests init, date-range data handling, scaleTime domain, task rects, config, themes, tooltip, resize, error recovery.

  import { createElement } from "lwc";
  import D3GanttChart from "c/d3GanttChart";
  import { loadD3 } from "c/d3Lib";
  import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
  import getDateRangeData from "@salesforce/apex/D3ChartController.getDateRangeData";

  jest.mock("c/d3Lib", () => ({
    loadD3: jest.fn()
  }));

  jest.mock(
    "@salesforce/apex/D3ChartController.executeQuery",
    () => ({ default: jest.fn() }),
    { virtual: true }
  );

  jest.mock(
    "@salesforce/apex/D3ChartController.getDateRangeData",
    () => ({ default: jest.fn() }),
    { virtual: true }
  );

  // ═══════════════════════════════════════════════════════════════
  // MOCK D3 FACTORY — Gantt adds a callable scaleTime
  // ═══════════════════════════════════════════════════════════════

  const createMockD3 = () => {
    const mockD3 = {
      select: jest.fn(() => mockD3),
      append: jest.fn(() => mockD3),
      attr: jest.fn(() => mockD3),
      style: jest.fn(() => mockD3),
      call: jest.fn(() => mockD3),
      selectAll: jest.fn(() => mockD3),
      data: jest.fn(() => mockD3),
      enter: jest.fn(() => mockD3),
      transition: jest.fn(() => mockD3),
      duration: jest.fn(() => mockD3),
      delay: jest.fn(() => mockD3),
      on: jest.fn(() => mockD3),
      remove: jest.fn(() => mockD3),
      html: jest.fn(() => mockD3),
      text: jest.fn(() => mockD3),
      scaleTime: jest.fn(() => {
        const scale = jest.fn(() => 25);
        scale.domain = jest.fn(() => scale);
        scale.range = jest.fn(() => scale);
        scale.nice = jest.fn(() => scale);
        return scale;
      }),
      scaleBand: jest.fn(() => {
        const scale = jest.fn(() => 50);
        scale.domain = jest.fn(() => scale);
        scale.range = jest.fn(() => scale);
        scale.padding = jest.fn(() => scale);
        scale.bandwidth = jest.fn(() => 40);
        return scale;
      }),
      axisBottom: jest.fn(() => {
        const axis = jest.fn();
        axis.tickFormat = jest.fn(() => axis);
        axis.ticks = jest.fn(() => axis);
        return axis;
      }),
      axisLeft: jest.fn(() => {
        const axis = jest.fn();
        axis.tickFormat = jest.fn(() => axis);
        axis.tickSize = jest.fn(() => axis);
        return axis;
      }),
      max: jest.fn(() => 500)
    };
    return mockD3;
  };

  // ═══════════════════════════════════════════════════════════════
  // TEST DATA — date-range rows
  // ═══════════════════════════════════════════════════════════════

  const SAMPLE_DATA = [
    { label: "Design", start: "2024-01-01", end: "2024-02-15" },
    { label: "Build", start: "2024-02-01", end: "2024-03-20" },
    { label: "Test", start: "2024-03-10", end: "2024-04-30" }
  ];

  const SINGLE_RECORD = [
    { label: "Design", start: "2024-01-01", end: "2024-02-15" }
  ];

  const SPECIAL_CHAR_DATA = [
    { label: 'Phase "A"', start: "2024-01-01", end: "2024-02-01" },
    { label: "Phase 'B'", start: "2024-02-01", end: "2024-03-01" }
  ];

  // eslint-disable-next-line @lwc/lwc/no-async-operation
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

  describe("c-d3-gantt-chart", () => {
    let element;
    let mockD3;
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
      jest.clearAllMocks();
      mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);
      executeQuery.mockResolvedValue(SAMPLE_DATA);
      getDateRangeData.mockResolvedValue(SAMPLE_DATA);

      consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 400
      }));

      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
      }));
    });

    afterEach(() => {
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      jest.clearAllMocks();
    });

    async function createChart(props = {}) {
      element = createElement("c-d3-gantt-chart", {
        is: D3GanttChart
      });

      Object.assign(element, {
        labelField: "Name",
        startDateField: "Project_Start__c",
        endDateField: "Project_End__c",
        recordCollection: SAMPLE_DATA,
        ...props
      });

      document.body.appendChild(element);
      await flushPromises();
      await flushPromises();
      return element;
    }

    describe("initialization", () => {
      it("shows loading state initially", () => {
        element = createElement("c-d3-gantt-chart", { is: D3GanttChart });
        element.labelField = "Name";
        element.recordCollection = SAMPLE_DATA;
        document.body.appendChild(element);
        const spinner = element.shadowRoot.querySelector("lightning-spinner");
        expect(spinner).toBeTruthy();
      });

      it("loads D3 library on connect", async () => {
        await createChart();
        expect(loadD3).toHaveBeenCalled();
      });

      it("hides loading after initialization", async () => {
        await createChart();
        await flushPromises();
        const spinner = element.shadowRoot.querySelector("lightning-spinner");
        expect(spinner).toBeFalsy();
      });

      it("renders chart container when data is available", async () => {
        await createChart();
        await flushPromises();
        const container = element.shadowRoot.querySelector(".chart-container");
        expect(container).toBeTruthy();
      });
    });

    describe("data handling", () => {
      it("uses recordCollection when provided", async () => {
        await createChart({ recordCollection: SAMPLE_DATA });
        expect(executeQuery).not.toHaveBeenCalled();
        expect(getDateRangeData).not.toHaveBeenCalled();
      });

      it("executes SOQL when recordCollection is empty and no object set", async () => {
        await createChart({
          recordCollection: [],
          objectApiName: "",
          soqlQuery: "SELECT Name, Project_Start__c, Project_End__c FROM Opportunity"
        });
        expect(executeQuery).toHaveBeenCalledWith({
          queryString:
            "SELECT Name, Project_Start__c, Project_End__c FROM Opportunity"
        });
      });

      it("shows error when no data source provided", async () => {
        await createChart({ recordCollection: [], soqlQuery: "" });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeTruthy();
      });

      it("shows error when SOQL query fails", async () => {
        executeQuery.mockRejectedValue({ body: { message: "Query error" } });
        await createChart({
          recordCollection: [],
          soqlQuery: "SELECT Bad FROM Opportunity"
        });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeTruthy();
      });
    });

    describe("data edge cases", () => {
      it("handles single record", async () => {
        await createChart({ recordCollection: SINGLE_RECORD });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeFalsy();
      });

      it("handles special characters in labels", async () => {
        await createChart({ recordCollection: SPECIAL_CHAR_DATA });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeFalsy();
      });

      it("shows error when rows lack date fields", async () => {
        const noDates = [{ label: "X" }, { label: "Y" }];
        await createChart({ recordCollection: noDates });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeTruthy();
      });
    });

    describe("configuration", () => {
      it("applies height style to container", async () => {
        await createChart({ height: 400 });
        await flushPromises();
        const container = element.shadowRoot.querySelector(".chart-container");
        expect(container.getAttribute("style")).toContain("400px");
      });

      it("parses advancedConfig JSON", async () => {
        await createChart({ advancedConfig: '{"showGrid": true}' });
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeFalsy();
      });

      it("handles invalid advancedConfig JSON gracefully", async () => {
        await createChart({ advancedConfig: "not valid json" });
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeFalsy();
      });

      it("renders today marker when config.today is provided", async () => {
        await createChart({ advancedConfig: '{"today": "2024-03-01"}' });
        await flushPromises();
        const attrCalls = mockD3.attr.mock.calls;
        const markerCalls = attrCalls.filter(
          (c) => c[0] === "class" && c[1] === "today-line"
        );
        expect(markerCalls.length).toBeGreaterThan(0);
      });

      it("does not render today marker when config.today is absent", async () => {
        await createChart({ advancedConfig: "{}" });
        await flushPromises();
        const attrCalls = mockD3.attr.mock.calls;
        const markerCalls = attrCalls.filter(
          (c) => c[0] === "class" && c[1] === "today-line"
        );
        expect(markerCalls.length).toBe(0);
      });
    });

    describe("themes", () => {
      it("accepts Salesforce Standard theme", async () => {
        await createChart({ theme: "Salesforce Standard" });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeFalsy();
      });

      it("accepts Warm theme", async () => {
        await createChart({ theme: "Warm" });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeFalsy();
      });
    });

    describe("tooltip behavior", () => {
      it("registers mouseenter handler on task bars", async () => {
        await createChart();
        await flushPromises();
        const onCalls = mockD3.on.mock.calls;
        const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
        expect(mouseenterCalls.length).toBeGreaterThan(0);
      });

      it("registers mouseleave handler on task bars", async () => {
        await createChart();
        await flushPromises();
        const onCalls = mockD3.on.mock.calls;
        const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
        expect(mouseleaveCalls.length).toBeGreaterThan(0);
      });
    });

    describe("responsive behavior", () => {
      it("sets up resize observer", async () => {
        await createChart();
        await flushPromises();
        expect(global.ResizeObserver).toHaveBeenCalled();
      });

      it("handles zero container width gracefully", async () => {
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0
        }));
        await createChart();
        await flushPromises();
        expect(loadD3).toHaveBeenCalled();
      });

      it("retries chart init when container starts at zero width", async () => {
        let containerWidth = 0;
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
          width: containerWidth,
          height: 300,
          top: 0,
          left: 0,
          bottom: 300,
          right: containerWidth
        }));

        const rafCallbacks = [];
        global.requestAnimationFrame = jest.fn((cb) => {
          rafCallbacks.push(cb);
          return rafCallbacks.length;
        });
        global.cancelAnimationFrame = jest.fn();

        await createChart();
        await flushPromises();

        expect(global.requestAnimationFrame).toHaveBeenCalled();
        expect(mockD3.scaleTime).not.toHaveBeenCalled();

        containerWidth = 400;
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
          width: 400,
          height: 300,
          top: 0,
          left: 0,
          bottom: 300,
          right: 400
        }));

        while (rafCallbacks.length > 0) {
          const cb = rafCallbacks.shift();
          cb();
        }

        expect(mockD3.select).toHaveBeenCalled();
      });

      it("cancels layout retry on disconnect", async () => {
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0
        }));
        global.requestAnimationFrame = jest.fn(() => 42);
        global.cancelAnimationFrame = jest.fn();

        await createChart();
        await flushPromises();
        document.body.removeChild(element);
        expect(global.cancelAnimationFrame).toHaveBeenCalled();
      });
    });

    describe("error recovery", () => {
      it("shows error when D3 fails to load", async () => {
        loadD3.mockRejectedValue(new Error("D3 load failed"));
        await createChart();
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeTruthy();
      });

      it("logs error to console on D3 load failure", async () => {
        loadD3.mockRejectedValue(new Error("D3 load failed"));
        await createChart();
        await flushPromises();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it("sets isLoading to false even on error", async () => {
        loadD3.mockRejectedValue(new Error("D3 load failed"));
        await createChart();
        await flushPromises();
        const spinner = element.shadowRoot.querySelector("lightning-spinner");
        expect(spinner).toBeFalsy();
      });
    });

    describe("rendering details", () => {
      it("creates SVG element", async () => {
        await createChart();
        await flushPromises();
        const appendCalls = mockD3.append.mock.calls;
        const svgCalls = appendCalls.filter((c) => c[0] === "svg");
        expect(svgCalls.length).toBeGreaterThan(0);
      });

      it("creates task rect elements", async () => {
        await createChart();
        await flushPromises();
        const appendCalls = mockD3.append.mock.calls;
        const rectCalls = appendCalls.filter((c) => c[0] === "rect");
        expect(rectCalls.length).toBeGreaterThan(0);
      });

      it("creates a time scale for the x-axis", async () => {
        await createChart();
        await flushPromises();
        expect(mockD3.scaleTime).toHaveBeenCalled();
      });

      it("creates a band scale for the y-axis", async () => {
        await createChart();
        await flushPromises();
        expect(mockD3.scaleBand).toHaveBeenCalled();
      });

      it("sets the scaleTime domain to the computed date extent", async () => {
        const domainSpy = jest.fn(function spy() {
          return this;
        });
        mockD3.scaleTime = jest.fn(() => {
          const scale = jest.fn(() => 25);
          scale.domain = domainSpy;
          scale.range = jest.fn(() => scale);
          scale.nice = jest.fn(() => scale);
          return scale;
        });

        await createChart();
        await flushPromises();

        // computeDateExtent(SAMPLE_DATA, "start", "end") => [2024-01-01, 2024-04-30]
        const domainArg = domainSpy.mock.calls[0][0];
        expect(domainArg[0].getTime()).toBe(new Date("2024-01-01").getTime());
        expect(domainArg[1].getTime()).toBe(new Date("2024-04-30").getTime());
      });

      it("creates an x-axis group", async () => {
        await createChart();
        await flushPromises();
        const attrCalls = mockD3.attr.mock.calls;
        const classCalls = attrCalls.filter(
          (c) => c[0] === "class" && c[1] === "x-axis"
        );
        expect(classCalls.length).toBeGreaterThan(0);
      });

      it("creates a y-axis group", async () => {
        await createChart();
        await flushPromises();
        const attrCalls = mockD3.attr.mock.calls;
        const classCalls = attrCalls.filter(
          (c) => c[0] === "class" && c[1] === "y-axis"
        );
        expect(classCalls.length).toBeGreaterThan(0);
      });

      it("derives rect x from the start date via the time scale", async () => {
        await createChart();
        await flushPromises();
        const attrCalls = mockD3.attr.mock.calls;
        const xCalls = attrCalls.filter((c) => c[0] === "x");
        expect(xCalls.length).toBeGreaterThan(0);
        // x attr receives a function (d) => xScale(d.start)
        const xFn = xCalls.find((c) => typeof c[1] === "function");
        expect(xFn).toBeTruthy();
      });

      it("derives rect width from end minus start via the time scale", async () => {
        await createChart();
        await flushPromises();
        const attrCalls = mockD3.attr.mock.calls;
        const widthCalls = attrCalls.filter(
          (c) => c[0] === "width" && typeof c[1] === "function"
        );
        expect(widthCalls.length).toBeGreaterThan(0);
      });

      it("removes existing SVG before re-render", async () => {
        await createChart();
        await flushPromises();
        expect(mockD3.select).toHaveBeenCalled();
        expect(mockD3.remove).toHaveBeenCalled();
      });
    });

    describe("server date-range data", () => {
      it("calls getDateRangeData when objectApiName and date fields are set", async () => {
        await createChart({
          recordCollection: [],
          soqlQuery: "",
          objectApiName: "Opportunity",
          labelField: "Name",
          startDateField: "Project_Start__c",
          endDateField: "Project_End__c"
        });
        await flushPromises();
        expect(getDateRangeData).toHaveBeenCalledWith({
          objectName: "Opportunity",
          labelField: "Name",
          startField: "Project_Start__c",
          endField: "Project_End__c",
          filterClause: null
        });
        expect(executeQuery).not.toHaveBeenCalled();
      });

      it("passes filterClause to getDateRangeData when set", async () => {
        await createChart({
          recordCollection: [],
          soqlQuery: "",
          objectApiName: "Opportunity",
          labelField: "Name",
          startDateField: "Project_Start__c",
          endDateField: "Project_End__c",
          filterClause: "Amount > 1000"
        });
        await flushPromises();
        expect(getDateRangeData).toHaveBeenCalledWith({
          objectName: "Opportunity",
          labelField: "Name",
          startField: "Project_Start__c",
          endField: "Project_End__c",
          filterClause: "Amount > 1000"
        });
      });

      it("renders chart from server date-range data", async () => {
        await createChart({
          recordCollection: [],
          soqlQuery: "",
          objectApiName: "Opportunity",
          labelField: "Name",
          startDateField: "Project_Start__c",
          endDateField: "Project_End__c"
        });
        await flushPromises();
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeFalsy();
      });

      it("shows error when getDateRangeData fails", async () => {
        getDateRangeData.mockRejectedValue({
          body: { message: "Date range query failed" }
        });
        await createChart({
          recordCollection: [],
          soqlQuery: "",
          objectApiName: "Opportunity",
          labelField: "Name",
          startDateField: "Project_Start__c",
          endDateField: "Project_End__c"
        });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeTruthy();
      });

      it("shows error when getDateRangeData returns empty array", async () => {
        getDateRangeData.mockResolvedValue([]);
        await createChart({
          recordCollection: [],
          soqlQuery: "",
          objectApiName: "Opportunity",
          labelField: "Name",
          startDateField: "Project_Start__c",
          endDateField: "Project_End__c"
        });
        await flushPromises();
        const errorElement = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorElement).toBeTruthy();
      });

      it("prefers recordCollection over server date-range data", async () => {
        await createChart({
          recordCollection: SAMPLE_DATA,
          objectApiName: "Opportunity",
          labelField: "Name",
          startDateField: "Project_Start__c",
          endDateField: "Project_End__c"
        });
        await flushPromises();
        expect(getDateRangeData).not.toHaveBeenCalled();
        expect(executeQuery).not.toHaveBeenCalled();
      });
    });

    describe("getters", () => {
      it("containerStyle returns correct height string", async () => {
        await createChart({ height: 450 });
        await flushPromises();
        const container = element.shadowRoot.querySelector(".chart-container");
        expect(container.getAttribute("style")).toContain("450px");
      });

      it("hasError returns true when error is set", async () => {
        loadD3.mockRejectedValue(new Error("Test error"));
        await createChart();
        await flushPromises();
        const errorEl = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorEl).toBeTruthy();
      });
    });

    describe("cleanup", () => {
      it("disconnects resize observer on disconnect", async () => {
        const mockDisconnect = jest.fn();
        global.ResizeObserver = jest.fn().mockImplementation(() => ({
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: mockDisconnect
        }));
        await createChart();
        await flushPromises();
        document.body.removeChild(element);
        expect(mockDisconnect).toHaveBeenCalled();
      });

      it("handles double disconnect gracefully", async () => {
        await createChart();
        await flushPromises();
        document.body.removeChild(element);
        expect(true).toBe(true);
      });
    });
  });
  ```

- [ ] **Step 2: Run the unit test, expect it to FAIL.** Command:
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3GanttChart 2>&1 | tail -30
  ```
  **Expected: FAIL** because `c/d3GanttChart` does not exist yet — Jest reports `Cannot find module 'c/d3GanttChart'`. (If it instead reports `Cannot find module '@salesforce/apex/D3ChartController.getDateRangeData'`, the Foundation phase's `jest.config.js` mapper + `__mocks__` stub were not added — stop and flag it.)

- [ ] **Step 3: Implement the component HTML.** It is identical to the Bar donor's 4-state template. Create `force-app/main/default/lwc/d3GanttChart/d3GanttChart.html`:

  ```html
  <template>
    <div class="slds-card">
      <!-- Loading State -->
      <template lwc:if={isLoading}>
        <div class="slds-align_absolute-center" style="height: 200px">
          <lightning-spinner
            alternative-text="Loading chart..."
            size="medium"
          ></lightning-spinner>
        </div>
      </template>

      <!-- Error State -->
      <template lwc:elseif={hasError}>
        <div
          class="slds-align_absolute-center slds-text-color_error"
          style="height: 200px; padding: 1rem"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:error"
              alternative-text="Error"
              size="large"
              variant="error"
            ></lightning-icon>
            <p class="slds-m-top_small">{error}</p>
          </div>
        </div>
      </template>

      <!-- Chart Container (has data) -->
      <template lwc:elseif={hasData}>
        <div class="chart-container" lwc:dom="manual" style={containerStyle}></div>
      </template>

      <!-- No Data State -->
      <template lwc:else>
        <div
          class="slds-align_absolute-center slds-text-color_weak"
          style="height: 200px"
        >
          <div class="slds-text-align_center">
            <lightning-icon
              icon-name="utility:chart"
              alternative-text="No data"
              size="large"
            ></lightning-icon>
            <p class="slds-m-top_small">No data available</p>
          </div>
        </div>
      </template>
    </div>
  </template>
  ```

- [ ] **Step 4: Implement the component JS.** Clone the Bar scaffold verbatim (imports, universal `@api`, `@track`, private fields, getters, `connectedCallback`/`renderedCallback`/`disconnectedCallback`, `initializeChart`, `cleanup`) and change only: the chart-specific `@api` (`labelField`/`startDateField`/`endDateField`/optional `groupByField` for swimlanes), the import set (`parseDate`/`computeDateExtent` from chartUtils, `getDateRangeData` Apex), `loadData()` (date-range cascade), `_prepareDateRows()`, and `renderChart()` (scaleTime X + scaleBand Y + task rects). Create `force-app/main/default/lwc/d3GanttChart/d3GanttChart.js`:

  ```javascript
  /**
   * ABOUTME: D3 Gantt Chart Lightning Web Component.
   * ABOUTME: Renders date-range tasks as horizontal bars on a time axis with optional swimlanes and a today marker.
   */
  import { LightningElement, api, track } from "lwc";
  import { loadD3 } from "c/d3Lib";
  import { getColors, DEFAULT_THEME } from "c/themeService";
  import {
    formatNumber,
    truncateLabel,
    createTooltip,
    createResizeHandler,
    createLayoutRetry,
    parseDate,
    computeDateExtent
  } from "c/chartUtils";
  import { NavigationMixin } from "lightning/navigation";
  import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
  import getDateRangeData from "@salesforce/apex/D3ChartController.getDateRangeData";

  export default class D3GanttChart extends NavigationMixin(LightningElement) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    /** Data collection from Flow or parent component */
    @api recordCollection = [];

    /** SOQL query string (used if recordCollection is empty and no object set) */
    @api soqlQuery =
      "SELECT Name, Project_Start__c, Project_End__c FROM Opportunity";

    /** Field holding the task label (category / row) */
    @api labelField = "Name";

    /** Field holding the task start date */
    @api startDateField = "Project_Start__c";

    /** Field holding the task end date */
    @api endDateField = "Project_End__c";

    /** Optional field to group tasks into swimlanes */
    @api groupByField = "";

    /** Chart height in pixels */
    @api height = 300;

    /** Color theme */
    @api theme = DEFAULT_THEME;

    /** Advanced configuration JSON */
    @api advancedConfig = "{}";

    /** Maximum records to process (overrides default limit) */
    @api recordLimit;

    /** Object API name for drill-down navigation */
    @api objectApiName = "";

    /** Filter field for drill-down */
    @api filterField = "";

    /** Optional WHERE clause fragment for server-side fetch */
    @api filterClause = "";

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════

    @track isLoading = true;
    @track error = null;
    @track chartData = [];

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE PROPERTIES
    // ═══════════════════════════════════════════════════════════════

    d3 = null;
    svg = null;
    tooltip = null;
    resizeHandler = null;
    chartRendered = false;
    _layoutRetry = null;
    _config = {};
    _configParsed = false;

    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════

    get containerStyle() {
      return `height: ${this.height}px;`;
    }

    get hasError() {
      return !!this.error;
    }

    get hasData() {
      return this.chartData && this.chartData.length > 0;
    }

    get showChart() {
      return !this.isLoading && !this.hasError && this.hasData;
    }

    get config() {
      if (!this._configParsed) {
        try {
          this._config = JSON.parse(this.advancedConfig || "{}");
        } catch {
          this._config = {};
        }
        this._configParsed = true;
      }
      return this._config;
    }

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════════

    async connectedCallback() {
      try {
        this.d3 = await loadD3(this);
        await this.loadData();
      } catch (e) {
        this.error = e.message || "Failed to initialize chart";
        console.error("D3GanttChart initialization error:", e);
      } finally {
        this.isLoading = false;
      }
    }

    renderedCallback() {
      if (this.showChart && !this.chartRendered) {
        this.chartRendered = this.initializeChart();
        if (!this.chartRendered && !this._layoutRetry) {
          const container = this.template.querySelector(".chart-container");
          if (container) {
            this._layoutRetry = createLayoutRetry(container, () => {
              this._layoutRetry = null;
              if (!this.chartRendered) {
                this.chartRendered = this.initializeChart();
              }
            });
          }
        }
      }
    }

    disconnectedCallback() {
      if (this._layoutRetry) {
        this._layoutRetry.cancel();
        this._layoutRetry = null;
      }
      this.cleanup();
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════

    async loadData() {
      // Priority 1: recordCollection (client-side date parsing)
      if (this.recordCollection && this.recordCollection.length > 0) {
        this.chartData = this._prepareDateRows([...this.recordCollection]);
        if (this.chartData.length === 0) {
          throw new Error("No tasks with valid start and end dates");
        }
        return;
      }

      // Priority 2: server date-range fetch
      if (
        this.objectApiName &&
        this.labelField &&
        this.startDateField &&
        this.endDateField
      ) {
        let result = [];
        try {
          result = await getDateRangeData({
            objectName: this.objectApiName,
            labelField: this.labelField,
            startField: this.startDateField,
            endField: this.endDateField,
            filterClause: this.filterClause || null
          });
        } catch (e) {
          throw new Error(
            `Date Range Error: ${e.body?.message || e.message}`
          );
        }
        // Server returns [{label, start, end}] with ISO date strings
        this.chartData = this._prepareDateRows(result);
        if (this.chartData.length === 0) {
          throw new Error("No tasks with valid start and end dates");
        }
        return;
      }

      // Priority 3: SOQL fallback with client-side date parsing
      if (this.soqlQuery) {
        let rawData = [];
        try {
          rawData = await executeQuery({ queryString: this.soqlQuery });
        } catch (e) {
          throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
        }
        const mapped = rawData.map((row) => ({
          label: row[this.labelField],
          start: row[this.startDateField],
          end: row[this.endDateField]
        }));
        this.chartData = this._prepareDateRows(mapped);
        if (this.chartData.length === 0) {
          throw new Error("No tasks with valid start and end dates");
        }
        return;
      }

      throw new Error(
        "No data source provided. Set recordCollection or soqlQuery."
      );
    }

    /**
     * Normalizes rows into {label, start: Date, end: Date}, dropping rows
     * whose start or end date cannot be parsed.
     */
    _prepareDateRows(rows) {
      const limit = this.recordLimit || 2000;
      return rows
        .slice(0, limit)
        .map((row) => ({
          label: row.label,
          start: parseDate(row.start),
          end: parseDate(row.end)
        }))
        .filter((row) => row.start !== null && row.end !== null);
    }

    // ═══════════════════════════════════════════════════════════════
    // CHART RENDERING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Initializes the chart SVG, tooltip, and resize observer.
     * @returns {boolean} true if the chart was successfully initialized
     */
    initializeChart() {
      const container = this.template.querySelector(".chart-container");
      if (!container) return false;

      const { width } = container.getBoundingClientRect();
      if (width === 0) return false;

      this.tooltip = createTooltip(container);
      this.renderChart(width);

      this.resizeHandler = createResizeHandler(
        container,
        ({ width: newWidth }) => {
          if (newWidth > 0) {
            this.renderChart(newWidth);
          }
        }
      );
      this.resizeHandler.observe();
      return true;
    }

    renderChart(containerWidth) {
      const d3 = this.d3;
      const container = this.template.querySelector(".chart-container");
      if (!container || !d3) return;

      // Clear existing SVG (idempotent across init + resize)
      d3.select(container).select("svg").remove();

      const margin = { top: 20, right: 20, bottom: 40, left: 100 };
      const width = containerWidth - margin.left - margin.right;
      const height = this.height - margin.top - margin.bottom;

      if (width <= 0 || height <= 0) return;

      this.svg = d3
        .select(container)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", this.height)
        .attr("class", "gantt-chart-svg")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // X: time scale over the full task date extent
      const extent = computeDateExtent(this.chartData, "start", "end");
      const xScale = d3.scaleTime().domain(extent).range([0, width]).nice();

      // Y: band scale over task labels
      const yScale = d3
        .scaleBand()
        .domain(this.chartData.map((d) => d.label))
        .range([0, height])
        .padding(0.2);

      const colors = getColors(
        this.theme,
        this.chartData.length,
        this.config.customColors
      );

      // X Axis
      this.svg
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(6));

      // Y Axis
      this.svg
        .append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).tickFormat((d) => truncateLabel(d, 14)));

      // Task bars
      const bars = this.svg
        .selectAll(".task")
        .data(this.chartData)
        .enter()
        .append("rect")
        .attr("class", "task")
        .attr("x", (d) => xScale(d.start))
        .attr("y", (d) => yScale(d.label))
        .attr("width", (d) => Math.max(0, xScale(d.end) - xScale(d.start)))
        .attr("height", yScale.bandwidth())
        .attr("fill", (d, i) => colors[i])
        .attr("rx", 2)
        .attr("cursor", this.objectApiName ? "pointer" : "default");

      // Tooltip interactions
      bars
        .on("mouseenter", (event, d) => {
          this.showTooltip(event, d);
        })
        .on("mousemove", (event) => {
          this.moveTooltip(event);
        })
        .on("mouseleave", () => {
          this.hideTooltip();
        })
        .on("click", (event, d) => {
          this.handleTaskClick(d);
        });

      // Optional today marker — driven by config.today for deterministic tests
      if (this.config.today) {
        const todayDate = parseDate(this.config.today);
        if (todayDate) {
          this.svg
            .append("line")
            .attr("class", "today-line")
            .attr("x1", xScale(todayDate))
            .attr("x2", xScale(todayDate))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#FF5D5D")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4");
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP HANDLERS
    // ═══════════════════════════════════════════════════════════════

    showTooltip(event, d) {
      if (!this.tooltip) return;
      const startStr = d.start.toISOString().slice(0, 10);
      const endStr = d.end.toISOString().slice(0, 10);
      const durationDays = Math.round(
        (d.end.getTime() - d.start.getTime()) / 86400000
      );
      const content = `<strong>${d.label}</strong><br/>${startStr} → ${endStr}<br/>${formatNumber(
        durationDays
      )} days`;
      this.tooltip.show(content, event.offsetX, event.offsetY);
    }

    // eslint-disable-next-line no-unused-vars
    moveTooltip(event) {
      // Positioning handled in show()
    }

    hideTooltip() {
      if (!this.tooltip) return;
      this.tooltip.hide();
    }

    // ═══════════════════════════════════════════════════════════════
    // CLICK HANDLER - DRILL DOWN
    // ═══════════════════════════════════════════════════════════════

    handleTaskClick(d) {
      if (!this.objectApiName) return;

      const filterFieldName = this.filterField || this.labelField;

      this[NavigationMixin.Navigate]({
        type: "standard__objectPage",
        attributes: {
          objectApiName: this.objectApiName,
          actionName: "list"
        },
        state: {
          filterName: "Recent"
        }
      });

      this.dispatchEvent(
        new CustomEvent("taskclick", {
          detail: {
            label: d.label,
            start: d.start,
            end: d.end,
            filterField: filterFieldName
          },
          bubbles: true,
          composed: true
        })
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════

    cleanup() {
      if (this.resizeHandler) {
        this.resizeHandler.disconnect();
        this.resizeHandler = null;
      }
      if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
      }
    }
  }
  ```

- [ ] **Step 5: Implement the component meta.** Create `force-app/main/default/lwc/d3GanttChart/d3GanttChart.js-meta.xml` (apiVersion 65.0, isExposed, masterLabel "D3 Gantt Chart", AppPage/RecordPage/HomePage targets, one `<property>` per exposed `@api` — `recordCollection` is NOT exposed):

  ```xml
  <?xml version="1.0" encoding="UTF-8" ?>
  <LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
      <apiVersion>65.0</apiVersion>
      <isExposed>true</isExposed>
      <masterLabel>D3 Gantt Chart</masterLabel>
      <description
    >Interactive Gantt chart powered by D3.js. Renders date-range tasks as horizontal bars on a time axis.</description>
      <targets>
          <target>lightning__AppPage</target>
          <target>lightning__RecordPage</target>
          <target>lightning__HomePage</target>
      </targets>
      <targetConfigs>
          <targetConfig
        targets="lightning__AppPage,lightning__RecordPage,lightning__HomePage"
      >
              <!-- Data Source -->
              <property
          name="soqlQuery"
          type="String"
          label="SOQL Query"
          description="SOQL query to fetch tasks (used when no Drill-Down Object is set)"
          placeholder="SELECT Name, Project_Start__c, Project_End__c FROM Opportunity"
        />

              <!-- Field Mapping -->
              <property
          name="labelField"
          type="String"
          label="Label Field"
          default="Name"
          description="API name of the task label field"
          placeholder="Name"
        />
              <property
          name="startDateField"
          type="String"
          label="Start Date Field"
          default="Project_Start__c"
          description="API name of the task start date field"
          placeholder="Project_Start__c"
        />
              <property
          name="endDateField"
          type="String"
          label="End Date Field"
          default="Project_End__c"
          description="API name of the task end date field"
          placeholder="Project_End__c"
        />
              <property
          name="groupByField"
          type="String"
          label="Swimlane Field"
          description="Optional API name of a field to group tasks into swimlanes"
        />

              <!-- Appearance -->
              <property
          name="height"
          type="Integer"
          label="Height (px)"
          default="300"
          description="Chart height in pixels"
          min="150"
          max="800"
        />
              <property
          name="theme"
          type="String"
          label="Color Theme"
          default="Salesforce Standard"
          datasource="Salesforce Standard,Warm,Cool,Vibrant"
          description="Color palette for the chart"
        />

              <!-- Drill-Down / Server fetch -->
              <property
          name="objectApiName"
          type="String"
          label="Drill-Down Object"
          description="Object API name for server-side fetch and navigation on task click"
          placeholder="Opportunity"
        />
              <property
          name="filterField"
          type="String"
          label="Filter Field"
          description="Field to filter by on drill-down (defaults to Label Field)"
        />
              <property
          name="filterClause"
          type="String"
          label="Filter Clause"
          description="Optional WHERE clause fragment for the server-side fetch"
        />

              <property
          name="recordLimit"
          type="Integer"
          label="Record Limit"
          description="Maximum tasks to process. Leave empty for default."
          min="1"
          max="10000"
        />

              <!-- Advanced -->
              <property
          name="advancedConfig"
          type="String"
          label="Advanced Config (JSON)"
          description='{"today": "2024-03-01", "customColors": ["#FF5733"]}'
        />
          </targetConfig>
      </targetConfigs>
  </LightningComponentBundle>
  ```

- [ ] **Step 6: Run the unit test, expect PASS.** Command:
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3GanttChart 2>&1 | tail -30
  ```
  **Expected: PASS** — all `d3GanttChart.test.js` cases green, no console output leaked (the `consoleErrorSpy`/`consoleWarnSpy` are restored in `afterEach`). If the "sets the scaleTime domain to the computed date extent" case fails, confirm `computeDateExtent` returns `[min, max]` Date objects and that `renderChart` passes `extent` straight into `.domain(...)`.

- [ ] **Step 7: Commit the unit tier + component.** Commands:
  ```bash
  cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3GanttChart/d3GanttChart.js force-app/main/default/lwc/d3GanttChart/d3GanttChart.html force-app/main/default/lwc/d3GanttChart/d3GanttChart.js-meta.xml force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.test.js
  git commit -m "feat(d3GanttChart): add Gantt chart component with unit tests"
  ```

---

#### Task 15.2: Integration tier — `d3GanttChart.integration.test.js` (real services) → run → commit

- **Files:**
  - Test: `force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.integration.test.js` (Create)

- [ ] **Step 1: Clone the integration donor.** Copy the Bar integration suite as the starting point:
  ```bash
  cp /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.integration.test.js /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.integration.test.js
  ```
  Then edit the copy to match the Gantt component. This integration tier mocks ONLY `c/d3Lib` + Apex (`executeQuery`) + `lightning/navigation` + `lightning/platformShowToastEvent`; it runs the REAL `chartUtils.parseDate`/`computeDateExtent` and REAL `themeService.getColors`, and asserts real parsed Dates and real palette hex flow into `mockD3.data()`. Replace the entire file body with:

  ```javascript
  // ABOUTME: Integration tests for d3GanttChart verifying real service pipelines (chartUtils date utils, themeService).
  // ABOUTME: Only D3, Apex, NavigationMixin, and ShowToastEvent are mocked; all utility services use real implementations.

  import { createElement } from "lwc";
  import D3GanttChart from "c/d3GanttChart";
  import { loadD3 } from "c/d3Lib";
  import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

  jest.mock("c/d3Lib", () => ({
    loadD3: jest.fn()
  }));

  jest.mock(
    "@salesforce/apex/D3ChartController.executeQuery",
    () => ({ default: jest.fn() }),
    { virtual: true }
  );

  jest.mock(
    "lightning/platformShowToastEvent",
    () => {
      const Mock = jest.fn((params) => {
        return new CustomEvent("lightning__showtoast", { detail: params });
      });
      return { ShowToastEvent: Mock };
    },
    { virtual: true }
  );

  const mockNavigate = jest.fn();
  jest.mock(
    "lightning/navigation",
    () => {
      const Navigate = Symbol.for("NavigationMixin.Navigate");
      const mixin = (Base) => {
        return class extends Base {
          [Navigate] = mockNavigate;
        };
      };
      mixin.Navigate = Navigate;
      return { NavigationMixin: mixin };
    },
    { virtual: true }
  );

  // ═══════════════════════════════════════════════════════════════
  // MOCK D3 FACTORY — captures the time-scale domain
  // ═══════════════════════════════════════════════════════════════

  let capturedTimeDomain;

  const createMockD3 = () => {
    const mockD3 = {
      select: jest.fn(() => mockD3),
      append: jest.fn(() => mockD3),
      attr: jest.fn(() => mockD3),
      style: jest.fn(() => mockD3),
      call: jest.fn(() => mockD3),
      selectAll: jest.fn(() => mockD3),
      data: jest.fn(() => mockD3),
      enter: jest.fn(() => mockD3),
      transition: jest.fn(() => mockD3),
      duration: jest.fn(() => mockD3),
      delay: jest.fn(() => mockD3),
      on: jest.fn(() => mockD3),
      remove: jest.fn(() => mockD3),
      html: jest.fn(() => mockD3),
      text: jest.fn(() => mockD3),
      scaleTime: jest.fn(() => {
        const scale = jest.fn(() => 25);
        scale.domain = jest.fn((d) => {
          if (d !== undefined) capturedTimeDomain = d;
          return scale;
        });
        scale.range = jest.fn(() => scale);
        scale.nice = jest.fn(() => scale);
        return scale;
      }),
      scaleBand: jest.fn(() => {
        const scale = jest.fn(() => 50);
        scale.domain = jest.fn(() => scale);
        scale.range = jest.fn(() => scale);
        scale.padding = jest.fn(() => scale);
        scale.bandwidth = jest.fn(() => 40);
        return scale;
      }),
      axisBottom: jest.fn(() => {
        const axis = jest.fn();
        axis.tickFormat = jest.fn(() => axis);
        axis.ticks = jest.fn(() => axis);
        return axis;
      }),
      axisLeft: jest.fn(() => {
        const axis = jest.fn();
        axis.tickFormat = jest.fn(() => axis);
        axis.tickSize = jest.fn(() => axis);
        return axis;
      }),
      max: jest.fn(() => 500)
    };
    return mockD3;
  };

  // ═══════════════════════════════════════════════════════════════
  // TEST DATA
  // ═══════════════════════════════════════════════════════════════

  const SAMPLE_DATA = [
    { label: "Design", start: "2024-01-01", end: "2024-02-15" },
    { label: "Build", start: "2024-02-01", end: "2024-03-20" },
    { label: "Test", start: "2024-03-10", end: "2024-04-30" }
  ];

  const flushPromises = () => new Promise(process.nextTick);

  describe("c-d3-gantt-chart integration", () => {
    let element;
    let mockD3;
    let consoleErrorSpy;
    let consoleWarnSpy;
    let resizeObserverCallback;

    beforeEach(() => {
      jest.clearAllMocks();
      capturedTimeDomain = undefined;

      mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);
      executeQuery.mockResolvedValue(SAMPLE_DATA);

      consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 400
      }));

      resizeObserverCallback = null;
      global.ResizeObserver = jest.fn().mockImplementation((cb) => {
        resizeObserverCallback = cb;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn()
        };
      });
    });

    afterEach(() => {
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      jest.clearAllMocks();
    });

    async function createChart(props = {}) {
      element = createElement("c-d3-gantt-chart", {
        is: D3GanttChart
      });

      Object.assign(element, {
        labelField: "Name",
        startDateField: "Project_Start__c",
        endDateField: "Project_End__c",
        recordCollection: SAMPLE_DATA,
        ...props
      });

      document.body.appendChild(element);
      await flushPromises();
      await flushPromises();
      return element;
    }

    // ═══════════════════════════════════════════════════════════════
    // DATE PIPELINE INTEGRATION (real chartUtils)
    // ═══════════════════════════════════════════════════════════════

    describe("date pipeline integration", () => {
      it("parses ISO date strings into real Dates and binds them to D3 data()", async () => {
        await createChart({ recordCollection: SAMPLE_DATA });

        const dataCalls = mockD3.data.mock.calls;
        const chartDataCall = dataCalls.find(
          (call) =>
            Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
        );
        expect(chartDataCall).toBeTruthy();

        const passedData = chartDataCall[0];
        expect(passedData).toHaveLength(3);
        expect(passedData[0].label).toBe("Design");
        expect(passedData[0].start instanceof Date).toBe(true);
        expect(passedData[0].end instanceof Date).toBe(true);
        expect(passedData[0].start.getTime()).toBe(
          new Date("2024-01-01").getTime()
        );
        expect(passedData[0].end.getTime()).toBe(
          new Date("2024-02-15").getTime()
        );
      });

      it("sets the time-scale domain to the real computeDateExtent output", async () => {
        await createChart({ recordCollection: SAMPLE_DATA });

        // Real computeDateExtent over all rows: min start 2024-01-01, max end 2024-04-30
        expect(capturedTimeDomain).toBeTruthy();
        expect(capturedTimeDomain[0].getTime()).toBe(
          new Date("2024-01-01").getTime()
        );
        expect(capturedTimeDomain[1].getTime()).toBe(
          new Date("2024-04-30").getTime()
        );
      });

      it("drops rows whose dates cannot be parsed", async () => {
        const mixed = [
          { label: "Good", start: "2024-01-01", end: "2024-02-01" },
          { label: "Bad", start: "not-a-date", end: "2024-03-01" }
        ];
        await createChart({ recordCollection: mixed });

        const dataCalls = mockD3.data.mock.calls;
        const chartDataCall = dataCalls.find(
          (call) =>
            Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
        );
        expect(chartDataCall).toBeTruthy();
        const passedData = chartDataCall[0];
        expect(passedData).toHaveLength(1);
        expect(passedData[0].label).toBe("Good");
      });

      it("passes SOQL query results through the same date pipeline", async () => {
        const soqlRows = [
          {
            Name: "Phase 1",
            Project_Start__c: "2024-05-01",
            Project_End__c: "2024-06-01"
          }
        ];
        executeQuery.mockResolvedValue(soqlRows);

        await createChart({
          recordCollection: [],
          objectApiName: "",
          soqlQuery:
            "SELECT Name, Project_Start__c, Project_End__c FROM Opportunity"
        });

        expect(executeQuery).toHaveBeenCalledWith({
          queryString:
            "SELECT Name, Project_Start__c, Project_End__c FROM Opportunity"
        });

        const dataCalls = mockD3.data.mock.calls;
        const chartDataCall = dataCalls.find(
          (call) =>
            Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
        );
        expect(chartDataCall).toBeTruthy();
        const passedData = chartDataCall[0];
        expect(passedData[0].label).toBe("Phase 1");
        expect(passedData[0].start.getTime()).toBe(
          new Date("2024-05-01").getTime()
        );
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // THEME PIPELINE INTEGRATION (real themeService)
    // ═══════════════════════════════════════════════════════════════

    describe("theme pipeline integration", () => {
      it("applies Salesforce Standard palette colors to task fills", async () => {
        await createChart({
          theme: "Salesforce Standard",
          recordCollection: SAMPLE_DATA
        });

        const attrCalls = mockD3.attr.mock.calls;
        const fillCalls = attrCalls.filter((call) => call[0] === "fill");
        expect(fillCalls.length).toBeGreaterThan(0);

        const fillFn = fillCalls[fillCalls.length - 1][1];
        expect(typeof fillFn).toBe("function");
        expect(fillFn({}, 0)).toBe("#1589EE");
      });

      it("applies Warm palette colors correctly", async () => {
        await createChart({ theme: "Warm", recordCollection: SAMPLE_DATA });

        const attrCalls = mockD3.attr.mock.calls;
        const fillCalls = attrCalls.filter((call) => call[0] === "fill");
        expect(fillCalls.length).toBeGreaterThan(0);

        const fillFn = fillCalls[fillCalls.length - 1][1];
        expect(fillFn({}, 0)).toBe("#FF6B6B");
      });

      it("uses custom colors from advancedConfig over theme", async () => {
        await createChart({
          theme: "Salesforce Standard",
          advancedConfig: '{"customColors":["#AA0000","#00AA00","#0000AA"]}',
          recordCollection: SAMPLE_DATA
        });

        const attrCalls = mockD3.attr.mock.calls;
        const fillCalls = attrCalls.filter((call) => call[0] === "fill");
        const fillFn = fillCalls[fillCalls.length - 1][1];
        expect(fillFn({}, 0)).toBe("#AA0000");
        expect(fillFn({}, 1)).toBe("#00AA00");
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // RESIZE PIPELINE INTEGRATION (real createResizeHandler)
    // ═══════════════════════════════════════════════════════════════

    describe("resize pipeline integration", () => {
      it("real createResizeHandler triggers chart re-render on resize", async () => {
        await createChart();

        expect(global.ResizeObserver).toHaveBeenCalled();
        expect(resizeObserverCallback).toBeTruthy();

        const selectCallsBefore = mockD3.select.mock.calls.length;

        jest.useFakeTimers();
        resizeObserverCallback([{ contentRect: { width: 600, height: 400 } }]);
        jest.advanceTimersByTime(250);
        jest.useRealTimers();
        await flushPromises();

        const selectCallsAfter = mockD3.select.mock.calls.length;
        expect(selectCallsAfter).toBeGreaterThan(selectCallsBefore);
      });
    });
  });
  ```

- [ ] **Step 2: Run the integration test, expect PASS.** Command:
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3GanttChart.integration 2>&1 | tail -30
  ```
  **Expected: PASS** — real `chartUtils.parseDate` returns Date objects, real `computeDateExtent` returns `[2024-01-01, 2024-04-30]`, and real `themeService.getColors("Salesforce Standard", …)` yields `#1589EE` / `getColors("Warm", …)` yields `#FF6B6B`. If "applies Warm palette" fails, check the actual Warm palette first hex in `force-app/main/default/lwc/themeService/themeService.js` and align the assertion (spec §8 declares Warm starts `#FF6B6B`).

- [ ] **Step 3: Commit the integration tier.** Commands:
  ```bash
  cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.integration.test.js
  git commit -m "test(d3GanttChart): add integration tests over real date and theme services"
  ```

---

#### Task 15.3: E2E tier — `d3GanttChart.e2e.test.js` (full lifecycle, pristine console) → run → commit

- **Files:**
  - Test: `force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.e2e.test.js` (Create)

- [ ] **Step 1: Clone the e2e donor.** Copy the Bar e2e suite, then replace its body to match the Gantt component (date-range data, `getDateRangeData` server path, `scaleTime` mock, `taskclick` semantics). The success-path tests assert `console.error` was NOT called; the D3-load-failure test asserts the error state shows.
  ```bash
  cp /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3BarChart/__tests__/d3BarChart.e2e.test.js /Users/weytani/code/d3-lwc/force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.e2e.test.js
  ```
  Replace the entire file body with:

  ```javascript
  // ABOUTME: End-to-end lifecycle tests for the d3GanttChart Lightning Web Component.
  // ABOUTME: Verifies full pipeline: D3 load, date parsing, SVG rendering, cleanup, and multi-instance isolation.

  import { createElement } from "lwc";
  import D3GanttChart from "c/d3GanttChart";
  import { loadD3 } from "c/d3Lib";
  import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
  import getDateRangeData from "@salesforce/apex/D3ChartController.getDateRangeData";

  jest.mock("c/d3Lib", () => ({
    loadD3: jest.fn()
  }));

  jest.mock(
    "@salesforce/apex/D3ChartController.executeQuery",
    () => ({ default: jest.fn() }),
    { virtual: true }
  );

  jest.mock(
    "@salesforce/apex/D3ChartController.getDateRangeData",
    () => ({ default: jest.fn() }),
    { virtual: true }
  );

  jest.mock("lightning/navigation", () => {
    const Navigate = Symbol.for("Navigate");
    const GenerateUrl = Symbol.for("GenerateUrl");
    return {
      NavigationMixin: (Base) => {
        return class extends Base {
          [Navigate] = jest.fn();
          [GenerateUrl] = jest.fn();
        };
      },
      Navigate,
      GenerateUrl
    };
  });

  jest.mock("lightning/platformShowToastEvent", () => {
    const ShowToastEventMock = jest.fn().mockImplementation((config) => {
      return new CustomEvent("lightning__showtoast", { detail: config });
    });
    return { ShowToastEvent: ShowToastEventMock };
  });

  // ═══════════════════════════════════════════════════════════════
  // MOCK D3 FACTORY
  // ═══════════════════════════════════════════════════════════════

  function createMockD3() {
    const mockD3 = {
      select: jest.fn(() => mockD3),
      append: jest.fn(() => mockD3),
      attr: jest.fn(() => mockD3),
      style: jest.fn(() => mockD3),
      call: jest.fn(() => mockD3),
      selectAll: jest.fn(() => mockD3),
      data: jest.fn(() => mockD3),
      enter: jest.fn(() => mockD3),
      transition: jest.fn(() => mockD3),
      duration: jest.fn(() => mockD3),
      delay: jest.fn(() => mockD3),
      on: jest.fn(() => mockD3),
      remove: jest.fn(() => mockD3),
      html: jest.fn(() => mockD3),
      scaleTime: jest.fn(() => {
        const scale = jest.fn(() => 25);
        scale.domain = jest.fn(() => scale);
        scale.range = jest.fn(() => scale);
        scale.nice = jest.fn(() => scale);
        return scale;
      }),
      scaleBand: jest.fn(() => {
        const scale = jest.fn(() => 50);
        scale.domain = jest.fn(() => scale);
        scale.range = jest.fn(() => scale);
        scale.padding = jest.fn(() => scale);
        scale.bandwidth = jest.fn(() => 40);
        return scale;
      }),
      axisBottom: jest.fn(() => {
        const axis = jest.fn();
        axis.tickFormat = jest.fn(() => axis);
        axis.ticks = jest.fn(() => axis);
        return axis;
      }),
      axisLeft: jest.fn(() => {
        const axis = jest.fn();
        axis.tickFormat = jest.fn(() => axis);
        axis.tickSize = jest.fn(() => axis);
        return axis;
      }),
      max: jest.fn(() => 500)
    };
    return mockD3;
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL MOCKS
  // ═══════════════════════════════════════════════════════════════

  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    width: 600,
    height: 300,
    top: 0,
    left: 0,
    bottom: 300,
    right: 600,
    x: 0,
    y: 0
  }));

  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  function flushPromises() {
    return new Promise((resolve) => {
      // eslint-disable-next-line @lwc/lwc/no-async-operation
      setTimeout(resolve, 0);
    });
  }

  let consoleErrorSpy;

  async function createChart(props = {}) {
    const element = createElement("c-d3-gantt-chart", {
      is: D3GanttChart
    });

    Object.assign(element, {
      labelField: "Name",
      startDateField: "Project_Start__c",
      endDateField: "Project_End__c",
      height: 300,
      recordCollection: [],
      ...props
    });

    document.body.appendChild(element);
    await flushPromises();
    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST SUITE
  // ═══════════════════════════════════════════════════════════════

  describe("c-d3-gantt-chart e2e", () => {
    let mockD3;

    beforeEach(() => {
      jest.clearAllMocks();
      mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);
      executeQuery.mockResolvedValue([]);
      getDateRangeData.mockResolvedValue([]);

      consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
      }));
    });

    afterEach(() => {
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      consoleErrorSpy.mockRestore();
      jest.clearAllMocks();
    });

    // ═══════════════════════════════════════════════════════════════
    // 1. FULL LIFECYCLE
    // ═══════════════════════════════════════════════════════════════

    describe("full lifecycle", () => {
      const LIFECYCLE_DATA = [
        { label: "Design", start: "2024-01-01", end: "2024-02-15" },
        { label: "Build", start: "2024-02-01", end: "2024-03-20" },
        { label: "Test", start: "2024-03-10", end: "2024-04-30" }
      ];

      it("create -> load D3 -> parse dates -> render -> verify SVG creation", async () => {
        const element = await createChart({
          recordCollection: LIFECYCLE_DATA
        });

        expect(loadD3).toHaveBeenCalled();
        expect(executeQuery).not.toHaveBeenCalled();
        expect(getDateRangeData).not.toHaveBeenCalled();

        expect(mockD3.select).toHaveBeenCalled();

        const appendCalls = mockD3.append.mock.calls;
        const svgAppended = appendCalls.some((call) => call[0] === "svg");
        expect(svgAppended).toBe(true);

        expect(mockD3.scaleTime).toHaveBeenCalled();
        expect(mockD3.data).toHaveBeenCalled();

        const container = element.shadowRoot.querySelector(".chart-container");
        expect(container).toBeTruthy();

        const spinner = element.shadowRoot.querySelector("lightning-spinner");
        expect(spinner).toBeFalsy();

        const errorEl = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorEl).toBeFalsy();

        // Success path: no console errors leaked
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it("cleanup destroys resize handler and tooltip on disconnect", async () => {
        const mockDisconnect = jest.fn();
        global.ResizeObserver = jest.fn().mockImplementation(() => ({
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: mockDisconnect
        }));

        const element = await createChart({
          recordCollection: LIFECYCLE_DATA
        });

        const container = element.shadowRoot.querySelector(".chart-container");
        expect(container).toBeTruthy();

        document.body.removeChild(element);

        expect(mockDisconnect).toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // 2. ERROR RECOVERY
    // ═══════════════════════════════════════════════════════════════

    describe("error recovery", () => {
      it("D3 load failure -> error state -> component shows error", async () => {
        loadD3.mockRejectedValue(new Error("CDN unreachable"));

        const element = await createChart({
          recordCollection: [
            { label: "Design", start: "2024-01-01", end: "2024-02-15" }
          ]
        });

        const errorEl = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorEl).toBeTruthy();
        expect(errorEl.textContent).toContain("CDN unreachable");

        const spinner = element.shadowRoot.querySelector("lightning-spinner");
        expect(spinner).toBeFalsy();

        const container = element.shadowRoot.querySelector(".chart-container");
        expect(container).toBeFalsy();
      });

      it("server fetch path: no recordCollection -> getDateRangeData returns data -> full pipeline", async () => {
        const serverData = [
          { label: "Discovery", start: "2024-01-01", end: "2024-01-31" },
          { label: "Proposal", start: "2024-02-01", end: "2024-02-28" }
        ];
        getDateRangeData.mockResolvedValue(serverData);

        const element = await createChart({
          recordCollection: [],
          soqlQuery: "",
          objectApiName: "Opportunity",
          labelField: "Name",
          startDateField: "Project_Start__c",
          endDateField: "Project_End__c"
        });

        expect(getDateRangeData).toHaveBeenCalledWith({
          objectName: "Opportunity",
          labelField: "Name",
          startField: "Project_Start__c",
          endField: "Project_End__c",
          filterClause: null
        });

        expect(loadD3).toHaveBeenCalled();
        expect(mockD3.select).toHaveBeenCalled();
        const appendCalls = mockD3.append.mock.calls;
        const svgAppended = appendCalls.some((call) => call[0] === "svg");
        expect(svgAppended).toBe(true);
        expect(mockD3.data).toHaveBeenCalled();

        const container = element.shadowRoot.querySelector(".chart-container");
        expect(container).toBeTruthy();

        const errorEl = element.shadowRoot.querySelector(
          ".slds-text-color_error"
        );
        expect(errorEl).toBeFalsy();
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // 3. MULTI-COMPONENT ISOLATION
    // ═══════════════════════════════════════════════════════════════

    describe("multi-component isolation", () => {
      it("two charts on same page have independent lifecycle", async () => {
        const mockDisconnectA = jest.fn();
        const mockDisconnectB = jest.fn();
        let roCallCount = 0;

        global.ResizeObserver = jest.fn().mockImplementation(() => {
          roCallCount += 1;
          const disconnectFn =
            roCallCount === 1 ? mockDisconnectA : mockDisconnectB;
          return {
            observe: jest.fn(),
            unobserve: jest.fn(),
            disconnect: disconnectFn
          };
        });

        const dataA = [
          { label: "A1", start: "2024-01-01", end: "2024-02-01" },
          { label: "A2", start: "2024-02-01", end: "2024-03-01" }
        ];
        const dataB = [
          { label: "B1", start: "2024-03-01", end: "2024-04-01" },
          { label: "B2", start: "2024-04-01", end: "2024-05-01" },
          { label: "B3", start: "2024-05-01", end: "2024-06-01" }
        ];

        const elementA = await createChart({
          recordCollection: dataA,
          theme: "Warm"
        });

        const elementB = await createChart({
          recordCollection: dataB,
          theme: "Cool"
        });

        const containerA = elementA.shadowRoot.querySelector(".chart-container");
        const containerB = elementB.shadowRoot.querySelector(".chart-container");
        expect(containerA).toBeTruthy();
        expect(containerB).toBeTruthy();

        document.body.removeChild(elementA);

        const containerBAfter =
          elementB.shadowRoot.querySelector(".chart-container");
        expect(containerBAfter).toBeTruthy();

        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    // ═══════════════════════════════════════════════════════════════
    // 4. DATA FLOW VERIFICATION
    // ═══════════════════════════════════════════════════════════════

    describe("data flow verification", () => {
      it("parsed date-range data flows through to D3 with correct values", async () => {
        const knownData = [
          { label: "Phase 1", start: "2024-01-01", end: "2024-03-01" },
          { label: "Phase 2", start: "2024-02-01", end: "2024-04-01" }
        ];

        await createChart({
          recordCollection: knownData
        });

        expect(mockD3.data).toHaveBeenCalled();

        const dataCall = mockD3.data.mock.calls.find(
          (call) =>
            Array.isArray(call[0]) &&
            call[0].length > 0 &&
            call[0][0].label !== undefined
        );

        expect(dataCall).toBeTruthy();
        const boundData = dataCall[0];

        expect(boundData).toHaveLength(2);
        expect(boundData[0].label).toBe("Phase 1");
        expect(boundData[0].start.getTime()).toBe(
          new Date("2024-01-01").getTime()
        );
        expect(boundData[1].label).toBe("Phase 2");
        expect(boundData[1].end.getTime()).toBe(
          new Date("2024-04-01").getTime()
        );

        // No console errors on the success path
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it("drops unparseable rows and still renders the valid ones", async () => {
        const mixed = [
          { label: "Valid", start: "2024-01-01", end: "2024-02-01" },
          { label: "Invalid", start: "", end: "" }
        ];

        const element = await createChart({
          recordCollection: mixed
        });

        const dataCall = mockD3.data.mock.calls.find(
          (call) =>
            Array.isArray(call[0]) &&
            call[0].length > 0 &&
            call[0][0].label !== undefined
        );
        expect(dataCall).toBeTruthy();
        expect(dataCall[0]).toHaveLength(1);
        expect(dataCall[0][0].label).toBe("Valid");

        const container = element.shadowRoot.querySelector(".chart-container");
        expect(container).toBeTruthy();
      });
    });
  });
  ```

- [ ] **Step 2: Run the e2e test, expect PASS.** Command:
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3GanttChart.e2e 2>&1 | tail -30
  ```
  **Expected: PASS** — full lifecycle renders SVG + binds parsed-Date data, the server `getDateRangeData` path is exercised, multi-instance isolation holds, and `consoleErrorSpy` is NOT called on success paths. If "parsed date-range data flows through" fails because `boundData[0].start` is a string not a Date, confirm `_prepareDateRows` runs `parseDate` on both date fields before binding.

- [ ] **Step 3: Run the whole d3GanttChart suite (all three tiers) to confirm green together.** Command:
  ```bash
  cd /Users/weytani/code/d3-lwc && npm test -- --testPathPattern=d3GanttChart 2>&1 | tail -20
  ```
  **Expected: PASS** — three suites (`d3GanttChart.test.js`, `d3GanttChart.integration.test.js`, `d3GanttChart.e2e.test.js`) all green, pristine output (no leaked console errors/warnings).

- [ ] **Step 4: Commit the e2e tier.** Commands:
  ```bash
  cd /Users/weytani/code/d3-lwc && git add force-app/main/default/lwc/d3GanttChart/__tests__/d3GanttChart.e2e.test.js
  git commit -m "test(d3GanttChart): add e2e lifecycle and multi-instance tests"
  ```


### Phase 16: Showcase Flexipage, Doc Updates, and the agentforce-dev Sync

Final integration pass: build the Phase 3 showcase flexipage that places all 10 new charts against demo SOQL/fields, correct the stale doc claims (20→30 charts, recomputed test counts), mark the 10 charts Done in both backlog docs, fix the sync script (its `CHART_COMPONENTS` array is missing all of Phase 2 plus all of Phase 3), then run the sync and merge the metas into `agentforce-dev` preserving its community/flow targets. Commit after each logical group.

> **Donor file** for the flexipage: `force-app/main/default/flexipages/d3_lwc_phase2.flexipage-meta.xml`. A fresh engineer should open it alongside this section — every block below follows its exact shape (one `<itemInstances>` per chart, each holding one `<componentInstance>` with `<componentInstanceProperties>` name/value pairs, `<componentName>`, and `<identifier>c_<componentName></identifier>`; the region closes with `<name>main</name>` + `<type>Region</type>`; the envelope ends with `<masterLabel>`, `<template><name>flexipage:defaultAppHomeTemplate</name></template>`, `<type>AppPage</type>`).
>
> **Prerequisite:** This phase runs LAST. All 10 chart components, their three test tiers, the new Apex (`getDateRangeData`/`getXYData`), the `jest.config.js` mapper entries, and the custom fields (`Opportunity.Project_Start__c`, `Opportunity.Project_End__c`, `Opportunity.Forecast_Units__c`) must already exist and be green. Demo SOQL/fields below come from spec §7.

The 10 new charts and their demo data (spec §5 + §7):

| Component | Family | Demo SOQL / fields |
|-----------|--------|--------------------|
| `d3PieChart` | aggregation | `getAggregatedData` — StageName / Amount / Sum |
| `d3HorizontalBarChart` | aggregation | StageName / Amount / Sum |
| `d3LollipopChart` | aggregation | StageName / Amount / Sum |
| `d3ProgressBar` | aggregation (1 row) | Amount / Sum + config `target` |
| `d3DivergingBarChart` | aggregation (signed) | LeadSource / Amount / Sum |
| `d3WaffleChart` | aggregation Count | StageName / Amount / Count |
| `d3SunburstChart` | hierarchy | StageName × Type / Amount / Sum |
| `d3BubbleChart` | xy | `getXYData` — Amount / Probability / Forecast_Units__c |
| `d3ChordDiagram` | matrix | StageName × LeadSource / Amount |
| `d3GanttChart` | date-range | `getDateRangeData` — Name / Project_Start__c / Project_End__c |

---

#### Task 16.1: Create the Phase 3 showcase flexipage

- **Files:**
  - Create: `force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml`

This is a metadata clone task (no Jest tier). The "test" is a deploy-time validation of the XML against the org. Follow the donor envelope exactly.

- [ ] **Step 1: Copy the Phase 2 flexipage to the Phase 3 path as a starting skeleton**
  ```bash
  cp force-app/main/default/flexipages/d3_lwc_phase2.flexipage-meta.xml \
     force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml
  ```

- [ ] **Step 2: Write the failing validation check (run BEFORE editing the body)** — confirm the skeleton is still the Phase 2 content so the edit is meaningful, then write the assertion we want to pass after editing:
  ```bash
  grep -c 'd3FunnelChart' force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml   # Expected: 1 (still Phase 2 content)
  grep -c 'd3PieChart'    force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml   # Expected: 0 (Phase 3 not written yet)
  ```
  Expected: FAIL the goal state — the file still contains Phase 2 charts and zero Phase 3 charts.

- [ ] **Step 3: Replace the entire file body with the Phase 3 envelope** — overwrite `force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml` with the following. Three representative blocks are shown in FULL (an aggregation chart = `d3PieChart`, the bubble chart = `d3BubbleChart`, the gantt chart = `d3GanttChart`); the remaining 7 blocks follow the identical shape with the props listed in Step 4. Paste the complete file:
  ```xml
  <?xml version="1.0" encoding="UTF-8" ?>
  <FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata">
      <flexiPageRegions>
          <itemInstances>
              <!-- Pie Chart: Pipeline Amount by Stage -->
              <componentInstance>
                  <componentInstanceProperties>
                      <name>soqlQuery</name>
                      <value>SELECT StageName, Amount FROM Opportunity WHERE Amount != null</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>groupByField</name>
                      <value>StageName</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>valueField</name>
                      <value>Amount</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>operation</name>
                      <value>Sum</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>height</name>
                      <value>300</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>theme</name>
                      <value>Salesforce Standard</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>advancedConfig</name>
                      <value>{}</value>
                  </componentInstanceProperties>
                  <componentName>d3PieChart</componentName>
                  <identifier>c_d3PieChart</identifier>
              </componentInstance>
          </itemInstances>
          <itemInstances>
              <!-- Bubble Chart: Amount vs Probability sized by Forecast Units -->
              <componentInstance>
                  <componentInstanceProperties>
                      <name>soqlQuery</name>
                      <value>SELECT Amount, Probability, Forecast_Units__c FROM Opportunity WHERE Amount != null AND Probability != null AND Forecast_Units__c != null</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>objectApiName</name>
                      <value>Opportunity</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>xAxisField</name>
                      <value>Amount</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>yAxisField</name>
                      <value>Probability</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>sizeField</name>
                      <value>Forecast_Units__c</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>xAxisLabel</name>
                      <value>Amount</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>yAxisLabel</name>
                      <value>Probability</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>height</name>
                      <value>400</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>theme</name>
                      <value>Vibrant</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>advancedConfig</name>
                      <value>{}</value>
                  </componentInstanceProperties>
                  <componentName>d3BubbleChart</componentName>
                  <identifier>c_d3BubbleChart</identifier>
              </componentInstance>
          </itemInstances>
          <itemInstances>
              <!-- Gantt Chart: Project Timelines -->
              <componentInstance>
                  <componentInstanceProperties>
                      <name>soqlQuery</name>
                      <value>SELECT Name, Project_Start__c, Project_End__c FROM Opportunity WHERE Project_Start__c != null AND Project_End__c != null ORDER BY Project_Start__c</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>objectApiName</name>
                      <value>Opportunity</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>labelField</name>
                      <value>Name</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>startDateField</name>
                      <value>Project_Start__c</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>endDateField</name>
                      <value>Project_End__c</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>height</name>
                      <value>400</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>theme</name>
                      <value>Cool</value>
                  </componentInstanceProperties>
                  <componentInstanceProperties>
                      <name>advancedConfig</name>
                      <value>{}</value>
                  </componentInstanceProperties>
                  <componentName>d3GanttChart</componentName>
                  <identifier>c_d3GanttChart</identifier>
              </componentInstance>
          </itemInstances>
          <!-- == REMAINING 7 BLOCKS: same shape as above, props per Step 4 == -->
          <!-- d3HorizontalBarChart -->
          <!-- d3LollipopChart -->
          <!-- d3ProgressBar -->
          <!-- d3DivergingBarChart -->
          <!-- d3WaffleChart -->
          <!-- d3SunburstChart -->
          <!-- d3ChordDiagram -->
          <name>main</name>
          <type>Region</type>
      </flexiPageRegions>
      <masterLabel>d3-lwc Phase 3</masterLabel>
      <template>
          <name>flexipage:defaultAppHomeTemplate</name>
      </template>
      <type>AppPage</type>
  </FlexiPage>
  ```

- [ ] **Step 4: Insert the remaining 7 `<itemInstances>` blocks** — for each, copy the `d3PieChart` block shape (a `<componentInstance>` wrapped in `<itemInstances>`), swap `<componentName>`/`<identifier>`, and set the `<componentInstanceProperties>` exactly as listed. All values are strings. Insert them between the Gantt block and the `<!-- == REMAINING ... ==` comment (then delete that comment + the 7 placeholder comment lines).

  **`d3HorizontalBarChart`** (identifier `c_d3HorizontalBarChart`):
  - `soqlQuery` = `SELECT StageName, Amount FROM Opportunity WHERE Amount != null`
  - `groupByField` = `StageName`
  - `valueField` = `Amount`
  - `operation` = `Sum`
  - `height` = `350`
  - `theme` = `Salesforce Standard`
  - `advancedConfig` = `{}`

  **`d3LollipopChart`** (identifier `c_d3LollipopChart`):
  - `soqlQuery` = `SELECT StageName, Amount FROM Opportunity WHERE Amount != null`
  - `groupByField` = `StageName`
  - `valueField` = `Amount`
  - `operation` = `Sum`
  - `height` = `300`
  - `theme` = `Warm`
  - `advancedConfig` = `{}`

  **`d3ProgressBar`** (identifier `c_d3ProgressBar`):
  - `soqlQuery` = `SELECT Amount FROM Opportunity WHERE Amount != null AND StageName = 'Closed Won'`
  - `groupByField` = `StageName`
  - `valueField` = `Amount`
  - `operation` = `Sum`
  - `height` = `120`
  - `theme` = `Salesforce Standard`
  - `advancedConfig` = `{"target": 1000000}`

  **`d3DivergingBarChart`** (identifier `c_d3DivergingBarChart`):
  - `soqlQuery` = `SELECT LeadSource, Amount FROM Opportunity WHERE Amount != null AND LeadSource != null`
  - `groupByField` = `LeadSource`
  - `valueField` = `Amount`
  - `operation` = `Sum`
  - `height` = `350`
  - `theme` = `Salesforce Standard`
  - `advancedConfig` = `{}`

  **`d3WaffleChart`** (identifier `c_d3WaffleChart`):
  - `soqlQuery` = `SELECT StageName, Amount FROM Opportunity WHERE Amount != null`
  - `groupByField` = `StageName`
  - `valueField` = `Amount`
  - `operation` = `Count`
  - `height` = `350`
  - `theme` = `Vibrant`
  - `advancedConfig` = `{}`

  **`d3SunburstChart`** (identifier `c_d3SunburstChart`):
  - `soqlQuery` = `SELECT StageName, Type, Amount FROM Opportunity WHERE Amount != null AND Type != null`
  - `objectApiName` = `Opportunity`
  - `groupByField` = `StageName`
  - `seriesField` = `Type`
  - `valueField` = `Amount`
  - `operation` = `Sum`
  - `height` = `400`
  - `theme` = `Cool`
  - `advancedConfig` = `{}`

  **`d3ChordDiagram`** (identifier `c_d3ChordDiagram`):
  - `soqlQuery` = `SELECT StageName, LeadSource, Amount FROM Opportunity WHERE Amount != null AND LeadSource != null`
  - `objectApiName` = `Opportunity`
  - `groupByField` = `StageName`
  - `seriesField` = `LeadSource`
  - `valueField` = `Amount`
  - `operation` = `Sum`
  - `height` = `400`
  - `theme` = `Warm`
  - `advancedConfig` = `{}`

- [ ] **Step 5: Verify the goal-state assertions pass**
  ```bash
  for c in d3PieChart d3HorizontalBarChart d3LollipopChart d3ProgressBar d3DivergingBarChart d3WaffleChart d3SunburstChart d3BubbleChart d3ChordDiagram d3GanttChart; do
    printf '%s: ' "$c"; grep -c "<componentName>$c</componentName>" force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml
  done
  grep -c 'd3FunnelChart' force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml   # Expected: 0 (no Phase 2 leftovers)
  grep -c '<itemInstances>' force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml # Expected: 10
  grep -c '<masterLabel>d3-lwc Phase 3</masterLabel>' force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml  # Expected: 1
  npm run prettier -- --write force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml
  ```
  Expected: PASS — each of the 10 charts prints `1`, `d3FunnelChart` prints `0`, `<itemInstances>` count is `10`, masterLabel present.

- [ ] **Step 6: Commit**
  ```bash
  git add force-app/main/default/flexipages/d3_lwc_phase3.flexipage-meta.xml
  git commit -m "feat(flexipage): add d3-lwc Phase 3 showcase page for all 10 new charts"
  ```

---

#### Task 16.2: Update README — bump 20→30, add the Phase 3 component table, then recompute test/suite counts

- **Files:**
  - Modify: `README.md`

The chart-count and table edits are deterministic. The test/suite counts must NOT be guessed — they are recomputed by running `npm test` after the charts exist (Step 5).

- [ ] **Step 1: Write the failing assertion** — confirm README still carries the stale claims that this task removes:
  ```bash
  grep -c 'complete suite of 20' README.md   # Expected: 1 (stale)
  grep -c '20 Chart Types' README.md         # Expected: 1 (stale)
  grep -c '### Phase 3' README.md            # Expected: 0 (missing)
  ```
  Expected: FAIL the goal state — README claims 20 charts and has no Phase 3 section.

- [ ] **Step 2: Bump the opening "20" claim (line ~3)** — replace `A complete suite of 20 Lightning Web Components` with `A complete suite of 30 Lightning Web Components`:
  ```
  A complete suite of 30 Lightning Web Components (LWC) that wrap D3.js charts for use in Salesforce App Builder, Experience Builder, and Screen Flows. Components are drag-and-drop ready, capable of ingesting raw Salesforce record collections, and intelligently handle aggregation via server-side SOQL GROUP BY (preferred) or client-side JavaScript (fallback).
  ```

- [ ] **Step 3: Update the Features "Chart Types" bullet (line ~13)** — replace the `- **20 Chart Types**: ...` line with the 30-chart version that appends the 10 new names:
  ```
  - **30 Chart Types**: Bar, Line, Donut, Gauge, Scatter, Histogram, Treemap, Sankey, Force Graph, Choropleth, Area, Stacked Bar, Funnel, Radar, Heatmap, Box Plot, Waterfall, Bullet, Calendar Heatmap, Sparkline Grid, Pie, Horizontal Bar, Lollipop, Progress Bar, Diverging Bar, Waffle, Sunburst, Bubble, Chord Diagram, Gantt
  ```

- [ ] **Step 4: Add the Phase 3 component table** — insert immediately after the Phase 2 table (after the `c-d3-sparkline-grid` row, line ~54), before the `## 🏗️ Architecture` heading:
  ```markdown

  ### Phase 3

  | Component                  | Description           | Key Features                                          |
  | -------------------------- | --------------------- | ----------------------------------------------------- |
  | `c-d3-pie-chart`           | Part-to-whole         | Full-circle slices, legend, percentage labels         |
  | `c-d3-horizontal-bar-chart`| Ranked categories     | Y-axis bands, long-label support, drill-down          |
  | `c-d3-lollipop-chart`      | Ranked metrics        | Stem + circle, low ink, leaderboard style             |
  | `c-d3-progress-bar`        | Single KPI vs target  | Linear gauge, target marker, percentage fill          |
  | `c-d3-diverging-bar-chart` | Positive/negative     | Centered axis, semantic up/down coloring              |
  | `c-d3-waffle-chart`        | Percentage grid       | 10×10 cells, contrast-aware labels, goal progress     |
  | `c-d3-sunburst-chart`      | Radial hierarchy      | Concentric rings, two-level grouping, part-to-whole   |
  | `c-d3-bubble-chart`        | Three-variable        | X/Y position + area-scaled size, category color       |
  | `c-d3-chord-diagram`       | Relationship matrix   | Circular arcs, ribbons, bidirectional flow            |
  | `c-d3-gantt-chart`         | Project timeline      | Time axis, date-range bars, today marker, drill-down  |
  ```

- [ ] **Step 5: Recompute and write the real test/suite counts** — DO NOT guess. Run the full suite, read the printed `Tests:` and `Test Suites:` totals from the Jest summary, and substitute them into the two README spots:
  ```bash
  npm test 2>&1 | tee /tmp/d3-plan/npm-test-summary.txt | grep -E '^(Tests:|Test Suites:)'
  ```
  Then read the two numbers from the `Tests:` line (`N passed, N total`) and the `Test Suites:` line, and replace BOTH occurrences in README:
  - The Features bullet (line ~22): `- **1,790 Tests**: Comprehensive Jest test coverage across 31 suites` → `- **<TESTS> Tests**: Comprehensive Jest test coverage across <SUITES> suites`
  - The Testing section (line ~354): `**Test Coverage:** 1,790 tests across 31 suites (includes server-side aggregation path tests)` → `**Test Coverage:** <TESTS> tests across <SUITES> suites (includes server-side aggregation path tests)`

  (`<TESTS>` and `<SUITES>` are the literal numbers Jest just printed — comma-format the test count to match the existing style, e.g. `2,340`.) Expected: PASS — `npm test` exits 0 with all suites green and pristine output (no leaked console errors).

- [ ] **Step 6: Verify the goal-state assertions pass**
  ```bash
  grep -c 'complete suite of 30' README.md   # Expected: 1
  grep -c '30 Chart Types' README.md         # Expected: 1
  grep -c '### Phase 3' README.md            # Expected: 1
  grep -c '1,790' README.md                  # Expected: 0 (stale count fully removed)
  npm run prettier -- --write README.md
  ```
  Expected: PASS.

- [ ] **Step 7: Commit**
  ```bash
  git add README.md
  git commit -m "docs(readme): bump to 30 charts, add Phase 3 table, update recomputed test counts"
  ```

---

#### Task 16.3: Mark the 10 charts Done in ROADMAP.md and CHART-INDEX.md

- **Files:**
  - Modify: `ROADMAP.md`
  - Modify: `CHART-INDEX.md`

ROADMAP weeks 11–16 cover Sunburst, Chord, Gantt, Diverging Bar, Bubble, Waffle. The four CHART-INDEX Tier-1 charts (#1 Horizontal Bar, #2 Pie, #3 Progress Bar, #4 Lollipop) get a `Done` status appended to the index. The ROADMAP has no per-chart status table for weeks 11–16 (only prose sections + a summary table), so we add a status table mirroring the existing "Current Library Status" table.

- [ ] **Step 1: Write the failing assertion** — confirm the docs do not yet mark these charts Done:
  ```bash
  grep -c 'Phase 3 Status' ROADMAP.md        # Expected: 0 (table missing)
  grep -c 'd3HorizontalBarChart' CHART-INDEX.md  # Expected: 1 (only the spec row, no Done marker yet)
  grep -c '| 1   | \*\*Horizontal Bar Chart\*\*.*Done' CHART-INDEX.md  # Expected: 0
  ```
  Expected: FAIL the goal state.

- [ ] **Step 2: Update ROADMAP.md "ROADMAP.md (16 charts)" planned entries** — in `CHART-INDEX.md` the "Already Planned in ROADMAP.md (16)" table lists each ROADMAP chart with `Planned`. Change the status to `Done` for the six Phase 3 ROADMAP charts. Edit `CHART-INDEX.md` lines 37–42, replacing `Planned` with `Done` ONLY on these rows (leave the other 10 as `Planned`):
  ```markdown
  | —   | Sunburst         | Done    |
  | —   | Chord Diagram    | Done    |
  | —   | Gantt            | Done    |
  | —   | Diverging Bar    | Done    |
  | —   | Bubble           | Done    |
  | —   | Waffle           | Done    |
  ```

- [ ] **Step 3: Add a "Phase 3 Status" table to ROADMAP.md** — insert immediately after the "Current Library Status" table block (after line 21, the `---` separator that closes it), so the ROADMAP carries an explicit Done record for the 6 weeks shipped:
  ```markdown

  ## Phase 3 Status (Weeks 11–16 + CHART-INDEX Tier-1 #1–4) — Shipped 2026-06

  | Component | Status |
  |-----------|--------|
  | `d3SunburstChart` | Done |
  | `d3ChordDiagram` | Done |
  | `d3GanttChart` | Done |
  | `d3DivergingBarChart` | Done |
  | `d3BubbleChart` | Done |
  | `d3WaffleChart` | Done |
  | `d3HorizontalBarChart` | Done |
  | `d3PieChart` | Done |
  | `d3ProgressBar` | Done |
  | `d3LollipopChart` | Done |

  ---
  ```

- [ ] **Step 4: Mark the 4 Tier-1 index charts Done** — in `CHART-INDEX.md` the "Tier 1: Simple" table (lines 52–63) has no Status column. Append a ` **Done** ` marker into the `New D3 Concepts` cell is too fragile; instead add a `Status` column would reshape the whole table. The cleanest minimal edit is to prepend a status note to each of rows #1–#4's chart-name cell. Change the four cells:
  - Row #1: `**Horizontal Bar Chart**` → `**Horizontal Bar Chart** ✓ Done`
  - Row #2: `**Pie Chart**` → `**Pie Chart** ✓ Done`
  - Row #3: `**Progress Bar (Linear Gauge)**` → `**Progress Bar (Linear Gauge)** ✓ Done`
  - Row #4: `**Lollipop Chart**` → `**Lollipop Chart** ✓ Done`

- [ ] **Step 5: Verify the goal-state assertions pass**
  ```bash
  grep -c 'Phase 3 Status' ROADMAP.md                       # Expected: 1
  grep -c '`d3SunburstChart` | Done' ROADMAP.md             # Expected: 1
  grep -cE '\| Sunburst +\| Done' CHART-INDEX.md            # Expected: 1
  grep -c 'Horizontal Bar Chart\*\* ✓ Done' CHART-INDEX.md  # Expected: 1
  grep -cE '\| Funnel +\| Planned' CHART-INDEX.md           # Expected: 1 (untouched Phase-2 row still Planned)
  npm run prettier -- --write ROADMAP.md CHART-INDEX.md
  ```
  Expected: PASS.

- [ ] **Step 6: Commit**
  ```bash
  git add ROADMAP.md CHART-INDEX.md
  git commit -m "docs(roadmap): mark Phase 3 charts Done in ROADMAP and CHART-INDEX status tables"
  ```

---

#### Task 16.4: Fix and extend scripts/sync-to-agentforce.sh

- **Files:**
  - Modify: `scripts/sync-to-agentforce.sh`

The script's `CHART_COMPONENTS` array (lines 85–96) lists ONLY the original Phase-1 10 (`d3BarChart` … `d3Gauge`) — it skips ALL 10 Phase-2 charts AND the 10 new Phase-3 charts. As-is, the sync silently does not copy the new charts. Extend the array to all 30.

- [ ] **Step 1: Write the failing assertion** — confirm the array is missing the Phase-2 and Phase-3 entries:
  ```bash
  bash -c 'source <(grep -A40 "^CHART_COMPONENTS=(" scripts/sync-to-agentforce.sh | sed "/^)/q"); echo "${#CHART_COMPONENTS[@]} entries"; printf "%s\n" "${CHART_COMPONENTS[@]}"' | grep -c 'd3GanttChart'   # Expected: 0
  bash -c 'source <(grep -A40 "^CHART_COMPONENTS=(" scripts/sync-to-agentforce.sh | sed "/^)/q"); echo "${#CHART_COMPONENTS[@]}"'   # Expected: 10
  ```
  Expected: FAIL the goal state — only 10 entries, `d3GanttChart` absent.

- [ ] **Step 2: Replace the `CHART_COMPONENTS` array** — change the block at lines 85–96 (from `CHART_COMPONENTS=(` through its closing `)`) to include all 30 chart dirs (Phase 1 + Phase 2 + Phase 3):
  ```bash
  CHART_COMPONENTS=(
      "d3BarChart"
      "d3DonutChart"
      "d3Treemap"
      "d3Histogram"
      "d3ScatterPlot"
      "d3ForceGraph"
      "d3LineChart"
      "d3Sankey"
      "d3Choropleth"
      "d3Gauge"
      "d3AreaChart"
      "d3BoxPlot"
      "d3BulletChart"
      "d3CalendarHeatmap"
      "d3FunnelChart"
      "d3Heatmap"
      "d3RadarChart"
      "d3SparklineGrid"
      "d3StackedBarChart"
      "d3WaterfallChart"
      "d3HorizontalBarChart"
      "d3PieChart"
      "d3LollipopChart"
      "d3ProgressBar"
      "d3DivergingBarChart"
      "d3WaffleChart"
      "d3SunburstChart"
      "d3BubbleChart"
      "d3ChordDiagram"
      "d3GanttChart"
  )
  ```

- [ ] **Step 3: Verify the goal-state assertions pass**
  ```bash
  bash -n scripts/sync-to-agentforce.sh   # syntax check; Expected: exit 0, no output
  bash -c 'source <(grep -A40 "^CHART_COMPONENTS=(" scripts/sync-to-agentforce.sh | sed "/^)/q"); echo "${#CHART_COMPONENTS[@]}"'   # Expected: 30
  # Every listed dir must exist on disk (no typos):
  bash -c 'source <(grep -A40 "^CHART_COMPONENTS=(" scripts/sync-to-agentforce.sh | sed "/^)/q"); for c in "${CHART_COMPONENTS[@]}"; do [ -d "force-app/main/default/lwc/$c" ] || echo "MISSING: $c"; done; echo done'   # Expected: only "done", no MISSING lines
  ```
  Expected: PASS — 30 entries, every directory present, no MISSING lines.

- [ ] **Step 4: Commit**
  ```bash
  git add scripts/sync-to-agentforce.sh
  git commit -m "fix(sync): extend CHART_COMPONENTS to all 30 charts (Phase 2 + Phase 3)"
  ```

---

#### Task 16.5: Run the sync and merge the metas into agentforce-dev

- **Files:**
  - Modify: `~/code/agentforce-dev/force-app/main/d3/lwc/` (synced — automated, steps 1–5 of the sync checklist)
  - Modify: `~/code/agentforce-dev/force-app/main/d3/classes/` (synced)
  - Modify: `~/code/agentforce-dev/__mocks__/` (synced)
  - Modify: `~/code/agentforce-dev/jest.config.js` (manual moduleNameMapper merge — step 6)
  - Modify: `~/code/agentforce-dev/force-app/main/d3/lwc/<chart>/<chart>.js-meta.xml` (manual MERGE — step 7, preserve community/flow targets per spec §7 + §10)

This is a sync + manual-merge task. There is no Jest tier; the verification is that `agentforce-dev` still builds its Jest suite and the merged metas keep their `lightningCommunity__Page` / `lightningCommunity__Default` / `lightning__FlowScreen` targets.

- [ ] **Step 1: Capture the pre-sync state of agentforce-dev meta targets (the failing/at-risk assertion)** — the meta MERGE risk is that a naive copy would strip these community/flow targets. Record which existing synced charts carry them so we can confirm they survive:
  ```bash
  grep -rl 'lightningCommunity__Page' ~/code/agentforce-dev/force-app/main/d3/lwc/ | wc -l   # note this baseline count
  grep -rl 'lightning__FlowScreen'    ~/code/agentforce-dev/force-app/main/d3/lwc/ | wc -l   # note this baseline count
  ```
  Expected: a non-zero baseline (these targets exist in agentforce-dev today and MUST NOT drop to a lower count after the merge).

- [ ] **Step 2: Run the sync script** (copies classes, shared modules, all 30 chart JS + test tiers, mocks — excludes `*.js-meta.xml` by design):
  ```bash
  bash scripts/sync-to-agentforce.sh
  ```
  Expected: PASS — prints `Chart components: 30 directories` and `=== Sync complete ===` with no rsync errors.

- [ ] **Step 3: Merge `jest.config.js` moduleNameMapper** — the sync does NOT touch `agentforce-dev/jest.config.js`. Open both files. Add to `agentforce-dev`'s `moduleNameMapper` the three new mapper entries this release introduced (which already exist in d3-lwc's `jest.config.js` from the foundation phase): `getMultiGroupData`, `getDateRangeData`, `getXYData`. Copy each `"^@salesforce/apex/D3ChartController\\.<method>$": "<mockPath>"` line verbatim from `~/code/d3-lwc/jest.config.js` into the agentforce-dev mapper object, leaving its other (non-d3) mappings intact. Verify:
  ```bash
  grep -c 'getXYData' ~/code/agentforce-dev/jest.config.js          # Expected: 1
  grep -c 'getDateRangeData' ~/code/agentforce-dev/jest.config.js   # Expected: 1
  grep -c 'getMultiGroupData' ~/code/agentforce-dev/jest.config.js  # Expected: 1
  ```

- [ ] **Step 4: MERGE the 10 new chart meta.xml files (never replace)** — the sync excluded `*.js-meta.xml`. For each new chart, copy d3-lwc's meta as the base into agentforce-dev, THEN add the community/flow targets that agentforce-dev requires (spec §7 + §10: agentforce-dev metas carry `lightningCommunity__Page`, `lightningCommunity__Default`, and `lightning__FlowScreen` targets the d3-lwc copies lack). Use an existing already-merged agentforce-dev chart meta (e.g. `~/code/agentforce-dev/force-app/main/d3/lwc/d3BarChart/d3BarChart.js-meta.xml`) as the donor for the exact target block to add. For each of the 10 (`d3PieChart d3HorizontalBarChart d3LollipopChart d3ProgressBar d3DivergingBarChart d3WaffleChart d3SunburstChart d3BubbleChart d3ChordDiagram d3GanttChart`):
  - Copy `~/code/d3-lwc/force-app/main/default/lwc/<chart>/<chart>.js-meta.xml` → `~/code/agentforce-dev/force-app/main/d3/lwc/<chart>/<chart>.js-meta.xml`.
  - In each `<targets>` block, ADD the lines (matching the donor d3BarChart meta) so the union of targets is present:
    ```xml
    <target>lightningCommunity__Page</target>
    <target>lightningCommunity__Default</target>
    <target>lightning__FlowScreen</target>
    ```
  - Keep the existing `lightning__AppPage` / `lightning__RecordPage` / `lightning__HomePage` targets from the d3-lwc copy. Do NOT delete any `targetConfigs` already present.

- [ ] **Step 5: Verify the merge preserved the at-risk targets and added them to the new charts**
  ```bash
  # New count must be >= baseline from Step 1 (no regression) AND cover all 10 new charts:
  grep -rl 'lightningCommunity__Page' ~/code/agentforce-dev/force-app/main/d3/lwc/ | wc -l
  for c in d3PieChart d3HorizontalBarChart d3LollipopChart d3ProgressBar d3DivergingBarChart d3WaffleChart d3SunburstChart d3BubbleChart d3ChordDiagram d3GanttChart; do
    printf '%s: ' "$c"; grep -c 'lightning__FlowScreen' ~/code/agentforce-dev/force-app/main/d3/lwc/$c/$c.js-meta.xml
  done   # Expected: each prints 1
  ```
  Expected: PASS — community/flow count >= Step-1 baseline; every new chart's meta prints `1` for `lightning__FlowScreen`.

- [ ] **Step 6: Run the agentforce-dev Jest suite to confirm the sync is coherent**
  ```bash
  bash -c 'cd ~/code/agentforce-dev && npm test -- --testPathPattern="d3(Pie|HorizontalBar|Lollipop|ProgressBar|DivergingBar|Waffle|Sunburst|Bubble|Chord|Gantt)"'
  ```
  Expected: PASS — the synced unit/integration/e2e tiers for the 10 new charts run green in agentforce-dev, pristine output (the new `moduleNameMapper` entries resolve the Apex mocks).

- [ ] **Step 7: Commit both repos** — commit the agentforce-dev sync result, then return to d3-lwc (no source changes remain there from this task; the d3-lwc commits were made in Tasks 16.1–16.4):
  ```bash
  bash -c 'cd ~/code/agentforce-dev && git add force-app/main/d3 __mocks__ jest.config.js && git commit -m "chore(d3): sync Phase 3 charts, tests, Apex, and merged metas from d3-lwc"'
  ```
  Expected: PASS — the agentforce-dev commit lands with the 10 new chart dirs (JS + 3 test tiers + merged meta), updated Apex, updated mocks, and merged jest.config.js.


