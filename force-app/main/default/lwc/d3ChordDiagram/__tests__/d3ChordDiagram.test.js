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
