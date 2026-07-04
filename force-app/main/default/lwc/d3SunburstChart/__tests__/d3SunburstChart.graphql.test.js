// ABOUTME: Tests the additive GraphQL self-fetch path on d3SunburstChart (Approach A).
// ABOUTME: Covers the CT-AGG (single-level) and CT-MG (secondaryGroupByField, two-level) branches.
import { createElement } from "lwc";
import D3SunburstChart from "c/d3SunburstChart";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

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
  shouldUseCompactMode: jest.fn().mockReturnValue(false),
  applySvgA11y: jest.fn()
}));

// Same hand-rolled hierarchy/partition/arc mock as d3SunburstChart.test.js,
// needed so renderChart's d3.hierarchy(...).sum().sort() and d3.partition()
// calls actually execute against the graphql-sourced rootData.
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

// Live-verified aggregate envelope (matches d3BarChart.graphql.test.js).
const AGG_RESPONSE = {
  uiapi: {
    aggregate: {
      Opportunity: {
        edges: [
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                Amount: { sum: { value: 350 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Closed Won" },
                Amount: { sum: { value: 800 } }
              }
            }
          }
        ]
      }
    }
  }
};

// Live-verified multi-group envelope (matches d3StackedBarChart.graphql.test.js shape).
const MULTI_GROUP_RESPONSE = {
  uiapi: {
    aggregate: {
      Opportunity: {
        edges: [
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                Type: { value: "New" },
                Amount: { sum: { value: 300 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                Type: { value: "Existing" },
                Amount: { sum: { value: 50 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Closed Won" },
                Type: { value: "New" },
                Amount: { sum: { value: 500 } }
              }
            }
          }
        ]
      }
    }
  }
};

async function flushPromises() {
  return Promise.resolve();
}

describe("d3SunburstChart GraphQL path (Approach A)", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);

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
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("renders a single-level sunburst (CT-AGG) when GraphQL aggregate data arrives", async () => {
    const element = createElement("c-d3-sunburst-chart", {
      is: D3SunburstChart
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(AGG_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();

    // Proves renderChart actually ran: d3.hierarchy/partition are only called
    // deep inside renderChart, with the 2 aggregate groups as top-level
    // (single-level) children.
    expect(mockD3.hierarchy).toHaveBeenCalledTimes(1);
    expect(mockD3.hierarchy.mock.calls[0][0].children).toHaveLength(2);
    expect(mockD3.partition).toHaveBeenCalledTimes(1);
  });

  it("renders a two-level nested sunburst (CT-MG) when secondaryGroupByField is set", async () => {
    const element = createElement("c-d3-sunburst-chart", {
      is: D3SunburstChart
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.secondaryGroupByField = "Type";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(MULTI_GROUP_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();

    const rootData = mockD3.hierarchy.mock.calls[0][0];
    expect(rootData.children).toHaveLength(2);
    expect(Array.isArray(rootData.children[0].children)).toBe(true);
    expect(mockD3.partition).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-sunburst-chart", {
      is: D3SunburstChart
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).not.toBeNull();
  });
});
