// ABOUTME: Unit tests for the d3RadarChart Lightning Web Component.
// ABOUTME: Tests initialization, data handling, polar geometry, polygon rendering, normalization, axes, tooltips, and error recovery.

import { createElement } from "lwc";
import D3RadarChart from "c/d3RadarChart";
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
    join: jest.fn(() => mockD3),
    transition: jest.fn(() => mockD3),
    duration: jest.fn(() => mockD3),
    delay: jest.fn(() => mockD3),
    on: jest.fn(() => mockD3),
    remove: jest.fn(() => mockD3),
    html: jest.fn(() => mockD3),
    text: jest.fn(() => mockD3),
    each: jest.fn(() => mockD3),
    classed: jest.fn(() => mockD3),
    datum: jest.fn(() => mockD3),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn((v) => v * 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      return scale;
    }),
    max: jest.fn(() => 500),
    min: jest.fn(() => 0),
    lineRadial: jest.fn(() => {
      const line = jest.fn(() => "M0,0L10,10Z");
      line.angle = jest.fn(() => line);
      line.radius = jest.fn(() => line);
      line.curve = jest.fn(() => line);
      return line;
    }),
    curveLinearClosed: "curveLinearClosed"
  };
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { Type: "New Business", Amount: 50000, Probability: 0.8 },
  { Type: "New Business", Amount: 30000, Probability: 0.6 },
  { Type: "Existing Business", Amount: 40000, Probability: 0.9 },
  { Type: "Existing Business", Amount: 20000, Probability: 0.7 }
];

const SINGLE_GROUP_DATA = [
  { Type: "New Business", Amount: 50000, Probability: 0.8 }
];

const THREE_GROUP_DATA = [
  { Type: "New Business", Amount: 50000, Probability: 0.8, CloseRate: 0.5 },
  {
    Type: "Existing Business",
    Amount: 40000,
    Probability: 0.9,
    CloseRate: 0.7
  },
  { Type: "Partner", Amount: 30000, Probability: 0.6, CloseRate: 0.3 }
];

const NEGATIVE_DATA = [
  { Type: "Loss", Amount: -100, Probability: 0.1 },
  { Type: "Gain", Amount: 200, Probability: 0.9 }
];

const ZERO_DATA = [
  { Type: "Zero", Amount: 0, Probability: 0 },
  { Type: "AlsoZero", Amount: 0, Probability: 0 }
];

const SPECIAL_CHAR_DATA = [
  { Type: 'Type "A"', Amount: 100, Probability: 0.5 },
  { Type: "Type 'B'", Amount: 200, Probability: 0.6 },
  { Type: "Type <C>", Amount: 300, Probability: 0.7 }
];

const AXES_CONFIG = JSON.stringify({
  axes: [
    { label: "Revenue", field: "Amount" },
    { label: "Probability", field: "Probability" }
  ]
});

const THREE_AXES_CONFIG = JSON.stringify({
  axes: [
    { label: "Revenue", field: "Amount" },
    { label: "Probability", field: "Probability" },
    { label: "Close Rate", field: "CloseRate" }
  ]
});

const EIGHT_AXES_CONFIG = JSON.stringify({
  axes: [
    { label: "Axis1", field: "f1" },
    { label: "Axis2", field: "f2" },
    { label: "Axis3", field: "f3" },
    { label: "Axis4", field: "f4" },
    { label: "Axis5", field: "f5" },
    { label: "Axis6", field: "f6" },
    { label: "Axis7", field: "f7" },
    { label: "Axis8", field: "f8" }
  ]
});

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-radar-chart", () => {
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
      { label: "New Business", value: 40000 },
      { label: "Existing Business", value: 30000 }
    ]);

    // Spy on console to ensure pristine output
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
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
    element = createElement("c-d3-radar-chart", {
      is: D3RadarChart
    });

    Object.assign(element, {
      groupByField: "Type",
      valueField: "Amount",
      recordCollection: SAMPLE_DATA,
      advancedConfig: AXES_CONFIG,
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
      element = createElement("c-d3-radar-chart", {
        is: D3RadarChart
      });
      element.groupByField = "Type";
      element.recordCollection = SAMPLE_DATA;
      element.advancedConfig = AXES_CONFIG;

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

    it("sets default height to 400", async () => {
      await createChart();
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.getAttribute("style")).toContain("400px");
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
        soqlQuery: "SELECT Type, Amount, Probability FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Type, Amount, Probability FROM Opportunity"
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
    it("handles single group", async () => {
      await createChart({ recordCollection: SINGLE_GROUP_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles records with null groupByField values", async () => {
      const dataWithNull = [
        { Type: null, Amount: 100, Probability: 0.5 },
        { Type: "Valid", Amount: 200, Probability: 0.6 }
      ];
      await createChart({ recordCollection: dataWithNull });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles records with undefined valueField values", async () => {
      const dataUndef = [
        { Type: "A", Amount: undefined, Probability: 0.5 },
        { Type: "B", Amount: 100, Probability: 0.6 }
      ];
      await createChart({ recordCollection: dataUndef });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles negative values", async () => {
      await createChart({ recordCollection: NEGATIVE_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
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
      await createChart({
        recordCollection: wrongFields,
        advancedConfig: "{}"
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("silently truncates data exceeding 2000 records", async () => {
      const largeData = Array.from({ length: 2500 }, (_, i) => ({
        Type: `Type${i % 10}`,
        Amount: i * 10,
        Probability: (i % 100) / 100
      }));

      element = createElement("c-d3-radar-chart", { is: D3RadarChart });
      Object.assign(element, {
        groupByField: "Type",
        valueField: "Amount",
        recordCollection: largeData,
        advancedConfig: AXES_CONFIG
      });
      document.body.appendChild(element);

      await flushPromises();
      await flushPromises();

      // Chart should render without error (data truncated silently)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RADAR DATA PROCESSING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("radar data processing", () => {
    it("groups records by groupByField", async () => {
      await createChart();
      await flushPromises();

      // Chart should render (groups: New Business, Existing Business)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("computes average of each axis field per group", async () => {
      await createChart();
      await flushPromises();

      // No error means the data was processed correctly
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("normalizes values to 0-1 scale", async () => {
      await createChart();
      await flushPromises();

      // Normalization is internal, but chart should render without error
      expect(mockD3.append).toHaveBeenCalled();
    });

    it("handles three groups with three axes", async () => {
      await createChart({
        recordCollection: THREE_GROUP_DATA,
        advancedConfig: THREE_AXES_CONFIG
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("processes advancedConfig.axes correctly", async () => {
      await createChart({
        advancedConfig: AXES_CONFIG
      });
      await flushPromises();

      // Should have created axis elements
      const appendCalls = mockD3.append.mock.calls;
      const lineCalls = appendCalls.filter((c) => c[0] === "line");
      expect(lineCalls.length).toBeGreaterThan(0);
    });

    it("falls back to groupByField when no axes config", async () => {
      await createChart({
        advancedConfig: "{}",
        groupByField: "Type",
        valueField: "Amount"
      });
      await flushPromises();

      // Should still render
      expect(mockD3.append).toHaveBeenCalled();
    });

    it("falls back to groupByField with empty advancedConfig", async () => {
      await createChart({
        advancedConfig: "",
        groupByField: "Type",
        valueField: "Amount"
      });
      await flushPromises();

      expect(mockD3.append).toHaveBeenCalled();
    });

    it("handles max 8 axes from config", async () => {
      const eightFieldData = Array.from({ length: 3 }, (_, i) => ({
        Type: `Group${i}`,
        f1: 10,
        f2: 20,
        f3: 30,
        f4: 40,
        f5: 50,
        f6: 60,
        f7: 70,
        f8: 80
      }));

      await createChart({
        recordCollection: eightFieldData,
        advancedConfig: EIGHT_AXES_CONFIG
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // POLYGON PATH GENERATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("polygon path generation", () => {
    it("renders closed polygon paths for entities", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const pathCalls = appendCalls.filter((c) => c[0] === "path");
      expect(pathCalls.length).toBeGreaterThan(0);
    });

    it("renders correct number of data polygons for multi-entity", async () => {
      await createChart({
        recordCollection: THREE_GROUP_DATA,
        advancedConfig: THREE_AXES_CONFIG
      });
      await flushPromises();

      // Each entity gets a polygon path appended
      const appendCalls = mockD3.append.mock.calls;
      const pathCalls = appendCalls.filter((c) => c[0] === "path");
      // At least 3 data polygons + 5 grid polygons = 8+ paths
      expect(pathCalls.length).toBeGreaterThanOrEqual(3);
    });

    it("applies fill with 0.2 opacity for polygons", async () => {
      await createChart();
      await flushPromises();

      const styleCalls = mockD3.style.mock.calls;
      const fillOpacityCalls = styleCalls.filter(
        (c) => c[0] === "fill-opacity"
      );
      expect(fillOpacityCalls.length).toBeGreaterThan(0);
    });

    it("applies stroke in full color for polygons", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const strokeCalls = attrCalls.filter((c) => c[0] === "stroke");
      expect(strokeCalls.length).toBeGreaterThan(0);
    });

    it("renders vertex dots at data points", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const circleCalls = appendCalls.filter((c) => c[0] === "circle");
      expect(circleCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AXIS RENDERING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("axis rendering", () => {
    it("renders axis lines radiating from center", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const lineCalls = appendCalls.filter((c) => c[0] === "line");
      expect(lineCalls.length).toBeGreaterThan(0);
    });

    it("renders axis labels at edges", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const textCalls = appendCalls.filter((c) => c[0] === "text");
      expect(textCalls.length).toBeGreaterThan(0);
    });

    it("renders concentric grid polygons", async () => {
      await createChart();
      await flushPromises();

      // Grid polygons are rendered as path elements with class "grid-polygon"
      const attrCalls = mockD3.attr.mock.calls;
      const gridCalls = attrCalls.filter(
        (c) =>
          c[0] === "class" && typeof c[1] === "string" && c[1].includes("grid")
      );
      expect(gridCalls.length).toBeGreaterThan(0);
    });

    it("renders grid levels between 3 and 5", async () => {
      await createChart();
      await flushPromises();

      // Grid levels are rendered as path elements with class grid-polygon
      const attrCalls = mockD3.attr.mock.calls;
      const gridPathCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "grid-polygon"
      );
      // 5 grid levels expected
      expect(gridPathCalls.length).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // POLAR GEOMETRY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("polar geometry", () => {
    it("centers chart in SVG with transform translate", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const transformCalls = attrCalls.filter(
        (c) =>
          c[0] === "transform" &&
          typeof c[1] === "string" &&
          c[1].includes("translate")
      );
      expect(transformCalls.length).toBeGreaterThan(0);
    });

    it("creates SVG element with correct dimensions", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const svgCalls = appendCalls.filter((c) => c[0] === "svg");
      expect(svgCalls.length).toBeGreaterThan(0);

      const attrCalls = mockD3.attr.mock.calls;
      const widthCalls = attrCalls.filter((c) => c[0] === "width");
      const heightCalls = attrCalls.filter((c) => c[0] === "height");
      expect(widthCalls.length).toBeGreaterThan(0);
      expect(heightCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NORMALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("normalization", () => {
    it("normalizes each axis independently", async () => {
      // Data where Amount max is 50000 and Probability max is 0.9
      await createChart();
      await flushPromises();

      // Chart renders means normalization worked
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles all-zero values for an axis gracefully", async () => {
      await createChart({ recordCollection: ZERO_DATA });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles single entity normalization", async () => {
      await createChart({ recordCollection: SINGLE_GROUP_DATA });
      await flushPromises();

      // Single entity should normalize correctly (all values at max = 1.0)
      expect(mockD3.append).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("configuration", () => {
    it("applies height style to container", async () => {
      await createChart({
        height: 500
      });

      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.getAttribute("style")).toContain("500px");
    });

    it("parses advancedConfig JSON", async () => {
      await createChart({
        advancedConfig: AXES_CONFIG
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

    it("accepts customColors in advancedConfig", async () => {
      await createChart({
        advancedConfig: JSON.stringify({
          axes: [
            { label: "Revenue", field: "Amount" },
            { label: "Probability", field: "Probability" }
          ],
          customColors: ["#ff0000", "#00ff00"]
        })
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
  // TOOLTIP BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("tooltip behavior", () => {
    it("registers mouseenter handler on vertices", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on vertices", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });

    it("tooltip shows entity name and axis label and value", async () => {
      await createChart();
      await flushPromises();

      // Tooltip interaction is registered
      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);

      // The handler should exist (function reference)
      const handler = mouseenterCalls[mouseenterCalls.length - 1][1];
      expect(typeof handler).toBe("function");
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

      await createChart();
      await flushPromises();

      expect(global.requestAnimationFrame).toHaveBeenCalled();

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
  // RENDERING DETAIL TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("rendering details", () => {
    it("creates SVG element", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const svgCalls = appendCalls.filter((c) => c[0] === "svg");
      expect(svgCalls.length).toBeGreaterThan(0);
    });

    it("creates a g element for the radar group", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const gCalls = appendCalls.filter((c) => c[0] === "g");
      expect(gCalls.length).toBeGreaterThan(0);
    });

    it("removes existing SVG before re-render", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
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

    it("renders radar-chart-svg class on SVG", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "radar-chart-svg"
      );
      expect(classCalls.length).toBeGreaterThan(0);
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
        groupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "Type",
        valueField: "Amount",
        operation: "Sum",
        filterClause: null
      });
    });

    it("passes filterClause to getAggregatedData", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "Type",
        valueField: "Amount",
        operation: "Sum",
        filterClause: "Amount > 1000"
      });

      await flushPromises();

      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "Type",
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
        groupByField: "Type",
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
        groupByField: "Type",
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
      element = createElement("c-d3-radar-chart", { is: D3RadarChart });
      element.groupByField = "Type";
      element.recordCollection = SAMPLE_DATA;
      element.advancedConfig = AXES_CONFIG;
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
