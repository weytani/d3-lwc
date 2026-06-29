// ABOUTME: Tests the additive GraphQL self-fetch path on d3BarChart (Approach A).
// ABOUTME: Uses the real HTML selectors: .chart-container (chart) and .slds-text-color_error (error).
import { createElement } from "lwc";
import D3BarChart from "c/d3BarChart";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Minimal chainable D3 stub: every call returns the same chainable object.
function makeD3Stub() {
  const chain = new Proxy(function () {}, {
    get: () => () => chain,
    apply: () => chain
  });
  return chain;
}

const AGG_RESPONSE = {
  uiapi: {
    aggregate: {
      Opportunity: {
        edges: [
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                Amount: { sum: { value: 1000 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Closed Won" },
                Amount: { sum: { value: 5000 } }
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

describe("d3BarChart GraphQL path (Approach A)", () => {
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

  it("renders the chart container when GraphQL aggregate data arrives", async () => {
    const element = createElement("c-d3-bar-chart", { is: D3BarChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises(); // connectedCallback (loadD3 + loadData early-return)
    graphql.emit(AGG_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-bar-chart", { is: D3BarChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).not.toBeNull();
  });
});
