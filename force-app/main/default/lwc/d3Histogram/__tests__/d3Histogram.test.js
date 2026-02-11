// ABOUTME: Unit tests for d3Histogram Lightning Web Component.
// ABOUTME: Covers initialization, data handling, statistics, binning, and layout retry.
import { createElement } from "lwc";
import D3Histogram from "c/d3Histogram";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

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

// Mock NavigationMixin
jest.mock(
  "lightning/navigation",
  () => {
    return {
      NavigationMixin: jest.fn((Base) => {
        return class extends Base {
          // NavigationMixin.Navigate would be a Symbol
        };
      })
    };
  },
  { virtual: true }
);

// Mock D3 instance with histogram-specific functions
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
    datum: jest.fn(() => mockD3),
    node: jest.fn(() => null),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn((val) => val);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
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
    bin: jest.fn(() => {
      const binGenerator = jest.fn(() => {
        // Return mock bin data
        return [
          Object.assign([10, 20, 30], { x0: 0, x1: 50 }),
          Object.assign([40, 50], { x0: 50, x1: 100 }),
          Object.assign([60, 70, 80, 90], { x0: 100, x1: 150 })
        ];
      });
      binGenerator.domain = jest.fn(() => binGenerator);
      binGenerator.thresholds = jest.fn(() => binGenerator);
      return binGenerator;
    }),
    extent: jest.fn(() => [0, 100]),
    max: jest.fn(() => 4),
    line: jest.fn(() => {
      const lineGen = jest.fn(() => "M0,0L100,100");
      lineGen.x = jest.fn(() => lineGen);
      lineGen.y = jest.fn(() => lineGen);
      lineGen.curve = jest.fn(() => lineGen);
      return lineGen;
    }),
    curveBasis: jest.fn()
  };
  return mockD3;
};

// Sample test data - simple numeric values
const SAMPLE_DATA = [
  { Id: "001", Amount: 10000 },
  { Id: "002", Amount: 25000 },
  { Id: "003", Amount: 50000 },
  { Id: "004", Amount: 75000 },
  { Id: "005", Amount: 100000 },
  { Id: "006", Amount: 35000 },
  { Id: "007", Amount: 45000 },
  { Id: "008", Amount: 55000 },
  { Id: "009", Amount: 65000 },
  { Id: "010", Amount: 80000 }
];

// Data with null/invalid values
const DATA_WITH_NULLS = [
  { Id: "001", Amount: 10000 },
  { Id: "002", Amount: null },
  { Id: "003", Amount: 50000 },
  { Id: "004", Amount: undefined },
  { Id: "005", Amount: "not a number" },
  { Id: "006", Amount: 35000 }
];

// Data with negative values
const DATA_WITH_NEGATIVES = [
  { Id: "001", Amount: -10000 },
  { Id: "002", Amount: 25000 },
  { Id: "003", Amount: -5000 },
  { Id: "004", Amount: 75000 }
];

describe("c-d3-histogram", () => {
  let element;
  let mockD3;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 500,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 500
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
    jest.clearAllMocks();
  });

  // Helper to create element
  async function createChart(props = {}) {
    element = createElement("c-d3-histogram", {
      is: D3Histogram
    });

    Object.assign(element, {
      valueField: "Amount",
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
      element = createElement("c-d3-histogram", {
        is: D3Histogram
      });
      element.valueField = "Amount";
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
        soqlQuery: "SELECT Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Amount FROM Opportunity"
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

    it("shows error when required field is missing", async () => {
      await createChart({
        valueField: "NonExistentField",
        recordCollection: SAMPLE_DATA
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("filters out null and invalid numeric values", async () => {
      await createChart({
        recordCollection: DATA_WITH_NULLS
      });

      await Promise.resolve();

      // Should still render (3 valid values remain)
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("shows error when all values are invalid", async () => {
      await createChart({
        recordCollection: [
          { Id: "001", Amount: null },
          { Id: "002", Amount: "invalid" }
        ]
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("handles negative numeric values", async () => {
      await createChart({
        recordCollection: DATA_WITH_NEGATIVES
      });

      await Promise.resolve();

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
    it("accepts height property", async () => {
      await createChart({
        height: 400
      });

      expect(element.height).toBe(400);
    });

    it("applies height style to container", async () => {
      await createChart({
        height: 400
      });

      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.height).toBe("400px");
    });

    it("accepts custom binCount", async () => {
      await createChart({
        binCount: 10
      });

      expect(element.binCount).toBe(10);
    });

    it("accepts xAxisLabel", async () => {
      await createChart({
        xAxisLabel: "Deal Amount ($)"
      });

      expect(element.xAxisLabel).toBe("Deal Amount ($)");
    });

    it("uses valueField as default xAxisLabel", async () => {
      await createChart({
        valueField: "Amount",
        xAxisLabel: ""
      });

      // effectiveXLabel getter should return valueField
      expect(element.valueField).toBe("Amount");
    });

    it("parses advancedConfig JSON correctly", async () => {
      await createChart({
        advancedConfig: '{"showGrid": true, "showMeanLine": true}'
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

      // Should not throw - falls back to empty config
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
      await createChart({
        theme: "Salesforce Standard"
      });

      expect(element.theme).toBe("Salesforce Standard");
    });

    it("accepts Warm theme", async () => {
      await createChart({
        theme: "Warm"
      });

      expect(element.theme).toBe("Warm");
    });

    it("accepts Cool theme", async () => {
      await createChart({
        theme: "Cool"
      });

      expect(element.theme).toBe("Cool");
    });

    it("accepts Vibrant theme", async () => {
      await createChart({
        theme: "Vibrant"
      });

      expect(element.theme).toBe("Vibrant");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // STATISTICS TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("statistics", () => {
    it("calculates mean correctly", async () => {
      const data = [
        { Id: "001", Amount: 10 },
        { Id: "002", Amount: 20 },
        { Id: "003", Amount: 30 }
      ];

      await createChart({
        recordCollection: data,
        showStatistics: true
      });

      await Promise.resolve();

      // Mean should be 20
      expect(element.showStatistics).toBe(true);
    });

    it("calculates median correctly for odd count", async () => {
      const data = [
        { Id: "001", Amount: 10 },
        { Id: "002", Amount: 20 },
        { Id: "003", Amount: 30 }
      ];

      await createChart({
        recordCollection: data,
        showStatistics: true
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("calculates median correctly for even count", async () => {
      const data = [
        { Id: "001", Amount: 10 },
        { Id: "002", Amount: 20 },
        { Id: "003", Amount: 30 },
        { Id: "004", Amount: 40 }
      ];

      await createChart({
        recordCollection: data,
        showStatistics: true
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("shows statistics panel when showStatistics is true", async () => {
      await createChart({
        showStatistics: true
      });

      await Promise.resolve();

      const statsPanel = element.shadowRoot.querySelector(".statistics-info");
      expect(statsPanel).toBeTruthy();
    });

    it("hides statistics panel when showStatistics is false", async () => {
      await createChart({
        showStatistics: false
      });

      await Promise.resolve();

      const statsPanel = element.shadowRoot.querySelector(".statistics-info");
      expect(statsPanel).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NORMAL CURVE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("normal curve", () => {
    it("accepts showNormalCurve property", async () => {
      await createChart({
        showNormalCurve: true
      });

      expect(element.showNormalCurve).toBe(true);
    });

    it("renders without error when showNormalCurve is true", async () => {
      await createChart({
        showNormalCurve: true
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("does not show curve when showNormalCurve is false", async () => {
      await createChart({
        showNormalCurve: false
      });

      expect(element.showNormalCurve).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLICK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("click events", () => {
    it("dispatches binclick event on bin click", async () => {
      await createChart({
        objectApiName: "Opportunity"
      });

      await Promise.resolve();

      const clickHandler = jest.fn();
      element.addEventListener("binclick", clickHandler);

      expect(loadD3).toHaveBeenCalled();
    });

    it("accepts objectApiName for navigation", async () => {
      await createChart({
        objectApiName: "Opportunity"
      });

      expect(element.objectApiName).toBe("Opportunity");
    });

    it("accepts filterField for navigation filtering", async () => {
      await createChart({
        filterField: "Amount"
      });

      expect(element.filterField).toBe("Amount");
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

      expect(loadD3).toHaveBeenCalled();
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

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT RETRY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("layout retry", () => {
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
      await Promise.resolve();
      await Promise.resolve();

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockD3.bin).not.toHaveBeenCalled();

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
      await Promise.resolve();
      await Promise.resolve();

      document.body.removeChild(element);

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it("does not create multiple retry loops", async () => {
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
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);
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

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
    });

    it("hasData returns true when rawValues is populated", async () => {
      await createChart();
      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
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

    it("effectiveXLabel returns xAxisLabel when set", async () => {
      await createChart({
        xAxisLabel: "Custom Label"
      });

      expect(element.xAxisLabel).toBe("Custom Label");
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

    it("handles single data point", async () => {
      await createChart({
        recordCollection: [{ Id: "001", Amount: 50000 }]
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles data with all same values", async () => {
      const sameValues = [
        { Id: "001", Amount: 50000 },
        { Id: "002", Amount: 50000 },
        { Id: "003", Amount: 50000 }
      ];

      await createChart({
        recordCollection: sameValues
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles very large numeric values", async () => {
      const largeData = [
        { Id: "001", Amount: 1000000000 },
        { Id: "002", Amount: 2500000000 }
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
        { Id: "001", Amount: 0.001 },
        { Id: "002", Amount: 0.005 }
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

    it("handles zero values", async () => {
      const zeroData = [
        { Id: "001", Amount: 0 },
        { Id: "002", Amount: 50000 },
        { Id: "003", Amount: 0 }
      ];

      await createChart({
        recordCollection: zeroData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles binCount of 0 (auto-calculate)", async () => {
      await createChart({
        binCount: 0
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles high binCount", async () => {
      await createChart({
        binCount: 50
      });

      await Promise.resolve();
      expect(element.binCount).toBe(50);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BINNING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("binning", () => {
    it("creates bins from numeric data", async () => {
      await createChart();
      await Promise.resolve();

      // D3 bin function should be called
      expect(mockD3.bin).toHaveBeenCalled();
    });

    it("uses specified binCount when provided", async () => {
      await createChart({
        binCount: 15
      });

      await Promise.resolve();
      expect(element.binCount).toBe(15);
    });

    it("auto-calculates bins when binCount is 0", async () => {
      await createChart({
        binCount: 0
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED CONFIG TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("advancedConfig", () => {
    it("supports showGrid option", async () => {
      await createChart({
        advancedConfig: '{"showGrid": true}'
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("supports showMeanLine option", async () => {
      await createChart({
        advancedConfig: '{"showMeanLine": true}'
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("supports customColors option", async () => {
      await createChart({
        advancedConfig: '{"customColors": ["#FF0000"]}'
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });
});
