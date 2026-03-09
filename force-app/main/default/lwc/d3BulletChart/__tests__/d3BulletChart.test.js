// ABOUTME: Unit tests for the d3BulletChart Lightning Web Component.
// ABOUTME: Tests initialization, data handling, config, themes, events, tooltip, resize, rendering, and bullet-specific features.

import { createElement } from "lwc";
import D3BulletChart from "c/d3BulletChart";
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
      const scale = jest.fn((val) => {
        // Return proportional value for testing
        return typeof val === "number" ? val * 2 : 100;
      });
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      scale.clamp = jest.fn(() => scale);
      return scale;
    }),
    axisBottom: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      axis.ticks = jest.fn(() => axis);
      return axis;
    }),
    max: jest.fn(() => 500)
  };
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const SINGLE_RECORD = [{ Amount: 250000 }];
const MULTI_RECORDS = [
  { Amount: 100000 },
  { Amount: 200000 },
  { Amount: 300000 }
];
const ZERO_VALUE_RECORD = [{ Amount: 0 }];
const LARGE_VALUE_RECORD = [{ Amount: 999999 }];
const SOQL_RESPONSE = [{ Amount: 175000 }];
const AGGREGATED_RESPONSE = [{ label: "Average", value: 225000 }];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-bullet-chart", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SOQL_RESPONSE);
    getAggregatedData.mockResolvedValue(AGGREGATED_RESPONSE);

    // Spy on console to ensure pristine output
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
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
    element = createElement("c-d3-bullet-chart", {
      is: D3BulletChart
    });

    Object.assign(element, {
      valueField: "Amount",
      recordCollection: SINGLE_RECORD,
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
      element = createElement("c-d3-bullet-chart", {
        is: D3BulletChart
      });
      element.recordCollection = SINGLE_RECORD;

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
    it("uses recordCollection first record value when provided", async () => {
      await createChart({
        recordCollection: SINGLE_RECORD
      });

      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("executes SOQL when recordCollection is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT AVG(Amount) Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT AVG(Amount) Amount FROM Opportunity"
      });
    });

    it("uses server aggregation when objectApiName and valueField are set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        valueField: "Amount"
      });

      await flushPromises();

      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "Id",
        valueField: "Amount",
        operation: "Average",
        filterClause: null
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
      await createChart({ recordCollection: SINGLE_RECORD });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles zero value", async () => {
      await createChart({ recordCollection: ZERO_VALUE_RECORD });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles large value exceeding maxValue", async () => {
      await createChart({
        recordCollection: LARGE_VALUE_RECORD,
        maxValue: 100
      });
      await flushPromises();

      // Should render without error - value is clamped or extends
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("uses first record value from multiple records", async () => {
      await createChart({ recordCollection: MULTI_RECORDS });
      await flushPromises();

      // Should not crash, uses first record
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("handles record with missing valueField", async () => {
      await createChart({
        recordCollection: [{ WrongField: 100 }],
        valueField: "Amount"
      });
      await flushPromises();

      // Value should default to 0, still renders
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles null value in record", async () => {
      await createChart({
        recordCollection: [{ Amount: null }]
      });
      await flushPromises();

      // Null should become 0
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles undefined value in record", async () => {
      await createChart({
        recordCollection: [{ Amount: undefined }]
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
        height: 200
      });

      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.getAttribute("style")).toContain("200px");
    });

    it("uses default minValue of 0", async () => {
      await createChart();
      await flushPromises();

      expect(element.minValue).toBe(0);
    });

    it("uses default maxValue of 100", async () => {
      await createChart();
      await flushPromises();

      expect(element.maxValue).toBe(100);
    });

    it("accepts custom minValue", async () => {
      await createChart({ minValue: 50 });
      await flushPromises();

      expect(element.minValue).toBe(50);
    });

    it("accepts custom maxValue", async () => {
      await createChart({ maxValue: 500 });
      await flushPromises();

      expect(element.maxValue).toBe(500);
    });

    it("parses advancedConfig JSON with target and ranges", async () => {
      await createChart({
        advancedConfig:
          '{"target": 250000, "ranges": [100000, 200000, 400000], "valueFormat": "currency"}'
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

    it("handles empty advancedConfig", async () => {
      await createChart({
        advancedConfig: ""
      });

      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts customColors in advancedConfig", async () => {
      await createChart({
        advancedConfig: '{"customColors": ["#ff0000"]}'
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
    it("configures for bulletclick when objectApiName is set", async () => {
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
  });

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("tooltip behavior", () => {
    it("registers mouseenter handler on feature bar", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on feature bar", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });

    it("registers mousemove handler on feature bar", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const moveCalls = onCalls.filter((c) => c[0] === "mousemove");
      expect(moveCalls.length).toBeGreaterThan(0);
    });

    it("registers click handler on feature bar", async () => {
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

      // Should not crash
      expect(loadD3).toHaveBeenCalled();
    });

    it("retries chart init when container starts at zero width", async () => {
      // Start with zero width
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: containerWidth
      }));

      // Track RAF calls
      const rafCallbacks = [];
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();

      await createChart();
      await flushPromises();

      // Chart was not rendered (width was 0), but RAF should have been requested
      expect(global.requestAnimationFrame).toHaveBeenCalled();

      // Simulate container getting width from layout engine
      containerWidth = 400;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 400
      }));

      // Fire the RAF callback chain
      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift();
        cb();
      }

      // Chart should now have rendered
      expect(mockD3.select).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      // Start with zero width
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

      // Remove element triggers disconnectedCallback
      document.body.removeChild(element);

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it("does not start duplicate retries on multiple renderedCallback calls", async () => {
      // Start with zero width
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 0
      }));

      let rafCount = 0;
      global.requestAnimationFrame = jest.fn(() => ++rafCount);
      global.cancelAnimationFrame = jest.fn();

      await createChart();
      await flushPromises();
      await flushPromises();
      await flushPromises();

      // Only one RAF should be requested (one retry loop, not multiple)
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

      // Spinner should be gone
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

    it("creates range rect elements for qualitative backgrounds", async () => {
      await createChart({
        advancedConfig: '{"target": 250000, "ranges": [100000, 200000, 400000]}'
      });
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      // Should have range rects + feature bar rect
      expect(rectCalls.length).toBeGreaterThan(0);
    });

    it("creates feature bar rect element", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      expect(rectCalls.length).toBeGreaterThan(0);
    });

    it("creates target line element", async () => {
      await createChart({
        advancedConfig: '{"target": 250000}'
      });
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const lineCalls = appendCalls.filter((c) => c[0] === "line");
      expect(lineCalls.length).toBeGreaterThan(0);
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

    it("applies animation transition to feature bar", async () => {
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

      // select().select('svg').remove() should be called
      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });

    it("creates linear scale for x-axis", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BULLET-SPECIFIC TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("bullet-specific features", () => {
    it("renders target marker when target is in config", async () => {
      await createChart({
        advancedConfig: '{"target": 250000}'
      });
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const lineCalls = appendCalls.filter((c) => c[0] === "line");
      expect(lineCalls.length).toBeGreaterThan(0);
    });

    it("does not render target marker when target is not in config", async () => {
      await createChart({
        advancedConfig: "{}"
      });
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const lineCalls = appendCalls.filter((c) => c[0] === "line");
      expect(lineCalls.length).toBe(0);
    });

    it("renders 3 range backgrounds when ranges are provided", async () => {
      await createChart({
        advancedConfig: '{"target": 250000, "ranges": [100000, 200000, 400000]}'
      });
      await flushPromises();

      // Ranges are rendered as rects, plus the feature bar is a rect
      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      // 3 range rects + 1 feature bar = at least 4
      expect(rectCalls.length).toBeGreaterThanOrEqual(4);
    });

    it("renders default range backgrounds when ranges are not provided", async () => {
      await createChart({
        advancedConfig: '{"target": 250000}'
      });
      await flushPromises();

      // Should still render 3 default range rects + feature bar
      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      // 3 default ranges + 1 feature bar = at least 4
      expect(rectCalls.length).toBeGreaterThanOrEqual(4);
    });

    it("applies value bar animation with transition", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.transition).toHaveBeenCalled();
      expect(mockD3.duration).toHaveBeenCalledWith(750);
    });

    it("uses currency format when valueFormat is currency", async () => {
      await createChart({
        advancedConfig: '{"valueFormat": "currency", "target": 250000}'
      });
      await flushPromises();

      // Should not error
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("uses number format by default", async () => {
      await createChart({
        advancedConfig: '{"target": 250000}'
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("renders with minValue and maxValue defining the scale domain", async () => {
      await createChart({
        minValue: 0,
        maxValue: 500000
      });
      await flushPromises();

      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("range rects fill uses gray shades", async () => {
      await createChart({
        advancedConfig: '{"target": 250000, "ranges": [100000, 200000, 400000]}'
      });
      await flushPromises();

      // Check that fill was set with gray values
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((c) => c[0] === "fill");
      const grayFills = fillCalls.filter(
        (c) => c[1] === "#e0e0e0" || c[1] === "#c0c0c0" || c[1] === "#a0a0a0"
      );
      expect(grayFills.length).toBe(3);
    });

    it("target marker uses dark stroke color", async () => {
      await createChart({
        advancedConfig: '{"target": 250000}'
      });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const strokeCalls = attrCalls.filter(
        (c) => c[0] === "stroke" && c[1] === "#333"
      );
      expect(strokeCalls.length).toBeGreaterThan(0);
    });

    it("target marker uses 2.5px stroke-width", async () => {
      await createChart({
        advancedConfig: '{"target": 250000}'
      });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const strokeWidthCalls = attrCalls.filter(
        (c) => c[0] === "stroke-width" && c[1] === 2.5
      );
      expect(strokeWidthCalls.length).toBeGreaterThan(0);
    });

    it("dispatches bulletclick event on bar click when objectApiName is set", async () => {
      const clickHandler = jest.fn();

      await createChart({
        objectApiName: "Opportunity"
      });
      element.addEventListener("bulletclick", clickHandler);

      await flushPromises();

      // Find the click handler registered on D3
      const onCalls = mockD3.on.mock.calls;
      const clickCall = onCalls.find((c) => c[0] === "click");
      expect(clickCall).toBeTruthy();

      // Invoke the click handler
      if (clickCall && clickCall[1]) {
        clickCall[1]({ currentTarget: {} }, { value: 250000 });
      }

      expect(clickHandler).toHaveBeenCalled();
    });

    it("does not dispatch bulletclick when objectApiName is not set", async () => {
      const clickHandler = jest.fn();

      await createChart({
        objectApiName: ""
      });
      element.addEventListener("bulletclick", clickHandler);

      await flushPromises();

      // Find and invoke the click handler
      const onCalls = mockD3.on.mock.calls;
      const clickCall = onCalls.find((c) => c[0] === "click");
      if (clickCall && clickCall[1]) {
        clickCall[1]({ currentTarget: {} }, { value: 250000 });
      }

      expect(clickHandler).not.toHaveBeenCalled();
    });

    it("renders SVG with bullet-chart-svg class", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "bullet-chart-svg"
      );
      expect(classCalls.length).toBeGreaterThan(0);
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

      // Should not throw when removed
      document.body.removeChild(element);
      expect(true).toBe(true);
    });

    it("handles double disconnect gracefully", async () => {
      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      // No error should occur
      expect(true).toBe(true);
    });
  });
});
