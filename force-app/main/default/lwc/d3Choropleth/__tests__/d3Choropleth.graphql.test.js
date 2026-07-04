// ABOUTME: Tests the additive GraphQL self-fetch path on d3Choropleth (Approach A, CT-AGG).
// ABOUTME: regionField -> groupByField, valueField, operation -> [{label,value}] -> region Map.
import { createElement } from "lwc";
import D3Choropleth from "c/d3Choropleth";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

jest.mock(
  "lightning/navigation",
  () => ({
    NavigationMixin: jest.fn((Base) => {
      return class extends Base {
        [Symbol.for("NavigationMixin.Navigate")] = jest.fn();
      };
    })
  }),
  { virtual: true }
);

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
  truncateLabel: jest.fn((label) => label),
  applySvgA11y: jest.fn()
}));

jest.mock("@salesforce/resourceUrl/usStates", () => "/mock/usStates.json", {
  virtual: true
});

global.fetch = jest.fn();

// Same GeoJSON fixture as d3Choropleth.test.js — GraphQL mode still needs the
// map geometry (loadGeoData() has no fetchMode guard; only the data path does).
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
    }
  ]
};

// Same hand-rolled geo/scale mock as d3Choropleth.test.js, needed so
// renderChart's setupColorScale()/createProjection() calls actually execute
// against the graphql-sourced chartData.
const createMockD3 = () => {
  const mockD3 = {
    select: jest.fn(() => mockD3),
    append: jest.fn(() => mockD3),
    insert: jest.fn(() => mockD3),
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
    interpolateRgb: jest.fn((a) => () => a),
    interpolateRgbBasis: jest.fn((colors) => () => colors[0]),
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

// Live-verified aggregate envelope (matches d3BarChart.graphql.test.js).
const AGG_RESPONSE = {
  uiapi: {
    aggregate: {
      Account: {
        edges: [
          {
            node: {
              aggregate: {
                BillingState: { value: "CA" },
                Amount: { sum: { value: 80000 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                BillingState: { value: "TX" },
                Amount: { sum: { value: 40000 } }
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

describe("d3Choropleth GraphQL path (Approach A, CT-AGG)", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SAMPLE_GEOJSON)
    });

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 800
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

  it("renders the map and drives a real sequential color scale when GraphQL aggregate data arrives", async () => {
    const element = createElement("c-d3-choropleth", { is: D3Choropleth });
    element.fetchMode = "graphql";
    element.objectApiName = "Account";
    element.regionField = "BillingState";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises(); // loadD3
    await flushPromises(); // loadGeoData (fetch)
    await flushPromises(); // loadData early-return
    graphql.emit(AGG_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();

    // Proves renderChart actually ran (not just that chartData arrived):
    // setupColorScale() only calls scaleSequential deep inside renderChart,
    // with the domain driven by the 2 aggregate regions (CA: 80000, TX: 40000).
    expect(mockD3.scaleSequential).toHaveBeenCalledTimes(1);
    const scaleObj = mockD3.scaleSequential.mock.results[0].value;
    expect(scaleObj.domain).toHaveBeenCalledWith([0, 80000]);
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-choropleth", { is: D3Choropleth });
    element.fetchMode = "graphql";
    element.objectApiName = "Account";
    element.regionField = "BillingState";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();
    await flushPromises();
    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).not.toBeNull();
  });
});
