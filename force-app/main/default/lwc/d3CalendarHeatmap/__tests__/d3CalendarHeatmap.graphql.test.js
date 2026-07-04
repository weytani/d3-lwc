// ABOUTME: Tests the additive GraphQL self-fetch path on d3CalendarHeatmap (Approach A, CT-REC).
// ABOUTME: Calendar heatmap has no server-side aggregate — the graphql path always fetches
// ABOUTME: raw dateField/valueField records and feeds the existing recordCollection
// ABOUTME: processing path (_prepareRawData + per-render day aggregation).
import { createElement } from "lwc";
import D3CalendarHeatmap from "c/d3CalendarHeatmap";
import { graphql, gql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// renderChart calls d3.max() to build the scaleQuantize domain, so the stub
// must compute it for real (a naive always-chain stub crashes the jest worker
// on `d3.max(...) || 1`-style numeric usage).
function makeD3Stub() {
  const calls = [];
  const chain = new Proxy(function () {}, {
    get: (target, prop) => {
      if (prop === "then") return undefined;
      if (prop === "max") return (a, f) => Math.max(...a.map(f ?? ((d) => d)));
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
              CloseDate: { value: "2025-01-15" },
              Amount: { value: 100 }
            }
          },
          {
            node: {
              CloseDate: { value: "2025-01-15" },
              Amount: { value: 200 }
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

describe("d3CalendarHeatmap GraphQL path (Approach A, CT-REC)", () => {
  let d3Calls;

  beforeEach(() => {
    const stub = makeD3Stub();
    d3Calls = stub.calls;
    loadD3.mockResolvedValue(stub.chain);

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
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

  it("renders the chart container and actually draws day cells when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-calendar-heatmap", {
      is: D3CalendarHeatmap
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.dateField = "CloseDate";
    element.valueField = "Amount";
    element.year = 2025;
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
    // a "day" rect must have been appended.
    expect(
      d3Calls.some((c) => c[0] === "attr" && c[1] === "class" && c[2] === "day")
    ).toBe(true);
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-calendar-heatmap", {
      is: D3CalendarHeatmap
    });
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
    const element = createElement("c-d3-calendar-heatmap", {
      is: D3CalendarHeatmap
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.dateField = "CloseDate";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    expect(queryStrings.some((q) => q.includes("first: 2000"))).toBe(true);
  });

  it("requests dateField and valueField, deduped", async () => {
    const element = createElement("c-d3-calendar-heatmap", {
      is: D3CalendarHeatmap
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.dateField = "CloseDate";
    // valueField repeats dateField on purpose to prove deduping.
    element.valueField = "CloseDate";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    const query = queryStrings[queryStrings.length - 1];
    expect(query).toContain("CloseDate {");
    expect(query.match(/CloseDate \{/g).length).toBe(1);
  });
});
