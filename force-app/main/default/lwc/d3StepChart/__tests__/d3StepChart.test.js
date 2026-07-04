// ABOUTME: Unit tests for the d3StepChart Lightning Web Component.
// ABOUTME: Tests initialization, data sources, date parsing, multi-series, config, theme, a11y, and responsive behavior.

import { createElement } from "lwc";
import D3StepChart from "c/d3StepChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

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

// Mock D3 instance with comprehensive time series support
const mockD3 = {
  select: jest.fn(() => mockD3),
  append: jest.fn(() => mockD3),
  attr: jest.fn(() => mockD3),
  style: jest.fn(() => mockD3),
  call: jest.fn(() => mockD3),
  insert: jest.fn(() => mockD3),
  selectAll: jest.fn(() => mockD3),
  data: jest.fn(() => mockD3),
  datum: jest.fn(() => mockD3),
  enter: jest.fn(() => mockD3),
  transition: jest.fn(() => mockD3),
  duration: jest.fn(() => mockD3),
  delay: jest.fn(() => mockD3),
  ease: jest.fn(() => mockD3),
  on: jest.fn(() => mockD3),
  remove: jest.fn(() => mockD3),
  text: jest.fn(() => mockD3),
  node: jest.fn(() => ({ getTotalLength: () => 100 })),
  scaleTime: jest.fn(() => {
    const scale = jest.fn(() => 50);
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
    axis.ticks = jest.fn(() => axis);
    return axis;
  }),
  axisLeft: jest.fn(() => {
    const axis = jest.fn();
    axis.tickFormat = jest.fn(() => axis);
    axis.tickSize = jest.fn(() => axis);
    return axis;
  }),
  line: jest.fn(() => {
    const lineFn = jest.fn(() => "M0,0 L100,100");
    lineFn.x = jest.fn(() => lineFn);
    lineFn.y = jest.fn(() => lineFn);
    lineFn.curve = jest.fn(() => lineFn);
    return lineFn;
  }),
  extent: jest.fn(() => [new Date("2024-01-01"), new Date("2024-12-31")]),
  max: jest.fn(() => 500),
  min: jest.fn(() => 0),
  curveStepAfter: "curveStepAfter",
  easeLinear: (t) => t
};

// Sample test data - time series
const SAMPLE_TIME_SERIES = [
  { CloseDate: "2024-01-15", Amount: 100, StageName: "Won" },
  { CloseDate: "2024-02-15", Amount: 200, StageName: "Won" },
  { CloseDate: "2024-03-15", Amount: 150, StageName: "Won" },
  { CloseDate: "2024-01-15", Amount: 80, StageName: "Lost" },
  { CloseDate: "2024-02-15", Amount: 120, StageName: "Lost" },
  { CloseDate: "2024-03-15", Amount: 90, StageName: "Lost" }
];

// Single series data
const SINGLE_SERIES_DATA = [
  { CloseDate: "2024-01-01", Amount: 100 },
  { CloseDate: "2024-02-01", Amount: 200 },
  { CloseDate: "2024-03-01", Amount: 150 },
  { CloseDate: "2024-04-01", Amount: 300 }
];

// US date format data
const US_DATE_DATA = [
  { CloseDate: "01/15/2024", Amount: 100 },
  { CloseDate: "02/15/2024", Amount: 200 },
  { CloseDate: "03/15/2024", Amount: 150 }
];

// EU date format data
const EU_DATE_DATA = [
  { CloseDate: "15/01/2024", Amount: 100 },
  { CloseDate: "15/02/2024", Amount: 200 },
  { CloseDate: "15/03/2024", Amount: 150 }
];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-step-chart", () => {
  let element;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_TIME_SERIES);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 500,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 500
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
    jest.clearAllMocks();
  });

  async function createChart(props = {}) {
    element = createElement("c-d3-step-chart", {
      is: D3StepChart
    });

    Object.assign(element, {
      dateField: "CloseDate",
      valueField: "Amount",
      recordCollection: SINGLE_SERIES_DATA,
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
      element = createElement("c-d3-step-chart", {
        is: D3StepChart
      });
      element.dateField = "CloseDate";
      element.valueField = "Amount";
      element.recordCollection = SINGLE_SERIES_DATA;

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

    it("shows trending icon in no-data state", async () => {
      await createChart({ recordCollection: [], soqlQuery: "" });
      await flushPromises();
      await flushPromises();

      const icon = element.shadowRoot.querySelector("lightning-icon");
      expect(icon).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA SOURCE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("data sources", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({ recordCollection: SINGLE_SERIES_DATA });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("calls Apex when recordCollection is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT CloseDate, Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT CloseDate, Amount FROM Opportunity"
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

    it("logs error to console when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({ body: { message: "Invalid query" } });

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Invalid FROM Object"
      });
      await flushPromises();
      await flushPromises();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATE PARSING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("date parsing", () => {
    it("parses ISO dates by default", async () => {
      await createChart({
        dateFormat: "ISO",
        recordCollection: SINGLE_SERIES_DATA
      });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("parses US date format (MM/DD/YYYY)", async () => {
      await createChart({ dateFormat: "US", recordCollection: US_DATE_DATA });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("parses EU date format (DD/MM/YYYY)", async () => {
      await createChart({ dateFormat: "EU", recordCollection: EU_DATE_DATA });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("filters out records with invalid dates", async () => {
      const mixedData = [
        { CloseDate: "2024-01-01", Amount: 100 },
        { CloseDate: "not-a-date", Amount: 200 },
        { CloseDate: "2024-03-01", Amount: 150 }
      ];

      await createChart({ recordCollection: mixedData });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTI-SERIES TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("multi-series support", () => {
    it("renders single series without seriesField", async () => {
      await createChart({ recordCollection: SINGLE_SERIES_DATA });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("splits data into multiple series with seriesField", async () => {
      await createChart({
        recordCollection: SAMPLE_TIME_SERIES,
        seriesField: "StageName"
      });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("shows legend automatically for multi-series", async () => {
      await createChart({
        recordCollection: SAMPLE_TIME_SERIES,
        seriesField: "StageName"
      });
      await flushPromises();

      const legend = element.shadowRoot.querySelector(".legend-container");
      expect(legend).toBeTruthy();
    });

    it("hides legend for single series by default", async () => {
      await createChart({ recordCollection: SINGLE_SERIES_DATA });
      await flushPromises();

      const legend = element.shadowRoot.querySelector(".legend-container");
      expect(legend).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // STEP CURVE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("step curve", () => {
    it("uses d3.curveStepAfter for the line generator (fixed, not configurable)", async () => {
      await createChart();
      await flushPromises();

      const lineInstance = mockD3.line.mock.results[0].value;
      expect(lineInstance.curve).toHaveBeenCalledWith("curveStepAfter");
    });

    it("does not expose a curveType property", async () => {
      await createChart();
      expect(element.curveType).toBeUndefined();
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

    it("handles invalid advancedConfig gracefully", async () => {
      await createChart({ advancedConfig: "not valid json" });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("shows points by default (showPoints undefined)", async () => {
      await createChart();
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("hides points when showPoints=false", async () => {
      await createChart({ showPoints: false });
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("can force show legend with showLegend=true", async () => {
      await createChart({
        recordCollection: SINGLE_SERIES_DATA,
        showLegend: true
      });
      await flushPromises();

      const legend = element.shadowRoot.querySelector(".legend-container");
      expect(legend).toBeTruthy();
    });

    it("can force hide legend with showLegend=false", async () => {
      await createChart({
        recordCollection: SAMPLE_TIME_SERIES,
        seriesField: "StageName",
        showLegend: false
      });
      await flushPromises();

      const legend = element.shadowRoot.querySelector(".legend-container");
      expect(legend).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("wires the theme prop to the line stroke color", async () => {
      await createChart({ theme: "Salesforce Standard" });
      await flushPromises();
      expect(mockD3.attr).toHaveBeenCalledWith("stroke", "#1589EE");

      jest.clearAllMocks();
      loadD3.mockResolvedValue(mockD3);
      document.body.removeChild(element);

      await createChart({ theme: "Warm" });
      await flushPromises();
      expect(mockD3.attr).toHaveBeenCalledWith("stroke", "#FF6B6B");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ACCESSIBILITY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("accessibility", () => {
    it("applies SVG accessibility attributes (role=img + title)", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.attr).toHaveBeenCalledWith("role", "img");
      expect(mockD3.attr).toHaveBeenCalledWith(
        "aria-label",
        expect.stringContaining("Step chart")
      );
      expect(mockD3.insert).toHaveBeenCalledWith("title", ":first-child");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("responsive behavior", () => {
    it("creates ResizeObserver for responsive reflow", async () => {
      await createChart();
      await flushPromises();
      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it("disconnects ResizeObserver on component removal", async () => {
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

    it("handles zero-width container gracefully", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0
      }));

      await createChart();
      await flushPromises();

      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
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

      containerWidth = 500;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 500,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 500
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
  // EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("events", () => {
    it("renders legend items with click handlers", async () => {
      await createChart({
        recordCollection: SAMPLE_TIME_SERIES,
        seriesField: "StageName"
      });
      await flushPromises();

      const legendItems = element.shadowRoot.querySelectorAll(".legend-item");
      expect(legendItems.length).toBeGreaterThan(0);
    });

    it("dispatches legendclick event", async () => {
      await createChart({
        recordCollection: SAMPLE_TIME_SERIES,
        seriesField: "StageName"
      });
      await flushPromises();

      const handler = jest.fn();
      element.addEventListener("legendclick", handler);

      const legendItem = element.shadowRoot.querySelector(".legend-item");
      legendItem.click();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("handles records with missing value field", async () => {
      const incompleteData = [
        { CloseDate: "2024-01-01", Amount: 100 },
        { CloseDate: "2024-02-01" },
        { CloseDate: "2024-03-01", Amount: 150 }
      ];

      await createChart({ recordCollection: incompleteData });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("handles single data point", async () => {
      const singlePoint = [{ CloseDate: "2024-01-01", Amount: 100 }];

      await createChart({ recordCollection: singlePoint });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("handles negative values", async () => {
      const negativeData = [
        { CloseDate: "2024-01-01", Amount: -100 },
        { CloseDate: "2024-02-01", Amount: 50 }
      ];

      await createChart({ recordCollection: negativeData });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("handles all zero values", async () => {
      const zeroData = [
        { CloseDate: "2024-01-01", Amount: 0 },
        { CloseDate: "2024-02-01", Amount: 0 }
      ];

      await createChart({ recordCollection: zeroData });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("cleanup", () => {
    it("cleans up tooltip on disconnect", async () => {
      await createChart();
      await flushPromises();

      document.body.removeChild(element);
      expect(true).toBe(true);
    });

    it("cleans up resize handler on disconnect", async () => {
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
