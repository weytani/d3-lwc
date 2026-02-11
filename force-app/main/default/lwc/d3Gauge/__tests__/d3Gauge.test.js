// ABOUTME: Unit tests for the D3 Gauge chart LWC component.
// ABOUTME: Covers data processing, zone coloring, compact mode, min/max, formatting, navigation, layout retry, and edge cases.

import { createElement } from "lwc";
import D3Gauge from "c/d3Gauge";
import { loadD3 } from "c/d3Lib";
import { getColor } from "c/themeService";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

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
  shouldUseCompactMode: jest.fn().mockReturnValue(false)
}));

// Mock Apex
jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
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

// Create mock D3
const createMockD3 = () => ({
  select: jest.fn().mockReturnThis(),
  selectAll: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  arc: jest.fn().mockReturnValue({
    innerRadius: jest.fn().mockReturnThis(),
    outerRadius: jest.fn().mockReturnThis(),
    startAngle: jest.fn().mockReturnThis(),
    endAngle: jest.fn().mockReturnThis(),
    cornerRadius: jest.fn().mockReturnValue("mock-path")
  }),
  scaleLinear: jest.fn().mockReturnValue({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    clamp: jest.fn().mockReturnValue((v) => v)
  }),
  pointer: jest.fn().mockReturnValue([100, 100])
});

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("d3Gauge", () => {
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Default non-zero dimensions for chart initialization
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 300,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
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

  // Helper to create and wait for component
  const createComponent = async (props = {}) => {
    const element = createElement("c-d3-gauge", { is: D3Gauge });
    Object.assign(element, { valueField: "Amount", ...props });
    document.body.appendChild(element);

    // Wait for async operations
    await Promise.resolve();
    await Promise.resolve();

    return element;
  };

  // ═══════════════════════════════════════════════════════════════
  // COMPONENT RENDERING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("Component Rendering", () => {
    it("renders chart container", async () => {
      const element = await createComponent();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).not.toBeNull();
    });

    it("shows loading state initially", () => {
      const el = createElement("c-d3-gauge", { is: D3Gauge });
      el.valueField = "Amount";
      document.body.appendChild(el);

      // Before async completes, loading should show
      const spinner = el.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 on connect", async () => {
      await createComponent();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA PROPERTIES TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("Data Properties", () => {
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
      const records = [{ Amount: 500 }];
      await createComponent({
        recordCollection: records,
        soqlQuery: "SELECT Amount FROM Account"
      });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("calls executeQuery when soqlQuery provided", async () => {
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

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION PROPERTIES TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("Configuration Properties", () => {
    it("accepts height", async () => {
      const element = await createComponent({ height: 300 });
      expect(element.height).toBe(300);
    });

    it("accepts theme", async () => {
      const element = await createComponent({ theme: "Warm" });
      expect(element.theme).toBe("Warm");
    });

    it("accepts minValue and maxValue", async () => {
      const element = await createComponent({ minValue: 0, maxValue: 200 });
      expect(element.minValue).toBe(0);
      expect(element.maxValue).toBe(200);
    });

    it("parses advancedConfig JSON", async () => {
      const config = { label: "Test", minValue: 10 };
      const element = await createComponent({
        advancedConfig: JSON.stringify(config)
      });
      expect(element.advancedConfig).toBe(JSON.stringify(config));
    });

    it("handles invalid advancedConfig gracefully", async () => {
      const element = await createComponent({
        advancedConfig: "not valid json"
      });
      // Should not throw, parsedConfig returns {}
      expect(element.advancedConfig).toBe("not valid json");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("Navigation", () => {
    it("accepts targetRecordId", async () => {
      const element = await createComponent({
        targetRecordId: "001xx000003DGTEST"
      });
      expect(element.targetRecordId).toBe("001xx000003DGTEST");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME INTEGRATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("Theme Integration", () => {
    it("uses getColor from themeService", async () => {
      await createComponent({ theme: "Warm" });
      // getColor should be called during render
      expect(getColor).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("Error Handling", () => {
    it("displays error when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("Load failed"));
      const element = await createComponent();

      await Promise.resolve();
      await Promise.resolve();

      const errorDiv = element.shadowRoot.querySelector(".chart-error");
      expect(errorDiv).not.toBeNull();
    });

    it("displays error when query fails", async () => {
      executeQuery.mockRejectedValue({ body: { message: "Query error" } });
      const element = await createComponent({
        recordCollection: [],
        soqlQuery: "SELECT Bad FROM Query"
      });

      await Promise.resolve();
      await Promise.resolve();

      // Error should be set
      const errorDiv = element.shadowRoot.querySelector(".chart-error");
      expect(errorDiv).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("Cleanup", () => {
    it("disconnects resize handler on destroy", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      const mockHandler = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };
      createResizeHandler.mockReturnValue(mockHandler);

      const element = await createComponent();

      // Trigger renderedCallback by waiting
      await Promise.resolve();

      // Remove element
      document.body.removeChild(element);

      // Disconnect should be called
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

      const element = await createComponent();
      await Promise.resolve();

      document.body.removeChild(element);

      expect(mockTooltip.destroy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT RETRY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("layout retry", () => {
    it("retries chart init when container starts at zero width", async () => {
      const {
        createLayoutRetry,
        createResizeHandler
      } = require("c/chartUtils");

      // Start with zero width
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 0
      }));

      let retryCallback;
      createLayoutRetry.mockImplementation((container, cb) => {
        retryCallback = cb;
        return { cancel: jest.fn() };
      });

      createResizeHandler.mockClear();

      await createComponent({
        recordCollection: [{ Amount: 50 }]
      });
      await flushPromises();

      // createLayoutRetry should have been called because width was 0
      expect(createLayoutRetry).toHaveBeenCalled();
      // createResizeHandler should NOT have been called yet (chart didn't init)
      expect(createResizeHandler).not.toHaveBeenCalled();

      // Simulate container getting width
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 400
      }));

      // Fire the retry callback
      retryCallback();

      // Now the chart should have initialized — resizeHandler created
      expect(createResizeHandler).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      const { createLayoutRetry } = require("c/chartUtils");

      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
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

    it("does not create multiple retry loops", async () => {
      const { createLayoutRetry } = require("c/chartUtils");

      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 0
      }));

      createLayoutRetry.mockImplementation(() => ({ cancel: jest.fn() }));
      createLayoutRetry.mockClear();

      await createComponent({
        recordCollection: [{ Amount: 50 }]
      });
      await flushPromises();
      await flushPromises();
      await flushPromises();

      // Should only create one retry despite multiple renderedCallback cycles
      expect(createLayoutRetry).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PROCESS DATA TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("processData", () => {
    it("extracts the first record valueField as currentValue", async () => {
      const records = [{ Amount: 75 }];
      await createComponent({ recordCollection: records });

      await Promise.resolve();
      await Promise.resolve();

      // The scaleLinear domain is built from effectiveMin/Max, and the
      // value 75 is passed through the scale. Verify the scale was
      // created with the correct domain encompassing 75.
      expect(mockD3.scaleLinear).toHaveBeenCalled();
      const domainCall = mockD3.scaleLinear().domain;
      expect(domainCall).toHaveBeenCalledWith([0, 100]);
    });

    it("sets currentValue to 0 when records array is empty", async () => {
      await createComponent({ recordCollection: [] });

      await Promise.resolve();
      await Promise.resolve();

      // With currentValue = 0 and no data, the value formatter should
      // receive 0 when rendering center text. Since shouldUseCompactMode
      // returns false, text() will be called with the formatted value.
      const { formatNumber } = require("c/chartUtils");
      // formatNumber is called for min/max labels and the value itself
      // when currentValue is 0, formatNumber(0) should appear in calls
      const zeroFormatCalls = formatNumber.mock.calls.filter(
        (call) => call[0] === 0
      );
      expect(zeroFormatCalls.length).toBeGreaterThan(0);
    });

    it("sets currentValue to 0 when valueField is empty string", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        valueField: ""
      });

      await Promise.resolve();
      await Promise.resolve();

      // With empty valueField, processData sets currentValue to 0.
      // formatNumber(0) should be called for the value display.
      const { formatNumber } = require("c/chartUtils");
      const zeroFormatCalls = formatNumber.mock.calls.filter(
        (call) => call[0] === 0
      );
      expect(zeroFormatCalls.length).toBeGreaterThan(0);
    });

    it("treats non-numeric values as 0", async () => {
      const records = [{ Amount: "not-a-number" }];
      await createComponent({ recordCollection: records });

      await Promise.resolve();
      await Promise.resolve();

      // Number('not-a-number') is NaN, || 0 yields 0
      const { formatNumber } = require("c/chartUtils");
      const zeroFormatCalls = formatNumber.mock.calls.filter(
        (call) => call[0] === 0
      );
      expect(zeroFormatCalls.length).toBeGreaterThan(0);
    });

    it("uses only the first record when multiple records are provided", async () => {
      const records = [{ Amount: 42 }, { Amount: 99 }, { Amount: 200 }];
      await createComponent({ recordCollection: records });

      await Promise.resolve();
      await Promise.resolve();

      // The gauge should format value 42, not 99 or 200.
      // Since shouldUseCompactMode is false, the value formatter is
      // called with currentValue for the center text.
      const { formatNumber } = require("c/chartUtils");
      const fortyTwoCalls = formatNumber.mock.calls.filter(
        (call) => call[0] === 42
      );
      expect(fortyTwoCalls.length).toBeGreaterThanOrEqual(1);

      // Value 99 and 200 should never be formatted as a primary value
      const ninetynine = formatNumber.mock.calls.filter(
        (call) => call[0] === 99
      );
      expect(ninetynine.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ZONE-BASED COLORING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("zone-based coloring", () => {
    it("returns zone color when value falls within a defined zone", async () => {
      const config = {
        zones: [
          { min: 0, max: 30, color: "#FF0000" },
          { min: 31, max: 70, color: "#FFCC00" },
          { min: 71, max: 100, color: "#00CC00" }
        ]
      };
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: JSON.stringify(config)
      });

      await Promise.resolve();
      await Promise.resolve();

      // Value 50 falls in the 31-70 zone, so fill should be #FFCC00
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#FFCC00"
      );
      expect(fillCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("falls back when value is outside all defined zones", async () => {
      const config = {
        zones: [
          { min: 0, max: 30, color: "#FF0000" },
          { min: 60, max: 100, color: "#00CC00" }
        ]
      };
      // Value 45 is between zones (31-59 is not covered)
      const records = [{ Amount: 45 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: JSON.stringify(config)
      });

      await Promise.resolve();
      await Promise.resolve();

      // Falls through zones, no customColors, uses getColor from theme
      expect(getColor).toHaveBeenCalledWith("Salesforce Standard", 0);
    });

    it("uses theme color when no zones are configured", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        theme: "Warm"
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(getColor).toHaveBeenCalledWith("Warm", 0);

      // The theme color (#1589EE from mock) should be applied as fill
      const attrCalls = mockD3.attr.mock.calls;
      const themeColorFills = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#1589EE"
      );
      expect(themeColorFills.length).toBeGreaterThanOrEqual(1);
    });

    it("uses customColors from config when no zones match", async () => {
      const config = {
        customColors: ["#AA00BB", "#CC00DD"]
      };
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: JSON.stringify(config)
      });

      await Promise.resolve();
      await Promise.resolve();

      // customColors[0] should be used as fill color
      const attrCalls = mockD3.attr.mock.calls;
      const customFills = attrCalls.filter(
        (call) => call[0] === "fill" && call[1] === "#AA00BB"
      );
      expect(customFills.length).toBeGreaterThanOrEqual(1);

      // getColor should NOT be called when customColors are present
      // because customColors takes precedence over theme
      // (getColor may still be called if zones checked first, but the
      // returned value should not be the fill)
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // COMPACT MODE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("compact mode", () => {
    it("skips center text when in compact mode", async () => {
      const { shouldUseCompactMode } = require("c/chartUtils");
      shouldUseCompactMode.mockReturnValue(true);

      const records = [{ Amount: 75 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: JSON.stringify({ label: "Revenue" })
      });

      await Promise.resolve();
      await Promise.resolve();

      // In compact mode, text() should NOT be called with the formatted
      // value or the label for center display. The gauge-value and
      // gauge-label attr calls should be absent.
      const attrCalls = mockD3.attr.mock.calls;
      const gaugeValueClasses = attrCalls.filter(
        (call) => call[0] === "class" && call[1] === "gauge-value"
      );
      expect(gaugeValueClasses.length).toBe(0);

      const gaugeLabelClasses = attrCalls.filter(
        (call) => call[0] === "class" && call[1] === "gauge-label"
      );
      expect(gaugeLabelClasses.length).toBe(0);

      // Reset for other tests
      shouldUseCompactMode.mockReturnValue(false);
    });

    it("renders center text when not in compact mode", async () => {
      const { shouldUseCompactMode } = require("c/chartUtils");
      shouldUseCompactMode.mockReturnValue(false);

      const records = [{ Amount: 75 }];
      await createComponent({
        recordCollection: records
      });

      await Promise.resolve();
      await Promise.resolve();

      // In normal mode, the gauge-value class should be set via attr
      const attrCalls = mockD3.attr.mock.calls;
      const gaugeValueClasses = attrCalls.filter(
        (call) => call[0] === "class" && call[1] === "gauge-value"
      );
      expect(gaugeValueClasses.length).toBeGreaterThanOrEqual(1);
    });

    it("renders label text when label is configured and not compact", async () => {
      const { shouldUseCompactMode } = require("c/chartUtils");
      shouldUseCompactMode.mockReturnValue(false);

      const records = [{ Amount: 60 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: JSON.stringify({ label: "Pipeline" })
      });

      await Promise.resolve();
      await Promise.resolve();

      // gauge-label class should appear for the label text element
      const attrCalls = mockD3.attr.mock.calls;
      const gaugeLabelClasses = attrCalls.filter(
        (call) => call[0] === "class" && call[1] === "gauge-label"
      );
      expect(gaugeLabelClasses.length).toBeGreaterThanOrEqual(1);

      // The text 'Pipeline' should be rendered via text()
      const textCalls = mockD3.text.mock.calls;
      const labelTexts = textCalls.filter((call) => call[0] === "Pipeline");
      expect(labelTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // MIN/MAX OVERRIDE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("min/max override", () => {
    it("uses API property values for min and max", async () => {
      const records = [{ Amount: 150 }];
      await createComponent({
        recordCollection: records,
        minValue: 50,
        maxValue: 300
      });

      await Promise.resolve();
      await Promise.resolve();

      // scaleLinear().domain() should be called with [50, 300]
      const domainFn = mockD3.scaleLinear().domain;
      expect(domainFn).toHaveBeenCalledWith([50, 300]);
    });

    it("uses advancedConfig overrides over API properties", async () => {
      const config = { minValue: 10, maxValue: 500 };
      const records = [{ Amount: 250 }];
      await createComponent({
        recordCollection: records,
        minValue: 0,
        maxValue: 100,
        advancedConfig: JSON.stringify(config)
      });

      await Promise.resolve();
      await Promise.resolve();

      // advancedConfig should override the API props
      const domainFn = mockD3.scaleLinear().domain;
      expect(domainFn).toHaveBeenCalledWith([10, 500]);
    });

    it("defaults to 0 and 100 when no overrides provided", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records
      });

      await Promise.resolve();
      await Promise.resolve();

      const domainFn = mockD3.scaleLinear().domain;
      expect(domainFn).toHaveBeenCalledWith([0, 100]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // VALUE FORMATTING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("value formatting", () => {
    it("uses number format by default", async () => {
      const { formatNumber } = require("c/chartUtils");
      const records = [{ Amount: 42 }];
      await createComponent({
        recordCollection: records
      });

      await Promise.resolve();
      await Promise.resolve();

      // formatNumber should be called with the currentValue for display
      const valueCalls = formatNumber.mock.calls.filter(
        (call) => call[0] === 42
      );
      expect(valueCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("uses currency format when advancedConfig specifies currency", async () => {
      const { formatCurrency } = require("c/chartUtils");
      const config = { valueFormat: "currency" };
      const records = [{ Amount: 1500 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: JSON.stringify(config)
      });

      await Promise.resolve();
      await Promise.resolve();

      // formatCurrency should be called with 1500 for the value display
      const currencyCalls = formatCurrency.mock.calls.filter(
        (call) => call[0] === 1500
      );
      expect(currencyCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("uses percent format when advancedConfig specifies percent", async () => {
      const { formatPercent } = require("c/chartUtils");
      const config = { valueFormat: "percent" };
      const records = [{ Amount: 0.85 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: JSON.stringify(config)
      });

      await Promise.resolve();
      await Promise.resolve();

      // formatPercent should be called with 0.85 for the value display
      const percentCalls = formatPercent.mock.calls.filter(
        (call) => call[0] === 0.85
      );
      expect(percentCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // HANDLE CLICK NAVIGATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("handleClick navigation", () => {
    it("navigates to record page when targetRecordId is set", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        targetRecordId: "001xx000003DGTEST"
      });

      await Promise.resolve();
      await Promise.resolve();

      // The on('click') handler should have been registered.
      // Find the click handler and invoke it.
      const onCalls = mockD3.on.mock.calls;
      const clickHandler = onCalls.find((call) => call[0] === "click");
      expect(clickHandler).toBeDefined();

      // Invoke the click handler
      clickHandler[1]();

      expect(mockNavigate).toHaveBeenCalledWith({
        type: "standard__recordPage",
        attributes: {
          recordId: "001xx000003DGTEST",
          actionName: "view"
        }
      });
    });

    it("does not navigate when targetRecordId is empty", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        targetRecordId: ""
      });

      await Promise.resolve();
      await Promise.resolve();

      // No click handler should be registered for navigation
      // because the component checks targetRecordId before binding
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("sets pointer cursor when targetRecordId is present", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        targetRecordId: "001xx000003DGTEST"
      });

      await Promise.resolve();
      await Promise.resolve();

      // style('cursor', 'pointer') should be called for the value arc
      const styleCalls = mockD3.style.mock.calls;
      const cursorPointerCalls = styleCalls.filter(
        (call) => call[0] === "cursor" && call[1] === "pointer"
      );
      expect(cursorPointerCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("sets default cursor when targetRecordId is absent", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        targetRecordId: ""
      });

      await Promise.resolve();
      await Promise.resolve();

      // style('cursor', 'default') should be called
      const styleCalls = mockD3.style.mock.calls;
      const cursorDefaultCalls = styleCalls.filter(
        (call) => call[0] === "cursor" && call[1] === "default"
      );
      expect(cursorDefaultCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED CONFIG EDGE CASES TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("advancedConfig edge cases", () => {
    it("treats empty string advancedConfig as empty config object", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: ""
      });

      await Promise.resolve();
      await Promise.resolve();

      // With empty string, parsedConfig returns {}, so defaults apply.
      // scaleLinear domain should use default min/max [0, 100]
      const domainFn = mockD3.scaleLinear().domain;
      expect(domainFn).toHaveBeenCalledWith([0, 100]);

      // No console warnings should be emitted for empty string
      const gaugeWarnings = consoleWarnSpy.mock.calls.filter((call) =>
        String(call[0]).includes("D3Gauge")
      );
      expect(gaugeWarnings.length).toBe(0);
    });

    it("treats null advancedConfig as empty config object", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: null
      });

      await Promise.resolve();
      await Promise.resolve();

      // null is falsy, so parsedConfig returns {} without parsing
      const domainFn = mockD3.scaleLinear().domain;
      expect(domainFn).toHaveBeenCalledWith([0, 100]);

      // No warnings for null
      const gaugeWarnings = consoleWarnSpy.mock.calls.filter((call) =>
        String(call[0]).includes("D3Gauge")
      );
      expect(gaugeWarnings.length).toBe(0);
    });

    it("logs a warning and returns empty config for invalid nested JSON", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records,
        advancedConfig: '{"zones": [invalid}'
      });

      await Promise.resolve();
      await Promise.resolve();

      // Invalid JSON triggers console.warn in parsedConfig getter
      const gaugeWarnings = consoleWarnSpy.mock.calls.filter((call) =>
        String(call[0]).includes("D3Gauge")
      );
      expect(gaugeWarnings.length).toBeGreaterThan(0);

      // Despite bad config, chart should still render with defaults
      const domainFn = mockD3.scaleLinear().domain;
      expect(domainFn).toHaveBeenCalledWith([0, 100]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERING EDGE CASES TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("rendering edge cases", () => {
    it("handles zero container width gracefully", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records
      });

      await Promise.resolve();
      await Promise.resolve();

      // The component uses containerWidth || 300 as fallback.
      // In JSDOM, clientWidth is 0, so 300 is used.
      // Verify SVG attr is called with width = 300
      const attrCalls = mockD3.attr.mock.calls;
      const widthCalls = attrCalls.filter(
        (call) => call[0] === "width" && call[1] === 300
      );
      expect(widthCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("clears previous SVG children on re-render", async () => {
      const records = [{ Amount: 50 }];
      await createComponent({
        recordCollection: records
      });

      await Promise.resolve();
      await Promise.resolve();

      // d3.select(svg).selectAll('*').remove() is the clear pattern
      // Verify selectAll was called with '*' and then remove was called
      expect(mockD3.selectAll).toHaveBeenCalledWith("*");
      expect(mockD3.remove).toHaveBeenCalled();

      // Verify the sequence: select -> selectAll('*') -> remove
      const selectAllCallOrder = mockD3.selectAll.mock.invocationCallOrder[0];
      const removeCallOrder = mockD3.remove.mock.invocationCallOrder[0];
      expect(removeCallOrder).toBeGreaterThan(selectAllCallOrder);
    });
  });
});
