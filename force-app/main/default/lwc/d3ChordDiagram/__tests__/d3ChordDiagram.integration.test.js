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
    insert: jest.fn(() => d3),
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
// Distinct labels (source ∪ target), first-seen order: Prospecting, Web, Phone, Qualification, Closed Won (5)

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

      const grandTotal = matrix.flat().reduce((sum, v) => sum + v, 0);
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
      // The group-arc accessor reads d.index; the ribbon accessor reads
      // d.source.index and throws on a group object, so skip those.
      const chordFn = mockD3.chord.mock.results[0].value;
      const layout = chordFn.mock.results[0].value;
      const resolved = fillCalls
        .map((c) => c[1])
        .filter((v) => typeof v === "function")
        .flatMap((fn) =>
          layout.groups.map((g) => {
            try {
              return fn(g);
            } catch {
              return undefined;
            }
          })
        );

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
      // The group-arc accessor reads d.index; the ribbon accessor reads
      // d.source.index and throws on a group object, so skip those.
      const resolved = fillFns.flatMap((fn) =>
        layout.groups.map((g) => {
          try {
            return fn(g);
          } catch {
            return undefined;
          }
        })
      );

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
      // Distinct labels A, X, Y, B => 4x4
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
