// ABOUTME: Tests the additive GraphQL self-fetch path on d3ForceGraph (Approach A, CT-REC).
// ABOUTME: Uses the real HTML selectors: .chart-container (chart) and .slds-text-color_error (error).
import { createElement } from "lwc";
import D3ForceGraph from "c/d3ForceGraph";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Reuses the same hand-rolled, jest.fn()-based D3 mock shape as
// d3ForceGraph.test.js. Unlike a Proxy `get: () => () => chain` stub, a plain
// object literal simply has no `then` property, so it is never mistaken for a
// thenable by Promise.resolve()/await — no extra `then` guard needed here.
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
    forceSimulation: jest.fn(() => {
      const sim = {
        force: jest.fn(() => sim),
        alphaDecay: jest.fn(() => sim),
        on: jest.fn(() => sim),
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
    drag: jest.fn(() => {
      const drag = { on: jest.fn(() => drag) };
      return drag;
    }),
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

// Record-envelope shape: data.uiapi.query.<Object>.edges[].node.<field>.value.
// AccountId "Acc1" appears on two edges (two contacts for the same account) —
// buildGraphData dedupes it to one source node and adds two target fallback
// nodes, so the happy path exercises both the node-dedup and edge-building
// logic, not just a 1:1 mapping.
const RECORD_RESPONSE = {
  uiapi: {
    query: {
      AccountContactRelation: {
        edges: [
          {
            node: {
              Id: { value: "aci1" },
              AccountId: { value: "Acc1" },
              ContactId: { value: "Con1" },
              Name: { value: "Contact One" }
            }
          },
          {
            node: {
              Id: { value: "aci2" },
              AccountId: { value: "Acc1" },
              ContactId: { value: "Con2" },
              Name: { value: "Contact Two" }
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

describe("d3ForceGraph GraphQL path (Approach A, CT-REC)", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 600,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 600
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

  it("renders the chart container and drives a real force simulation when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-force-graph", { is: D3ForceGraph });
    element.fetchMode = "graphql";
    element.objectApiName = "AccountContactRelation";
    element.sourceField = "AccountId";
    element.targetField = "ContactId";
    document.body.appendChild(element);

    await flushPromises(); // connectedCallback (loadD3 + loadData early-return)
    graphql.emit(RECORD_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();

    // Proves renderChart actually ran (not just that networkData arrived):
    // forceSimulation only gets called deep inside renderChart, with the
    // 3 nodes (Acc1 source + Con1/Con2 targets) buildGraphData derived from
    // the 2 normalized edges.
    expect(mockD3.forceSimulation).toHaveBeenCalledTimes(1);
    expect(mockD3.forceSimulation.mock.calls[0][0]).toHaveLength(3);
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-force-graph", { is: D3ForceGraph });
    element.fetchMode = "graphql";
    element.objectApiName = "AccountContactRelation";
    element.sourceField = "AccountId";
    element.targetField = "ContactId";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).not.toBeNull();
  });
});
