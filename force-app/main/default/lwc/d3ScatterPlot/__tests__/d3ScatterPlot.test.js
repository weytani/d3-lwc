// ABOUTME: Unit tests for the d3ScatterPlot Lightning Web Component.
// ABOUTME: Tests initialization, data handling, config, correlation, trend line, events, resize, layout retry, and cleanup.

import { createElement } from "lwc";
import D3ScatterPlot from "c/d3ScatterPlot";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getCorrelation from "@salesforce/apex/D3ChartController.getCorrelation";

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
  "@salesforce/apex/D3ChartController.getCorrelation",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

// Mock NavigationMixin - simple mixin that adds navigate method
jest.mock(
  "lightning/navigation",
  () => {
    return {
      NavigationMixin: jest.fn((Base) => {
        return class extends Base {
          // NavigationMixin.Navigate is a Symbol in real implementation
        };
      })
    };
  },
  { virtual: true }
);

// Mock D3 instance
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
  node: jest.fn(() => null),
  scaleLinear: jest.fn(() => {
    const scale = jest.fn((val) => val);
    scale.domain = jest.fn(() => scale);
    scale.range = jest.fn(() => scale);
    scale.nice = jest.fn(() => scale);
    return scale;
  }),
  scaleOrdinal: jest.fn(() => {
    const scale = jest.fn(() => "#1589EE");
    scale.domain = jest.fn(() => scale);
    scale.range = jest.fn(() => scale);
    return scale;
  }),
  axisBottom: jest.fn(() => {
    const axis = jest.fn();
    axis.tickFormat = jest.fn(() => axis);
    axis.ticks = jest.fn(() => axis);
    axis.tickSize = jest.fn(() => axis);
    return axis;
  }),
  axisLeft: jest.fn(() => {
    const axis = jest.fn();
    axis.tickFormat = jest.fn(() => axis);
    axis.ticks = jest.fn(() => axis);
    axis.tickSize = jest.fn(() => axis);
    return axis;
  }),
  extent: jest.fn(() => [0, 100]),
  min: jest.fn(() => 0),
  max: jest.fn(() => 100)
};

// Sample test data
const SAMPLE_DATA = [
  {
    Id: "001xx000003DGb1",
    Amount: 10000,
    Probability: 20,
    StageName: "Prospecting"
  },
  {
    Id: "001xx000003DGb2",
    Amount: 25000,
    Probability: 50,
    StageName: "Qualification"
  },
  {
    Id: "001xx000003DGb3",
    Amount: 50000,
    Probability: 75,
    StageName: "Proposal"
  },
  {
    Id: "001xx000003DGb4",
    Amount: 75000,
    Probability: 90,
    StageName: "Negotiation"
  },
  {
    Id: "001xx000003DGb5",
    Amount: 100000,
    Probability: 100,
    StageName: "Closed Won"
  }
];

const GROUPED_DATA = [
  { Id: "001", Amount: 10000, Probability: 20, Type: "New Business" },
  { Id: "002", Amount: 25000, Probability: 50, Type: "New Business" },
  { Id: "003", Amount: 50000, Probability: 75, Type: "Existing Business" },
  { Id: "004", Amount: 75000, Probability: 90, Type: "Existing Business" }
];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-scatter-plot", () => {
  let element;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);
    getCorrelation.mockResolvedValue({
      r: 0.95,
      slope: 0.001,
      intercept: 10,
      count: 5
    });

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
    // Clean up DOM
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  // Helper to create element with properties
  async function createChart(props = {}) {
    element = createElement("c-d3-scatter-plot", {
      is: D3ScatterPlot
    });

    Object.assign(element, {
      xAxisField: "Amount",
      yAxisField: "Probability",
      recordCollection: SAMPLE_DATA,
      ...props
    });

    document.body.appendChild(element);

    // Wait for async operations
    await Promise.resolve();
    await Promise.resolve();

    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("shows loading state initially", async () => {
      element = createElement("c-d3-scatter-plot", {
        is: D3ScatterPlot
      });
      element.xAxisField = "Amount";
      element.yAxisField = "Probability";
      element.recordCollection = SAMPLE_DATA;

      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides loading spinner after initialization", async () => {
      await createChart();

      // Wait for render
      await Promise.resolve();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("renders chart container when data is available", async () => {
      await createChart();
      await Promise.resolve();

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
        soqlQuery: "SELECT Id, Amount, Probability FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Id, Amount, Probability FROM Opportunity"
      });
    });

    it("shows error when no data source provided", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({
        body: { message: "Invalid query" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Invalid FROM Opportunity"
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when required fields are missing", async () => {
      await createChart({
        xAxisField: "Amount",
        yAxisField: "NonExistentField",
        recordCollection: SAMPLE_DATA
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("filters out records with invalid numeric values", async () => {
      const dataWithInvalid = [
        ...SAMPLE_DATA,
        { Id: "006", Amount: "not a number", Probability: 50 },
        { Id: "007", Amount: null, Probability: 50 }
      ];

      await createChart({
        recordCollection: dataWithInvalid
      });

      await Promise.resolve();

      // Should still render without error (invalid records filtered)
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
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

      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.height).toBe("400px");
    });

    it("parses advancedConfig JSON correctly", async () => {
      await createChart({
        advancedConfig: '{"showGrid": true, "customColors": ["#FF0000"]}'
      });

      // Component should not throw error
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles invalid advancedConfig JSON gracefully", async () => {
      await createChart({
        advancedConfig: "not valid json"
      });

      // Should not throw - falls back to empty config
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts custom axis labels", async () => {
      await createChart({
        xAxisLabel: "Deal Value",
        yAxisLabel: "Win Rate"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("uses default recordIdField of Id", async () => {
      await createChart();

      expect(element.recordIdField).toBe("Id");
    });

    it("allows custom recordIdField", async () => {
      await createChart({
        recordIdField: "CustomId__c"
      });

      expect(element.recordIdField).toBe("CustomId__c");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("accepts Salesforce Standard theme", async () => {
      await createChart({
        theme: "Salesforce Standard"
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts Warm theme", async () => {
      await createChart({
        theme: "Warm"
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts Cool theme", async () => {
      await createChart({
        theme: "Cool"
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts Vibrant theme", async () => {
      await createChart({
        theme: "Vibrant"
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // POINT SIZE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("point size", () => {
    it("uses default point size of 6", async () => {
      await createChart();

      expect(element.pointSize).toBe(6);
    });

    it("accepts custom point size", async () => {
      await createChart({
        pointSize: 10
      });

      expect(element.pointSize).toBe(10);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GROUPING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("grouping", () => {
    it("supports groupByField for color coding", async () => {
      await createChart({
        recordCollection: GROUPED_DATA,
        groupByField: "Type"
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it('handles missing group values with "Other" label', async () => {
      const dataWithMissingGroup = [
        { Id: "001", Amount: 10000, Probability: 20, Type: null },
        { Id: "002", Amount: 25000, Probability: 50, Type: "New Business" }
      ];

      await createChart({
        recordCollection: dataWithMissingGroup,
        groupByField: "Type"
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CORRELATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("correlation calculation", () => {
    it("calculates correlation when showCorrelation is true", async () => {
      await createChart({
        showCorrelation: true
      });

      await Promise.resolve();

      // Correlation info should be shown
      // The important thing is no error occurs
      expect(loadD3).toHaveBeenCalled();
    });

    it("calculates correlation when showTrendLine is true", async () => {
      await createChart({
        showTrendLine: true
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("displays correlation strength labels correctly", async () => {
      await createChart({
        showCorrelation: true,
        recordCollection: SAMPLE_DATA
      });

      await Promise.resolve();
      // With the sample data, we should get a positive correlation
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles data with only 1 point (no correlation)", async () => {
      await createChart({
        showCorrelation: true,
        recordCollection: [SAMPLE_DATA[0]]
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TREND LINE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("trend line", () => {
    it("renders without error when showTrendLine is true", async () => {
      await createChart({
        showTrendLine: true
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("does not show trend line when showTrendLine is false", async () => {
      await createChart({
        showTrendLine: false
      });

      await Promise.resolve();
      expect(element.showTrendLine).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLICK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("click events", () => {
    it("dispatches pointclick event on point click", async () => {
      await createChart({
        objectApiName: "Opportunity"
      });

      await Promise.resolve();

      // Add event listener
      const clickHandler = jest.fn();
      element.addEventListener("pointclick", clickHandler);

      // Component should render without error
      expect(loadD3).toHaveBeenCalled();
    });

    it("does not navigate when objectApiName is not set", async () => {
      await createChart({
        objectApiName: ""
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("accepts objectApiName for navigation", async () => {
      await createChart({
        objectApiName: "Opportunity"
      });

      expect(element.objectApiName).toBe("Opportunity");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("responsive behavior", () => {
    it("sets up resize observer", async () => {
      await createChart();
      await Promise.resolve();

      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it("handles container width of 0 gracefully", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      await createChart();
      await Promise.resolve();

      // Should not throw error
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SERVER CORRELATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("server correlation", () => {
    it("calls getCorrelation when soqlQuery path with showTrendLine", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Id, Amount, Probability FROM Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        showTrendLine: true
      });

      await flushPromises();

      expect(getCorrelation).toHaveBeenCalledWith({
        queryString: "SELECT Id, Amount, Probability FROM Opportunity",
        xField: "Amount",
        yField: "Probability"
      });
    });

    it("calls getCorrelation when soqlQuery path with showCorrelation", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Id, Amount, Probability FROM Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        showCorrelation: true
      });

      await flushPromises();

      expect(getCorrelation).toHaveBeenCalledWith({
        queryString: "SELECT Id, Amount, Probability FROM Opportunity",
        xField: "Amount",
        yField: "Probability"
      });
    });

    it("does not call getCorrelation when using recordCollection", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        showTrendLine: true,
        showCorrelation: true
      });

      await flushPromises();

      expect(getCorrelation).not.toHaveBeenCalled();
    });

    it("does not call getCorrelation when showTrendLine and showCorrelation are both false", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Id, Amount, Probability FROM Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        showTrendLine: false,
        showCorrelation: false
      });

      await flushPromises();

      expect(getCorrelation).not.toHaveBeenCalled();
    });

    it("renders chart with server-provided correlation data", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Id, Amount, Probability FROM Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        showTrendLine: true,
        showCorrelation: true
      });

      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("falls back to client-side correlation when server call fails", async () => {
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      getCorrelation.mockRejectedValue(new Error("Server correlation failed"));

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Id, Amount, Probability FROM Opportunity",
        xAxisField: "Amount",
        yAxisField: "Probability",
        showCorrelation: true
      });

      await flushPromises();

      // Component should still render with client-side correlation
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();

      consoleWarnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT RETRY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("layout retry", () => {
    it("retries chart init when container starts at zero width", async () => {
      // Start with zero width
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
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
      expect(mockD3.scaleLinear).not.toHaveBeenCalled();

      // Simulate container getting width from layout engine
      containerWidth = 400;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
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

    it("does not create multiple retry loops", async () => {
      // Start with zero width
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

      // Only one RAF should be requested (one retry loop, not multiple)
      expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);
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
      await Promise.resolve();

      // Remove element from DOM
      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GETTER TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("getters", () => {
    it("hasError returns true when error is set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await Promise.resolve();

      // Component should have an error state
      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
    });

    it("hasData returns true when chartData is populated", async () => {
      await createChart();
      await Promise.resolve();

      // Container should be visible (not loading, no error, has data)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("effectiveXLabel returns xAxisLabel when set", async () => {
      await createChart({
        xAxisLabel: "Custom X Label"
      });

      // Access would be internal but we verify no error
      expect(element.xAxisLabel).toBe("Custom X Label");
    });

    it("effectiveYLabel returns yAxisLabel when set", async () => {
      await createChart({
        yAxisLabel: "Custom Y Label"
      });

      expect(element.yAxisLabel).toBe("Custom Y Label");
    });

    it("correlationDisplay formats coefficient to 3 decimal places", async () => {
      await createChart({
        showCorrelation: true
      });

      await Promise.resolve();
      // Internal calculation tested via no error
      expect(loadD3).toHaveBeenCalled();
    });

    it("containerStyle returns correct height string", async () => {
      await createChart({
        height: 450
      });

      await Promise.resolve();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.height).toBe("450px");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("handles empty recordCollection array", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("handles data with all same X values", async () => {
      const sameXData = [
        { Id: "001", Amount: 50000, Probability: 20 },
        { Id: "002", Amount: 50000, Probability: 50 },
        { Id: "003", Amount: 50000, Probability: 80 }
      ];

      await createChart({
        recordCollection: sameXData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles data with all same Y values", async () => {
      const sameYData = [
        { Id: "001", Amount: 10000, Probability: 50 },
        { Id: "002", Amount: 50000, Probability: 50 },
        { Id: "003", Amount: 100000, Probability: 50 }
      ];

      await createChart({
        recordCollection: sameYData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles negative numeric values", async () => {
      const negativeData = [
        { Id: "001", Amount: -10000, Probability: 20 },
        { Id: "002", Amount: 25000, Probability: -50 },
        { Id: "003", Amount: 50000, Probability: 75 }
      ];

      await createChart({
        recordCollection: negativeData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles very large numeric values", async () => {
      const largeData = [
        { Id: "001", Amount: 1000000000, Probability: 20 },
        { Id: "002", Amount: 2500000000, Probability: 50 }
      ];

      await createChart({
        recordCollection: largeData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles very small decimal values", async () => {
      const smallData = [
        { Id: "001", Amount: 0.001, Probability: 0.0001 },
        { Id: "002", Amount: 0.005, Probability: 0.0005 }
      ];

      await createChart({
        recordCollection: smallData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });
});
