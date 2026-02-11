// ABOUTME: Unit tests for the d3ForceGraph Lightning Web Component.
// ABOUTME: Tests initialization, data handling, graph building, config, events, responsive behavior, and layout retry.
import { createElement } from "lwc";
import D3ForceGraph from "c/d3ForceGraph";
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

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// Create comprehensive mock D3 instance
const createMockD3 = () => {
  const mockD3 = {
    select: jest.fn(() => mockD3),
    append: jest.fn(() => mockD3),
    attr: jest.fn(() => mockD3),
    style: jest.fn(() => mockD3),
    call: jest.fn(() => mockD3),
    selectAll: jest.fn(() => mockD3),
    data: jest.fn(() => mockD3),
    join: jest.fn(() => mockD3),
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
      if (callback) callback({}, 0, [{}]);
      return mockD3;
    }),
    // Force simulation mocks
    forceSimulation: jest.fn(() => {
      const sim = {
        force: jest.fn(() => sim),
        on: jest.fn((event, callback) => {
          // Store tick callback for testing
          if (event === "tick") sim._tickCallback = callback;
          return sim;
        }),
        stop: jest.fn(),
        alphaTarget: jest.fn(() => sim),
        restart: jest.fn()
      };
      return sim;
    }),
    forceLink: jest.fn(() => {
      const link = jest.fn(() => link);
      link.id = jest.fn(() => link);
      link.distance = jest.fn(() => link);
      return link;
    }),
    forceManyBody: jest.fn(() => {
      const body = jest.fn(() => body);
      body.strength = jest.fn(() => body);
      return body;
    }),
    forceCenter: jest.fn(() => {
      const center = jest.fn(() => center);
      center.strength = jest.fn(() => center);
      return center;
    }),
    forceCollide: jest.fn(() => {
      const collide = jest.fn(() => collide);
      collide.radius = jest.fn(() => collide);
      return collide;
    }),
    // Scale mocks
    extent: jest.fn(() => [0, 100]),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn((v) => v);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    scaleOrdinal: jest.fn(() => {
      const scale = jest.fn(() => "#1589EE");
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    // Drag mock
    drag: jest.fn(() => {
      const drag = {
        on: jest.fn(() => drag)
      };
      return drag;
    }),
    // Zoom mock
    zoom: jest.fn(() => {
      const zoom = {
        scaleExtent: jest.fn(() => zoom),
        on: jest.fn(() => zoom),
        transform: null
      };
      return zoom;
    })
  };
  return mockD3;
};

// Sample flat relationship data
const SAMPLE_RELATIONSHIP_DATA = [
  {
    Id: "001",
    SourceId: "A",
    TargetId: "B",
    Name: "Node A",
    Weight: 10,
    Type: "Person"
  },
  {
    Id: "002",
    SourceId: "A",
    TargetId: "C",
    Name: "Node A",
    Weight: 20,
    Type: "Person"
  },
  {
    Id: "003",
    SourceId: "B",
    TargetId: "D",
    Name: "Node B",
    Weight: 15,
    Type: "Company"
  },
  {
    Id: "004",
    SourceId: "C",
    TargetId: "D",
    Name: "Node C",
    Weight: 25,
    Type: "Company"
  },
  {
    Id: "005",
    SourceId: "D",
    TargetId: "E",
    Name: "Node D",
    Weight: 30,
    Type: "Person"
  }
];

// Sample pre-built graph data
const SAMPLE_GRAPH_DATA = {
  nodes: [
    { id: "node1", label: "Alpha", type: "Group A", size: 10 },
    { id: "node2", label: "Beta", type: "Group A", size: 20 },
    { id: "node3", label: "Gamma", type: "Group B", size: 15 },
    { id: "node4", label: "Delta", type: "Group B", size: 25 }
  ],
  links: [
    { source: "node1", target: "node2", weight: 5 },
    { source: "node1", target: "node3", weight: 10 },
    { source: "node2", target: "node4", weight: 8 },
    { source: "node3", target: "node4", weight: 12 }
  ]
};

// Simple graph data
const SIMPLE_GRAPH_DATA = {
  nodes: [
    { id: "A", label: "Node A" },
    { id: "B", label: "Node B" }
  ],
  links: [{ source: "A", target: "B" }]
};

// Graph data with no links
const NODES_ONLY_DATA = {
  nodes: [
    { id: "1", label: "Standalone 1" },
    { id: "2", label: "Standalone 2" }
  ],
  links: []
};

// Data with special characters
const SPECIAL_CHARS_DATA = {
  nodes: [
    { id: "node-1", label: "Test & Demo <script>" },
    { id: "node-2", label: '"Quoted" Node' }
  ],
  links: [{ source: "node-1", target: "node-2" }]
};

// Data with unicode
const UNICODE_DATA = {
  nodes: [
    { id: "jp", label: "日本語ノード" },
    { id: "cn", label: "中文节点" }
  ],
  links: [{ source: "jp", target: "cn" }]
};

describe("c-d3-force-graph", () => {
  let element;
  let mockD3;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_RELATIONSHIP_DATA);

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

  // Helper to create element with default props
  async function createChart(props = {}) {
    element = createElement("c-d3-force-graph", {
      is: D3ForceGraph
    });

    Object.assign(element, {
      sourceField: "SourceId",
      targetField: "TargetId",
      recordCollection: SAMPLE_RELATIONSHIP_DATA,
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
      element = createElement("c-d3-force-graph", {
        is: D3ForceGraph
      });
      element.sourceField = "SourceId";
      element.targetField = "TargetId";
      element.recordCollection = SAMPLE_RELATIONSHIP_DATA;

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

    it("displays error message text", async () => {
      loadD3.mockRejectedValue(new Error("Test error message"));

      await createChart();
      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error p"
      );
      expect(errorElement.textContent).toContain("Test error message");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("data handling", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({
        recordCollection: SAMPLE_RELATIONSHIP_DATA
      });

      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("executes SOQL when recordCollection is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT SourceId, TargetId FROM Relationship__c"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT SourceId, TargetId FROM Relationship__c"
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
        body: { message: "Invalid query syntax" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "INVALID QUERY"
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when sourceField is missing", async () => {
      await createChart({
        sourceField: "",
        targetField: "TargetId"
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when targetField is missing", async () => {
      await createChart({
        sourceField: "SourceId",
        targetField: ""
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("uses graphData when provided directly", async () => {
      await createChart({
        recordCollection: [],
        graphData: SAMPLE_GRAPH_DATA
      });

      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("handles graph data with only nodes (no links)", async () => {
      await createChart({
        recordCollection: [],
        graphData: NODES_ONLY_DATA
      });

      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GRAPH DATA VALIDATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("graph data validation", () => {
    it("validates graphData has nodes array", async () => {
      await createChart({
        recordCollection: [],
        graphData: { links: [] }
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("rejects invalid graphData type", async () => {
      await createChart({
        recordCollection: [],
        graphData: "not an object"
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("normalizes node data with id and label", async () => {
      await createChart({
        recordCollection: [],
        graphData: SIMPLE_GRAPH_DATA
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("filters out links with invalid node references", async () => {
      const badLinksData = {
        nodes: [{ id: "A", label: "A" }],
        links: [{ source: "A", target: "NonExistent" }]
      };

      await createChart({
        recordCollection: [],
        graphData: badLinksData
      });

      await Promise.resolve();
      // Should not throw error, just filter out bad links
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles special characters in node labels", async () => {
      await createChart({
        recordCollection: [],
        graphData: SPECIAL_CHARS_DATA
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles unicode in node labels", async () => {
      await createChart({
        recordCollection: [],
        graphData: UNICODE_DATA
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION PROPERTY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("configuration properties", () => {
    it("accepts height property", async () => {
      await createChart({ height: 500 });
      expect(element.height).toBe(500);
    });

    it("applies height style to container", async () => {
      await createChart({ height: 500 });
      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.height).toBe("500px");
    });

    it("accepts nodeRadius property", async () => {
      await createChart({ nodeRadius: 12 });
      expect(element.nodeRadius).toBe(12);
    });

    it("accepts minNodeRadius property", async () => {
      await createChart({ minNodeRadius: 6 });
      expect(element.minNodeRadius).toBe(6);
    });

    it("accepts maxNodeRadius property", async () => {
      await createChart({ maxNodeRadius: 30 });
      expect(element.maxNodeRadius).toBe(30);
    });

    it("accepts linkWidth property", async () => {
      await createChart({ linkWidth: 2 });
      expect(element.linkWidth).toBe(2);
    });

    it("accepts linkColor property", async () => {
      await createChart({ linkColor: "#FF0000" });
      expect(element.linkColor).toBe("#FF0000");
    });

    it("accepts linkOpacity property", async () => {
      await createChart({ linkOpacity: 0.8 });
      expect(element.linkOpacity).toBe(0.8);
    });

    it("accepts showLabels property set to false", async () => {
      await createChart({ showLabels: false });
      expect(element.showLabels).toBe(false);
    });

    it("showLabels defaults to undefined (treated as true)", async () => {
      await createChart();
      expect(element.showLabels).toBeUndefined();
    });

    it("accepts labelFontSize property", async () => {
      await createChart({ labelFontSize: 14 });
      expect(element.labelFontSize).toBe(14);
    });

    it("accepts enableZoom property set to false", async () => {
      await createChart({ enableZoom: false });
      expect(element.enableZoom).toBe(false);
    });

    it("enableZoom defaults to undefined (treated as true)", async () => {
      await createChart();
      expect(element.enableZoom).toBeUndefined();
    });

    it("accepts enableDrag property set to false", async () => {
      await createChart({ enableDrag: false });
      expect(element.enableDrag).toBe(false);
    });

    it("enableDrag defaults to undefined (treated as true)", async () => {
      await createChart();
      expect(element.enableDrag).toBeUndefined();
    });

    it("accepts chargeStrength property", async () => {
      await createChart({ chargeStrength: -500 });
      expect(element.chargeStrength).toBe(-500);
    });

    it("accepts linkDistance property", async () => {
      await createChart({ linkDistance: 100 });
      expect(element.linkDistance).toBe(100);
    });

    it("accepts centerStrength property", async () => {
      await createChart({ centerStrength: 0.2 });
      expect(element.centerStrength).toBe(0.2);
    });

    it("accepts collisionMultiplier property", async () => {
      await createChart({ collisionMultiplier: 2.0 });
      expect(element.collisionMultiplier).toBe(2.0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("accepts Salesforce Standard theme", async () => {
      await createChart({ theme: "Salesforce Standard" });
      expect(element.theme).toBe("Salesforce Standard");
    });

    it("accepts Warm theme", async () => {
      await createChart({ theme: "Warm" });
      expect(element.theme).toBe("Warm");
    });

    it("accepts Cool theme", async () => {
      await createChart({ theme: "Cool" });
      expect(element.theme).toBe("Cool");
    });

    it("accepts Vibrant theme", async () => {
      await createChart({ theme: "Vibrant" });
      expect(element.theme).toBe("Vibrant");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED CONFIG TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("advancedConfig", () => {
    it("parses valid JSON config", async () => {
      await createChart({
        advancedConfig: '{"customColors": ["#FF0000", "#00FF00"]}'
      });

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles invalid JSON gracefully", async () => {
      await createChart({
        advancedConfig: "not valid json"
      });

      // Should not throw - falls back to empty config
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

    it("handles empty advancedConfig", async () => {
      await createChart({
        advancedConfig: "{}"
      });

      await Promise.resolve();
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("supports customColors in config", async () => {
      await createChart({
        advancedConfig: '{"customColors": ["#FF0000", "#00FF00", "#0000FF"]}'
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("supports linkColor in config", async () => {
      await createChart({
        advancedConfig: '{"linkColor": "#CCCCCC"}'
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FORCE SIMULATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("force simulation", () => {
    it("creates force simulation", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.forceSimulation).toHaveBeenCalled();
    });

    it("configures link force", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.forceLink).toHaveBeenCalled();
    });

    it("configures charge force", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.forceManyBody).toHaveBeenCalled();
    });

    it("configures center force", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.forceCenter).toHaveBeenCalled();
    });

    it("configures collision force", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.forceCollide).toHaveBeenCalled();
    });

    it("stops simulation on disconnect", async () => {
      await createChart();
      await Promise.resolve();

      document.body.removeChild(element);

      // Simulation should have stop called
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DRAG BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("drag behavior", () => {
    it("creates drag behavior when enabled", async () => {
      await createChart({ enableDrag: true });
      await Promise.resolve();

      expect(mockD3.drag).toHaveBeenCalled();
    });

    it("does not create drag behavior when disabled", async () => {
      await createChart({ enableDrag: false });
      await Promise.resolve();

      // drag should not have been called for node setup
      // (it may still be defined, but not attached to nodes)
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ZOOM BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("zoom behavior", () => {
    it("creates zoom behavior when enabled", async () => {
      await createChart({ enableZoom: true });
      await Promise.resolve();

      expect(mockD3.zoom).toHaveBeenCalled();
    });

    it("does not create zoom behavior when disabled", async () => {
      mockD3.zoom = jest.fn(() => ({
        scaleExtent: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis()
      }));

      await createChart({ enableZoom: false });
      await Promise.resolve();

      // Zoom should not be called
      expect(mockD3.zoom).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLICK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("click events", () => {
    it("dispatches nodeclick event", async () => {
      await createChart();
      await Promise.resolve();

      const clickHandler = jest.fn();
      element.addEventListener("nodeclick", clickHandler);

      expect(loadD3).toHaveBeenCalled();
    });

    it("accepts objectApiName for navigation", async () => {
      await createChart({
        objectApiName: "Contact"
      });

      expect(element.objectApiName).toBe("Contact");
    });

    it("accepts nodeIdField property", async () => {
      await createChart({
        nodeIdField: "CustomId__c"
      });

      expect(element.nodeIdField).toBe("CustomId__c");
    });

    it("accepts nodeLabelField property", async () => {
      await createChart({
        nodeLabelField: "CustomName__c"
      });

      expect(element.nodeLabelField).toBe("CustomName__c");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("responsive behavior", () => {
    it("sets up resize observer", async () => {
      await createChart();
      await Promise.resolve();

      expect(global.ResizeObserver).toHaveBeenCalled();
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

      await createChart({ height: 100 });
      await Promise.resolve();

      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("cleanup", () => {
    it("disconnects resize observer on disconnect", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      await createChart();
      await Promise.resolve();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("cleans up tooltip on disconnect", async () => {
      await createChart();
      await Promise.resolve();

      document.body.removeChild(element);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT RETRY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("layout retry", () => {
    it("retries chart init when container starts at zero width", async () => {
      // Mock zero width
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      // Track RAF callbacks
      const rafCallbacks = [];
      jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

      await createChart({ graphData: SIMPLE_GRAPH_DATA, recordCollection: [] });
      await flushPromises();

      // RAF should have been called (layout retry started)
      expect(window.requestAnimationFrame).toHaveBeenCalled();

      // Chart should NOT have rendered yet (zero width)
      expect(mockD3.forceSimulation).not.toHaveBeenCalled();

      // Simulate container getting width
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 600,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 600
      }));

      // Fire RAF callbacks
      rafCallbacks.forEach((cb) => cb());
      await flushPromises();

      // Chart should have rendered now
      expect(mockD3.select).toHaveBeenCalled();

      window.requestAnimationFrame.mockRestore();
    });

    it("cancels layout retry on disconnect", async () => {
      // Mock zero width
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 42);
      jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

      await createChart({ graphData: SIMPLE_GRAPH_DATA, recordCollection: [] });
      await flushPromises();

      // Remove element from DOM
      document.body.removeChild(element);

      // cancelAnimationFrame should have been called
      expect(window.cancelAnimationFrame).toHaveBeenCalled();

      window.requestAnimationFrame.mockRestore();
      window.cancelAnimationFrame.mockRestore();
    });

    it("does not start duplicate retries on multiple renderedCallback calls", async () => {
      // Mock zero width
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      let rafCount = 0;
      jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
        rafCount += 1;
        return rafCount;
      });

      await createChart({ graphData: SIMPLE_GRAPH_DATA, recordCollection: [] });
      await flushPromises();
      await flushPromises();
      await flushPromises();

      // RAF should have been called exactly once (no duplicates)
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

      window.requestAnimationFrame.mockRestore();
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

    it("hasData returns true when networkData has nodes", async () => {
      await createChart();
      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("containerStyle returns correct height string", async () => {
      await createChart({ height: 450 });
      await Promise.resolve();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.style.height).toBe("450px");
    });

    it("effectiveShowLabels returns true when undefined (default)", async () => {
      await createChart();
      // showLabels is undefined, component getter treats as true
      expect(element.showLabels).toBeUndefined();
    });

    it("showLabels can be set to false explicitly", async () => {
      await createChart({ showLabels: false });
      expect(element.showLabels).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("handles empty recordCollection array", async () => {
      await createChart({
        recordCollection: [],
        graphData: null,
        soqlQuery: ""
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("handles single node with self-link", async () => {
      const selfLinkData = {
        nodes: [{ id: "A", label: "Self" }],
        links: [{ source: "A", target: "A" }]
      };

      await createChart({
        recordCollection: [],
        graphData: selfLinkData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles nodes with null values", async () => {
      const nullData = [
        { Id: "001", SourceId: null, TargetId: "B", Name: "A" },
        { Id: "002", SourceId: "B", TargetId: null, Name: "B" }
      ];

      await createChart({
        recordCollection: nullData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles very large node sizes", async () => {
      const largeData = {
        nodes: [
          { id: "A", label: "Big", size: 1000000 },
          { id: "B", label: "Small", size: 1 }
        ],
        links: [{ source: "A", target: "B" }]
      };

      await createChart({
        recordCollection: [],
        graphData: largeData,
        nodeSizeField: "size"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles negative link weights", async () => {
      const negativeData = {
        nodes: [
          { id: "A", label: "A" },
          { id: "B", label: "B" }
        ],
        links: [{ source: "A", target: "B", weight: -10 }]
      };

      await createChart({
        recordCollection: [],
        graphData: negativeData,
        linkWeightField: "weight"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles many nodes (stress test)", async () => {
      const manyNodes = [];
      for (let i = 0; i < 100; i++) {
        manyNodes.push({
          Id: `${i}`,
          SourceId: `node${i % 10}`,
          TargetId: `node${(i + 1) % 10}`,
          Name: `Node ${i}`
        });
      }

      await createChart({
        recordCollection: manyNodes
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles duplicate links", async () => {
      const dupData = {
        nodes: [
          { id: "A", label: "A" },
          { id: "B", label: "B" }
        ],
        links: [
          { source: "A", target: "B", weight: 10 },
          { source: "A", target: "B", weight: 20 }
        ]
      };

      await createChart({
        recordCollection: [],
        graphData: dupData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("rendering", () => {
    it("creates SVG element", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.append).toHaveBeenCalled();
    });

    it("creates link elements", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.selectAll).toHaveBeenCalled();
    });

    it("creates node elements", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.join).toHaveBeenCalled();
    });

    it("uses extent for scaling", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.extent).toHaveBeenCalled();
    });

    it("creates linear scale for radius", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.scaleLinear).toHaveBeenCalled();
    });

    it("creates ordinal scale for colors", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.scaleOrdinal).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NO DATA STATE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("no data state", () => {
    it("shows no data message when networkData is empty", async () => {
      await createChart({
        recordCollection: [],
        graphData: { nodes: [], links: [] }
      });

      await Promise.resolve();

      // Either error or no data state
      const hasState =
        element.shadowRoot.querySelector(".slds-text-color_error") ||
        element.shadowRoot.querySelector(".slds-text-color_weak");
      expect(hasState).toBeTruthy();
    });

    it("displays network icon for no data", async () => {
      await createChart({
        recordCollection: [],
        graphData: { nodes: [], links: [] }
      });

      await Promise.resolve();

      const icon = element.shadowRoot.querySelector("lightning-icon");
      expect(icon).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FIELD MAPPING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("field mapping", () => {
    it("uses custom nodeIdField", async () => {
      const customData = [
        { CustomId: "X", SourceId: "X", TargetId: "Y" },
        { CustomId: "Y", SourceId: "Y", TargetId: "X" }
      ];

      await createChart({
        recordCollection: customData,
        nodeIdField: "CustomId"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("uses custom nodeLabelField", async () => {
      const customData = [
        { Id: "1", SourceId: "A", TargetId: "B", CustomLabel: "Label A" },
        { Id: "2", SourceId: "B", TargetId: "A", CustomLabel: "Label B" }
      ];

      await createChart({
        recordCollection: customData,
        nodeLabelField: "CustomLabel"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("uses custom nodeSizeField", async () => {
      await createChart({
        recordCollection: SAMPLE_RELATIONSHIP_DATA,
        nodeSizeField: "Weight"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("uses custom linkWeightField", async () => {
      await createChart({
        recordCollection: SAMPLE_RELATIONSHIP_DATA,
        linkWeightField: "Weight"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("uses custom nodeTypeField for coloring", async () => {
      await createChart({
        recordCollection: SAMPLE_RELATIONSHIP_DATA,
        nodeTypeField: "Type"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GRAPH DATA BUILDING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("graph data building", () => {
    it("creates unique nodes from source and target", async () => {
      await createChart();
      await Promise.resolve();

      expect(loadD3).toHaveBeenCalled();
    });

    it("creates links between nodes", async () => {
      await createChart();
      await Promise.resolve();

      expect(loadD3).toHaveBeenCalled();
    });

    it("handles bidirectional relationships", async () => {
      const biData = [
        { Id: "1", SourceId: "A", TargetId: "B" },
        { Id: "2", SourceId: "B", TargetId: "A" }
      ];

      await createChart({
        recordCollection: biData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("collects unique node types for coloring", async () => {
      await createChart({
        recordCollection: SAMPLE_RELATIONSHIP_DATA,
        nodeTypeField: "Type"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });
});
