// ABOUTME: D3 Progress Bar chart Lightning Web Component.
// ABOUTME: Renders a single KPI value as a horizontal track filled to value/target with an optional target marker and percent label.
import { LightningElement, api, track, wire } from "lwc";
import { loadD3 } from "c/d3Lib";
import { getColor } from "c/themeService";
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  createTooltip,
  createResizeHandler,
  buildTooltipContent,
  createLayoutRetry,
  applySvgA11y
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import { gql, graphql } from "lightning/graphql";
import { buildRecordQuery, normalizeRecordsGeneric } from "c/graphqlService";

// Track background color (light gray)
const TRACK_COLOR = "#e0e0e0";

export default class D3ProgressBar extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field containing the numeric value */
  @api valueField = "Amount";

  /** Chart height in pixels */
  @api height = 80;

  /** Color theme for the progress fill */
  @api theme = "Salesforce Standard";

  /** Advanced configuration JSON (supports target, label, valueFormat, customColors) */
  @api advancedConfig = "";

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side aggregation */
  @api filterClause = "";

  /** Fetch-mode selector: "auto" (default, existing priority order), "apex", or "graphql". */
  @api fetchMode = "auto";

  /** Structured filter for the GraphQL path: { field, operator, value }. */
  @api graphqlFilter;

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track currentValue = 0;

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
    // Progress bar always has data if we got past loading without error
    // (even a zero value is valid)
    return !this.error && this.d3 !== null;
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
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

  get valueFormatter() {
    const format = this.config.valueFormat || "number";
    switch (format) {
      case "currency":
        return formatCurrency;
      default:
        return formatNumber;
    }
  }

  get effectiveTarget() {
    const target = this.config.target;
    if (target !== undefined && target !== null && Number(target) > 0) {
      return Number(target);
    }
    return 100;
  }

  // ═══════════════════════════════════════════════════════════════
  // GRAPHQL SELF-FETCH PATH (Approach A — additive, CT-REC)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reactive GraphQL query for the self-fetch path. Returns undefined (so the wire
   * is skipped) unless fetchMode is "graphql" and objectApiName/valueField are set.
   * PROGRESS_BAR has no per-chart CHART_LIMITS cap (null — server GROUP BY, single
   * row), so this uses the general 2000 bounded fallback rather than a chart-specific
   * constant.
   */
  get gqlQuery() {
    if (this.fetchMode !== "graphql") return undefined;
    if (!this.objectApiName || !this.valueField) return undefined;
    let queryString;
    try {
      queryString = buildRecordQuery({
        objectApiName: this.objectApiName,
        fields: [this.valueField],
        filter: this.graphqlFilter,
        first: 2000
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
  wiredRecord({ data, errors }) {
    if (this.fetchMode !== "graphql") return;
    if (errors) {
      this.error = this._formatGqlErrors(errors);
      this.isLoading = false;
      return;
    }
    if (!data) return; // initial undefined emission
    try {
      const records = normalizeRecordsGeneric(data, {
        objectApiName: this.objectApiName,
        fields: [this.valueField]
      });
      this.processData(records);
      this.error = null;
      this.chartRendered = false; // force renderedCallback to re-initialize the SVG
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
    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3ProgressBar initialization error:", e);
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

    // Priority 1: Use recordCollection if provided (take first record's value)
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.processData(this.recordCollection);
      return;
    }

    // Priority 2: Server-side aggregation when objectApiName and valueField are set
    if (this.objectApiName && this.valueField) {
      try {
        const result = await getAggregatedData({
          objectName: this.objectApiName,
          groupByField: "Id",
          valueField: this.valueField,
          operation: "Average",
          filterClause: this.filterClause || null
        });
        if (result && result.length > 0) {
          this.currentValue = Number(result[0].value) || 0;
        }
      } catch (e) {
        throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
      }
      return;
    }

    // Priority 3: Fall back to SOQL query
    if (this.soqlQuery) {
      let rawData = [];
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      this.processData(rawData);
      return;
    }

    // No data source provided. A progress bar at 0% is a valid state, so
    // render a zero-value bar as long as a valueField is configured. Without
    // a valueField there is nothing to measure, which is a configuration error.
    if (!this.valueField) {
      throw new Error(
        "No data source provided. Set recordCollection or soqlQuery."
      );
    }
    this.currentValue = 0;
  }

  /**
   * Extracts the numeric value from the first record.
   */
  processData(records) {
    if (!records || records.length === 0) {
      this.currentValue = 0;
      return;
    }
    const record = records[0];
    const rawValue = this.valueField ? record[this.valueField] : undefined;
    this.currentValue = Number(rawValue) || 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initializes the chart SVG, tooltip, and resize observer.
   * @returns {boolean} true if the chart was successfully initialized
   */
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

    // Clear existing SVG (idempotent — runs on init and every resize)
    d3.select(container).select("svg").remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 20 };
    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const config = this.config;
    const target = this.effectiveTarget;

    // ARIA progressbar semantics on the persistent (lwc:dom="manual")
    // container — the D3-rendered svg/rects are torn down and rebuilt on
    // every render, so the container is the only stable place to hold these.
    container.setAttribute("role", "progressbar");
    container.setAttribute("aria-valuemin", "0");
    container.setAttribute("aria-valuemax", String(target));
    container.setAttribute("aria-valuenow", String(this.currentValue));

    const svgRoot = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "progress-bar-svg");

    applySvgA11y(svgRoot, {
      title: `Progress: ${this.valueFormatter(this.currentValue)} of ${this.valueFormatter(target)}`,
      desc: `${formatPercent(target > 0 ? this.currentValue / target : 0)} complete`
    });

    this.svg = svgRoot
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Linear scale: value domain [0, target] mapped to track width
    const xScale = d3
      .scaleLinear()
      .domain([0, target])
      .range([0, width])
      .clamp(true);

    const trackHeight = Math.max(height * 0.4, 8);
    const trackY = (height - trackHeight) / 2;

    // Full-width track rect (background)
    this.svg
      .append("rect")
      .attr("class", "progress-track")
      .attr("x", 0)
      .attr("y", trackY)
      .attr("width", width)
      .attr("height", trackHeight)
      .attr("rx", 4)
      .attr("fill", TRACK_COLOR);

    // Value rect: width = value/target fraction of the track
    const fillColor = this._getFillColor();
    this.svg
      .append("rect")
      .attr("class", "progress-value")
      .attr("x", 0)
      .attr("y", trackY)
      .attr("width", 0)
      .attr("height", trackHeight)
      .attr("rx", 4)
      .attr("fill", fillColor)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .transition()
      .duration(750)
      .attr("width", xScale(this.currentValue));

    // Optional target marker line
    if (config.target !== undefined && config.target !== null) {
      this.svg
        .append("line")
        .attr("class", "progress-target")
        .attr("x1", xScale(target))
        .attr("x2", xScale(target))
        .attr("y1", trackY - 4)
        .attr("y2", trackY + trackHeight + 4)
        .attr("stroke", "#333")
        .attr("stroke-width", 2);
    }

    // Percent label (formatPercent takes a 0..1 decimal)
    const fraction = target > 0 ? this.currentValue / target : 0;
    this.svg
      .append("text")
      .attr("class", "progress-label")
      .attr("x", width)
      .attr("y", trackY - 6)
      .attr("text-anchor", "end")
      .text(formatPercent(fraction));

    // Tooltip + click interactions on the value rect
    this.svg
      .selectAll(".progress-value")
      .on("mouseenter", (event) => {
        this.showTooltip(event);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      })
      .on("click", () => {
        this.handleBarClick();
      });
  }

  /**
   * Returns the fill color for the value rect, respecting customColors override.
   */
  _getFillColor() {
    const config = this.config;
    if (
      config.customColors &&
      Array.isArray(config.customColors) &&
      config.customColors.length > 0
    ) {
      return config.customColors[0];
    }
    return getColor(this.theme, 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event) {
    if (!this.tooltip) return;
    const config = this.config;
    const label = config.label || this.valueField || "Value";
    const content = buildTooltipContent(label, this.currentValue, {
      formatter: this.valueFormatter
    });
    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleBarClick() {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.valueField;

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
      new CustomEvent("progressclick", {
        detail: {
          value: this.currentValue,
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
