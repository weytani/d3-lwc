/**
 * ABOUTME: D3 Sorted Bar Chart Lightning Web Component.
 * ABOUTME: Displays aggregated data as vertical bars that can be re-sorted by label or value, with drill-down support.
 */
import { LightningElement, api, track, wire } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateData,
  OPERATIONS,
  MAX_RECORDS
} from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  truncateLabel,
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
import {
  buildAggregateQuery,
  buildRecordQuery,
  normalizeAggregate,
  normalizeRecords
} from "c/graphqlService";

const SORT_BY_VALUES = ["label", "value"];
const SORT_DIRECTION_VALUES = ["asc", "desc"];

export default class D3SortedBarChart extends NavigationMixin(
  LightningElement
) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "SELECT StageName, Amount FROM Opportunity";

  /** Field to group by (category axis) */
  @api groupByField = "StageName";

  /** Field to aggregate (value axis) */
  @api valueField = "Amount";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down (usually same as groupByField) */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side aggregation */
  @api filterClause = "";

  /** Fetch-mode selector: "auto" (default, existing priority order), "apex", or "graphql". */
  @api fetchMode = "auto";

  /** Structured filter for the GraphQL path: { field, operator, value }. */
  @api graphqlFilter;

  /**
   * Sort key: "label" (alphabetical) or "value" (numeric). Setting this after
   * the chart has rendered re-sorts and redraws immediately, without
   * refetching data.
   */
  @api
  get sortBy() {
    return this._sortBy;
  }
  set sortBy(value) {
    this._sortBy = SORT_BY_VALUES.includes(value) ? value : "value";
    this._resortIfRendered();
  }

  /**
   * Sort direction: "asc" or "desc". Setting this after the chart has
   * rendered re-sorts and redraws immediately, without refetching data.
   */
  @api
  get sortDirection() {
    return this._sortDirection;
  }
  set sortDirection(value) {
    this._sortDirection = SORT_DIRECTION_VALUES.includes(value)
      ? value
      : "desc";
    this._resortIfRendered();
  }

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track chartData = [];

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  _sortBy = "value";
  _sortDirection = "desc";
  _lastContainerWidth = 0;

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
    return this.chartData && this.chartData.length > 0;
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

  get effectiveShowLegend() {
    return !!this.config.showLegend;
  }

  /** Legend placement: "bottom" (default, wraps under the chart) or "right" (sidebar). */
  get legendPosition() {
    return this.config.legendPosition === "right" ? "right" : "bottom";
  }

  get chartWrapperClass() {
    return this.legendPosition === "right"
      ? "chart-wrapper chart-wrapper_row"
      : "chart-wrapper chart-wrapper_column";
  }

  get legendContainerClass() {
    return this.legendPosition === "right"
      ? "legend-container legend-container_right"
      : "legend-container legend-container_bottom";
  }

  get legendItems() {
    if (!this.chartData || !this.effectiveShowLegend) return [];
    const colorMap = this._getColorMap();
    return this._getSortedData().map((d) => ({
      label: d.label,
      value: d.value,
      color: colorMap.get(d.label),
      colorStyle: `background-color: ${colorMap.get(d.label)};`
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // SORTING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Returns a re-ordered copy of chartData per the current sortBy/sortDirection,
   * without mutating chartData or re-fetching. Ascending sort is computed first
   * (by label localeCompare, or by numeric value), then reversed for "desc" —
   * this keeps both sort keys' comparators simple and symmetric.
   */
  _getSortedData() {
    const data = [...this.chartData];
    if (this._sortBy === "label") {
      data.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    } else {
      data.sort((a, b) => a.value - b.value);
    }
    if (this._sortDirection !== "asc") {
      data.reverse();
    }
    return data;
  }

  /**
   * Maps each entity's label to a stable color, assigned once from chartData's
   * original (load) order. Re-sorting only changes bar position — never color —
   * so a given category keeps the same color across every sort order.
   */
  _getColorMap() {
    const colors = getColors(
      this.theme,
      this.chartData.length,
      this.config.customColors
    );
    const map = new Map();
    this.chartData.forEach((d, i) => map.set(d.label, colors[i]));
    return map;
  }

  /**
   * Re-orders the already-rendered bars in place (no Apex/SOQL/GraphQL refetch,
   * no SVG teardown) when sortBy/sortDirection change after the initial render.
   * Bars slide via d3.transition() to their new x position on the existing
   * scaleBand/axis; a full renderChart() (used for the initial render and on
   * resize) is not needed since the data and colors haven't changed.
   */
  _resortIfRendered() {
    if (!this.chartRendered || !this.d3 || !this.svg) return;
    const d3 = this.d3;

    const margin = {
      top: 20,
      right: 20,
      bottom: this.config.showGrid !== false ? 60 : 40,
      left: 60
    };
    const width = this._lastContainerWidth - margin.left - margin.right;
    if (width <= 0) return;

    const sortedData = this._getSortedData();
    const xScale = d3
      .scaleBand()
      .domain(sortedData.map((d) => d.label))
      .range([0, width])
      .padding(0.2);

    this.svg
      .selectAll(".bar")
      .data(sortedData, (d) => d.label)
      .transition()
      .duration(750)
      .attr("x", (d) => xScale(d.label));

    this.svg
      .select(".x-axis")
      .transition()
      .duration(750)
      .call(d3.axisBottom(xScale).tickFormat((d) => truncateLabel(d, 12)));
  }

  // ═══════════════════════════════════════════════════════════════
  // GRAPHQL SELF-FETCH PATH (Approach A — additive)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reactive GraphQL query for the self-fetch path. Returns undefined (so the wire
   * is skipped) unless fetchMode is "graphql" and all required config is present.
   */
  get gqlQuery() {
    if (this.fetchMode !== "graphql") return undefined;
    if (!this.objectApiName || !this.groupByField || !this.operation) {
      return undefined;
    }
    // valueField is not required for Count.
    if (this.operation !== OPERATIONS.COUNT && !this.valueField) {
      return undefined;
    }
    let queryString;
    try {
      if (this.operation === OPERATIONS.COUNT) {
        queryString = buildRecordQuery({
          objectApiName: this.objectApiName,
          fields: [this.groupByField],
          filter: this.graphqlFilter,
          first: this.recordLimit || 2000
        });
      } else {
        queryString = buildAggregateQuery({
          objectApiName: this.objectApiName,
          groupByField: this.groupByField,
          valueField: this.valueField,
          operation: this.operation,
          filter: this.graphqlFilter,
          first: this.recordLimit || 2000
        });
      }
    } catch {
      // Unsupported operation/config: leave the wire un-provisioned; error surfaces below.
      return undefined;
    }
    return gql`
      ${queryString}
    `;
  }

  @wire(graphql, { query: "$gqlQuery" })
  wiredAggregate({ data, errors }) {
    if (this.fetchMode !== "graphql") return;
    if (errors) {
      this.error = this._formatGqlErrors(errors);
      this.isLoading = false;
      return;
    }
    if (!data) return; // initial undefined emission
    try {
      let normalized;
      if (this.operation === OPERATIONS.COUNT) {
        const records = normalizeRecords(data, {
          objectApiName: this.objectApiName,
          labelField: this.groupByField
        });
        normalized = this._aggregateRawData(
          records.map((r) => ({ [this.groupByField]: r.label }))
        );
      } else {
        normalized = normalizeAggregate(data, {
          objectApiName: this.objectApiName,
          groupByField: this.groupByField,
          valueField: this.valueField,
          operation: this.operation
        });
      }
      if (!normalized.length) {
        this.error = "No data after aggregation";
      } else {
        this.chartData = normalized;
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
    try {
      // Load D3
      this.d3 = await loadD3(this);

      // Load data
      await this.loadData();

      // Render will happen in renderedCallback after DOM is ready
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3SortedBarChart initialization error:", e);
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

    // Priority 1: Use recordCollection if provided (client-side aggregation)
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.chartData = this._aggregateRawData([...this.recordCollection]);
      return;
    }

    // Priority 2: Server-side aggregation when all required fields are set
    if (
      this.objectApiName &&
      this.groupByField &&
      this.valueField &&
      this.operation
    ) {
      try {
        const result = await getAggregatedData({
          objectName: this.objectApiName,
          groupByField: this.groupByField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
        // Server returns [{label, value}, ...] — same shape as aggregateData()
        this.chartData = result;
      } catch (e) {
        throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
      }

      if (!this.chartData || this.chartData.length === 0) {
        throw new Error("No data after aggregation");
      }
      return;
    }

    // Priority 3: Fall back to SOQL query with client-side aggregation
    if (this.soqlQuery) {
      let rawData = [];
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      this.chartData = this._aggregateRawData(rawData);
      return;
    }

    throw new Error(
      "No data source provided. Set recordCollection or soqlQuery."
    );
  }

  /**
   * Validates, truncates, and aggregates raw record data client-side.
   * Used by both recordCollection and soqlQuery paths.
   */
  _aggregateRawData(rawData) {
    // Validate required fields
    const requiredFields = [this.groupByField];
    if (this.operation !== OPERATIONS.COUNT) {
      requiredFields.push(this.valueField);
    }

    // Prepare data (validate + truncate)
    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || MAX_RECORDS
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    // Aggregate data
    const aggregated = aggregateData(
      prepared.data,
      this.groupByField,
      this.valueField,
      this.operation
    );

    if (aggregated.length === 0) {
      throw new Error("No data after aggregation");
    }

    return aggregated;
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

    // Create tooltip
    this.tooltip = createTooltip(container);

    // Render chart
    this.renderChart(width);

    // Setup resize observer
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

    this._lastContainerWidth = containerWidth;

    // Clear existing SVG
    d3.select(container).select("svg").remove();

    // Sort a copy of chartData per the current sortBy/sortDirection — the
    // original chartData (and its load order) is never mutated, so re-sorting
    // never needs a refetch.
    const sortedData = this._getSortedData();

    // Margins
    const margin = {
      top: 20,
      right: 20,
      bottom: this.config.showGrid !== false ? 60 : 40,
      left: 60
    };

    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    // Create SVG
    const svgRoot = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "sorted-bar-chart-svg");

    applySvgA11y(svgRoot, {
      title: `Sorted bar chart: ${this.operation} of ${this.valueField} by ${this.groupByField}, sorted by ${this._sortBy} (${this._sortDirection})`,
      desc: `${sortedData.length} categories`
    });

    this.svg = svgRoot
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(sortedData.map((d) => d.label))
      .range([0, width])
      .padding(0.2);

    const yMax = d3.max(sortedData, (d) => d.value) || 0;
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.1]) // 10% headroom
      .nice()
      .range([height, 0]);

    // Colors — stable per entity (see _getColorMap), so re-sorting never
    // reassigns a category's color, only its position.
    const colorMap = this._getColorMap();

    // Grid lines (optional)
    if (this.config.showGrid !== false) {
      this.svg
        .append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "2,2");

      this.svg.select(".grid .domain").remove();
    }

    // X Axis
    const xAxis = this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => truncateLabel(d, 12)));

    // Rotate labels if many bars
    if (sortedData.length > 6) {
      xAxis
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .attr("dx", "-0.5em")
        .attr("dy", "0.5em");
    }

    // Y Axis
    this.svg
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).tickFormat((d) => formatNumber(d)));

    // Bars
    const bars = this.svg
      .selectAll(".bar")
      .data(sortedData, (d) => d.label)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(d.label))
      .attr("width", xScale.bandwidth())
      .attr("y", height) // Start from bottom for animation
      .attr("height", 0)
      .attr("fill", (d) => colorMap.get(d.label))
      .attr("rx", 2) // Rounded corners
      .attr("cursor", this.objectApiName ? "pointer" : "default");

    // Animate bars
    bars
      .transition()
      .duration(750)
      .delay((d, i) => i * 50)
      .attr("y", (d) => yScale(d.value))
      .attr("height", (d) => height - yScale(d.value));

    // Tooltip interactions
    bars
      .on("mouseenter", (event, d) => {
        this.showTooltip(event, d);
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 0.8);
      })
      .on("mousemove", (event) => {
        this.moveTooltip(event);
      })
      .on("mouseleave", (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 1);
      })
      .on("click", (event, d) => {
        this.handleBarClick(d);
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, d) {
    if (!this.tooltip) return;

    const content = buildTooltipContent(d.label, d.value, {
      prefix: `${this.operation || "Value"}: `
    });

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  // eslint-disable-next-line no-unused-vars
  moveTooltip(event) {
    // Tooltip position is set in show(), but we can update it here if needed
    // The current implementation handles positioning in show()
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleBarClick(d) {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.groupByField;

    // Navigate to list view with filter
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

    // Dispatch custom event for parent components to handle filtering
    this.dispatchEvent(
      new CustomEvent("barclick", {
        detail: {
          label: d.label,
          value: d.value,
          filterField: filterFieldName
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LEGEND CLICK
  // ═══════════════════════════════════════════════════════════════

  handleLegendClick(event) {
    const label = event.currentTarget.dataset.label;
    const item = this.chartData.find((d) => d.label === label);
    if (item) {
      this.handleBarClick(item);
    }
  }

  /** Activates a legend item via keyboard (Enter/Space), matching the click behavior. */
  handleLegendKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.handleLegendClick(event);
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
