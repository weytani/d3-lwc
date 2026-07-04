// ABOUTME: Tests the additive GraphQL self-fetch path on d3RadarChart (Approach A, CT-REC).
// ABOUTME: Radar has no server-side aggregate — the graphql path always fetches raw multi-field
// ABOUTME: records (groupByField + every configured axis field) and feeds the existing
// ABOUTME: recordCollection processing path (_processRawData), same as CT-AGG's Count branch.
import { createElement } from "lwc";
import D3RadarChart from "c/d3RadarChart";
import { graphql, gql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Minimal chainable D3 stub: every call returns the same chainable object.
// The `then` guard keeps this from looking like a thenable to
// Promise.resolve()/await — without it, `prop === "then"` would return a
// callable that swallows (resolve, reject), and awaiting loadD3() would
// hang forever.
function makeD3Stub() {
  const chain = new Proxy(function () {}, {
    get: (target, prop) => (prop === "then" ? undefined : () => chain),
    apply: () => chain
  });
  return chain;
}

const RECORD_RESPONSE = {
  uiapi: {
    query: {
      Opportunity: {
        edges: [
          {
            node: {
              Type: { value: "New Business" },
              Amount: { value: 50000 },
              Probability: { value: 0.8 }
            }
          },
          {
            node: {
              Type: { value: "New Business" },
              Amount: { value: 30000 },
              Probability: { value: 0.6 }
            }
          },
          {
            node: {
              Type: { value: "Existing Business" },
              Amount: { value: 40000 },
              Probability: { value: 0.9 }
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

describe("d3RadarChart GraphQL path (Approach A, CT-REC)", () => {
  beforeEach(() => {
    loadD3.mockResolvedValue(makeD3Stub());

    // Mock getBoundingClientRect so chart renders (not zero-width)
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400
    }));

    // Mock ResizeObserver
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

  it("renders the chart container when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-radar-chart", { is: D3RadarChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "Type";
    element.valueField = "Amount";
    element.advancedConfig = JSON.stringify({
      axes: [
        { label: "Revenue", field: "Amount" },
        { label: "Probability", field: "Probability" }
      ]
    });
    document.body.appendChild(element);

    await flushPromises(); // connectedCallback (loadD3 + loadData early-return)
    graphql.emit(RECORD_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-radar-chart", { is: D3RadarChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "Type";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).not.toBeNull();
  });

  it("bounds the query with the same first: value as other CT-AGG charts", async () => {
    const element = createElement("c-d3-radar-chart", { is: D3RadarChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "Type";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    expect(queryStrings.some((q) => q.includes("first: 2000"))).toBe(true);
  });

  it("requests groupByField plus every configured axis field, deduped", async () => {
    const element = createElement("c-d3-radar-chart", { is: D3RadarChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "Type";
    element.valueField = "Amount";
    // Type is repeated as an axis field on purpose to prove deduping.
    element.advancedConfig = JSON.stringify({
      axes: [
        { label: "Revenue", field: "Amount" },
        { label: "Probability", field: "Probability" },
        { label: "Type again", field: "Type" }
      ]
    });
    document.body.appendChild(element);

    await flushPromises();

    const queryStrings = gql.mock.results.map((r) => r.value);
    const query = queryStrings[queryStrings.length - 1];
    expect(query).toContain("Type {");
    expect(query).toContain("Amount {");
    expect(query).toContain("Probability {");
    // Deduped: "Type" appears exactly once as a field selection, not twice.
    expect(query.match(/Type \{/g).length).toBe(1);
  });
});
