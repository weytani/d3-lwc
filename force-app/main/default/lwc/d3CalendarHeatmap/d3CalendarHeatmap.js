// ABOUTME: D3 Calendar Heatmap Lightning Web Component.
// ABOUTME: Displays daily activity as a GitHub-contribution-style grid with year navigation.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import { prepareData, OPERATIONS, CHART_LIMITS } from "c/dataService";
import { getSequentialRamp, DEFAULT_THEME } from "c/themeService";
import {
  createTooltip,
  createResizeHandler,
  buildCalendarGrid,
  createLayoutRetry
} from "c/chartUtils";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

const MONTH_LABELS = [
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
const WEEKDAY_LABELS = [
  { day: 1, label: "Mon" },
  { day: 3, label: "Wed" },
  { day: 5, label: "Fri" }
];
const EMPTY_DAY_COLOR = "#ebedf0";
const COLOR_STEPS = 5;

export default class D3CalendarHeatmap extends LightningElement {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field containing the date value */
  @api dateField = "CloseDate";

  /** Field to aggregate (value axis) */
  @api valueField = "Amount";

  /** Aggregation operation: Count, Sum, Average */
  @api operation = OPERATIONS.COUNT;

  /** Year to display (defaults to current year in connectedCallback) */
  @api year;

  /** Chart height in pixels */
  @api height = 200;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment */
  @api filterClause = "";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track rawData = [];
  @track truncatedWarning = null;
  @track _displayYear;

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  d3 = null;
  svg = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  _layoutRetry = null;
  _config = {};
  _configParsed = false;

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  get containerStyle() {
    return `height: ${this.height}px;`;
  }

  get hasError() {
    return !!this.error;
  }

  get hasData() {
    return this.rawData && this.rawData.length > 0;
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get displayYear() {
    return String(this._displayYear);
  }

  get config() {
    if (!this._configParsed) {
      try {
        this._config = JSON.parse(this.advancedConfig || "{}");
      } catch {
        this._config = {};
      }
      this._configParsed = true;
    }
    return this._config;
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════

  async connectedCallback() {
    // Default year to current year if not set
    if (!this._displayYear) {
      this._displayYear = this.year || new Date().getFullYear();
    }

    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3CalendarHeatmap initialization error:", e);
    } finally {
      this.isLoading = false;
    }
  }

  renderedCallback() {
    if (this.showChart && !this.chartRendered) {
      this.chartRendered = this.initializeChart();
      if (!this.chartRendered && !this._layoutRetry) {
        const container = this.template.querySelector(".chart-container");
        if (container) {
          this._layoutRetry = createLayoutRetry(container, () => {
            this._layoutRetry = null;
            if (!this.chartRendered) {
              this.chartRendered = this.initializeChart();
            }
          });
        }
      }
    }
  }

  disconnectedCallback() {
    if (this._layoutRetry) {
      this._layoutRetry.cancel();
      this._layoutRetry = null;
    }
    this.cleanup();
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  async loadData() {
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.rawData = this._prepareRawData([...this.recordCollection]);
      return;
    }

    if (this.soqlQuery) {
      let fetchedData = [];
      try {
        fetchedData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      this.rawData = this._prepareRawData(fetchedData);
      return;
    }

    throw new Error(
      "No data source provided. Set recordCollection or soqlQuery."
    );
  }

  /**
   * Validates and truncates raw record data.
   * Date-based aggregation happens at render time per displayed year.
   */
  _prepareRawData(data) {
    const requiredFields = [this.dateField];

    const prepared = prepareData(data, {
      requiredFields,
      limit: CHART_LIMITS.CALENDAR_HEATMAP
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    if (prepared.truncated) {
      this.truncatedWarning = `Displaying first ${CHART_LIMITS.CALENDAR_HEATMAP.toLocaleString()} of ${prepared.originalCount} records`;
      this.showTruncationToast(prepared.originalCount);
    }

    return prepared.data;
  }

  showTruncationToast(originalCount) {
    this.dispatchEvent(
      new ShowToastEvent({
        title: "Data Truncated",
        message: `Displaying first ${CHART_LIMITS.CALENDAR_HEATMAP.toLocaleString()} of ${originalCount} records for performance`,
        variant: "warning"
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DATE AGGREGATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Parses a date string into a Date object.
   * Supports YYYY-MM-DD, ISO datetime, and MM/DD/YYYY formats.
   */
  _parseDate(dateStr) {
    if (!dateStr) return null;

    const str = String(dateStr);

    // ISO datetime: strip time component
    const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      const parts = isoMatch[1].split("-");
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }

    // MM/DD/YYYY format
    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      return new Date(
        Number(slashMatch[3]),
        Number(slashMatch[1]) - 1,
        Number(slashMatch[2])
      );
    }

    // Fallback: try native parsing
    const parsed = new Date(str);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  }

  /**
   * Formats a Date as YYYY-MM-DD string for lookup key.
   */
  _formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * Aggregates raw data by day for the given year.
   * Returns a Map<dateString, aggregatedValue>.
   */
  _aggregateByDay(year) {
    const dayMap = new Map();

    this.rawData.forEach((record) => {
      const date = this._parseDate(record[this.dateField]);
      if (!date || date.getFullYear() !== year) return;

      const key = this._formatDateKey(date);

      if (!dayMap.has(key)) {
        dayMap.set(key, { sum: 0, count: 0 });
      }
      const bucket = dayMap.get(key);
      bucket.count += 1;
      if (this.valueField && record[this.valueField] != null) {
        bucket.sum += Number(record[this.valueField]) || 0;
      }
    });

    // Resolve to final values
    const result = new Map();
    dayMap.forEach((bucket, key) => {
      let value;
      switch (this.operation) {
        case OPERATIONS.SUM:
          value = bucket.sum;
          break;
        case OPERATIONS.AVERAGE:
          value = bucket.count > 0 ? bucket.sum / bucket.count : 0;
          break;
        case OPERATIONS.COUNT:
        default:
          value = bucket.count;
      }
      result.set(key, value);
    });

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // YEAR NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  handlePrevYear() {
    this._displayYear = this._displayYear - 1;
    this.chartRendered = false;
    this._reRender();
  }

  handleNextYear() {
    this._displayYear = this._displayYear + 1;
    this.chartRendered = false;
    this._reRender();
  }

  _reRender() {
    const container = this.template.querySelector(".chart-container");
    if (!container || !this.d3) return;

    const { width } = container.getBoundingClientRect();
    if (width > 0) {
      this.renderChart(width);
      this.chartRendered = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════

  initializeChart() {
    const container = this.template.querySelector(".chart-container");
    if (!container) return false;

    const { width } = container.getBoundingClientRect();
    if (width === 0) return false;

    this.tooltip = createTooltip(container);
    this.renderChart(width);

    this.resizeHandler = createResizeHandler(
      container,
      ({ width: newWidth }) => {
        if (newWidth > 0) {
          this.renderChart(newWidth);
        }
      }
    );
    this.resizeHandler.observe();
    return true;
  }

  renderChart(containerWidth) {
    const d3 = this.d3;
    const container = this.template.querySelector(".chart-container");
    if (!container || !d3) return;

    // Clear existing SVG
    d3.select(container).select("svg").remove();

    const year = this._displayYear;
    const dayData = this._aggregateByDay(year);
    const grid = buildCalendarGrid(year);

    // Determine color hue from config or default to green
    const colorHue = this.config.cellColor || "green";
    const colorRamp = getSequentialRamp(colorHue, COLOR_STEPS);

    // Layout calculations
    const margin = { top: 20, right: 10, bottom: 10, left: 30 };
    const innerWidth = containerWidth - margin.left - margin.right;
    const cellSize = Math.max(2, Math.floor(innerWidth / 53) - 1);
    const cellPad = 1;
    const chartHeight = cellSize * 7 + cellPad * 6 + margin.top + margin.bottom + 15;

    // Color scale
    const maxVal = d3.max(Array.from(dayData.values())) || 1;
    const colorScale = d3.scaleQuantize().domain([0, maxVal]).range(colorRamp);

    // Create SVG
    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", chartHeight)
      .attr("class", "calendar-heatmap-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Day cells
    this.svg
      .selectAll(".day")
      .data(grid)
      .enter()
      .append("rect")
      .attr("class", "day")
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("x", (d) => d.week * (cellSize + cellPad))
      .attr("y", (d) => d.dayOfWeek * (cellSize + cellPad))
      .attr("rx", 2)
      .attr("fill", (d) => {
        const key = this._formatDateKey(d.date);
        const val = dayData.get(key);
        return val ? colorScale(val) : EMPTY_DAY_COLOR;
      })
      .on("mouseenter", (event, d) => {
        this._showCellTooltip(event, d, dayData);
      })
      .on("mouseleave", () => {
        this._hideTooltip();
      });

    // Month labels
    const monthBoundaries = this._getMonthBoundaries(grid);
    this.svg
      .selectAll(".month-label")
      .data(monthBoundaries)
      .enter()
      .append("text")
      .attr("class", "month-label")
      .attr("x", (d) => d.week * (cellSize + cellPad))
      .attr("y", -5)
      .text((d) => MONTH_LABELS[d.month]);

    // Weekday labels
    this.svg
      .selectAll(".weekday-label")
      .data(WEEKDAY_LABELS)
      .enter()
      .append("text")
      .attr("class", "weekday-label")
      .attr("x", -5)
      .attr("y", (d) => d.day * (cellSize + cellPad) + cellSize / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .style("font-size", "10px")
      .text((d) => d.label);
  }

  /**
   * Gets the first week number for each month (for label placement).
   */
  _getMonthBoundaries(grid) {
    const seen = new Set();
    const boundaries = [];
    for (const cell of grid) {
      if (!seen.has(cell.month)) {
        seen.add(cell.month);
        boundaries.push({ month: cell.month, week: cell.week });
      }
    }
    return boundaries;
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  _showCellTooltip(event, d, dayData) {
    if (!this.tooltip) return;

    const key = this._formatDateKey(d.date);
    const val = dayData.get(key) || 0;
    const dateStr = d.date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const content = `
      <div style="font-weight: bold; margin-bottom: 4px;">${dateStr}</div>
      <div>${val} ${this.operation === OPERATIONS.COUNT ? "activities" : this.valueField}</div>
    `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  _hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  cleanup() {
    if (this.resizeHandler) {
      this.resizeHandler.disconnect();
      this.resizeHandler = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
