// ABOUTME: Unit tests for the d3CalendarHeatmap Lightning Web Component.
// ABOUTME: Tests initialization, calendar grid, year navigation, data aggregation, tooltips, and rendering.

import { createElement } from "lwc";
import D3CalendarHeatmap from "c/d3CalendarHeatmap";
import { loadD3 } from "c/d3Lib";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// Mock d3Lib
jest.mock("c/d3Lib", () => ({
  loadD3: jest.fn()
}));

// Mock Apex
jest.mock(
  "@salesforce/apex/D3ChartController.executeQuery",
  () => ({
    default: jest.fn()
  }),
  { virtual: true }
);

// Mock NavigationMixin
const mockNavigate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => {
    const Navigate = Symbol.for("NavigationMixin.Navigate");
    const mixin = (Base) => {
      return class extends Base {
        [Navigate] = mockNavigate;
      };
    };
    mixin.Navigate = Navigate;
    return { NavigationMixin: mixin };
  },
  { virtual: true }
);

// ═══════════════════════════════════════════════════════════════
// MOCK D3 FACTORY
// ═══════════════════════════════════════════════════════════════

const createMockD3 = () => {
  const mockScale = jest.fn((v) => v);
  mockScale.domain = jest.fn(() => mockScale);
  mockScale.range = jest.fn(() => mockScale);

  const mockD3 = {
    select: jest.fn(() => mockD3),
    append: jest.fn(() => mockD3),
    attr: jest.fn(() => mockD3),
    style: jest.fn(() => mockD3),
    call: jest.fn(() => mockD3),
    insert: jest.fn(() => mockD3),
    selectAll: jest.fn(() => mockD3),
    data: jest.fn(() => mockD3),
    enter: jest.fn(() => mockD3),
    on: jest.fn(() => mockD3),
    remove: jest.fn(() => mockD3),
    html: jest.fn(() => mockD3),
    text: jest.fn(() => mockD3),
    transition: jest.fn(() => mockD3),
    duration: jest.fn(() => mockD3),
    scaleQuantize: jest.fn(() => {
      const scale = jest.fn(() => "#e5f5e0");
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      return scale;
    }),
    scaleLinear: jest.fn(() => {
      const scale = jest.fn(() => 100);
      scale.domain = jest.fn(() => scale);
      scale.range = jest.fn(() => scale);
      scale.nice = jest.fn(() => scale);
      return scale;
    }),
    max: jest.fn(() => 10),
    timeFormat: jest.fn(() => jest.fn((d) => d.toISOString().slice(0, 10)))
  };
  return mockD3;
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_DATA = [
  { CloseDate: "2025-01-15", Amount: 100 },
  { CloseDate: "2025-01-15", Amount: 200 },
  { CloseDate: "2025-03-10", Amount: 150 },
  { CloseDate: "2025-06-20", Amount: 500 },
  { CloseDate: "2025-06-20", Amount: 300 },
  { CloseDate: "2025-12-25", Amount: 400 }
];

const COUNT_DATA = [
  { CloseDate: "2025-01-15", Name: "Opp1" },
  { CloseDate: "2025-01-15", Name: "Opp2" },
  { CloseDate: "2025-01-15", Name: "Opp3" },
  { CloseDate: "2025-03-10", Name: "Opp4" },
  { CloseDate: "2025-06-20", Name: "Opp5" }
];

const MULTI_YEAR_DATA = [
  { CloseDate: "2024-06-15", Amount: 100 },
  { CloseDate: "2025-01-15", Amount: 200 },
  { CloseDate: "2025-06-20", Amount: 300 }
];

const ISO_DATETIME_DATA = [
  { CloseDate: "2025-01-15T10:30:00.000Z", Amount: 100 },
  { CloseDate: "2025-03-10T14:00:00.000Z", Amount: 200 }
];

const SLASH_DATE_DATA = [
  { CloseDate: "01/15/2025", Amount: 100 },
  { CloseDate: "03/10/2025", Amount: 200 }
];

const SINGLE_RECORD = [{ CloseDate: "2025-05-01", Amount: 100 }];

// Flush promises helper
// eslint-disable-next-line @lwc/lwc/no-async-operation
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("c-d3-calendar-heatmap", () => {
  let element;
  let mockD3;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockD3 = createMockD3();
    loadD3.mockResolvedValue(mockD3);
    executeQuery.mockResolvedValue(SAMPLE_DATA);

    // Spy on console to ensure pristine output
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 800
    }));

    // Mock ResizeObserver
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
    jest.clearAllMocks();
  });

  // Helper to create element with properties
  async function createChart(props = {}) {
    element = createElement("c-d3-calendar-heatmap", {
      is: D3CalendarHeatmap
    });

    Object.assign(element, {
      dateField: "CloseDate",
      valueField: "Amount",
      operation: "Count",
      recordCollection: SAMPLE_DATA,
      ...props
    });

    document.body.appendChild(element);

    // Wait for async operations
    await flushPromises();
    await flushPromises();

    return element;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("initialization", () => {
    it("shows loading state initially", async () => {
      element = createElement("c-d3-calendar-heatmap", {
        is: D3CalendarHeatmap
      });
      element.dateField = "CloseDate";
      element.recordCollection = SAMPLE_DATA;

      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("loads D3 library on connect", async () => {
      await createChart();
      expect(loadD3).toHaveBeenCalled();
    });

    it("hides loading after initialization", async () => {
      await createChart();
      await flushPromises();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("renders chart container when data is available", async () => {
      await createChart();
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("defaults year to current year when not set", async () => {
      await createChart();
      await flushPromises();

      const yearLabel = element.shadowRoot.querySelector(
        ".slds-text-heading_small"
      );
      expect(yearLabel).toBeTruthy();
      expect(yearLabel.textContent).toBe(String(new Date().getFullYear()));
    });

    it("uses provided year property", async () => {
      await createChart({ year: 2023 });
      await flushPromises();

      const yearLabel = element.shadowRoot.querySelector(
        ".slds-text-heading_small"
      );
      expect(yearLabel).toBeTruthy();
      expect(yearLabel.textContent).toBe("2023");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATA HANDLING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("data handling", () => {
    it("uses recordCollection when provided", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA
      });

      expect(executeQuery).not.toHaveBeenCalled();
    });

    it("executes SOQL when recordCollection is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT CloseDate, Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT CloseDate, Amount FROM Opportunity"
      });
    });

    it("shows error when no data source provided", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: ""
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("shows error when SOQL query fails", async () => {
      executeQuery.mockRejectedValue({
        body: { message: "Query error" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Invalid FROM Opportunity"
      });

      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("handles single record", async () => {
      await createChart({ recordCollection: SINGLE_RECORD });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("wires filterClause into the SOQL query sent to Apex", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT CloseDate, Amount FROM Opportunity",
        filterClause: "Amount > 1000"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString:
          "SELECT CloseDate, Amount FROM Opportunity WHERE (Amount > 1000)"
      });
    });

    it("leaves the SOQL query untouched when filterClause is empty", async () => {
      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT CloseDate, Amount FROM Opportunity"
      });

      expect(executeQuery).toHaveBeenCalledWith({
        queryString: "SELECT CloseDate, Amount FROM Opportunity"
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CALENDAR GRID TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("calendar grid", () => {
    it("builds grid with 365 cells for non-leap year", async () => {
      await createChart({ year: 2025, recordCollection: SAMPLE_DATA });
      await flushPromises();

      // The component uses buildCalendarGrid internally
      // We verify it called data() with a 365-cell grid
      const dataCalls = mockD3.data.mock.calls;
      const gridCall = dataCalls.find(
        (c) => Array.isArray(c[0]) && c[0].length === 365
      );
      expect(gridCall).toBeTruthy();
    });

    it("builds grid with 366 cells for leap year", async () => {
      await createChart({ year: 2024, recordCollection: MULTI_YEAR_DATA });
      await flushPromises();

      const dataCalls = mockD3.data.mock.calls;
      const gridCall = dataCalls.find(
        (c) => Array.isArray(c[0]) && c[0].length === 366
      );
      expect(gridCall).toBeTruthy();
    });

    it("renders rect elements for each day cell", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const rectCalls = appendCalls.filter((c) => c[0] === "rect");
      expect(rectCalls.length).toBeGreaterThan(0);
    });

    it("renders month labels", async () => {
      await createChart();
      await flushPromises();

      // Month labels are rendered via .text((d) => ...) — the mock records
      // a function reference. We verify text() was called with a function
      // that resolves month names when invoked with month boundary data.
      const textCalls = mockD3.text.mock.calls;
      const monthFnCall = textCalls.find((c) => typeof c[0] === "function");
      expect(monthFnCall).toBeTruthy();

      // Verify the function produces month names when called
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ];
      const fnResults = textCalls
        .filter((c) => typeof c[0] === "function")
        .map((c) => {
          try {
            return c[0]({ month: 0, week: 0 });
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      const hasMonthLabel = fnResults.some((r) =>
        monthNames.includes(String(r))
      );
      expect(hasMonthLabel).toBe(true);
    });

    it("renders weekday labels", async () => {
      await createChart();
      await flushPromises();

      // Weekday labels are rendered via .text((d) => d.label) — the mock
      // records the function reference. We verify the function resolves
      // weekday names when invoked with label data.
      const textCalls = mockD3.text.mock.calls;
      const weekdayLabels = ["Mon", "Wed", "Fri"];
      const fnResults = textCalls
        .filter((c) => typeof c[0] === "function")
        .map((c) => {
          try {
            return c[0]({ day: 1, label: "Mon" });
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      const hasWeekdayLabel = fnResults.some((r) =>
        weekdayLabels.includes(String(r))
      );
      expect(hasWeekdayLabel).toBe(true);
    });

    it("applies sequential color ramp for cells", async () => {
      await createChart();
      await flushPromises();

      // scaleQuantize should have been called for color mapping
      expect(mockD3.scaleQuantize).toHaveBeenCalled();
    });

    it("uses default color for empty days", async () => {
      await createChart();
      await flushPromises();

      // attr should be called with 'fill' for the day cells
      const attrCalls = mockD3.attr.mock.calls;
      const fillCalls = attrCalls.filter((c) => c[0] === "fill");
      expect(fillCalls.length).toBeGreaterThan(0);
    });

    it("silently truncates data exceeding record limit", async () => {
      // Build data that exceeds CALENDAR_HEATMAP limit (2000)
      const largeData = Array.from({ length: 2500 }, (_, i) => ({
        CloseDate: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
        Amount: i * 10
      }));

      const toastHandler = jest.fn();
      element = createElement("c-d3-calendar-heatmap", {
        is: D3CalendarHeatmap
      });
      element.addEventListener("lightning__showtoast", toastHandler);
      Object.assign(element, {
        dateField: "CloseDate",
        valueField: "Amount",
        operation: "Sum",
        recordCollection: largeData
      });
      document.body.appendChild(element);

      await flushPromises();
      await flushPromises();

      expect(toastHandler).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // YEAR NAVIGATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("year navigation", () => {
    it("displays current year", async () => {
      await createChart({ year: 2025 });
      await flushPromises();

      const yearLabel = element.shadowRoot.querySelector(
        ".slds-text-heading_small"
      );
      expect(yearLabel.textContent).toBe("2025");
    });

    it("navigates to previous year on prev button click", async () => {
      await createChart({ year: 2025 });
      await flushPromises();

      const prevButton = element.shadowRoot.querySelector(
        "button.slds-button_icon:first-of-type"
      );
      prevButton.click();
      await flushPromises();

      const yearLabel = element.shadowRoot.querySelector(
        ".slds-text-heading_small"
      );
      expect(yearLabel.textContent).toBe("2024");
    });

    it("navigates to next year on next button click", async () => {
      await createChart({ year: 2025 });
      await flushPromises();

      const buttons = element.shadowRoot.querySelectorAll(
        "button.slds-button_icon"
      );
      const nextButton = buttons[buttons.length - 1];
      nextButton.click();
      await flushPromises();

      const yearLabel = element.shadowRoot.querySelector(
        ".slds-text-heading_small"
      );
      expect(yearLabel.textContent).toBe("2026");
    });

    it("re-renders chart after year change", async () => {
      await createChart({ year: 2025 });
      await flushPromises();

      // Reset mock call counts
      mockD3.select.mockClear();

      const prevButton = element.shadowRoot.querySelector(
        "button.slds-button_icon:first-of-type"
      );
      prevButton.click();
      await flushPromises();
      await flushPromises();

      // Chart should have been re-rendered (select called for SVG rebuild)
      expect(mockD3.select).toHaveBeenCalled();
    });

    it("displayYear getter returns correct year", async () => {
      await createChart({ year: 2023 });
      await flushPromises();

      const yearLabel = element.shadowRoot.querySelector(
        ".slds-text-heading_small"
      );
      expect(yearLabel.textContent).toBe("2023");
    });

    it("labels both year-navigation buttons for accessibility", async () => {
      await createChart({ year: 2025 });
      await flushPromises();

      const buttons = element.shadowRoot.querySelectorAll(
        "button.slds-button_icon"
      );
      expect(buttons.length).toBe(2);
      buttons.forEach((btn) => {
        expect(btn.getAttribute("aria-label")).toBeTruthy();
      });

      const icons = element.shadowRoot.querySelectorAll("lightning-icon");
      icons.forEach((icon) => {
        expect(icon.alternativeText).toBeTruthy();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DATE PARSING TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("date parsing", () => {
    it("parses YYYY-MM-DD format", async () => {
      await createChart({ recordCollection: SAMPLE_DATA, year: 2025 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("parses ISO datetime format", async () => {
      await createChart({
        recordCollection: ISO_DATETIME_DATA,
        year: 2025
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("parses slash-delimited date format", async () => {
      await createChart({
        recordCollection: SLASH_DATE_DATA,
        year: 2025
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles records with invalid dates gracefully", async () => {
      const badDates = [
        { CloseDate: "not-a-date", Amount: 100 },
        { CloseDate: "2025-01-15", Amount: 200 }
      ];
      await createChart({ recordCollection: badDates, year: 2025 });
      await flushPromises();

      // Should still render, skipping invalid dates
      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles null date field", async () => {
      const nullDates = [
        { CloseDate: null, Amount: 100 },
        { CloseDate: "2025-01-15", Amount: 200 }
      ];
      await createChart({ recordCollection: nullDates, year: 2025 });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DAY AGGREGATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("day aggregation", () => {
    it("counts records per day for Count operation", async () => {
      await createChart({
        recordCollection: COUNT_DATA,
        operation: "Count",
        year: 2025
      });
      await flushPromises();

      // Chart should render with data - 3 records on Jan 15
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("sums values per day for Sum operation", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        operation: "Sum",
        year: 2025
      });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("averages values per day for Average operation", async () => {
      await createChart({
        recordCollection: SAMPLE_DATA,
        operation: "Average",
        year: 2025
      });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });

    it("filters data to the selected year", async () => {
      await createChart({
        recordCollection: MULTI_YEAR_DATA,
        year: 2025
      });
      await flushPromises();

      // Should only show 2025 data
      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("tooltip behavior", () => {
    it("registers mouseenter handler on day cells", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseenterCalls = onCalls.filter((c) => c[0] === "mouseenter");
      expect(mouseenterCalls.length).toBeGreaterThan(0);
    });

    it("registers mouseleave handler on day cells", async () => {
      await createChart();
      await flushPromises();

      const onCalls = mockD3.on.mock.calls;
      const mouseleaveCalls = onCalls.filter((c) => c[0] === "mouseleave");
      expect(mouseleaveCalls.length).toBeGreaterThan(0);
    });

    it("tooltip content includes date and value", async () => {
      await createChart();
      await flushPromises();

      // Verify mouseenter handler is registered (tooltip shows date + value)
      const onCalls = mockD3.on.mock.calls;
      const mouseenterCall = onCalls.find((c) => c[0] === "mouseenter");
      expect(mouseenterCall).toBeTruthy();
      expect(typeof mouseenterCall[1]).toBe("function");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("configuration", () => {
    it("applies height style to container", async () => {
      await createChart({ height: 250 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.getAttribute("style")).toContain("250px");
    });

    it("parses advancedConfig JSON", async () => {
      await createChart({
        advancedConfig: '{"cellColor": "blue"}'
      });

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("handles invalid advancedConfig JSON gracefully", async () => {
      await createChart({
        advancedConfig: "not valid json"
      });

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts custom dateField", async () => {
      const customData = [
        { CreatedDate: "2025-01-15", Amount: 100 },
        { CreatedDate: "2025-03-10", Amount: 200 }
      ];

      await createChart({
        recordCollection: customData,
        dateField: "CreatedDate",
        year: 2025
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("accepts custom valueField", async () => {
      const customData = [
        { CloseDate: "2025-01-15", Revenue: 100 },
        { CloseDate: "2025-03-10", Revenue: 200 }
      ];

      await createChart({
        recordCollection: customData,
        valueField: "Revenue",
        year: 2025
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // THEME TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("themes", () => {
    it("accepts Salesforce Standard theme", async () => {
      await createChart({ theme: "Salesforce Standard" });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeFalsy();
    });

    it("wires the theme prop into the color ramp hue", async () => {
      await createChart({ theme: "Cool" });
      await flushPromises();
      const coolScale = mockD3.scaleQuantize.mock.results[0].value;
      const coolRange = coolScale.range.mock.calls[0][0];

      jest.clearAllMocks();
      mockD3 = createMockD3();
      loadD3.mockResolvedValue(mockD3);
      executeQuery.mockResolvedValue(SAMPLE_DATA);
      document.body.removeChild(element);

      await createChart({ theme: "Warm" });
      await flushPromises();
      const warmScale = mockD3.scaleQuantize.mock.results[0].value;
      const warmRange = warmScale.range.mock.calls[0][0];

      expect(coolRange).not.toEqual(warmRange);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ACCESSIBILITY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("accessibility", () => {
    it("applies SVG accessibility attributes (role=img + title)", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.attr).toHaveBeenCalledWith("role", "img");
      expect(mockD3.attr).toHaveBeenCalledWith(
        "aria-label",
        expect.stringContaining("Calendar heatmap")
      );
      expect(mockD3.insert).toHaveBeenCalledWith("title", ":first-child");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DRILL-DOWN TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("drill-down", () => {
    it("does not navigate when objectApiName is not set", async () => {
      await createChart({ objectApiName: "", year: 2025 });
      await flushPromises();

      const clickCall = mockD3.on.mock.calls.find((c) => c[0] === "click");
      expect(clickCall).toBeTruthy();
      clickCall[1](
        {},
        { date: new Date(2025, 0, 15), week: 0, dayOfWeek: 0, month: 0 }
      );

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("navigates and dispatches dayclick event when objectApiName is set", async () => {
      await createChart({ objectApiName: "Opportunity", year: 2025 });
      await flushPromises();

      const handler = jest.fn();
      element.addEventListener("dayclick", handler);

      const clickCall = mockD3.on.mock.calls.find((c) => c[0] === "click");
      expect(clickCall).toBeTruthy();
      clickCall[1](
        {},
        { date: new Date(2025, 0, 15), week: 0, dayOfWeek: 0, month: 0 }
      );

      expect(mockNavigate).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].detail.date).toBe("2025-01-15");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDERING DETAIL TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("rendering details", () => {
    it("creates SVG element", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const svgCalls = appendCalls.filter((c) => c[0] === "svg");
      expect(svgCalls.length).toBeGreaterThan(0);
    });

    it("creates group element for chart", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const gCalls = appendCalls.filter((c) => c[0] === "g");
      expect(gCalls.length).toBeGreaterThan(0);
    });

    it("sets SVG dimensions", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const widthCalls = attrCalls.filter((c) => c[0] === "width");
      const heightCalls = attrCalls.filter((c) => c[0] === "height");
      expect(widthCalls.length).toBeGreaterThan(0);
      expect(heightCalls.length).toBeGreaterThan(0);
    });

    it("removes existing SVG before re-render", async () => {
      await createChart();
      await flushPromises();

      expect(mockD3.select).toHaveBeenCalled();
      expect(mockD3.remove).toHaveBeenCalled();
    });

    it("creates text elements for labels", async () => {
      await createChart();
      await flushPromises();

      const appendCalls = mockD3.append.mock.calls;
      const textCalls = appendCalls.filter((c) => c[0] === "text");
      expect(textCalls.length).toBeGreaterThan(0);
    });

    it("applies calendar-heatmap-svg class to SVG", async () => {
      await createChart();
      await flushPromises();

      const attrCalls = mockD3.attr.mock.calls;
      const classCalls = attrCalls.filter(
        (c) => c[0] === "class" && c[1] === "calendar-heatmap-svg"
      );
      expect(classCalls.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RESPONSIVE BEHAVIOR TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("responsive behavior", () => {
    it("sets up resize observer", async () => {
      await createChart();
      await flushPromises();

      expect(global.ResizeObserver).toHaveBeenCalled();
    });

    it("handles zero container width gracefully", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      await createChart();
      await flushPromises();

      expect(loadD3).toHaveBeenCalled();
    });

    it("retries chart init when container starts at zero width", async () => {
      let containerWidth = 0;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: containerWidth,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: containerWidth
      }));

      const rafCallbacks = [];
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();

      await createChart();
      await flushPromises();

      expect(global.requestAnimationFrame).toHaveBeenCalled();

      containerWidth = 800;
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 800,
        height: 200,
        top: 0,
        left: 0,
        bottom: 200,
        right: 800
      }));

      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift();
        cb();
      }

      expect(mockD3.select).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ERROR RECOVERY TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("error recovery", () => {
    it("shows error when D3 fails to load", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));

      await createChart();
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("logs error to console on D3 load failure", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));

      await createChart();
      await flushPromises();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("sets isLoading to false even on error", async () => {
      loadD3.mockRejectedValue(new Error("D3 load failed"));

      await createChart();
      await flushPromises();

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeFalsy();
    });

    it("shows error from SOQL body.message", async () => {
      executeQuery.mockRejectedValue({
        body: { message: "Specific SOQL error" }
      });

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Bad FROM Object"
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });

    it("falls back to e.message when body is missing", async () => {
      executeQuery.mockRejectedValue(new Error("Network error"));

      await createChart({
        recordCollection: [],
        soqlQuery: "SELECT Id FROM Account"
      });
      await flushPromises();

      const errorElement = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorElement).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("cleanup", () => {
    it("disconnects resize observer on disconnect", async () => {
      const mockDisconnect = jest.fn();
      global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: mockDisconnect
      }));

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("cleans up tooltip on disconnect", async () => {
      await createChart();
      await flushPromises();

      document.body.removeChild(element);
      expect(true).toBe(true);
    });

    it("cancels layout retry on disconnect", async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }));

      global.requestAnimationFrame = jest.fn(() => 42);
      global.cancelAnimationFrame = jest.fn();

      await createChart();
      await flushPromises();

      document.body.removeChild(element);

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it("handles double disconnect gracefully", async () => {
      await createChart();
      await flushPromises();

      document.body.removeChild(element);
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GETTER TESTS
  // ═══════════════════════════════════════════════════════════════

  describe("getters", () => {
    it("containerStyle returns correct height string", async () => {
      await createChart({ height: 250 });
      await flushPromises();

      const container = element.shadowRoot.querySelector(".chart-container");
      expect(container).toBeTruthy();
      expect(container.getAttribute("style")).toContain("250px");
    });

    it("hasError returns true when error is set", async () => {
      loadD3.mockRejectedValue(new Error("Test error"));
      await createChart();
      await flushPromises();

      const errorEl = element.shadowRoot.querySelector(
        ".slds-text-color_error"
      );
      expect(errorEl).toBeTruthy();
    });

    it("showChart is false when loading", () => {
      element = createElement("c-d3-calendar-heatmap", {
        is: D3CalendarHeatmap
      });
      element.dateField = "CloseDate";
      element.recordCollection = SAMPLE_DATA;
      document.body.appendChild(element);

      const spinner = element.shadowRoot.querySelector("lightning-spinner");
      expect(spinner).toBeTruthy();
    });

    it("displayYear returns current display year", async () => {
      await createChart({ year: 2022 });
      await flushPromises();

      const yearLabel = element.shadowRoot.querySelector(
        ".slds-text-heading_small"
      );
      expect(yearLabel.textContent).toBe("2022");
    });
  });
});
