// ABOUTME: Integration tests for d3Gauge using real themeService and chartUtils modules.
// ABOUTME: Validates format pipeline, color flow, and tooltip integration between d3Gauge and its dependencies.

import { createElement } from "lwc";
import D3Gauge from "c/d3Gauge";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// ═══════════════════════════════════════════════════════════════
// MOCKS — Only d3Lib, Apex, and NavigationMixin are mocked.
// themeService and chartUtils use their REAL implementations.
// ═══════════════════════════════════════════════════════════════

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({ default: jest.fn() }),
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
// CONSOLE SPIES
// ═══════════════════════════════════════════════════════════════

let consoleErrorSpy;
let consoleWarnSpy;

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
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    arc: jest.fn(() => {
      const arcFn = jest.fn(() => "M0,0");
      arcFn.innerRadius = jest.fn(() => arcFn);
      arcFn.outerRadius = jest.fn(() => arcFn);
      arcFn.startAngle = jest.fn(() => arcFn);
      arcFn.endAngle = jest.fn(() => arcFn);
      arcFn.cornerRadius = jest.fn(() => arcFn);
      return arcFn;
    }),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 0);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.clamp = jest.fn(() => scale);
      return scale;
    }),
    pointer: jest.fn(() => [150, 100])
  };
  return d3;
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const createGauge = async (props = {}) => {
  const element = createElement("c-d3-gauge", { is: D3Gauge });
  Object.assign(element, { valueField: "Amount", ...props });
  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
};

// ═══════════════════════════════════════════════════════════════
// GLOBAL MOCKS
// ═══════════════════════════════════════════════════════════════

Element.prototype.getBoundingClientRect = jest.fn(() => ({
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  top: 0,
  right: 300,
  bottom: 200,
  left: 0
}));

global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this._callback = callback;
  }
  observe() {
    // Immediately fire with a synthetic entry so the component initializes
    this._callback([{ contentRect: { width: 300, height: 200 } }]);
  }
  unobserve() {}
  disconnect() {}
};

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("d3Gauge integration tests", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ═══════════════════════════════════════════════════════════════
  // FORMAT PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("format pipeline integration", () => {
    it("formats gauge value with real formatNumber and displays in D3 text", async () => {
      const records = [{ Amount: 1500 }];
      await createGauge({ recordCollection: records });

      // Real formatNumber(1500) returns '1.5K'
      const textCalls = mockD3.text.mock.calls;
      const formattedValueCalls = textCalls.filter(
        (call) => call[0] === "1.5K"
      );
      expect(formattedValueCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("formats gauge value as currency when valueFormat is currency", async () => {
      const config = { valueFormat: "currency" };
      const records = [{ Amount: 2500 }];
      await createGauge({
        recordCollection: records,
        advancedConfig: JSON.stringify(config)
      });

      // Real formatCurrency(2500) returns '$2,500'
      const textCalls = mockD3.text.mock.calls;
      const currencyCalls = textCalls.filter((call) => call[0] === "$2,500");
      expect(currencyCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("formats gauge value as percent when valueFormat is percent", async () => {
      const config = { valueFormat: "percent" };
      const records = [{ Amount: 0.75 }];
      await createGauge({
        recordCollection: records,
        advancedConfig: JSON.stringify(config)
      });

      // Real formatPercent(0.75) returns '75.0%'
      const textCalls = mockD3.text.mock.calls;
      const percentCalls = textCalls.filter((call) => call[0] === "75.0%");
      expect(percentCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // COLOR FLOW INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("color flow integration", () => {
    it("uses real themeService Salesforce Standard color for value arc", async () => {
      const records = [{ Amount: 50 }];
      await createGauge({
        recordCollection: records,
        theme: "Salesforce Standard"
      });

      // Real getColor('Salesforce Standard', 0) returns '#1589EE'
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#1589EE"
      );
      expect(fillCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("zone color overrides theme color", async () => {
      const config = {
        zones: [
          { min: 0, max: 50, color: "#FF0000" },
          { min: 50, max: 100, color: "#00FF00" }
        ]
      };
      const records = [{ Amount: 75 }];
      await createGauge({
        recordCollection: records,
        advancedConfig: JSON.stringify(config)
      });

      // Value 75 falls in zone {min:50, max:100}, so fill should be '#00FF00'
      const attrCalls = mockD3.attr.mock.calls;
      const zoneFillCalls = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#00FF00"
      );
      expect(zoneFillCalls.length).toBeGreaterThanOrEqual(1);

      // The theme default '#1589EE' should NOT appear as a fill
      const themeFillCalls = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#1589EE"
      );
      expect(themeFillCalls.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("tooltip integration", () => {
    it("real createTooltip creates functional DOM tooltip element", async () => {
      const records = [{ Amount: 60 }];
      const element = await createGauge({ recordCollection: records });

      // Real createTooltip appends a div with class 'slds-popover' to the container
      const container = element.shadowRoot.querySelector(".chart-container");
      const tooltipDiv = container.querySelector(".slds-popover");
      expect(tooltipDiv).not.toBeNull();
      expect(tooltipDiv.getAttribute("role")).toBe("tooltip");

      // The tooltip should also have a body child
      const tooltipBody = tooltipDiv.querySelector(".slds-popover__body");
      expect(tooltipBody).not.toBeNull();
    });
  });
});
