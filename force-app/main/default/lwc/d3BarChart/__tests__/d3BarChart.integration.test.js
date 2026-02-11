// ABOUTME: Integration tests for d3BarChart verifying real service pipelines (dataService, themeService, chartUtils).
// ABOUTME: Only D3, Apex, NavigationMixin, and ShowToastEvent are mocked; all utility services use real implementations.

import { createElement } from "lwc";
import D3BarChart from "c/d3BarChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
// ShowToastEvent is imported by the component; we mock it below

// ═══════════════════════════════════════════════════════════════
// MOCKS — Only external dependencies that cannot run in JSDOM
// Real services (dataService, themeService, chartUtils) are NOT mocked
// ═══════════════════════════════════════════════════════════════

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

// ShowToastEvent mock must produce real Event instances so dispatchEvent() accepts them.
// The factory is self-contained to work with jest.mock hoisting.
jest.mock(
  "lightning/platformShowToastEvent",
  () => {
    const Mock = jest.fn((params) => {
      return new CustomEvent("lightning__showtoast", { detail: params });
    });
    return { ShowToastEvent: Mock };
  },
  { virtual: true }
);

const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const Navigate = Symbol.for("NavigationMixin.Navigate");
    const mixin = (Base) => {
      return class extends Base {
        [Navigate] = mockNavigate;
      };
    };
    mixin.Navigate = Navigate;
    return { NavigationMixin: mixin };
  },
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
      scale.clamp = jest.fn(() => scale);
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
    max: jest.fn(() => 500)
  };
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Prospecting", Amount: 100 },
  { StageName: "Prospecting", Amount: 200 },
  { StageName: "Qualification", Amount: 150 },
  { StageName: "Closed Won", Amount: 500 }
];

// Uses process.nextTick so it works regardless of fake/real timers
const flushPromises = () => new Promise(process.nextTick);

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-bar-chart integration", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let resizeObserverCallback;

  beforeEach(() => {
    jest.clearAllMocks();

    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);

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

    // Capture the ResizeObserver callback so tests can trigger it
    resizeObserverCallback = null;
    global.ResizeObserver = jest.fn().mockImplementation((cb) => {
      resizeObserverCallback = cb;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
      };
    });
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
  });

  /**
   * Helper to create a d3BarChart element with default and overridden properties.
   * @param {Object} props - Property overrides
   * @returns {HTMLElement} - The created element
   */
  async function createChart(props = {}) {
    element = createElement("c-d3-bar-chart", {
      is: D3BarChart
    });

    Object.assign(element, {
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Sum",
      recordCollection: SAMPLE_DATA,
      ...props
    });

    document.body.appendChild(element);

    // Flush async: connectedCallback -> loadD3 -> loadData -> renderedCallback
    await flushPromises();
    await flushPromises();

    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("data pipeline integration", () => {
    it("aggregates recordCollection data with Sum operation and passes to D3 data()", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        operation: "Sum",
        groupByField: "StageName",
        valueField: "Amount"
      });

      // Real aggregateData with Sum: Closed Won=500, Prospecting=300, Qualification=150 (desc)
      const dataCalls = mockD3.data.mock.calls;
      expect(dataCalls.length).toBeGreaterThan(0);

      // Find the call that received chart data (array of {label, value} objects)
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
      );
      expect(chartDataCall).toBeTruthy();

      const passedData = chartDataCall[0];
      expect(passedData).toEqual([
        { label: "Closed Won", value: 500 },
        { label: "Prospecting", value: 300 },
        { label: "Qualification", value: 150 }
      ]);
    });

    it("aggregates with Count operation correctly", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        operation: "Count",
        groupByField: "StageName",
        valueField: "Amount"
      });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
      );
      expect(chartDataCall).toBeTruthy();

      const passedData = chartDataCall[0];
      // Count: Prospecting=2, Qualification=1, Closed Won=1 (sorted desc by value)
      expect(passedData[0]).toEqual({ label: "Prospecting", value: 2 });
      expect(passedData[1].value).toBe(1);
      expect(passedData[2].value).toBe(1);
      // The two with value=1 could be in either order since sort is stable for equal values
      const onesLabels = passedData
        .filter((d) => d.value === 1)
        .map((d) => d.label)
        .sort();
      expect(onesLabels).toEqual(["Closed Won", "Qualification"]);
    });

    it("aggregates with Average operation correctly", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        operation: "Average",
        groupByField: "StageName",
        valueField: "Amount"
      });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
      );
      expect(chartDataCall).toBeTruthy();

      const passedData = chartDataCall[0];
      // Average: Closed Won=500/1=500, Prospecting=(100+200)/2=150, Qualification=150/1=150
      // Sorted desc: Closed Won=500, then Prospecting=150 and Qualification=150 (equal)
      expect(passedData[0]).toEqual({ label: "Closed Won", value: 500 });
      expect(passedData[1].value).toBe(150);
      expect(passedData[2].value).toBe(150);
    });

    it("passes SOQL query results through same pipeline", async () => {
      const soqlResults = [
        { StageName: "Negotiation", Amount: 400 },
        { StageName: "Negotiation", Amount: 100 },
        { StageName: "Closed Lost", Amount: 250 }
      ];
      executeQuery.mockResolvedValue(soqlResults);

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT StageName, Amount FROM Opportunity",
        operation: "Sum",
        groupByField: "StageName",
        valueField: "Amount"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT StageName, Amount FROM Opportunity"
      });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
      );
      expect(chartDataCall).toBeTruthy();

      const passedData = chartDataCall[0];
      // Sum: Negotiation=500, Closed Lost=250 (sorted desc)
      expect(passedData).toEqual([
        { label: "Negotiation", value: 500 },
        { label: "Closed Lost", value: 250 }
      ]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("theme pipeline integration", () => {
    it("applies Salesforce Standard palette colors to bar fills", async () => {
      await createChart({
        theme: "Salesforce Standard",
        recordCollection: SAMPLE_DATA,
        operation: "Sum"
      });

      // Real getColors for 'Salesforce Standard' returns:
      // ['#1589EE', '#FF9E2C', '#4BCA81', ...] sliced to count
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((call) => call[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);

      // The fill attr receives a function: (d, i) => colors[i]
      const fillFn = fillCalls[fillCalls.length - 1][1];
      expect(typeof fillFn).toBe("function");

      // First bar should get the first Salesforce Standard color
      const firstColor = fillFn({}, 0);
      expect(firstColor).toBe("#1589EE");

      // Second bar gets the second color
      const secondColor = fillFn({}, 1);
      expect(secondColor).toBe("#FF9E2C");

      // Third bar gets the third color
      const thirdColor = fillFn({}, 2);
      expect(thirdColor).toBe("#4BCA81");
    });

    it("applies Warm palette colors correctly", async () => {
      await createChart({
        theme: "Warm",
        recordCollection: SAMPLE_DATA,
        operation: "Sum"
      });

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((call) => call[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);

      const fillFn = fillCalls[fillCalls.length - 1][1];
      expect(typeof fillFn).toBe("function");

      // Warm palette starts with '#FF6B6B'
      const firstColor = fillFn({}, 0);
      expect(firstColor).toBe("#FF6B6B");
    });

    it("uses custom colors from advancedConfig over theme", async () => {
      await createChart({
        theme: "Salesforce Standard",
        advancedConfig: '{"customColors":["#AA0000","#00AA00","#0000AA"]}',
        recordCollection: SAMPLE_DATA,
        operation: "Sum"
      });

      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((call) => call[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);

      const fillFn = fillCalls[fillCalls.length - 1][1];
      expect(typeof fillFn).toBe("function");

      // Custom colors override the theme palette
      expect(fillFn({}, 0)).toBe("#AA0000");
      expect(fillFn({}, 1)).toBe("#00AA00");
      expect(fillFn({}, 2)).toBe("#0000AA");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TRUNCATION PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("truncation pipeline integration", () => {
    it("truncates data at 2000 records and dispatches toast", async () => {
      const largeData = Array.from({ length: 2500 }, (_, i) => ({
        StageName: `Stage${i % 5}`,
        Amount: (i + 1) * 10
      }));

      element = createElement("c-d3-bar-chart", {
        is: D3BarChart
      });

      // Capture dispatched events via listener before appending to DOM
      const toastHandler = jest.fn();
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
      await flushPromises();

      // The component dispatches a ShowToastEvent for truncation warning
      expect(toastHandler).toHaveBeenCalled();
      const toastDetail = toastHandler.mock.calls[0][0].detail;
      expect(toastDetail.title).toBe("Data Truncated");
      expect(toastDetail.variant).toBe("warning");

      // Verify the component rendered the chart container (not stuck in error/loading)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();

      // Verify D3 was used for rendering (scaleBand is called during renderChart)
      expect(mockD3.scaleBand).toHaveBeenCalled();
    });

    it("does not truncate data under 2000 records", async () => {
      const normalData = Array.from({ length: 100 }, (_, i) => ({
        StageName: `Stage${i % 10}`,
        Amount: (i + 1) * 5
      }));

      element = createElement("c-d3-bar-chart", {
        is: D3BarChart
      });

      const toastHandler = jest.fn();
      element.addEventListener("lightning__showtoast", toastHandler);

      Object.assign(element, {
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum",
        recordCollection: normalData
      });

      document.body.appendChild(element);

      await flushPromises();
      await flushPromises();

      // No truncation toast should have been dispatched
      expect(toastHandler).not.toHaveBeenCalled();

      // Chart should render normally
      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) && call[0].length > 0 && call[0][0].label
      );
      expect(chartDataCall).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("validation pipeline integration", () => {
    it("shows error when required field is missing from data", async () => {
      // Data records lack the groupByField ('StageName')
      const missingFieldData = [
        { WrongField: "A", Amount: 100 },
        { WrongField: "B", Amount: 200 }
      ];

      await createChart({
        recordCollection: missingFieldData,
        groupByField: "StageName",
        valueField: "Amount"
      });

      await flushPromises();

      // Component should display error state
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain("Missing required fields");
    });

    it("shows error when data is empty array", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await flushPromises();

      // Component should display error state for no data source
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESIZE PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("resize pipeline integration", () => {
    it("real createResizeHandler triggers chart re-render on resize", async () => {
      await createChart();

      // ResizeObserver should have been constructed by real createResizeHandler
      expect(global.ResizeObserver).toHaveBeenCalled();
      expect(resizeObserverCallback).toBeTruthy();

      // Record how many times select has been called so far (initial render)
      const selectCallsBefore = mockD3.select.mock.calls.length;

      // Switch to fake timers to control the debounce
      jest.useFakeTimers();

      // Simulate a resize event through the captured ResizeObserver callback
      resizeObserverCallback([{ contentRect: { width: 600, height: 400 } }]);

      // Advance past the debounce delay (100ms default in createResizeHandler)
      jest.advanceTimersByTime(100);

      // Restore real timers before flushing promises
      jest.useRealTimers();
      await flushPromises();

      // select should have been called again for the re-render
      const selectCallsAfter = mockD3.select.mock.calls.length;
      expect(selectCallsAfter).toBeGreaterThan(selectCallsBefore);
    });
  });
});
