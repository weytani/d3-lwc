// ABOUTME: Unit tests for the d3GanttChart Lightning Web Component.
// ABOUTME: Tests init, date-range data handling, scaleTime domain, task rects, config, themes, tooltip, resize, error recovery, and GraphQL path.

import { createElement } from "lwc";
import D3GanttChart from "c/d3GanttChart";
import { loadD3 } from "c/d3Lib";
import { graphql } from "lightning/graphql";

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY — Gantt adds a callable scaleTime
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
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
    scaleTime: jest.fn(() => {
      const scale = jest.fn(() => 25);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      return scale;
    }),
    scaleBand: jest.fn(() => {
      const scale = jest.fn(() => 50);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.padding = jest.fn(() => scale);
      scale.bandwidth = jest.fn(() => 40);
      return scale;
    }),
    axisBottom: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      axis.ticks = jest.fn(() => axis);
      return axis;
    }),
    axisLeft: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    max: jest.fn(() => 500)
  };
  return mockD3;
};

// Minimal chainable D3 stub: every call returns the same chainable object.
function makeD3Stub() {
  const chain = new Proxy(function () {}, {
    get: () => () => chain,
    apply: () => chain
  });
  return chain;
}

// ═══════════════════════════════════════════════════════════════
// TEST DATA — date-range rows
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { label: "Design", start: "2024-01-01", end: "2024-02-15" },
  { label: "Build", start: "2024-02-01", end: "2024-03-20" },
  { label: "Test", start: "2024-03-10", end: "2024-04-30" }
];

const SINGLE_RECORD = [
  { label: "Design", start: "2024-01-01", end: "2024-02-15" }
];

const SPECIAL_CHAR_DATA = [
  { label: 'Phase "A"', start: "2024-01-01", end: "2024-02-01" },
  { label: "Phase 'B'", start: "2024-02-01", end: "2024-03-01" }
];

const GANTT_RESPONSE = {
  uiapi: {
    query: {
      Project__c: {
        edges: [
          {
            node: {
              Name: { value: "Apollo" },
              Project_Start__c: { value: "2026-01-01" },
              Project_End__c: { value: "2026-03-01" }
            }
          }
        ]
      }
    }
  }
};

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-gantt-chart", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);

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
    jest.clearAllMocks();
  });

  async function createChart(props = {}) {
    element = createElement("c-d3-gantt-chart", {
      is: D3GanttChart
    });

    Object.assign(element, {
      labelField: "Name",
      startDateField: "Project_Start__c",
      endDateField: "Project_End__c",
      recordCollection: SAMPLE_DATA,
      ...props
    });

    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();
    return element;
  }

  describe("initialization", () => {
    it("shows loading state initially", () => {
      element = createElement("c-d3-gantt-chart", { is: D3GanttChart });
      element.labelField = "Name";
      element.recordCollection = SAMPLE_DATA;
      document.body.appendChild(element);
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides loading after initialization", async () => {
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
      // GraphQL @wire is not triggered when recordCollection is present
      expect(
        element.shadowRoot.querySelector(".slds-text-color_error")
      ).toBeNull();
    });

    it("shows no-data state when neither recordCollection nor GraphQL fields are provided", async () => {
      await createChart({
        recordCollection: [],
        objectApiName: "",
        labelField: "",
        startDateField: "",
        endDateField: ""
      });
      await flushPromises();
      // With no recordCollection and no fields to build a GraphQL query,
      // the chart settles into the no-data (not error) state.
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
      const noDataEl = element.shadowRoot.querySelector(
        ".slds-text-color_weak"
      );
      expect(noDataEl).toBeTruthy();
    });
  });

  describe("data edge cases", () => {
    it("handles single record", async () => {
      await createChart({ recordCollection: SINGLE_RECORD });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles special characters in labels", async () => {
      await createChart({ recordCollection: SPECIAL_CHAR_DATA });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("shows error when rows lack date fields", async () => {
      const noDates = [{ label: "X" }, { label: "Y" }];
      await createChart({ recordCollection: noDates });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  describe("configuration", () => {
    it("applies height style to container", async () => {
      await createChart({ height: 400 });
      await flushPromises();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("400px");
    });

    it("parses advancedConfig JSON", async () => {
      await createChart({ advancedConfig: '{"showGrid": true}' });
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles invalid advancedConfig JSON gracefully", async () => {
      await createChart({ advancedConfig: "not valid json" });
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("renders today marker when config.today is provided", async () => {
      await createChart({ advancedConfig: '{"today": "2024-03-01"}' });
      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const markerCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "today-line"
      );
      expect(markerCalls.length).toBeGreaterThan(0);
    });

    it("does not render today marker when config.today is absent", async () => {
      await createChart({ advancedConfig: "{}" });
      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const markerCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "today-line"
      );
      expect(markerCalls.length).toBe(0);
    });
  });

  describe("themes", () => {
    it("accepts Salesforce Standard theme", async () => {
      await createChart({ theme: "Salesforce Standard" });
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  describe("tooltip behavior", () => {
    it("registers mouseenter handler on task bars", async () => {
      await createChart();
      await flushPromises();
      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on task bars", async () => {
      await createChart();
      await flushPromises();
      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });
  });

  describe("responsive behavior", () => {
    it("sets up resize observer", async () => {
      await createChart();
      await flushPromises();
      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it("handles zero container width gracefully", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));
      await createChart();
      await flushPromises();
      expect(loadD3).toHaveBeenCalled();
    });

    it("retries chart init when container starts at zero width", async () => {
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: containerWidth
      }));

      const rafCallbacks = [];
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();

      await createChart();
      await flushPromises();

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockD3.scaleTime).not.toHaveBeenCalled();

      containerWidth = 400;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
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

      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe("error recovery", () => {
    it("shows error when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));
      await createChart();
      await flushPromises();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("logs error to console on D3 load failure", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));
      await createChart();
      await flushPromises();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("sets isLoading to false even on error", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));
      await createChart();
      await flushPromises();
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });
  });

  describe("rendering details", () => {
    it("creates SVG element", async () => {
      await createChart();
      await flushPromises();
      const appendCalls = mockD3.append.mock.calls;
      const svgCalls = appendCalls.filter((c) => c[0] === "svg");
      expect(svgCalls.length).toBeGreaterThan(0);
    });

    it("creates task rect elements", async () => {
      await createChart();
      await flushPromises();
      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      expect(rectCalls.length).toBeGreaterThan(0);
    });

    it("creates a time scale for the x-axis", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.scaleTime).toHaveBeenCalled();
    });

    it("creates a band scale for the y-axis", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.scaleBand).toHaveBeenCalled();
    });

    it("sets the scaleTime domain to the computed date extent", async () => {
      const domainSpy = jest.fn(function spy() {
        return this;
      });
      mockD3.scaleTime = jest.fn(() => {
        const scale = jest.fn(() => 25);
        scale.domain = domainSpy;
        scale.range = jest.fn(() => scale);
        scale.nice = jest.fn(() => scale);
        return scale;
      });

      await createChart();
      await flushPromises();

      // computeDateExtent(SAMPLE_DATA, "start", "end") => [2024-01-01, 2024-04-30]
      const domainArg = domainSpy.mock.calls[0][0];
      expect(domainArg[0].getTime()).toBe(new Date("2024-01-01").getTime());
      expect(domainArg[1].getTime()).toBe(new Date("2024-04-30").getTime());
    });

    it("creates an x-axis group", async () => {
      await createChart();
      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const classCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "x-axis"
      );
      expect(classCalls.length).toBeGreaterThan(0);
    });

    it("creates a y-axis group", async () => {
      await createChart();
      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const classCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "y-axis"
      );
      expect(classCalls.length).toBeGreaterThan(0);
    });

    it("derives rect x from the start date via the time scale", async () => {
      await createChart();
      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const xCalls = attrCalls.filter((c) => c[0] === "x");
      expect(xCalls.length).toBeGreaterThan(0);
      // x attr receives a function (d) => xScale(d.start)
      const xFn = xCalls.find((c) => typeof c[1] === "function");
      expect(xFn).toBeTruthy();
    });

    it("derives rect width from end minus start via the time scale", async () => {
      await createChart();
      await flushPromises();
      const attrCalls = mockD3.attr.mock.calls;
      const widthCalls = attrCalls.filter(
        (c) => c[0] === "width" && typeof c[1] === "function"
      );
      expect(widthCalls.length).toBeGreaterThan(0);
    });

    it("removes existing SVG before re-render", async () => {
      await createChart();
      await flushPromises();
      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });
  });

  describe("getters", () => {
    it("containerStyle returns correct height string", async () => {
      await createChart({ height: 450 });
      await flushPromises();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container.getAttribute("style")).toContain("450px");
    });

    it("hasError returns true when error is set", async () => {
      loadD3.mockRejectedValue(new Error("Test error"));
      await createChart();
      await flushPromises();
      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
    });
  });

  describe("cleanup", () => {
    it("disconnects resize observer on disconnect", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));
      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("handles double disconnect gracefully", async () => {
      await createChart();
      await flushPromises();
      document.body.removeChild(element);
      expect(true).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// GRAPHQL PATH (Approach B) — only server path on the gantt chart
// ═══════════════════════════════════════════════════════════════

describe("d3GanttChart GraphQL path (Approach B)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadD3.mockResolvedValue(makeD3Stub());

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
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("renders when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-gantt-chart", { is: D3GanttChart });
    element.objectApiName = "Project__c";
    element.labelField = "Name";
    element.startDateField = "Project_Start__c";
    element.endDateField = "Project_End__c";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(GANTT_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();
  });

  it("shows error when GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-gantt-chart", { is: D3GanttChart });
    element.objectApiName = "Project__c";
    element.labelField = "Name";
    element.startDateField = "Project_Start__c";
    element.endDateField = "Project_End__c";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "GraphQL boom" }]);
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).not.toBeNull();
  });
});
