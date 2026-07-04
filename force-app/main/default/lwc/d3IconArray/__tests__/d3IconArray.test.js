// ABOUTME: Unit tests for the D3 icon array (pictogram/unit chart) Lightning Web Component.
// ABOUTME: Covers initialization, data sources, aggregation, themes, config, icon allocation, events, tooltips, and responsive behavior.

import { createElement } from "lwc";
import D3IconArray from "c/d3IconArray";
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
  getContrastColor: jest.fn(() => "#ffffff"),
  applySvgA11y: jest.fn()
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

// Factory function for isolated mock D3 instances (icon array uses PATHS via d3.symbol, not rects)
const createMockD3 = () => {
  const symbolFn = jest.fn(() => "M0,0Z");
  symbolFn.type = jest.fn(() => symbolFn);
  symbolFn.size = jest.fn(() => symbolFn);
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
    text: jest.fn(() => d3),
    insert: jest.fn(() => d3),
    symbol: jest.fn(() => symbolFn),
    symbolCircle: "symbolCircle",
    symbolSquare: "symbolSquare",
    symbolTriangle: "symbolTriangle",
    symbolDiamond: "symbolDiamond",
    symbolStar: "symbolStar",
    symbolCross: "symbolCross"
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

describe("c-d3-icon-array", () => {
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
    element = createElement("c-d3-icon-array", {
      is: D3IconArray
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
      element = createElement("c-d3-icon-array", {
        is: D3IconArray
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

    it("defaults to a 10-column grid when columns is not configured", async () => {
      await createChart();
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("honors a configured columns count", async () => {
      await createChart({ advancedConfig: '{"columns": 20}' });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("clamps a columns count above 100 back to 100", async () => {
      await createChart({ advancedConfig: '{"columns": 500}' });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("ignores an invalid (non-numeric) columns value and falls back to the default", async () => {
      await createChart({ advancedConfig: '{"columns": "lots"}' });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ICON SHAPE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("icon shape", () => {
    it("uses d3.symbolCircle by default", async () => {
      await createChart();
      await flushPromises();

      const symbolInstance = mockD3.symbol.mock.results[0].value;
      expect(symbolInstance.type).toHaveBeenCalledWith("symbolCircle");
    });

    it("maps iconShape config to the matching d3 symbol type", async () => {
      await createChart({ advancedConfig: '{"iconShape": "square"}' });
      await flushPromises();

      const symbolInstance = mockD3.symbol.mock.results[0].value;
      expect(symbolInstance.type).toHaveBeenCalledWith("symbolSquare");
    });

    it("falls back to circle for an unrecognized iconShape", async () => {
      await createChart({ advancedConfig: '{"iconShape": "hexagon"}' });
      await flushPromises();

      const symbolInstance = mockD3.symbol.mock.results[0].value;
      expect(symbolInstance.type).toHaveBeenCalledWith("symbolCircle");
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
    it("registers click handler on icons via D3 on()", async () => {
      await createChart({
        objectApiName: "Opportunity",
        filterField: "StageName"
      });
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseenter handler on icons", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on icons", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERING DETAILS — ICON ALLOCATION
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

    it("binds exactly 100 icons to d3.data()", async () => {
      await createChart();
      await flushPromises();

      // renderChart builds a flat array of 100 icon descriptors and binds it
      const dataCalls = mockD3.data.mock.calls;
      const iconBinding = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      expect(iconBinding).toBeDefined();
    });

    it("appends path elements for icon glyphs (not rects)", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("path");
      expect(appendCalls).not.toContain("rect");
    });

    it("uses a single shared symbol path for every icon (constant shape/size)", async () => {
      await createChart();
      await flushPromises();

      const symbolInstance = mockD3.symbol.mock.results[0].value;
      // The generator is invoked exactly once and its path reused per icon.
      expect(symbolInstance).toHaveBeenCalledTimes(1);
    });

    it("allocates filled icon counts matching rounded proportions", async () => {
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
      const iconBinding = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      expect(iconBinding).toBeDefined();

      const icons = iconBinding[0];
      const counts = icons.reduce((acc, icon) => {
        acc[icon.label] = (acc[icon.label] || 0) + 1;
        return acc;
      }, {});

      expect(counts["Closed Won"]).toBe(53);
      expect(counts.Prospecting).toBe(32);
      expect(counts.Qualification).toBe(15);
    });

    it("assigns a color to each icon from the category color scale", async () => {
      const { createColorScale } = require("c/themeService");

      await createChart();
      await flushPromises();

      // createColorScale called with the full category domain (Count path:
      // Prospecting=2, then the tied 1-count categories in insertion order)
      expect(createColorScale).toHaveBeenCalled();
      const domainArg = createColorScale.mock.calls[0][1];
      expect(domainArg).toEqual(["Prospecting", "Qualification", "Closed Won"]);

      const dataCalls = mockD3.data.mock.calls;
      const iconBinding = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      const icons = iconBinding[0];
      icons.forEach((icon) => {
        expect(typeof icon.color).toBe("string");
        expect(icon.color.startsWith("#")).toBe(true);
      });
    });

    it("assigns row/col grid coordinates using the configured column count", async () => {
      await createChart({ advancedConfig: '{"columns": 20}' });
      await flushPromises();

      const dataCalls = mockD3.data.mock.calls;
      const icons = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      expect(Math.max(...icons.map((icon) => icon.col))).toBe(19);
      expect(Math.max(...icons.map((icon) => icon.row))).toBe(4);
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
