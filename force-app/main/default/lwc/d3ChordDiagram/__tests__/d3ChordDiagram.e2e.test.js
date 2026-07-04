// force-app/main/default/lwc/d3ChordDiagram/__tests__/d3ChordDiagram.e2e.test.js
// ABOUTME: End-to-end lifecycle tests for the D3 Chord Diagram component.
// ABOUTME: Verifies full render pipeline, matrix/ribbon binding, multi-instance isolation, and error recovery using real services with mocked D3.

import { createElement } from "lwc";
import D3ChordDiagram from "c/d3ChordDiagram";
import { loadD3 } from "c/d3Lib";

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP: Only mock D3 lib, Apex, navigation, and toast
// Real modules: c/dataService, c/themeService, c/chartUtils
// ═══════════════════════════════════════════════════════════════

jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/D3ChartController.getMultiGroupData",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const NavMixin = jest.fn((Base) => {
      return class extends Base {
        [Symbol.for("NavigationMixin.Navigate")] = mockNavigate;
      };
    });
    NavMixin.Navigate = Symbol.for("NavigationMixin.Navigate");
    NavMixin.GenerateUrl = Symbol.for("NavigationMixin.GenerateUrl");
    return { NavigationMixin: NavMixin };
  },
  { virtual: true }
);

jest.mock(
  "lightning/platformShowToastEvent",
  () => {
    return {
      ShowToastEvent: class ShowToastEvent extends CustomEvent {
        constructor(toast) {
          super("lightning__showtoast", {
            composed: true,
            cancelable: true,
            bubbles: true,
            detail: toast
          });
        }
      }
    };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY (chord-specific — chord, ribbon, arc)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Prospecting", LeadSource: "Web", Amount: 100 },
  { StageName: "Prospecting", LeadSource: "Phone", Amount: 200 },
  { StageName: "Qualification", LeadSource: "Web", Amount: 150 },
  { StageName: "Closed Won", LeadSource: "Phone", Amount: 500 }
];
// Distinct labels (source ∪ target): Prospecting, Web, Phone, Qualification, Closed Won => 5

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

async function createChart(props = {}) {
  const element = createElement("c-d3-chord-diagram", {
    is: D3ChordDiagram
  });

  Object.assign(element, {
    groupByField: "StageName",
    seriesField: "LeadSource",
    valueField: "Amount",
    operation: "Sum",
    recordCollection: SAMPLE_DATA,
    ...props
  });

  document.body.appendChild(element);
  await flushPromises();
  await flushPromises();
  return element;
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe("c-d3-chord-diagram e2e", () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

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
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ═══════════════════════════════════════════════════════════════
  // FULL RENDER LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  describe("full render lifecycle", () => {
    it("creates chord diagram end-to-end with correct D3 calls", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      // loadD3 called during connectedCallback
      expect(loadD3).toHaveBeenCalled();

      // chord layout built
      expect(mockD3.chord).toHaveBeenCalled();

      // arc + ribbon generators created
      expect(mockD3.arc).toHaveBeenCalled();
      expect(mockD3.ribbon).toHaveBeenCalled();

      // SVG was appended
      const appendCalls = mockD3.append.mock.calls.map((c) => c[0]);
      expect(appendCalls).toContain("svg");

      // Chart container visible
      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      // Spinner gone, no error state
      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeFalsy();

      // No console errors during the full lifecycle
      const realErrors = consoleErrorSpy.mock.calls.filter(
        (call) =>
          !String(call[0]).includes("D3ChordDiagram initialization error")
      );
      expect(realErrors.length).toBe(0);
    });

    it("cleanup removes resize handler on disconnect", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      const element = await createChart();
      await flushPromises();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeTruthy();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();

      const cleanupErrors = consoleErrorSpy.mock.calls.filter(
        (call) =>
          String(call[0]).includes("cleanup") ||
          String(call[0]).includes("disconnect")
      );
      expect(cleanupErrors.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA-FLOW VERIFICATION
  // ═══════════════════════════════════════════════════════════════

  describe("data-flow verification", () => {
    it("binds a square matrix matching distinct labels into the chord layout", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      await createChart({ operation: "Sum" });
      await flushPromises();

      const chordFn = mockD3.chord.mock.results[0].value;
      const matrix = chordFn.mock.calls[0][0];
      // 5 distinct labels => 5x5
      expect(matrix.length).toBe(5);
      matrix.forEach((row) => expect(row.length).toBe(5));

      // Total edge weight 100 + 200 + 150 + 500 = 950
      const total = matrix.flat().reduce((s, v) => s + v, 0);
      expect(total).toBe(950);
    });

    it("binds group arcs (data) via the data() call on the selection", async () => {
      const mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);

      await createChart();
      await flushPromises();

      // The component calls selectAll().data(groups) for group arcs and
      // .data(chordLayout) for ribbons — data() should be called.
      expect(mockD3.data).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTI-INSTANCE ISOLATION
  // ═══════════════════════════════════════════════════════════════

  describe("multi-instance isolation", () => {
    it("renders two independent chord diagrams without cross-talk", async () => {
      const mockD3First = createMockD3();
      loadD3.mockResolvedValue(mockD3First);
      const firstElement = await createChart({ theme: "Salesforce Standard" });
      await flushPromises();

      const mockD3Second = createMockD3();
      loadD3.mockResolvedValue(mockD3Second);
      const secondElement = await createChart({ theme: "Warm" });
      await flushPromises();

      // Both have their own chord layout invocation
      expect(mockD3First.chord).toHaveBeenCalled();
      expect(mockD3Second.chord).toHaveBeenCalled();

      // Both containers exist independently
      expect(
        firstElement.shadowRoot.querySelector(".chart-container")
      ).toBeTruthy();
      expect(
        secondElement.shadowRoot.querySelector(".chart-container")
      ).toBeTruthy();

      // No errors across both lifecycles
      const realErrors = consoleErrorSpy.mock.calls.filter(
        (call) =>
          !String(call[0]).includes("D3ChordDiagram initialization error")
      );
      expect(realErrors.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR → RECOVERY FLOW
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery flow", () => {
    it("shows error state when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("Network failure loading D3"));

      const element = await createChart();
      await flushPromises();
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();

      const chartContainer =
        element.shadowRoot.querySelector(".chart-container");
      expect(chartContainer).toBeFalsy();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });
  });
});
