// ABOUTME: Integration tests for d3IconArray verifying real service interactions.
// ABOUTME: Tests real dataService aggregation, themeService colors, and chartUtils contrast against mock D3 path rendering.

import { createElement } from "lwc";
import D3IconArray from "c/d3IconArray";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// ═══════════════════════════════════════════════════════════════
// MOCKS — Only external dependencies, NOT real utility services
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
  "lightning/platformShowToastEvent",
  () => ({
    ShowToastEvent: jest.fn()
  }),
  { virtual: true }
);

const NAVIGATE_SYMBOL = Symbol.for("NavigationMixin.Navigate");
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const NavigationMixin = (Base) => {
      return class extends Base {
        [NAVIGATE_SYMBOL] = mockNavigate;
      };
    };
    NavigationMixin.Navigate = NAVIGATE_SYMBOL;
    return { NavigationMixin };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY (icon array-specific — symbol paths, no rects/arcs)
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const symbolFn = jest.fn(() => "M0,0Z");
  symbolFn.type = jest.fn(() => symbolFn);
  symbolFn.size = jest.fn(() => symbolFn);
  const d3 = {
    select: jest.fn(() => d3),
    append: jest.fn(() => d3),
    attr: jest.fn(() => d3),
    style: jest.fn(() => d3),
    call: jest.fn(() => d3),
    selectAll: jest.fn(() => d3),
    data: jest.fn(() => d3),
    enter: jest.fn(() => d3),
    on: jest.fn(() => d3),
    remove: jest.fn(() => d3),
    text: jest.fn(() => d3),
    insert: jest.fn(() => d3),
    symbol: jest.fn(() => symbolFn),
    symbolCircle: "symbolCircle",
    symbolSquare: "symbolSquare",
    symbolTriangle: "symbolTriangle",
    symbolDiamond: "symbolDiamond",
    symbolStar: "symbolStar",
    symbolCross: "symbolCross"
  };
  return d3;
};

// ═══════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { StageName: "Prospecting", Amount: 100 },
  { StageName: "Prospecting", Amount: 200 },
  { StageName: "Qualification", Amount: 150 },
  { StageName: "Closed Won", Amount: 500 }
];
// After Sum aggregation by StageName: Closed Won=500, Prospecting=300, Qualification=150
// Total = 950; icons: round(500/950*100)=53, round(300/950*100)=32, round(150/950*100)=16->15 (cap)

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const flushPromises = () => new Promise(process.nextTick);

async function createChart(props = {}) {
  const element = createElement("c-d3-icon-array", {
    is: D3IconArray
  });

  Object.assign(element, {
    groupByField: "StageName",
    valueField: "Amount",
    operation: "Sum",
    recordCollection: SAMPLE_DATA,
    theme: "Salesforce Standard",
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

describe("c-d3-icon-array integration", () => {
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);

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
  // ICON ALLOCATION WITH REAL DATASERVICE AGGREGATION
  // ═══════════════════════════════════════════════════════════════

  describe("icon allocation with real aggregation", () => {
    it("binds exactly 100 icons from real Sum aggregation", async () => {
      await createChart({ operation: "Sum" });

      const dataCalls = mockD3.data.mock.calls;
      const iconBinding = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      );
      expect(iconBinding).toBeDefined();
      expect(iconBinding[0].length).toBe(100);
    });

    it("filled icon counts match rounded real proportions (descending, capped)", async () => {
      await createChart({ operation: "Sum" });

      const dataCalls = mockD3.data.mock.calls;
      const icons = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      const counts = icons.reduce((acc, icon) => {
        if (icon.label) acc[icon.label] = (acc[icon.label] || 0) + 1;
        return acc;
      }, {});

      // Real dataService Sum: Closed Won=500, Prospecting=300, Qualification=150 (total 950)
      // round(500/950*100)=53, round(300/950*100)=32, round(150/950*100)=16
      // descending allocator caps at 100 -> Qualification trimmed to 15
      expect(counts["Closed Won"]).toBe(53);
      expect(counts.Prospecting).toBe(32);
      expect(counts.Qualification).toBe(15);

      const filled =
        counts["Closed Won"] + counts.Prospecting + counts.Qualification;
      expect(filled).toBe(100);
    });

    it("Count operation produces correct icon counts", async () => {
      // Count: Prospecting=2, Closed Won=1, Qualification=1 (total 4)
      // round(2/4*100)=50, round(1/4*100)=25, round(1/4*100)=25 -> 100 total
      await createChart({ operation: "Count" });

      const dataCalls = mockD3.data.mock.calls;
      const icons = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      const counts = icons.reduce((acc, icon) => {
        if (icon.label) acc[icon.label] = (acc[icon.label] || 0) + 1;
        return acc;
      }, {});

      expect(counts.Prospecting).toBe(50);
      expect(counts["Closed Won"]).toBe(25);
      expect(counts.Qualification).toBe(25);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // REAL THEMESERVICE PALETTE FLOWS INTO ICONS
  // ═══════════════════════════════════════════════════════════════

  describe("real themeService palette", () => {
    it("Salesforce Standard hex colors map to descending categories", async () => {
      await createChart({ operation: "Sum", theme: "Salesforce Standard" });

      const dataCalls = mockD3.data.mock.calls;
      const icons = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      // createColorScale built over full domain [Closed Won, Prospecting, Qualification]
      // Salesforce Standard palette: #1589EE, #FF9E2C, #4BCA81
      const colorByLabel = {};
      icons.forEach((icon) => {
        if (icon.label) colorByLabel[icon.label] = icon.color;
      });

      expect(colorByLabel["Closed Won"]).toBe("#1589EE");
      expect(colorByLabel.Prospecting).toBe("#FF9E2C");
      expect(colorByLabel.Qualification).toBe("#4BCA81");
    });

    it("Warm theme hex colors flow into icons", async () => {
      await createChart({ operation: "Sum", theme: "Warm" });

      const dataCalls = mockD3.data.mock.calls;
      const icons = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      const closedWonIcon = icons.find((c) => c.label === "Closed Won");
      // Warm palette first color
      expect(closedWonIcon.color).toBe("#FF6B6B");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // REAL CHARTUTILS CONTRAST
  // ═══════════════════════════════════════════════════════════════

  describe("real chartUtils contrast", () => {
    it("each icon carries a real getContrastColor textColor", async () => {
      await createChart({ operation: "Sum", theme: "Salesforce Standard" });

      const dataCalls = mockD3.data.mock.calls;
      const icons = dataCalls.find(
        (call) => Array.isArray(call[0]) && call[0].length === 100
      )[0];

      // getContrastColor returns "#000000" or "#ffffff"
      icons.forEach((icon) => {
        expect(["#000000", "#ffffff"]).toContain(icon.textColor);
      });

      // #1589EE (Closed Won) has WCAG luminance ~0.24 (> 0.179) -> dark text
      const closedWonIcon = icons.find((c) => c.label === "Closed Won");
      expect(closedWonIcon.textColor).toBe("#000000");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EVENT PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("event pipeline integration", () => {
    it("icon click registers D3 click handler when objectApiName is set", async () => {
      const element = await createChart({
        objectApiName: "Opportunity",
        filterField: "StageName"
      });

      const onCalls = mockD3.on.mock.calls;
      const clickCalls = onCalls.filter((c) => c[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);

      expect(element.objectApiName).toBe("Opportunity");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ACCESSIBILITY WIRING
  // ═══════════════════════════════════════════════════════════════

  describe("accessibility wiring", () => {
    it("applies role=img and a title to the rendered svg", async () => {
      await createChart();

      const attrCalls = mockD3.attr.mock.calls;
      const roleCall = attrCalls.find((call) => call[0] === "role");
      expect(roleCall).toBeTruthy();
      expect(roleCall[1]).toBe("img");

      const insertCalls = mockD3.insert.mock.calls;
      const titleInsert = insertCalls.find((call) => call[0] === "title");
      expect(titleInsert).toBeTruthy();
      expect(titleInsert[1]).toBe(":first-child");
    });
  });
});
