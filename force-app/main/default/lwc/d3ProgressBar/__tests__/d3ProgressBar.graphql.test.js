// ABOUTME: Tests the additive GraphQL self-fetch path on d3ProgressBar (Approach A, CT-REC).
// ABOUTME: Uses the real HTML selectors: .chart-container (chart) and .slds-text-color_error (error).
import { createElement } from "lwc";
import D3ProgressBar from "c/d3ProgressBar";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Minimal chainable D3 stub: every call returns the same chainable object.
// The `then` guard keeps this from looking like a thenable to
// Promise.resolve()/await — without it, `prop === "then"` would return a
// callable that swallows (resolve, reject) and awaiting loadD3() would
// hang forever (this matters here because, unlike the other CT-REC
// charts, ProgressBar's hasData getter still checks `this.d3 !== null`).
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
        edges: [{ node: { Amount: { value: 40 } } }]
      }
    }
  }
};

async function flushPromises() {
  return Promise.resolve();
}

describe("d3ProgressBar GraphQL path (Approach A, CT-REC)", () => {
  beforeEach(() => {
    loadD3.mockResolvedValue(makeD3Stub());

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 300,
      height: 80,
      top: 0,
      left: 0,
      bottom: 80,
      right: 300
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
    const element = createElement("c-d3-progress-bar", { is: D3ProgressBar });
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

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-progress-bar", { is: D3ProgressBar });
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
