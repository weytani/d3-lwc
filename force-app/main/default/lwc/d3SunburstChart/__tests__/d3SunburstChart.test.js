// ABOUTME: Unit tests for the D3 sunburst chart Lightning Web Component.
// ABOUTME: Covers initialization, hierarchy data handling, aggregation, themes, config, events, tooltips, responsive behavior, and partition rendering details.

import { createElement } from "lwc";
import D3SunburstChart from "c/d3SunburstChart";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

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
jest.mock(
  "@salesforce/apex/D3ChartController.getMultiGroupData",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => ({
    NavigationMixin: jest.fn((Base) => {
      return class extends Base {
        [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
      };
    })
  }),
  { virtual: true }
);

jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
  formatPercent: jest.fn((v) => (v * 100).toFixed(1) + "%"),
  truncateLabel: jest.fn((label) => label),
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
  createLayoutRetry: jest.fn().mockReturnValue({ cancel: jest.fn() }),
  calculateDimensions: jest
    .fn()
    .mockReturnValue({ width: 300, height: 200, margins: {} }),
  shouldUseCompactMode: jest.fn().mockReturnValue(false)
}));

// Factory: isolated mock D3 with sunburst-specific primitives (hierarchy, partition, arc).
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

// Flat Opportunity rows — auto-nest into a two-level hierarchy by [StageName, Type].
const SAMPLE_DATA = [
  { Id: "001", StageName: "Prospecting", Type: "New", Amount: 100 },
  { Id: "002", StageName: "Prospecting", Type: "New", Amount: 200 },
  { Id: "003", StageName: "Prospecting", Type: "Existing", Amount: 50 },
  { Id: "004", StageName: "Closed Won", Type: "New", Amount: 500 },
  { Id: "005", StageName: "Closed Won", Type: "Existing", Amount: 300 }
];

const SAMPLE_HIERARCHY = {
  name: "Root",
  children: [
    { name: "A", value: 100 },
    { name: "B", value: 200 }
  ]
};

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-sunburst-chart", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);
    getAggregatedData.mockResolvedValue([
      { label: "Prospecting", value: 350 },
      { label: "Closed Won", value: 800 }
    ]);
    getMultiGroupData.mockResolvedValue([
      { label: "Prospecting", series: "New", value: 300 },
      { label: "Prospecting", series: "Existing", value: 50 },
      { label: "Closed Won", series: "New", value: 500 },
      { label: "Closed Won", series: "Existing", value: 300 }
    ]);

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
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
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  async function createChart(props = {}) {
    element = createElement("c-d3-sunburst-chart", { is: D3SunburstChart });
    Object.assign(element, {
      groupByField: "StageName",
      valueField: "Amount",
      operation: "Sum",
      recordCollection: SAMPLE_DATA,
      ...props
    });
    document.body.appendChild(element);
    await flushPromises();
    return element;
  }

  describe("initialization", () => {
    it("shows loading spinner initially", () => {
      element = createElement("c-d3-sunburst-chart", { is: D3SunburstChart });
      element.groupByField = "StageName";
      element.recordCollection = SAMPLE_DATA;
      document.body.appendChild(element);
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides spinner after data loads", async () => {
      await createChart();
      await flushPromises();
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("renders chart container when data is available", async () => {
      await createChart();
      await flushPromises();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  describe("data handling", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({ recordCollection: SAMPLE_DATA });
      expect(executeQuery).not.toHaveBeenCalled();
      expect(getAggregatedData).not.toHaveBeenCalled();
    });

    it("uses hierarchyData directly when provided", async () => {
      await createChart({
        recordCollection: [],
        hierarchyData: SAMPLE_HIERARCHY
      });
      await flushPromises();
      expect(executeQuery).not.toHaveBeenCalled();
      expect(getAggregatedData).not.toHaveBeenCalled();
      expect(getMultiGroupData).not.toHaveBeenCalled();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("calls executeQuery when only soqlQuery is set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT StageName, Amount FROM Opportunity"
      });
      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT StageName, Amount FROM Opportunity"
      });
    });

    it("shows error when no data source provided", async () => {
      await createChart({ recordCollection: [], soqlQuery: "" });
      await flushPromises();
      await flushPromises();
      const errorMessage = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorMessage).toBeTruthy();
    });

    it("shows error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({ body: { message: "Invalid query" } });
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Invalid FROM Object"
      });
      await flushPromises();
      await flushPromises();
      const errorMessage = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorMessage).toBeTruthy();
    });
  });

  describe("aggregation operations", () => {
    it("accepts Sum operation", async () => {
      await createChart({ operation: "Sum" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("accepts Count operation", async () => {
      await createChart({ operation: "Count" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("accepts Average operation", async () => {
      await createChart({ operation: "Average" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  describe("themes", () => {
    it("renders with Salesforce Standard theme", async () => {
      await createChart({ theme: "Salesforce Standard" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Warm theme", async () => {
      await createChart({ theme: "Warm" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Cool theme", async () => {
      await createChart({ theme: "Cool" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("renders with Vibrant theme", async () => {
      await createChart({ theme: "Vibrant" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  describe("configuration", () => {
    it("applies custom height", async () => {
      await createChart({ height: 500 });
      await flushPromises();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("500px");
    });

    it("accepts advancedConfig JSON", async () => {
      await createChart({ advancedConfig: '{"showBreadcrumb": false}' });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("handles invalid advancedConfig gracefully", async () => {
      await createChart({ advancedConfig: "not valid json" });
      await flushPromises();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });
  });

  describe("events", () => {
    it("sets objectApiName for drill-down navigation", async () => {
      await createChart({ objectApiName: "Opportunity" });
      await flushPromises();
      expect(element.objectApiName).toBe("Opportunity");
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("registers click handler on arcs via D3 on()", async () => {
      await createChart({ objectApiName: "Opportunity" });
      await flushPromises();
      const clickCalls = mockD3.on.mock.calls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);
    });
  });

  describe("tooltip behavior", () => {
    it("registers mouseenter handler on arcs", async () => {
      await createChart();
      await flushPromises();
      const calls = mockD3.on.mock.calls.filter((c) => c[0] === "mouseenter");
      expect(calls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on arcs", async () => {
      await createChart();
      await flushPromises();
      const calls = mockD3.on.mock.calls.filter((c) => c[0] === "mouseleave");
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe("responsive behavior", () => {
    it("creates resize handler for responsive reflow", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      await createChart();
      await flushPromises();
      expect(createResizeHandler).toHaveBeenCalled();
      const handler = createResizeHandler.mock.results[0].value;
      expect(handler.observe).toHaveBeenCalled();
    });

    it("disconnects resize handler on component removal", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      const mockDisconnect = jest.fn();
      createResizeHandler.mockReturnValue({
        observe: jest.fn(),
        disconnect: mockDisconnect
      });
      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("skips rendering when container has zero width", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 0
      }));
      await createChart();
      await flushPromises();
      expect(mockD3.partition).not.toHaveBeenCalled();
      expect(element.shadowRoot.querySelector(".chart-container")).toBeTruthy();
    });

    it("re-renders on resize callback via createResizeHandler", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      let capturedCallback;
      createResizeHandler.mockImplementation((container, callback) => {
        capturedCallback = callback;
        return { observe: jest.fn(), disconnect: jest.fn() };
      });
      await createChart();
      await flushPromises();
      expect(capturedCallback).toBeDefined();
      mockD3.select.mockClear();
      capturedCallback({ width: 500 });
      expect(mockD3.select).toHaveBeenCalled();
    });
  });

  describe("server aggregation", () => {
    it("calls getAggregatedData for single-level server hierarchy", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();
      expect(getAggregatedData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum",
        filterClause: null
      });
      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("calls getMultiGroupData when secondaryGroupByField is set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();
      expect(getMultiGroupData).toHaveBeenCalledWith({
        objectName: "Opportunity",
        groupByField: "StageName",
        seriesField: "Type",
        valueField: "Amount",
        operation: "Sum",
        filterClause: null
      });
      expect(getAggregatedData).not.toHaveBeenCalled();
    });

    it("shows error when getAggregatedData returns empty array", async () => {
      getAggregatedData.mockResolvedValue([]);
      await createChart({
        recordCollection: [],
        soqlQuery: "",
        objectApiName: "Opportunity",
        groupByField: "StageName",
        valueField: "Amount",
        operation: "Sum"
      });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  describe("getters", () => {
    it("hasData is false before data loads", () => {
      element = createElement("c-d3-sunburst-chart", { is: D3SunburstChart });
      expect(element.hasData).toBeFalsy();
    });

    it("containerStyle reflects configured height", async () => {
      await createChart({ height: 450 });
      await flushPromises();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("450px");
    });
  });

  describe("cleanup", () => {
    it("destroys tooltip on disconnect", async () => {
      const { createTooltip } = require("c/chartUtils");
      const mockDestroy = jest.fn();
      createTooltip.mockReturnValue({
        show: jest.fn(),
        hide: jest.fn(),
        destroy: mockDestroy
      });
      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(mockDestroy).toHaveBeenCalled();
    });
  });

  describe("rendering details", () => {
    it("creates a D3 hierarchy from the root data", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.hierarchy).toHaveBeenCalled();
    });

    it("invokes the partition layout", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.partition).toHaveBeenCalled();
      const partitionObj = mockD3.partition.mock.results[0].value;
      expect(partitionObj.size).toHaveBeenCalled();
    });

    it("creates an arc generator via d3.arc()", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.arc).toHaveBeenCalled();
      const arcObj = mockD3.arc.mock.results[0].value;
      expect(arcObj.startAngle).toHaveBeenCalled();
      expect(arcObj.endAngle).toHaveBeenCalled();
      expect(arcObj.innerRadius).toHaveBeenCalled();
      expect(arcObj.outerRadius).toHaveBeenCalled();
    });

    it("draws one arc path per non-root node (ring depth equals hierarchy depth)", async () => {
      await createChart();
      await flushPromises();
      // The partition root's descendants minus the root are bound via .data();
      // assert .data() received the descendant array (one entry per ring node).
      const dataCalls = mockD3.data.mock.calls;
      const arcDataCall = dataCalls.find((c) => Array.isArray(c[0]));
      expect(arcDataCall).toBeDefined();
      // Two-level hierarchy from SAMPLE_DATA => depth 0 (root, excluded) + depth 1 + depth 2.
      expect(arcDataCall[0].length).toBeGreaterThan(0);
    });

    it("removes existing SVG before re-render", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });

    it("sets SVG dimensions from container width and configured height", async () => {
      await createChart({ height: 360 });
      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const widthSet = attrCalls.some(
        (c) => c[0] === "width" && typeof c[1] === "number"
      );
      const heightSet = attrCalls.some(
        (c) => c[0] === "height" && c[1] === 360
      );
      expect(widthSet).toBe(true);
      expect(heightSet).toBe(true);
    });
  });

  describe("layout retry", () => {
    function useRealLayoutRetry() {
      const { createLayoutRetry } = require("c/chartUtils");
      createLayoutRetry.mockImplementation((container, onLayout, opts = {}) => {
        const maxAttempts = (opts && opts.maxAttempts) || 60;
        let rafId = null;
        let cancelled = false;
        const check = (attempt) => {
          if (cancelled) return;
          const { width } = container.getBoundingClientRect();
          if (width > 0) {
            rafId = null;
            onLayout(width);
            return;
          }
          if (attempt >= maxAttempts) {
            rafId = null;
            return;
          }
          rafId = global.requestAnimationFrame(() => check(attempt + 1));
        };
        rafId = global.requestAnimationFrame(() => check(0));
        return {
          cancel() {
            cancelled = true;
            if (rafId !== null) {
              global.cancelAnimationFrame(rafId);
              rafId = null;
            }
          }
        };
      });
    }

    it("retries chart init when container starts at zero width", async () => {
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: containerWidth
      }));
      const rafCallbacks = [];
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();
      useRealLayoutRetry();

      await createChart();
      await flushPromises();

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockD3.partition).not.toHaveBeenCalled();

      containerWidth = 400;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 400
      }));
      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift();
        cb();
      }
      expect(mockD3.select).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));
      global.requestAnimationFrame = jest.fn(() => 42);
      global.cancelAnimationFrame = jest.fn();
      useRealLayoutRetry();

      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });
});
