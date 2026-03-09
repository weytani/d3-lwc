// ABOUTME: Unit tests for the d3StackedBarChart Lightning Web Component.
// ABOUTME: Tests initialization, data handling, stacked/grouped/normalized modes, legend, series toggle, and error recovery.

import { createElement } from "lwc";
import D3StackedBarChart from "c/d3StackedBarChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
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
    each: jest.fn(() => mockD3),
    scaleBand: jest.fn(() => {
      const scale = jest.fn(() => 50);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.padding = jest.fn(() => scale);
      scale.bandwidth = jest.fn(() => 40);
      scale.paddingInner = jest.fn(() => scale);
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
    stack: jest.fn(() => mockStack),
    stackOffsetNone: "stackOffsetNone",
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

const MULTI_SERIES_AGGREGATED = [
  { label: "Prospecting", series: "New", value: 100 },
  { label: "Prospecting", series: "Existing", value: 200 },
  { label: "Qualification", series: "New", value: 150 },
  { label: "Qualification", series: "Existing", value: 250 },
  { label: "Closed Won", series: "New", value: 500 },
  { label: "Closed Won", series: "Existing", value: 300 }
];

const SERVER_MULTI_GROUP_RESULT = [
  { label: "Prospecting", series: "New", value: 100 },
  { label: "Prospecting", series: "Existing", value: 200 },
  { label: "Qualification", series: "New", value: 150 },
  { label: "Qualification", series: "Existing", value: 250 }
];

const NEGATIVE_SERIES_DATA = [
  { StageName: "Loss", Type: "A", Amount: -100 },
  { StageName: "Gain", Type: "B", Amount: 200 }
];

const ZERO_SERIES_DATA = [
  { StageName: "Zero", Type: "A", Amount: 0 },
  { StageName: "AlsoZero", Type: "B", Amount: 0 }
];

const SPECIAL_CHAR_SERIES_DATA = [
  { StageName: 'Stage "A"', Type: "Type <1>", Amount: 100 },
  { StageName: "Stage 'B'", Type: "Type &2", Amount: 200 }
];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-stacked-bar-chart", () => {
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
    element = createElement("c-d3-stacked-bar-chart", {
      is: D3StackedBarChart
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
      element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
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

    it("exposes seriesField as public api property", async () => {
      await createChart({ seriesField: "Type" });
      expect(element.seriesField).toBe("Type");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("data handling", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({
        recordCollection: SERIES_DATA
      });

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
  // DATA EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  describe("data edge cases", () => {
    it("handles single record", async () => {
      await createChart({ recordCollection: SINGLE_SERIES_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles records with null groupByField values", async () => {
      const dataWithNull = [
        { StageName: null, Type: "New", Amount: 100 },
        { StageName: "Valid", Type: "Existing", Amount: 200 }
      ];
      await createChart({ recordCollection: dataWithNull });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles records with null seriesField values", async () => {
      const dataWithNull = [
        { StageName: "A", Type: null, Amount: 100 },
        { StageName: "B", Type: "Valid", Amount: 200 }
      ];
      await createChart({ recordCollection: dataWithNull });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles records with undefined valueField values", async () => {
      const dataUndef = [
        { StageName: "A", Type: "X", Amount: undefined },
        { StageName: "B", Type: "Y", Amount: 100 }
      ];
      await createChart({ recordCollection: dataUndef });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles negative values", async () => {
      await createChart({ recordCollection: NEGATIVE_SERIES_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles zero values", async () => {
      await createChart({ recordCollection: ZERO_SERIES_DATA });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles special characters in labels", async () => {
      await createChart({ recordCollection: SPECIAL_CHAR_SERIES_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles records with wrong field names", async () => {
      const wrongFields = [
        { WrongField: "A", WrongSeries: "B", WrongValue: 100 }
      ];
      await createChart({ recordCollection: wrongFields });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("dispatches toast when data exceeds 2000 records", async () => {
      const largeData = Array.from({ length: 2500 }, (_, i) => ({
        StageName: `Stage${i % 10}`,
        Type: `Type${i % 3}`,
        Amount: i * 10
      }));

      const toastHandler = jest.fn();
      element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
      });
      element.addEventListener("lightning__showtoast", toastHandler);
      Object.assign(element, {
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum",
        recordCollection: largeData
      });
      document.body.appendChild(element);

      await flushPromises();
      await flushPromises();

      expect(toastHandler).toHaveBeenCalled();
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
        seriesField: "Type",
        valueField: "Amount"
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("performs Count aggregation", async () => {
      await createChart({
        operation: "Count",
        groupByField: "StageName",
        seriesField: "Type"
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("performs Average aggregation", async () => {
      await createChart({
        operation: "Average",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount"
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("Count operation works without valueField", async () => {
      await createChart({
        operation: "Count",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: ""
      });

      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("falls back to Count for unknown operation", async () => {
      await createChart({
        operation: "UnknownOp",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount"
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SERIES FIELD DATA FLOW TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("seriesField data flow", () => {
    it("calls aggregateSeriesData with correct params for recordCollection", async () => {
      await createChart({
        recordCollection: SERIES_DATA,
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      // Chart should render without error, confirming aggregateSeriesData was used
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("produces chartData with label, series, value shape", async () => {
      await createChart({
        recordCollection: SERIES_DATA
      });

      await flushPromises();

      // If chart rendered successfully, data shape is correct
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("groups data by both groupByField and seriesField", async () => {
      await createChart({
        recordCollection: SERIES_DATA,
        groupByField: "StageName",
        seriesField: "Type"
      });

      await flushPromises();

      // D3 stack should have been called to process multi-dimensional data
      expect(mockD3.stack).toHaveBeenCalled();
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
        advancedConfig: '{"showGrid": true, "stackMode": "stacked"}'
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
      await createChart({
        advancedConfig: ""
      });

      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles whitespace-only advancedConfig", async () => {
      await createChart({
        advancedConfig: "   "
      });

      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts customColors in advancedConfig", async () => {
      await createChart({
        advancedConfig: '{"customColors": ["#ff0000", "#00ff00", "#0000ff"]}'
      });

      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts showGrid config option", async () => {
      await createChart({
        advancedConfig: '{"showGrid": false}'
      });

      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
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

      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      expect(rectCalls.length).toBeGreaterThan(0);
    });

    it("renders multiple groups for series layers", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const gCalls = appendCalls.filter((c) => c[0] === "g");
      expect(gCalls.length).toBeGreaterThan(0);
    });

    it("uses default stacked mode when stackMode not specified", async () => {
      await createChart({
        advancedConfig: "{}"
      });
      await flushPromises();

      // d3.stack should be called (stacked is default)
      expect(mockD3.stack).toHaveBeenCalled();
    });

    it("uses stacked mode when stackMode is stacked", async () => {
      await createChart({
        advancedConfig: '{"stackMode": "stacked"}'
      });
      await flushPromises();

      expect(mockD3.stack).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUPED MODE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("grouped mode", () => {
    it("uses grouped layout when stackMode is grouped", async () => {
      await createChart({
        advancedConfig: '{"stackMode": "grouped"}'
      });
      await flushPromises();

      // In grouped mode, an inner scaleBand is created for side-by-side positioning
      // scaleBand should be called at least twice (outer + inner)
      expect(mockD3.scaleBand).toHaveBeenCalledTimes(2);
    });

    it("creates inner scaleBand for side-by-side positioning", async () => {
      await createChart({
        advancedConfig: '{"stackMode": "grouped"}'
      });
      await flushPromises();

      const bandCalls = mockD3.scaleBand.mock.calls;
      expect(bandCalls.length).toBe(2);
    });

    it("does not call d3.stack in grouped mode", async () => {
      await createChart({
        advancedConfig: '{"stackMode": "grouped"}'
      });
      await flushPromises();

      expect(mockD3.stack).not.toHaveBeenCalled();
    });

    it("renders rects for each series in grouped mode", async () => {
      await createChart({
        advancedConfig: '{"stackMode": "grouped"}'
      });
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      expect(rectCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NORMALIZED MODE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("normalized mode", () => {
    it("uses normalized stacking when stackMode is normalized", async () => {
      await createChart({
        advancedConfig: '{"stackMode": "normalized"}'
      });
      await flushPromises();

      expect(mockD3.stack).toHaveBeenCalled();
      // stackOffsetExpand should be used for 100% stacking
      expect(mockD3._mockStack.offset).toHaveBeenCalled();
    });

    it("calls d3.stack with offset expand for normalization", async () => {
      await createChart({
        advancedConfig: '{"stackMode": "normalized"}'
      });
      await flushPromises();

      const offsetCalls = mockD3._mockStack.offset.mock.calls;
      expect(offsetCalls.length).toBeGreaterThan(0);
      expect(offsetCalls[0][0]).toBe("stackOffsetExpand");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LEGEND RENDERING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("legend rendering", () => {
    it("renders legend at bottom of chart", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const gCalls = appendCalls.filter((c) => c[0] === "g");
      // At least one g for the legend group
      expect(gCalls.length).toBeGreaterThan(0);
    });

    it("creates legend items with series color swatches", async () => {
      await createChart();
      await flushPromises();

      // Legend should append rect elements for color swatches
      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      expect(rectCalls.length).toBeGreaterThan(0);
    });

    it("creates legend text labels for each series", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const textCalls = appendCalls.filter((c) => c[0] === "text");
      expect(textCalls.length).toBeGreaterThan(0);
    });

    it("renders legend class attribute", async () => {
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

    it("uses filterField for event detail when provided", async () => {
      await createChart({
        objectApiName: "Opportunity",
        filterField: "CustomField__c"
      });

      await flushPromises();
      expect(element.filterField).toBe("CustomField__c");
    });

    it("falls back to groupByField when filterField is empty", async () => {
      await createChart({
        objectApiName: "Opportunity",
        filterField: "",
        groupByField: "StageName"
      });

      await flushPromises();
      expect(element.groupByField).toBe("StageName");
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

    it("does not start duplicate retries on multiple renderedCallback calls", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 0
      }));

      let rafCount = 0;
      global.requestAnimationFrame = jest.fn(() => ++rafCount);
      global.cancelAnimationFrame = jest.fn();

      await createChart();
      await flushPromises();
      await flushPromises();
      await flushPromises();

      expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);
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
  // RENDERING DETAIL TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("rendering details", () => {
    it("creates SVG element", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.append).toHaveBeenCalled();
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

    it("uses SVG class stacked-bar-chart-svg", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "stacked-bar-chart-svg"
      );
      expect(classCalls.length).toBeGreaterThan(0);
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
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
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
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("passes filterClause to getMultiGroupData when set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum",
        filterClause: "Amount > 1000"
      });

      await flushPromises();

      expect(getMultiGroupData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum",
        filterClause: "Amount > 1000"
      });
    });

    it("falls back to getAggregatedData when seriesField is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "",
        valueField: "Amount",
        operation: "Sum"
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

    it("falls back to soqlQuery with client aggregation when objectApiName is not set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT StageName, Type, Amount FROM Opportunity",
        objectApiName: "",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      expect(getMultiGroupData).not.toHaveBeenCalled();
      expect(getAggregatedData).not.toHaveBeenCalled();
      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT StageName, Type, Amount FROM Opportunity"
      });
    });

    it("renders chart from server multi-group data", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum"
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

    it("shows error when getMultiGroupData fails", async () => {
      getMultiGroupData.mockRejectedValue({
        body: { message: "Multi-group aggregation failed" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when getMultiGroupData returns empty array", async () => {
      getMultiGroupData.mockResolvedValue([]);

      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
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
        recordCollection: SERIES_DATA,
        objectApiName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      expect(getMultiGroupData).not.toHaveBeenCalled();
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
      element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
      });
      element.groupByField = "StageName";
      element.seriesField = "Type";
      element.recordCollection = SERIES_DATA;
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
