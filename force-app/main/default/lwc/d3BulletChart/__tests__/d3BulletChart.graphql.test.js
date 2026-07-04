// ABOUTME: Tests the additive GraphQL self-fetch path on d3BulletChart (Approach A, CT-REC).
// ABOUTME: Uses the real HTML selectors: .chart-container (chart) and .slds-text-color_error (error).
import { createElement } from "lwc";
import D3BulletChart from "c/d3BulletChart";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Minimal chainable D3 stub: every call returns the same chainable object.
// The `then` guard keeps this from looking like a thenable to
// Promise.resolve()/await — without it, `prop === "then"` would return a
// callable that swallows (resolve, reject) and awaiting loadD3() would
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
        edges: [{ node: { Amount: { value: 250000 } } }]
      }
    }
  }
};

const EMPTY_RESPONSE = {
  uiapi: {
    query: {
      Opportunity: {
        edges: []
      }
    }
  }
};

async function flushPromises() {
  return Promise.resolve();
}

describe("d3BulletChart GraphQL path (Approach A, CT-REC)", () => {
  beforeEach(() => {
    loadD3.mockResolvedValue(makeD3Stub());

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
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

  it("renders the chart when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-bullet-chart", { is: D3BulletChart });
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
  });

  it("shows the no-data state (not an empty chart) when GraphQL returns no records", async () => {
    const element = createElement("c-d3-bullet-chart", { is: D3BulletChart });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(EMPTY_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).toBeNull();
    expect(element.shadowRoot.querySelector("lightning-icon")).not.toBeNull();
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-bullet-chart", { is: D3BulletChart });
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
});
