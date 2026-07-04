// ABOUTME: D3 Calendar Heatmap Lightning Web Component.
// ABOUTME: Displays daily activity as a GitHub-contribution-style grid with year navigation.
import { LightningElement, api, track, wire } from "lwc";
import { loadD3 } from "c/d3Lib";
import { prepareData, OPERATIONS, CHART_LIMITS } from "c/dataService";
import {
  getSequentialRamp,
  getRampHueForTheme,
  DEFAULT_THEME
} from "c/themeService";
import {
  createTooltip,
  createResizeHandler,
  buildCalendarGrid,
  createLayoutRetry,
  applySvgA11y
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import { gql, graphql } from "lightning/graphql";
import { buildRecordQuery, normalizeRecordsGeneric } from "c/graphqlService";

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

export default class D3CalendarHeatmap extends NavigationMixin(
  LightningElement
) {
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

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  /** Fetch-mode selector: "auto" (default, existing priority order), "apex", or "graphql". */
  @api fetchMode = "auto";

  /** Structured filter for the GraphQL path: { field, operator, value }. */
  @api graphqlFilter;

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track rawData = [];
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
  // GRAPHQL SELF-FETCH PATH (Approach A — additive, CT-REC)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reactive GraphQL query for the self-fetch path. Returns undefined (so the
   * wire is skipped) unless fetchMode is "graphql" and objectApiName/dateField
   * are set. Calendar heatmap has no server-side aggregate: it always fetches
   * raw records for dateField and (if set) valueField, then feeds the existing
   * recordCollection processing path (_prepareRawData + per-render day
   * aggregation), same as recordCollection/soqlQuery.
   */
  get gqlQuery() {
    if (this.fetchMode !== "graphql") return undefined;
    if (!this.objectApiName || !this.dateField) return undefined;
    const fields = [
      ...new Set([this.dateField, this.valueField].filter(Boolean))
    ];
    let queryString;
    try {
      queryString = buildRecordQuery({
        objectApiName: this.objectApiName,
        fields,
        filter: this.graphqlFilter,
        first: this.recordLimit || 2000
      });
    } catch {
      // Unsupported config: leave the wire un-provisioned; error surfaces below.
      return undefined;
    }
    return gql`
      ${queryString}
    `;
  }

  @wire(graphql, { query: "$gqlQuery" })
  wiredRecords({ data, errors }) {
    if (this.fetchMode !== "graphql") return;
    if (errors) {
      this.error = this._formatGqlErrors(errors);
      this.isLoading = false;
      return;
    }
    if (!data) return; // initial undefined emission
    try {
      const fields = [
        ...new Set([this.dateField, this.valueField].filter(Boolean))
      ];
      const records = normalizeRecordsGeneric(data, {
        objectApiName: this.objectApiName,
        fields
      });
      this.rawData = this._prepareRawData(records);
      if (this.rawData.length === 0) {
        this.error = "No data after aggregation";
      } else {
        this.error = null;
        this.chartRendered = false; // force renderedCallback to re-initialize the SVG
      }
    } catch (e) {
      this.error = e.message;
    }
    this.isLoading = false;
  }

  _formatGqlErrors(errors) {
    const list = Array.isArray(errors) ? errors : [errors];
    return list.map((e) => e?.message || e).join("; ") || "GraphQL error";
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
    // GraphQL path is handled reactively by the @wire(graphql) — nothing to do here.
    if (this.fetchMode === "graphql") {
      return;
    }

    if (this.recordCollection && this.recordCollection.length > 0) {
      this.rawData = this._prepareRawData([...this.recordCollection]);
      return;
    }

    if (this.soqlQuery) {
      let fetchedData = [];
      try {
        fetchedData = await executeQuery({
          queryString: this._applyFilterClause(this.soqlQuery)
        });
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
   * Injects filterClause as a WHERE-clause fragment into a raw SOQL query
   * string, ahead of any ORDER BY / GROUP BY / LIMIT clause. Appends with
   * AND if the query already has a WHERE; otherwise adds one. No-op when
   * filterClause is blank.
   * @param {String} soqlQuery - The base SOQL query
   * @returns {String} - The query with filterClause applied
   */
  _applyFilterClause(soqlQuery) {
    if (!this.filterClause) return soqlQuery;

    const fragment = /\bWHERE\b/i.test(soqlQuery)
      ? ` AND (${this.filterClause})`
      : ` WHERE (${this.filterClause})`;

    const trailingClause = soqlQuery.match(/\b(ORDER BY|GROUP BY|LIMIT)\b/i);
    if (trailingClause) {
      const idx = trailingClause.index;
      return `${soqlQuery.slice(0, idx).trimEnd()}${fragment} ${soqlQuery.slice(idx)}`;
    }
    return `${soqlQuery}${fragment}`;
  }

  /**
   * Validates and truncates raw record data.
   * Date-based aggregation happens at render time per displayed year.
   */
  _prepareRawData(data) {
    const requiredFields = [this.dateField];

    const prepared = prepareData(data, {
      requiredFields,
      limit: this.recordLimit || CHART_LIMITS.CALENDAR_HEATMAP
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    return prepared.data;
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

    // Determine color hue: advancedConfig.cellColor wins, else derive from theme
    const colorHue = this.config.cellColor || getRampHueForTheme(this.theme);
    const colorRamp = getSequentialRamp(colorHue, COLOR_STEPS);

    // Layout calculations
    const margin = { top: 20, right: 10, bottom: 10, left: 30 };
    const innerWidth = containerWidth - margin.left - margin.right;
    const cellSize = Math.max(2, Math.floor(innerWidth / 53) - 1);
    const cellPad = 1;
    const chartHeight =
      cellSize * 7 + cellPad * 6 + margin.top + margin.bottom + 15;

    // Color scale
    const maxVal = d3.max(Array.from(dayData.values())) || 1;
    const colorScale = d3.scaleQuantize().domain([0, maxVal]).range(colorRamp);

    // Create SVG
    const svgRoot = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", chartHeight)
      .attr("class", "calendar-heatmap-svg");

    applySvgA11y(svgRoot, {
      title: `Calendar heatmap: ${this.operation} of ${this.valueField} by ${this.dateField}, ${year}`,
      desc: `${dayData.size} active days`
    });

    this.svg = svgRoot
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
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .on("mouseenter", (event, d) => {
        this._showCellTooltip(event, d, dayData);
      })
      .on("mouseleave", () => {
        this._hideTooltip();
      })
      .on("click", (event, d) => {
        this.handleDayClick(d, dayData);
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
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleDayClick(d, dayData) {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.dateField;
    const key = this._formatDateKey(d.date);
    const val = dayData.get(key) || 0;

    this[NavigationMixin.Navigate]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.objectApiName,
        actionName: "list"
      },
      state: {
        filterName: "Recent"
      }
    });

    this.dispatchEvent(
      new CustomEvent("dayclick", {
        detail: {
          date: key,
          value: val,
          filterField: filterFieldName
        },
        bubbles: true,
        composed: true
      })
    );
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
