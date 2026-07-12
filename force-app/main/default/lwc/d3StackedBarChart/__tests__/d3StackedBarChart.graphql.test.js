// ABOUTME: Tests the additive GraphQL self-fetch path on d3StackedBarChart (Approach A).
// ABOUTME: Multi-series (seriesField set) uses buildMultiGroupQuery/normalizeMultiGroup (CT-MG);
// ABOUTME: single-series (no seriesField) falls back to the plain buildAggregateQuery/
// ABOUTME: normalizeAggregate path (CT-AGG), matching the existing getMultiGroupData/
// ABOUTME: getAggregatedData server-side branch. Count has no server aggregate on either
// ABOUTME: branch, so it falls back to a bounded raw-record fetch feeding the existing
// ABOUTME: _aggregateRawData path.
import { createElement } from "lwc";
import D3StackedBarChart from "c/d3StackedBarChart";
import { graphql, gql } from "lightning/graphql";
import { loadD3 } from "../d3Loader";

jest.mock("../d3Loader", () => ({ loadD3: jest.fn() }));

// Hand-rolled mock D3 (mirrors d3StackedBarChart.test.js): max is a real
// jest.fn() implementation returning a fixed number, not a naive Proxy, so
// there is no thenable trap and no risk of primitive-conversion crashes.
const createMockD3 = () => {
  const mockStack = jest.fn(() => []);
  mockStack.keys = jest.fn(() => mockStack);
  mockStack.value = jest.fn(() => mockStack);
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
    html: jest.fn(() => mockD3),
    text: jest.fn(() => mockD3),
    each: jest.fn(() => mockD3),
    scaleBand: jest.fn(() => {
      const scale = jest.fn(() => 50);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.padding = jest.fn(() => scale);
      scale.bandwidth = jest.fn(() => 40);
      scale.paddingInner = jest.fn(() => scale);
      return scale;
    }),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
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
    max: jest.fn(() => 500),
    stack: jest.fn(() => mockStack),
    stackOffsetNone: "stackOffsetNone",
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

const AGGREGATE_RESPONSE = {
  uiapi: {
    aggregate: {
      Opportunity: {
        edges: [
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                Amount: { sum: { value: 300 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Qualification" },
                Amount: { sum: { value: 400 } }
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

const RECORD_RESPONSE_SINGLE = {
  uiapi: {
    query: {
      Opportunity: {
        edges: [
          { node: { StageName: { value: "Prospecting" } } },
          { node: { StageName: { value: "Qualification" } } }
        ]
      }
    }
  }
};

async function flushPromises() {
  return Promise.resolve();
}

describe("d3StackedBarChart GraphQL path (Approach A)", () => {
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

  describe("multi-series (CT-MG)", () => {
    it("renders the chart container and actually draws bars when GraphQL multi-group data arrives", async () => {
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
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

      expect(
        element.shadowRoot.querySelector(".chart-container")
      ).not.toBeNull();
      expect(
        element.shadowRoot.querySelector(".slds-text-color_error")
      ).toBeNull();

      // Prove renderChart actually ran (not just that the wire populated data):
      // a "stacked-bar" must have been appended.
      expect(
        mockD3.attr.mock.calls.some(
          (c) => c[0] === "class" && c[1] === "stacked-bar"
        )
      ).toBe(true);
    });

    it("shows an error when the GraphQL wire emits errors", async () => {
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
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
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
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
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
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
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
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

      expect(
        element.shadowRoot.querySelector(".chart-container")
      ).not.toBeNull();
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
          (c) => c[0] === "class" && c[1] === "stacked-bar"
        )
      ).toBe(true);
    });
  });

  describe("single-series (plain aggregate, CT-AGG)", () => {
    it("renders the chart container and actually draws bars when GraphQL aggregate data arrives", async () => {
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
      });
      element.fetchMode = "graphql";
      element.objectApiName = "Opportunity";
      element.groupByField = "StageName";
      element.seriesField = "";
      element.valueField = "Amount";
      element.operation = "Sum";
      document.body.appendChild(element);

      await flushPromises();
      graphql.emit(AGGREGATE_RESPONSE);
      await flushPromises();
      await flushPromises();

      expect(
        element.shadowRoot.querySelector(".chart-container")
      ).not.toBeNull();
      expect(
        element.shadowRoot.querySelector(".slds-text-color_error")
      ).toBeNull();
      expect(
        mockD3.attr.mock.calls.some(
          (c) => c[0] === "class" && c[1] === "stacked-bar"
        )
      ).toBe(true);
    });

    it("builds a single-field groupBy when seriesField is empty", async () => {
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
      });
      element.fetchMode = "graphql";
      element.objectApiName = "Opportunity";
      element.groupByField = "StageName";
      element.seriesField = "";
      element.valueField = "Amount";
      document.body.appendChild(element);

      await flushPromises();

      const queryStrings = gql.mock.results.map((r) => r.value);
      const query = queryStrings[queryStrings.length - 1];
      expect(query).toContain("groupBy: { StageName: {} }");
      expect(query).not.toContain("Type");
    });

    it("falls back to a bounded raw-record fetch for Count with a single field", async () => {
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
      });
      element.fetchMode = "graphql";
      element.objectApiName = "Opportunity";
      element.groupByField = "StageName";
      element.seriesField = "";
      element.operation = "Count";
      document.body.appendChild(element);

      await flushPromises();
      graphql.emit(RECORD_RESPONSE_SINGLE);
      await flushPromises();
      await flushPromises();

      expect(
        element.shadowRoot.querySelector(".chart-container")
      ).not.toBeNull();
      expect(
        element.shadowRoot.querySelector(".slds-text-color_error")
      ).toBeNull();

      const queryStrings = gql.mock.results.map((r) => r.value);
      const query = queryStrings[queryStrings.length - 1];
      expect(query).toContain("uiapi { query {");

      // Prove renderChart actually ran with the Count-derived record data.
      expect(
        mockD3.attr.mock.calls.some(
          (c) => c[0] === "class" && c[1] === "stacked-bar"
        )
      ).toBe(true);
    });

    it("does not provision the wire when valueField is missing for Sum", async () => {
      const element = createElement("c-d3-stacked-bar-chart", {
        is: D3StackedBarChart
      });
      element.fetchMode = "graphql";
      element.objectApiName = "Opportunity";
      element.groupByField = "StageName";
      element.seriesField = "";
      element.valueField = "";
      element.operation = "Sum";
      document.body.appendChild(element);

      await flushPromises();

      expect(gql).not.toHaveBeenCalled();
    });
  });
});
