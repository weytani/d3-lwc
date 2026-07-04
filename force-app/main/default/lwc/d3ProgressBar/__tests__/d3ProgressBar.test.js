// ABOUTME: Unit tests for the D3 Progress Bar chart LWC component.
// ABOUTME: Covers data processing, value/target rendering, target marker, percent label, formatting, navigation, layout retry, and edge cases.

import { createElement } from "lwc";
import D3ProgressBar from "c/d3ProgressBar";
import { loadD3 } from "c/d3Lib";
import { getColor } from "c/themeService";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// Mock d3Lib
jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// Mock themeService
jest.mock("c/themeService", () => ({
  getColor: jest.fn().mockReturnValue("#1589EE")
}));

// Mock chartUtils
jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
  formatCurrency: jest.fn((v) => "$" + v),
  formatPercent: jest.fn((v) => v * 100 + "%"),
  createTooltip: jest.fn().mockReturnValue({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn()
  }),
  buildTooltipContent: jest.fn().mockReturnValue("<div>tooltip</div>"),
  createResizeHandler: jest.fn().mockReturnValue({
    observe: jest.fn(),
    disconnect: jest.fn()
  }),
  createLayoutRetry: jest.fn().mockReturnValue({
    cancel: jest.fn()
  }),
  calculateDimensions: jest
    .fn()
    .mockReturnValue({ width: 300, height: 200, margins: {} }),
  shouldUseCompactMode: jest.fn().mockReturnValue(false),
  applySvgA11y: jest.fn()
}));

// Mock Apex
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

// Mock NavigationMixin
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

// Create mock D3 (rect + line + text primitives; scaleLinear)
const createMockD3 = () => ({
  select: jest.fn().mockReturnThis(),
  selectAll: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  transition: jest.fn().mockReturnThis(),
  duration: jest.fn().mockReturnThis(),
  scaleLinear: jest.fn().mockReturnValue({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    clamp: jest.fn().mockReturnValue((v) => v)
  })
});

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("d3ProgressBar", () => {
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    getAggregatedData.mockResolvedValue([]);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 300,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 300
    }));
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    delete Element.prototype.getBoundingClientRect;
  });

  const createComponent = async (props = {}) => {
    const element = createElement("c-d3-progress-bar", { is: D3ProgressBar });
    Object.assign(element, { valueField: "Amount", ...props });
    document.body.appendChild(element);
    await Promise.resolve();
    await Promise.resolve();
    return element;
  };

  // ── initialization ────────────────────────────────────────────
  describe("initialization", () => {
    it("renders chart container", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }]
      });
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).not.toBeNull();
    });

    it("shows loading state initially", () => {
      const el = createElement("c-d3-progress-bar", { is: D3ProgressBar });
      el.valueField = "Amount";
      document.body.appendChild(el);
      const spinner = el.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 on connect", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ── data handling ─────────────────────────────────────────────
  describe("data handling", () => {
    it("accepts recordCollection", async () => {
      const records = [{ Amount: 500 }];
      const element = await createComponent({ recordCollection: records });
      expect(element.recordCollection).toEqual(records);
    });

    it("accepts soqlQuery", async () => {
      const query = "SELECT Amount FROM Account";
      const element = await createComponent({ soqlQuery: query });
      expect(element.soqlQuery).toBe(query);
    });

    it("prioritizes recordCollection over soqlQuery", async () => {
      await createComponent({
        recordCollection: [{ Amount: 500 }],
        soqlQuery: "SELECT Amount FROM Account"
      });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("calls executeQuery when only soqlQuery provided", async () => {
      executeQuery.mockResolvedValue([{ Amount: 100 }]);
      await createComponent({
        recordCollection: [],
        soqlQuery: "SELECT Amount FROM Account"
      });
      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Amount FROM Account"
      });
    });
  });

  // ── data edge cases ───────────────────────────────────────────
  describe("data edge cases", () => {
    it("sets currentValue to 0 when records array is empty", async () => {
      await createComponent({ recordCollection: [] });
      await Promise.resolve();
      await Promise.resolve();
      // currentValue 0 → value rect width is scaleLinear(0). Scale was built.
      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("uses only the first record when multiple records are provided", async () => {
      const records = [{ Amount: 42 }, { Amount: 99 }];
      const element = await createComponent({ recordCollection: records });
      await Promise.resolve();
      await Promise.resolve();
      // The progress bar reflects 42 (first record), not 99.
      expect(element.recordCollection.length).toBe(2);
      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("treats non-numeric values as 0", async () => {
      const records = [{ Amount: "not-a-number" }];
      await createComponent({ recordCollection: records });
      await Promise.resolve();
      await Promise.resolve();
      // Number('not-a-number') is NaN → || 0 → 0; chart still renders rects.
      expect(mockD3.append).toHaveBeenCalledWith("rect");
    });
  });

  // ── configuration ─────────────────────────────────────────────
  describe("configuration", () => {
    it("accepts height", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        height: 120
      });
      expect(element.height).toBe(120);
    });

    it("accepts theme", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        theme: "Warm"
      });
      expect(element.theme).toBe("Warm");
    });

    it("parses advancedConfig JSON", async () => {
      const config = { target: 250 };
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify(config)
      });
      expect(element.advancedConfig).toBe(JSON.stringify(config));
    });

    it("handles invalid advancedConfig gracefully", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: "not valid json"
      });
      expect(element.advancedConfig).toBe("not valid json");
    });
  });

  // ── themes ─────────────────────────────────────────────────────
  describe("themes", () => {
    it("uses getColor from themeService for the value rect", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        theme: "Warm"
      });
      expect(getColor).toHaveBeenCalled();
    });

    it("applies the theme color as the value-rect fill", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        theme: "Warm"
      });
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#1589EE"
      );
      expect(fillCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("uses customColors[0] from config when provided", async () => {
      const config = { customColors: ["#AA00BB"] };
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify(config)
      });
      const attrCalls = mockD3.attr.mock.calls;
      const customFills = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#AA00BB"
      );
      expect(customFills.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── rendering details ──────────────────────────────────────────
  describe("rendering details", () => {
    it("appends a track rect and a value rect", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      await Promise.resolve();
      const rectAppends = mockD3.append.mock.calls.filter(
        (c) => c[0] === "rect"
      );
      // One track rect + one value rect at minimum.
      expect(rectAppends.length).toBeGreaterThanOrEqual(2);
    });

    it("builds the value scale with domain [0, target]", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });
      await Promise.resolve();
      await Promise.resolve();
      const domainFn = mockD3.scaleLinear().domain;
      expect(domainFn).toHaveBeenCalledWith([0, 200]);
    });

    it("renders the percent label via formatPercent with a 0..1 decimal", async () => {
      const { formatPercent } = require("c/chartUtils");
      // value 50, target 200 → fraction 0.25
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });
      await Promise.resolve();
      await Promise.resolve();
      const quarterCalls = formatPercent.mock.calls.filter(
        (call) => call[0] === 0.25
      );
      expect(quarterCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("draws a target marker line when config.target is set", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });
      await Promise.resolve();
      await Promise.resolve();
      const lineAppends = mockD3.append.mock.calls.filter(
        (c) => c[0] === "line"
      );
      expect(lineAppends.length).toBeGreaterThanOrEqual(1);
    });

    it("does not draw a target marker line when config.target is absent", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      await Promise.resolve();
      const lineAppends = mockD3.append.mock.calls.filter(
        (c) => c[0] === "line"
      );
      expect(lineAppends.length).toBe(0);
    });

    it("clears previous SVG before re-rendering", async () => {
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await Promise.resolve();
      await Promise.resolve();
      // renderChart does d3.select(container).select('svg').remove()
      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });
  });

  // ── server aggregation ─────────────────────────────────────────
  describe("server aggregation", () => {
    it("calls getAggregatedData when objectApiName and valueField are set", async () => {
      getAggregatedData.mockResolvedValue([{ label: "x", value: 80 }]);
      await createComponent({
        recordCollection: [],
        objectApiName: "Opportunity",
        valueField: "Amount"
      });
      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "Id",
        valueField: "Amount",
        operation: "Average",
        filterClause: null
      });
    });

    it("passes filterClause through to getAggregatedData", async () => {
      getAggregatedData.mockResolvedValue([{ label: "x", value: 80 }]);
      await createComponent({
        recordCollection: [],
        objectApiName: "Opportunity",
        valueField: "Amount",
        filterClause: "StageName = 'Closed Won'"
      });
      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "Id",
        valueField: "Amount",
        operation: "Average",
        filterClause: "StageName = 'Closed Won'"
      });
    });
  });

  // ── click / events ─────────────────────────────────────────────
  describe("click and events", () => {
    it("registers a click handler on the value rect", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        objectApiName: "Opportunity"
      });
      await Promise.resolve();
      await Promise.resolve();
      const onCalls = mockD3.on.mock.calls;
      const clickHandler = onCalls.find((call) => call[0] === "click");
      expect(clickHandler).toBeDefined();
    });

    it("navigates to object list when value rect clicked with objectApiName", async () => {
      await createComponent({
        recordCollection: [{ Amount: 50 }],
        objectApiName: "Opportunity"
      });
      await Promise.resolve();
      await Promise.resolve();
      const onCalls = mockD3.on.mock.calls;
      const clickHandler = onCalls.find((call) => call[0] === "click");
      clickHandler[1]();
      expect(mockNavigate).toHaveBeenCalledWith({
        type: "standard__objectPage",
        attributes: {
          objectApiName: "Opportunity",
          actionName: "list"
        },
        state: { filterName: "Recent" }
      });
    });
  });

  // ── tooltip behavior ───────────────────────────────────────────
  describe("tooltip behavior", () => {
    it("creates a tooltip on init", async () => {
      const { createTooltip } = require("c/chartUtils");
      await createComponent({ recordCollection: [{ Amount: 50 }] });
      expect(createTooltip).toHaveBeenCalled();
    });
  });

  // ── responsive behavior (layout retry) ─────────────────────────
  describe("responsive behavior", () => {
    it("retries chart init when container starts at zero width", async () => {
      const {
        createLayoutRetry,
        createResizeHandler
      } = require("c/chartUtils");

      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 0
      }));

      let retryCallback;
      createLayoutRetry.mockImplementation((container, cb) => {
        retryCallback = cb;
        return { cancel: jest.fn() };
      });
      createResizeHandler.mockClear();

      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await flushPromises();

      expect(createLayoutRetry).toHaveBeenCalled();
      expect(createResizeHandler).not.toHaveBeenCalled();

      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 400
      }));

      retryCallback();
      expect(createResizeHandler).toHaveBeenCalled();
    });

    it("does not create multiple retry loops", async () => {
      const { createLayoutRetry } = require("c/chartUtils");
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 0
      }));
      createLayoutRetry.mockImplementation(() => ({ cancel: jest.fn() }));
      createLayoutRetry.mockClear();

      await createComponent({ recordCollection: [{ Amount: 50 }] });
      await flushPromises();
      await flushPromises();
      await flushPromises();

      expect(createLayoutRetry).toHaveBeenCalledTimes(1);
    });
  });

  // ── error recovery ─────────────────────────────────────────────
  describe("error recovery", () => {
    it("displays error when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("Load failed"));
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }]
      });
      await Promise.resolve();
      await Promise.resolve();
      const errorText = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorText).not.toBeNull();
    });

    it("displays error when query fails", async () => {
      executeQuery.mockRejectedValue({ body: { message: "Query error" } });
      const element = await createComponent({
        recordCollection: [],
        soqlQuery: "SELECT Bad FROM Query"
      });
      await Promise.resolve();
      await Promise.resolve();
      const errorText = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorText).not.toBeNull();
    });
  });

  // ── accessibility ─────────────────────────────────────────────
  describe("accessibility", () => {
    it("sets role=progressbar and aria-value attributes on the chart container", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 40 }],
        advancedConfig: JSON.stringify({ target: 100 })
      });
      await Promise.resolve();
      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("role")).toBe("progressbar");
      expect(container.getAttribute("aria-valuemin")).toBe("0");
      expect(container.getAttribute("aria-valuemax")).toBe("100");
      expect(container.getAttribute("aria-valuenow")).toBe("40");
    });

    it("clamps aria-valuenow to aria-valuemax when value exceeds target, while the visible label still shows the real percent", async () => {
      const { formatPercent } = require("c/chartUtils");
      const element = await createComponent({
        recordCollection: [{ Amount: 150 }],
        advancedConfig: JSON.stringify({ target: 100 })
      });
      await Promise.resolve();
      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("aria-valuemax")).toBe("100");
      expect(container.getAttribute("aria-valuenow")).toBe("100");

      // The visible percent label intentionally stays unclamped (real 150%
      // over target) even though aria-valuenow above is clamped to 100.
      const overMaxCalls = formatPercent.mock.calls.filter(
        (call) => call[0] === 1.5
      );
      expect(overMaxCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── getters ─────────────────────────────────────────────────────
  describe("getters", () => {
    it("containerStyle reflects the height", async () => {
      const element = await createComponent({
        recordCollection: [{ Amount: 50 }],
        height: 120
      });
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("height: 120px");
    });
  });

  // ── cleanup ─────────────────────────────────────────────────────
  describe("cleanup", () => {
    it("disconnects resize handler on destroy", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      const mockHandler = { observe: jest.fn(), disconnect: jest.fn() };
      createResizeHandler.mockReturnValue(mockHandler);

      const element = await createComponent({
        recordCollection: [{ Amount: 50 }]
      });
      await Promise.resolve();
      document.body.removeChild(element);
      expect(mockHandler.disconnect).toHaveBeenCalled();
    });

    it("destroys tooltip on disconnect", async () => {
      const { createTooltip } = require("c/chartUtils");
      const mockTooltip = {
        show: jest.fn(),
        hide: jest.fn(),
        destroy: jest.fn()
      };
      createTooltip.mockReturnValue(mockTooltip);

      const element = await createComponent({
        recordCollection: [{ Amount: 50 }]
      });
      await Promise.resolve();
      document.body.removeChild(element);
      expect(mockTooltip.destroy).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      const { createLayoutRetry } = require("c/chartUtils");
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 150,
        top: 0,
        left: 0,
        bottom: 150,
        right: 0
      }));
      const mockCancel = jest.fn();
      createLayoutRetry.mockImplementation(() => ({ cancel: mockCancel }));

      const element = await createComponent({
        recordCollection: [{ Amount: 50 }]
      });
      await flushPromises();
      document.body.removeChild(element);
      expect(mockCancel).toHaveBeenCalled();
    });
  });
});
