// ABOUTME: D3 Stacked Bar Chart Lightning Web Component.
// ABOUTME: Displays multi-dimensional data as stacked, grouped, or normalized bars with series legend and drill-down.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateData,
  aggregateSeriesData,
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
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

export default class D3StackedBarChart extends NavigationMixin(
  LightningElement
) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "SELECT StageName, Type, Amount FROM Opportunity";

  /** Field to group by (category axis) */
  @api groupByField = "StageName";

  /** Secondary grouping dimension (series/stacks) */
  @api seriesField = "";

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
      console.error("D3StackedBarChart initialization error:", e);
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
        // Use getMultiGroupData when seriesField is specified
        if (this.seriesField) {
          const result = await getMultiGroupData({
            objectName: this.objectApiName,
            groupByField: this.groupByField,
            seriesField: this.seriesField,
            valueField: this.valueField,
            operation: this.operation,
            filterClause: this.filterClause || null
          });
          // Server returns [{label, series, value}, ...] — same shape as aggregateSeriesData()
          this.chartData = result;
        } else {
          // Fall back to single-dimension aggregation when no seriesField
          const result = await getAggregatedData({
            objectName: this.objectApiName,
            groupByField: this.groupByField,
            valueField: this.valueField,
            operation: this.operation,
            filterClause: this.filterClause || null
          });
          // Server returns [{label, value}, ...] — wrap as single-series
          this.chartData = result;
        }
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
   * Uses aggregateSeriesData when seriesField is specified, otherwise aggregateData.
   */
  _aggregateRawData(rawData) {
    // Validate required fields
    const requiredFields = [this.groupByField];
    if (this.seriesField) {
      requiredFields.push(this.seriesField);
    }
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

    // Aggregate using series-aware function when seriesField is provided
    let aggregated;
    if (this.seriesField) {
      aggregated = aggregateSeriesData(
        prepared.data,
        this.groupByField,
        this.seriesField,
        this.valueField,
        this.operation
      );
    } else {
      aggregated = aggregateData(
        prepared.data,
        this.groupByField,
        this.valueField,
        this.operation
      );
    }

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

    // Determine stack mode
    const stackMode = this.config.stackMode || "stacked";

    // Extract unique labels and series
    const labels = [...new Set(this.chartData.map((d) => d.label))];
    const seriesNames = [
      ...new Set(this.chartData.map((d) => d.series).filter(Boolean))
    ];
    const hasSeries = seriesNames.length > 0;

    // Margins — extra bottom for legend
    const legendHeight = hasSeries ? 30 : 0;
    const margin = {
      top: 20,
      right: 20,
      bottom: (this.config.showGrid !== false ? 60 : 40) + legendHeight,
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
      .attr("class", "stacked-bar-chart-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale
    const xScale = d3.scaleBand().domain(labels).range([0, width]).padding(0.2);

    // Colors — one per series
    const colorCount = hasSeries ? seriesNames.length : labels.length;
    const colors = getColors(this.theme, colorCount, this.config.customColors);

    if (hasSeries && stackMode === "grouped") {
      this._renderGrouped(
        d3,
        labels,
        seriesNames,
        xScale,
        width,
        height,
        colors
      );
    } else if (hasSeries) {
      this._renderStacked(
        d3,
        labels,
        seriesNames,
        xScale,
        width,
        height,
        colors,
        stackMode
      );
    } else {
      // No series — render as simple bar chart
      this._renderSimpleBars(d3, xScale, width, height, colors);
    }

    // Legend (always rendered when series exist)
    if (hasSeries) {
      this._renderLegend(d3, seriesNames, colors, width, height);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STACKED RENDERING
  // ═══════════════════════════════════════════════════════════════

  _renderStacked(
    d3,
    labels,
    seriesNames,
    xScale,
    width,
    height,
    colors,
    stackMode
  ) {
    // Pivot chartData into rows keyed by label: { label, seriesA: val, seriesB: val, ... }
    const pivotMap = new Map();
    labels.forEach((label) => {
      const row = { label };
      seriesNames.forEach((s) => {
        row[s] = 0;
      });
      pivotMap.set(label, row);
    });
    this.chartData.forEach((d) => {
      if (d.series && pivotMap.has(d.label)) {
        pivotMap.get(d.label)[d.series] = d.value;
      }
    });
    const pivotData = labels.map((l) => pivotMap.get(l));

    // Build stack generator
    const stackGen = d3.stack().keys(seriesNames);
    if (stackMode === "normalized") {
      stackGen.offset(d3.stackOffsetExpand);
    }
    const stackedData = stackGen(pivotData);

    // Y Scale
    let yMax;
    if (stackMode === "normalized") {
      yMax = 1;
    } else {
      yMax =
        d3.max(pivotData, (row) => {
          let total = 0;
          seriesNames.forEach((s) => {
            total += row[s] || 0;
          });
          return total;
        }) || 0;
    }

    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * (stackMode === "normalized" ? 1 : 1.1)])
      .nice()
      .range([height, 0]);

    // Grid lines
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

    if (labels.length > 6) {
      xAxis
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .attr("dx", "-0.5em")
        .attr("dy", "0.5em");
    }

    // Y Axis
    const yTickFormat =
      stackMode === "normalized"
        ? (d) => `${Math.round(d * 100)}%`
        : (d) => formatNumber(d);
    this.svg
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).tickFormat(yTickFormat));

    // Draw stacked layers
    const layers = this.svg
      .selectAll(".layer")
      .data(stackedData)
      .enter()
      .append("g")
      .attr("class", "layer")
      .attr("fill", (d, i) => colors[i]);

    // Draw rects within each layer
    layers
      .selectAll("rect")
      .data((d) => d)
      .enter()
      .append("rect")
      .attr("class", "stacked-bar")
      .attr("x", (d) => xScale(d.data.label))
      .attr("width", xScale.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .attr("rx", 1)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .transition()
      .duration(750)
      .delay((d, i) => i * 50)
      .attr("y", (d) => yScale(d[1]))
      .attr("height", (d) => yScale(d[0]) - yScale(d[1]));

    // Tooltip and click interactions on rects
    layers
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
        this.handleBarClick({
          label: d.data.label,
          value: d[1] - d[0]
        });
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // GROUPED RENDERING
  // ═══════════════════════════════════════════════════════════════

  _renderGrouped(d3, labels, seriesNames, xScale, width, height, colors) {
    // Inner scale for side-by-side bars within each category
    const innerScale = d3
      .scaleBand()
      .domain(seriesNames)
      .range([0, xScale.bandwidth()])
      .padding(0.05);

    // Y Scale
    const yMax = d3.max(this.chartData, (d) => d.value) || 0;
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .nice()
      .range([height, 0]);

    // Grid lines
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

    if (labels.length > 6) {
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

    // Draw groups per label
    const groups = this.svg
      .selectAll(".bar-group")
      .data(labels)
      .enter()
      .append("g")
      .attr("class", "bar-group")
      .attr("transform", (d) => `translate(${xScale(d)},0)`);

    // Draw rects per series within each group
    groups.each((label, idx, nodes) => {
      const group = d3.select(nodes[idx]);
      const seriesForLabel = this.chartData.filter((d) => d.label === label);

      group
        .selectAll("rect")
        .data(seriesForLabel)
        .enter()
        .append("rect")
        .attr("class", "stacked-bar")
        .attr("x", (d) => innerScale(d.series))
        .attr("width", innerScale.bandwidth())
        .attr("y", height)
        .attr("height", 0)
        .attr("fill", (d) => colors[seriesNames.indexOf(d.series)])
        .attr("rx", 1)
        .attr("cursor", this.objectApiName ? "pointer" : "default")
        .transition()
        .duration(750)
        .delay((d, i) => i * 50)
        .attr("y", (d) => yScale(d.value))
        .attr("height", (d) => height - yScale(d.value));

      // Tooltip interactions
      group
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
          this.handleBarClick(d);
        });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SIMPLE BAR RENDERING (no series)
  // ═══════════════════════════════════════════════════════════════

  _renderSimpleBars(d3, xScale, width, height, colors) {
    const yMax = d3.max(this.chartData, (d) => d.value) || 0;
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .nice()
      .range([height, 0]);

    // Grid lines
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

    if (this.chartData.length > 6) {
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
      .selectAll(".stacked-bar")
      .data(this.chartData)
      .enter()
      .append("rect")
      .attr("class", "stacked-bar")
      .attr("x", (d) => xScale(d.label))
      .attr("width", xScale.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .attr("fill", (d, i) => colors[i])
      .attr("rx", 2)
      .attr("cursor", this.objectApiName ? "pointer" : "default");

    bars
      .transition()
      .duration(750)
      .delay((d, i) => i * 50)
      .attr("y", (d) => yScale(d.value))
      .attr("height", (d) => height - yScale(d.value));

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
  // LEGEND RENDERING
  // ═══════════════════════════════════════════════════════════════

  _renderLegend(d3, seriesNames, colors, width, height) {
    const legendGroup = this.svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(0, ${height + 35})`);

    const itemWidth = 80;
    const totalWidth = seriesNames.length * itemWidth;
    const startX = Math.max(0, (width - totalWidth) / 2);

    seriesNames.forEach((name, i) => {
      const itemGroup = legendGroup
        .append("g")
        .attr("transform", `translate(${startX + i * itemWidth}, 0)`);

      itemGroup
        .append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", colors[i])
        .attr("rx", 2);

      itemGroup
        .append("text")
        .attr("x", 16)
        .attr("y", 10)
        .text(truncateLabel(name, 8))
        .style("font-size", "11px")
        .attr("fill", "#706e6b");
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, d) {
    if (!this.tooltip) return;

    const label = d.label || (d.data && d.data.label) || "";
    const value = d.value != null ? d.value : d[1] != null ? d[1] - d[0] : 0;
    const seriesName = d.series || "";

    const prefix = seriesName
      ? `${seriesName} — ${this.operation || "Value"}: `
      : `${this.operation || "Value"}: `;

    const content = buildTooltipContent(label, value, { prefix });

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
          series: d.series || null,
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
