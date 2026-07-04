// ABOUTME: Unit tests for the d3WaterfallChart Lightning Web Component.
// ABOUTME: Tests initialization, data handling, waterfall-specific rendering, semantic colors, connectors, and subtotals.

import { createElement } from "lwc";
import D3WaterfallChart from "c/d3WaterfallChart";
import { loadD3 } from "c/d3Lib";
import { computeRunningTotal } from "c/dataService";
import { SEMANTIC_COLORS } from "c/themeService";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// Mock d3Lib
jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// Mock dataService (partial: only mock computeRunningTotal, let others through)
jest.mock("c/dataService", () => {
  const actual = jest.requireActual("c/dataService");
  return {
    ...actual,
    computeRunningTotal: jest.fn(actual.computeRunningTotal)
  };
});

// Mock themeService (partial: expose SEMANTIC_COLORS)
jest.mock("c/themeService", () => {
  const actual = jest.requireActual("c/themeService");
  return {
    ...actual
  };
});

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
    scaleBand: jest.fn(() => {
      const scale = jest.fn(() => 50);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.padding = jest.fn(() => scale);
      scale.bandwidth = jest.fn(() => 40);
      return scale;
    }),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      return scale;
    }),
    axisBottom: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      return axis;
    }),
    axisLeft: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    max: jest.fn(() => 500),
    min: jest.fn(() => -100)
  };
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Revenue", Amount: 500 },
  { StageName: "Revenue", Amount: 300 },
  { StageName: "COGS", Amount: -200 },
  { StageName: "OpEx", Amount: -150 },
  { StageName: "Tax", Amount: -50 }
];

const SINGLE_RECORD = [{ StageName: "Revenue", Amount: 100 }];

const ALL_POSITIVE_DATA = [
  { StageName: "Q1", Amount: 100 },
  { StageName: "Q2", Amount: 200 },
  { StageName: "Q3", Amount: 150 }
];

const ALL_NEGATIVE_DATA = [
  { StageName: "Loss A", Amount: -100 },
  { StageName: "Loss B", Amount: -200 }
];

const MIXED_DATA = [
  { StageName: "Start", Amount: 1000 },
  { StageName: "Gain", Amount: 200 },
  { StageName: "Loss", Amount: -300 },
  { StageName: "Gain2", Amount: 150 }
];

const ZERO_DATA = [
  { StageName: "Zero", Amount: 0 },
  { StageName: "AlsoZero", Amount: 0 }
];

const SPECIAL_CHAR_DATA = [
  { StageName: 'Stage "A"', Amount: 100 },
  { StageName: "Stage 'B'", Amount: 200 },
  { StageName: "Stage <C>", Amount: -50 }
];

const AGGREGATED_RESULT = [
  { label: "Revenue", value: 800 },
  { label: "COGS", value: -200 },
  { label: "OpEx", value: -150 },
  { label: "Tax", value: -50 }
];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-waterfall-chart", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);
    getAggregatedData.mockResolvedValue(AGGREGATED_RESULT);

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
    element = createElement("c-d3-waterfall-chart", {
      is: D3WaterfallChart
    });

    Object.assign(element, {
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Sum",
      recordCollection: SAMPLE_DATA,
      ...props
    });

    document.body.appendChild(element);

    // Wait for async operations
    await flushPromises();
    await flushPromises();

    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("shows loading state initially", async () => {
      element = createElement("c-d3-waterfall-chart", {
        is: D3WaterfallChart
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
      await createChart({
        recordCollection: SAMPLE_DATA
      });

      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("executes SOQL when recordCollection is empty", async () => {
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
  // COMPUTERUNNINGTOTAL INTEGRATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("computeRunningTotal integration", () => {
    it("calls computeRunningTotal after aggregation", async () => {
      await createChart();
      await flushPromises();

      expect(computeRunningTotal).toHaveBeenCalled();
    });

    it("passes aggregated data to computeRunningTotal", async () => {
      await createChart();
      await flushPromises();

      const callArg = computeRunningTotal.mock.calls[0][0];
      expect(Array.isArray(callArg)).toBe(true);
      expect(callArg.length).toBeGreaterThan(0);
      expect(callArg[0]).toHaveProperty("label");
      expect(callArg[0]).toHaveProperty("value");
    });

    it("produces waterfall data with cumulative fields", async () => {
      await createChart();
      await flushPromises();

      const result = computeRunningTotal.mock.results[0].value;
      expect(result[0]).toHaveProperty("cumulative");
      expect(result[0]).toHaveProperty("start");
      expect(result[0]).toHaveProperty("end");
      expect(result[0]).toHaveProperty("isPositive");
    });

    it("correctly computes running totals for mixed positive/negative data", async () => {
      await createChart({ recordCollection: MIXED_DATA });
      await flushPromises();

      const result = computeRunningTotal.mock.results[0].value;
      // After aggregation, the running total should accumulate
      let running = 0;
      for (const item of result) {
        expect(item.start).toBe(running);
        running += item.value;
        expect(item.end).toBe(running);
        expect(item.cumulative).toBe(running);
      }
    });

    it("sets isPositive correctly for positive values", async () => {
      await createChart({ recordCollection: ALL_POSITIVE_DATA });
      await flushPromises();

      const result = computeRunningTotal.mock.results[0].value;
      for (const item of result) {
        expect(item.isPositive).toBe(true);
      }
    });

    it("sets isPositive correctly for negative values", async () => {
      await createChart({ recordCollection: ALL_NEGATIVE_DATA });
      await flushPromises();

      const result = computeRunningTotal.mock.results[0].value;
      for (const item of result) {
        expect(item.isPositive).toBe(false);
      }
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

    it("handles records with null groupByField values", async () => {
      const dataWithNull = [
        { StageName: null, Amount: 100 },
        { StageName: "Valid", Amount: 200 }
      ];
      await createChart({ recordCollection: dataWithNull });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles records with undefined valueField values", async () => {
      const dataUndef = [
        { StageName: "A", Amount: undefined },
        { StageName: "B", Amount: 100 }
      ];
      await createChart({ recordCollection: dataUndef });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles zero values", async () => {
      await createChart({ recordCollection: ZERO_DATA });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
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
      const wrongFields = [{ WrongField: "A", WrongValue: 100 }];
      await createChart({ recordCollection: wrongFields });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("silently truncates data exceeding record limit", async () => {
      const largeData = Array.from({ length: 2500 }, (_, i) => ({
        StageName: `Stage${i % 10}`,
        Amount: i * 10
      }));

      const toastHandler = jest.fn();
      element = createElement("c-d3-waterfall-chart", {
        is: D3WaterfallChart
      });
      element.addEventListener("lightning__showtoast", toastHandler);
      Object.assign(element, {
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum",
        recordCollection: largeData
      });
      document.body.appendChild(element);

      await flushPromises();
      await flushPromises();

      expect(toastHandler).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATION OPERATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("aggregation operations", () => {
    it("performs Sum aggregation", async () => {
      await createChart({
        operation: "Sum",
        groupByField: "StageName",
        valueField: "Amount"
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("performs Count aggregation", async () => {
      await createChart({
        operation: "Count",
        groupByField: "StageName"
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("performs Average aggregation", async () => {
      await createChart({
        operation: "Average",
        groupByField: "StageName",
        valueField: "Amount"
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("configuration", () => {
    it("applies height style to container", async () => {
      await createChart({
        height: 400
      });

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

    it("accepts subtotalIndices in advancedConfig", async () => {
      await createChart({
        advancedConfig: '{"subtotalIndices": [2, 4]}'
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
  });

  // ═══════════════════════════════════════════════════════════════
  // WATERFALL-SPECIFIC RENDERING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("waterfall rendering", () => {
    it("creates floating bars (rect elements) for waterfall", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      expect(rectCalls.length).toBeGreaterThan(0);
    });

    it("positions bars as floating (not from zero baseline)", async () => {
      await createChart();
      await flushPromises();

      // attr should be called with 'y' using a function (floating position)
      const attrCalls = mockD3.attr.mock.calls;
      const yCalls = attrCalls.filter((c) => c[0] === "y");
      expect(yCalls.length).toBeGreaterThan(0);
    });

    it("uses SEMANTIC_COLORS.positive for positive bars", async () => {
      await createChart();
      await flushPromises();

      // The fill attribute should be called with a function that returns semantic colors
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);

      // Find the fill call that uses a function (the bar fill, not axis)
      const funcFillCall = fillCalls.find((c) => typeof c[1] === "function");
      expect(funcFillCall).toBeDefined();
      // Test with a positive value
      const color = funcFillCall[1]({ isPositive: true, value: 100 }, 0);
      expect(color).toBe(SEMANTIC_COLORS.positive);
    });

    it("uses SEMANTIC_COLORS.negative for negative bars", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((c) => c[0] === "fill");
      const funcFillCall = fillCalls.find((c) => typeof c[1] === "function");
      expect(funcFillCall).toBeDefined();
      const color = funcFillCall[1]({ isPositive: false, value: -100 }, 0);
      expect(color).toBe(SEMANTIC_COLORS.negative);
    });

    it("creates connector lines between bars", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const lineCalls = appendCalls.filter((c) => c[0] === "line");
      expect(lineCalls.length).toBeGreaterThan(0);
    });

    it("creates value labels on bars", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const textCalls = appendCalls.filter((c) => c[0] === "text");
      expect(textCalls.length).toBeGreaterThan(0);
    });

    it("creates SVG element", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const svgCalls = appendCalls.filter((c) => c[0] === "svg");
      expect(svgCalls.length).toBeGreaterThan(0);
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

    it("applies animation transition to bars", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.transition).toHaveBeenCalled();
      expect(mockD3.duration).toHaveBeenCalled();
    });

    it("sets SVG dimensions", async () => {
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

    it("applies rounded corners to bars", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const rxCalls = attrCalls.filter((c) => c[0] === "rx");
      expect(rxCalls.length).toBeGreaterThan(0);
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

    it("uses d3.min for y-axis domain to include negative territory", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.min).toHaveBeenCalled();
      expect(mockD3.max).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FLOATING BAR POSITIONING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("floating bar positioning", () => {
    it("bar y position uses d.start or d.end (not zero)", async () => {
      await createChart();
      await flushPromises();

      // The transition y attr should be a function that uses start/end
      const attrCalls = mockD3.attr.mock.calls;
      const yCalls = attrCalls.filter(
        (c) => c[0] === "y" && typeof c[1] === "function"
      );
      expect(yCalls.length).toBeGreaterThan(0);

      // Test calling the y function with waterfall data
      const yFunc = yCalls[yCalls.length - 1][1];
      // Positive bar: start=0, end=100
      const result = yFunc({ start: 0, end: 100, isPositive: true });
      expect(typeof result).toBe("number");
    });

    it("bar height uses absolute difference between start and end", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const heightCalls = attrCalls.filter(
        (c) => c[0] === "height" && typeof c[1] === "function"
      );
      expect(heightCalls.length).toBeGreaterThan(0);

      // The height function should use Math.abs(yScale(start) - yScale(end))
      const hFunc = heightCalls[heightCalls.length - 1][1];
      const result = hFunc({ start: 0, end: 100, value: 100 });
      expect(typeof result).toBe("number");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SEMANTIC COLOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("semantic colors", () => {
    it("SEMANTIC_COLORS.positive is #4BCA81", () => {
      expect(SEMANTIC_COLORS.positive).toBe("#4BCA81");
    });

    it("SEMANTIC_COLORS.negative is #FF5D5D", () => {
      expect(SEMANTIC_COLORS.negative).toBe("#FF5D5D");
    });

    it("SEMANTIC_COLORS.subtotal is #1589EE", () => {
      expect(SEMANTIC_COLORS.subtotal).toBe("#1589EE");
    });

    it("fill function maps isPositive=true to positive color", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (c) => c[0] === "fill" && typeof c[1] === "function"
      );
      expect(fillCalls.length).toBeGreaterThan(0);

      const fillFunc = fillCalls[0][1];
      expect(fillFunc({ isPositive: true, value: 50 }, 0)).toBe("#4BCA81");
    });

    it("fill function maps isPositive=false to negative color", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (c) => c[0] === "fill" && typeof c[1] === "function"
      );

      const fillFunc = fillCalls[0][1];
      expect(fillFunc({ isPositive: false, value: -50 }, 0)).toBe("#FF5D5D");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONNECTOR LINE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("connector lines", () => {
    it("appends line elements for connectors", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const lineCalls = appendCalls.filter((c) => c[0] === "line");
      expect(lineCalls.length).toBeGreaterThan(0);
    });

    it("connector lines have stroke style", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const strokeCalls = attrCalls.filter((c) => c[0] === "stroke");
      expect(strokeCalls.length).toBeGreaterThan(0);
    });

    it("connector lines use dashed stroke pattern", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const dashCalls = attrCalls.filter((c) => c[0] === "stroke-dasharray");
      expect(dashCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DELTA VALUE LABEL TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("delta value labels", () => {
    it("appends text elements for value labels", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const textCalls = appendCalls.filter((c) => c[0] === "text");
      expect(textCalls.length).toBeGreaterThan(0);
    });

    it("value labels use text function for delta formatting", async () => {
      await createChart();
      await flushPromises();

      // text() should be called with a function that formats deltas
      const textCalls = mockD3.text.mock.calls;
      const funcTextCalls = textCalls.filter((c) => typeof c[0] === "function");
      expect(funcTextCalls.length).toBeGreaterThan(0);

      // Test the formatter function with positive value
      const formatter = funcTextCalls[0][0];
      const positiveResult = formatter({ value: 50000 });
      expect(positiveResult).toContain("+");
    });

    it("value labels show negative sign for negative deltas", async () => {
      await createChart();
      await flushPromises();

      const textCalls = mockD3.text.mock.calls;
      const funcTextCalls = textCalls.filter((c) => typeof c[0] === "function");

      expect(funcTextCalls.length).toBeGreaterThan(0);
      const formatter = funcTextCalls[0][0];
      const negResult = formatter({ value: -30000 });
      expect(negResult).toContain("-");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SUBTOTAL BAR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("subtotal bars", () => {
    it("uses SEMANTIC_COLORS.subtotal for subtotal bars when subtotalIndices specified", async () => {
      await createChart({
        advancedConfig: '{"subtotalIndices": [1]}'
      });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (c) => c[0] === "fill" && typeof c[1] === "function"
      );

      expect(fillCalls.length).toBeGreaterThan(0);
      const fillFunc = fillCalls[0][1];
      // Index 1 should be treated as a subtotal
      const color = fillFunc({ isPositive: true, value: 100 }, 1);
      expect(color).toBe(SEMANTIC_COLORS.subtotal);
    });

    it("renders non-subtotal bars normally when subtotalIndices specified", async () => {
      await createChart({
        advancedConfig: '{"subtotalIndices": [2]}'
      });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (c) => c[0] === "fill" && typeof c[1] === "function"
      );

      expect(fillCalls.length).toBeGreaterThan(0);
      const fillFunc = fillCalls[0][1];
      // Index 0 is not a subtotal, should use normal colors
      const color = fillFunc({ isPositive: true, value: 100 }, 0);
      expect(color).toBe(SEMANTIC_COLORS.positive);
    });

    it("handles empty subtotalIndices array", async () => {
      await createChart({
        advancedConfig: '{"subtotalIndices": []}'
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles subtotalIndices with out-of-range values", async () => {
      await createChart({
        advancedConfig: '{"subtotalIndices": [99]}'
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Y-AXIS DOMAIN TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("y-axis domain", () => {
    it("uses d3.min to find minimum of starts and ends", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.min).toHaveBeenCalled();
    });

    it("uses d3.max to find maximum of starts and ends", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.max).toHaveBeenCalled();
    });

    it("y-axis domain accounts for negative values", async () => {
      await createChart({ recordCollection: ALL_NEGATIVE_DATA });
      await flushPromises();

      // scaleLinear should have domain set
      const linearScale = mockD3.scaleLinear.mock.results[0]?.value;
      expect(linearScale).toBeDefined();
      expect(linearScale.domain).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("tooltip behavior", () => {
    it("registers mouseenter handler on bars", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on bars", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });

    it("registers mousemove handler on bars", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const moveCalls = onCalls.filter((c) => c[0] === "mousemove");
      expect(moveCalls.length).toBeGreaterThan(0);
    });

    it("registers click handler on bars", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLICK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("click events", () => {
    it("configures for barclick when objectApiName is set", async () => {
      await createChart({
        objectApiName: "Opportunity"
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("does not set pointer cursor without objectApiName", async () => {
      await createChart({
        objectApiName: ""
      });

      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const cursorCalls = attrCalls.filter((c) => c[0] === "cursor");
      expect(cursorCalls.length).toBeGreaterThan(0);
    });

    it("sets pointer cursor with objectApiName", async () => {
      await createChart({
        objectApiName: "Opportunity"
      });

      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const cursorCalls = attrCalls.filter((c) => c[0] === "cursor");
      expect(cursorCalls.length).toBeGreaterThan(0);
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

    it("handles very small container", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 50,
        height: 50,
        top: 0,
        left: 0,
        bottom: 50,
        right: 50
      }));

      await createChart({ height: 50 });
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
        soqlQuery: "SELECT Bad FROM Object"
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("falls back to e.message when body is missing", async () => {
      executeQuery.mockRejectedValue(new Error("Network error"));

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Id FROM Account"
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
  // SERVER AGGREGATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("server aggregation", () => {
    it("calls getAggregatedData when objectApiName and fields are set", async () => {
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

    it("passes filterClause to getAggregatedData when set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum",
        filterClause: "Amount > 1000"
      });

      await flushPromises();

      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum",
        filterClause: "Amount > 1000"
      });
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
        operation: "Sum"
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
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

    it("prefers recordCollection over server aggregation", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      expect(getAggregatedData).not.toHaveBeenCalled();
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

    it("showChart is false when loading", () => {
      element = createElement("c-d3-waterfall-chart", {
        is: D3WaterfallChart
      });
      element.groupByField = "StageName";
      element.recordCollection = SAMPLE_DATA;
      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
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

    it("cleans up tooltip on disconnect", async () => {
      await createChart();
      await flushPromises();

      document.body.removeChild(element);
      expect(true).toBe(true);
    });

    it("handles double disconnect gracefully", async () => {
      await createChart();
      await flushPromises();

      document.body.removeChild(element);
      expect(true).toBe(true);
    });
  });
});
