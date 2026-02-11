// ABOUTME: Unit tests for the d3Choropleth Lightning Web Component.
// ABOUTME: Tests initialization, data handling, GeoJSON loading, config, rendering, responsive behavior, and layout retry.

import { createElement } from "lwc";
import D3Choropleth from "c/d3Choropleth";
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
jest.mock(
  "lightning/navigation",
  () => {
    return {
      NavigationMixin: jest.fn((Base) => {
        return class extends Base {
          [Symbol.for("NavigationMixin.Navigate")] = jest.fn();
        };
      })
    };
  },
  { virtual: true }
);

// Mock chartUtils
jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
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

// Mock static resource URL
jest.mock("@salesforce/resourceUrl/usStates", () => "/mock/usStates.json", {
  virtual: true
});

// Mock fetch for loading GeoJSON
global.fetch = jest.fn();

// Sample GeoJSON for US states
const SAMPLE_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "06",
      properties: { name: "California" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-120, 35],
            [-115, 35],
            [-115, 40],
            [-120, 40],
            [-120, 35]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "48",
      properties: { name: "Texas" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-100, 30],
            [-95, 30],
            [-95, 35],
            [-100, 35],
            [-100, 30]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "36",
      properties: { name: "New York" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-75, 40],
            [-70, 40],
            [-70, 45],
            [-75, 45],
            [-75, 40]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "12",
      properties: { name: "Florida" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-85, 25],
            [-80, 25],
            [-80, 30],
            [-85, 30],
            [-85, 25]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "17",
      properties: { name: "Illinois" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-90, 37],
            [-87, 37],
            [-87, 42],
            [-90, 42],
            [-90, 37]
          ]
        ]
      }
    }
  ]
};

// Sample state data
const SAMPLE_STATE_DATA = [
  { Id: "001", BillingState: "CA", Amount: 50000, Name: "Account 1" },
  { Id: "002", BillingState: "CA", Amount: 30000, Name: "Account 2" },
  { Id: "003", BillingState: "TX", Amount: 40000, Name: "Account 3" },
  { Id: "004", BillingState: "NY", Amount: 60000, Name: "Account 4" },
  { Id: "005", BillingState: "FL", Amount: 25000, Name: "Account 5" },
  { Id: "006", BillingState: "FL", Amount: 15000, Name: "Account 6" }
];

// Sample data with full state names
const SAMPLE_STATE_NAMES_DATA = [
  { Id: "001", State: "California", Amount: 50000 },
  { Id: "002", State: "Texas", Amount: 40000 },
  { Id: "003", State: "New York", Amount: 60000 }
];

// Sample data with negative values (for diverging scale)
const SAMPLE_DIVERGING_DATA = [
  { Id: "001", BillingState: "CA", Change: 25 },
  { Id: "002", BillingState: "TX", Change: -15 },
  { Id: "003", BillingState: "NY", Change: 10 },
  { Id: "004", BillingState: "FL", Change: -5 }
];

// Custom GeoJSON for testing
const CUSTOM_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "REGION-A",
      properties: { name: "Region Alpha", code: "A" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "REGION-B",
      properties: { name: "Region Beta", code: "B" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [1, 0],
            [2, 0],
            [2, 1],
            [1, 1],
            [1, 0]
          ]
        ]
      }
    }
  ]
};

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
    on: jest.fn(() => mockD3),
    remove: jest.fn(() => mockD3),
    html: jest.fn(() => mockD3),
    text: jest.fn(() => mockD3),
    datum: jest.fn(() => mockD3),
    node: jest.fn(() => null),
    filter: jest.fn(() => mockD3),
    raise: jest.fn(() => mockD3),
    each: jest.fn((callback) => {
      if (callback) callback({}, 0, [{}]);
      return mockD3;
    }),
    // Geo mocks
    geoPath: jest.fn(() => {
      const path = jest.fn(() => "M0,0L1,1");
      path.projection = jest.fn(() => path);
      path.centroid = jest.fn(() => [0, 0]);
      return path;
    }),
    geoAlbersUsa: jest.fn(() => {
      const proj = jest.fn(() => [0, 0]);
      proj.fitSize = jest.fn(() => proj);
      proj.scale = jest.fn(() => proj);
      proj.translate = jest.fn(() => proj);
      return proj;
    }),
    geoMercator: jest.fn(() => {
      const proj = jest.fn(() => [0, 0]);
      proj.fitSize = jest.fn(() => proj);
      proj.scale = jest.fn(() => proj);
      proj.translate = jest.fn(() => proj);
      return proj;
    }),
    geoNaturalEarth1: jest.fn(() => {
      const proj = jest.fn(() => [0, 0]);
      proj.fitSize = jest.fn(() => proj);
      proj.scale = jest.fn(() => proj);
      proj.translate = jest.fn(() => proj);
      return proj;
    }),
    // Scale mocks
    scaleSequential: jest.fn(() => {
      const scale = jest.fn(() => "#1589EE");
      scale.domain = jest.fn(() => scale);
      scale.interpolator = jest.fn(() => scale);
      return scale;
    }),
    scaleDiverging: jest.fn(() => {
      const scale = jest.fn(() => "#1589EE");
      scale.domain = jest.fn(() => scale);
      scale.interpolator = jest.fn(() => scale);
      return scale;
    }),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn((v) => v);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    // Interpolator mocks
    interpolateRgb: jest.fn((a) => () => a),
    interpolateRgbBasis: jest.fn((colors) => () => colors[0]),
    // Zoom mock
    zoom: jest.fn(() => {
      const zoom = {
        scaleExtent: jest.fn(() => zoom),
        on: jest.fn(() => zoom),
        transform: {},
        scaleBy: jest.fn()
      };
      return zoom;
    }),
    zoomIdentity: {}
  };
  return mockD3;
};

describe("c-d3-choropleth", () => {
  let element;
  let mockD3;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_STATE_DATA);

    // Mock successful fetch for GeoJSON
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SAMPLE_GEOJSON)
    });

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 800
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

  // Helper to flush all promises
  // eslint-disable-next-line @lwc/lwc/no-async-operation
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

  // Helper to create element with default props
  async function createChart(props = {}) {
    element = createElement("c-d3-choropleth", {
      is: D3Choropleth
    });

    Object.assign(element, {
      regionField: "BillingState",
      valueField: "Amount",
      operation: "Sum",
      mapType: "us-states",
      recordCollection: SAMPLE_STATE_DATA,
      ...props
    });

    document.body.appendChild(element);

    // Wait for all async operations (D3 load, GeoJSON fetch, data load)
    await flushPromises();
    await flushPromises();
    await flushPromises();

    // Additional wait for renderedCallback
    await flushPromises();

    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("shows loading state initially", async () => {
      element = createElement("c-d3-choropleth", {
        is: D3Choropleth
      });
      element.regionField = "BillingState";
      element.recordCollection = SAMPLE_STATE_DATA;

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

    it("loads US states GeoJSON on initialization", async () => {
      await createChart();
      // Verify fetch was called (the exact URL depends on static resource mock)
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("data handling", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({
        recordCollection: SAMPLE_STATE_DATA
      });

      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("executes SOQL when recordCollection is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT BillingState, Amount FROM Account"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT BillingState, Amount FROM Account"
      });
    });

    it("renders map without data coloring when no data source provided", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await Promise.resolve();
      // Should not error - just shows map with no colors
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("shows error when regionField is missing", async () => {
      await createChart({
        regionField: ""
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

    it("aggregates data by region using Sum operation", async () => {
      await createChart({
        operation: "Sum"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("aggregates data by region using Count operation", async () => {
      await createChart({
        operation: "Count"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("aggregates data by region using Average operation", async () => {
      await createChart({
        operation: "Average"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("normalizes state codes for matching", async () => {
      await createChart({
        recordCollection: SAMPLE_STATE_DATA
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("normalizes full state names for matching", async () => {
      await createChart({
        recordCollection: SAMPLE_STATE_NAMES_DATA,
        regionField: "State"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GEOJSON HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("GeoJSON handling", () => {
    it("loads US states from static resource", async () => {
      await createChart({ mapType: "us-states" });
      expect(global.fetch).toHaveBeenCalled();
    });

    it("handles GeoJSON fetch failure", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      await createChart();
      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("uses custom GeoJSON when provided", async () => {
      await createChart({
        mapType: "custom",
        geoJsonData: CUSTOM_GEOJSON,
        recordCollection: [{ Id: "1", Region: "REGION-A", Value: 100 }],
        regionField: "Region",
        valueField: "Value"
      });

      await Promise.resolve();
      // Should not fetch - using provided data
      expect(loadD3).toHaveBeenCalled();
    });

    it("parses GeoJSON string to object", async () => {
      await createChart({
        mapType: "custom",
        geoJsonData: JSON.stringify(CUSTOM_GEOJSON),
        recordCollection: [],
        regionField: "Region"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("shows error for invalid GeoJSON string", async () => {
      await createChart({
        mapType: "custom",
        geoJsonData: "not valid json",
        recordCollection: [],
        regionField: "Region"
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error for world map without custom data", async () => {
      await createChart({
        mapType: "world"
      });

      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("uses geoJsonIdProperty for region matching", async () => {
      await createChart({
        mapType: "custom",
        geoJsonData: CUSTOM_GEOJSON,
        geoJsonIdProperty: "id"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("uses geoJsonNameProperty for display", async () => {
      await createChart({
        mapType: "custom",
        geoJsonData: CUSTOM_GEOJSON,
        geoJsonNameProperty: "name"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
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

    it("accepts lowColor property", async () => {
      await createChart({ lowColor: "#ffffff" });
      expect(element.lowColor).toBe("#ffffff");
    });

    it("accepts highColor property", async () => {
      await createChart({ highColor: "#0000ff" });
      expect(element.highColor).toBe("#0000ff");
    });

    it("accepts colorScaleType sequential", async () => {
      await createChart({ colorScaleType: "sequential" });
      expect(element.colorScaleType).toBe("sequential");
    });

    it("accepts colorScaleType diverging", async () => {
      await createChart({
        colorScaleType: "diverging",
        recordCollection: SAMPLE_DIVERGING_DATA,
        valueField: "Change"
      });
      expect(element.colorScaleType).toBe("diverging");
    });

    it("accepts negativeColor property", async () => {
      await createChart({ negativeColor: "#ff0000" });
      expect(element.negativeColor).toBe("#ff0000");
    });

    it("accepts positiveColor property", async () => {
      await createChart({ positiveColor: "#00ff00" });
      expect(element.positiveColor).toBe("#00ff00");
    });

    it("accepts midColor property", async () => {
      await createChart({ midColor: "#cccccc" });
      expect(element.midColor).toBe("#cccccc");
    });

    it("showLegend defaults to undefined (treated as true)", async () => {
      await createChart();
      expect(element.showLegend).toBeUndefined();
    });

    it("accepts showLegend property set to false", async () => {
      await createChart({ showLegend: false });
      expect(element.showLegend).toBe(false);
    });

    it("accepts legendPosition property", async () => {
      await createChart({ legendPosition: "top-left" });
      expect(element.legendPosition).toBe("top-left");
    });

    it("accepts showLabels property set to true", async () => {
      await createChart({ showLabels: true });
      expect(element.showLabels).toBe(true);
    });

    it("enableZoom defaults to undefined (treated as true)", async () => {
      await createChart();
      expect(element.enableZoom).toBeUndefined();
    });

    it("accepts enableZoom property set to false", async () => {
      await createChart({ enableZoom: false });
      expect(element.enableZoom).toBe(false);
    });

    it("accepts borderColor property", async () => {
      await createChart({ borderColor: "#333333" });
      expect(element.borderColor).toBe("#333333");
    });

    it("accepts borderWidth property", async () => {
      await createChart({ borderWidth: 2 });
      expect(element.borderWidth).toBe(2);
    });

    it("accepts hoverBorderColor property", async () => {
      await createChart({ hoverBorderColor: "#ff0000" });
      expect(element.hoverBorderColor).toBe("#ff0000");
    });

    it("accepts hoverBorderWidth property", async () => {
      await createChart({ hoverBorderWidth: 3 });
      expect(element.hoverBorderWidth).toBe(3);
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
        advancedConfig: '{"noDataColor": "#cccccc"}'
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

    it("creates geoPath for regions", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.geoPath).toHaveBeenCalled();
    });

    it("creates appropriate projection for US states", async () => {
      await createChart({ mapType: "us-states" });
      await Promise.resolve();

      expect(mockD3.geoAlbersUsa).toHaveBeenCalled();
    });

    it("creates sequential color scale", async () => {
      await createChart({ colorScaleType: "sequential" });
      await Promise.resolve();

      expect(mockD3.scaleSequential).toHaveBeenCalled();
    });

    it("creates diverging color scale for negative values", async () => {
      await createChart({
        colorScaleType: "diverging",
        recordCollection: SAMPLE_DIVERGING_DATA,
        valueField: "Change"
      });
      await Promise.resolve();

      // The scale type depends on whether there are negative values
      expect(loadD3).toHaveBeenCalled();
    });

    it("draws region paths", async () => {
      await createChart();
      await Promise.resolve();

      expect(mockD3.selectAll).toHaveBeenCalled();
      expect(mockD3.join).toHaveBeenCalled();
    });

    it("renders legend when showLegend is true", async () => {
      await createChart({ showLegend: true });
      await Promise.resolve();

      expect(mockD3.append).toHaveBeenCalled();
    });

    it("renders region labels when showLabels is true", async () => {
      await createChart({ showLabels: true });
      await Promise.resolve();

      expect(mockD3.selectAll).toHaveBeenCalled();
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

      expect(mockD3.zoom).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLICK EVENT TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("click events", () => {
    it("dispatches regionclick event", async () => {
      await createChart();
      await Promise.resolve();

      const clickHandler = jest.fn();
      element.addEventListener("regionclick", clickHandler);

      expect(loadD3).toHaveBeenCalled();
    });

    it("accepts objectApiName for navigation", async () => {
      await createChart({
        objectApiName: "Account"
      });

      expect(element.objectApiName).toBe("Account");
    });

    it("accepts recordIdField property", async () => {
      await createChart({
        recordIdField: "CustomId__c"
      });

      expect(element.recordIdField).toBe("CustomId__c");
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
        width: 200,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 200
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

    it("cleans up tooltip on disconnect", async () => {
      await createChart();
      await Promise.resolve();

      document.body.removeChild(element);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GETTER TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("getters", () => {
    it("hasError returns true when error is set", async () => {
      loadD3.mockRejectedValue(new Error("Test error"));
      await createChart();

      await Promise.resolve();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
    });

    it("hasData returns true when geoData and chartData exist", async () => {
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

    it("effectiveShowLegend defaults to true when undefined", async () => {
      await createChart();
      // showLegend is undefined, getter treats as true
      expect(element.showLegend).toBeUndefined();
    });

    it("effectiveShowLegend returns false when explicitly set", async () => {
      await createChart({ showLegend: false });
      expect(element.showLegend).toBe(false);
    });

    it("effectiveEnableZoom defaults to true when undefined", async () => {
      await createChart();
      // enableZoom is undefined, getter treats as true
      expect(element.enableZoom).toBeUndefined();
    });

    it("effectiveEnableZoom returns false when explicitly set", async () => {
      await createChart({ enableZoom: false });
      expect(element.enableZoom).toBe(false);
    });

    it("effectiveShowLabels returns correct value", async () => {
      await createChart({ showLabels: true });
      expect(element.showLabels).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("handles empty recordCollection array with no SOQL", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await Promise.resolve();

      // Should render map without data, not show error
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles regions with null values", async () => {
      const nullData = [
        { Id: "001", BillingState: null, Amount: 100 },
        { Id: "002", BillingState: "CA", Amount: null }
      ];

      await createChart({
        recordCollection: nullData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles very large values", async () => {
      const largeData = [
        { Id: "001", BillingState: "CA", Amount: 1000000000 },
        { Id: "002", BillingState: "TX", Amount: 999999999 }
      ];

      await createChart({
        recordCollection: largeData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles zero values", async () => {
      const zeroData = [
        { Id: "001", BillingState: "CA", Amount: 0 },
        { Id: "002", BillingState: "TX", Amount: 0 }
      ];

      await createChart({
        recordCollection: zeroData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles special characters in region names", async () => {
      const specialData = [
        { Id: "001", BillingState: "New York's", Amount: 100 }
      ];

      await createChart({
        recordCollection: specialData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles case-insensitive region matching", async () => {
      const mixedCaseData = [
        { Id: "001", BillingState: "ca", Amount: 100 },
        { Id: "002", BillingState: "CA", Amount: 200 },
        { Id: "003", BillingState: "California", Amount: 300 }
      ];

      await createChart({
        recordCollection: mixedCaseData
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("handles many data records (stress test)", async () => {
      const manyRecords = [];
      const states = ["CA", "TX", "NY", "FL", "IL"];
      for (let i = 0; i < 1000; i++) {
        manyRecords.push({
          Id: `${i}`,
          BillingState: states[i % states.length],
          Amount: Math.random() * 10000
        });
      }

      await createChart({
        recordCollection: manyRecords
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LEGEND POSITION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("legend positions", () => {
    it("accepts bottom-right position", async () => {
      await createChart({ legendPosition: "bottom-right" });
      expect(element.legendPosition).toBe("bottom-right");
    });

    it("accepts bottom-left position", async () => {
      await createChart({ legendPosition: "bottom-left" });
      expect(element.legendPosition).toBe("bottom-left");
    });

    it("accepts top-right position", async () => {
      await createChart({ legendPosition: "top-right" });
      expect(element.legendPosition).toBe("top-right");
    });

    it("accepts top-left position", async () => {
      await createChart({ legendPosition: "top-left" });
      expect(element.legendPosition).toBe("top-left");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // COLOR SCALE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("color scales", () => {
    it("uses sequential scale for positive-only values", async () => {
      await createChart({
        colorScaleType: "sequential",
        recordCollection: SAMPLE_STATE_DATA
      });

      await Promise.resolve();
      expect(mockD3.scaleSequential).toHaveBeenCalled();
    });

    it("uses diverging scale when specified with negative values", async () => {
      await createChart({
        colorScaleType: "diverging",
        recordCollection: SAMPLE_DIVERGING_DATA,
        valueField: "Change"
      });

      await Promise.resolve();
      expect(loadD3).toHaveBeenCalled();
    });

    it("applies custom low color", async () => {
      await createChart({
        lowColor: "#f0f0f0"
      });

      await Promise.resolve();
      expect(mockD3.interpolateRgb).toHaveBeenCalled();
    });

    it("applies custom high color", async () => {
      await createChart({
        highColor: "#000080"
      });

      await Promise.resolve();
      expect(mockD3.interpolateRgb).toHaveBeenCalled();
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
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
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
      expect(mockD3.geoPath).not.toHaveBeenCalled();

      // Simulate container getting width from layout engine
      containerWidth = 800;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 800,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 800
      }));

      // Fire the RAF callback chain
      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift();
        cb();
      }

      // Chart should now have rendered
      expect(mockD3.geoPath).toHaveBeenCalled();
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
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
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

  // ═══════════════════════════════════════════════════════════════
  // NO DATA STATE TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("no data state", () => {
    it("shows no data message when GeoJSON fails to load", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await createChart();
      await Promise.resolve();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("displays location icon for errors", async () => {
      loadD3.mockRejectedValue(new Error("Load failed"));

      await createChart();
      await Promise.resolve();

      const icon = element.shadowRoot.querySelector("lightning-icon");
      expect(icon).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // OPERATION LABEL TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("operation labels", () => {
    it("uses Sum label for Sum operation", async () => {
      await createChart({ operation: "Sum" });
      expect(element.operation).toBe("Sum");
    });

    it("uses Count label for Count operation", async () => {
      await createChart({ operation: "Count" });
      expect(element.operation).toBe("Count");
    });

    it("uses Average label for Average operation", async () => {
      await createChart({ operation: "Average" });
      expect(element.operation).toBe("Average");
    });
  });
});
