// ABOUTME: Integration tests for d3DonutChart verifying real service interactions.
// ABOUTME: Tests real dataService aggregation, themeService colors, and chartUtils formatting against mock D3 rendering.

import { createElement } from "lwc";
import D3DonutChart from "c/d3DonutChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// ═══════════════════════════════════════════════════════════════
// MOCKS — Only external dependencies, NOT real utility services
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

jest.mock(
  "lightning/platformShowToastEvent",
  () => ({
    ShowToastEvent: jest.fn()
  }),
  { virtual: true }
);

const NAVIGATE_SYMBOL = Symbol.for("NavigationMixin.Navigate");
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const NavigationMixin = (Base) => {
      return class extends Base {
        [NAVIGATE_SYMBOL] = mockNavigate;
      };
    };
    NavigationMixin.Navigate = NAVIGATE_SYMBOL;
    return { NavigationMixin };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    attrTween: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    pie: jest.fn(() => {
      const pieFn = jest.fn((data) =>
        data.map((d, i) => ({
          data: d,
          value: d.value,
          startAngle: i * 0.5,
          endAngle: (i + 1) * 0.5
        }))
      );
      pieFn.value = jest.fn(() => pieFn);
      pieFn.sort = jest.fn(() => pieFn);
      return pieFn;
    }),
    arc: jest.fn(() => {
      const arcFn = jest.fn(() => "M0,0");
      arcFn.innerRadius = jest.fn(() => arcFn);
      arcFn.outerRadius = jest.fn(() => arcFn);
      return arcFn;
    }),
    interpolate: jest.fn(() => jest.fn(() => ({ startAngle: 0, endAngle: 1 })))
  };
  return d3;
};

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Prospecting", Amount: 100 },
  { StageName: "Prospecting", Amount: 200 },
  { StageName: "Qualification", Amount: 150 },
  { StageName: "Closed Won", Amount: 500 }
];
// After Sum aggregation by StageName: Closed Won=500, Prospecting=300, Qualification=150
// Total = 950

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

async function createChart(props = {}) {
  const element = createElement("c-d3-donut-chart", {
    is: D3DonutChart
  });

  Object.assign(element, {
    groupByField: "StageName",
    valueField: "Amount",
    operation: "Sum",
    recordCollection: SAMPLE_DATA,
    theme: "Salesforce Standard",
    ...props
  });

  document.body.appendChild(element);

  // Allow connectedCallback (async d3 load + data processing) to resolve
  await flushPromises();
  // Allow renderedCallback (chart init after state settles) to fire
  await flushPromises();

  return element;
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-donut-chart integration", () => {
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

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
  });

  // ═══════════════════════════════════════════════════════════════
  // LEGEND WITH REAL THEMESERVICE COLORS
  // ═══════════════════════════════════════════════════════════════

  describe("legend with real themeService colors", () => {
    it("legend items display correct Salesforce Standard colors", async () => {
      const element = await createChart();

      const legendColors = element.shadowRoot.querySelectorAll(".legend-color");
      expect(legendColors.length).toBe(3);

      const expectedColors = ["#1589EE", "#FF9E2C", "#4BCA81"];
      legendColors.forEach((colorEl, index) => {
        const style = colorEl.getAttribute("style");
        expect(style).toContain(expectedColors[index]);
      });
    });

    it("legend items show correct percentage from real formatPercent", async () => {
      const element = await createChart();

      const legendValues = element.shadowRoot.querySelectorAll(".legend-value");
      expect(legendValues.length).toBe(3);

      // Closed Won: 500/950 = 52.6%, Prospecting: 300/950 = 31.6%, Qualification: 150/950 = 15.8%
      expect(legendValues[0].textContent).toContain("52.6%");
      expect(legendValues[1].textContent).toContain("31.6%");
      expect(legendValues[2].textContent).toContain("15.8%");
    });

    it("legend items are sorted by value descending", async () => {
      const element = await createChart();

      const legendLabels = element.shadowRoot.querySelectorAll(".legend-label");
      expect(legendLabels.length).toBe(3);

      expect(legendLabels[0].textContent).toBe("Closed Won");
      expect(legendLabels[1].textContent).toBe("Prospecting");
      expect(legendLabels[2].textContent).toBe("Qualification");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATION RESULT VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  describe("aggregation result verification", () => {
    it("Sum operation produces correct values in D3 data call", async () => {
      await createChart({ operation: "Sum" });

      // The pie function is created by d3.pie(), then called with chartData
      const pieFnCreator = mockD3.pie;
      expect(pieFnCreator).toHaveBeenCalled();

      // Get the pie function that was returned from d3.pie()
      const pieFn = pieFnCreator.mock.results[0].value;
      expect(pieFn).toHaveBeenCalled();

      // Verify the data passed to the pie layout
      const dataPassedToPie = pieFn.mock.calls[0][0];
      expect(dataPassedToPie).toEqual([
        { label: "Closed Won", value: 500 },
        { label: "Prospecting", value: 300 },
        { label: "Qualification", value: 150 }
      ]);
    });

    it("Count operation produces correct values", async () => {
      await createChart({ operation: "Count" });

      const pieFnCreator = mockD3.pie;
      expect(pieFnCreator).toHaveBeenCalled();

      const pieFn = pieFnCreator.mock.results[0].value;
      expect(pieFn).toHaveBeenCalled();

      // Count: Prospecting=2, Closed Won=1, Qualification=1
      // Sorted descending by value: Prospecting=2 first, then tied at 1
      const dataPassedToPie = pieFn.mock.calls[0][0];
      expect(dataPassedToPie[0]).toEqual({ label: "Prospecting", value: 2 });
      expect(dataPassedToPie[0].value).toBeGreaterThan(
        dataPassedToPie[1].value
      );
      expect(dataPassedToPie[1].value).toBe(1);
      expect(dataPassedToPie[2].value).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EVENT PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("event pipeline integration", () => {
    it("slice click registers D3 click handler when objectApiName is set", async () => {
      const element = await createChart({
        objectApiName: "Opportunity",
        filterField: "StageName"
      });

      // Verify D3 on('click') was registered during renderChart
      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);

      // Verify the component has objectApiName configured for navigation
      expect(element.objectApiName).toBe("Opportunity");
    });

    it("legend click triggers sliceclick event with correct detail", async () => {
      const element = await createChart({
        objectApiName: "Opportunity",
        groupByField: "StageName",
        filterField: ""
      });

      const sliceclickHandler = jest.fn();
      element.addEventListener("sliceclick", sliceclickHandler);

      // Click the first legend item (Closed Won, value 500)
      const legendItems = element.shadowRoot.querySelectorAll(".legend-item");
      expect(legendItems.length).toBeGreaterThan(0);

      legendItems[0].click();

      expect(sliceclickHandler).toHaveBeenCalledTimes(1);

      const eventDetail = sliceclickHandler.mock.calls[0][0].detail;
      expect(eventDetail.label).toBe("Closed Won");
      expect(eventDetail.value).toBe(500);
      // When filterField is empty, falls back to groupByField
      expect(eventDetail.filterField).toBe("StageName");
    });

    it("legend click with filterField uses filterField over groupByField", async () => {
      const element = await createChart({
        objectApiName: "Opportunity",
        groupByField: "StageName",
        filterField: "Custom__c"
      });

      const sliceclickHandler = jest.fn();
      element.addEventListener("sliceclick", sliceclickHandler);

      const legendItems = element.shadowRoot.querySelectorAll(".legend-item");
      expect(legendItems.length).toBeGreaterThan(0);

      legendItems[0].click();

      expect(sliceclickHandler).toHaveBeenCalledTimes(1);

      const eventDetail = sliceclickHandler.mock.calls[0][0].detail;
      expect(eventDetail.filterField).toBe("Custom__c");
    });
  });
});
