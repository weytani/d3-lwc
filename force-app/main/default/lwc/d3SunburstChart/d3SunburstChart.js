// ABOUTME: D3 Sunburst chart Lightning Web Component for radial hierarchical data.
// ABOUTME: Renders concentric rings via d3.partition + d3.arc; supports flat auto-nesting, two-level server hierarchy, and pre-built hierarchyData.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  buildHierarchy,
  OPERATIONS,
  MAX_RECORDS
} from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  formatPercent,
  createTooltip,
  createResizeHandler,
  createLayoutRetry,
  truncateLabel
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import getMultiGroupData from "@salesforce/apex/D3ChartController.getMultiGroupData";

export default class D3SunburstChart extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /** Pre-built hierarchy: { name, children: [{ name, value }|{ name, children }] } */
  @api hierarchyData = null;

  /** Field to group by (primary ring) */
  @api groupByField = "";

  /** Optional second field for a third ring (nested hierarchy) */
  @api secondaryGroupByField = "";

  /** Field to aggregate (arc values) */
  @api valueField = "";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 400;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Show ring labels (defaults to true via getter) */
  @api showLabels;

  /** Object API name for drill-down navigation */
  @api objectApiName = "";

  /** Filter field for drill-down */
  @api filterField = "";

  /** Optional SOQL WHERE clause for server-side aggregation (without WHERE keyword) */
  @api filterClause = "";

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  /** Maximum records to process (overrides default limit) */
  @api recordLimit;

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track rootData = null;
  @track totalValue = 0;

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

  get effectiveShowLabels() {
    return this.showLabels !== false;
  }

  get hasError() {
    return !!this.error;
  }

  get hasData() {
    return (
      this.rootData &&
      this.rootData.children &&
      this.rootData.children.length > 0
    );
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
      console.error("D3SunburstChart initialization error:", e);
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
  // DATA LOADING (three paths: hierarchyData / server / client nest)
  // ═══════════════════════════════════════════════════════════════

  async loadData() {
    // Path 1: pre-built hierarchy
    if (this.hierarchyData) {
      this.rootData = this.validateHierarchy(this.hierarchyData);
      this.calculateTotalValue();
      return;
    }

    let rawData = [];

    if (this.recordCollection && this.recordCollection.length > 0) {
      rawData = [...this.recordCollection];
    } else if (this._canUseServerAggregation()) {
      // Path 2: server-side aggregation
      await this._loadServerData();
      return;
    } else if (this.soqlQuery) {
      try {
        rawData = await executeQuery({ queryString: this.soqlQuery });
      } catch (e) {
        throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
      }
    } else {
      throw new Error(
        "No data source provided. Set recordCollection, hierarchyData, or soqlQuery."
      );
    }

    // Path 3: client-side nest via shared dataService.buildHierarchy
    const requiredFields = [this.groupByField];
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

    const fields = this.secondaryGroupByField
      ? [this.groupByField, this.secondaryGroupByField]
      : [this.groupByField];

    this.rootData = buildHierarchy(
      prepared.data,
      fields,
      this.valueField,
      this.operation
    );
    this.calculateTotalValue();

    if (!this.rootData.children || this.rootData.children.length === 0) {
      throw new Error("No data after building hierarchy");
    }
  }

  /** True when all server-aggregation inputs are set. */
  _canUseServerAggregation() {
    return !!(
      this.objectApiName &&
      this.groupByField &&
      this.valueField &&
      this.operation
    );
  }

  /**
   * Server path. Two-level (secondaryGroupByField set) uses getMultiGroupData
   * and pivots the edge list into a two-level { name, children } tree;
   * single-level uses getAggregatedData.
   */
  async _loadServerData() {
    try {
      if (this.secondaryGroupByField) {
        const edges = await getMultiGroupData({
          objectName: this.objectApiName,
          groupByField: this.groupByField,
          seriesField: this.secondaryGroupByField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
        this.rootData = this._edgesToHierarchy(edges);
      } else {
        const result = await getAggregatedData({
          objectName: this.objectApiName,
          groupByField: this.groupByField,
          valueField: this.valueField,
          operation: this.operation,
          filterClause: this.filterClause || null
        });
        this.rootData = {
          name: "Root",
          children: result.map((item) => ({
            name: String(item.label ?? "Null"),
            value: Number(item.value) || 0
          }))
        };
      }
    } catch (e) {
      throw new Error(
        `Server aggregation error: ${e.body?.message || e.message}`
      );
    }

    this.calculateTotalValue();
    if (!this.rootData.children || this.rootData.children.length === 0) {
      throw new Error("No data after server aggregation");
    }
  }

  /** Pivots a {label, series, value} edge list into a two-level hierarchy. */
  _edgesToHierarchy(edges) {
    const groups = new Map();
    edges.forEach((edge) => {
      const primary = String(edge.label ?? "Null");
      if (!groups.has(primary)) groups.set(primary, []);
      groups.get(primary).push({
        name: String(edge.series ?? "Null"),
        value: Number(edge.value) || 0
      });
    });
    const children = [];
    groups.forEach((subChildren, primary) => {
      children.push({ name: primary, children: subChildren });
    });
    return { name: "Root", children };
  }

  /** Normalizes a pre-built hierarchy into { name, value } / { name, children }. */
  validateHierarchy(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Hierarchy data must be an object");
    }
    const normalize = (node) => {
      const normalized = { name: node.name || "Unnamed" };
      if (node.children && Array.isArray(node.children)) {
        normalized.children = node.children.map((c) => normalize(c));
      } else if (node.value !== undefined) {
        normalized.value = Number(node.value) || 0;
      }
      return normalized;
    };
    return normalize(data);
  }

  /** Sums leaf values across the hierarchy. */
  calculateTotalValue() {
    if (!this.rootData) {
      this.totalValue = 0;
      return;
    }
    const sumValues = (node) => {
      if (node.value !== undefined) return node.value;
      if (node.children) {
        return node.children.reduce((sum, c) => sum + sumValues(c), 0);
      }
      return 0;
    };
    this.totalValue = sumValues(this.rootData);
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
    const width = containerWidth - padding * 2;
    const height = this.height - padding * 2;
    if (width <= 0 || height <= 0) return;

    const radius = Math.min(width, height) / 2;

    this.svg = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "sunburst-svg")
      .append("g")
      .attr(
        "transform",
        `translate(${padding + width / 2},${padding + height / 2})`
      );

    // Build hierarchy and partition into [0, 2π] angular x radial radius space.
    const root = d3
      .hierarchy(this.rootData)
      .sum((d) => d.value || 0)
      .sort((a, b) => b.value - a.value);

    const partition = d3.partition().size([2 * Math.PI, radius]);
    partition(root);

    // One arc per node, skipping the synthetic root (depth 0).
    const nodes = root.descendants().filter((d) => d.depth > 0);

    const colors = getColors(
      this.theme,
      Math.max((this.rootData?.children || []).length, 5),
      this.config.customColors
    );
    const topLevel = (this.rootData?.children || []).map((c) => c.name);

    const arc = d3
      .arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1);

    const arcs = this.svg
      .selectAll(".sunburst-arc")
      .data(nodes)
      .enter()
      .append("path")
      .attr("class", "sunburst-arc")
      .attr("d", arc)
      .attr("fill", (d) => {
        // Color by the depth-1 ancestor so children share their parent's hue.
        let ancestor = d;
        while (ancestor.depth > 1) ancestor = ancestor.parent;
        const idx = topLevel.indexOf(ancestor.data.name);
        return colors[idx >= 0 ? idx : 0];
      })
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .on("mouseenter", (event, d) => {
        this.showArcTooltip(event, d);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      })
      .on("click", (_event, d) => {
        this.handleArcClick(d);
      });

    if (this.effectiveShowLabels) {
      arcs.each((d, i, n) => {
        const angle = d.x1 - d.x0;
        if (angle > 0.1) {
          d3.select(n[i]);
        }
      });
    }

    // Center label = total value.
    this.svg
      .append("text")
      .attr("class", "center-label")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#16325c")
      .text(formatNumber(this.totalValue));
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP / CLICK
  // ═══════════════════════════════════════════════════════════════

  showArcTooltip(event, d) {
    if (!this.tooltip) return;
    const percent = this.totalValue > 0 ? d.value / this.totalValue : 0;
    const content = `
      <strong>${truncateLabel(d.data.name, 30)}</strong><br/>
      ${formatNumber(d.value)} (${formatPercent(percent)})
    `;
    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  handleArcClick(d) {
    this.dispatchEvent(
      new CustomEvent("arcclick", {
        detail: {
          label: d.data.name,
          value: d.value,
          depth: d.depth,
          filterField: this.filterField || this.groupByField
        },
        bubbles: true,
        composed: true
      })
    );

    if (this.objectApiName) {
      this[NavigationMixin.Navigate]({
        type: "standard__objectPage",
        attributes: {
          objectApiName: this.objectApiName,
          actionName: "list"
        }
      });
    }
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
