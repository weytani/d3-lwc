// ABOUTME: Tests the additive GraphQL self-fetch path on d3Treemap (Approach A).
// ABOUTME: Covers the CT-AGG (single-level) and CT-MG (secondaryGroupByField, two-level) branches.
import { createElement } from "lwc";
import D3Treemap from "c/d3Treemap";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
  formatPercent: jest.fn((v) => (v * 100).toFixed(1) + "%"),
  createTooltip: jest.fn().mockReturnValue({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn()
  }),
  createResizeHandler: jest.fn().mockReturnValue({
    observe: jest.fn(),
    disconnect: jest.fn()
  }),
  createLayoutRetry: jest.fn().mockReturnValue({ cancel: jest.fn() }),
  truncateLabel: jest.fn((label) => label),
  applySvgA11y: jest.fn(),
  getContrastColor: jest.fn(() => "#000000")
}));

// Same hand-rolled hierarchy/treemap mock as d3Treemap.test.js, needed so
// renderChart's d3.hierarchy(...).sum().sort() and d3.treemap() calls
// actually execute against the graphql-sourced rootData instead of throwing
// on undefined chain methods.
const createMockD3 = () => {
  const mockD3 = {
    select: jest.fn(() => mockD3),
    append: jest.fn(() => mockD3),
    insert: jest.fn(() => mockD3),
    attr: jest.fn(() => mockD3),
    style: jest.fn(() => mockD3),
    call: jest.fn(() => mockD3),
    selectAll: jest.fn(() => mockD3),
    data: jest.fn((arr) => {
      mockD3._lastData = arr;
      return mockD3;
    }),
    enter: jest.fn(() => mockD3),
    transition: jest.fn(() => mockD3),
    duration: jest.fn(() => mockD3),
    delay: jest.fn(() => mockD3),
    on: jest.fn(() => mockD3),
    remove: jest.fn(() => mockD3),
    html: jest.fn(() => mockD3),
    text: jest.fn(() => mockD3),
    datum: jest.fn(() => mockD3),
    node: jest.fn(() => null),
    each: jest.fn((callback) => {
      const items = mockD3._lastData || [];
      if (callback) {
        const nodes = items.map(() => ({}));
        items.forEach((item, i) => callback(item, i, nodes));
      }
      return mockD3;
    }),
    hierarchy: jest.fn((data) => {
      const createNode = (d, parent = null, depth = 0) => {
        const node = {
          data: d,
          depth,
          parent,
          value: 0,
          x0: 0,
          x1: 100,
          y0: 0,
          y1: 100,
          children: null
        };
        if (d.children) {
          node.children = d.children.map((child) =>
            createNode(child, node, depth + 1)
          );
        } else {
          node.value = d.value || 0;
        }
        return node;
      };

      const root = createNode(data);
      root.sum = jest.fn(() => root);
      root.sort = jest.fn(() => root);
      root.leaves = jest.fn(() => {
        const leaves = [];
        const traverse = (node) => {
          if (!node.children) {
            leaves.push(node);
          } else {
            node.children.forEach(traverse);
          }
        };
        traverse(root);
        return leaves;
      });
      root.descendants = jest.fn(() => {
        const nodes = [];
        const traverse = (node) => {
          nodes.push(node);
          if (node.children) {
            node.children.forEach(traverse);
          }
        };
        traverse(root);
        return nodes;
      });
      return root;
    }),
    treemap: jest.fn(() => {
      const treemapFn = jest.fn((root) => root);
      treemapFn.size = jest.fn(() => treemapFn);
      treemapFn.paddingOuter = jest.fn(() => treemapFn);
      treemapFn.paddingInner = jest.fn(() => treemapFn);
      treemapFn.paddingTop = jest.fn(() => treemapFn);
      treemapFn.round = jest.fn(() => treemapFn);
      return treemapFn;
    })
  };
  return mockD3;
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
                Amount: { sum: { value: 30000 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Closed Won" },
                Amount: { sum: { value: 105000 } }
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
                Type: { value: "New Business" },
                Amount: { sum: { value: 25000 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                Type: { value: "Existing" },
                Amount: { sum: { value: 5000 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Closed Won" },
                Type: { value: "New Business" },
                Amount: { sum: { value: 105000 } }
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

describe("d3Treemap GraphQL path (Approach A)", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);

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

  it("renders a single-level treemap (CT-AGG) when GraphQL aggregate data arrives", async () => {
    const element = createElement("c-d3-treemap", { is: D3Treemap });
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

    // Proves renderChart actually ran: d3.hierarchy/treemap are only called
    // deep inside renderChart, with the 2 aggregate groups as top-level
    // children (single-level, no secondaryGroupByField nesting).
    expect(mockD3.hierarchy).toHaveBeenCalledTimes(1);
    expect(mockD3.hierarchy.mock.calls[0][0].children).toHaveLength(2);
    expect(mockD3.treemap).toHaveBeenCalledTimes(1);
  });

  it("renders a two-level nested treemap (CT-MG) when secondaryGroupByField is set", async () => {
    const element = createElement("c-d3-treemap", { is: D3Treemap });
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

    // Two primary groups (Prospecting, Closed Won), each with its own
    // children array — proves the two-level pivot ran, not the CT-AGG branch.
    const rootData = mockD3.hierarchy.mock.calls[0][0];
    expect(rootData.children).toHaveLength(2);
    expect(Array.isArray(rootData.children[0].children)).toBe(true);
    expect(mockD3.treemap).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-treemap", { is: D3Treemap });
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
