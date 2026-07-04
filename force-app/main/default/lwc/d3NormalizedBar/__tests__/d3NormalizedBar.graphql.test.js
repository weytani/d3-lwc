// ABOUTME: Tests the additive GraphQL self-fetch path on d3NormalizedBar (Approach A, CT-MG).
// ABOUTME: seriesField is REQUIRED here (unlike the d3StackedBarChart donor) — a 100%
// ABOUTME: composition chart with no composition dimension has nothing to normalize, so
// ABOUTME: the wire is only provisioned via buildMultiGroupQuery/normalizeMultiGroup.
// ABOUTME: Count has no server aggregate, so it falls back to a bounded raw-record fetch
// ABOUTME: feeding the existing _aggregateRawData path.
import { createElement } from "lwc";
import D3NormalizedBar from "c/d3NormalizedBar";
import { graphql, gql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Hand-rolled mock D3 (mirrors d3NormalizedBar.test.js): max is a real
// jest.fn() implementation returning a fixed number, not a naive Proxy, so
// there is no thenable trap and no risk of primitive-conversion crashes.
const createMockD3 = () => {
  const mockStack = jest.fn(() => []);
  mockStack.keys = jest.fn(() => mockStack);
  mockStack.offset = jest.fn(() => mockStack);

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
    text: jest.fn(() => mockD3),
    scaleBand: jest.fn(() => {
      const scale = jest.fn(() => 50);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.padding = jest.fn(() => scale);
      scale.bandwidth = jest.fn(() => 40);
      return scale;
    }),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    axisBottom: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      return axis;
    }),
    axisLeft: jest.fn(() => {
      const axis = jest.fn();
      axis.tickFormat = jest.fn(() => axis);
      axis.tickSize = jest.fn(() => axis);
      return axis;
    }),
    stack: jest.fn(() => mockStack),
    stackOffsetExpand: "stackOffsetExpand"
  };
  mockD3._mockStack = mockStack;
  return mockD3;
};

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
                Amount: { sum: { value: 100 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                Type: { value: "Existing" },
                Amount: { sum: { value: 200 } }
              }
            }
          }
        ]
      }
    }
  }
};

const RECORD_RESPONSE_MULTI = {
  uiapi: {
    query: {
      Opportunity: {
        edges: [
          {
            node: {
              StageName: { value: "Prospecting" },
              Type: { value: "New" }
            }
          },
          {
            node: {
              StageName: { value: "Prospecting" },
              Type: { value: "Existing" }
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

describe("d3NormalizedBar GraphQL path (Approach A, CT-MG)", () => {
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

  it("renders the chart container and actually draws normalized segments when GraphQL multi-group data arrives", async () => {
    const element = createElement("c-d3-normalized-bar", {
      is: D3NormalizedBar
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "Type";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises(); // connectedCallback (loadD3 + loadData early-return)
    graphql.emit(MULTI_GROUP_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();

    // Prove renderChart actually ran (not just that the wire populated data):
    // a "normalized-segment" must have been appended, always via stackOffsetExpand.
    expect(
      mockD3.attr.mock.calls.some(
        (c) => c[0] === "class" && c[1] === "normalized-segment"
      )
    ).toBe(true);
    expect(mockD3._mockStack.offset).toHaveBeenCalledWith("stackOffsetExpand");
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-normalized-bar", {
      is: D3NormalizedBar
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "Type";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).not.toBeNull();
  });

  it("bounds the query with the same first: value as other CT-MG charts", async () => {
    const element = createElement("c-d3-normalized-bar", {
      is: D3NormalizedBar
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "Type";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    expect(queryStrings.some((q) => q.includes("first: 2000"))).toBe(true);
  });

  it("builds a groupBy on both groupByField and seriesField", async () => {
    const element = createElement("c-d3-normalized-bar", {
      is: D3NormalizedBar
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "Type";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    const query = queryStrings[queryStrings.length - 1];
    expect(query).toContain("groupBy: { StageName: {}, Type: {} }");
  });

  it("falls back to a bounded raw-record fetch for Count (no server aggregate)", async () => {
    const element = createElement("c-d3-normalized-bar", {
      is: D3NormalizedBar
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "Type";
    element.operation = "Count";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(RECORD_RESPONSE_MULTI);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();

    const queryStrings = gql.mock.results.map((r) => r.value);
    const query = queryStrings[queryStrings.length - 1];
    expect(query).toContain("uiapi { query {");
    expect(query).not.toContain("uiapi { aggregate {");

    // Prove renderChart actually ran with the Count-derived record data.
    expect(
      mockD3.attr.mock.calls.some(
        (c) => c[0] === "class" && c[1] === "normalized-segment"
      )
    ).toBe(true);
  });

  it("does not provision the wire when seriesField is empty — there is nothing to normalize", async () => {
    const element = createElement("c-d3-normalized-bar", {
      is: D3NormalizedBar
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();

    expect(gql).not.toHaveBeenCalled();
  });

  it("does not provision the wire when valueField is missing for Sum", async () => {
    const element = createElement("c-d3-normalized-bar", {
      is: D3NormalizedBar
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "Type";
    element.valueField = "";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();

    expect(gql).not.toHaveBeenCalled();
  });
});
