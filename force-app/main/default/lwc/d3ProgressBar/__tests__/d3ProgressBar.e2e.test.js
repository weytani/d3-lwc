// ABOUTME: End-to-end lifecycle tests for the d3ProgressBar LWC component.
// ABOUTME: Verifies full render pipeline, SOQL fetch, navigation, multi-instance isolation, and pristine console with real chartUtils and themeService.

import { createElement } from "lwc";
import D3ProgressBar from "c/d3ProgressBar";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// ── Mocks — ONLY d3Lib, Apex, navigation. Real services otherwise. ──

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

// ── Mock D3 factory (rect/line/text/scaleLinear chainable) ──

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

// ── Global mocks: ResizeObserver, getBoundingClientRect, console spies ──

let resizeObserverCallback;
const mockResizeObserverDisconnect = jest.fn();

global.ResizeObserver = jest.fn((callback) => {
  resizeObserverCallback = callback;
  return {
    observe: jest.fn(() => {
      resizeObserverCallback([{ contentRect: { width: 300, height: 150 } }]);
    }),
    disconnect: mockResizeObserverDisconnect,
    unobserve: jest.fn()
  };
});

Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 300,
  height: 150,
  top: 0,
  left: 0,
  right: 300,
  bottom: 150,
  x: 0,
  y: 0
}));

let consoleErrorSpy;
let consoleWarnSpy;

const flushPromises = () => new Promise(process.nextTick);

async function createProgressBar(props = {}) {
  const element = createElement("c-d3-progress-bar", { is: D3ProgressBar });
  Object.assign(element, {
    valueField: "Amount",
    height: 80,
    theme: "Salesforce Standard",
    ...props
  });
  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
}

// ── Test suites ──

describe("d3ProgressBar e2e", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue([]);
    getAggregatedData.mockResolvedValue([]);
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

  describe("full render pipeline", () => {
    it("data → value extraction → track + value rect render → percent label", async () => {
      const element = await createProgressBar({
        recordCollection: [{ Amount: 1500 }],
        valueField: "Amount",
        advancedConfig: JSON.stringify({ target: 3000 })
      });

      // D3 was loaded
      expect(loadD3).toHaveBeenCalled();

      // The chart container is present (data state)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).not.toBeNull();

      // Spinner is gone (isLoading false after finally)
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeNull();

      // Track + value rects appended (>= 2 rect appends)
      const rectAppends = mockD3.append.mock.calls.filter(
        (c) => c[0] === "rect"
      );
      expect(rectAppends.length).toBeGreaterThanOrEqual(2);

      // Percent label: 1500/3000 = 0.5 → real formatPercent(0.5) = '50.0%'
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("50.0%");

      // Real getColor('Salesforce Standard', 0) → '#1589EE' applied as fill
      const fillValues = mockD3.attr.mock.calls
        .filter((c) => c[0] === "fill")
        .map((c) => c[1]);
      expect(fillValues).toContain("#1589EE");

      // PRISTINE console: no errors during render
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("cleanup on disconnect runs without errors", async () => {
      const element = await createProgressBar({
        recordCollection: [{ Amount: 1500 }],
        advancedConfig: JSON.stringify({ target: 3000 })
      });

      document.body.removeChild(element);

      expect(mockResizeObserverDisconnect).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("SOQL fetch pipeline", () => {
    it("fetches data via Apex when no recordCollection", async () => {
      executeQuery.mockResolvedValue([{ Amount: 75 }]);

      await createProgressBar({
        recordCollection: [],
        soqlQuery: "SELECT Amount FROM Opportunity LIMIT 1",
        valueField: "Amount",
        advancedConfig: JSON.stringify({ target: 100 })
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT Amount FROM Opportunity LIMIT 1"
      });

      // 75/100 = 0.75 → real formatPercent(0.75) = '75.0%'
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("75.0%");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("navigation click flow", () => {
    it("objectApiName → value-rect click → NavigationMixin call", async () => {
      await createProgressBar({
        recordCollection: [{ Amount: 50 }],
        objectApiName: "Opportunity",
        advancedConfig: JSON.stringify({ target: 100 })
      });

      const onCalls = mockD3.on.mock.calls;
      const clickRegistration = onCalls.find((c) => c[0] === "click");
      expect(clickRegistration).toBeDefined();

      const clickHandler = clickRegistration[1];
      clickHandler();

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

  describe("multi-instance isolation", () => {
    it("two progress bars render independent values", async () => {
      const first = await createProgressBar({
        recordCollection: [{ Amount: 25 }],
        advancedConfig: JSON.stringify({ target: 100 })
      });
      const second = await createProgressBar({
        recordCollection: [{ Amount: 90 }],
        advancedConfig: JSON.stringify({ target: 100 })
      });

      // Both rendered their own container
      expect(first.shadowRoot.querySelector(".chart-container")).not.toBeNull();
      expect(
        second.shadowRoot.querySelector(".chart-container")
      ).not.toBeNull();

      // Combined text calls include both 25% and 90% percent labels
      const textCalls = mockD3.text.mock.calls.map((c) => c[0]);
      expect(textCalls).toContain("25.0%");
      expect(textCalls).toContain("90.0%");

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("D3 load failure shows error, no chart container rendered", async () => {
      loadD3.mockRejectedValue(new Error("Network timeout"));

      const element = await createProgressBar({
        recordCollection: [{ Amount: 100 }],
        advancedConfig: JSON.stringify({ target: 200 })
      });

      // Error state renders inside .slds-text-color_error with the message
      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).not.toBeNull();
      expect(errorEl.textContent).toContain("Network timeout");

      // No chart container in the error state (hasError branch hides it)
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeNull();

      // Spinner gone (isLoading false after finally)
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeNull();

      // No rect should have been appended — chart never rendered
      const rectAppends = mockD3.append.mock.calls.filter(
        (c) => c[0] === "rect"
      );
      expect(rectAppends.length).toBe(0);

      // The component logs the init error once (expected on the error path).
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
