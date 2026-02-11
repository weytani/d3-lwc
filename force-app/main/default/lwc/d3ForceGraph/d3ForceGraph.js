// ABOUTME: D3 Force Graph Lightning Web Component for network/graph visualization.
// ABOUTME: Displays nodes and edges with force simulation, drag, zoom, tooltips, and navigation.
import { LightningElement, api, track } from "lwc";
import { loadD3 } from "c/d3Lib";
import { prepareData } from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  createTooltip,
  createResizeHandler,
  createLayoutRetry,
  truncateLabel
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";

// Lower default limit for force graphs due to performance
const MAX_NODES = 500;

export default class D3ForceGraph extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /**
   * Pre-built graph data structure (alternative to recordCollection)
   * Expected format: { nodes: [{id: 'A', label: 'Node A', ...}], links: [{source: 'A', target: 'B', ...}] }
   */
  @api graphData = null;

  /** Field containing the node ID */
  @api nodeIdField = "Id";

  /** Field containing the node label */
  @api nodeLabelField = "Name";

  /** Field containing the source node ID for relationships */
  @api sourceField = "";

  /** Field containing the target node ID for relationships */
  @api targetField = "";

  /** Optional field for node sizing (numeric) */
  @api nodeSizeField = "";

  /** Optional field for link weight/width (numeric) */
  @api linkWeightField = "";

  /** Optional field for node grouping/coloring */
  @api nodeTypeField = "";

  /** Object API name for navigation on node click */
  @api objectApiName = "";

  /** Chart height in pixels */
  @api height = 400;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Base node radius in pixels */
  @api nodeRadius = 8;

  /** Minimum node radius when using nodeSizeField */
  @api minNodeRadius = 4;

  /** Maximum node radius when using nodeSizeField */
  @api maxNodeRadius = 20;

  /** Link stroke width */
  @api linkWidth = 1.5;

  /** Minimum link width when using linkWeightField */
  @api minLinkWidth = 0.5;

  /** Maximum link width when using linkWeightField */
  @api maxLinkWidth = 6;

  /** Link color (default gray) */
  @api linkColor = "#999999";

  /** Link opacity (0-1) */
  @api linkOpacity = 0.6;

  /** Show node labels (defaults to true via getter) */
  @api showLabels;

  /** Label font size */
  @api labelFontSize = 10;

  /** Enable zoom and pan (defaults to true via getter) */
  @api enableZoom;

  /** Enable node dragging (defaults to true via getter) */
  @api enableDrag;

  /** Charge strength (negative = repulsion) */
  @api chargeStrength = -300;

  /** Collision radius multiplier */
  @api collisionMultiplier = 1.5;

  /** Link distance */
  @api linkDistance = 50;

  /** Center force strength (0-1) */
  @api centerStrength = 0.1;

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track networkData = null;
  @track truncatedWarning = null;

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  d3 = null;
  svg = null;
  simulation = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  _layoutRetry = null;
  zoomBehavior = null;
  _config = {};
  _configParsed = false;
  _nodeGroups = [];
  _currentTransform = null;

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
    return (
      this.networkData &&
      this.networkData.nodes &&
      this.networkData.nodes.length > 0
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

  get effectiveShowLabels() {
    return this.showLabels !== false;
  }

  get effectiveEnableZoom() {
    return this.enableZoom !== false;
  }

  get effectiveEnableDrag() {
    return this.enableDrag !== false;
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
      console.error("D3ForceGraph initialization error:", e);
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
    // Check for pre-built graph data first
    if (this.graphData) {
      this.networkData = this.validateGraphData(this.graphData);
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
        "No data source provided. Set recordCollection, graphData, or soqlQuery."
      );
    }

    // Validate required fields
    if (!this.sourceField || !this.targetField) {
      throw new Error("sourceField and targetField are required for flat data");
    }

    const requiredFields = [this.sourceField, this.targetField];

    const prepared = prepareData(rawData, {
      requiredFields,
      limit: MAX_NODES * 2 // Allow more links than nodes
    });

    if (!prepared.valid) {
      throw new Error(prepared.error);
    }

    if (prepared.truncated) {
      this.truncatedWarning = `Displaying first ${MAX_NODES * 2} of ${prepared.originalCount} records`;
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Data Truncated",
          message: this.truncatedWarning,
          variant: "warning"
        })
      );
    }

    // Build graph data from flat records
    this.networkData = this.buildGraphData(prepared.data);

    if (!this.networkData.nodes || this.networkData.nodes.length === 0) {
      throw new Error("No nodes generated from data");
    }
  }

  /**
   * Validates and normalizes pre-built graph data structure.
   * @param {Object} data - Graph data with nodes and links
   * @returns {Object} - Validated graph data
   */
  validateGraphData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Graph data must be an object");
    }

    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error("Graph data must have a nodes array");
    }

    // Links are optional (could be standalone nodes)
    const links = data.links && Array.isArray(data.links) ? data.links : [];

    // Normalize nodes to ensure they have id and label
    const nodes = data.nodes.slice(0, MAX_NODES).map((node, index) => ({
      id: node.id || node[this.nodeIdField] || `node-${index}`,
      label:
        node.label || node[this.nodeLabelField] || node.name || `Node ${index}`,
      size: node.size || node[this.nodeSizeField],
      type: node.type || node[this.nodeTypeField],
      recordId: node.recordId || node.Id || node.id,
      ...node
    }));

    // Create node ID set for validation
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Collect unique types for coloring
    this._nodeGroups = [...new Set(nodes.map((n) => n.type).filter(Boolean))];

    // Normalize links - filter out invalid references
    const validLinks = links
      .map((link) => {
        const source =
          typeof link.source === "object" ? link.source.id : link.source;
        const target =
          typeof link.target === "object" ? link.target.id : link.target;

        if (!nodeIds.has(source) || !nodeIds.has(target)) {
          return null;
        }

        return {
          source,
          target,
          weight: link.weight || link[this.linkWeightField] || 1,
          ...link
        };
      })
      .filter((link) => link !== null);

    return { nodes, links: validLinks };
  }

  /**
   * Builds graph data structure from flat relationship records.
   * @param {Array} data - Flat data array with source and target fields
   * @returns {Object} - { nodes: Array, links: Array }
   */
  buildGraphData(data) {
    const nodeMap = new Map();
    const links = [];

    // Process each relationship record
    data.forEach((record) => {
      const sourceId = String(record[this.sourceField] ?? "");
      const targetId = String(record[this.targetField] ?? "");

      if (!sourceId || !targetId) return;

      // Add source node if not exists
      if (!nodeMap.has(sourceId)) {
        nodeMap.set(sourceId, {
          id: sourceId,
          label: record[this.nodeLabelField] || sourceId,
          size: this.nodeSizeField
            ? Number(record[this.nodeSizeField]) || 1
            : 1,
          type: this.nodeTypeField ? record[this.nodeTypeField] : null,
          recordId: record[this.nodeIdField] || record.Id
        });
      }

      // Add target node if not exists
      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, {
          id: targetId,
          label: targetId,
          size: 1,
          type: null,
          recordId: null
        });
      }

      // Add link
      links.push({
        source: sourceId,
        target: targetId,
        weight: this.linkWeightField
          ? Number(record[this.linkWeightField]) || 1
          : 1
      });
    });

    // Enforce node limit
    const nodes = Array.from(nodeMap.values()).slice(0, MAX_NODES);
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Filter links to only include valid node references
    const validLinks = links.filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    // Collect unique types
    this._nodeGroups = [...new Set(nodes.map((n) => n.type).filter(Boolean))];

    return { nodes, links: validLinks };
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
    if (!container || !d3 || !this.networkData) return;

    // Stop existing simulation
    if (this.simulation) {
      this.simulation.stop();
    }

    // Clear existing SVG
    d3.select(container).select("svg").remove();

    const width = containerWidth;
    const height = this.height;

    if (width <= 0 || height <= 0) return;

    // Create deep copy of data to avoid D3 mutation issues
    const nodes = this.networkData.nodes.map((d) => ({ ...d }));
    const links = this.networkData.links.map((d) => ({ ...d }));

    // Create SVG
    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("class", "force-graph-svg")
      .attr("viewBox", [0, 0, width, height]);

    this.svg = svg;

    // Create main group for zoom/pan
    const g = svg.append("g").attr("class", "graph-container");

    // Setup scales
    const nodeExtent = d3.extent(nodes, (d) => d.size) || [1, 1];
    const linkExtent = d3.extent(links, (d) => d.weight) || [1, 1];

    const radiusScale = d3
      .scaleLinear()
      .domain(nodeExtent[0] === nodeExtent[1] ? [0, nodeExtent[1]] : nodeExtent)
      .range([this.minNodeRadius, this.maxNodeRadius]);

    const linkWidthScale = d3
      .scaleLinear()
      .domain(linkExtent[0] === linkExtent[1] ? [0, linkExtent[1]] : linkExtent)
      .range([this.minLinkWidth, this.maxLinkWidth]);

    // Get colors for node types
    const colorCount = this._nodeGroups.length || 1;
    const colors = getColors(
      this.theme,
      Math.max(colorCount, 1),
      this.config.customColors
    );

    const colorScale = d3.scaleOrdinal().domain(this._nodeGroups).range(colors);

    // Create force simulation
    this.simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(this.linkDistance)
      )
      .force("charge", d3.forceManyBody().strength(this.chargeStrength))
      .force(
        "center",
        d3.forceCenter(width / 2, height / 2).strength(this.centerStrength)
      )
      .force(
        "collision",
        d3
          .forceCollide()
          .radius(
            (d) => this.getNodeRadius(d, radiusScale) * this.collisionMultiplier
          )
      );

    // Draw links
    const linkGroup = g
      .append("g")
      .attr("class", "links")
      .attr("stroke", this.config.linkColor || this.linkColor)
      .attr("stroke-opacity", this.linkOpacity);

    const link = linkGroup
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link")
      // eslint-disable-next-line no-confusing-arrow
      .attr("stroke-width", (d) =>
        this.linkWeightField ? linkWidthScale(d.weight) : this.linkWidth
      );

    // Draw nodes
    const nodeGroup = g.append("g").attr("class", "nodes");

    const node = nodeGroup
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .attr("cursor", this.objectApiName ? "pointer" : "grab");

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => this.getNodeRadius(d, radiusScale))
      .attr("fill", (d) => (d.type ? colorScale(d.type) : colors[0]))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    // Node labels
    if (this.effectiveShowLabels) {
      node
        .append("text")
        .attr("class", "node-label")
        .attr("dx", (d) => this.getNodeRadius(d, radiusScale) + 4)
        .attr("dy", "0.35em")
        .style("font-size", `${this.labelFontSize}px`)
        .style("fill", "#333")
        .style("pointer-events", "none")
        .text((d) => truncateLabel(d.label, 15));
    }

    // Node interactions
    node
      .on("mouseenter", (event, d) => {
        this.showNodeTooltip(event, d, colorScale);
        this.highlightConnectedNodes(d, node, link);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
        this.resetHighlights(node, link);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        this.handleNodeClick(d);
      });

    // Link interactions
    link
      .on("mouseenter", (event, d) => {
        this.showLinkTooltip(event, d);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
      });

    // Enable drag
    if (this.effectiveEnableDrag) {
      node.call(this.createDragBehavior(this.simulation));
    }

    // Enable zoom/pan
    if (this.effectiveEnableZoom) {
      this.setupZoom(svg, g, width, height);
    }

    // Update positions on simulation tick
    this.simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Render legend if we have groups
    if (this._nodeGroups.length > 1) {
      this.renderLegend(svg, colorScale, width);
    }
  }

  /**
   * Gets node radius based on size field or default.
   * @param {Object} d - Node data
   * @param {Function} scale - Radius scale
   * @returns {Number} - Radius value
   */
  getNodeRadius(d, scale) {
    if (this.nodeSizeField && d.size != null) {
      return scale(d.size);
    }
    return this.nodeRadius;
  }

  /**
   * Creates drag behavior for nodes.
   * @param {Object} simulation - D3 force simulation
   * @returns {Object} - D3 drag behavior
   */
  createDragBehavior(simulation) {
    const d3 = this.d3;

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  /**
   * Sets up zoom and pan behavior.
   * @param {Object} svg - D3 SVG selection
   * @param {Object} g - Main group selection
   * @param {Number} width - Chart width
   * @param {Number} height - Chart height
   */
  // eslint-disable-next-line no-unused-vars
  setupZoom(svg, g, width, height) {
    const d3 = this.d3;

    this.zoomBehavior = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        this._currentTransform = event.transform;
      });

    svg.call(this.zoomBehavior);

    // Apply saved transform if exists
    if (this._currentTransform) {
      svg.call(this.zoomBehavior.transform, this._currentTransform);
    }
  }

  /**
   * Highlights nodes connected to the hovered node.
   * @param {Object} d - Hovered node data
   * @param {Object} nodeSelection - D3 node selection
   * @param {Object} linkSelection - D3 link selection
   */
  highlightConnectedNodes(d, nodeSelection, linkSelection) {
    const connectedIds = new Set([d.id]);

    // Find connected nodes via links
    this.networkData.links.forEach((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;

      if (sourceId === d.id) connectedIds.add(targetId);
      if (targetId === d.id) connectedIds.add(sourceId);
    });

    // Dim unconnected nodes
    nodeSelection
      .select("circle")
      .transition()
      .duration(100)
      .attr("opacity", (node) => (connectedIds.has(node.id) ? 1 : 0.2));

    nodeSelection
      .select("text")
      .transition()
      .duration(100)
      .attr("opacity", (node) => (connectedIds.has(node.id) ? 1 : 0.2));

    // Highlight connected links
    linkSelection
      .transition()
      .duration(100)
      .attr("stroke-opacity", (link) => {
        const sourceId =
          typeof link.source === "object" ? link.source.id : link.source;
        const targetId =
          typeof link.target === "object" ? link.target.id : link.target;
        return sourceId === d.id || targetId === d.id ? 0.9 : 0.1;
      })
      .attr("stroke-width", (link) => {
        const sourceId =
          typeof link.source === "object" ? link.source.id : link.source;
        const targetId =
          typeof link.target === "object" ? link.target.id : link.target;
        const baseWidth = this.linkWeightField ? link.weight : this.linkWidth;
        return sourceId === d.id || targetId === d.id
          ? baseWidth * 1.5
          : baseWidth;
      });
  }

  /**
   * Resets all highlights.
   * @param {Object} nodeSelection - D3 node selection
   * @param {Object} linkSelection - D3 link selection
   */
  resetHighlights(nodeSelection, linkSelection) {
    nodeSelection
      .select("circle")
      .transition()
      .duration(100)
      .attr("opacity", 1);

    nodeSelection.select("text").transition().duration(100).attr("opacity", 1);

    linkSelection
      .transition()
      .duration(100)
      .attr("stroke-opacity", this.linkOpacity)
      // eslint-disable-next-line no-confusing-arrow
      .attr("stroke-width", (d) =>
        this.linkWeightField ? d.weight : this.linkWidth
      );
  }

  /**
   * Renders legend for node groups.
   * @param {Object} svg - D3 SVG selection
   * @param {Function} colorScale - D3 color scale
   * @param {Number} width - Chart width
   */
  renderLegend(svg, colorScale, width) {
    const legendGroup = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - 120}, 20)`);

    // Background
    const bgPadding = 8;
    const itemHeight = 20;
    const legendHeight = this._nodeGroups.length * itemHeight + bgPadding * 2;

    legendGroup
      .append("rect")
      .attr("x", -bgPadding)
      .attr("y", -bgPadding)
      .attr("width", 110)
      .attr("height", legendHeight)
      .attr("fill", "white")
      .attr("fill-opacity", 0.9)
      .attr("rx", 4);

    this._nodeGroups.forEach((group, i) => {
      const item = legendGroup
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(0, ${i * itemHeight})`);

      item
        .append("circle")
        .attr("cx", 6)
        .attr("cy", 6)
        .attr("r", 5)
        .attr("fill", colorScale(group));

      item
        .append("text")
        .attr("x", 16)
        .attr("y", 10)
        .style("font-size", "11px")
        .style("fill", "#333")
        .text(truncateLabel(group, 12));
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showNodeTooltip(event, d, colorScale) {
    if (!this.tooltip) return;

    const connectionCount = this.networkData.links.filter((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;
      return sourceId === d.id || targetId === d.id;
    }).length;

    let typeInfo = "";
    if (d.type) {
      const color = colorScale(d.type);
      typeInfo = `<div style="border-left: 3px solid ${color}; padding-left: 8px; margin-bottom: 8px;"><strong>${d.type}</strong></div>`;
    }

    let sizeInfo = "";
    if (this.nodeSizeField && d.size != null) {
      sizeInfo = `<div><strong>Size:</strong> ${formatNumber(d.size)}</div>`;
    }

    const content = `
            <div class="tooltip-content">
                <div style="font-weight: bold; margin-bottom: 4px;">${d.label}</div>
                ${typeInfo}
                <div><strong>Connections:</strong> ${connectionCount}</div>
                ${sizeInfo}
                ${this.objectApiName && d.recordId ? '<div class="tooltip-hint" style="margin-top: 4px; font-size: 11px; color: #aaa;">Click to view record</div>' : ""}
            </div>
        `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  showLinkTooltip(event, d) {
    if (!this.tooltip) return;

    const sourceLabel =
      typeof d.source === "object" ? d.source.label : d.source;
    const targetLabel =
      typeof d.target === "object" ? d.target.label : d.target;

    let weightInfo = "";
    if (this.linkWeightField) {
      weightInfo = `<div><strong>Weight:</strong> ${formatNumber(d.weight)}</div>`;
    }

    const content = `
            <div class="tooltip-content">
                <div style="font-weight: bold; margin-bottom: 4px;">${sourceLabel} → ${targetLabel}</div>
                ${weightInfo}
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

  handleNodeClick(d) {
    // Dispatch custom event
    this.dispatchEvent(
      new CustomEvent("nodeclick", {
        detail: {
          id: d.id,
          label: d.label,
          type: d.type,
          size: d.size,
          recordId: d.recordId,
          data: d
        },
        bubbles: true,
        composed: true
      })
    );

    // Navigate to record if configured
    if (!this.objectApiName || !d.recordId) return;

    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        recordId: d.recordId,
        objectApiName: this.objectApiName,
        actionName: "view"
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  cleanup() {
    // Stop simulation
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }

    // Disconnect resize observer
    if (this.resizeHandler) {
      this.resizeHandler.disconnect();
      this.resizeHandler = null;
    }

    // Destroy tooltip
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
