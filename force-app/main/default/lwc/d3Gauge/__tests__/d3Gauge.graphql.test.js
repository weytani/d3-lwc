// ABOUTME: Tests the additive GraphQL self-fetch path on d3Gauge (Approach A, CT-REC).
// ABOUTME: Uses real chartUtils/graphqlService; only d3Lib is mocked.
import { createElement } from "lwc";
import D3Gauge from "c/d3Gauge";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Minimal chainable D3 stub: every call returns the same chainable object.
function makeD3Stub() {
  const chain = {
    select: () => chain,
    append: () => chain,
    attr: () => chain,
    style: () => chain,
    call: () => chain,
    selectAll: () => chain,
    data: () => chain,
    enter: () => chain,
    transition: () => chain,
    duration: () => chain,
    on: () => chain,
    remove: () => chain,
    insert: () => chain,
    text: () => chain,
    arc: () => {
      const arcFn = () => "M0,0";
      arcFn.innerRadius = () => arcFn;
      arcFn.outerRadius = () => arcFn;
      arcFn.startAngle = () => arcFn;
      arcFn.endAngle = () => arcFn;
      arcFn.cornerRadius = () => arcFn;
      return arcFn;
    },
    scaleLinear: () => {
      const scale = () => 0;
      scale.domain = () => scale;
      scale.range = () => scale;
      scale.clamp = () => scale;
      return scale;
    },
    pointer: () => [150, 100]
  };
  return chain;
}

const RECORD_RESPONSE = {
  uiapi: {
    query: {
      Opportunity: {
        edges: [{ node: { Amount: { value: 750 } } }]
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

describe("d3Gauge GraphQL path (Approach A, CT-REC)", () => {
  let consoleWarnSpy;

  beforeEach(() => {
    loadD3.mockResolvedValue(makeD3Stub());

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 300,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 300
    }));

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));

    // Gauge's tooltip mounts into a plain (non lwc:dom="manual") container,
    // a pre-existing quirk shared by every Gauge test file — silence the
    // resulting LWC portal warning here too (see the other Gauge suites).
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
    consoleWarnSpy.mockRestore();
  });

  it("renders the gauge when GraphQL record data arrives", async () => {
    const element = createElement("c-d3-gauge", { is: D3Gauge });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises(); // connectedCallback (loadD3 + loadData early-return)
    graphql.emit(RECORD_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-svg")).not.toBeNull();
    expect(element.shadowRoot.querySelector(".chart-error")).toBeNull();
  });

  it("shows the no-data state (not a min-pinned gauge) when GraphQL returns no records", async () => {
    const element = createElement("c-d3-gauge", { is: D3Gauge });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(EMPTY_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-svg")).toBeNull();
    expect(element.shadowRoot.querySelector(".chart-no-data")).not.toBeNull();
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-gauge", { is: D3Gauge });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emitErrors([{ message: "boom" }]);
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-error")).not.toBeNull();
  });
});
