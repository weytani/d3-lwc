// ABOUTME: Tests the additive GraphQL self-fetch path on d3ChordDiagram (Approach A, CT-MG).
// ABOUTME: groupByField=source, seriesField=target, valueField -> [{label,series,value}] -> buildMatrix.
import { createElement } from "lwc";
import D3ChordDiagram from "c/d3ChordDiagram";
import { graphql } from "lightning/graphql";
import { loadD3 } from "c/d3Lib";

jest.mock("c/d3Lib", () => ({ loadD3: jest.fn() }));

jest.mock("c/chartUtils", () => ({
  formatNumber: jest.fn((v) => String(v)),
  formatPercent: jest.fn((v) => (v * 100).toFixed(1) + "%"),
  truncateLabel: jest.fn((label) => label),
  createTooltip: jest.fn().mockReturnValue({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn()
  }),
  buildTooltipContent: jest.fn().mockReturnValue("<div>tooltip</div>"),
  createResizeHandler: jest.fn().mockReturnValue({
    observe: jest.fn(),
    disconnect: jest.fn()
  }),
  createLayoutRetry: jest.fn().mockReturnValue({ cancel: jest.fn() }),
  calculateDimensions: jest
    .fn()
    .mockReturnValue({ width: 300, height: 200, margins: {} }),
  shouldUseCompactMode: jest.fn().mockReturnValue(false),
  applySvgA11y: jest.fn()
}));

// Same hand-rolled chord/ribbon/arc mock as d3ChordDiagram.test.js, needed so
// renderChart's d3.chord()(matrix) call actually executes against the
// graphql-sourced matrix instead of throwing on an undefined chain method.
const createMockD3 = () => {
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    insert: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    transition: jest.fn(() => d3),
    duration: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    chord: jest.fn(() => {
      const chordFn = jest.fn((matrix) => {
        const n = matrix.length;
        const groups = [];
        const ribbons = [];
        for (let i = 0; i < n; i++) {
          groups.push({
            index: i,
            startAngle: i * 0.5,
            endAngle: (i + 1) * 0.5,
            value: matrix[i].reduce((a, b) => a + b, 0)
          });
          for (let j = 0; j < n; j++) {
            if (matrix[i][j] > 0) {
              ribbons.push({
                source: { index: i, startAngle: 0, endAngle: 0.1 },
                target: { index: j, startAngle: 0.2, endAngle: 0.3 }
              });
            }
          }
        }
        ribbons.groups = groups;
        return ribbons;
      });
      chordFn.padAngle = jest.fn(() => chordFn);
      chordFn.sortSubgroups = jest.fn(() => chordFn);
      return chordFn;
    }),
    ribbon: jest.fn(() => {
      const ribbonFn = jest.fn(() => "M0,0");
      ribbonFn.radius = jest.fn(() => ribbonFn);
      return ribbonFn;
    }),
    arc: jest.fn(() => {
      const arcFn = jest.fn(() => "M0,0");
      arcFn.innerRadius = jest.fn(() => arcFn);
      arcFn.outerRadius = jest.fn(() => arcFn);
      return arcFn;
    })
  };
  return d3;
};

// Live-verified multi-group envelope (matches d3StackedBarChart.graphql.test.js shape).
const MULTI_GROUP_RESPONSE = {
  uiapi: {
    aggregate: {
      Opportunity: {
        edges: [
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                LeadSource: { value: "Web" },
                Amount: { sum: { value: 100 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Prospecting" },
                LeadSource: { value: "Phone" },
                Amount: { sum: { value: 200 } }
              }
            }
          },
          {
            node: {
              aggregate: {
                StageName: { value: "Closed Won" },
                LeadSource: { value: "Phone" },
                Amount: { sum: { value: 500 } }
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

describe("d3ChordDiagram GraphQL path (Approach A, CT-MG)", () => {
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

  it("renders the chord diagram and pivots to a real matrix when GraphQL edge data arrives", async () => {
    const element = createElement("c-d3-chord-diagram", {
      is: D3ChordDiagram
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "LeadSource";
    element.valueField = "Amount";
    element.operation = "Sum";
    document.body.appendChild(element);

    await flushPromises();
    graphql.emit(MULTI_GROUP_RESPONSE);
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".chart-container")).not.toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-text-color_error")
    ).toBeNull();

    // Proves renderChart actually ran: d3.chord() is only invoked deep inside
    // renderChart, with the square matrix buildMatrix pivoted from the 3
    // normalized edges (3 distinct labels: Prospecting, Web, Phone, Closed Won -> 4).
    expect(mockD3.chord).toHaveBeenCalledTimes(1);
    const chordFn = mockD3.chord.mock.results[0].value;
    expect(chordFn).toHaveBeenCalledTimes(1);
    const matrix = chordFn.mock.calls[0][0];
    expect(matrix).toHaveLength(4);
    expect(matrix.every((row) => row.length === 4)).toBe(true);
  });

  it("shows an error when the GraphQL wire emits errors", async () => {
    const element = createElement("c-d3-chord-diagram", {
      is: D3ChordDiagram
    });
    element.fetchMode = "graphql";
    element.objectApiName = "Opportunity";
    element.groupByField = "StageName";
    element.seriesField = "LeadSource";
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
