// ABOUTME: D3 Heatmap Lightning Web Component.
// ABOUTME: Displays a 2D categorical grid with color intensity mapping using sequential color ramps.
import { LightningElement, api, track, wire } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateSeriesData,
  OPERATIONS,
  MAX_RECORDS
} from "c/dataService";
import {
  getSequentialRamp,
  getRampHueForTheme,
  DEFAULT_THEME
} from "c/themeService";
import {
  formatNumber,
  truncateLabel,
  createTooltip,
  createResizeHandler,
  createLayoutRetry,
  getContrastColor,
  applySvgA11y
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";
import { gql, graphql } from "lightning/graphql";
import {
  buildRecordQuery,
  normalizeRecordsGeneric,
  buildMultiGroupQuery,
  normalizeMultiGroup
} from "c/graphqlService";

const COLOR_STEPS = 9;

export default class D3Heatmap extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "SELECT StageName, Type, Amount FROM Opportunity";

  /** Field for column categories (x-axis) */
  @api xField = "";

  /** Field for row categories (y-axis) */
  @api yField = "";

  /** Field to aggregate (value) */
  @api valueField = "Amount";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 400;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Maximum records to process (leave empty for default) */
  @api recordLimit;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down (defaults to xField) */
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
  @track chartData = [];
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

  // ═══════════════════════════════════════════════════════════════
  // GRAPHQL SELF-FETCH PATH (Approach A — additive, CT-MG)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reactive GraphQL query for the self-fetch path. Returns undefined (so the wire
   * is skipped) unless fetchMode is "graphql" and objectApiName/xField/yField/operation
   * are set. Count branch: server aggregate has no Count, so it fetches bounded raw
   * xField+yField records instead (fed through the existing _aggregateRawData path,
   * which already handles Count client-side). Sum/Average/Min/Max: two-field
   * grouped aggregate via buildMultiGroupQuery.
   */
  get gqlQuery() {
    if (this.fetchMode !== "graphql") return undefined;
    if (
      !this.objectApiName ||
      !this.xField ||
      !this.yField ||
      !this.operation
    ) {
      return undefined;
    }
    let queryString;
    try {
      if (this.operation === OPERATIONS.COUNT) {
        queryString = buildRecordQuery({
          objectApiName: this.objectApiName,
          fields: [...new Set([this.xField, this.yField])],
          filter: this.graphqlFilter,
          first: this.recordLimit || 2000
        });
      } else {
        if (!this.valueField) return undefined;
        queryString = buildMultiGroupQuery({
          objectApiName: this.objectApiName,
          groupByField: this.xField,
          seriesField: this.yField,
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
  wiredMultiGroup({ data, errors }) {
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
        const records = normalizeRecordsGeneric(data, {
          objectApiName: this.objectApiName,
          fields: [...new Set([this.xField, this.yField])]
        });
        normalized = this._aggregateRawData(records);
      } else {
        normalized = normalizeMultiGroup(data, {
          objectApiName: this.objectApiName,
          groupByField: this.xField,
          seriesField: this.yField,
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
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3Heatmap initialization error:", e);
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
      this.xField &&
      this.yField &&
      this.valueField &&
      this.operation
    ) {
      try {
        const result = await getMultiGroupData({
          objectName: this.objectApiName,
          groupByField: this.xField,
          seriesField: this.yField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
        // Server returns [{label, series, value}, ...] — same shape as aggregateSeriesData()
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
   * Uses aggregateSeriesData to produce { label, series, value } results.
   */
  _aggregateRawData(rawData) {
    // Validate required fields
    const requiredFields = [this.xField, this.yField];
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

    // Aggregate using series-aware function: xField=groupBy, yField=series
    const aggregated = aggregateSeriesData(
      prepared.data,
      this.xField,
      this.yField,
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

    // Clear existing SVG
    d3.select(container).select("svg").remove();

    // Extract unique x-labels (columns) and y-labels (rows)
    const xLabels = [...new Set(this.chartData.map((d) => d.label))];
    const yLabels = [...new Set(this.chartData.map((d) => d.series))];

    // Margins
    const margin = {
      top: 20,
      right: 20,
      bottom: xLabels.length > 6 ? 80 : 50,
      left: 80
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
      .attr("class", "heatmap-svg");

    applySvgA11y(svgRoot, {
      title: `Heatmap: ${this.operation} of ${this.valueField} by ${this.xField} and ${this.yField}`,
      desc: `${xLabels.length} columns by ${yLabels.length} rows`
    });

    this.svg = svgRoot
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(xLabels)
      .range([0, width])
      .padding(0.05);

    const yScale = d3
      .scaleBand()
      .domain(yLabels)
      .range([0, height])
      .padding(0.05);

    // Color ramp. An explicit config.rampHue always wins (backward-compat with
    // pages set up before theme wiring existed). When rampHue is unset, a
    // non-default theme picks its own ramp via getRampHueForTheme; the default
    // theme falls back to the historical hardcoded "blue" ramp.
    const rampHue =
      this.config.rampHue ||
      (this.theme && this.theme !== DEFAULT_THEME
        ? getRampHueForTheme(this.theme)
        : "blue");
    const rampColors = getSequentialRamp(rampHue, COLOR_STEPS);

    // Build a lookup map for cell values, filling gaps with 0
    const cellMap = new Map();
    this.chartData.forEach((d) => {
      cellMap.set(`${d.label}|||${d.series}`, d.value);
    });

    // Build full grid data (fill sparse cells with 0)
    const gridData = [];
    xLabels.forEach((x) => {
      yLabels.forEach((y) => {
        const key = `${x}|||${y}`;
        gridData.push({
          label: x,
          series: y,
          value: cellMap.get(key) || 0
        });
      });
    });

    // Color scale
    const valueExtent = d3.extent(gridData, (d) => d.value);
    const colorScale = d3.scaleQuantize().domain(valueExtent).range(rampColors);

    // X Axis
    const xAxis = this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => truncateLabel(d, 12)));

    // Rotate labels if many columns
    if (xLabels.length > 6) {
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
      .call(d3.axisLeft(yScale).tickFormat((d) => truncateLabel(d, 12)));

    // Draw cells
    const cells = this.svg
      .selectAll(".cell")
      .data(gridData)
      .enter()
      .append("g")
      .attr("class", "cell");

    // Cell rectangles
    cells
      .append("rect")
      .attr("class", "heatmap-cell")
      .attr("x", (d) => xScale(d.label))
      .attr("y", (d) => yScale(d.series))
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", (d) => colorScale(d.value))
      .attr("rx", 2)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .attr("opacity", 0)
      .transition()
      .duration(500)
      .delay((d, i) => i * 10)
      .attr("opacity", 1);

    // Cell text labels
    cells
      .append("text")
      .attr("class", "cell-text")
      .attr("x", (d) => xScale(d.label) + xScale.bandwidth() / 2)
      .attr("y", (d) => yScale(d.series) + yScale.bandwidth() / 2)
      .text((d) => formatNumber(d.value))
      .attr("fill", (d) => getContrastColor(colorScale(d.value)))
      .style("font-size", "11px")
      .style("text-anchor", "middle")
      .style("dominant-baseline", "central");

    // Tooltip and click interactions on cell rects
    cells
      .selectAll("rect")
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
        this.handleCellClick(d);
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, d) {
    if (!this.tooltip) return;

    const content = `
      <div style="font-weight: bold; margin-bottom: 4px;">X: ${d.label}</div>
      <div style="margin-bottom: 2px;">Y: ${d.series}</div>
      <div>Value: ${formatNumber(d.value)}</div>
    `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  // eslint-disable-next-line no-unused-vars
  moveTooltip(event) {
    // Tooltip position is set in show()
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleCellClick(d) {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.xField;

    // Navigate to list view
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

    // Dispatch custom event for parent components
    this.dispatchEvent(
      new CustomEvent("cellclick", {
        detail: {
          label: d.label,
          series: d.series,
          value: d.value,
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
