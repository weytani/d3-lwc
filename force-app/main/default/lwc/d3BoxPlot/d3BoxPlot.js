// ABOUTME: D3 Box Plot Lightning Web Component.
// ABOUTME: Displays side-by-side box-and-whisker plots grouped by category with quartile visualization and outlier detection.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import { prepareData, computeQuartiles, CHART_LIMITS } from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  truncateLabel,
  createTooltip,
  createResizeHandler,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

export default class D3BoxPlot extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "SELECT StageName, Amount FROM Opportunity";

  /** Field to group by (category for each box) */
  @api groupByField = "StageName";

  /** Numeric field for distribution analysis */
  @api valueField = "Amount";

  /** Chart height in pixels */
  @api height = 350;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down (usually same as groupByField) */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side queries */
  @api filterClause = "";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track chartData = [];
  @track truncatedWarning = null;

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

  get isHorizontal() {
    return this.config.orientation === "horizontal";
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
      console.error("D3BoxPlot initialization error:", e);
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
    // Priority 1: Use recordCollection if provided (raw data for distribution)
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.chartData = this._processRawData([...this.recordCollection]);
      return;
    }

    // Priority 2: Fall back to SOQL query
    if (this.soqlQuery) {
      let rawData = [];
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      this.chartData = this._processRawData(rawData);
      return;
    }

    throw new Error(
      "No data source provided. Set recordCollection or soqlQuery."
    );
  }

  /**
   * Validates, truncates, groups raw data, and computes quartiles per group.
   * Box plots need raw (unaggregated) data to compute distribution statistics.
   */
  _processRawData(rawData) {
    // Validate required fields
    const requiredFields = [this.groupByField, this.valueField];

    // Prepare data (validate + truncate using BOX_PLOT limit)
    const prepared = prepareData(rawData, {
      requiredFields,
      limit: CHART_LIMITS.BOX_PLOT
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    if (prepared.truncated) {
      this.truncatedWarning = `Displaying first ${CHART_LIMITS.BOX_PLOT.toLocaleString()} of ${prepared.originalCount} records`;
      this.showTruncationToast(prepared.originalCount);
    }

    // Group raw records by groupByField
    const groups = new Map();
    prepared.data.forEach((record) => {
      const key = String(record[this.groupByField] ?? "Null");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(record);
    });

    // Compute quartiles for each group
    const result = [];
    groups.forEach((records, label) => {
      const stats = computeQuartiles(records, this.valueField);
      if (stats) {
        result.push({ label, stats, count: records.length });
      }
    });

    if (result.length === 0) {
      throw new Error("No valid data after computing quartiles");
    }

    return result;
  }

  showTruncationToast(originalCount) {
    this.dispatchEvent(
      new ShowToastEvent({
        title: "Data Truncated",
        message: `Displaying first ${CHART_LIMITS.BOX_PLOT.toLocaleString()} of ${originalCount} records for performance`,
        variant: "warning"
      })
    );
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
      top: 20,
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
      .attr("class", "box-plot-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Colors
    const colors = getColors(
      this.theme,
      this.chartData.length,
      this.config.customColors
    );

    // Compute global value extent for the value axis
    let globalMin = Infinity;
    let globalMax = -Infinity;
    this.chartData.forEach((d) => {
      const low = Math.min(
        d.stats.whiskerLow,
        ...(d.stats.outliers.length > 0 ? d.stats.outliers : [d.stats.whiskerLow])
      );
      const high = Math.max(
        d.stats.whiskerHigh,
        ...(d.stats.outliers.length > 0 ? d.stats.outliers : [d.stats.whiskerHigh])
      );
      if (low < globalMin) globalMin = low;
      if (high > globalMax) globalMax = high;
    });

    // Add 5% padding to value domain
    const valuePadding = (globalMax - globalMin) * 0.05 || 1;
    const valueDomain = [globalMin - valuePadding, globalMax + valuePadding];

    if (this.isHorizontal) {
      this._renderHorizontal(d3, width, height, colors, valueDomain);
    } else {
      this._renderVertical(d3, width, height, colors, valueDomain);
    }
  }

  _renderVertical(d3, width, height, colors, valueDomain) {
    const svg = this.svg;

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(this.chartData.map((d) => d.label))
      .range([0, width])
      .padding(0.3);

    const yScale = d3
      .scaleLinear()
      .domain(valueDomain)
      .nice()
      .range([height, 0]);

    // Grid lines (optional)
    if (this.config.showGrid !== false) {
      svg
        .append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "2,2");

      svg.select(".grid .domain").remove();
    }

    // X Axis
    const xAxis = svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => truncateLabel(d, 12)));

    // Rotate labels if many boxes
    if (this.chartData.length > 6) {
      xAxis
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .attr("dx", "-0.5em")
        .attr("dy", "0.5em");
    }

    // Y Axis
    svg
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).tickFormat((d) => formatNumber(d)));

    const bandWidth = xScale.bandwidth();
    const boxWidth = Math.min(bandWidth * 0.6, 60);
    const boxOffset = (bandWidth - boxWidth) / 2;

    // Draw each box plot
    this.chartData.forEach((d, i) => {
      const x = xScale(d.label) + boxOffset;
      const color = colors[i];

      this._drawBox(svg, d, x, boxWidth, color, yScale, "vertical");
    });
  }

  _renderHorizontal(d3, width, height, colors, valueDomain) {
    const svg = this.svg;

    // Scales — swapped for horizontal
    const yScale = d3
      .scaleBand()
      .domain(this.chartData.map((d) => d.label))
      .range([0, height])
      .padding(0.3);

    const xScale = d3
      .scaleLinear()
      .domain(valueDomain)
      .nice()
      .range([0, width]);

    // Grid lines (optional)
    if (this.config.showGrid !== false) {
      svg
        .append("g")
        .attr("class", "grid")
        .call(d3.axisBottom(xScale).tickSize(height).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "2,2");

      svg.select(".grid .domain").remove();
    }

    // X Axis (values)
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat((d) => formatNumber(d)));

    // Y Axis (categories)
    svg
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).tickFormat((d) => truncateLabel(d, 12)));

    const bandWidth = yScale.bandwidth();
    const boxWidth = Math.min(bandWidth * 0.6, 60);
    const boxOffset = (bandWidth - boxWidth) / 2;

    // Draw each box plot
    this.chartData.forEach((d, i) => {
      const y = yScale(d.label) + boxOffset;
      const color = colors[i];

      this._drawBox(svg, d, y, boxWidth, color, xScale, "horizontal");
    });
  }

  _drawBox(svg, d, position, boxSize, color, valueScale, orientation) {
    const { stats } = d;
    const isVertical = orientation === "vertical";

    const group = svg.append("g").attr("class", "box-group");

    if (isVertical) {
      // Whisker line: whiskerLow to q1 (vertical)
      group
        .append("line")
        .attr("class", "whisker-line")
        .attr("x1", position + boxSize / 2)
        .attr("x2", position + boxSize / 2)
        .attr("y1", valueScale(stats.whiskerLow))
        .attr("y2", valueScale(stats.q1))
        .attr("stroke", color);

      // Whisker line: q3 to whiskerHigh (vertical)
      group
        .append("line")
        .attr("class", "whisker-line")
        .attr("x1", position + boxSize / 2)
        .attr("x2", position + boxSize / 2)
        .attr("y1", valueScale(stats.q3))
        .attr("y2", valueScale(stats.whiskerHigh))
        .attr("stroke", color);

      // Whisker cap: low
      group
        .append("line")
        .attr("class", "whisker-cap")
        .attr("x1", position + boxSize * 0.25)
        .attr("x2", position + boxSize * 0.75)
        .attr("y1", valueScale(stats.whiskerLow))
        .attr("y2", valueScale(stats.whiskerLow))
        .attr("stroke", color);

      // Whisker cap: high
      group
        .append("line")
        .attr("class", "whisker-cap")
        .attr("x1", position + boxSize * 0.25)
        .attr("x2", position + boxSize * 0.75)
        .attr("y1", valueScale(stats.whiskerHigh))
        .attr("y2", valueScale(stats.whiskerHigh))
        .attr("stroke", color);

      // Box rect: q1 to q3
      const boxY = valueScale(stats.q3);
      const boxHeight = Math.abs(valueScale(stats.q1) - valueScale(stats.q3));
      const medianY = valueScale(stats.q2);

      // Animated box: starts from median, grows outward
      group
        .append("rect")
        .attr("class", "box-rect")
        .attr("x", position)
        .attr("y", medianY)
        .attr("width", boxSize)
        .attr("height", 0)
        .attr("fill", color)
        .attr("fill-opacity", 0.7)
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .transition()
        .duration(750)
        .delay(0)
        .attr("y", boxY)
        .attr("height", boxHeight);

      // Median line
      group
        .append("line")
        .attr("class", "median-line")
        .attr("x1", position)
        .attr("x2", position + boxSize)
        .attr("y1", medianY)
        .attr("y2", medianY)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("opacity", 1);

      // Outlier dots
      if (stats.outliers && stats.outliers.length > 0) {
        stats.outliers.forEach((outlier) => {
          group
            .append("circle")
            .attr("class", "outlier-dot")
            .attr("cx", position + boxSize / 2)
            .attr("cy", valueScale(outlier))
            .attr("r", 3)
            .attr("fill", color)
            .attr("stroke", color)
            .attr("opacity", 0.7);
        });
      }
    } else {
      // Horizontal orientation — position is y, valueScale maps to x
      // Whisker line: whiskerLow to q1 (horizontal)
      group
        .append("line")
        .attr("class", "whisker-line")
        .attr("y1", position + boxSize / 2)
        .attr("y2", position + boxSize / 2)
        .attr("x1", valueScale(stats.whiskerLow))
        .attr("x2", valueScale(stats.q1))
        .attr("stroke", color);

      // Whisker line: q3 to whiskerHigh (horizontal)
      group
        .append("line")
        .attr("class", "whisker-line")
        .attr("y1", position + boxSize / 2)
        .attr("y2", position + boxSize / 2)
        .attr("x1", valueScale(stats.q3))
        .attr("x2", valueScale(stats.whiskerHigh))
        .attr("stroke", color);

      // Whisker cap: low
      group
        .append("line")
        .attr("class", "whisker-cap")
        .attr("y1", position + boxSize * 0.25)
        .attr("y2", position + boxSize * 0.75)
        .attr("x1", valueScale(stats.whiskerLow))
        .attr("x2", valueScale(stats.whiskerLow))
        .attr("stroke", color);

      // Whisker cap: high
      group
        .append("line")
        .attr("class", "whisker-cap")
        .attr("y1", position + boxSize * 0.25)
        .attr("y2", position + boxSize * 0.75)
        .attr("x1", valueScale(stats.whiskerHigh))
        .attr("x2", valueScale(stats.whiskerHigh))
        .attr("stroke", color);

      // Box rect: q1 to q3 (horizontal)
      const boxX = valueScale(stats.q1);
      const boxWidth = Math.abs(valueScale(stats.q3) - valueScale(stats.q1));
      const medianX = valueScale(stats.q2);

      // Animated box: starts from median, grows outward
      group
        .append("rect")
        .attr("class", "box-rect")
        .attr("x", medianX)
        .attr("y", position)
        .attr("width", 0)
        .attr("height", boxSize)
        .attr("fill", color)
        .attr("fill-opacity", 0.7)
        .attr("stroke", color)
        .attr("stroke-width", 1.5)
        .transition()
        .duration(750)
        .delay(0)
        .attr("x", boxX)
        .attr("width", boxWidth);

      // Median line (vertical in horizontal mode)
      group
        .append("line")
        .attr("class", "median-line")
        .attr("x1", medianX)
        .attr("x2", medianX)
        .attr("y1", position)
        .attr("y2", position + boxSize)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("opacity", 1);

      // Outlier dots
      if (stats.outliers && stats.outliers.length > 0) {
        stats.outliers.forEach((outlier) => {
          group
            .append("circle")
            .attr("class", "outlier-dot")
            .attr("cx", valueScale(outlier))
            .attr("cy", position + boxSize / 2)
            .attr("r", 3)
            .attr("fill", color)
            .attr("stroke", color)
            .attr("opacity", 0.7);
        });
      }
    }

    // Tooltip interactions on the box group
    group
      .on("mouseenter", (event) => {
        this.showTooltip(event, d);
      })
      .on("mousemove", () => {
        // Tooltip position handled in show()
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, d) {
    if (!this.tooltip) return;

    const { stats } = d;
    const content = `
      <div style="font-weight: bold; margin-bottom: 4px;">${d.label}</div>
      <div>Q1: ${formatNumber(stats.q1)}</div>
      <div>Median: ${formatNumber(stats.q2)}</div>
      <div>Q3: ${formatNumber(stats.q3)}</div>
      <div>Min: ${formatNumber(stats.min)}</div>
      <div>Max: ${formatNumber(stats.max)}</div>
      ${stats.outliers.length > 0 ? `<div>Outliers: ${stats.outliers.length}</div>` : ""}
    `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
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
