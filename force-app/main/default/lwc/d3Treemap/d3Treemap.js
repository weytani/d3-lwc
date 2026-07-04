// ABOUTME: D3 Treemap Lightning Web Component for hierarchical data visualization.
// ABOUTME: Displays nested rectangles sized by value, supporting flat data with auto-nesting via groupByField.
import { LightningElement, api, track, wire } from "lwc";
import { loadD3 } from "c/d3Lib";
import {
  prepareData,
  aggregateData,
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
  truncateLabel,
  applySvgA11y,
  getContrastColor
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import getAggregatedData from "@salesforce/apex/D3ChartController.getAggregatedData";
import { gql, graphql } from "lightning/graphql";
import {
  buildRecordQuery,
  normalizeRecordsGeneric,
  buildAggregateQuery,
  normalizeAggregate,
  buildMultiGroupQuery,
  normalizeMultiGroup
} from "c/graphqlService";

export default class D3Treemap extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /**
   * Hierarchical data structure (alternative to recordCollection)
   * Expected format: { name: 'Root', children: [{ name: 'A', value: 100 }, ...] }
   */
  @api hierarchyData = null;

  /** Field to group by (creates hierarchy from flat data) */
  @api groupByField = "";

  /** Secondary group field for nested hierarchy */
  @api secondaryGroupByField = "";

  /** Field to aggregate (rectangle values) */
  @api valueField = "";

  /** Aggregation operation: Sum, Count, Average */
  @api operation = OPERATIONS.SUM;

  /** Chart height in pixels */
  @api height = 400;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Color mode: 'category' colors by group, 'depth' colors by nesting level */
  @api colorMode = "category";

  /** Show labels on rectangles (defaults to true via getter) */
  @api showLabels;

  /** Minimum rectangle size (pixels) to show label */
  @api minLabelSize = 40;

  /** Enable click-to-zoom drill-down */
  @api enableZoom = false;

  /** Padding between rectangles */
  @api tilePadding = 2;

  /** Inner padding for nested groups */
  @api innerPadding = 4;

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

  /** Fetch-mode selector: "auto" (default, existing priority order), "apex", or "graphql". */
  @api fetchMode = "auto";

  /** Structured filter for the GraphQL path: { field, operator, value }. */
  @api graphqlFilter;

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track rootData = null;
  @track currentRoot = null;
  @track breadcrumbs = [];
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
  colorScale = null;
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

  get hasBreadcrumbs() {
    return this.breadcrumbs.length > 0;
  }

  get breadcrumbItems() {
    return this.breadcrumbs.map((item, index) => ({
      ...item,
      isLast: index === this.breadcrumbs.length - 1,
      key: `breadcrumb-${index}`
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
  // GRAPHQL SELF-FETCH PATH (Approach A — additive)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Reactive GraphQL query for the self-fetch path. Returns undefined (so the
   * wire is skipped) unless fetchMode is "graphql" and objectApiName/groupByField/
   * operation are set. Mirrors the existing server-side branch: secondaryGroupByField
   * present -> two-field grouped aggregate (CT-MG, via buildMultiGroupQuery, same
   * decision _canUseServerAggregation() makes to fall back to client nesting);
   * secondaryGroupByField empty -> single-field aggregate (CT-AGG, via
   * buildAggregateQuery, same as getAggregatedData). Count has no server aggregate
   * on either branch, so it fetches bounded raw records instead, fed through the
   * existing buildHierarchy() client path (which already handles Count).
   */
  get gqlQuery() {
    if (this.fetchMode !== "graphql") return undefined;
    if (!this.objectApiName || !this.groupByField || !this.operation) {
      return undefined;
    }
    let queryString;
    try {
      if (this.operation === OPERATIONS.COUNT) {
        const fields = this.secondaryGroupByField
          ? [this.groupByField, this.secondaryGroupByField]
          : [this.groupByField];
        queryString = buildRecordQuery({
          objectApiName: this.objectApiName,
          fields: [...new Set(fields)],
          filter: this.graphqlFilter,
          first: this.recordLimit || MAX_RECORDS
        });
      } else {
        if (!this.valueField) return undefined;
        if (this.secondaryGroupByField) {
          queryString = buildMultiGroupQuery({
            objectApiName: this.objectApiName,
            groupByField: this.groupByField,
            seriesField: this.secondaryGroupByField,
            valueField: this.valueField,
            operation: this.operation,
            filter: this.graphqlFilter,
            first: this.recordLimit || MAX_RECORDS
          });
        } else {
          queryString = buildAggregateQuery({
            objectApiName: this.objectApiName,
            groupByField: this.groupByField,
            valueField: this.valueField,
            operation: this.operation,
            filter: this.graphqlFilter,
            first: this.recordLimit || MAX_RECORDS
          });
        }
      }
    } catch {
      // Unsupported operation/config: leave the wire un-provisioned; error surfaces below.
      return undefined;
    }
    return gql`
      ${queryString}
    `;
  }

  @wire(graphql, { query: "$gqlQuery" })
  wiredAggregate({ data, errors }) {
    if (this.fetchMode !== "graphql") return;
    if (errors) {
      this.error = this._formatGqlErrors(errors);
      this.isLoading = false;
      return;
    }
    if (!data) return; // initial undefined emission
    try {
      if (this.operation === OPERATIONS.COUNT) {
        const fields = this.secondaryGroupByField
          ? [this.groupByField, this.secondaryGroupByField]
          : [this.groupByField];
        const records = normalizeRecordsGeneric(data, {
          objectApiName: this.objectApiName,
          fields: [...new Set(fields)]
        });
        this.rootData = this.buildHierarchy(records);
      } else if (this.secondaryGroupByField) {
        const edges = normalizeMultiGroup(data, {
          objectApiName: this.objectApiName,
          groupByField: this.groupByField,
          seriesField: this.secondaryGroupByField,
          valueField: this.valueField,
          operation: this.operation
        });
        this.rootData = this._edgesToNestedHierarchy(edges);
      } else {
        const aggregated = normalizeAggregate(data, {
          objectApiName: this.objectApiName,
          groupByField: this.groupByField,
          valueField: this.valueField,
          operation: this.operation
        });
        this.rootData = {
          name: "Root",
          children: aggregated.map((item) => ({
            name: String(item.label ?? "Null"),
            value: Number(item.value) || 0,
            data: {
              label: String(item.label ?? "Null"),
              value: Number(item.value) || 0
            }
          }))
        };
      }
      this.currentRoot = this.rootData;
      this.breadcrumbs = [];
      this.calculateTotalValue();
      if (!this.rootData.children || this.rootData.children.length === 0) {
        this.error = "No data after aggregation";
      } else {
        this.error = null;
        this.chartRendered = false; // force renderedCallback to re-initialize the SVG
      }
    } catch (e) {
      this.error = e.message;
    }
    this.isLoading = false;
  }

  /**
   * Pivots a {label, series, value} edge list (buildMultiGroupQuery/
   * normalizeMultiGroup output) into a two-level hierarchy, mirroring
   * buildNestedHierarchy's grouping and sort order exactly (primary groups
   * sorted by total value descending, sub-children sorted by value descending)
   * since the edges are already aggregated server-side.
   */
  _edgesToNestedHierarchy(edges) {
    const groups = new Map();
    edges.forEach((edge) => {
      const primaryKey = String(edge.label ?? "Null");
      const secondaryKey = String(edge.series ?? "Null");
      if (!groups.has(primaryKey)) {
        groups.set(primaryKey, []);
      }
      const value = Number(edge.value) || 0;
      groups.get(primaryKey).push({
        name: secondaryKey,
        value,
        data: { primaryGroup: primaryKey, secondaryGroup: secondaryKey, value }
      });
    });

    const children = [];
    groups.forEach((subChildren, primaryKey) => {
      subChildren.sort((a, b) => b.value - a.value);
      children.push({
        name: primaryKey,
        children: subChildren,
        data: { primaryGroup: primaryKey }
      });
    });

    children.sort((a, b) => {
      const sumA = a.children.reduce((s, c) => s + c.value, 0);
      const sumB = b.children.reduce((s, c) => s + c.value, 0);
      return sumB - sumA;
    });

    return { name: "Root", children };
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
      this.d3 = await loadD3(this);
      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3Treemap initialization error:", e);
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

    // Check for pre-built hierarchy data first
    if (this.hierarchyData) {
      this.rootData = this.validateHierarchy(this.hierarchyData);
      this.currentRoot = this.rootData;
      this.calculateTotalValue();
      return;
    }

    let rawData = [];

    if (this.recordCollection && this.recordCollection.length > 0) {
      rawData = [...this.recordCollection];
    } else if (this._canUseServerAggregation()) {
      // Server-side aggregation for single-level hierarchies
      await this._loadServerAggregatedData();
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

    // Validate required fields
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

    // Build hierarchy from flat data
    this.rootData = this.buildHierarchy(prepared.data);
    this.currentRoot = this.rootData;
    this.calculateTotalValue();

    if (!this.rootData.children || this.rootData.children.length === 0) {
      throw new Error("No data after building hierarchy");
    }
  }

  /**
   * Checks whether server-side aggregation can be used.
   * Requires objectApiName, groupByField, valueField, and operation to be set,
   * and no secondaryGroupByField (two-level hierarchies fall back to client-side).
   * @returns {Boolean} - True if server aggregation is available
   */
  _canUseServerAggregation() {
    return (
      this.objectApiName &&
      this.groupByField &&
      this.valueField &&
      this.operation &&
      !this.secondaryGroupByField
    );
  }

  /**
   * Loads data via server-side GROUP BY aggregation.
   * Builds a single-level hierarchy from the aggregated result.
   */
  async _loadServerAggregatedData() {
    try {
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
          value: Number(item.value) || 0,
          data: {
            label: String(item.label ?? "Null"),
            value: Number(item.value) || 0
          }
        }))
      };
      this.currentRoot = this.rootData;
      this.calculateTotalValue();

      if (!this.rootData.children || this.rootData.children.length === 0) {
        throw new Error("No data after server aggregation");
      }
    } catch (e) {
      throw new Error(
        `Server aggregation error: ${e.body?.message || e.message}`
      );
    }
  }

  /**
   * Validates and normalizes hierarchy data structure.
   * @param {Object} data - Hierarchy data
   * @returns {Object} - Validated hierarchy
   */
  validateHierarchy(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Hierarchy data must be an object");
    }

    const normalize = (node) => {
      const normalized = {
        name: node.name || "Unnamed",
        data: node.data || node
      };

      if (node.children && Array.isArray(node.children)) {
        normalized.children = node.children.map((child) => normalize(child));
      } else if (node.value !== undefined) {
        normalized.value = Number(node.value) || 0;
      }

      return normalized;
    };

    return normalize(data);
  }

  /**
   * Builds hierarchy from flat data using groupByField(s).
   * @param {Array} data - Flat data array
   * @returns {Object} - Hierarchy object
   */
  buildHierarchy(data) {
    // If secondary group field is specified, create two-level hierarchy
    if (this.secondaryGroupByField) {
      return this.buildNestedHierarchy(data);
    }

    // Single-level hierarchy using aggregation
    const aggregated = aggregateData(
      data,
      this.groupByField,
      this.valueField,
      this.operation
    );

    return {
      name: "Root",
      children: aggregated.map((item) => ({
        name: item.label,
        value: item.value,
        data: { label: item.label, value: item.value }
      }))
    };
  }

  /**
   * Builds two-level nested hierarchy.
   * @param {Array} data - Flat data array
   * @returns {Object} - Nested hierarchy object
   */
  buildNestedHierarchy(data) {
    const groups = new Map();

    data.forEach((record) => {
      const primaryKey = String(record[this.groupByField] ?? "Null");
      const secondaryKey = String(record[this.secondaryGroupByField] ?? "Null");

      if (!groups.has(primaryKey)) {
        groups.set(primaryKey, new Map());
      }

      const secondaryGroups = groups.get(primaryKey);
      if (!secondaryGroups.has(secondaryKey)) {
        secondaryGroups.set(secondaryKey, { sum: 0, count: 0 });
      }

      const group = secondaryGroups.get(secondaryKey);
      group.count += 1;
      if (this.valueField && record[this.valueField] != null) {
        group.sum += Number(record[this.valueField]) || 0;
      }
    });

    const calculateValue = (group) => {
      switch (this.operation) {
        case OPERATIONS.SUM:
          return group.sum;
        case OPERATIONS.COUNT:
          return group.count;
        case OPERATIONS.AVERAGE:
          return group.count > 0 ? group.sum / group.count : 0;
        default:
          return group.count;
      }
    };

    const children = [];
    groups.forEach((secondaryGroups, primaryKey) => {
      const subChildren = [];
      secondaryGroups.forEach((group, secondaryKey) => {
        subChildren.push({
          name: secondaryKey,
          value: calculateValue(group),
          data: {
            primaryGroup: primaryKey,
            secondaryGroup: secondaryKey,
            value: calculateValue(group)
          }
        });
      });

      // Sort by value descending
      subChildren.sort((a, b) => b.value - a.value);

      children.push({
        name: primaryKey,
        children: subChildren,
        data: { primaryGroup: primaryKey }
      });
    });

    // Sort primary groups by total value
    children.sort((a, b) => {
      const sumA = a.children.reduce((s, c) => s + c.value, 0);
      const sumB = b.children.reduce((s, c) => s + c.value, 0);
      return sumB - sumA;
    });

    return {
      name: "Root",
      children
    };
  }

  /**
   * Calculates total value from root data.
   */
  calculateTotalValue() {
    if (!this.rootData) {
      this.totalValue = 0;
      return;
    }

    const sumValues = (node) => {
      if (node.value !== undefined) {
        return node.value;
      }
      if (node.children) {
        return node.children.reduce((sum, child) => sum + sumValues(child), 0);
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
    this.initColorScale();
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

  /**
   * Initializes color scale based on colorMode.
   */
  initColorScale() {
    const root = this.currentRoot || this.rootData;
    if (!root || !root.children) return;

    const categories = root.children.map((c) => c.name);
    const colors = getColors(
      this.theme,
      categories.length,
      this.config.customColors
    );

    if (this.colorMode === "category") {
      const colorMap = new Map();
      categories.forEach((cat, i) => colorMap.set(cat, colors[i]));
      this.colorScale = (name) => colorMap.get(name) || colors[0];
    } else {
      // Depth-based coloring will use index in renderChart
      this.colorScale = null;
    }
  }

  renderChart(containerWidth) {
    const d3 = this.d3;
    const container = this.template.querySelector(".chart-container");
    if (!container || !d3) return;

    // Clear existing SVG
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

    // Create SVG
    const svgRoot = d3
      .select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", this.height)
      .attr("class", "treemap-svg");

    applySvgA11y(svgRoot, {
      title: `Treemap: ${this.operation} of ${this.valueField} by ${this.groupByField}`,
      desc: `${(this.rootData?.children || []).length} categories`
    });

    this.svg = svgRoot
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create hierarchy from current root
    const root = d3
      .hierarchy(this.currentRoot || this.rootData)
      .sum((d) => d.value || 0)
      .sort((a, b) => b.value - a.value);

    // Create treemap layout
    const treemap = d3
      .treemap()
      .size([width, height])
      .paddingOuter(this.tilePadding)
      .paddingInner(this.innerPadding)
      .paddingTop(this.secondaryGroupByField ? 20 : this.tilePadding)
      .round(true);

    treemap(root);

    // Get colors
    const categories = (this.rootData?.children || []).map((c) => c.name);
    const colors = getColors(
      this.theme,
      Math.max(categories.length, 5),
      this.config.customColors
    );
    const depthColors = ["#1589EE", "#4BCA81", "#FF9E2C", "#FF5D5D", "#AD7BFF"];

    // Draw parent groups if nested
    if (this.secondaryGroupByField) {
      const parents = root.descendants().filter((d) => d.depth === 1);

      this.svg
        .selectAll(".group-rect")
        .data(parents)
        .enter()
        .append("rect")
        .attr("class", "group-rect")
        .attr("x", (d) => d.x0)
        .attr("y", (d) => d.y0)
        .attr("width", (d) => Math.max(0, d.x1 - d.x0))
        .attr("height", (d) => Math.max(0, d.y1 - d.y0))
        .attr("fill", "none")
        .attr("stroke", "#d8d8d8")
        .attr("stroke-width", 1);

      // Group labels
      this.svg
        .selectAll(".group-label")
        .data(parents)
        .enter()
        .append("text")
        .attr("class", "group-label")
        .attr("x", (d) => d.x0 + 4)
        .attr("y", (d) => d.y0 + 14)
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("fill", "#16325c")
        .text((d) => truncateLabel(d.data.name, 30));
    }

    // Get leaf nodes
    const leaves = root.leaves();

    // Draw leaf rectangles
    const cells = this.svg
      .selectAll(".leaf")
      .data(leaves)
      .enter()
      .append("g")
      .attr("class", "leaf")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    // Rectangle fill
    cells
      .append("rect")
      .attr("class", "tile")
      .attr("width", (d) => Math.max(0, d.x1 - d.x0))
      .attr("height", (d) => Math.max(0, d.y1 - d.y0))
      .attr("fill", (d, i) => {
        if (this.colorMode === "depth") {
          return depthColors[d.depth % depthColors.length];
        }
        // Category color - use parent's name for color
        const categoryName = d.depth > 1 ? d.parent.data.name : d.data.name;
        const catIndex = categories.indexOf(categoryName);
        return colors[catIndex >= 0 ? catIndex : i % colors.length];
      })
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("rx", 2)
      .attr(
        "cursor",
        this.enableZoom || this.objectApiName ? "pointer" : "default"
      )
      .attr("opacity", 0)
      .on("mouseenter", (event, d) => {
        this.showTileTooltip(event, d);
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 0.85);
      })
      .on("mouseleave", (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("opacity", 1);
      })
      .on("click", (_event, d) => {
        this.handleTileClick(d);
      })
      .transition()
      .duration(500)
      .delay((d, i) => i * 10)
      .attr("opacity", 1);

    // Labels
    if (this.effectiveShowLabels) {
      cells.each((d, i, nodes) => {
        const cellWidth = d.x1 - d.x0;
        const cellHeight = d.y1 - d.y0;

        if (cellWidth >= this.minLabelSize && cellHeight >= this.minLabelSize) {
          const cell = d3.select(nodes[i]);

          // Calculate max label length based on width
          const maxChars = Math.floor(cellWidth / 7);

          // Name label
          cell
            .append("text")
            .attr("class", "tile-label")
            .attr("x", 4)
            .attr("y", 14)
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style(
              "fill",
              this.resolveTileTextColor(d, colors, categories, depthColors)
            )
            .style("pointer-events", "none")
            .text(truncateLabel(d.data.name, maxChars));

          // Value label (if enough height)
          if (cellHeight >= 35) {
            cell
              .append("text")
              .attr("class", "tile-value")
              .attr("x", 4)
              .attr("y", 28)
              .style("font-size", "10px")
              .style(
                "fill",
                this.resolveTileTextColor(d, colors, categories, depthColors)
              )
              .style("opacity", 0.9)
              .style("pointer-events", "none")
              .text(formatNumber(d.value));
          }
        }
      });
    }
  }

  /**
   * Resolves a tile's background color, then defers the black/white
   * text-contrast decision to the shared WCAG-verified c/chartUtils
   * getContrastColor.
   * @param {Object} d - Data node
   * @param {Array} colors - Color palette
   * @param {Array} categories - Category names
   * @param {Array} depthColors - Depth color palette
   * @returns {String} - Color hex
   */
  resolveTileTextColor(d, colors, categories, depthColors) {
    let bgColor;
    if (this.colorMode === "depth") {
      bgColor = depthColors[d.depth % depthColors.length];
    } else {
      const categoryName = d.depth > 1 ? d.parent.data.name : d.data.name;
      const catIndex = categories.indexOf(categoryName);
      bgColor = colors[catIndex >= 0 ? catIndex : 0];
    }

    return getContrastColor(bgColor);
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showTileTooltip(event, d) {
    if (!this.tooltip) return;

    const percent = this.totalValue > 0 ? d.value / this.totalValue : 0;

    // Build path/category info
    const path = [];
    let current = d;
    while (current.parent) {
      if (current.data.name !== "Root") {
        path.unshift(current.data.name);
      }
      current = current.parent;
    }

    const content = `
            <div class="tooltip-content">
                <div style="font-weight: bold; margin-bottom: 4px;">
                    ${path.join(" › ") || d.data.name}
                </div>
                <div><strong>Value:</strong> ${formatNumber(d.value)}</div>
                <div><strong>Percentage:</strong> ${formatPercent(percent)}</div>
                ${this.enableZoom && d.children ? '<div class="tooltip-hint" style="margin-top: 4px; font-size: 11px; color: #706e6b;">Click to zoom in</div>' : ""}
                ${this.objectApiName && !d.children ? '<div class="tooltip-hint" style="margin-top: 4px; font-size: 11px; color: #706e6b;">Click to view records</div>' : ""}
            </div>
        `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLER - ZOOM AND NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  handleTileClick(d) {
    const filterFieldName = this.filterField || this.groupByField;

    // Dispatch custom event
    this.dispatchEvent(
      new CustomEvent("tileclick", {
        detail: {
          name: d.data.name,
          value: d.value,
          data: d.data.data || d.data,
          depth: d.depth,
          hasChildren: !!d.children,
          filterField: filterFieldName
        },
        bubbles: true,
        composed: true
      })
    );

    // Handle zoom if enabled and node has children
    if (this.enableZoom && d.data.children && d.data.children.length > 0) {
      this.zoomToNode(d.data);
      return;
    }

    // Handle navigation if configured
    if (this.objectApiName && !d.children) {
      this[NavigationMixin.Navigate]({
        type: "standard__objectPage",
        attributes: {
          objectApiName: this.objectApiName,
          actionName: "list"
        }
      });
    }
  }

  /**
   * Zooms into a node, making it the new root.
   * @param {Object} nodeData - Data node to zoom to
   */
  zoomToNode(nodeData) {
    // Add current root to breadcrumbs
    this.breadcrumbs = [
      ...this.breadcrumbs,
      {
        name: this.currentRoot.name === "Root" ? "All" : this.currentRoot.name,
        data: this.currentRoot
      }
    ];

    this.currentRoot = nodeData;

    // Re-render with animation
    const container = this.template.querySelector(".chart-container");
    if (container) {
      const { width } = container.getBoundingClientRect();
      this.renderChart(width);
    }
  }

  /**
   * Handles breadcrumb click to zoom out.
   * @param {Event} event - Click event
   */
  handleBreadcrumbClick(event) {
    const index = parseInt(event.currentTarget.dataset.index, 10);
    const targetCrumb = this.breadcrumbs[index];

    if (targetCrumb) {
      this.currentRoot = targetCrumb.data;
      this.breadcrumbs = this.breadcrumbs.slice(0, index);

      // Re-render
      const container = this.template.querySelector(".chart-container");
      if (container) {
        const { width } = container.getBoundingClientRect();
        this.renderChart(width);
      }
    }
  }

  /**
   * Resets zoom to root.
   */
  handleResetZoom() {
    this.currentRoot = this.rootData;
    this.breadcrumbs = [];

    const container = this.template.querySelector(".chart-container");
    if (container) {
      const { width } = container.getBoundingClientRect();
      this.renderChart(width);
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
