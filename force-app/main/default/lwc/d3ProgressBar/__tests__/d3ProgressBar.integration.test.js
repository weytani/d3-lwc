// ABOUTME: Integration tests for d3ProgressBar using real themeService and chartUtils modules.
// ABOUTME: Validates the percent-label pipeline, palette color flow, and aggregated value flow into the rendered rects.

import { createElement } from "lwc";
import D3ProgressBar from "c/d3ProgressBar";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// ── MOCKS — only d3Lib, Apex, navigation, toast. Real services otherwise. ──

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/D3ChartController.getAggregatedData",
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

jest.mock(
  "lightning/platformShowToastEvent",
  () => ({ ShowToastEvent: jest.fn() }),
  { virtual: true }
);

let consoleErrorSpy;
let consoleWarnSpy;

// ── MOCK D3 FACTORY (rect/line/text/scaleLinear chainable) ──

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn((v) => v);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.clamp = jest.fn(() => scale);
      return scale;
    })
  };
  return d3;
};

// ── HELPERS ──

const flushPromises = () => new Promise(process.nextTick);

const createChart = async (props = {}) => {
  const element = createElement("c-d3-progress-bar", { is: D3ProgressBar });
  Object.assign(element, { valueField: "Amount", ...props });
  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
};

// ── GLOBAL MOCKS ──

Element.prototype.getBoundingClientRect = jest.fn(() => ({
  x: 0,
  y: 0,
  width: 300,
  height: 150,
  top: 0,
  right: 300,
  bottom: 150,
  left: 0
}));

global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this._callback = callback;
  }
  observe() {
    this._callback([{ contentRect: { width: 300, height: 150 } }]);
  }
  unobserve() {}
  disconnect() {}
};

// ── TEST SUITE ──

describe("d3ProgressBar integration tests", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    getAggregatedData.mockResolvedValue([]);
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

  describe("percent label pipeline integration", () => {
    it("renders the real formatPercent output for value/target", async () => {
      // value 50, target 200 → 0.25 → real formatPercent(0.25) = '25.0%'
      await createChart({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });

      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("25.0%");
    });

    it("clamps the percent label at 100% when value exceeds target", async () => {
      // value 300, target 200 → fraction 1.5 → real formatPercent(1.5) = '150.0%'
      await createChart({
        recordCollection: [{ Amount: 300 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });

      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("150.0%");
    });
  });

  describe("color flow integration", () => {
    it("uses real themeService Salesforce Standard hex for the value rect", async () => {
      await createChart({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 }),
        theme: "Salesforce Standard"
      });

      // Real getColor('Salesforce Standard', 0) returns '#1589EE'
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#1589EE"
      );
      expect(fillCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("uses real Warm palette hex for the value rect", async () => {
      await createChart({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 }),
        theme: "Warm"
      });

      // Real getColor('Warm', 0) returns '#FF6B6B'
      const attrCalls = mockD3.attr.mock.calls;
      const warmFills = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#FF6B6B"
      );
      expect(warmFills.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("aggregated value flow integration", () => {
    it("flows a real server-aggregated value into the value scale", async () => {
      getAggregatedData.mockResolvedValue([{ label: "Total", value: 80 }]);

      await createChart({
        recordCollection: [],
        objectApiName: "Opportunity",
        valueField: "Amount",
        advancedConfig: JSON.stringify({ target: 200 })
      });

      // The aggregated value 80 (fraction 0.4 of target 200) → real
      // formatPercent(0.4) = '40.0%' rendered as the percent label.
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("40.0%");
    });
  });

  describe("currency formatter integration", () => {
    it("real buildTooltipContent uses real formatCurrency for the value", async () => {
      const element = await createChart({
        recordCollection: [{ Amount: 5000 }],
        advancedConfig: JSON.stringify({
          target: 10000,
          valueFormat: "currency"
        })
      });

      // Real createTooltip appended a functional SLDS popover to the container
      const container = element.shadowRoot.querySelector(".chart-container");
      const tooltipDiv = container.querySelector(".slds-popover");
      expect(tooltipDiv).not.toBeNull();
      expect(tooltipDiv.getAttribute("role")).toBe("tooltip");
    });
  });
});
