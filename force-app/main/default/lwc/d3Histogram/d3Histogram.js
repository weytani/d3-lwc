// ABOUTME: D3 Histogram Lightning Web Component with automatic binning.
// ABOUTME: Displays distribution of numeric values with normal curve overlay and statistics.
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
import getStatistics from "@salesforce/apex/D3ChartController.getStatistics";

export default class D3Histogram extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field to analyze for distribution (numeric) */
  @api valueField = "";

  /** Label for X-axis (defaults to valueField) */
  @api xAxisLabel = "";

  /** Number of bins (if 0 or undefined, D3 auto-calculates) */
  @api binCount = 0;

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Show normal distribution curve overlay */
  @api showNormalCurve = false;

  /** Show statistics summary (mean, median, std dev) */
  @api showStatistics = false;

  /** Object API name for navigation to list view */
  @api objectApiName = "";

  /** Filter field name for navigation */
  @api filterField = "";

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track rawValues = [];
  @track binData = [];
  @track truncatedWarning = null;
  @track statistics = {
    mean: 0,
    median: 0,
    stdDev: 0,
    count: 0,
    min: 0,
    max: 0
  };

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
    return this.rawValues && this.rawValues.length > 0;
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get effectiveXLabel() {
    return this.xAxisLabel || this.valueField;
  }

  get meanDisplay() {
    return formatNumber(this.statistics.mean);
  }

  get medianDisplay() {
    return formatNumber(this.statistics.median);
  }

  get stdDevDisplay() {
    return formatNumber(this.statistics.stdDev);
  }

  get countDisplay() {
    return formatNumber(this.statistics.count, 0);
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
      console.error("D3Histogram initialization error:", e);
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

    // Validate and prepare data
    const requiredFields = [this.valueField];
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

    // Extract numeric values, filtering out nulls and non-numbers
    this.rawValues = prepared.data
      .map((record) => {
        const val = record[this.valueField];
        return val !== null && val !== undefined ? Number(val) : NaN;
      })
      .filter((val) => !isNaN(val) && isFinite(val));

    if (this.rawValues.length === 0) {
      throw new Error("No valid numeric values found in data");
    }

    // Calculate statistics — prefer server-side when using SOQL path
    if (this.soqlQuery && !this._usedRecordCollection) {
      try {
        const serverStats = await getStatistics({
          queryString: this.soqlQuery,
          valueField: this.valueField
        });
        this.statistics = {
          mean: Number(serverStats.mean) || 0,
          median: Number(serverStats.median) || 0,
          stdDev: Number(serverStats.stdDev) || 0,
          count: Number(serverStats.count) || 0,
          min: Number(serverStats.min) || 0,
          max: Number(serverStats.max) || 0
        };
      } catch (e) {
        // Fall back to client-side calculation on server error
        console.warn('Server statistics failed, falling back to client-side:', e);
        this.calculateStatistics();
      }
    } else {
      this.calculateStatistics();
    }
  }

  /**
   * Calculates descriptive statistics for the dataset.
   */
  calculateStatistics() {
    const values = this.rawValues;
    const n = values.length;

    if (n === 0) {
      this.statistics = {
        mean: 0,
        median: 0,
        stdDev: 0,
        count: 0,
        min: 0,
        max: 0
      };
      return;
    }

    // Sort for median calculation
    const sorted = [...values].sort((a, b) => a - b);

    // Mean
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;

    // Median
    const mid = Math.floor(n / 2);
    const median =
      n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Standard Deviation
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / n;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Min/Max
    const min = sorted[0];
    const max = sorted[n - 1];

    this.statistics = { mean, median, stdDev, count: n, min, max };
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

    // Margins (responsive to container width)
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
      .attr("class", "histogram-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale
    const xExtent = d3.extent(this.rawValues);
    const xPadding = (xExtent[1] - xExtent[0]) * 0.02 || 1;

    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .nice()
      .range([0, width]);

    // Create histogram bins
    const binGenerator = d3
      .bin()
      .domain(xScale.domain())
      .thresholds(this.getThresholds(xScale, width));

    this.binData = binGenerator(this.rawValues);

    // Y Scale (frequency)
    const yMax = d3.max(this.binData, (d) => d.length);
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .nice()
      .range([height, 0]);

    // Colors
    const colors = getColors(this.theme, 1, this.config.customColors);
    const barColor = colors[0];

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

    // Draw normal distribution curve (before bars so it's behind)
    if (this.showNormalCurve && this.statistics.stdDev > 0) {
      this.drawNormalCurve(xScale, yScale);
    }

    // Draw bars
    const bars = this.svg
      .selectAll(".bar")
      .data(this.binData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(d.x0) + 1)
      .attr("width", (d) => Math.max(0, xScale(d.x1) - xScale(d.x0) - 2))
      .attr("y", height) // Start from bottom for animation
      .attr("height", 0)
      .attr("fill", barColor)
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("rx", 1)
      .attr("cursor", this.objectApiName ? "pointer" : "default");

    // Animate bars
    bars
      .transition()
      .duration(750)
      .delay((d, i) => i * 30)
      .attr("y", (d) => yScale(d.length))
      .attr("height", (d) => height - yScale(d.length));

    // Bar interactions
    bars
      .on("mouseenter", (event, d) => {
        this.showBinTooltip(event, d);
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 0.8);
      })
      .on("mouseleave", (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 1);
      })
      .on("click", (event, d) => {
        this.handleBinClick(d);
      });

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
          .tickFormat((d) => formatNumber(d, 0))
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
      .text("Frequency");

    // Draw mean line (optional)
    if (this.config.showMeanLine) {
      this.drawMeanLine(xScale, height);
    }
  }

  /**
   * Calculates thresholds for binning.
   * @param {Function} xScale - D3 x scale
   * @param {Number} width - Chart width
   * @returns {Number|Array} - Threshold specification for D3 bin generator
   */
  getThresholds(xScale, width) {
    // If binCount is specified, use it
    if (this.binCount && this.binCount > 0) {
      return this.binCount;
    }

    // Otherwise, let D3 decide based on data, or use Sturges' formula
    const n = this.rawValues.length;
    const sturges = Math.ceil(Math.log2(n)) + 1;

    // Limit bins based on width
    const maxBins = Math.floor(width / 20);
    return Math.min(sturges, maxBins);
  }

  /**
   * Draws the normal distribution curve overlay.
   * @param {Function} xScale - D3 x scale
   * @param {Function} yScale - D3 y scale
   */
  drawNormalCurve(xScale, yScale) {
    const d3 = this.d3;
    const { mean, stdDev, count } = this.statistics;

    if (stdDev === 0) return;

    // Generate points for the normal curve
    const numPoints = 100;
    const xDomain = xScale.domain();
    const step = (xDomain[1] - xDomain[0]) / numPoints;

    // Calculate bin width for scaling
    const binWidth =
      this.binData.length > 0 ? this.binData[0].x1 - this.binData[0].x0 : 1;

    // Normal PDF function
    const normalPdf = (x) => {
      const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
      const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
      return coefficient * Math.exp(exponent);
    };

    // Generate curve data, scaled to match histogram
    const curveData = [];
    for (let i = 0; i <= numPoints; i++) {
      const x = xDomain[0] + i * step;
      const y = normalPdf(x) * count * binWidth;
      curveData.push({ x, y });
    }

    // Line generator
    const line = d3
      .line()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .curve(d3.curveBasis);

    // Draw the curve
    this.svg
      .append("path")
      .datum(curveData)
      .attr("class", "normal-curve")
      .attr("fill", "none")
      .attr("stroke", "#FF6B6B")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3")
      .attr("opacity", 0.8)
      .attr("d", line);
  }

  /**
   * Draws a vertical line at the mean value.
   * @param {Function} xScale - D3 x scale
   * @param {Number} height - Chart height
   */
  drawMeanLine(xScale, height) {
    const meanX = xScale(this.statistics.mean);

    this.svg
      .append("line")
      .attr("class", "mean-line")
      .attr("x1", meanX)
      .attr("x2", meanX)
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#FF6B6B")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6,3");

    this.svg
      .append("text")
      .attr("class", "mean-label")
      .attr("x", meanX + 5)
      .attr("y", 10)
      .style("font-size", "11px")
      .style("fill", "#FF6B6B")
      .text(`μ = ${formatNumber(this.statistics.mean)}`);
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

  showBinTooltip(event, d) {
    if (!this.tooltip) return;

    const rangeStart = formatNumber(d.x0);
    const rangeEnd = formatNumber(d.x1);
    const count = d.length;
    const percentage = ((count / this.rawValues.length) * 100).toFixed(1);

    const content = `
            <div class="tooltip-content">
                <div style="font-weight: bold; margin-bottom: 4px;">
                    ${rangeStart} – ${rangeEnd}
                </div>
                <div><strong>Count:</strong> ${count}</div>
                <div><strong>Percentage:</strong> ${percentage}%</div>
                ${this.objectApiName ? '<div class="tooltip-hint" style="margin-top: 4px; font-size: 11px; color: #706e6b;">Click to view records</div>' : ""}
            </div>
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

  handleBinClick(d) {
    // Dispatch custom event with bin details
    this.dispatchEvent(
      new CustomEvent("binclick", {
        detail: {
          rangeStart: d.x0,
          rangeEnd: d.x1,
          count: d.length,
          values: [...d],
          field: this.valueField
        },
        bubbles: true,
        composed: true
      })
    );

    // Navigate if configured
    if (!this.objectApiName) return;

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
