// ABOUTME: End-to-end lifecycle tests for the d3BubbleChart Lightning Web Component.
// ABOUTME: Verifies full pipeline: D3 load, bubble parsing, SVG rendering, cleanup, and multi-instance isolation.

import { createElement } from "lwc";
import D3BubbleChart from "c/d3BubbleChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// ═══════════════════════════════════════════════════════════════
// MOCKS — only external boundaries are mocked
// c/dataService, c/themeService, c/chartUtils use REAL implementations
// ═══════════════════════════════════════════════════════════════

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

// NavigationMixin mock — matches the Symbol.for pattern used by LWC internals
jest.mock("lightning/navigation", () => {
  const Navigate = Symbol.for("Navigate");
  const GenerateUrl = Symbol.for("GenerateUrl");
  return {
    NavigationMixin: (Base) => {
      return class extends Base {
        [Navigate] = jest.fn();
        [GenerateUrl] = jest.fn();
      };
    },
    Navigate,
    GenerateUrl
  };
});

jest.mock("lightning/platformShowToastEvent", () => {
  const ShowToastEventMock = jest.fn().mockImplementation((config) => {
    return new CustomEvent("lightning__showtoast", { detail: config });
  });
  return { ShowToastEvent: ShowToastEventMock };
});

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY
// ═══════════════════════════════════════════════════════════════

function createMockD3() {
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
    max: jest.fn(() => 500)
  };
  return mockD3;
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL MOCKS
// ═══════════════════════════════════════════════════════════════

Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 600,
  height: 300,
  top: 0,
  left: 0,
  bottom: 300,
  right: 600,
  x: 0,
  y: 0
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function flushPromises() {
  return new Promise((resolve) => {
    // Multiple micro-task ticks to allow connectedCallback + renderedCallback chain
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(resolve, 0);
  });
}

let consoleErrorSpy;

async function createChart(props = {}) {
  const element = createElement("c-d3-bubble-chart", {
    is: D3BubbleChart
  });

  Object.assign(element, {
    xAxisField: "Amount",
    yAxisField: "Probability",
    sizeField: "Forecast_Units__c",
    labelField: "Name",
    height: 300,
    recordCollection: [],
    ...props
  });

  document.body.appendChild(element);
  await flushPromises();
  return element;
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-bubble-chart e2e", () => {
  let mockD3;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Reset global mocks to clean state
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

  // ═══════════════════════════════════════════════════════════════
  // 1. FULL LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe("full lifecycle", () => {
    const LIFECYCLE_DATA = [
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

    it("create -> load D3 -> load data -> render -> verify SVG + circles", async () => {
      const element = await createChart({ recordCollection: LIFECYCLE_DATA });

      expect(loadD3).toHaveBeenCalled();
      expect(executeQuery).not.toHaveBeenCalled();
      expect(mockD3.select).toHaveBeenCalled();

      const appendCalls = mockD3.append.mock.calls;
      const svgAppended = appendCalls.some((call) => call[0] === "svg");
      expect(svgAppended).toBe(true);

      const circleAppended = appendCalls.some((call) => call[0] === "circle");
      expect(circleAppended).toBe(true);

      expect(mockD3.data).toHaveBeenCalled();
      expect(mockD3.scaleSqrt).toHaveBeenCalled();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();

      // Pristine console — no errors on the success path
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("cleanup destroys resize handler on disconnect", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      const element = await createChart({ recordCollection: LIFECYCLE_DATA });

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();

      const cleanupErrors = consoleErrorSpy.mock.calls.filter((call) =>
        String(call[0]).toLowerCase().includes("cleanup")
      );
      expect(cleanupErrors).toHaveLength(0);
    });

    it("reactive update: change recordCollection does not crash", async () => {
      const element = await createChart({ recordCollection: LIFECYCLE_DATA });

      expect(loadD3).toHaveBeenCalled();
      expect(mockD3.select).toHaveBeenCalled();

      mockD3.select.mockClear();
      mockD3.append.mockClear();
      mockD3.data.mockClear();

      element.recordCollection = [
        {
          Id: "001E",
          Amount: 999,
          Probability: 50,
          Forecast_Units__c: 30,
          Name: "New"
        }
      ];

      await flushPromises();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. ERROR RECOVERY
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery", () => {
    it("D3 load failure -> error state -> component shows error", async () => {
      loadD3.mockRejectedValue(new Error("CDN unreachable"));

      const element = await createChart({
        recordCollection: [
          {
            Id: "1",
            Amount: 100,
            Probability: 20,
            Forecast_Units__c: 5,
            Name: "A"
          }
        ]
      });

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
      expect(errorEl.textContent).toContain("CDN unreachable");

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeFalsy();
    });

    it("SOQL fetch path: no recordCollection -> Apex returns data -> full pipeline", async () => {
      const soqlData = [
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
      executeQuery.mockResolvedValue(soqlData);

      const element = await createChart({
        recordCollection: [],
        objectApiName: "",
        soqlQuery:
          "SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString:
          "SELECT Id, Amount, Probability, Forecast_Units__c, Name FROM Opportunity"
      });

      expect(loadD3).toHaveBeenCalled();
      expect(mockD3.select).toHaveBeenCalled();

      const appendCalls = mockD3.append.mock.calls;
      const svgAppended = appendCalls.some((call) => call[0] === "svg");
      expect(svgAppended).toBe(true);

      expect(mockD3.data).toHaveBeenCalled();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. MULTI-COMPONENT ISOLATION
  // ═══════════════════════════════════════════════════════════════

  describe("multi-component isolation", () => {
    it("two charts on same page have independent lifecycle", async () => {
      const mockDisconnectA = jest.fn();
      const mockDisconnectB = jest.fn();
      let roCallCount = 0;

      global.ResizeObserver = jest.fn().mockImplementation(() => {
        roCallCount += 1;
        const disconnectFn =
          roCallCount === 1 ? mockDisconnectA : mockDisconnectB;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: disconnectFn
        };
      });

      const dataA = [
        {
          Id: "A1",
          Amount: 100,
          Probability: 20,
          Forecast_Units__c: 5,
          Name: "A1"
        },
        {
          Id: "A2",
          Amount: 200,
          Probability: 40,
          Forecast_Units__c: 15,
          Name: "A2"
        }
      ];
      const dataB = [
        {
          Id: "B1",
          Amount: 300,
          Probability: 50,
          Forecast_Units__c: 20,
          Name: "B1"
        },
        {
          Id: "B2",
          Amount: 400,
          Probability: 60,
          Forecast_Units__c: 25,
          Name: "B2"
        },
        {
          Id: "B3",
          Amount: 500,
          Probability: 70,
          Forecast_Units__c: 35,
          Name: "B3"
        }
      ];

      const elementA = await createChart({
        recordCollection: dataA,
        theme: "Warm"
      });

      const elementB = await createChart({
        recordCollection: dataB,
        theme: "Cool"
      });

      const containerA = elementA.shadowRoot.querySelector(".chart-container");
      const containerB = elementB.shadowRoot.querySelector(".chart-container");
      expect(containerA).toBeTruthy();
      expect(containerB).toBeTruthy();

      document.body.removeChild(elementA);

      const containerBAfter =
        elementB.shadowRoot.querySelector(".chart-container");
      expect(containerBAfter).toBeTruthy();

      const isolationErrors = consoleErrorSpy.mock.calls.filter((call) =>
        String(call[0]).toLowerCase().includes("cleanup")
      );
      expect(isolationErrors).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. DATA FLOW VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  describe("data flow verification", () => {
    it("parsed bubble data flows through to D3 with correct values", async () => {
      const knownData = [
        {
          Id: "1",
          Amount: 100,
          Probability: 20,
          Forecast_Units__c: 5,
          Name: "A"
        },
        {
          Id: "2",
          Amount: 200,
          Probability: 40,
          Forecast_Units__c: 15,
          Name: "B"
        }
      ];

      await createChart({ recordCollection: knownData });

      expect(mockD3.data).toHaveBeenCalled();

      const dataCall = mockD3.data.mock.calls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].length > 0 &&
          call[0][0].x !== undefined &&
          call[0][0].size !== undefined
      );

      expect(dataCall).toBeTruthy();
      const boundData = dataCall[0];

      expect(boundData).toHaveLength(2);
      expect(boundData[0]).toEqual(
        expect.objectContaining({ x: 100, y: 20, size: 5, label: "A" })
      );
      expect(boundData[1]).toEqual(
        expect.objectContaining({ x: 200, y: 40, size: 15, label: "B" })
      );
    });
  });
});
