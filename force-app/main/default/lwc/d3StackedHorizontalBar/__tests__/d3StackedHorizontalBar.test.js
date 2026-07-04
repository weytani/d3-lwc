// ABOUTME: Unit tests for the d3StackedHorizontalBar Lightning Web Component.
// ABOUTME: Tests initialization, data handling, stacked/normalized modes, legend rendering, click events, and error recovery.

import { createElement } from "lwc";
import D3StackedHorizontalBar from "c/d3StackedHorizontalBar";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

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
  "@salesforce/apex/D3ChartController.getAggregatedData",
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

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const mockStack = jest.fn(() => []);
  mockStack.keys = jest.fn(() => mockStack);
  mockStack.value = jest.fn(() => mockStack);
  mockStack.offset = jest.fn(() => mockStack);

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
    insert: jest.fn(() => mockD3),
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
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    axisLeft: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      return axis;
    }),
    max: jest.fn(() => 500),
    stack: jest.fn(() => mockStack),
    stackOffsetExpand: "stackOffsetExpand"
  };
  mockD3._mockStack = mockStack;
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const SERIES_DATA = [
  { StageName: "Prospecting", Type: "New", Amount: 100 },
  { StageName: "Prospecting", Type: "Existing", Amount: 200 },
  { StageName: "Qualification", Type: "New", Amount: 150 },
  { StageName: "Qualification", Type: "Existing", Amount: 250 },
  { StageName: "Closed Won", Type: "New", Amount: 500 },
  { StageName: "Closed Won", Type: "Existing", Amount: 300 }
];

const SINGLE_SERIES_DATA = [
  { StageName: "Prospecting", Type: "New", Amount: 100 }
];

const NO_SERIES_DATA = [
  { StageName: "Prospecting", Amount: 100 },
  { StageName: "Qualification", Amount: 200 }
];

const SERVER_MULTI_GROUP_RESULT = [
  { label: "Prospecting", series: "New", value: 100 },
  { label: "Prospecting", series: "Existing", value: 200 },
  { label: "Qualification", series: "New", value: 150 },
  { label: "Qualification", series: "Existing", value: 250 }
];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-stacked-horizontal-bar", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SERIES_DATA);
    getAggregatedData.mockResolvedValue([
      { label: "Prospecting", value: 300 },
      { label: "Qualification", value: 400 },
      { label: "Closed Won", value: 800 }
    ]);
    getMultiGroupData.mockResolvedValue(SERVER_MULTI_GROUP_RESULT);

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
    element = createElement("c-d3-stacked-horizontal-bar", {
      is: D3StackedHorizontalBar
    });

    Object.assign(element, {
      groupByField: "StageName",
      seriesField: "Type",
      valueField: "Amount",
      operation: "Sum",
      recordCollection: SERIES_DATA,
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
    it("shows loading state initially", async () => {
      element = createElement("c-d3-stacked-horizontal-bar", {
        is: D3StackedHorizontalBar
      });
      element.groupByField = "StageName";
      element.seriesField = "Type";
      element.recordCollection = SERIES_DATA;

      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
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
      await createChart({ recordCollection: SERIES_DATA });
      expect(executeQuery).not.toHaveBeenCalled();
      expect(getMultiGroupData).not.toHaveBeenCalled();
    });

    it("executes SOQL when recordCollection is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT StageName, Type, Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT StageName, Type, Amount FROM Opportunity"
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

    it("handles single record", async () => {
      await createChart({ recordCollection: SINGLE_SERIES_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("renders without a seriesField as simple bars", async () => {
      await createChart({ recordCollection: NO_SERIES_DATA, seriesField: "" });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
      expect(mockD3.stack).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATION OPERATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("aggregation operations", () => {
    it("performs Sum aggregation", async () => {
      await createChart({ operation: "Sum" });
      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("performs Count aggregation", async () => {
      await createChart({ operation: "Count", valueField: "" });
      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("Count operation works without valueField", async () => {
      await createChart({ operation: "Count", valueField: "" });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // STACKED RENDERING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("stacked rendering", () => {
    it("calls d3.stack() to compute stacked positions", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.stack).toHaveBeenCalled();
    });

    it("sets keys on the stack generator from series names", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3._mockStack.keys).toHaveBeenCalled();
    });

    it("renders rect elements for stacked bars", async () => {
      await createChart();
      await flushPromises();

      const rectCalls = mockD3.append.mock.calls.filter((c) => c[0] === "rect");
      expect(rectCalls.length).toBeGreaterThan(0);
    });

    it("creates a scaleBand for the category (y) axis", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.scaleBand).toHaveBeenCalled();
    });

    it("creates a linear scale for the value (x) axis", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("uses default stacked mode when stackMode not specified", async () => {
      await createChart({ advancedConfig: "{}" });
      await flushPromises();
      expect(mockD3._mockStack.offset).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NORMALIZED MODE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("normalized mode", () => {
    it("uses normalized stacking when stackMode is normalized", async () => {
      await createChart({ advancedConfig: '{"stackMode": "normalized"}' });
      await flushPromises();

      expect(mockD3.stack).toHaveBeenCalled();
      expect(mockD3._mockStack.offset).toHaveBeenCalledWith(
        "stackOffsetExpand"
      );
    });

    it("formats the x-axis as a percentage in normalized mode", async () => {
      await createChart({ advancedConfig: '{"stackMode": "normalized"}' });
      await flushPromises();

      const axisBottomResults = mockD3.axisBottom.mock.results.map(
        (r) => r.value
      );
      const tickFormatCall = axisBottomResults
        .flatMap((axis) => axis.tickFormat.mock.calls)
        .find(
          (call) => typeof call[0] === "function" && call[0](0.5) === "50%"
        );
      expect(tickFormatCall).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LEGEND RENDERING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("legend rendering", () => {
    it("renders legend when series exist", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const legendCalls = attrCalls.filter(
        (c) =>
          c[0] === "class" &&
          typeof c[1] === "string" &&
          c[1].includes("legend")
      );
      expect(legendCalls.length).toBeGreaterThan(0);
    });

    it("does not render a legend when there is no series field", async () => {
      await createChart({ recordCollection: NO_SERIES_DATA, seriesField: "" });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const legendCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "legend"
      );
      expect(legendCalls.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("wires the theme's color palette into the layer fill colors", async () => {
      await createChart({ theme: "Warm" });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls
        .filter((c) => c[0] === "fill" && typeof c[1] === "function")
        .map((c) => c[1]);
      const firstFill = fillCalls.find((fn) => {
        try {
          return fn(null, 0) === "#FF6B6B";
        } catch {
          return false;
        }
      });
      expect(firstFill).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ACCESSIBILITY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("accessibility", () => {
    it("applies role=img and a title to the chart SVG", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      expect(attrCalls.some((c) => c[0] === "role" && c[1] === "img")).toBe(
        true
      );
      expect(mockD3.insert).toHaveBeenCalledWith("title", ":first-child");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLICK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("click events", () => {
    it("sets pointer cursor with objectApiName", async () => {
      await createChart({ objectApiName: "Opportunity" });
      await flushPromises();
      const cursorCalls = mockD3.attr.mock.calls.filter(
        (c) => c[0] === "cursor"
      );
      expect(cursorCalls.length).toBeGreaterThan(0);
    });

    it("registers click handler on bars", async () => {
      await createChart();
      await flushPromises();
      const onCalls = mockD3.on.mock.calls;
      expect(onCalls.filter((c) => c[0] === "click").length).toBeGreaterThan(0);
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
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR RECOVERY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery", () => {
    it("shows error from SOQL body.message", async () => {
      executeQuery.mockRejectedValue({ body: { message: "Query error" } });

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
  });

  // ═══════════════════════════════════════════════════════════════
  // SERVER AGGREGATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("server aggregation", () => {
    it("calls getMultiGroupData when objectApiName + seriesField set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity"
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

    it("falls back to getAggregatedData when seriesField is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        seriesField: ""
      });
      await flushPromises();

      expect(getMultiGroupData).not.toHaveBeenCalled();
      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum",
        filterClause: null
      });
    });

    it("prefers recordCollection over server aggregation", async () => {
      await createChart({
        recordCollection: SERIES_DATA,
        objectApiName: "Opportunity"
      });
      await flushPromises();

      expect(getMultiGroupData).not.toHaveBeenCalled();
      expect(getAggregatedData).not.toHaveBeenCalled();
    });

    it("shows error when getMultiGroupData returns empty array", async () => {
      getMultiGroupData.mockResolvedValue([]);

      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity"
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
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
  });
});
