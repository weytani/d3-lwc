// ABOUTME: D3 Bubble Chart Lightning Web Component — scatter plot with a third numeric dimension.
// ABOUTME: Bubble area (via d3.scaleSqrt) encodes the size field; click navigates to the record.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  sampleData,
  SVG_ELEMENT_CAP,
  CHART_LIMITS
} from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  createTooltip,
  createResizeHandler,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getXYData from "@salesforce/apex/D3ChartController.getXYData";

export default class D3BubbleChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty and no objectApiName) */
  @api soqlQuery = "";

  /** Field for X-axis (numeric) */
  @api xAxisField = "";

  /** Field for Y-axis (numeric) */
  @api yAxisField = "";

  /** Field driving bubble size (numeric) */
  @api sizeField = "";

  /** Label for X-axis */
  @api xAxisLabel = "";

  /** Label for Y-axis */
  @api yAxisLabel = "";

  /** Display label for the size dimension (tooltip) */
  @api sizeLabel = "";

  /** Field used as the bubble label (server path) / category */
  @api labelField = "";

  /** Field containing the record ID for navigation */
  @api recordIdField = "Id";

  /** Object API name for navigation and the server getXYData path */
  @api objectApiName = "";

  /** Optional WHERE clause appended on the server path */
  @api filterClause = "";

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Maximum records to process (overrides default chart limit) */
  @api recordLimit;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

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

  get effectiveXLabel() {
    return this.xAxisLabel || this.xAxisField;
  }

  get effectiveYLabel() {
    return this.yAxisLabel || this.yAxisField;
  }

  get effectiveSizeLabel() {
    return this.sizeLabel || this.sizeField;
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
      console.error("D3BubbleChart initialization error:", e);
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
    // Server path: typed getXYData when object + all field mappings present
    if (
      !this.recordCollection?.length &&
      this.objectApiName &&
      this.xAxisField &&
      this.yAxisField &&
      this.sizeField
    ) {
      let serverRows;
      try {
        serverRows = await getXYData({
          objectName: this.objectApiName,
          xField: this.xAxisField,
          yField: this.yAxisField,
          sizeField: this.sizeField,
          labelField: this.labelField || null,
          filterClause: this.filterClause || null
        });
      } catch (e) {
        throw new Error(`Data Error: ${e.body?.message || e.message}`);
      }
      this.chartData = (serverRows || [])
        .map((row) => {
          const x = Number(row.x);
          const y = Number(row.y);
          const size = Number(row.size);
          if (isNaN(x) || isNaN(y)) return null;
          return {
            x,
            y,
            size: isNaN(size) ? 0 : size,
            label: row.label != null ? String(row.label) : "",
            id: null,
            record: row
          };
        })
        .filter((d) => d !== null);
      this.capData();
      if (this.chartData.length === 0) {
        throw new Error("No valid data points after processing");
      }
      return;
    }

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
        "No data source provided. Set recordCollection, objectApiName, or soqlQuery."
      );
    }

    const requiredFields = [this.xAxisField, this.yAxisField, this.sizeField];

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || CHART_LIMITS.BUBBLE
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    this.processBubbleData(prepared.data);
    this.capData();

    if (this.chartData.length === 0) {
      throw new Error("No valid data points after processing");
    }
  }

  /**
   * Parses raw client records into bubble format {x,y,size,label,id,record}.
   * @param {Array} data - Raw records
   */
  processBubbleData(data) {
    this.chartData = data
      .map((record) => {
        const x = Number(record[this.xAxisField]);
        const y = Number(record[this.yAxisField]);
        const size = Number(record[this.sizeField]);
        const id = record[this.recordIdField];
        const label = this.labelField
          ? String(record[this.labelField] || "")
          : "";
        if (isNaN(x) || isNaN(y)) return null;
        return { x, y, size: isNaN(size) ? 0 : size, label, id, record };
      })
      .filter((d) => d !== null);
  }

  /** Samples chartData down to the SVG element cap for performance. */
  capData() {
    if (this.chartData.length > SVG_ELEMENT_CAP) {
      const sampleResult = sampleData(this.chartData, "size", SVG_ELEMENT_CAP);
      this.chartData = sampleResult.data;
    }
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

    d3.select(container).select("svg").remove();

    const padding = Math.max(10, Math.round(containerWidth * 0.04));
    const margin = {
      top: padding + 5,
      right: padding + 10,
      bottom: Math.max(40, Math.round(containerWidth * 0.1)),
      left: Math.max(40, Math.round(containerWidth * 0.12))
    };

    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "bubble-chart-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(this.chartData, (d) => d.x);
    const yExtent = d3.extent(this.chartData, (d) => d.y);
    const sizeExtent = d3.extent(this.chartData, (d) => d.size);

    const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 1;

    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
      .range([0, width])
      .nice();

    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([height, 0])
      .nice();

    // scaleSqrt so AREA (not radius) encodes the size value
    const radiusScale = d3
      .scaleSqrt()
      .domain([0, sizeExtent[1] || 1])
      .range([4, 40]);

    const colors = getColors(this.theme, 1, this.config.customColors);
    const bubbleColor = colors[0];

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

    this.svg
      .append("text")
      .attr("class", "axis-label x-axis-label")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#706e6b")
      .text(this.effectiveXLabel);

    this.svg
      .append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(this.getTickCount(height))
          .tickFormat((d) => formatNumber(d))
      );

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

    const bubbles = this.svg
      .selectAll(".bubble")
      .data(this.chartData)
      .enter()
      .append("circle")
      .attr("class", "bubble")
      .attr("cx", (d) => xScale(d.x))
      .attr("cy", (d) => yScale(d.y))
      .attr("r", 0)
      .attr("fill", bubbleColor)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .attr("opacity", 0.7);

    bubbles
      .transition()
      .duration(500)
      .delay((d, i) => i * 5)
      .attr("r", (d) => radiusScale(d.size));

    bubbles
      .on("mouseenter", (event, d) => {
        this.showTooltip(event, d);
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 1);
      })
      .on("mouseleave", (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 0.7);
      })
      .on("click", (event, d) => {
        this.handleBubbleClick(d);
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

  showTooltip(event, d) {
    if (!this.tooltip) return;

    const labelInfo = d.label
      ? `<div style="margin-bottom: 8px;"><strong>${d.label}</strong></div>`
      : "";

    const content = `
            ${labelInfo}
            <div><strong>${this.effectiveXLabel}:</strong> ${formatNumber(d.x)}</div>
            <div><strong>${this.effectiveYLabel}:</strong> ${formatNumber(d.y)}</div>
            <div><strong>${this.effectiveSizeLabel}:</strong> ${formatNumber(d.size)}</div>
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

  handleBubbleClick(d) {
    this.dispatchEvent(
      new CustomEvent("bubbleclick", {
        detail: {
          x: d.x,
          y: d.y,
          size: d.size,
          label: d.label,
          recordId: d.id,
          record: d.record
        },
        bubbles: true,
        composed: true
      })
    );

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
