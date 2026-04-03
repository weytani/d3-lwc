// ABOUTME: D3 Waterfall Chart Lightning Web Component.
// ABOUTME: Displays aggregated data as a bridge/variance chart showing sequential value changes with running totals.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateData,
  computeRunningTotal,
  OPERATIONS,
  MAX_RECORDS
} from "c/dataService";
import { SEMANTIC_COLORS, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  truncateLabel,
  createTooltip,
  createResizeHandler,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

export default class D3WaterfallChart extends NavigationMixin(
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

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down (usually same as groupByField) */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side aggregation */
  @api filterClause = "";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track chartData = [];
  @track waterfallData = [];
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
    return this.waterfallData && this.waterfallData.length > 0;
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
  // LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════

  async connectedCallback() {
    try {
      // Load D3
      this.d3 = await loadD3(this);

      // Load data
      await this.loadData();

      // Transform aggregated data into waterfall format
      this.waterfallData = computeRunningTotal(this.chartData);
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3WaterfallChart initialization error:", e);
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

    // Clear existing SVG
    d3.select(container).select("svg").remove();

    // Margins
    const margin = {
      top: 30,
      right: 20,
      bottom: this.config.showGrid !== false ? 60 : 40,
      left: 60
    };

    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    // Create SVG
    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "waterfall-chart-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = this.waterfallData;
    const subtotalIndices = new Set(this.config.subtotalIndices || []);

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, width])
      .padding(0.2);

    // Y-axis domain from min(all starts/ends) to max(all starts/ends)
    const yMin = d3.min(data, (d) => Math.min(d.start, d.end));
    const yMax = d3.max(data, (d) => Math.max(d.start, d.end));
    const yPadding = (yMax - yMin) * 0.1 || 1;

    const yScale = d3
      .scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .nice()
      .range([height, 0]);

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
    if (data.length > 6) {
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

    // Fill color function
    const fillColor = (d, i) => {
      if (subtotalIndices.has(i)) {
        return SEMANTIC_COLORS.subtotal;
      }
      return d.isPositive ? SEMANTIC_COLORS.positive : SEMANTIC_COLORS.negative;
    };

    // Bars (floating)
    const bars = this.svg
      .selectAll(".waterfall-bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "waterfall-bar")
      .attr("x", (d) => xScale(d.label))
      .attr("width", xScale.bandwidth())
      .attr("y", height) // Start from bottom for animation
      .attr("height", 0)
      .attr("fill", fillColor)
      .attr("rx", 2)
      .attr("cursor", this.objectApiName ? "pointer" : "default");

    // Animate bars to floating positions
    bars
      .transition()
      .duration(750)
      .delay((d, i) => i * 50)
      .attr("y", (d) => yScale(Math.max(d.start, d.end)))
      .attr("height", (d) => Math.abs(yScale(d.start) - yScale(d.end)));

    // Connector lines (thin gray dashed lines from top of each bar to start of next)
    this.svg
      .selectAll(".connector-line")
      .data(data.slice(0, -1))
      .enter()
      .append("line")
      .attr("class", "connector-line")
      .attr("x1", (d) => xScale(d.label) + xScale.bandwidth())
      .attr("x2", (d, i) => xScale(data[i + 1].label))
      .attr("y1", (d) => yScale(d.end))
      .attr("y2", (d) => yScale(d.end))
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // Value labels above/below each bar showing the delta
    this.svg
      .selectAll(".value-label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "value-label")
      .attr("x", (d) => xScale(d.label) + xScale.bandwidth() / 2)
      .attr("y", (d) => {
        if (d.isPositive) {
          return yScale(Math.max(d.start, d.end)) - 5;
        }
        return yScale(Math.min(d.start, d.end)) + 15;
      })
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#706e6b")
      .text((d) => {
        const prefix = d.value >= 0 ? "+" : "";
        return `${prefix}${formatNumber(d.value)}`;
      });

    // Tooltip interactions
    bars
      .on("mouseenter", (event, d) => {
        this.showTooltipHandler(event, d);
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 0.8);
      })
      .on("mousemove", () => {
        // Tooltip position set in show()
      })
      .on("mouseleave", (event) => {
        this.hideTooltipHandler();
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

  showTooltipHandler(event, d) {
    if (!this.tooltip) return;

    const deltaStr = (d.value >= 0 ? "+" : "") + formatNumber(d.value);
    const content = `
      <div style="font-weight: bold; margin-bottom: 4px;">${d.label}</div>
      <div>Delta: ${deltaStr}</div>
      <div>Running Total: ${formatNumber(d.cumulative)}</div>
    `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltipHandler() {
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
          cumulative: d.cumulative,
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
