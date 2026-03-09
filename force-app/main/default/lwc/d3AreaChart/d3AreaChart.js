// ABOUTME: D3 Area Chart Lightning Web Component.
// ABOUTME: Displays time series data as filled areas with stacked/overlapping modes and gradient fill.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import { prepareData, CHART_LIMITS } from "c/dataService";
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

export default class D3AreaChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery =
    "SELECT CloseDate, Amount FROM Opportunity ORDER BY CloseDate";

  /** Date field for X-axis (time series) */
  @api dateField = "CloseDate";

  /** Value field for Y-axis */
  @api valueField = "Amount";

  /** Optional series field for multi-area support */
  @api seriesField = "";

  /** Date format for parsing (ISO, US, EU, or custom) */
  @api dateFormat = "ISO";

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Show legend (defaults to true for multi-series) */
  @api showLegend;

  /** Curve type: linear, monotone, step */
  @api curveType = "monotone";

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment */
  @api filterClause = "";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track chartData = [];
  @track seriesData = [];
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
    return this.seriesData && this.seriesData.length > 0;
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get effectiveShowLegend() {
    if (this.showLegend !== undefined) {
      return this.showLegend;
    }
    return this.seriesData.length > 1;
  }

  get legendItems() {
    if (!this.seriesData || !this.effectiveShowLegend) return [];
    const colors = getColors(
      this.theme,
      this.seriesData.length,
      this.config.customColors
    );
    return this.seriesData.map((series, i) => ({
      name: series.name,
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
  // LIFECYCLE HOOKS
  // ═══════════════════════════════════════════════════════════════

  async connectedCallback() {
    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3AreaChart initialization error:", e);
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
    } else if (this.soqlQuery) {
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

    const requiredFields = [this.dateField, this.valueField];
    const prepared = prepareData(rawData, {
      requiredFields,
      limit: CHART_LIMITS.AREA
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    if (prepared.truncated) {
      this.truncatedWarning = `Displaying first ${CHART_LIMITS.AREA.toLocaleString()} of ${prepared.originalCount} records`;
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Data Truncated",
          message: this.truncatedWarning,
          variant: "warning"
        })
      );
    }

    this.processTimeSeriesData(prepared.data);

    if (this.seriesData.length === 0) {
      throw new Error("No data after processing");
    }
  }

  /**
   * Processes raw data into time series format with optional multi-series support.
   * @param {Array} data - Raw data records
   */
  processTimeSeriesData(data) {
    const parseDate = this.getDateParser();

    const processedData = data
      .map((record) => {
        const date = parseDate(record[this.dateField]);
        const value = Number(record[this.valueField]);
        const series = this.seriesField
          ? String(record[this.seriesField] || "Default")
          : "Default";

        if (date && !isNaN(date.getTime()) && !isNaN(value)) {
          return { date, value, series, record };
        }
        return null;
      })
      .filter((d) => d !== null);

    const seriesMap = new Map();
    processedData.forEach((d) => {
      if (!seriesMap.has(d.series)) {
        seriesMap.set(d.series, []);
      }
      seriesMap.get(d.series).push(d);
    });

    this.seriesData = [];
    seriesMap.forEach((points, name) => {
      points.sort((a, b) => a.date - b.date);
      this.seriesData.push({ name, points });
    });

    this.chartData = processedData;
  }

  /**
   * Returns a date parser function based on dateFormat setting.
   * @returns {Function} - Date parser function
   */
  getDateParser() {
    switch (this.dateFormat) {
      case "US":
        return (str) => {
          if (!str) return null;
          if (str instanceof Date) return str;
          const parts = String(str).split("/");
          if (parts.length === 3) {
            return new Date(parts[2], parts[0] - 1, parts[1]);
          }
          return new Date(str);
        };
      case "EU":
        return (str) => {
          if (!str) return null;
          if (str instanceof Date) return str;
          const parts = String(str).split("/");
          if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
          }
          return new Date(str);
        };
      case "ISO":
      default:
        return (str) => {
          if (!str) return null;
          if (str instanceof Date) return str;
          return new Date(str);
        };
    }
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

    // Clear existing SVG
    d3.select(container).select("svg").remove();

    // Margins
    const legendHeight = this.effectiveShowLegend ? 30 : 0;
    const margin = {
      top: 20,
      right: 30,
      bottom: 50 + legendHeight,
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
      .attr("class", "area-chart-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Get all data points for scale calculations
    const allPoints = this.seriesData.flatMap((s) => s.points);

    // X Scale (time)
    const xExtent = d3.extent(allPoints, (d) => d.date);
    const xScale = d3.scaleTime().domain(xExtent).range([0, width]);

    // Y Scale
    const yMax = d3.max(allPoints, (d) => d.value) || 0;
    const yMin = d3.min(allPoints, (d) => d.value) || 0;
    const yPadding = (yMax - yMin) * 0.1 || 1;

    const yScale = d3
      .scaleLinear()
      .domain([Math.min(0, yMin - yPadding), yMax + yPadding])
      .nice()
      .range([height, 0]);

    // Colors
    const colors = getColors(
      this.theme,
      this.seriesData.length,
      this.config.customColors
    );

    // Grid lines
    if (this.config.showGrid !== false) {
      this.svg
        .append("g")
        .attr("class", "grid grid-y")
        .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "2,2");

      this.svg.select(".grid-y .domain").remove();
    }

    // X Axis
    const xAxis = this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(this.getTickCount(width))
          .tickFormat((d) => this.formatDate(d))
      );

    if (width < 400) {
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

    // Clip-path for animated reveal
    const clipId = `area-clip-${Date.now()}`;
    const clipDefs = this.svg.append("defs");
    clipDefs
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", 0)
      .attr("height", height + margin.top)
      .attr("y", -margin.top)
      .transition()
      .duration(1000)
      .ease(d3.easeLinear)
      .attr("width", width);

    // Determine area mode
    const areaMode = this.config.areaMode || "overlapping";
    const isMultiSeries = this.seriesData.length > 1;

    if (
      (areaMode === "stacked" || areaMode === "normalized") &&
      isMultiSeries
    ) {
      this.renderStackedAreas(
        d3,
        xScale,
        yScale,
        width,
        height,
        colors,
        clipId,
        areaMode
      );
    } else {
      this.renderOverlappingAreas(
        d3,
        xScale,
        yScale,
        height,
        colors,
        clipId,
        isMultiSeries,
        clipDefs
      );
    }
  }

  /**
   * Renders areas in overlapping mode (default).
   * Single-series gets a gradient fill; multi-series gets distinct colors with opacity.
   */
  renderOverlappingAreas(
    d3,
    xScale,
    yScale,
    height,
    colors,
    clipId,
    isMultiSeries,
    clipDefs
  ) {
    const curve = this.getCurve(d3);

    // Area generator
    const area = d3
      .area()
      .x((d) => xScale(d.date))
      .y0(yScale(0))
      .y1((d) => yScale(d.value))
      .curve(curve);

    // Line generator for the stroke on top
    const line = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(curve);

    this.seriesData.forEach((series, i) => {
      const seriesGroup = this.svg
        .append("g")
        .attr("class", `series series-${i}`)
        .attr("clip-path", `url(#${clipId})`);

      let fillValue;

      if (!isMultiSeries) {
        // Single series: gradient fill
        const gradientId = `area-gradient-${i}-${Date.now()}`;
        const gradient = clipDefs
          .append("linearGradient")
          .attr("id", gradientId)
          .attr("x1", "0%")
          .attr("y1", "0%")
          .attr("x2", "0%")
          .attr("y2", "100%");

        gradient
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", colors[i])
          .attr("stop-opacity", 0.6);

        gradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", colors[i])
          .attr("stop-opacity", 0.05);

        fillValue = `url(#${gradientId})`;
      } else {
        fillValue = colors[i];
      }

      // Draw area
      seriesGroup
        .append("path")
        .datum(series.points)
        .attr("class", "area-path")
        .attr("d", area)
        .attr("fill", fillValue)
        .attr("fill-opacity", isMultiSeries ? 0.3 : 1)
        .attr("cursor", this.objectApiName ? "pointer" : "default")
        .on("mouseenter", (event, d) => {
          this.showTooltipForSeries(event, series, colors[i]);
        })
        .on("mouseleave", () => {
          this.hideTooltip();
        })
        .on("click", () => {
          this.handleAreaClick(series);
        });

      // Stroke line on top
      seriesGroup
        .append("path")
        .datum(series.points)
        .attr("class", "area-stroke")
        .attr("fill", "none")
        .attr("stroke", colors[i])
        .attr("stroke-width", 2)
        .attr("d", line);
    });
  }

  /**
   * Renders areas in stacked or normalized mode using d3.stack().
   */
  renderStackedAreas(
    d3,
    xScale,
    origYScale,
    width,
    height,
    colors,
    clipId,
    areaMode
  ) {
    const curve = this.getCurve(d3);
    const seriesNames = this.seriesData.map((s) => s.name);

    // Build tabular data keyed by date for stacking
    const dateMap = new Map();
    this.seriesData.forEach((series) => {
      series.points.forEach((p) => {
        const key = p.date.getTime();
        if (!dateMap.has(key)) {
          dateMap.set(key, { date: p.date });
        }
        dateMap.get(key)[series.name] = p.value;
      });
    });

    // Fill missing series values with 0
    const tableData = Array.from(dateMap.values())
      .sort((a, b) => a.date - b.date)
      .map((row) => {
        seriesNames.forEach((name) => {
          if (row[name] === undefined) {
            row[name] = 0;
          }
        });
        return row;
      });

    // Configure stack
    const stackGen = d3.stack().keys(seriesNames).order(d3.stackOrderNone);

    if (areaMode === "normalized") {
      stackGen.offset(d3.stackOffsetExpand);
    } else {
      stackGen.offset(d3.stackOffsetNone);
    }

    const stackedData = stackGen(tableData);

    // Recalculate y-scale for stacked data
    let yMaxStacked = 0;
    stackedData.forEach((layer) => {
      layer.forEach((d) => {
        if (d[1] > yMaxStacked) yMaxStacked = d[1];
      });
    });

    const yScale = d3
      .scaleLinear()
      .domain([0, areaMode === "normalized" ? 1 : yMaxStacked * 1.1])
      .nice()
      .range([height, 0]);

    const area = d3
      .area()
      .x((d) => xScale(d.data.date))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(curve);

    const line = d3
      .line()
      .x((d) => xScale(d.data.date))
      .y((d) => yScale(d[1]))
      .curve(curve);

    stackedData.forEach((layer, i) => {
      const seriesGroup = this.svg
        .append("g")
        .attr("class", `series series-${i}`)
        .attr("clip-path", `url(#${clipId})`);

      // Area fill
      seriesGroup
        .append("path")
        .datum(layer)
        .attr("class", "area-path")
        .attr("d", area)
        .attr("fill", colors[i])
        .attr("fill-opacity", 0.3)
        .attr("cursor", this.objectApiName ? "pointer" : "default")
        .on("mouseenter", (event) => {
          this.showTooltipForSeries(event, this.seriesData[i], colors[i]);
        })
        .on("mouseleave", () => {
          this.hideTooltip();
        })
        .on("click", () => {
          this.handleAreaClick(this.seriesData[i]);
        });

      // Stroke line on top
      seriesGroup
        .append("path")
        .datum(layer)
        .attr("class", "area-stroke")
        .attr("fill", "none")
        .attr("stroke", colors[i])
        .attr("stroke-width", 2)
        .attr("d", line);
    });
  }

  /**
   * Returns D3 curve function based on curveType setting.
   * @param {Object} d3 - D3 instance
   * @returns {Function} - D3 curve function
   */
  getCurve(d3) {
    switch (this.curveType) {
      case "linear":
        return d3.curveLinear;
      case "step":
        return d3.curveStepAfter;
      case "monotone":
      default:
        return d3.curveMonotoneX;
    }
  }

  /**
   * Returns appropriate tick count based on chart width.
   * @param {Number} width - Chart width
   * @returns {Number} - Number of ticks
   */
  getTickCount(width) {
    if (width < 300) return 3;
    if (width < 500) return 5;
    return 7;
  }

  /**
   * Formats date for axis display.
   * @param {Date} date - Date to format
   * @returns {String} - Formatted date string
   */
  formatDate(date) {
    if (!date) return "";
    const month = date.toLocaleString("default", { month: "short" });
    const year = date.getFullYear();

    if (this.chartData.length > 0) {
      const years = new Set(this.chartData.map((d) => d.date.getFullYear()));
      if (years.size > 1) {
        return `${month} ${year}`;
      }
    }
    return month;
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltipForSeries(event, series, color) {
    if (!this.tooltip) return;

    const latestPoint = series.points[series.points.length - 1];
    const dateStr = this.formatDate(latestPoint?.date);
    const totalValue = series.points.reduce((sum, p) => sum + p.value, 0);

    const content = `
      <div style="border-left: 3px solid ${color}; padding-left: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">${truncateLabel(series.name, 20)}</div>
        <div>${dateStr}</div>
        <div style="font-size: 14px; font-weight: bold; margin-top: 4px;">
          ${formatNumber(totalValue)}
        </div>
      </div>
    `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleAreaClick(series) {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.dateField;

    this[NavigationMixin.Navigate]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.objectApiName,
        actionName: "list"
      }
    });

    this.dispatchEvent(
      new CustomEvent("areaclick", {
        detail: {
          series: series.name,
          pointCount: series.points.length,
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
    const seriesName = event.currentTarget.dataset.series;

    this.dispatchEvent(
      new CustomEvent("legendclick", {
        detail: { series: seriesName },
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
