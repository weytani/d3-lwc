// ABOUTME: End-to-end lifecycle tests for the d3Gauge LWC component.
// ABOUTME: Verifies full render pipelines, SOQL fetch, navigation, formatting, and error states with real chartUtils and themeService.

import { createElement } from "lwc";
import D3Gauge from "c/d3Gauge";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// ═══════════════════════════════════════════════════════════════════
// Mocks — ONLY d3Lib, Apex, and lightning/navigation are mocked.
// themeService and chartUtils use REAL implementations.
// ═══════════════════════════════════════════════════════════════════

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
    const NavMixin = jest.fn((Base) => {
      return class extends Base {
        [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
      };
    });
    NavMixin.Navigate = Symbol.for("NavigationMixin.Navigate");
    NavMixin.GenerateUrl = Symbol.for("NavigationMixin.GenerateUrl");
    return { NavigationMixin: NavMixin };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════════
// Mock D3 factory (gauge-specific chainable API)
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// Global mocks: ResizeObserver, getBoundingClientRect, console spies
// ═══════════════════════════════════════════════════════════════════

let resizeObserverCallback;
const mockResizeObserverDisconnect = jest.fn();

global.ResizeObserver = jest.fn((callback) => {
  resizeObserverCallback = callback;
  return {
    observe: jest.fn(() => {
      // Fire callback immediately so the chart resize path triggers
      resizeObserverCallback([{ contentRect: { width: 300, height: 200 } }]);
    }),
    disconnect: mockResizeObserverDisconnect,
    unobserve: jest.fn()
  };
});

Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 300,
  height: 200,
  top: 0,
  left: 0,
  right: 300,
  bottom: 200,
  x: 0,
  y: 0
}));

// Console spies
let consoleErrorSpy;
let consoleWarnSpy;

// ═══════════════════════════════════════════════════════════════════
// Helper: flush microtasks
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// ═══════════════════════════════════════════════════════════════════
// Helper: create and render a d3Gauge component
// ═══════════════════════════════════════════════════════════════════

async function createGauge(props = {}) {
  const element = createElement("c-d3-gauge", { is: D3Gauge });

  // Apply default + override props
  Object.assign(element, {
    valueField: "Amount",
    height: 200,
    theme: "Salesforce Standard",
    minValue: 0,
    maxValue: 100,
    ...props
  });

  document.body.appendChild(element);

  // Wait for connectedCallback (async loadD3 + loadData) to complete,
  // then for renderedCallback (which triggers setupChart + renderChart).
  await flushPromises();
  await flushPromises();

  return element;
}

// ═══════════════════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════════════════

describe("d3Gauge e2e", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    mockResizeObserverDisconnect.mockClear();
    mockNavigate.mockClear();

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
  // 1. full render pipeline
  // ═══════════════════════════════════════════════════════════════

  describe("full render pipeline", () => {
    it("data → value extraction → arc render → text display", async () => {
      await createGauge({
        recordCollection: [{ Amount: 1500 }],
        valueField: "Amount",
        maxValue: 10000
      });

      // D3 was loaded
      expect(loadD3).toHaveBeenCalled();

      // Arc generator was created at least twice (background + value)
      expect(mockD3.arc).toHaveBeenCalledTimes(2);

      // Text was called with the real formatNumber output for 1500 → '1.5K'
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("1.5K");

      // Attr was called with 'fill' and the real getColor output '#1589EE'
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((c) => c[0] === "fill");
      const fillValues = fillCalls.map((c) => c[1]);
      expect(fillValues).toContain("#1589EE");

      // No console errors during render
      const realErrors = consoleErrorSpy.mock.calls.filter(
        (c) => !String(c[0]).includes("Could not")
      );
      expect(realErrors).toHaveLength(0);
    });

    it("cleanup on disconnect runs without errors", async () => {
      const element = await createGauge({
        recordCollection: [{ Amount: 1500 }],
        valueField: "Amount"
      });

      // Remove from DOM — triggers disconnectedCallback → cleanup()
      document.body.removeChild(element);

      // ResizeObserver disconnect should have been called
      expect(mockResizeObserverDisconnect).toHaveBeenCalled();

      // No console errors during cleanup
      const realErrors = consoleErrorSpy.mock.calls.filter(
        (c) => !String(c[0]).includes("Could not")
      );
      expect(realErrors).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. SOQL fetch pipeline
  // ═══════════════════════════════════════════════════════════════

  describe("SOQL fetch pipeline", () => {
    it("fetches data via Apex when no recordCollection", async () => {
      executeQuery.mockResolvedValue([{ Amount: 75 }]);

      await createGauge({
        recordCollection: [],
        soqlQuery: "SELECT Amount FROM Opportunity LIMIT 1",
        valueField: "Amount"
      });

      // executeQuery was called with the query
      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Amount FROM Opportunity LIMIT 1"
      });

      // The gauge rendered: arc was used
      expect(mockD3.arc).toHaveBeenCalled();

      // Text was called with real formatNumber(75) → '75'
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("75");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. navigation click flow
  // ═══════════════════════════════════════════════════════════════

  describe("navigation click flow", () => {
    it("targetRecordId → click → NavigationMixin call", async () => {
      const targetId = "001xx000003DG";

      await createGauge({
        recordCollection: [{ Amount: 50 }],
        valueField: "Amount",
        targetRecordId: targetId
      });

      // The D3 on('click', handler) was registered. Find it.
      const onCalls = mockD3.on.mock.calls;
      const clickRegistration = onCalls.find((c) => c[0] === "click");
      expect(clickRegistration).toBeDefined();

      // Invoke the click handler
      const clickHandler = clickRegistration[1];
      clickHandler();

      // Verify NavigationMixin.Navigate was called with correct page ref
      expect(mockNavigate).toHaveBeenCalledWith({
        type: "standard__recordPage",
        attributes: {
          recordId: targetId,
          actionName: "view"
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. format pipeline end-to-end
  // ═══════════════════════════════════════════════════════════════

  describe("format pipeline end-to-end", () => {
    it("currency format flows through entire pipeline", async () => {
      await createGauge({
        recordCollection: [{ Amount: 5000 }],
        valueField: "Amount",
        maxValue: 10000,
        advancedConfig: JSON.stringify({ valueFormat: "currency" })
      });

      // Text was called with real formatCurrency(5000) → '$5,000'
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("$5,000");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. error state
  // ═══════════════════════════════════════════════════════════════

  describe("error state", () => {
    it("D3 load failure shows error, no chart rendered", async () => {
      loadD3.mockRejectedValue(new Error("Network timeout"));

      const element = await createGauge({
        recordCollection: [{ Amount: 100 }],
        valueField: "Amount"
      });

      // Error element is visible
      const errorDiv = element.shadowRoot.querySelector(".chart-error");
      expect(errorDiv).not.toBeNull();
      expect(errorDiv.textContent).toContain("Network timeout");

      // Chart SVG should not be rendered (hasError is true → if:false={hasError} hides svg)
      const svg = element.shadowRoot.querySelector(".chart-svg");
      expect(svg).toBeNull();

      // Spinner should be gone (isLoading is false after finally block)
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeNull();

      // D3 arc should never have been called
      expect(mockD3.arc).not.toHaveBeenCalled();
    });
  });
});
