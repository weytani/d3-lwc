// force-app/main/default/lwc/d3ChordDiagram/d3ChordDiagram.js
// ABOUTME: D3 Chord diagram Lightning Web Component visualizing flows between categories.
// ABOUTME: Pivots a source-target edge list into a square matrix and renders group arcs with ribbon connections.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateSeriesData,
  buildMatrix,
  OPERATIONS,
  MAX_RECORDS
} from "c/dataService";
import { createColorScale, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  truncateLabel,
  createTooltip,
  createResizeHandler,
  createLayoutRetry
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

export default class D3ChordDiagram extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Field naming the flow source (rows/columns of the matrix) */
  @api groupByField = "";

  /** Field naming the flow target */
  @api seriesField = "";

  /** Field to aggregate (edge weight) */
  @api valueField = "";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 300;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional WHERE clause fragment for server-side aggregation */
  @api filterClause = "";

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
  _matrix = [];
  _labels = [];

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
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3ChordDiagram initialization error:", e);
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
    // Priority 1: recordCollection — aggregate to edges client-side, then pivot.
    if (this.recordCollection && this.recordCollection.length > 0) {
      const edges = this._aggregateRawData([...this.recordCollection]);
      this._buildFromEdges(edges);
      return;
    }

    // Priority 2: server multi-group aggregation when all fields are set.
    if (
      this.objectApiName &&
      this.groupByField &&
      this.seriesField &&
      this.valueField &&
      this.operation
    ) {
      let edges = [];
      try {
        edges = await getMultiGroupData({
          objectName: this.objectApiName,
          groupByField: this.groupByField,
          seriesField: this.seriesField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
      } catch (e) {
        throw new Error(`Aggregation Error: ${e.body?.message || e.message}`);
      }
      if (!edges || edges.length === 0) {
        throw new Error("No data after aggregation");
      }
      this._buildFromEdges(edges);
      return;
    }

    // Priority 3: SOQL query, then client-side aggregate + pivot.
    if (this.soqlQuery) {
      let rawData = [];
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
      const edges = this._aggregateRawData(rawData);
      this._buildFromEdges(edges);
      return;
    }

    throw new Error(
      "No data source provided. Set recordCollection or soqlQuery."
    );
  }

  /**
   * Validates, truncates, and aggregates raw rows into a {label, series, value}
   * edge list keyed by the source (groupByField) and target (seriesField).
   */
  _aggregateRawData(rawData) {
    const requiredFields = [this.groupByField, this.seriesField];
    if (this.operation !== OPERATIONS.COUNT) {
      requiredFields.push(this.valueField);
    }

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: this.recordLimit || MAX_RECORDS
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    return aggregateSeriesData(
      prepared.data,
      this.groupByField,
      this.seriesField,
      this.valueField,
      this.operation
    );
  }

  /**
   * Pivots an edge list into a square matrix + label index, stores both,
   * and exposes the edge list as chartData (drives hasData / no-data state).
   */
  _buildFromEdges(edges) {
    if (!edges || edges.length === 0) {
      throw new Error("No data after aggregation");
    }
    const { matrix, labels } = buildMatrix(edges, "label", "series", "value");
    this._matrix = matrix;
    this._labels = labels;
    this.chartData = edges;
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

    d3.select(container).select("svg").remove();

    const padding = Math.max(10, Math.round(containerWidth * 0.04));
    const margin = {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    };
    const width = containerWidth - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    // Reserve a margin for the radial group labels that sit outside the ring,
    // so they don't clip against the SVG edges.
    const labelMargin = 60;
    const outerRadius = Math.max(20, Math.min(width, height) / 2 - labelMargin);
    const innerRadius = outerRadius - Math.max(12, outerRadius * 0.08);

    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "chord-diagram-svg")
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + width / 2},${margin.top + height / 2})`
      );

    const colorScale = createColorScale(
      this.theme,
      this._labels,
      this.config.customColors
    );

    const padAngle =
      typeof this.config.padAngle === "number" ? this.config.padAngle : 0.05;

    const chordLayout = d3.chord().padAngle(padAngle)(this._matrix);

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbon().radius(innerRadius);

    // Group arcs — one per label.
    const groups = this.svg
      .selectAll(".chord-group")
      .data(chordLayout.groups)
      .enter()
      .append("g")
      .attr("class", "chord-group");

    groups
      .append("path")
      .attr("class", "chord-arc")
      .attr("d", arc)
      .attr("fill", (d) => colorScale(this._labels[d.index]))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .on("mouseenter", (event, d) => {
        this.showTooltip(event, d.index);
      })
      .on("mousemove", (event) => {
        this.moveTooltip(event);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      })
      .on("click", (event, d) => {
        this.handleArcClick(d.index);
      });

    // Group labels — placed radially just outside each arc, rotated to follow
    // the arc's midpoint angle, and flipped on the left half so they stay
    // upright and readable instead of piling up in the center. Tiny arcs (whose
    // angular span is below MIN_LABEL_ANGLE) are skipped so their labels don't
    // crowd/overlap where many small slivers cluster at the top of the ring —
    // their data still lives in the ribbons and the hover tooltip. Labels bind
    // to a pre-filtered copy of the groups (an Array.filter) so only the major
    // categories get a label.
    const MIN_LABEL_ANGLE = 0.08; // radians (~4.6°)
    const labelRadius = outerRadius + 6;
    const labeledGroups = chordLayout.groups.filter(
      (d) => d.endAngle - d.startAngle >= MIN_LABEL_ANGLE
    );
    this.svg
      .append("g")
      .attr("class", "chord-labels")
      .selectAll(".chord-label")
      .data(labeledGroups)
      .enter()
      .append("text")
      .attr("class", "chord-label")
      .attr("dy", "0.35em")
      .attr("transform", (d) => {
        const angle = (d.startAngle + d.endAngle) / 2;
        const rotate = (angle * 180) / Math.PI - 90;
        const flip = angle > Math.PI ? "rotate(180)" : "";
        return `rotate(${rotate}) translate(${labelRadius},0) ${flip}`;
      })
      .attr("text-anchor", (d) => {
        return (d.startAngle + d.endAngle) / 2 > Math.PI ? "end" : "start";
      })
      .style("font-size", "10px")
      .style("fill", "#16325c")
      .text((d) => truncateLabel(this._labels[d.index]));

    // Ribbons — one per nonzero edge from the chord layout.
    this.svg
      .append("g")
      .attr("class", "chord-ribbons")
      .attr("fill-opacity", 0.7)
      .selectAll(".chord-ribbon")
      .data(chordLayout)
      .enter()
      .append("path")
      .attr("class", "chord-ribbon")
      .attr("d", ribbon)
      .attr("fill", (d) => colorScale(this._labels[d.source.index]))
      .attr("stroke", "white")
      .attr("stroke-width", 0.5);
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTooltip(event, labelIndex) {
    if (!this.tooltip) return;

    const label = this._labels[labelIndex];
    const total = (this._matrix[labelIndex] || []).reduce(
      (sum, v) => sum + v,
      0
    );
    const content = `
            <strong>${label}</strong><br/>
            ${formatNumber(total)}
        `;
    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  moveTooltip() {
    // Position handled in show()
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - DRILL DOWN
  // ═══════════════════════════════════════════════════════════════

  handleArcClick(labelIndex) {
    if (!this.objectApiName) return;

    const label = this._labels[labelIndex];
    const filterFieldName = this.filterField || this.groupByField;

    this[NavigationMixin.Navigate]({
      type: "standard__objectPage",
      attributes: {
        objectApiName: this.objectApiName,
        actionName: "list"
      }
    });

    this.dispatchEvent(
      new CustomEvent("arcclick", {
        detail: {
          label,
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
