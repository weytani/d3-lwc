// ABOUTME: Integration tests for d3BubbleChart verifying real service pipelines (dataService, themeService, chartUtils).
// ABOUTME: Only D3, Apex, NavigationMixin, and ShowToastEvent are mocked; all utility services use real implementations.

import { createElement } from "lwc";
import D3BubbleChart from "c/d3BubbleChart";
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
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      scale.clamp = jest.fn(() => scale);
      return scale;
    }),
    scaleSqrt: jest.fn(() => {
      const scale = jest.fn(() => 12);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    scaleOrdinal: jest.fn(() => {
      const scale = jest.fn(() => "#1589EE");
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    extent: jest.fn(() => [0, 500]),
    axisBottom: jest.fn(() => {
      const axis = jest.fn();
      axis.ticks = jest.fn(() => axis);
      axis.tickFormat = jest.fn(() => axis);
      return axis;
    }),
    axisLeft: jest.fn(() => {
      const axis = jest.fn();
      axis.ticks = jest.fn(() => axis);
      axis.tickFormat = jest.fn(() => axis);
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    max: jest.fn(() => 500),
    insert: jest.fn(() => mockD3)
  };
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  {
    Id: "001A",
    Amount: 100,
    Probability: 20,
    Forecast_Units__c: 5,
    Name: "Acme"
  },
  {
    Id: "001B",
    Amount: 200,
    Probability: 40,
    Forecast_Units__c: 15,
    Name: "Globex"
  },
  {
    Id: "001C",
    Amount: 150,
    Probability: 60,
    Forecast_Units__c: 10,
    Name: "Initech"
  },
  {
    Id: "001D",
    Amount: 500,
    Probability: 80,
    Forecast_Units__c: 40,
    Name: "Umbrella"
  }
];

// Uses process.nextTick so it works regardless of fake/real timers
const flushPromises = () => new Promise(process.nextTick);

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-bubble-chart integration", () => {
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
   * Helper to create a d3BubbleChart element with default and overridden properties.
   * @param {Object} props - Property overrides
   * @returns {HTMLElement} - The created element
   */
  async function createChart(props = {}) {
    element = createElement("c-d3-bubble-chart", {
      is: D3BubbleChart
    });

    Object.assign(element, {
      xAxisField: "Amount",
      yAxisField: "Probability",
      sizeField: "Forecast_Units__c",
      labelField: "Name",
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
    it("passes parsed bubble rows (x,y,size,label) to D3 data()", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].length > 0 &&
          call[0][0].x !== undefined &&
          call[0][0].size !== undefined
      );
      expect(chartDataCall).toBeTruthy();

      const passedData = chartDataCall[0];
      expect(passedData).toHaveLength(4);
      expect(passedData[0]).toEqual(
        expect.objectContaining({
          x: 100,
          y: 20,
          size: 5,
          label: "Acme"
        })
      );
      expect(passedData[3]).toEqual(
        expect.objectContaining({
          x: 500,
          y: 80,
          size: 40,
          label: "Umbrella"
        })
      );
    });

    it("filters non-numeric x/y rows in the real pipeline", async () => {
      const mixed = [
        {
          Id: "1",
          Amount: "bad",
          Probability: 10,
          Forecast_Units__c: 5,
          Name: "Bad"
        },
        {
          Id: "2",
          Amount: 200,
          Probability: 40,
          Forecast_Units__c: 15,
          Name: "Good"
        },
        {
          Id: "3",
          Amount: 300,
          Probability: 60,
          Forecast_Units__c: 25,
          Name: "Also"
        }
      ];

      await createChart({ recordCollection: mixed });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].length > 0 &&
          call[0][0].x !== undefined
      );
      expect(chartDataCall).toBeTruthy();

      const passedData = chartDataCall[0];
      // Only the two numeric rows survive
      expect(passedData).toHaveLength(2);
      const labels = passedData.map((d) => d.label).sort();
      expect(labels).toEqual(["Also", "Good"]);
    });

    it("passes SOQL query results through the same pipeline", async () => {
      const soqlResults = [
        {
          Id: "1",
          Amount: 400,
          Probability: 30,
          Forecast_Units__c: 12,
          Name: "Q1"
        },
        {
          Id: "2",
          Amount: 100,
          Probability: 70,
          Forecast_Units__c: 8,
          Name: "Q2"
        }
      ];
      executeQuery.mockResolvedValue(soqlResults);

      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery:
          "SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString:
          "SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity"
      });

      const dataCalls = mockD3.data.mock.calls;
      const chartDataCall = dataCalls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].length > 0 &&
          call[0][0].x !== undefined
      );
      expect(chartDataCall).toBeTruthy();
      expect(chartDataCall[0]).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("theme pipeline integration", () => {
    // Returns the last "fill" accessor passed to a bubble circle. The bubble
    // chart binds fill as a function on the circle data-join (so it can color
    // by category); resolve it by invoking with a datum.
    const resolvedFill = () => {
      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);
      return fillCalls[fillCalls.length - 1][1];
    };

    it("applies the first Salesforce Standard palette color to bubble fill", async () => {
      await createChart({
        theme: "Salesforce Standard",
        recordCollection: SAMPLE_DATA
      });

      // Bubble fill is a data-join accessor function; resolve it to the color.
      // With no labelField set every datum is uncategorized, so the accessor
      // returns the theme's first palette color for any input.
      const fillFn = resolvedFill();
      expect(typeof fillFn).toBe("function");
      expect(fillFn(SAMPLE_DATA[0])).toBe("#1589EE");
    });

    it("applies the first Warm palette color to bubble fill", async () => {
      await createChart({
        theme: "Warm",
        recordCollection: SAMPLE_DATA
      });

      const fillFn = resolvedFill();
      expect(fillFn(SAMPLE_DATA[0])).toBe("#FF6B6B");
    });

    it("uses custom colors from advancedConfig over the theme", async () => {
      await createChart({
        theme: "Salesforce Standard",
        advancedConfig: '{"customColors":["#AA0000"]}',
        recordCollection: SAMPLE_DATA
      });

      const fillFn = resolvedFill();
      expect(fillFn(SAMPLE_DATA[0])).toBe("#AA0000");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SIZE-ENCODING PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("size encoding pipeline integration", () => {
    it("uses real scaleSqrt mock and binds radius to size via the radius scale", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });

      // scaleSqrt was invoked to build the radius scale (sqrt area encoding)
      expect(mockD3.scaleSqrt).toHaveBeenCalled();

      // The animated radius is bound via an (d) => radiusScale(d.size) function
      const attrCalls = mockD3.attr.mock.calls;
      const rCalls = attrCalls.filter((call) => call[0] === "r");
      expect(rCalls.length).toBeGreaterThan(0);

      // At least one r binding is a function (the size-driven transition target)
      const rFnCall = rCalls.find((c) => typeof c[1] === "function");
      expect(rFnCall).toBeTruthy();
      // Invoking the radius function does not throw and returns the mock radius
      expect(rFnCall[1]({ size: 40 })).toBe(12);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("validation pipeline integration", () => {
    it("shows error when required field is missing from data", async () => {
      const missingFieldData = [
        { WrongX: 1, WrongY: 2, WrongSize: 3 },
        { WrongX: 4, WrongY: 5, WrongSize: 6 }
      ];

      await createChart({ recordCollection: missingFieldData });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain("Missing required fields");
    });

    it("shows error when no data source is provided", async () => {
      await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery: ""
      });

      await flushPromises();

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

      expect(global.ResizeObserver).toHaveBeenCalled();
      expect(resizeObserverCallback).toBeTruthy();

      const selectCallsBefore = mockD3.select.mock.calls.length;

      jest.useFakeTimers();
      resizeObserverCallback([{ contentRect: { width: 600, height: 400 } }]);
      jest.advanceTimersByTime(250);
      jest.useRealTimers();
      await flushPromises();

      const selectCallsAfter = mockD3.select.mock.calls.length;
      expect(selectCallsAfter).toBeGreaterThan(selectCallsBefore);
    });
  });
});
