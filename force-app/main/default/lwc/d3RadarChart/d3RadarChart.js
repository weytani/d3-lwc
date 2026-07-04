// ABOUTME: D3 Radar Chart Lightning Web Component.
// ABOUTME: Displays multi-axis polygon overlays for scorecards and benchmarking.
import { LightningElement, api, track, wire } from "lwc";
import { loadD3 } from "c/d3Lib";
import { prepareData, OPERATIONS, MAX_RECORDS } from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  createTooltip,
  createResizeHandler,
  buildTooltipContent,
  createLayoutRetry,
  applySvgA11y
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import { gql, graphql } from "lightning/graphql";
import { buildRecordQuery, normalizeRecordsGeneric } from "c/graphqlService";

// Number of concentric grid levels to draw
const GRID_LEVELS = 5;

export default class D3RadarChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field to group entities by (e.g., Type) */
  @api groupByField = "";

  /** Default numeric field */
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

  /**
   * Returns the list of axes for the radar chart.
   * If advancedConfig.axes is defined, uses those.
   * Otherwise falls back to using groupByField aggregation (bar-chart-in-polar style).
   */
  get axes() {
    if (
      this.config.axes &&
      Array.isArray(this.config.axes) &&
      this.config.axes.length > 0
    ) {
      return this.config.axes;
    }
    // Fallback: no multi-axis config, use single valueField
    return [
      { label: this.valueField || "Value", field: this.valueField || "Value" }
    ];
  }

  // ═══════════════════════════════════════════════════════════════
  // GRAPHQL SELF-FETCH PATH (Approach A — additive, CT-REC)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reactive GraphQL query for the self-fetch path. Returns undefined (so the wire
   * is skipped) unless fetchMode is "graphql" and objectApiName/groupByField are set.
   * Radar has no server-side aggregate: it always fetches raw records for
   * groupByField plus every configured axis field, deduped, then feeds the
   * existing _processRawData path (same as recordCollection/soqlQuery).
   */
  get gqlQuery() {
    if (this.fetchMode !== "graphql") return undefined;
    if (!this.objectApiName || !this.groupByField) return undefined;
    const axisFields = this.axes.map((a) => a.field).filter(Boolean);
    const fields = [...new Set([this.groupByField, ...axisFields])];
    if (fields.length === 0) return undefined;
    let queryString;
    try {
      queryString = buildRecordQuery({
        objectApiName: this.objectApiName,
        fields,
        filter: this.graphqlFilter,
        first: this.recordLimit || 2000
      });
    } catch {
      // Unsupported config: leave the wire un-provisioned; error surfaces below.
      return undefined;
    }
    return gql`
      ${queryString}
    `;
  }

  @wire(graphql, { query: "$gqlQuery" })
  wiredRecords({ data, errors }) {
    if (this.fetchMode !== "graphql") return;
    if (errors) {
      this.error = this._formatGqlErrors(errors);
      this.isLoading = false;
      return;
    }
    if (!data) return; // initial undefined emission
    try {
      const axisFields = this.axes.map((a) => a.field).filter(Boolean);
      const fields = [...new Set([this.groupByField, ...axisFields])];
      const records = normalizeRecordsGeneric(data, {
        objectApiName: this.objectApiName,
        fields
      });
      const processed = this._processRawData(records);
      if (!processed.length) {
        this.error = "No data after aggregation";
      } else {
        this.chartData = processed;
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

      // Render will happen in renderedCallback after DOM is ready
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3RadarChart initialization error:", e);
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

    // Priority 1: Use recordCollection if provided (client-side processing)
    if (this.recordCollection && this.recordCollection.length > 0) {
      this.chartData = this._processRawData([...this.recordCollection]);
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
        // Server returns [{label, value}, ...] — convert to radar format
        this.chartData = this._serverDataToRadar(result);
      } catch (e) {
        throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
      }

      if (!this.chartData || this.chartData.length === 0) {
        throw new Error("No data after aggregation");
      }
      return;
    }

    // Priority 3: Fall back to SOQL query with client-side processing
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
   * Converts server-aggregated [{label, value}] data into radar format.
   * Each label becomes an entity with a single axis value.
   */
  _serverDataToRadar(serverData) {
    if (!serverData || serverData.length === 0) {
      return [];
    }
    // Each label becomes an entity, single axis from valueField
    return serverData.map((d) => ({
      entity: d.label,
      values: [
        { axis: this.valueField || "Value", value: d.value, rawValue: d.value }
      ]
    }));
  }

  /**
   * Validates, truncates, and processes raw record data into radar format.
   * Groups by groupByField, computes average of each axis field per group,
   * then normalizes each axis independently to 0-1 scale.
   */
  _processRawData(rawData) {
    // Validate required fields
    const requiredFields = [this.groupByField];

    // Prepare data (validate + truncate)
    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || MAX_RECORDS
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    const data = prepared.data;
    const axesDef = this.axes;

    // Group records by groupByField
    const groups = new Map();
    data.forEach((record) => {
      const key = String(record[this.groupByField] ?? "Null");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(record);
    });

    // For each group, compute average of each axis field
    const entities = [];
    groups.forEach((records, entity) => {
      const values = axesDef.map((axisDef) => {
        const nums = records
          .map((r) => r[axisDef.field])
          .filter((v) => v != null && !isNaN(Number(v)))
          .map(Number);
        const avg =
          nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        return { axis: axisDef.label, value: avg, rawValue: avg };
      });
      entities.push({ entity, values });
    });

    if (entities.length === 0) {
      throw new Error("No data after aggregation");
    }

    // Normalize each axis independently (0-1 scale based on max across all entities)
    const axisCount = axesDef.length;
    for (let i = 0; i < axisCount; i++) {
      const maxVal = Math.max(
        ...entities.map((e) => Math.abs(e.values[i].value))
      );
      if (maxVal > 0) {
        entities.forEach((e) => {
          e.values[i].value = e.values[i].value / maxVal;
        });
      }
    }

    return entities;
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

    const margin = 60;
    const chartHeight = Number(this.height);
    const size = Math.min(containerWidth, chartHeight);
    const radius = (size - margin * 2) / 2;

    if (radius <= 0) return;

    const centerX = containerWidth / 2;
    const centerY = chartHeight / 2;

    const axesDef = this.axes;

    // Create SVG
    const svgRoot = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", chartHeight)
      .attr("class", "radar-chart-svg");

    applySvgA11y(svgRoot, {
      title: `Radar chart: ${this.chartData.length} entities across ${axesDef.length} axes`,
      desc: axesDef.map((a) => a.label).join(", ")
    });

    this.svg = svgRoot
      .append("g")
      .attr("transform", `translate(${centerX},${centerY})`);

    const axisCount = axesDef.length;
    const angleSlice = (2 * Math.PI) / axisCount;

    // Colors
    const colors = getColors(
      this.theme,
      this.chartData.length,
      this.config.customColors
    );

    // Draw concentric grid polygons
    this._renderGrid(d3, axisCount, radius, angleSlice);

    // Draw axis lines
    this._renderAxes(d3, axesDef, axisCount, radius, angleSlice);

    // Draw data polygons
    this._renderPolygons(d3, axisCount, radius, angleSlice, colors);

    // Draw vertex dots
    this._renderVertices(d3, axisCount, radius, angleSlice, colors);
  }

  /**
   * Draws concentric grid polygons at evenly-spaced levels.
   */
  _renderGrid(d3, axisCount, radius, angleSlice) {
    const levels = Array.from(
      { length: GRID_LEVELS },
      (_, i) => (i + 1) / GRID_LEVELS
    );

    levels.forEach((level) => {
      const levelRadius = radius * level;
      const points = [];
      for (let i = 0; i < axisCount; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        points.push([
          levelRadius * Math.cos(angle),
          levelRadius * Math.sin(angle)
        ]);
      }
      // Close the polygon
      const pathData =
        points
          .map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0]},${p[1]}`)
          .join("") + "Z";

      this.svg
        .append("path")
        .attr("d", pathData)
        .attr("class", "grid-polygon")
        .attr("fill", "none")
        .attr("stroke", "#dddbda")
        .attr("stroke-width", 0.5)
        .style("fill-opacity", 0);
    });
  }

  /**
   * Draws axis lines from center to edge and labels at the end.
   */
  _renderAxes(d3, axesDef, axisCount, radius, angleSlice) {
    for (let i = 0; i < axisCount; i++) {
      const angle = i * angleSlice - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      // Axis line
      this.svg
        .append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", y)
        .attr("class", "axis-line")
        .attr("stroke", "#dddbda")
        .attr("stroke-width", 1);

      // Axis label
      const labelX = (radius + 15) * Math.cos(angle);
      const labelY = (radius + 15) * Math.sin(angle);
      const anchor =
        Math.abs(Math.cos(angle)) < 0.01
          ? "middle"
          : Math.cos(angle) > 0
            ? "start"
            : "end";

      this.svg
        .append("text")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("class", "axis-label")
        .attr("text-anchor", anchor)
        .attr("dominant-baseline", "central")
        .style("font-size", "11px")
        .style("fill", "#706e6b")
        .text(axesDef[i].label);
    }
  }

  /**
   * Draws data polygons, one per entity with theme color + 0.2 opacity fill.
   */
  _renderPolygons(d3, axisCount, radius, angleSlice, colors) {
    this.chartData.forEach((entity, entityIdx) => {
      const points = [];
      for (let i = 0; i < axisCount; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const value = entity.values[i] ? entity.values[i].value : 0;
        points.push([
          radius * value * Math.cos(angle),
          radius * value * Math.sin(angle)
        ]);
      }
      const pathData =
        points
          .map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0]},${p[1]}`)
          .join("") + "Z";

      this.svg
        .append("path")
        .attr("d", pathData)
        .attr("class", "radar-polygon")
        .attr("fill", colors[entityIdx])
        .attr("stroke", colors[entityIdx])
        .attr("stroke-width", 2)
        .style("fill-opacity", 0.2);
    });
  }

  /**
   * Draws dots at each vertex and attaches tooltip handlers.
   */
  _renderVertices(d3, axisCount, radius, angleSlice, colors) {
    this.chartData.forEach((entity, entityIdx) => {
      for (let i = 0; i < axisCount; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const value = entity.values[i] ? entity.values[i].value : 0;
        const rawValue = entity.values[i] ? entity.values[i].rawValue : 0;
        const axisLabel = entity.values[i] ? entity.values[i].axis : "";
        const cx = radius * value * Math.cos(angle);
        const cy = radius * value * Math.sin(angle);

        this.svg
          .append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", 4)
          .attr("class", "radar-vertex")
          .attr("fill", colors[entityIdx])
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .attr("cursor", this.objectApiName ? "pointer" : "default")
          .on("mouseenter", (event) => {
            this.showTooltip(event, entity.entity, axisLabel, rawValue);
          })
          .on("mouseleave", () => {
            this.hideTooltip();
          })
          .on("click", () => {
            this.handleVertexClick(entity.entity, axisLabel, rawValue);
          });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, entityName, axisLabel, value) {
    if (!this.tooltip) return;

    const content = buildTooltipContent(entityName, value, {
      prefix: `${axisLabel}: `
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

  handleVertexClick(entityName, axisLabel, rawValue) {
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
      new CustomEvent("radarclick", {
        detail: {
          entity: entityName,
          axis: axisLabel,
          value: rawValue,
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
