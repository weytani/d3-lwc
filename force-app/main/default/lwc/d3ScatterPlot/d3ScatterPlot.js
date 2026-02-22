// ABOUTME: D3 Scatter Plot Lightning Web Component with trend line support.
// ABOUTME: Displays correlation between two numeric fields with color grouping and navigation.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import { prepareData } from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  createTooltip,
  createResizeHandler,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getCorrelation from "@salesforce/apex/D3ChartController.getCorrelation";

export default class D3ScatterPlot extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field for X-axis (numeric) */
  @api xAxisField = "";

  /** Field for Y-axis (numeric) */
  @api yAxisField = "";

  /** Label for X-axis */
  @api xAxisLabel = "";

  /** Label for Y-axis */
  @api yAxisLabel = "";

  /** Field containing the record ID for navigation */
  @api recordIdField = "Id";

  /** Object API name for navigation */
  @api objectApiName = "";

  /** Optional field for color grouping (categorical) */
  @api groupByField = "";

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Point size (radius in pixels) */
  @api pointSize = 6;

  /** Show trend line */
  @api showTrendLine = false;

  /** Show correlation coefficient */
  @api showCorrelation = false;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track chartData = [];
  @track truncatedWarning = null;
  @track correlationCoefficient = null;

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
  _groupNames = [];
  _serverCorrelation = null;
  _usedRecordCollection = false;

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

  get showCorrelationInfo() {
    return (
      (this.showTrendLine || this.showCorrelation) &&
      this.correlationCoefficient != null
    );
  }

  get correlationDisplay() {
    if (this.correlationCoefficient == null) return "N/A";
    return this.correlationCoefficient.toFixed(3);
  }

  get correlationStrength() {
    if (this.correlationCoefficient == null) return "";
    const absR = Math.abs(this.correlationCoefficient);
    if (absR >= 0.8) return "Strong";
    if (absR >= 0.5) return "Moderate";
    if (absR >= 0.3) return "Weak";
    return "Very Weak";
  }

  get effectiveXLabel() {
    return this.xAxisLabel || this.xAxisField;
  }

  get effectiveYLabel() {
    return this.yAxisLabel || this.yAxisField;
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
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3ScatterPlot initialization error:", e);
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
    let rawData = [];

    if (this.recordCollection && this.recordCollection.length > 0) {
      rawData = [...this.recordCollection];
      this._usedRecordCollection = true;
    } else if (this.soqlQuery) {
      this._usedRecordCollection = false;
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
    } else {
      throw new Error(
        "No data source provided. Set recordCollection or soqlQuery."
      );
    }

    // Required fields
    const requiredFields = [this.xAxisField, this.yAxisField];

    const prepared = prepareData(rawData, { requiredFields });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    if (prepared.truncated) {
      this.truncatedWarning = `Displaying first 2,000 of ${prepared.originalCount} records`;
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Data Truncated",
          message: this.truncatedWarning,
          variant: "warning"
        })
      );
    }

    // Process data into scatter format
    this.processScatterData(prepared.data);

    if (this.chartData.length === 0) {
      throw new Error("No valid data points after processing");
    }

    // Calculate correlation — prefer server-side when using SOQL path
    if (this.showTrendLine || this.showCorrelation) {
      if (this.soqlQuery && !this._usedRecordCollection) {
        try {
          const serverResult = await getCorrelation({
            queryString: this.soqlQuery,
            xField: this.xAxisField,
            yField: this.yAxisField
          });
          this.correlationCoefficient = serverResult.r != null ? Number(serverResult.r) : null;
          this._serverCorrelation = serverResult;
        } catch (e) {
          // Fall back to client-side calculation on server error
          console.warn('Server correlation failed, falling back to client-side:', e);
          this.calculateCorrelation();
          this._serverCorrelation = null;
        }
      } else {
        this.calculateCorrelation();
      }
    }
  }

  /**
   * Processes raw records into scatter plot format.
   * @param {Array} data - Raw data records
   */
  processScatterData(data) {
    const groupSet = new Set();

    this.chartData = data
      .map((record) => {
        const x = Number(record[this.xAxisField]);
        const y = Number(record[this.yAxisField]);
        const id = record[this.recordIdField];
        const group = this.groupByField
          ? String(record[this.groupByField] || "Other")
          : "default";

        if (!isNaN(x) && !isNaN(y)) {
          groupSet.add(group);
          return { x, y, id, group, record };
        }
        return null;
      })
      .filter((d) => d !== null);

    this._groupNames = Array.from(groupSet).sort();
  }

  /**
   * Calculates Pearson correlation coefficient.
   */
  calculateCorrelation() {
    const n = this.chartData.length;
    if (n < 2) {
      this.correlationCoefficient = null;
      return;
    }

    const sumX = this.chartData.reduce((sum, d) => sum + d.x, 0);
    const sumY = this.chartData.reduce((sum, d) => sum + d.y, 0);
    const sumXY = this.chartData.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = this.chartData.reduce((sum, d) => sum + d.x * d.x, 0);
    const sumY2 = this.chartData.reduce((sum, d) => sum + d.y * d.y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    if (denominator === 0) {
      this.correlationCoefficient = null;
    } else {
      this.correlationCoefficient = numerator / denominator;
    }
  }

  /**
   * Calculates linear regression coefficients for trend line.
   * @returns {Object} - { slope, intercept }
   */
  calculateLinearRegression() {
    const n = this.chartData.length;
    if (n < 2) return { slope: 0, intercept: 0 };

    const sumX = this.chartData.reduce((sum, d) => sum + d.x, 0);
    const sumY = this.chartData.reduce((sum, d) => sum + d.y, 0);
    const sumXY = this.chartData.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = this.chartData.reduce((sum, d) => sum + d.x * d.x, 0);

    const meanX = sumX / n;
    const meanY = sumY / n;

    const denominator = sumX2 - n * meanX * meanX;
    if (denominator === 0) {
      return { slope: 0, intercept: meanY };
    }

    const slope = (sumXY - n * meanX * meanY) / denominator;
    const intercept = meanY - slope * meanX;

    return { slope, intercept };
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

    // Margins
    const padding = Math.max(10, Math.round(containerWidth * 0.04));
    const margin = {
      top: padding,
      right: padding + 10,
      bottom: Math.max(40, Math.round(containerWidth * 0.1)),
      left: Math.max(40, Math.round(containerWidth * 0.12))
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
      .attr("class", "scatter-plot-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculate domains with padding
    const xExtent = d3.extent(this.chartData, (d) => d.x);
    const yExtent = d3.extent(this.chartData, (d) => d.y);

    const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 1;

    // X Scale (numeric)
    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, width])
      .nice();

    // Y Scale (numeric)
    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([height, 0])
      .nice();

    // Colors
    const colorCount = this._groupNames.length || 1;
    const colors = getColors(this.theme, colorCount, this.config.customColors);

    const colorScale = d3.scaleOrdinal().domain(this._groupNames).range(colors);

    // Grid lines
    if (this.config.showGrid !== false) {
      // Horizontal grid
      this.svg
        .append("g")
        .attr("class", "grid grid-y")
        .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "2,2");

      this.svg.select(".grid-y .domain").remove();

      // Vertical grid
      this.svg
        .append("g")
        .attr("class", "grid grid-x")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickSize(-height).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "2,2");

      this.svg.select(".grid-x .domain").remove();
    }

    // Draw trend line (before points so it's behind)
    if (this.showTrendLine && this.chartData.length >= 2) {
      this.drawTrendLine(xScale, yScale);
    }

    // X Axis
    this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(this.getTickCount(width))
          .tickFormat((d) => formatNumber(d))
      );

    // X Axis Label
    this.svg
      .append("text")
      .attr("class", "axis-label x-axis-label")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#706e6b")
      .text(this.effectiveXLabel);

    // Y Axis
    this.svg
      .append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(this.getTickCount(height))
          .tickFormat((d) => formatNumber(d))
      );

    // Y Axis Label
    this.svg
      .append("text")
      .attr("class", "axis-label y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#706e6b")
      .text(this.effectiveYLabel);

    // Draw points
    const points = this.svg
      .selectAll(".point")
      .data(this.chartData)
      .enter()
      .append("circle")
      .attr("class", "point")
      .attr("cx", (d) => xScale(d.x))
      .attr("cy", (d) => yScale(d.y))
      .attr("r", 0) // Start at 0 for animation
      .attr("fill", (d) => colorScale(d.group))
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .attr("opacity", 0.8);

    // Animate points
    points
      .transition()
      .duration(500)
      .delay((d, i) => i * 5)
      .attr("r", this.pointSize);

    // Point interactions
    points
      .on("mouseenter", (event, d) => {
        this.showTooltip(event, d, colorScale(d.group));
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("r", this.pointSize * 1.5)
          .attr("opacity", 1);
      })
      .on("mouseleave", (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("r", this.pointSize)
          .attr("opacity", 0.8);
      })
      .on("click", (event, d) => {
        this.handlePointClick(d);
      });

    // Legend for grouped data
    if (this.groupByField && this._groupNames.length > 1) {
      this.renderLegend(colorScale, width);
    }
  }

  /**
   * Draws the trend line (linear regression).
   * @param {Function} xScale - D3 x scale
   * @param {Function} yScale - D3 y scale
   */
  drawTrendLine(xScale, yScale) {
    let slope, intercept;
    if (this._serverCorrelation && this._serverCorrelation.slope != null) {
      slope = this._serverCorrelation.slope;
      intercept = this._serverCorrelation.intercept;
    } else {
      const regression = this.calculateLinearRegression();
      slope = regression.slope;
      intercept = regression.intercept;
    }

    const xDomain = xScale.domain();
    const x1 = xDomain[0];
    const x2 = xDomain[1];
    const y1 = slope * x1 + intercept;
    const y2 = slope * x2 + intercept;

    this.svg
      .append("line")
      .attr("class", "trend-line")
      .attr("x1", xScale(x1))
      .attr("y1", yScale(y1))
      .attr("x2", xScale(x2))
      .attr("y2", yScale(y2))
      .attr("stroke", "#FF6B6B")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6,3")
      .attr("opacity", 0.7);
  }

  /**
   * Renders legend for grouped scatter plot.
   * @param {Function} colorScale - D3 color scale
   * @param {Number} width - Chart width
   */
  renderLegend(colorScale, width) {
    const legend = this.svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - 120}, 10)`);

    this._groupNames.forEach((name, i) => {
      const item = legend
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(0, ${i * 20})`);

      item
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 6)
        .attr("r", 5)
        .attr("fill", colorScale(name));

      item
        .append("text")
        .attr("x", 16)
        .attr("y", 10)
        .style("font-size", "11px")
        .style("fill", "#706e6b")
        .text(name.length > 15 ? name.substring(0, 15) + "..." : name);
    });
  }

  /**
   * Returns appropriate tick count based on dimension.
   * @param {Number} dimension - Width or height
   * @returns {Number} - Number of ticks
   */
  getTickCount(dimension) {
    if (dimension < 200) return 3;
    if (dimension < 400) return 5;
    return 7;
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, d, color) {
    if (!this.tooltip) return;

    let groupInfo = "";
    if (this.groupByField && d.group !== "default") {
      groupInfo = `<div style="border-left: 3px solid ${color}; padding-left: 8px; margin-bottom: 8px;"><strong>${d.group}</strong></div>`;
    }

    const content = `
            ${groupInfo}
            <div><strong>${this.effectiveXLabel}:</strong> ${formatNumber(d.x)}</div>
            <div><strong>${this.effectiveYLabel}:</strong> ${formatNumber(d.y)}</div>
            ${this.objectApiName ? '<div class="tooltip-hint">Click to view record</div>' : ""}
        `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  handlePointClick(d) {
    // Dispatch custom event regardless of navigation config
    this.dispatchEvent(
      new CustomEvent("pointclick", {
        detail: {
          x: d.x,
          y: d.y,
          group: d.group,
          recordId: d.id,
          record: d.record
        },
        bubbles: true,
        composed: true
      })
    );

    // Navigate to record if configured
    if (!this.objectApiName || !d.id) return;

    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        recordId: d.id,
        objectApiName: this.objectApiName,
        actionName: "view"
      }
    });
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
