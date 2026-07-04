// ABOUTME: D3 Pie chart Lightning Web Component with drill-down support.
// ABOUTME: Renders part-to-whole data as a full pie (no inner radius) using themes, legends, and tooltips.
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
  formatPercent,
  createTooltip,
  createResizeHandler,
  createLayoutRetry,
  applySvgA11y
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import { gql, graphql } from "lightning/graphql";
import {
  buildAggregateQuery,
  normalizeAggregate,
  buildRecordQuery,
  normalizeRecords
} from "c/graphqlService";

export default class D3PieChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field to group by (slice categories) */
  @api groupByField = "";

  /** Field to aggregate (slice values) */
  @api valueField = "";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Show legend (defaults to true via getter) */
  @api showLegend;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

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
  @track chartData = [];
  @track totalValue = 0;

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

  get effectiveShowLegend() {
    return this.showLegend !== false;
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

  get legendItems() {
    if (!this.chartData || !this.effectiveShowLegend) return [];
    const colors = getColors(
      this.theme,
      this.chartData.length,
      this.config.customColors
    );
    return this.chartData.map((d, i) => ({
      label: d.label,
      value: d.value,
      percent:
        this.totalValue > 0 ? formatPercent(d.value / this.totalValue) : "0%",
      color: colors[i],
      colorStyle: `background-color: ${colors[i]};`
    }));
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
        this.totalValue = normalized.reduce((sum, d) => sum + d.value, 0);
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
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3PieChart initialization error:", e);
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
      this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
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
      this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
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
      this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);
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
    const requiredFields = [this.groupByField];
    if (this.operation !== OPERATIONS.COUNT) {
      requiredFields.push(this.valueField);
    }

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || MAX_RECORDS
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

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

    d3.select(container).select("svg").remove();

    const padding = Math.max(10, Math.round(containerWidth * 0.04));
    const margin = {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    };
    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const radius = Math.min(width, height) / 2;

    const svgRoot = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "pie-chart-svg");

    applySvgA11y(svgRoot, {
      title: `Pie chart: ${this.operation} of ${this.valueField || this.groupByField} by ${this.groupByField}`,
      desc: `${this.chartData.length} categories, total ${formatNumber(this.totalValue)}`
    });

    this.svg = svgRoot
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + width / 2},${margin.top + height / 2})`
      );

    const colors = getColors(
      this.theme,
      this.chartData.length,
      this.config.customColors
    );

    const pie = d3
      .pie()
      .value((d) => d.value)
      .sort(null);

    const arc = d3.arc().innerRadius(0).outerRadius(radius);

    const arcHover = d3
      .arc()
      .innerRadius(0)
      .outerRadius(radius + 10);

    const slices = this.svg
      .selectAll(".slice")
      .data(pie(this.chartData))
      .enter()
      .append("g")
      .attr("class", "slice");

    slices
      .append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => colors[i])
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .on("mouseenter", (event, d) => {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr("d", arcHover);
        this.showTooltip(event, d.data);
      })
      .on("mousemove", (event) => {
        this.moveTooltip(event);
      })
      .on("mouseleave", (event) => {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr("d", arc);
        this.hideTooltip();
      })
      .on("click", (event, d) => {
        this.handleSliceClick(d.data);
      })
      .transition()
      .duration(750)
      .attrTween("d", function (d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function (t) {
          return arc(interpolate(t));
        };
      });

    // In-wedge labels: category names are NOT drawn (they pile up over the
    // center on many-slice pies and are redundant with the right-side legend
    // + tooltip). We optionally draw ONLY a short percentage, and only for
    // wedges wide enough that it clearly fits without overlapping a neighbor.
    // The threshold is an arc angle (radians); the default ~0.5 rad ≈ an 8%
    // slice. Set advancedConfig.showLabels === false to suppress entirely.
    if (this.config.showLabels !== false) {
      const minLabelAngle =
        typeof this.config.minLabelAngle === "number"
          ? this.config.minLabelAngle
          : 0.5;
      const pieData = pie(this.chartData);
      const labeled = pieData.filter(
        (d) => d.endAngle - d.startAngle >= minLabelAngle
      );

      this.svg
        .selectAll(".slice-label")
        .data(labeled)
        .enter()
        .append("text")
        .attr("class", "slice-label")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("transform", (d) => `translate(${arc.centroid(d)})`)
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "#ffffff")
        .style("paint-order", "stroke")
        .style("stroke", "rgba(0,0,0,0.35)")
        .style("stroke-width", "2px")
        .text((d) => {
          return this.totalValue > 0
            ? formatPercent(d.data.value / this.totalValue)
            : "";
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, d) {
    if (!this.tooltip) return;

    const percent = this.totalValue > 0 ? d.value / this.totalValue : 0;
    const content = `
            <strong>${d.label}</strong><br/>
            ${formatNumber(d.value)} (${formatPercent(percent)})
        `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  moveTooltip() {
    // Position handled in show()
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleSliceClick(d) {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.groupByField;

    this[NavigationMixin.Navigate]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.objectApiName,
        actionName: "list"
      }
    });

    this.dispatchEvent(
      new CustomEvent("sliceclick", {
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
      this.handleSliceClick(item);
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
