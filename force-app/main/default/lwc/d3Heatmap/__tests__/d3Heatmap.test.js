// ABOUTME: Unit tests for the d3Heatmap Lightning Web Component.
// ABOUTME: Tests initialization, data handling, cell grid rendering, sequential color ramp, contrast text, tooltips, and error recovery.

import { createElement } from "lwc";
import D3Heatmap from "c/d3Heatmap";
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
    text: jest.fn(() => mockD3),
    remove: jest.fn(() => mockD3),
    selectAll: jest.fn(() => mockD3),
    data: jest.fn(() => mockD3),
    enter: jest.fn(() => mockD3),
    exit: jest.fn(() => mockD3),
    transition: jest.fn(() => mockD3),
    duration: jest.fn(() => mockD3),
    delay: jest.fn(() => mockD3),
    on: jest.fn(() => mockD3),
    merge: jest.fn(() => mockD3),
    html: jest.fn(() => mockD3),
    each: jest.fn(() => mockD3),
    scaleBand: jest.fn(() => {
      const scale = jest.fn(() => 50);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.padding = jest.fn(() => scale);
      scale.bandwidth = jest.fn(() => 40);
      return scale;
    }),
    scaleQuantize: jest.fn(() => {
      const scale = jest.fn(() => "#1589EE");
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
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
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    min: jest.fn(() => 0),
    max: jest.fn(() => 500),
    extent: jest.fn(() => [0, 500])
  };
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const HEATMAP_RECORDS = [
  { Quarter: "Q1", Product: "Product A", Amount: 100 },
  { Quarter: "Q1", Product: "Product B", Amount: 200 },
  { Quarter: "Q2", Product: "Product A", Amount: 300 },
  { Quarter: "Q2", Product: "Product B", Amount: 250 },
  { Quarter: "Q3", Product: "Product A", Amount: 50 },
  { Quarter: "Q3", Product: "Product B", Amount: 175 }
];

const SINGLE_RECORD = [{ Quarter: "Q1", Product: "Product A", Amount: 100 }];

const SERVER_MULTI_GROUP_RESULT = [
  { label: "Q1", series: "Product A", value: 100 },
  { label: "Q1", series: "Product B", value: 200 },
  { label: "Q2", series: "Product A", value: 300 },
  { label: "Q2", series: "Product B", value: 250 }
];

const SPARSE_RECORDS = [
  { Quarter: "Q1", Product: "Product A", Amount: 100 },
  { Quarter: "Q2", Product: "Product B", Amount: 200 }
];

const ZERO_RECORDS = [
  { Quarter: "Q1", Product: "A", Amount: 0 },
  { Quarter: "Q2", Product: "B", Amount: 0 }
];

const NEGATIVE_RECORDS = [
  { Quarter: "Q1", Product: "A", Amount: -100 },
  { Quarter: "Q2", Product: "B", Amount: 200 }
];

const SPECIAL_CHAR_RECORDS = [
  { Quarter: 'Q"1"', Product: "Type <1>", Amount: 100 },
  { Quarter: "Q'2'", Product: "Type &2", Amount: 200 }
];

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe("c-d3-heatmap", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(HEATMAP_RECORDS);
    getMultiGroupData.mockResolvedValue(SERVER_MULTI_GROUP_RESULT);

    // Spy on console to keep output pristine
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Mock getBoundingClientRect globally
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 600,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 600
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
    element = createElement("c-d3-heatmap", {
      is: D3Heatmap
    });

    Object.assign(element, {
      xField: "Quarter",
      yField: "Product",
      valueField: "Amount",
      operation: "Sum",
      recordCollection: HEATMAP_RECORDS,
      ...props
    });

    document.body.appendChild(element);

    // Wait for async operations
    await flushPromises();
    await flushPromises();

    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION & LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("loads D3 library on connected", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("shows loading spinner initially", async () => {
      element = createElement("c-d3-heatmap", { is: D3Heatmap });
      element.xField = "Quarter";
      element.yField = "Product";
      element.recordCollection = HEATMAP_RECORDS;

      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
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

    it("shows no-data state when query returns empty results", async () => {
      executeQuery.mockResolvedValue([
        { Quarter: "Q1", Product: "A", Amount: 1 }
      ]);
      // Force empty aggregation by using wrong fields
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Name FROM Account",
        xField: "WrongField",
        yField: "AlsoWrong"
      });

      await flushPromises();

      // Should show error because fields are missing
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  describe("API properties", () => {
    it("has default height of 400", async () => {
      await createChart();
      expect(element.height).toBe(400);
    });

    it("has default operation of Sum", async () => {
      await createChart();
      expect(element.operation).toBe("Sum");
    });

    it("has default valueField of Amount", async () => {
      await createChart();
      expect(element.valueField).toBe("Amount");
    });

    it("accepts xField property", async () => {
      await createChart({ xField: "StageName" });
      expect(element.xField).toBe("StageName");
    });

    it("accepts yField property", async () => {
      await createChart({ yField: "Type" });
      expect(element.yField).toBe("Type");
    });

    it("accepts theme property", async () => {
      await createChart({ theme: "Warm" });
      expect(element.theme).toBe("Warm");
    });

    it("accepts advancedConfig property", async () => {
      const config = JSON.stringify({ rampHue: "green" });
      await createChart({ advancedConfig: config });
      expect(element.advancedConfig).toBe(config);
    });

    it("applies container height from height property", async () => {
      await createChart({ height: 500 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.cssText).toContain("500");
    });

    it("accepts objectApiName property", async () => {
      await createChart({ objectApiName: "Opportunity" });
      expect(element.objectApiName).toBe("Opportunity");
    });

    it("accepts filterField property", async () => {
      await createChart({ filterField: "CustomField__c" });
      expect(element.filterField).toBe("CustomField__c");
    });

    it("accepts filterClause property", async () => {
      await createChart({ filterClause: "Amount > 1000" });
      expect(element.filterClause).toBe("Amount > 1000");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════

  describe("error handling", () => {
    it("displays error when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));
      await createChart();

      await flushPromises();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain("D3 load failed");
    });

    it("displays error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({
        body: { message: "SOQL syntax error" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Bad FROM Stuff"
      });

      await flushPromises();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain("SOQL");
    });

    it("displays error when server aggregation fails", async () => {
      getMultiGroupData.mockRejectedValue({
        body: { message: "Server aggregation error" }
      });

      await createChart({
        recordCollection: [],
        objectApiName: "Opportunity",
        xField: "StageName",
        yField: "Type",
        soqlQuery: ""
      });

      await flushPromises();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain("Aggregation Error");
    });

    it("handles invalid advancedConfig JSON gracefully", async () => {
      await createChart({ advancedConfig: "not valid json" });
      await flushPromises();

      // Should not crash — config falls back to {}
      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();
    });

    it("displays error when no data source is provided", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await flushPromises();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain("No data source");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  describe("data loading", () => {
    it("uses recordCollection when provided (client-side path)", async () => {
      await createChart({ recordCollection: HEATMAP_RECORDS });

      expect(executeQuery).not.toHaveBeenCalled();
      expect(getMultiGroupData).not.toHaveBeenCalled();
    });

    it("uses server-side getMultiGroupData when objectApiName is set", async () => {
      await createChart({
        recordCollection: [],
        objectApiName: "Opportunity",
        xField: "StageName",
        yField: "Type",
        valueField: "Amount",
        operation: "Sum",
        soqlQuery: ""
      });

      expect(getMultiGroupData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum",
        filterClause: null
      });
    });

    it("passes filterClause to server-side aggregation", async () => {
      await createChart({
        recordCollection: [],
        objectApiName: "Opportunity",
        xField: "StageName",
        yField: "Type",
        filterClause: "Amount > 1000",
        soqlQuery: ""
      });

      expect(getMultiGroupData).toHaveBeenCalledWith(
        expect.objectContaining({
          filterClause: "Amount > 1000"
        })
      );
    });

    it("falls back to SOQL query when no objectApiName", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Quarter, Product, Amount FROM CustomObj__c"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Quarter, Product, Amount FROM CustomObj__c"
      });
    });

    it("aggregates data using xField as groupBy and yField as series", async () => {
      await createChart({
        recordCollection: HEATMAP_RECORDS,
        xField: "Quarter",
        yField: "Product",
        valueField: "Amount",
        operation: "Sum"
      });

      await flushPromises();

      // Chart renders without error
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("silently truncates data exceeding 2000 records", async () => {
      const largeData = Array.from({ length: 2500 }, (_, i) => ({
        Quarter: `Q${(i % 4) + 1}`,
        Product: `Product ${i % 10}`,
        Amount: Math.random() * 1000
      }));

      element = createElement("c-d3-heatmap", { is: D3Heatmap });
      Object.assign(element, {
        xField: "Quarter",
        yField: "Product",
        valueField: "Amount",
        operation: "Sum",
        recordCollection: largeData
      });
      document.body.appendChild(element);

      await flushPromises();
      await flushPromises();

      // Chart should render without error (data truncated silently)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("handles empty server response with error", async () => {
      getMultiGroupData.mockResolvedValue([]);

      await createChart({
        recordCollection: [],
        objectApiName: "Opportunity",
        xField: "StageName",
        yField: "Type",
        soqlQuery: ""
      });

      await flushPromises();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING — CELL GRID
  // ═══════════════════════════════════════════════════════════════

  describe("chart rendering — cell grid", () => {
    it("calls D3 select to create SVG", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.select).toHaveBeenCalled();
    });

    it("uses scaleBand for x-axis (columns)", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.scaleBand).toHaveBeenCalled();
    });

    it("uses scaleBand for both x and y axes", async () => {
      await createChart();
      await flushPromises();

      // scaleBand is called twice: once for x, once for y
      expect(mockD3.scaleBand).toHaveBeenCalledTimes(2);
    });

    it("uses scaleQuantize for color mapping", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.scaleQuantize).toHaveBeenCalled();
    });

    it("renders cell groups via selectAll", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.selectAll).toHaveBeenCalled();
    });

    it("appends rect for each heatmap cell", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("rect");
    });

    it("appends text for cell labels", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("text");
    });

    it("sets up x-axis with axisBottom", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.axisBottom).toHaveBeenCalled();
    });

    it("sets up y-axis with axisLeft", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.axisLeft).toHaveBeenCalled();
    });

    it("animates cell opacity with transition", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.transition).toHaveBeenCalled();
      expect(mockD3.duration).toHaveBeenCalled();
    });

    it("creates SVG with heatmap-svg class", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classAttrs = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "heatmap-svg"
      );
      expect(classAttrs.length).toBeGreaterThan(0);
    });

    it("assigns x-axis class to axis group", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classAttrs = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "x-axis"
      );
      expect(classAttrs.length).toBeGreaterThan(0);
    });

    it("assigns y-axis class to axis group", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classAttrs = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "y-axis"
      );
      expect(classAttrs.length).toBeGreaterThan(0);
    });

    it("assigns cell class to cell groups", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classAttrs = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "cell"
      );
      expect(classAttrs.length).toBeGreaterThan(0);
    });

    it("assigns heatmap-cell class to rect elements", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classAttrs = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "heatmap-cell"
      );
      expect(classAttrs.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SEQUENTIAL COLOR RAMP
  // ═══════════════════════════════════════════════════════════════

  describe("sequential color ramp", () => {
    it("uses scaleQuantize for color mapping with default blue ramp", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.scaleQuantize).toHaveBeenCalled();
    });

    it("respects rampHue config option (green)", async () => {
      await createChart({
        advancedConfig: JSON.stringify({ rampHue: "green" })
      });
      await flushPromises();

      // scaleQuantize still called — renders normally
      expect(mockD3.scaleQuantize).toHaveBeenCalled();
    });

    it("respects rampHue config option (red)", async () => {
      await createChart({
        advancedConfig: JSON.stringify({ rampHue: "red" })
      });
      await flushPromises();

      expect(mockD3.scaleQuantize).toHaveBeenCalled();
    });

    it("uses extent for color domain", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.extent).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CELL TEXT CONTRAST
  // ═══════════════════════════════════════════════════════════════

  describe("cell text contrast", () => {
    it("appends text elements for cell labels with fill attribute", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("text");

      // Fill is set on text for contrast color
      const attrCalls = mockD3.attr.mock.calls;
      const fillAttrs = attrCalls.filter((c) => c[0] === "fill");
      expect(fillAttrs.length).toBeGreaterThan(0);
    });

    it("assigns cell-text class to text elements", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const cellTextClass = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "cell-text"
      );
      expect(cellTextClass.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP
  // ═══════════════════════════════════════════════════════════════

  describe("tooltip", () => {
    it("registers mouseenter handler on cells", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls.map((c) => c[0]);
      expect(onCalls).toContain("mouseenter");
    });

    it("registers mouseleave handler on cells", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls.map((c) => c[0]);
      expect(onCalls).toContain("mouseleave");
    });

    it("registers mousemove handler on cells", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls.map((c) => c[0]);
      expect(onCalls).toContain("mousemove");
    });

    it("registers click handler on cells", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls.map((c) => c[0]);
      expect(onCalls).toContain("click");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  describe("data edge cases", () => {
    it("handles sparse data (not all x-y combos exist)", async () => {
      await createChart({ recordCollection: SPARSE_RECORDS });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("handles single record", async () => {
      await createChart({ recordCollection: SINGLE_RECORD });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles null field values", async () => {
      const dataWithNull = [
        { Quarter: null, Product: "A", Amount: 100 },
        { Quarter: "Q1", Product: null, Amount: 200 }
      ];
      await createChart({ recordCollection: dataWithNull });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles undefined value field", async () => {
      const dataUndef = [
        { Quarter: "Q1", Product: "A", Amount: undefined },
        { Quarter: "Q2", Product: "B", Amount: 100 }
      ];
      await createChart({ recordCollection: dataUndef });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles negative values", async () => {
      await createChart({ recordCollection: NEGATIVE_RECORDS });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles zero values", async () => {
      await createChart({ recordCollection: ZERO_RECORDS });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles special characters in labels", async () => {
      await createChart({ recordCollection: SPECIAL_CHAR_RECORDS });
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
  });

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  describe("aggregation operations", () => {
    it("performs Sum aggregation", async () => {
      await createChart({ operation: "Sum" });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("performs Count aggregation", async () => {
      await createChart({ operation: "Count" });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("performs Average aggregation", async () => {
      await createChart({ operation: "Average" });
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("Count operation works without valueField in required fields", async () => {
      await createChart({
        operation: "Count",
        valueField: ""
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AXIS LABELS
  // ═══════════════════════════════════════════════════════════════

  describe("axis labels", () => {
    it("rotates x-axis labels when many columns", async () => {
      // Create data with >6 x categories
      const manyColRecords = Array.from({ length: 8 }, (_, i) => ({
        Quarter: `Q${i + 1}`,
        Product: "Product A",
        Amount: (i + 1) * 100
      }));
      await createChart({ recordCollection: manyColRecords });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const rotateAttrs = attrCalls.filter(
        (c) =>
          c[0] === "transform" &&
          typeof c[1] === "string" &&
          c[1].includes("rotate")
      );
      expect(rotateAttrs.length).toBeGreaterThan(0);
    });

    it("does not rotate labels when few columns", async () => {
      // 3 quarters = no rotation
      await createChart({ recordCollection: HEATMAP_RECORDS });
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const rotateAttrs = attrCalls.filter(
        (c) =>
          c[0] === "transform" &&
          typeof c[1] === "string" &&
          c[1].includes("rotate(-45)")
      );
      // No -45 rotation because only 3 x-labels
      expect(rotateAttrs.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DRILL-DOWN / CLICK
  // ═══════════════════════════════════════════════════════════════

  describe("drill-down", () => {
    it("dispatches cellclick event when objectApiName is set", async () => {
      await createChart({ objectApiName: "Opportunity" });

      const handler = jest.fn();
      element.addEventListener("cellclick", handler);

      // Find click handler from on() calls and invoke
      const clickCalls = mockD3.on.mock.calls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);

      // Invoke the click handler with mock data
      const clickFn = clickCalls[0][1];
      clickFn(
        { offsetX: 100, offsetY: 100, currentTarget: {} },
        { label: "Q1", series: "Product A", value: 500 }
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toEqual({
        label: "Q1",
        series: "Product A",
        value: 500,
        filterField: "Quarter"
      });
    });

    it("uses filterField when specified", async () => {
      await createChart({
        objectApiName: "Opportunity",
        filterField: "CustomField__c"
      });

      const handler = jest.fn();
      element.addEventListener("cellclick", handler);

      const clickCalls = mockD3.on.mock.calls.filter((c) => c[0] === "click");
      const clickFn = clickCalls[0][1];
      clickFn(
        { offsetX: 100, offsetY: 100, currentTarget: {} },
        { label: "Q1", series: "Product A", value: 500 }
      );

      expect(handler.mock.calls[0][0].detail.filterField).toBe(
        "CustomField__c"
      );
    });

    it("does not dispatch cellclick when objectApiName is empty", async () => {
      await createChart({ objectApiName: "" });

      const handler = jest.fn();
      element.addEventListener("cellclick", handler);

      const clickCalls = mockD3.on.mock.calls.filter((c) => c[0] === "click");
      const clickFn = clickCalls[0][1];
      clickFn(
        { offsetX: 100, offsetY: 100, currentTarget: {} },
        { label: "Q1", series: "Product A", value: 500 }
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESIZE & CLEANUP
  // ═══════════════════════════════════════════════════════════════

  describe("resize and cleanup", () => {
    it("creates resize observer via ResizeObserver", async () => {
      await createChart();
      await flushPromises();

      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it("cleans up on disconnect", async () => {
      await createChart();
      await flushPromises();

      // Remove element to trigger disconnectedCallback
      document.body.removeChild(element);

      // Element should have cleaned up without errors
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIG PARSING
  // ═══════════════════════════════════════════════════════════════

  describe("config parsing", () => {
    it("parses valid advancedConfig JSON", async () => {
      await createChart({
        advancedConfig: '{"rampHue": "green"}'
      });
      await flushPromises();

      // No error — config was parsed successfully
      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();
    });

    it("handles empty config string", async () => {
      await createChart({ advancedConfig: "" });
      await flushPromises();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();
    });

    it("handles malformed JSON in advancedConfig", async () => {
      await createChart({ advancedConfig: "not-json" });
      await flushPromises();

      // Should not crash
      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONTAINER STYLE
  // ═══════════════════════════════════════════════════════════════

  describe("container style", () => {
    it("uses default 400px height", async () => {
      await createChart();
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.cssText).toContain("400");
    });

    it("uses custom height from property", async () => {
      await createChart({ height: 600 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.cssText).toContain("600");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ZERO-WIDTH RENDER GUARD
  // ═══════════════════════════════════════════════════════════════

  describe("render guards", () => {
    it("does not render SVG when container has zero width", async () => {
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

      // scaleBand should not have been called because width is 0
      expect(mockD3.scaleBand).not.toHaveBeenCalled();
    });
  });
});
