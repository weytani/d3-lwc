// ABOUTME: End-to-end lifecycle tests for the D3 Sunburst Chart component.
// ABOUTME: Verifies full render pipeline, multi-instance isolation, data flow, and pristine console using real services with mocked D3.

import { createElement } from "lwc";
import D3SunburstChart from "c/d3SunburstChart";
import { loadD3 } from "c/d3Lib";

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP: Only mock D3 lib, Apex, navigation, and toast
// Real modules: c/dataService, c/themeService, c/chartUtils
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

jest.mock(
  "lightning/platformShowToastEvent",
  () => {
    return {
      ShowToastEvent: class ShowToastEvent extends CustomEvent {
        constructor(toast) {
          super("lightning__showtoast", {
            composed: true,
            cancelable: true,
            bubbles: true,
            detail: toast
          });
        }
      }
    };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY — sunburst primitives (hierarchy, partition, arc)
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    insert: jest.fn(() => d3),
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
    each: jest.fn(() => d3),
    hierarchy: jest.fn((data) => {
      const createNode = (node, parent = null, depth = 0) => {
        const n = {
          data: node,
          depth,
          parent,
          value: node.value || 0,
          x0: 0,
          x1: 6.28,
          y0: depth * 50,
          y1: (depth + 1) * 50,
          children: null
        };
        if (node.children) {
          n.children = node.children.map((c) => createNode(c, n, depth + 1));
        }
        return n;
      };
      const root = createNode(data);
      root.sum = jest.fn(() => root);
      root.sort = jest.fn(() => root);
      root.descendants = jest.fn(() => {
        const out = [];
        const walk = (n) => {
          out.push(n);
          if (n.children) n.children.forEach(walk);
        };
        walk(root);
        return out;
      });
      return root;
    }),
    partition: jest.fn(() => {
      const partitionFn = jest.fn((root) => root);
      partitionFn.size = jest.fn(() => partitionFn);
      return partitionFn;
    }),
    arc: jest.fn(() => {
      const arcFn = jest.fn(() => "M0,0");
      arcFn.startAngle = jest.fn(() => arcFn);
      arcFn.endAngle = jest.fn(() => arcFn);
      arcFn.innerRadius = jest.fn(() => arcFn);
      arcFn.outerRadius = jest.fn(() => arcFn);
      return arcFn;
    })
  };
  return d3;
};

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

// SAMPLE_DATA — flat rows that nest into a two-level hierarchy by [StageName, Type].
const SAMPLE_DATA = [
  { StageName: "Prospecting", Type: "New", Amount: 100 },
  { StageName: "Prospecting", Type: "New", Amount: 200 },
  { StageName: "Prospecting", Type: "Existing", Amount: 50 },
  { StageName: "Closed Won", Type: "New", Amount: 500 },
  { StageName: "Closed Won", Type: "Existing", Amount: 300 }
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

async function createChart(props = {}) {
  const element = createElement("c-d3-sunburst-chart", {
    is: D3SunburstChart
  });

  Object.assign(element, {
    groupByField: "StageName",
    secondaryGroupByField: "Type",
    valueField: "Amount",
    operation: "Sum",
    recordCollection: SAMPLE_DATA,
    ...props
  });

  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-sunburst-chart e2e", () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();

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
  // FULL RENDER LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe("full render lifecycle", () => {
    it("creates sunburst end-to-end with correct D3 calls and no console errors", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
      expect(mockD3.hierarchy).toHaveBeenCalled();
      expect(mockD3.partition).toHaveBeenCalled();
      expect(mockD3.arc).toHaveBeenCalled();

      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("svg");

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      // Pristine console — success path asserts console.error was NOT called.
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("cleanup removes resize handler and tooltip on disconnect with no errors", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      document.body.removeChild(element);
      expect(mockDisconnect).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTI-INSTANCE ISOLATION
  // ═══════════════════════════════════════════════════════════════

  describe("multi-instance isolation", () => {
    it("two sunburst instances render independently without cross-talk", async () => {
      const mockD3a = createMockD3();
      loadD3.mockResolvedValue(mockD3a);
      const elementA = await createChart({ theme: "Salesforce Standard" });
      await flushPromises();

      const mockD3b = createMockD3();
      loadD3.mockResolvedValue(mockD3b);
      const elementB = await createChart({ theme: "Warm" });
      await flushPromises();

      expect(
        elementA.shadowRoot.querySelector(".chart-container")
      ).toBeTruthy();
      expect(
        elementB.shadowRoot.querySelector(".chart-container")
      ).toBeTruthy();

      // Each instance drove its own mock D3 partition layout.
      expect(mockD3a.partition).toHaveBeenCalled();
      expect(mockD3b.partition).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA-FLOW VERIFICATION (exact values)
  // ═══════════════════════════════════════════════════════════════

  describe("data-flow verification", () => {
    it("real aggregated hierarchy reaches d3.hierarchy with exact summed values", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();

      const rootArg = mockD3.hierarchy.mock.calls[0][0];
      const closedWon = rootArg.children.find((c) => c.name === "Closed Won");
      // Closed Won total = New(500) + Existing(300) = 800.
      const closedWonTotal = closedWon.children.reduce(
        (s, c) => s + c.value,
        0
      );
      expect(closedWonTotal).toBe(800);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR → RECOVERY FLOW
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery flow", () => {
    it("shows error state when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("Network failure loading D3"));

      const element = await createChart();
      await flushPromises();
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeFalsy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();

      // Error path: the component logs "D3SunburstChart initialization error".
      // Filter that expected log out, then assert no OTHER console errors.
      const unexpected = consoleErrorSpy.mock.calls.filter(
        (call) =>
          !String(call[0]).includes("D3SunburstChart initialization error")
      );
      expect(unexpected.length).toBe(0);
    });
  });
});
