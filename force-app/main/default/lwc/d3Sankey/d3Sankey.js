/**
 * ABOUTME: D3 Sankey Lightning Web Component.
 * ABOUTME: Displays flow/process visualization with nodes and links.
 */
import { LightningElement, api, track } from "lwc";
import { loadScript } from "lightning/platformResourceLoader";
import { loadD3 } from "c/d3Lib";
import { prepareData } from "c/dataService";
import { getColors, DEFAULT_THEME } from "c/themeService";
import {
  formatNumber,
  formatPercent,
  createTooltip,
  createResizeHandler,
  truncateLabel
} from "c/chartUtils";
import { NavigationMixin } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import executeQuery from "@salesforce/apex/D3ChartController.executeQuery";
import D3_SANKEY_RESOURCE from "@salesforce/resourceUrl/d3Sankey";

export default class D3Sankey extends NavigationMixin(LightningElement) {
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  /** Data collection from Flow or parent component */
  @api recordCollection = [];

  /** SOQL query string (used if recordCollection is empty) */
  @api soqlQuery = "";

  /**
   * Pre-built Sankey data structure (alternative to recordCollection)
   * Expected format: { nodes: [{name: 'A'}, ...], links: [{source: 0, target: 1, value: 100}, ...] }
   */
  @api sankeyData = null;

  /** Field containing source node name */
  @api sourceField = "";

  /** Field containing target node name */
  @api targetField = "";

  /** Field containing flow value (numeric) */
  @api valueField = "";

  /** Chart height in pixels */
  @api height = 400;

  /** Color theme */
  @api theme = DEFAULT_THEME;

  /** Width of node rectangles in pixels */
  @api nodeWidth = 20;

  /** Vertical padding between nodes in pixels */
  @api nodePadding = 10;

  /** Link color mode: 'source', 'target', 'gradient', or 'solid' */
  @api linkColorMode = "gradient";

  /** Default link opacity (0-1) */
  @api linkOpacity = 0.5;

  /** Highlighted link opacity on hover (0-1) */
  @api linkHoverOpacity = 0.8;

  /** Show node labels (defaults to true via getter) */
  @api showLabels;

  /** Show values on node labels (defaults to true via getter) */
  @api showValues;

  /** Label position: 'inside', 'outside', or 'auto' */
  @api labelPosition = "auto";

  /** Number of layout iterations (higher = better layout, slower) */
  @api iterations = 32;

  /** Object API name for navigation on link click */
  @api objectApiName = "";

  /** Filter field for navigation */
  @api filterField = "";

  /** Advanced configuration JSON */
  @api advancedConfig = "{}";

  // ═══════════════════════════════════════════════════════════════
  // TRACKED STATE
  // ═══════════════════════════════════════════════════════════════

  @track isLoading = true;
  @track error = null;
  @track graphData = null;
  @track truncatedWarning = null;
  @track totalValue = 0;

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE PROPERTIES
  // ═══════════════════════════════════════════════════════════════

  d3 = null;
  svg = null;
  tooltip = null;
  resizeHandler = null;
  chartRendered = false;
  colorScale = null;
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
    return (
      this.graphData &&
      this.graphData.nodes &&
      this.graphData.nodes.length > 0 &&
      this.graphData.links &&
      this.graphData.links.length > 0
    );
  }

  get showChart() {
    return !this.isLoading && !this.hasError && this.hasData;
  }

  get effectiveShowLabels() {
    return this.showLabels !== false;
  }

  get effectiveShowValues() {
    return this.showValues !== false;
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

      // Load d3-sankey plugin if not already present on the d3 global
      if (!this.d3.sankey) {
        await loadScript(this, D3_SANKEY_RESOURCE);
        // Plugin UMD attaches to window.d3; refresh reference
        this.d3 = window.d3;
      }

      await this.loadData();
    } catch (e) {
      this.error = e.message || "Failed to initialize chart";
      console.error("D3Sankey initialization error:", e);
    } finally {
      this.isLoading = false;
    }
  }

  renderedCallback() {
    if (this.showChart && !this.chartRendered) {
      this.initializeChart();
      this.chartRendered = true;
    }
  }

  disconnectedCallback() {
    this.cleanup();
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  async loadData() {
    // Check for pre-built sankey data first
    if (this.sankeyData) {
      this.graphData = this.validateSankeyData(this.sankeyData);
      this.calculateTotalValue();
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
        "No data source provided. Set recordCollection, sankeyData, or soqlQuery."
      );
    }

    // Validate required fields
    if (!this.sourceField || !this.targetField) {
      throw new Error("sourceField and targetField are required for flat data");
    }

    const requiredFields = [this.sourceField, this.targetField];
    if (this.valueField) {
      requiredFields.push(this.valueField);
    }

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

    // Build sankey data from flat records
    this.graphData = this.buildSankeyData(prepared.data);
    this.calculateTotalValue();

    if (!this.graphData.nodes || this.graphData.nodes.length === 0) {
      throw new Error("No nodes generated from data");
    }

    if (!this.graphData.links || this.graphData.links.length === 0) {
      throw new Error("No links generated from data");
    }
  }

  /**
   * Validates and normalizes pre-built sankey data structure.
   * @param {Object} data - Sankey data with nodes and links
   * @returns {Object} - Validated sankey data
   */
  validateSankeyData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Sankey data must be an object");
    }

    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error("Sankey data must have a nodes array");
    }

    if (!data.links || !Array.isArray(data.links)) {
      throw new Error("Sankey data must have a links array");
    }

    // Normalize nodes to ensure they have name property
    const nodes = data.nodes.map((node, index) => ({
      name: node.name || `Node ${index}`,
      ...node
    }));

    // Create node index map for link validation
    const nodeIndexMap = new Map();
    nodes.forEach((node, index) => {
      nodeIndexMap.set(node.name, index);
      nodeIndexMap.set(index, index);
    });

    // Normalize links
    const links = data.links
      .map((link) => {
        let sourceIndex, targetIndex;

        // Handle source
        if (typeof link.source === "number") {
          sourceIndex = link.source;
        } else if (typeof link.source === "string") {
          sourceIndex = nodeIndexMap.get(link.source);
        } else if (typeof link.source === "object" && link.source.name) {
          sourceIndex = nodeIndexMap.get(link.source.name);
        }

        // Handle target
        if (typeof link.target === "number") {
          targetIndex = link.target;
        } else if (typeof link.target === "string") {
          targetIndex = nodeIndexMap.get(link.target);
        } else if (typeof link.target === "object" && link.target.name) {
          targetIndex = nodeIndexMap.get(link.target.name);
        }

        if (sourceIndex === undefined || targetIndex === undefined) {
          console.warn("Invalid link reference:", link);
          return null;
        }

        return {
          source: sourceIndex,
          target: targetIndex,
          value: Number(link.value) || 1
        };
      })
      .filter((link) => link !== null);

    return { nodes, links };
  }

  /**
   * Builds sankey data structure from flat records.
   * @param {Array} data - Flat data array with source, target, value fields
   * @returns {Object} - { nodes: Array, links: Array }
   */
  buildSankeyData(data) {
    const nodeSet = new Set();
    const linkMap = new Map();

    // Collect unique nodes and aggregate links
    data.forEach((record) => {
      const source = String(record[this.sourceField] ?? "Unknown");
      const target = String(record[this.targetField] ?? "Unknown");
      const value = this.valueField ? Number(record[this.valueField]) || 1 : 1;

      nodeSet.add(source);
      nodeSet.add(target);

      const linkKey = `${source}→${target}`;
      if (linkMap.has(linkKey)) {
        linkMap.get(linkKey).value += value;
      } else {
        linkMap.set(linkKey, { source, target, value });
      }
    });

    // Create nodes array
    const nodeArray = Array.from(nodeSet);
    const nodeIndexMap = new Map();
    const nodes = nodeArray.map((name, index) => {
      nodeIndexMap.set(name, index);
      return { name };
    });

    // Create links array with node indices
    const links = Array.from(linkMap.values()).map((link) => ({
      source: nodeIndexMap.get(link.source),
      target: nodeIndexMap.get(link.target),
      value: link.value
    }));

    return { nodes, links };
  }

  /**
   * Calculates total value from all links.
   */
  calculateTotalValue() {
    if (!this.graphData || !this.graphData.links) {
      this.totalValue = 0;
      return;
    }

    this.totalValue = this.graphData.links.reduce(
      (sum, link) => sum + (link.value || 0),
      0
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CHART RENDERING
  // ═══════════════════════════════════════════════════════════════

  initializeChart() {
    const container = this.template.querySelector(".chart-container");
    if (!container) return;

    const { width } = container.getBoundingClientRect();
    if (width === 0) return;

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
  }

  /**
   * Calculates left/right label margins dynamically based on node label text.
   * Estimates pixel width from character count at 11px sans-serif, capped at
   * 25% of container width so labels never consume the chart area.
   * @param {Number} containerWidth - Available container width in pixels
   * @returns {Number} - Margin in pixels for each side
   */
  calculateLabelMargin(containerWidth) {
    const MIN_MARGIN = 20;
    const MAX_MARGIN_RATIO = 0.25;
    const CHAR_WIDTH = 6.5;
    const LABEL_PADDING = 12;

    if (!this.effectiveShowLabels || this.labelPosition === "inside") {
      return MIN_MARGIN;
    }

    if (
      !this.graphData ||
      !this.graphData.nodes ||
      this.graphData.nodes.length === 0
    ) {
      return MIN_MARGIN;
    }

    let maxLabelLength = 0;
    for (const node of this.graphData.nodes) {
      let label = truncateLabel(node.name, 20);
      if (this.effectiveShowValues && this.totalValue > 0) {
        // Use totalValue as upper bound for any single node value
        const valueStr = formatNumber(this.totalValue);
        label += ` (${valueStr})`;
      }
      maxLabelLength = Math.max(maxLabelLength, label.length);
    }

    const estimatedWidth = maxLabelLength * CHAR_WIDTH + LABEL_PADDING;
    const maxMargin = containerWidth * MAX_MARGIN_RATIO;

    return Math.max(MIN_MARGIN, Math.min(Math.ceil(estimatedWidth), maxMargin));
  }

  renderChart(containerWidth) {
    const d3 = this.d3;
    const container = this.template.querySelector(".chart-container");
    if (!container || !d3 || !this.graphData) return;

    // Clear existing SVG
    d3.select(container).select("svg").remove();

    const labelMargin = this.calculateLabelMargin(containerWidth);
    const margin = {
      top: 10,
      right: labelMargin,
      bottom: 10,
      left: labelMargin
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
      .attr("class", "sankey-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create deep copy of graph data to avoid D3 mutation issues
    const graphCopy = {
      nodes: this.graphData.nodes.map((d) => ({ ...d })),
      links: this.graphData.links.map((d) => ({ ...d }))
    };

    // Create sankey generator
    const sankey = d3
      .sankey()
      .nodeWidth(this.nodeWidth)
      .nodePadding(this.nodePadding)
      .nodeAlign(d3.sankeyJustify)
      .extent([
        [0, 0],
        [width, height]
      ])
      .iterations(this.iterations);

    // Generate layout
    let sankeyLayout;
    try {
      sankeyLayout = sankey(graphCopy);
    } catch (e) {
      console.error("Sankey layout error:", e);
      this.error = "Failed to generate Sankey layout: " + e.message;
      return;
    }

    const { nodes, links } = sankeyLayout;

    // Get colors
    const colors = getColors(
      this.theme,
      nodes.length,
      this.config.customColors
    );
    const colorMap = new Map();
    nodes.forEach((node, i) =>
      colorMap.set(node.name, colors[i % colors.length])
    );

    // Create gradient definitions for links
    if (this.linkColorMode === "gradient") {
      this.createGradients(links, colorMap);
    }

    // Draw links
    const linkGroup = this.svg
      .append("g")
      .attr("class", "links")
      .attr("fill", "none")
      .attr("stroke-opacity", this.linkOpacity);

    const linkPaths = linkGroup
      .selectAll("path")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", (d, i) => this.getLinkColor(d, i, colorMap))
      .attr("stroke-width", (d) => Math.max(1, d.width))
      .attr("cursor", this.objectApiName ? "pointer" : "default")
      .on("mouseenter", (event, d) => {
        this.showLinkTooltip(event, d);
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("stroke-opacity", this.linkHoverOpacity);
      })
      .on("mouseleave", (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(100)
          .attr("stroke-opacity", this.linkOpacity);
      })
      .on("click", (event, d) => {
        this.handleLinkClick(d);
      });

    // Animate links
    linkPaths
      .attr("stroke-dasharray", function () {
        const length = this.getTotalLength ? this.getTotalLength() : 1000;
        return length + " " + length;
      })
      .attr("stroke-dashoffset", function () {
        return this.getTotalLength ? this.getTotalLength() : 1000;
      })
      .transition()
      .duration(1000)
      .attr("stroke-dashoffset", 0);

    // Draw nodes
    const nodeGroup = this.svg.append("g").attr("class", "nodes");

    const nodeRects = nodeGroup
      .selectAll("rect")
      .data(nodes)
      .enter()
      .append("rect")
      .attr("class", "node")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("height", (d) => Math.max(1, d.y1 - d.y0))
      .attr("width", (d) => d.x1 - d.x0)
      .attr("fill", (d) => colorMap.get(d.name) || colors[0])
      .attr("stroke", "#333")
      .attr("stroke-width", 1)
      .attr("rx", 2)
      .attr("cursor", "pointer")
      .attr("opacity", 0)
      .on("mouseenter", (event, d) => {
        this.showNodeTooltip(event, d);
        this.highlightConnectedLinks(d, links, linkPaths);
      })
      .on("mouseleave", () => {
        this.hideTooltip();
        this.resetLinkHighlights(linkPaths);
      })
      .on("click", (event, d) => {
        this.handleNodeClick(d);
      });

    // Animate nodes
    nodeRects
      .transition()
      .duration(500)
      .delay((d, i) => i * 30)
      .attr("opacity", 1);

    // Draw labels
    if (this.effectiveShowLabels) {
      this.drawLabels(nodes, width);
    }
  }

  /**
   * Creates gradient definitions for gradient-colored links.
   * @param {Array} links - Sankey links
   * @param {Map} colorMap - Node name to color mapping
   */
  createGradients(links, colorMap) {
    const defs = this.svg.append("defs");

    links.forEach((link, i) => {
      const gradient = defs
        .append("linearGradient")
        .attr("id", `link-gradient-${i}`)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", link.source.x1)
        .attr("x2", link.target.x0);

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorMap.get(link.source.name));

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorMap.get(link.target.name));
    });
  }

  /**
   * Gets the color for a link based on linkColorMode.
   * @param {Object} d - Link data
   * @param {Number} i - Link index
   * @param {Map} colorMap - Node name to color mapping
   * @returns {String} - Color value
   */
  getLinkColor(d, i, colorMap) {
    switch (this.linkColorMode) {
      case "source":
        return colorMap.get(d.source.name) || "#999";
      case "target":
        return colorMap.get(d.target.name) || "#999";
      case "gradient":
        return `url(#link-gradient-${i})`;
      case "solid":
      default:
        return this.config.linkColor || "#999";
    }
  }

  /**
   * Draws node labels.
   * @param {Array} nodes - Sankey nodes
   * @param {Number} width - Chart width
   */
  drawLabels(nodes, width) {
    const labelGroup = this.svg
      .append("g")
      .attr("class", "labels")
      .style("font-size", "11px");

    nodes.forEach((node) => {
      const isLeftSide = node.x0 < width / 2;
      const nodeHeight = node.y1 - node.y0;

      // Determine label position
      let labelPosition = this.labelPosition;
      if (labelPosition === "auto") {
        labelPosition = nodeHeight < 20 ? "outside" : "outside";
      }

      const x =
        labelPosition === "inside"
          ? node.x0 + (node.x1 - node.x0) / 2
          : isLeftSide
            ? node.x0 - 6
            : node.x1 + 6;

      const y = (node.y0 + node.y1) / 2;

      const anchor =
        labelPosition === "inside" ? "middle" : isLeftSide ? "end" : "start";

      // Build label text
      let labelText = truncateLabel(node.name, 20);
      if (this.effectiveShowValues) {
        labelText += ` (${formatNumber(node.value)})`;
      }

      labelGroup
        .append("text")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", "0.35em")
        .attr("text-anchor", anchor)
        .style("fill", labelPosition === "inside" ? "#fff" : "#333")
        .style("font-weight", labelPosition === "inside" ? "bold" : "normal")
        .style("pointer-events", "none")
        .text(labelText);
    });
  }

  /**
   * Highlights links connected to a node.
   * @param {Object} node - Hovered node
   * @param {Array} links - All links
   * @param {Selection} linkPaths - D3 selection of link paths
   */
  highlightConnectedLinks(node, links, linkPaths) {
    const d3 = this.d3;
    const connectedLinks = new Set();

    links.forEach((link, i) => {
      if (link.source === node || link.target === node) {
        connectedLinks.add(i);
      }
    });

    linkPaths.each((d, i, elements) => {
      const isConnected = connectedLinks.has(i);
      d3.select(elements[i])
        .transition()
        .duration(100)
        .attr(
          "stroke-opacity",
          isConnected ? this.linkHoverOpacity : this.linkOpacity * 0.3
        );
    });
  }

  /**
   * Resets all link highlights.
   * @param {Selection} linkPaths - D3 selection of link paths
   */
  resetLinkHighlights(linkPaths) {
    linkPaths
      .transition()
      .duration(100)
      .attr("stroke-opacity", this.linkOpacity);
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOLTIP HANDLERS
  // ═══════════════════════════════════════════════════════════════

  showLinkTooltip(event, d) {
    if (!this.tooltip) return;

    const sourceName = d.source.name || "Source";
    const targetName = d.target.name || "Target";
    const percent = this.totalValue > 0 ? d.value / this.totalValue : 0;

    const content = `
            <div class="tooltip-content">
                <div style="font-weight: bold; margin-bottom: 4px;">
                    ${sourceName} → ${targetName}
                </div>
                <div><strong>Value:</strong> ${formatNumber(d.value)}</div>
                <div><strong>Percentage:</strong> ${formatPercent(percent)}</div>
                ${this.objectApiName ? '<div class="tooltip-hint" style="margin-top: 4px; font-size: 11px; color: #706e6b;">Click to view records</div>' : ""}
            </div>
        `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  showNodeTooltip(event, d) {
    if (!this.tooltip) return;

    const incomingValue = (d.targetLinks || []).reduce(
      (sum, link) => sum + link.value,
      0
    );
    const outgoingValue = (d.sourceLinks || []).reduce(
      (sum, link) => sum + link.value,
      0
    );
    const percent = this.totalValue > 0 ? d.value / this.totalValue : 0;

    const content = `
            <div class="tooltip-content">
                <div style="font-weight: bold; margin-bottom: 4px;">
                    ${d.name}
                </div>
                <div><strong>Total Value:</strong> ${formatNumber(d.value)}</div>
                <div><strong>Incoming:</strong> ${formatNumber(incomingValue)}</div>
                <div><strong>Outgoing:</strong> ${formatNumber(outgoingValue)}</div>
                <div><strong>Percentage:</strong> ${formatPercent(percent)}</div>
            </div>
        `;

    this.tooltip.show(content, event.offsetX, event.offsetY);
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.hide();
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK HANDLERS
  // ═══════════════════════════════════════════════════════════════

  handleLinkClick(d) {
    // Dispatch custom event
    this.dispatchEvent(
      new CustomEvent("linkclick", {
        detail: {
          source: d.source.name,
          target: d.target.name,
          value: d.value,
          data: d
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
      }
    });
  }

  handleNodeClick(d) {
    // Dispatch custom event
    this.dispatchEvent(
      new CustomEvent("nodeclick", {
        detail: {
          name: d.name,
          value: d.value,
          incomingLinks: d.targetLinks ? d.targetLinks.length : 0,
          outgoingLinks: d.sourceLinks ? d.sourceLinks.length : 0,
          data: d
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
