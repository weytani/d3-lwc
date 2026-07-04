// ABOUTME: Integration tests for d3SunburstChart verifying real service interactions.
// ABOUTME: Tests real dataService.buildHierarchy nesting, themeService colors, and chartUtils formatting against mock D3.

import { createElement } from "lwc";
import D3SunburstChart from "c/d3SunburstChart";
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
// buildHierarchy([... ], ["StageName","Type"], "Amount", "Sum") =>
//   Root -> Prospecting(350) -> [New(300), Existing(50)]
//        -> Closed Won(800)  -> [New(500), Existing(300)]
// Total leaf sum = 1150.

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const flushPromises = () => new Promise(process.nextTick);

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

describe("c-d3-sunburst-chart integration", () => {
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
  // REAL HIERARCHY FLOWS INTO mockD3
  // ═══════════════════════════════════════════════════════════════

  describe("real buildHierarchy result flows into D3", () => {
    it("d3.hierarchy receives the real nested { name, children } tree", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });

      expect(mockD3.hierarchy).toHaveBeenCalled();
      const rootArg = mockD3.hierarchy.mock.calls[0][0];
      expect(rootArg.name).toBe("Root");
      expect(rootArg.children.length).toBe(2);

      const labels = rootArg.children.map((c) => c.name).sort();
      expect(labels).toEqual(["Closed Won", "Prospecting"]);

      const prospecting = rootArg.children.find(
        (c) => c.name === "Prospecting"
      );
      expect(prospecting.children).toBeDefined();
      const prospectingNew = prospecting.children.find((c) => c.name === "New");
      // Real dataService.buildHierarchy Sum: Prospecting/New = 100 + 200 = 300.
      expect(prospectingNew.value).toBe(300);
    });

    it("partition layout is invoked with the real hierarchy", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum"
      });
      expect(mockD3.partition).toHaveBeenCalled();
      const partitionFn = mockD3.partition.mock.results[0].value;
      expect(partitionFn.size).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // REAL THEMESERVICE PALETTE FLOWS INTO ARC FILLS
  // ═══════════════════════════════════════════════════════════════

  describe("real themeService colors flow into arc fills", () => {
    it("Salesforce Standard palette hex is applied to arc fills", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum",
        theme: "Salesforce Standard"
      });

      // renderChart calls .attr("fill", fn); the fn resolves to real palette hex.
      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);
      const fillResolver = fillCalls[0][1];
      expect(typeof fillResolver).toBe("function");
      // buildHierarchy preserves row order, so the first top-level node is
      // "Prospecting" (index 0) => palette[0] = #1589EE.
      const color = fillResolver(
        { depth: 1, parent: null, data: { name: "Prospecting" } },
        0
      );
      expect(color).toBe("#1589EE");
    });

    it("Warm palette hex is applied for the Warm theme", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum",
        theme: "Warm"
      });
      const fillCalls = mockD3.attr.mock.calls.filter((c) => c[0] === "fill");
      const fillResolver = fillCalls[0][1];
      // "Prospecting" is the first top-level node (index 0).
      const color = fillResolver(
        { depth: 1, parent: null, data: { name: "Prospecting" } },
        0
      );
      // Warm palette index 0 = #FF6B6B (spec §8 integration palette reference).
      expect(color).toBe("#FF6B6B");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EVENT PIPELINE
  // ═══════════════════════════════════════════════════════════════

  describe("arc click pipeline", () => {
    it("arc click dispatches arcclick with real label/value and click handler registered", async () => {
      const element = await createChart({
        objectApiName: "Opportunity",
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        filterField: "StageName"
      });

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);

      const handler = jest.fn();
      element.addEventListener("arcclick", handler);
      // Invoke the registered click handler with a real-shaped node.
      const clickFn = clickCalls[0][1];
      clickFn({}, { data: { name: "Prospecting" }, value: 350, depth: 1 });
      expect(handler).toHaveBeenCalledTimes(1);
      const detail = handler.mock.calls[0][0].detail;
      expect(detail.label).toBe("Prospecting");
      expect(detail.value).toBe(350);
      expect(detail.filterField).toBe("StageName");
    });
  });
});
