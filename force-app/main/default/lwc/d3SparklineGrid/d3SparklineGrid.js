// ABOUTME: D3 Sparkline Grid Lightning Web Component.
// ABOUTME: Displays small multiples inline mini-charts for entity comparison with monthly aggregation.
import { LightningElement, api, track, wire } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  OPERATIONS,
  CHART_LIMITS,
  applyFilterClause
} from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  truncateLabel,
  createTooltip,
  createResizeHandler,
  createLayoutRetry,
  buildTooltipContent,
  applySvgA11y
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import { gql, graphql } from "lightning/graphql";
import { buildRecordQuery, normalizeRecordsGeneric } from "c/graphqlService";

export default class D3SparklineGrid extends NavigationMixin(LightningElement) {
  // ===============================================================
  // PUBLIC API PROPERTIES
  // ===============================================================

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery =
    "SELECT Type, CloseDate, Amount FROM Opportunity ORDER BY CloseDate";

  /** Field to group entities by (e.g., Type, Owner) */
  @api entityField = "";

  /** Time field for x-axis */
  @api dateField = "CloseDate";

  /** Numeric field for values */
  @api valueField = "Amount";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 400;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment */
  @api filterClause = "";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  /** Fetch-mode selector: "auto" (default, existing priority order), "apex", or "graphql". */
  @api fetchMode = "auto";

  /** Structured filter for the GraphQL path: { field, operator, value }. */
  @api graphqlFilter;

  // ===============================================================
  // TRACKED STATE
  // ===============================================================

  @track isLoading = true;
  @track error = null;
  @track entityData = [];
  // ===============================================================
  // PRIVATE PROPERTIES
  // ===============================================================

  d3 = null;
  svg = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  _layoutRetry = null;
  _config = {};
  _configParsed = false;

  // ===============================================================
  // GETTERS
  // ===============================================================

  get containerStyle() {
    return `height: ${this.height}px;`;
  }

  get hasError() {
    return !!this.error;
  }

  get hasData() {
    return this.entityData && this.entityData.length > 0;
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

  // ===============================================================
  // GRAPHQL SELF-FETCH PATH (Approach A — additive, CT-REC)
  // ===============================================================

  /**
   * Reactive GraphQL query for the self-fetch path. Returns undefined (so the
   * wire is skipped) unless fetchMode is "graphql" and objectApiName/entityField
   * /dateField are set. Sparkline grid has no server-side aggregate: it always
   * fetches raw records for entityField, dateField, and (if set) valueField,
   * then feeds the existing recordCollection processing path
   * (processEntityData), same as recordCollection/soqlQuery.
   */
  get gqlQuery() {
    if (this.fetchMode !== "graphql") return undefined;
    if (!this.objectApiName || !this.entityField || !this.dateField) {
      return undefined;
    }
    const fields = [
      ...new Set(
        [this.entityField, this.dateField, this.valueField].filter(Boolean)
      )
    ];
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
      const fields = [
        ...new Set(
          [this.entityField, this.dateField, this.valueField].filter(Boolean)
        )
      ];
      const records = normalizeRecordsGeneric(data, {
        objectApiName: this.objectApiName,
        fields
      });
      this.processEntityData(records);
      if (this.entityData.length === 0) {
        this.error = "No data after processing";
      } else {
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

  // ===============================================================
  // LIFECYCLE HOOKS
  // ===============================================================

  async connectedCallback() {
    try {
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3SparklineGrid initialization error:", e);
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

  // ===============================================================
  // DATA LOADING
  // ===============================================================

  async loadData() {
    // GraphQL path is handled reactively by the @wire(graphql) — nothing to do here.
    if (this.fetchMode === "graphql") {
      return;
    }

    let rawData = [];

    if (this.recordCollection && this.recordCollection.length > 0) {
      rawData = [...this.recordCollection];
    } else if (this.soqlQuery) {
      try {
        rawData = await executeQuery({
          queryString: applyFilterClause(this.soqlQuery, this.filterClause)
        });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
    } else {
      throw new Error(
        "No data source provided. Set recordCollection or soqlQuery."
      );
    }

    // Required fields
    const requiredFields = [this.entityField, this.dateField];
    if (this.operation !== OPERATIONS.COUNT) {
      requiredFields.push(this.valueField);
    }

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || CHART_LIMITS.SPARKLINE_GRID
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    // Process into entity-grouped sparkline data
    this.processEntityData(prepared.data);

    if (this.entityData.length === 0) {
      throw new Error("No data after processing");
    }
  }

  /**
   * Groups records by entityField, buckets by month, and aggregates values.
   * Result: [{ entity, currentValue, sparklineData: [{date, value}] }]
   */
  processEntityData(data) {
    // Group by entity
    const entityMap = new Map();

    data.forEach((record) => {
      const entityKey = String(record[this.entityField] ?? "Null");
      if (!entityMap.has(entityKey)) {
        entityMap.set(entityKey, []);
      }
      entityMap.get(entityKey).push(record);
    });

    // For each entity, bucket by month and aggregate
    this.entityData = [];
    entityMap.forEach((records, entity) => {
      const monthBuckets = new Map();

      records.forEach((record) => {
        const dateVal = record[this.dateField];
        if (!dateVal) return;

        const date = new Date(dateVal);
        if (isNaN(date.getTime())) return;

        // Bucket key: YYYY-MM
        const bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!monthBuckets.has(bucketKey)) {
          monthBuckets.set(bucketKey, { sum: 0, count: 0 });
        }
        const bucket = monthBuckets.get(bucketKey);
        bucket.count += 1;
        if (this.valueField && record[this.valueField] != null) {
          bucket.sum += Number(record[this.valueField]) || 0;
        }
      });

      // Convert buckets to sorted sparkline data
      const sparklineData = [];
      monthBuckets.forEach((bucket, bucketKey) => {
        let value;
        switch (this.operation) {
          case OPERATIONS.SUM:
            value = bucket.sum;
            break;
          case OPERATIONS.COUNT:
            value = bucket.count;
            break;
          case OPERATIONS.AVERAGE:
            value = bucket.count > 0 ? bucket.sum / bucket.count : 0;
            break;
          default:
            value = bucket.count;
        }

        // Parse bucket key back to date (first day of month)
        const [year, month] = bucketKey.split("-").map(Number);
        const date = new Date(year, month - 1, 1);

        sparklineData.push({ date, value });
      });

      // Sort by date ascending
      sparklineData.sort((a, b) => a.date - b.date);

      // Current value = last data point
      const currentValue =
        sparklineData.length > 0
          ? sparklineData[sparklineData.length - 1].value
          : 0;

      this.entityData.push({ entity, currentValue, sparklineData });
    });

    // Sort entities by currentValue descending
    this.entityData.sort((a, b) => b.currentValue - a.currentValue);
  }

  // ===============================================================
  // CHART RENDERING
  // ===============================================================

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

    // Layout constants
    const labelWidth = 120;
    const valueWidth = 80;
    const sparkWidth = containerWidth - labelWidth - valueWidth - 40;
    const rowHeight = 40;
    const sparkHeight = 30;
    const sparkPadding = 5;
    const totalHeight = Math.max(
      this.height,
      this.entityData.length * rowHeight + 20
    );

    if (sparkWidth <= 0) return;

    // Colors
    const colors = getColors(
      this.theme,
      this.entityData.length,
      this.config.customColors
    );

    // Create SVG
    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", totalHeight)
      .attr("class", "sparkline-grid-svg");

    applySvgA11y(svg, {
      title: `Sparkline grid: ${this.entityData.length} entities`,
      desc: `${this.operation} of ${this.valueField} by ${this.dateField}, grouped by ${this.entityField}`
    });

    this.svg = svg;

    // Render each entity row
    this.entityData.forEach((entityItem, i) => {
      const rowG = svg
        .append("g")
        .attr("class", "entity-row")
        .attr("transform", `translate(0, ${i * rowHeight + 10})`)
        .attr("cursor", this.objectApiName ? "pointer" : "default")
        .on("click", () => {
          this.handleRowClick(entityItem);
        });

      const color = colors[i];

      // Entity label (left)
      rowG
        .append("text")
        .attr("class", "entity-label")
        .attr("x", 10)
        .attr("y", rowHeight / 2 + 4)
        .attr("fill", "#706e6b")
        .text(truncateLabel(entityItem.entity, 15));

      // Sparkline mini chart (center)
      const sparkG = rowG
        .append("g")
        .attr("class", "sparkline-container")
        .attr("transform", `translate(${labelWidth}, ${sparkPadding})`);

      this.renderSparkline(
        d3,
        sparkG,
        entityItem.sparklineData,
        sparkWidth,
        sparkHeight,
        color,
        entityItem.entity
      );

      // Current value (right)
      rowG
        .append("text")
        .attr("class", "entity-value")
        .attr("x", labelWidth + sparkWidth + 15)
        .attr("y", rowHeight / 2 + 4)
        .attr("fill", "#3e3e3c")
        .text(formatNumber(entityItem.currentValue));
    });
  }

  /**
   * Renders a single sparkline within a group element.
   */
  renderSparkline(d3, group, sparklineData, width, height, color, entityName) {
    if (!sparklineData || sparklineData.length === 0) return;

    const sparkType = this.config.sparkType || "line";

    // X scale
    const xExtent = d3.extent(sparklineData, (d) => d.date);

    // Y scale
    const yMax = d3.max(sparklineData, (d) => d.value) || 0;
    const yMin = d3.min(sparklineData, (d) => d.value) || 0;

    if (sparkType === "bar") {
      this.renderBarSparkline(
        d3,
        group,
        sparklineData,
        width,
        height,
        color,
        entityName
      );
    } else {
      this.renderLineSparkline(
        d3,
        group,
        sparklineData,
        width,
        height,
        color,
        xExtent,
        yMax,
        yMin,
        sparkType,
        entityName
      );
    }

    // Reference line (optional)
    if (this.config.referenceLine === "average") {
      const avgValue = d3.mean(sparklineData, (d) => d.value);
      const yScale = d3
        .scaleLinear()
        .domain([Math.min(0, yMin), yMax || 1])
        .range([height, 0]);

      group
        .append("line")
        .attr("class", "reference-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", yScale(avgValue))
        .attr("y2", yScale(avgValue))
        .attr("stroke", "#999")
        .attr("stroke-dasharray", "2,2")
        .attr("stroke-width", 1)
        .attr("opacity", 0.6);
    }
  }

  /**
   * Renders a line/area type sparkline.
   */
  renderLineSparkline(
    d3,
    group,
    sparklineData,
    width,
    height,
    color,
    xExtent,
    yMax,
    yMin,
    sparkType,
    entityName
  ) {
    const xScale = d3.scaleTime().domain(xExtent).range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([Math.min(0, yMin), yMax || 1])
      .range([height, 0]);

    // Line generator
    const lineGen = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value));

    // Area fill below the line
    const areaGen = d3
      .area()
      .x((d) => xScale(d.date))
      .y0(height)
      .y1((d) => yScale(d.value));

    // Draw area fill
    group
      .append("path")
      .datum(sparklineData)
      .attr("class", "sparkline-area")
      .attr("d", areaGen)
      .attr("fill", color)
      .attr("fill-opacity", 0.1)
      .attr("stroke", "none");

    // Draw line
    group
      .append("path")
      .datum(sparklineData)
      .attr("class", "sparkline-line")
      .attr("d", lineGen)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5);

    // Hoverable point markers (transparent until hover) — this is what makes
    // the tooltip allocated in initializeChart actually get shown.
    group
      .selectAll(".sparkline-point")
      .data(sparklineData)
      .enter()
      .append("circle")
      .attr("class", "sparkline-point")
      .attr("cx", (d) => xScale(d.date))
      .attr("cy", (d) => yScale(d.value))
      .attr("r", 3)
      .attr("fill", color)
      .attr("opacity", 0)
      .on("mouseenter", (event, d) => {
        this._showPointTooltip(event, entityName, d);
        d3.select(event.currentTarget).attr("opacity", 1);
      })
      .on("mouseleave", (event) => {
        this._hideTooltip();
        d3.select(event.currentTarget).attr("opacity", 0);
      });
  }

  /**
   * Renders a bar type sparkline using scaleBand.
   */
  renderBarSparkline(
    d3,
    group,
    sparklineData,
    width,
    height,
    color,
    entityName
  ) {
    const xScale = d3
      .scaleBand()
      .domain(sparklineData.map((d) => d.date))
      .range([0, width])
      .padding(0.1);

    const yMax = d3.max(sparklineData, (d) => d.value) || 1;
    const yMin = d3.min(sparklineData, (d) => d.value) || 0;

    const yScale = d3
      .scaleLinear()
      .domain([Math.min(0, yMin), yMax])
      .range([height, 0]);

    // Draw bars
    group
      .selectAll(".sparkline-bar")
      .data(sparklineData)
      .enter()
      .append("rect")
      .attr("class", "sparkline-bar")
      .attr("x", (d) => xScale(d.date))
      .attr("width", xScale.bandwidth())
      .attr("y", (d) => yScale(d.value))
      .attr("height", (d) => height - yScale(d.value))
      .attr("fill", color)
      .attr("opacity", 0.7)
      .on("mouseenter", (event, d) => {
        this._showPointTooltip(event, entityName, d);
        d3.select(event.currentTarget).attr("opacity", 1);
      })
      .on("mouseleave", (event) => {
        this._hideTooltip();
        d3.select(event.currentTarget).attr("opacity", 0.7);
      });
  }

  // ===============================================================
  // TOOLTIP HANDLERS
  // ===============================================================

  _showPointTooltip(event, entityName, d) {
    if (!this.tooltip) return;

    const monthLabel = d.date.toLocaleString("default", {
      month: "short",
      year: "numeric"
    });
    const content = buildTooltipContent(entityName, d.value, {
      prefix: `${monthLabel}: `
    });

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  _hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ===============================================================
  // CLICK HANDLER - DRILL DOWN
  // ===============================================================

  handleRowClick(entityItem) {
    if (!this.objectApiName) return;

    const filterFieldName = this.filterField || this.entityField;

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

    this.dispatchEvent(
      new CustomEvent("rowclick", {
        detail: {
          entity: entityItem.entity,
          value: entityItem.currentValue,
          filterField: filterFieldName
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ===============================================================
  // CLEANUP
  // ===============================================================

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
