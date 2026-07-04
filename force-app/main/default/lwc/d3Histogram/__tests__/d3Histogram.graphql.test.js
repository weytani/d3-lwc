// ABOUTME: Tests the additive GraphQL self-fetch path on d3Histogram (Approach A, CT-REC).
// ABOUTME: Histogram has no server-side aggregate on the graphql path — it always fetches raw
// ABOUTME: valueField records and feeds the existing client-side statistics + binning path
// ABOUTME: (calculateStatistics + d3.bin()), same as recordCollection/soqlQuery.
import { createElement } from "lwc";
import D3Histogram from "c/d3Histogram";
import { graphql, gql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Hand-rolled mock D3 (mirrors d3Histogram.test.js): d3.bin() has a distinct
// enough shape (chainable generator returning fixed bin fixtures) that the
// generic numeric-aware Proxy stub used by other charts doesn't fit — this
// chart's own unit suite already proves this pattern works.
const createMockD3 = () => {
  const mockD3 = {
    select: jest.fn(() => mockD3),
    append: jest.fn(() => mockD3),
    attr: jest.fn(() => mockD3),
    style: jest.fn(() => mockD3),
    call: jest.fn(() => mockD3),
    insert: jest.fn(() => mockD3),
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
    scaleLinear: jest.fn(() => {
      const scale = jest.fn((val) => val);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      return scale;
    }),
    axisBottom: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      axis.ticks = jest.fn(() => axis);
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    axisLeft: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      axis.ticks = jest.fn(() => axis);
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    bin: jest.fn(() => {
      const binGenerator = jest.fn(() => [
        Object.assign([10, 20, 30], { x0: 0, x1: 50 }),
        Object.assign([40, 50], { x0: 50, x1: 100 })
      ]);
      binGenerator.domain = jest.fn(() => binGenerator);
      binGenerator.thresholds = jest.fn(() => binGenerator);
      return binGenerator;
    }),
    extent: jest.fn(() => [10, 50]),
    max: jest.fn(() => 3),
    line: jest.fn(() => {
      const lineGen = jest.fn(() => "M0,0L100,100");
      lineGen.x = jest.fn(() => lineGen);
      lineGen.y = jest.fn(() => lineGen);
      lineGen.curve = jest.fn(() => lineGen);
      return lineGen;
    }),
    curveBasis: jest.fn()
  };
  return mockD3;
};

const RECORD_RESPONSE = {
  uiapi: {
    query: {
      Opportunity: {
        edges: [
          { node: { Amount: { value: 10000 } } },
          { node: { Amount: { value: 25000 } } },
          { node: { Amount: { value: 50000 } } }
        ]
      }
    }
  }
};

async function flushPromises() {
  return Promise.resolve();
}

describe("d3Histogram GraphQL path (Approach A, CT-REC)", () => {
  let mockD3;

  beforeEach(() => {
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 500,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 500
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

  it("renders the chart container and actually draws bars when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-histogram", { is: D3Histogram });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises(); // connectedCallback (loadD3 + loadData early-return)
    graphql.emit(RECORD_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();

    // Prove renderChart actually ran (not just that the wire populated data):
    // a "bar" rect must have been appended.
    expect(
      mockD3.attr.mock.calls.some((c) => c[0] === "class" && c[1] === "bar")
    ).toBe(true);
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-histogram", { is: D3Histogram });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).not.toBeNull();
  });

  it("bounds the query with the same first: value as other CT-REC charts", async () => {
    const element = createElement("c-d3-histogram", { is: D3Histogram });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    expect(queryStrings.some((q) => q.includes("first: 2000"))).toBe(true);
  });

  it("requests only valueField", async () => {
    const element = createElement("c-d3-histogram", { is: D3Histogram });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    const query = queryStrings[queryStrings.length - 1];
    expect(query).toContain("Amount {");
    expect(query.match(/Amount \{/g).length).toBe(1);
  });
});
