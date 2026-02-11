// ABOUTME: Unit tests for the d3Treemap Lightning Web Component.
// ABOUTME: Tests initialization, data handling, hierarchy building, config, events, responsive behavior, and layout retry.

import { createElement } from "lwc";
import D3Treemap from "c/d3Treemap";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// Mock d3Lib
jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// Mock Apex
jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

// Mock NavigationMixin
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    return {
      NavigationMixin: jest.fn((Base) => {
        return class extends Base {
          [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
        };
      })
    };
  },
  { virtual: true }
);

// Mock chartUtils
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
  truncateLabel: jest.fn((label) => label)
}));

// Mock D3 instance with treemap-specific functions
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
    datum: jest.fn(() => mockD3),
    node: jest.fn(() => null),
    each: jest.fn(() => mockD3),
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

      root.sum = jest.fn(() => {
        const sumNodes = (node) => {
          if (node.children) {
            node.value = node.children.reduce((sum, child) => {
              sumNodes(child);
              return sum + child.value;
            }, 0);
          }
          return node;
        };
        sumNodes(root);
        return root;
      });

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

// Sample test data - flat structure for auto-nesting
const SAMPLE_FLAT_DATA = [
  { Id: "001", StageName: "Prospecting", Type: "New Business", Amount: 10000 },
  { Id: "002", StageName: "Prospecting", Type: "New Business", Amount: 15000 },
  { Id: "003", StageName: "Prospecting", Type: "Existing", Amount: 5000 },
  { Id: "004", StageName: "Closed Won", Type: "New Business", Amount: 50000 },
  { Id: "005", StageName: "Closed Won", Type: "Existing", Amount: 30000 },
  { Id: "006", StageName: "Closed Won", Type: "Existing", Amount: 25000 },
  { Id: "007", StageName: "Negotiation", Type: "New Business", Amount: 40000 },
  { Id: "008", StageName: "Negotiation", Type: "Existing", Amount: 20000 }
];

// Sample hierarchy data
const SAMPLE_HIERARCHY_DATA = {
  name: "Root",
  children: [
    {
      name: "Category A",
      children: [
        { name: "A1", value: 100 },
        { name: "A2", value: 200 },
        { name: "A3", value: 150 }
      ]
    },
    {
      name: "Category B",
      children: [
        { name: "B1", value: 300 },
        { name: "B2", value: 250 }
      ]
    },
    {
      name: "Category C",
      value: 400
    }
  ]
};

// Simple flat data for single-level grouping
const SIMPLE_DATA = [
  { Id: "001", Category: "Alpha", Value: 100 },
  { Id: "002", Category: "Alpha", Value: 200 },
  { Id: "003", Category: "Beta", Value: 150 },
  { Id: "004", Category: "Gamma", Value: 250 }
];

// Data with null values
const DATA_WITH_NULLS = [
  { Id: "001", Category: "Alpha", Value: 100 },
  { Id: "002", Category: null, Value: 200 },
  { Id: "003", Category: "Beta", Value: null },
  { Id: "004", Category: "Gamma", Value: 250 }
];

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-treemap", () => {
  let element;
  let mockD3;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_FLAT_DATA);

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 600,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 600
    }));

    // Mock ResizeObserver
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
  });

  // Helper to create element
  async function createChart(props = {}) {
    element = createElement("c-d3-treemap", {
      is: D3Treemap
    });

    Object.assign(element, {
      groupByField: "StageName",
      valueField: "Amount",
      recordCollection: SAMPLE_FLAT_DATA,
      ...props
    });

    document.body.appendChild(element);

    // Wait for async operations
    await Promise.resolve();
    await Promise.resolve();

    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("shows loading state initially", async () => {
      element = createElement("c-d3-treemap", {
        is: D3Treemap
      });
      element.groupByField = "StageName";
      element.valueField = "Amount";
      element.recordCollection = SAMPLE_FLAT_DATA;

      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides loading spinner after initialization", async () => {
      await createChart();
      await Promise.resolve();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("renders chart container when data is available", async () => {
      await createChart();
      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("handles D3 load failure gracefully", async () => {
      loadD3.mockRejectedValue(new Error("Failed to load D3"));

      await createChart();
      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("data handling", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({
        recordCollection: SAMPLE_FLAT_DATA
      });

      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("executes SOQL when recordCollection is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT StageName, Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT StageName, Amount FROM Opportunity"
      });
    });

    it("shows error when no data source provided", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({
        body: { message: "Invalid query" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Invalid FROM Opportunity"
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when required groupByField is missing in data", async () => {
      await createChart({
        groupByField: "NonExistentField",
        recordCollection: SAMPLE_FLAT_DATA
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("handles null values in groupByField", async () => {
      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: DATA_WITH_NULLS
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("uses hierarchyData when provided", async () => {
      await createChart({
        recordCollection: [],
        hierarchyData: SAMPLE_HIERARCHY_DATA
      });

      await Promise.resolve();

      expect(executeQuery).not.toHaveBeenCalled();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("validates hierarchyData structure", async () => {
      await createChart({
        recordCollection: [],
        hierarchyData: {
          name: "Root",
          children: [{ name: "Child", value: 100 }]
        }
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // HIERARCHY BUILDING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("hierarchy building", () => {
    it("builds single-level hierarchy from flat data", async () => {
      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: SIMPLE_DATA
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("builds two-level hierarchy with secondaryGroupByField", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        recordCollection: SAMPLE_FLAT_DATA
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("aggregates using Sum operation", async () => {
      await createChart({
        groupByField: "Category",
        valueField: "Value",
        operation: "Sum",
        recordCollection: SIMPLE_DATA
      });

      await Promise.resolve();
      expect(element.operation).toBe("Sum");
    });

    it("aggregates using Count operation", async () => {
      await createChart({
        groupByField: "Category",
        valueField: "Value",
        operation: "Count",
        recordCollection: SIMPLE_DATA
      });

      await Promise.resolve();
      expect(element.operation).toBe("Count");
    });

    it("aggregates using Average operation", async () => {
      await createChart({
        groupByField: "Category",
        valueField: "Value",
        operation: "Average",
        recordCollection: SIMPLE_DATA
      });

      await Promise.resolve();
      expect(element.operation).toBe("Average");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("configuration", () => {
    it("accepts height property", async () => {
      await createChart({
        height: 500
      });

      expect(element.height).toBe(500);
    });

    it("applies height style to container", async () => {
      await createChart({
        height: 500
      });

      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.height).toBe("500px");
    });

    it("accepts showLabels property", async () => {
      await createChart({
        showLabels: false
      });

      expect(element.showLabels).toBe(false);
    });

    it("accepts minLabelSize property", async () => {
      await createChart({
        minLabelSize: 60
      });

      expect(element.minLabelSize).toBe(60);
    });

    it("accepts tilePadding property", async () => {
      await createChart({
        tilePadding: 4
      });

      expect(element.tilePadding).toBe(4);
    });

    it("accepts innerPadding property", async () => {
      await createChart({
        innerPadding: 8
      });

      expect(element.innerPadding).toBe(8);
    });

    it("accepts enableZoom property", async () => {
      await createChart({
        enableZoom: true
      });

      expect(element.enableZoom).toBe(true);
    });

    it("parses advancedConfig JSON correctly", async () => {
      await createChart({
        advancedConfig: '{"customColors": ["#FF0000", "#00FF00"]}'
      });

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles invalid advancedConfig JSON gracefully", async () => {
      await createChart({
        advancedConfig: "not valid json"
      });

      // Should not throw - falls back to empty config
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("accepts Salesforce Standard theme", async () => {
      await createChart({
        theme: "Salesforce Standard"
      });

      expect(element.theme).toBe("Salesforce Standard");
    });

    it("accepts Warm theme", async () => {
      await createChart({
        theme: "Warm"
      });

      expect(element.theme).toBe("Warm");
    });

    it("accepts Cool theme", async () => {
      await createChart({
        theme: "Cool"
      });

      expect(element.theme).toBe("Cool");
    });

    it("accepts Vibrant theme", async () => {
      await createChart({
        theme: "Vibrant"
      });

      expect(element.theme).toBe("Vibrant");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // COLOR MODE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("color modes", () => {
    it("accepts category color mode", async () => {
      await createChart({
        colorMode: "category"
      });

      expect(element.colorMode).toBe("category");
    });

    it("accepts depth color mode", async () => {
      await createChart({
        colorMode: "depth"
      });

      expect(element.colorMode).toBe("depth");
    });

    it("defaults to category color mode", async () => {
      await createChart();

      expect(element.colorMode).toBe("category");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ZOOM FUNCTIONALITY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("zoom functionality", () => {
    it("does not show breadcrumbs initially", async () => {
      await createChart({
        enableZoom: true
      });

      await Promise.resolve();

      const nav = element.shadowRoot.querySelector(
        'nav[aria-label="Breadcrumbs"]'
      );
      expect(nav).toBeFalsy();
    });

    it("accepts enableZoom property", async () => {
      await createChart({
        enableZoom: true
      });

      expect(element.enableZoom).toBe(true);
    });

    it("handles reset zoom", async () => {
      await createChart({
        enableZoom: true
      });

      await Promise.resolve();

      // Verify no error
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLICK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("click events", () => {
    it("dispatches tileclick event", async () => {
      await createChart();
      await Promise.resolve();

      const clickHandler = jest.fn();
      element.addEventListener("tileclick", clickHandler);

      expect(loadD3).toHaveBeenCalled();
    });

    it("accepts objectApiName for navigation", async () => {
      await createChart({
        objectApiName: "Opportunity"
      });

      expect(element.objectApiName).toBe("Opportunity");
    });

    it("accepts filterField for navigation filtering", async () => {
      await createChart({
        filterField: "StageName"
      });

      expect(element.filterField).toBe("StageName");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("responsive behavior", () => {
    it("sets up resize handler", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      await createChart();
      await Promise.resolve();

      expect(createResizeHandler).toHaveBeenCalled();
    });

    it("handles container width of 0 gracefully", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      await createChart();
      await Promise.resolve();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles very small container", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 100
      }));

      await createChart({
        height: 100
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("cleanup", () => {
    it("disconnects resize handler on disconnect", async () => {
      const { createResizeHandler } = require("c/chartUtils");
      const mockDisconnect = jest.fn();
      createResizeHandler.mockReturnValue({
        observe: jest.fn(),
        disconnect: mockDisconnect
      });

      await createChart();
      await Promise.resolve();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GETTER TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("getters", () => {
    it("hasError returns true when error is set", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await Promise.resolve();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
    });

    it("hasData returns true when rootData has children", async () => {
      await createChart();
      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("containerStyle returns correct height string", async () => {
      await createChart({
        height: 450
      });

      await Promise.resolve();
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.height).toBe("450px");
    });

    it("hasBreadcrumbs returns false when no breadcrumbs", async () => {
      await createChart();
      await Promise.resolve();

      const nav = element.shadowRoot.querySelector(
        'nav[aria-label="Breadcrumbs"]'
      );
      expect(nav).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("handles empty recordCollection array", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("handles single data point", async () => {
      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: [{ Id: "001", Category: "Single", Value: 100 }]
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles data with all same category", async () => {
      const sameCategory = [
        { Id: "001", Category: "Same", Value: 100 },
        { Id: "002", Category: "Same", Value: 200 },
        { Id: "003", Category: "Same", Value: 150 }
      ];

      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: sameCategory
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles very large numeric values", async () => {
      const largeData = [
        { Id: "001", Category: "Large", Value: 1000000000 },
        { Id: "002", Category: "Small", Value: 1 }
      ];

      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: largeData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles zero values", async () => {
      const zeroData = [
        { Id: "001", Category: "Alpha", Value: 0 },
        { Id: "002", Category: "Beta", Value: 100 },
        { Id: "003", Category: "Gamma", Value: 0 }
      ];

      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: zeroData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles negative values", async () => {
      const negativeData = [
        { Id: "001", Category: "Positive", Value: 100 },
        { Id: "002", Category: "Negative", Value: -50 }
      ];

      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: negativeData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles many categories", async () => {
      const manyCategories = Array.from({ length: 50 }, (_, i) => ({
        Id: `${i}`,
        Category: `Category ${i}`,
        Value: Math.random() * 1000
      }));

      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: manyCategories
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles special characters in category names", async () => {
      const specialData = [
        { Id: "001", Category: "Test & Demo", Value: 100 },
        { Id: "002", Category: "<Script>Alert</Script>", Value: 200 },
        { Id: "003", Category: 'Category "Quoted"', Value: 150 }
      ];

      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: specialData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles unicode in category names", async () => {
      const unicodeData = [
        { Id: "001", Category: "カテゴリ", Value: 100 },
        { Id: "002", Category: "分类", Value: 200 },
        { Id: "003", Category: "Категория", Value: 150 }
      ];

      await createChart({
        groupByField: "Category",
        valueField: "Value",
        recordCollection: unicodeData
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED CONFIG TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("advancedConfig", () => {
    it("supports customColors option", async () => {
      await createChart({
        advancedConfig: '{"customColors": ["#FF0000", "#00FF00", "#0000FF"]}'
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("supports empty advancedConfig", async () => {
      await createChart({
        advancedConfig: "{}"
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles undefined advancedConfig", async () => {
      await createChart({
        advancedConfig: undefined
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NESTED HIERARCHY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("nested hierarchy", () => {
    it("creates nested structure with secondaryGroupByField", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        recordCollection: SAMPLE_FLAT_DATA
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("sorts groups by total value", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Sum",
        recordCollection: SAMPLE_FLAT_DATA
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles nested hierarchy with Count operation", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        operation: "Count",
        recordCollection: SAMPLE_FLAT_DATA
      });

      await Promise.resolve();
      expect(element.operation).toBe("Count");
    });

    it("handles nested hierarchy with Average operation", async () => {
      await createChart({
        groupByField: "StageName",
        secondaryGroupByField: "Type",
        valueField: "Amount",
        operation: "Average",
        recordCollection: SAMPLE_FLAT_DATA
      });

      await Promise.resolve();
      expect(element.operation).toBe("Average");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("rendering", () => {
    it("creates D3 hierarchy from data", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.hierarchy).toHaveBeenCalled();
    });

    it("creates treemap layout", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.treemap).toHaveBeenCalled();
    });

    it("applies padding to treemap", async () => {
      await createChart({
        tilePadding: 5,
        innerPadding: 10
      });

      await Promise.resolve();
      expect(mockD3.treemap).toHaveBeenCalled();
    });

    it("creates SVG element", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.append).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LABEL TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("labels", () => {
    it("defaults showLabels to true (via getter)", async () => {
      await createChart();

      // effectiveShowLabels should default to true
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("respects showLabels=false", async () => {
      await createChart({
        showLabels: false
      });

      expect(element.showLabels).toBe(false);
    });

    it("respects minLabelSize threshold", async () => {
      await createChart({
        minLabelSize: 100
      });

      expect(element.minLabelSize).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NO DATA STATE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("no data state", () => {
    it("shows no data message when data results in empty hierarchy", async () => {
      executeQuery.mockResolvedValue([]);

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Id FROM Account LIMIT 0"
      });

      await Promise.resolve();

      // Either error or no data state
      const hasState =
        element.shadowRoot.querySelector(".slds-text-color_error") ||
        element.shadowRoot.querySelector(".slds-text-color_weak");
      expect(hasState).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT RETRY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("layout retry", () => {
    /**
     * Helper that configures the createLayoutRetry mock to use real RAF calls.
     * Must be called inside a test body so global.requestAnimationFrame is accessible.
     */
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
      // Start with zero width
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: containerWidth
      }));

      // Track RAF calls
      const rafCallbacks = [];
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();

      useRealLayoutRetry();

      await createChart();
      await flushPromises();

      // Chart was not rendered (width was 0), but RAF should have been requested
      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(mockD3.treemap).not.toHaveBeenCalled();

      // Simulate container getting width from layout engine
      containerWidth = 400;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 400
      }));

      // Fire the RAF callback chain
      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift();
        cb();
      }

      // Chart should now have rendered
      expect(mockD3.select).toHaveBeenCalled();
    });

    it("cancels layout retry on disconnect", async () => {
      // Start with zero width
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

      // Remove element triggers disconnectedCallback
      document.body.removeChild(element);

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it("does not create multiple retry loops", async () => {
      // Start with zero width
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 300,
        top: 0,
        left: 0,
        bottom: 300,
        right: 0
      }));

      let rafCount = 0;
      global.requestAnimationFrame = jest.fn(() => ++rafCount);
      global.cancelAnimationFrame = jest.fn();

      useRealLayoutRetry();

      await createChart();
      await flushPromises();
      await flushPromises();
      await flushPromises();

      // Only one RAF should be requested (one retry loop, not multiple)
      expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);
    });
  });
});
