// ABOUTME: D3 Bullet Chart Lightning Web Component.
// ABOUTME: Displays a single KPI value against a target with qualitative range backgrounds.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import { getColor } from "c/themeService";
import {
  formatNumber,
  formatCurrency,
  createTooltip,
  createResizeHandler,
  buildTooltipContent,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";

// Default qualitative range gray shades (lightest to darkest)
const RANGE_COLORS = ["#e0e0e0", "#c0c0c0", "#a0a0a0"];

export default class D3BulletChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field containing the numeric value */
  @api valueField = "Amount";

  /** Chart height in pixels */
  @api height = 150;

  /** Color theme for the feature bar */
  @api theme = "Salesforce Standard";

  /** Advanced configuration JSON */
  @api advancedConfig = "";

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side aggregation */
  @api filterClause = "";

  /** Minimum value for the chart scale */
  @api minValue = 0;

  /** Maximum value for the chart scale */
  @api maxValue = 100;

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track currentValue = 0;
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
    // Bullet chart always has data if we got past loading without error
    // (even a zero value is valid)
    return !this.error && this.d3 !== null;
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

  get valueFormatter() {
    const format = this.config.valueFormat || "number";
    switch (format) {
      case "currency":
        return formatCurrency;
      default:
        return formatNumber;
    }
  }

  get effectiveMaxValue() {
    return this.config.maxValue ?? this.maxValue ?? 100;
  }

  get effectiveMinValue() {
    return this.config.minValue ?? this.minValue ?? 0;
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
      console.error("D3BulletChart initialization error:", e);
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
    // Priority 1: Use recordCollection if provided (take first record's value)
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.processData(this.recordCollection);
      return;
    }

    // Priority 2: Server-side aggregation when objectApiName and valueField are set
    if (this.objectApiName && this.valueField) {
      try {
        const result = await getAggregatedData({
          objectName: this.objectApiName,
          groupByField: "Id",
          valueField: this.valueField,
          operation: "Average",
          filterClause: this.filterClause || null
        });
        if (result && result.length > 0) {
          this.currentValue = Number(result[0].value) || 0;
        }
      } catch (e) {
        throw new Error(
          `Aggregation Error: ${e.body?.message || e.message}`
        );
      }
      return;
    }

    // Priority 3: Fall back to SOQL query
    if (this.soqlQuery) {
      let rawData = [];
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      this.processData(rawData);
      return;
    }

    throw new Error(
      "No data source provided. Set recordCollection or soqlQuery."
    );
  }

  /**
   * Extracts the numeric value from the first record.
   */
  processData(records) {
    if (!records || records.length === 0) {
      this.currentValue = 0;
      return;
    }

    const record = records[0];
    const rawValue = record[this.valueField];
    this.currentValue = Number(rawValue) || 0;
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
    const margin = { top: 20, right: 20, bottom: 40, left: 20 };
    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    // Create SVG
    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "bullet-chart-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const config = this.config;

    // X Scale (linear, horizontal)
    const xScale = d3
      .scaleLinear()
      .domain([this.effectiveMinValue, this.effectiveMaxValue])
      .range([0, width])
      .clamp(true);

    // Bar vertical centering
    const barHeight = height * 0.5;
    const barY = (height - barHeight) / 2;
    const featureBarHeight = barHeight * 0.5;
    const featureBarY = barY + (barHeight - featureBarHeight) / 2;

    // Qualitative range backgrounds (3 rects, sorted largest to smallest)
    const ranges = config.ranges || this._defaultRanges();
    const sortedRanges = [...ranges].sort((a, b) => b - a);

    sortedRanges.forEach((rangeValue, i) => {
      this.svg
        .append("rect")
        .attr("x", 0)
        .attr("y", barY)
        .attr("width", xScale(rangeValue))
        .attr("height", barHeight)
        .attr("fill", RANGE_COLORS[i] || "#e0e0e0");
    });

    // Feature measure bar (actual value) with theme accent color
    const accentColor = this._getAccentColor();

    this.svg
      .append("rect")
      .attr("class", "feature-bar")
      .attr("x", 0)
      .attr("y", featureBarY)
      .attr("width", 0)
      .attr("height", featureBarHeight)
      .attr("fill", accentColor)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .transition()
      .duration(750)
      .attr("width", xScale(this.currentValue));

    // Target marker (vertical line)
    if (config.target !== undefined && config.target !== null) {
      this.svg
        .append("line")
        .attr("x1", xScale(config.target))
        .attr("x2", xScale(config.target))
        .attr("y1", barY - 4)
        .attr("y2", barY + barHeight + 4)
        .attr("stroke", "#333")
        .attr("stroke-width", 2.5);
    }

    // X-axis
    this.svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale).tickFormat((d) => this.valueFormatter(d))
      );

    // Tooltip and click interactions on feature bar
    this.svg
      .selectAll(".feature-bar")
      .on("mouseenter", (event) => {
        this.showTooltip(event);
      })
      .on("mousemove", () => {
        // Position handled in show
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      })
      .on("click", () => {
        this.handleBarClick();
      });
  }

  /**
   * Generates 3 default range breakpoints from the scale range.
   * Divides the range into thirds: [33%, 67%, 100%] of maxValue.
   */
  _defaultRanges() {
    const min = this.effectiveMinValue;
    const max = this.effectiveMaxValue;
    const span = max - min;
    return [
      min + span * 0.33,
      min + span * 0.67,
      max
    ];
  }

  /**
   * Returns the accent color for the feature bar, respecting customColors override.
   */
  _getAccentColor() {
    const config = this.config;
    if (
      config.customColors &&
      Array.isArray(config.customColors) &&
      config.customColors.length > 0
    ) {
      return config.customColors[0];
    }
    return getColor(this.theme, 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event) {
    if (!this.tooltip) return;

    const config = this.config;
    const label = config.label || this.valueField || "Value";
    const content = buildTooltipContent(label, this.currentValue, {
      formatter: this.valueFormatter
    });

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleBarClick() {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.valueField;

    // Navigate to object list view
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
      new CustomEvent("bulletclick", {
        detail: {
          value: this.currentValue,
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
