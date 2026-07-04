// ABOUTME: Tests the additive GraphQL self-fetch path on d3Sankey (Approach A, CT-MG).
// ABOUTME: Uses the real HTML selectors: .chart-container (chart) and .slds-text-color_error (error).
import { createElement } from "lwc";
import D3Sankey from "c/d3Sankey";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

// Minimal chainable D3 stub with sankey-specific functions: every call
// returns the same chainable object except sankey(), which produces a
// minimal layout from the nodes/links it is given.
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
    delay: () => chain,
    on: () => chain,
    remove: () => chain,
    insert: () => chain,
    text: () => chain,
    datum: () => chain,
    node: () => null,
    each: (cb) => {
      if (cb) cb({}, 0, [{}]);
      return chain;
    },
    sankey: () => {
      const sankeyFn = (data) => {
        const nodes = data.nodes.map((n, i) => ({
          ...n,
          x0: i * 100,
          x1: i * 100 + 20,
          y0: 0,
          y1: 100,
          value: 100,
          sourceLinks: [],
          targetLinks: []
        }));
        const links = data.links.map((l) => ({
          ...l,
          source: nodes[l.source] || nodes[0],
          target: nodes[l.target] || nodes[1],
          width: 10,
          y0: 50,
          y1: 50
        }));
        links.forEach((l) => {
          if (l.source) l.source.sourceLinks.push(l);
          if (l.target) l.target.targetLinks.push(l);
        });
        return { nodes, links };
      };
      sankeyFn.nodeWidth = () => sankeyFn;
      sankeyFn.nodePadding = () => sankeyFn;
      sankeyFn.nodeAlign = () => sankeyFn;
      sankeyFn.extent = () => sankeyFn;
      sankeyFn.iterations = () => sankeyFn;
      return sankeyFn;
    },
    sankeyJustify: () => {},
    sankeyLinkHorizontal: () => () => "M0,0 L100,100"
  };
  return chain;
}

// Two-group aggregate envelope (source/target grouped, value summed) —
// same shape as the live-verified multi-group envelope Task 1 committed.
const MULTI_GROUP_RESPONSE = {
  uiapi: {
    aggregate: {
      Lead: {
        edges: [
          {
            node: {
              aggregate: {
                LeadSource: { value: "Web" },
                Status: { value: "Qualified" },
                Amount: { sum: { value: 10000 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                LeadSource: { value: "Referral" },
                Status: { value: "Converted" },
                Amount: { sum: { value: 30000 } }
              }
            }
          }
        ]
      }
    }
  }
};

// Raw-record envelope for the no-valueField fallback (implicit count-by-pair).
const RECORD_RESPONSE = {
  uiapi: {
    query: {
      Lead: {
        edges: [
          {
            node: {
              LeadSource: { value: "Web" },
              Status: { value: "Qualified" }
            }
          },
          {
            node: {
              LeadSource: { value: "Web" },
              Status: { value: "Qualified" }
            }
          },
          {
            node: { LeadSource: { value: "Email" }, Status: { value: "Lost" } }
          }
        ]
      }
    }
  }
};

async function flushPromises() {
  return Promise.resolve();
}

describe("d3Sankey GraphQL path (Approach A, CT-MG)", () => {
  beforeEach(() => {
    loadD3.mockResolvedValue(makeD3Stub());

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 600,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 600
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

  it("renders the chart container when GraphQL multi-group aggregate data arrives", async () => {
    const element = createElement("c-d3-sankey", { is: D3Sankey });
    element.fetchMode = "graphql";
    element.objectApiName = "Lead";
    element.sourceField = "LeadSource";
    element.targetField = "Status";
    element.valueField = "Amount";
    document.body.appendChild(element);

    await flushPromises(); // connectedCallback (loadD3 + loadData early-return)
    graphql.emit(MULTI_GROUP_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();
  });

  it("falls back to a raw-record fetch (implicit count-by-pair) when valueField is not set", async () => {
    const element = createElement("c-d3-sankey", { is: D3Sankey });
    element.fetchMode = "graphql";
    element.objectApiName = "Lead";
    element.sourceField = "LeadSource";
    element.targetField = "Status";
    element.valueField = "";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(RECORD_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-sankey", { is: D3Sankey });
    element.fetchMode = "graphql";
    element.objectApiName = "Lead";
    element.sourceField = "LeadSource";
    element.targetField = "Status";
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
