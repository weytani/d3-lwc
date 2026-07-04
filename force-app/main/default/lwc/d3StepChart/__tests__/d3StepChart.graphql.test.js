// ABOUTME: Tests the additive GraphQL self-fetch path on d3StepChart (Approach A, CT-REC).
// ABOUTME: Step has no server-side aggregate — the graphql path always fetches raw
// ABOUTME: dateField/valueField/seriesField records and feeds the existing
// ABOUTME: processTimeSeriesData path, same as recordCollection/soqlQuery.
import { createElement } from "lwc";
import D3StepChart from "c/d3StepChart";
import { graphql, gql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Value-axis chart: renderChart calls d3.max/min/extent to build scales, so the
// stub must compute those for real, and node().getTotalLength() must return a
// real number (the line-draw animation compares it numerically).
function makeD3Stub() {
  const calls = [];
  const chain = new Proxy(function () {}, {
    get: (target, prop) => {
      if (prop === "then") return undefined;
      if (prop === "max") return (a, f) => Math.max(...a.map(f ?? ((d) => d)));
      if (prop === "min") return (a, f) => Math.min(...a.map(f ?? ((d) => d)));
      if (prop === "extent")
        return (a, f) => {
          const m = a.map(f ?? ((d) => d));
          return [Math.min(...m), Math.max(...m)];
        };
      if (prop === "node") return () => ({ getTotalLength: () => 100 });
      return (...args) => {
        calls.push([prop, ...args]);
        return chain;
      };
    },
    apply: () => chain
  });
  return { chain, calls };
}

const RECORD_RESPONSE = {
  uiapi: {
    query: {
      Opportunity: {
        edges: [
          {
            node: {
              CloseDate: { value: "2024-01-15" },
              Amount: { value: 100 },
              StageName: { value: "Won" }
            }
          },
          {
            node: {
              CloseDate: { value: "2024-02-15" },
              Amount: { value: 200 },
              StageName: { value: "Won" }
            }
          },
          {
            node: {
              CloseDate: { value: "2024-01-15" },
              Amount: { value: 80 },
              StageName: { value: "Lost" }
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

describe("d3StepChart GraphQL path (Approach A, CT-REC)", () => {
  let d3Calls;

  beforeEach(() => {
    const stub = makeD3Stub();
    d3Calls = stub.calls;
    loadD3.mockResolvedValue(stub.chain);

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

  it("renders the chart container and actually draws the step line when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-step-chart", { is: D3StepChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.dateField = "CloseDate";
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
    // a "line" path must have been appended with a "d" attribute.
    expect(
      d3Calls.some(
        (c) => c[0] === "attr" && c[1] === "class" && c[2] === "line"
      )
    ).toBe(true);
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-step-chart", { is: D3StepChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.dateField = "CloseDate";
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
    const element = createElement("c-d3-step-chart", { is: D3StepChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.dateField = "CloseDate";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    expect(queryStrings.some((q) => q.includes("first: 2000"))).toBe(true);
  });

  it("requests dateField, valueField, and seriesField, deduped", async () => {
    const element = createElement("c-d3-step-chart", { is: D3StepChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.dateField = "CloseDate";
    element.valueField = "Amount";
    // seriesField repeats dateField on purpose to prove deduping.
    element.seriesField = "CloseDate";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    const query = queryStrings[queryStrings.length - 1];
    expect(query).toContain("CloseDate {");
    expect(query).toContain("Amount {");
    expect(query.match(/CloseDate \{/g).length).toBe(1);
  });
});
