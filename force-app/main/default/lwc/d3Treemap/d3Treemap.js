/**
 * D3 Treemap Lightning Web Component
 * Displays hierarchical data as nested rectangles sized by value.
 * Supports both hierarchical data and flat data with auto-nesting via groupByField.
 */
import { LightningElement, api, track } from 'lwc';
import { loadD3 } from 'c/d3Lib';
import { prepareData, aggregateData, OPERATIONS } from 'c/dataService';
import { getColors, DEFAULT_THEME } from 'c/themeService';
import { formatNumber, formatPercent, createTooltip, createResizeHandler, truncateLabel } from 'c/chartUtils';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';

export default class D3Treemap extends NavigationMixin(LightningElement) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════
    
    /** Data collection from Flow or parent component */
    @api recordCollection = [];
    
    /** SOQL query string (used if recordCollection is empty) */
    @api soqlQuery = '';
    
    /** 
     * Hierarchical data structure (alternative to recordCollection)
     * Expected format: { name: 'Root', children: [{ name: 'A', value: 100 }, ...] }
     */
    @api hierarchyData = null;
    
    /** Field to group by (creates hierarchy from flat data) */
    @api groupByField = '';
    
    /** Secondary group field for nested hierarchy */
    @api secondaryGroupByField = '';
    
    /** Field to aggregate (rectangle values) */
    @api valueField = '';
    
    /** Aggregation operation: Sum, Count, Average */
    @api operation = OPERATIONS.SUM;
    
    /** Chart height in pixels */
    @api height = 400;
    
    /** Color theme */
    @api theme = DEFAULT_THEME;
    
    /** Color mode: 'category' colors by group, 'depth' colors by nesting level */
    @api colorMode = 'category';
    
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
    @api objectApiName = '';
    
    /** Filter field for drill-down */
    @api filterField = '';
    
    /** Advanced configuration JSON */
    @api advancedConfig = '{}';

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════
    
    @track isLoading = true;
    @track error = null;
    @track rootData = null;
    @track truncatedWarning = null;
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
        return this.rootData && this.rootData.children && this.rootData.children.length > 0;
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
                this._config = JSON.parse(this.advancedConfig || '{}');
            } catch (e) {
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
            this.error = e.message || 'Failed to initialize chart';
            console.error('D3Treemap initialization error:', e);
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
        } else if (this.soqlQuery) {
            try {
                rawData = await executeQuery({ queryString: this.soqlQuery });
            } catch (e) {
                throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
            }
        } else {
            throw new Error('No data source provided. Set recordCollection, hierarchyData, or soqlQuery.');
        }

        // Validate required fields
        const requiredFields = [this.groupByField];
        if (this.operation !== OPERATIONS.COUNT) {
            requiredFields.push(this.valueField);
        }

        const prepared = prepareData(rawData, { requiredFields });
        
        if (!prepared.valid) {
            throw new Error(prepared.error);
        }

        if (prepared.truncated) {
            this.truncatedWarning = `Displaying first 2,000 of ${prepared.originalCount} records`;
            this.dispatchEvent(new ShowToastEvent({
                title: 'Data Truncated',
                message: this.truncatedWarning,
                variant: 'warning'
            }));
        }

        // Build hierarchy from flat data
        this.rootData = this.buildHierarchy(prepared.data);
        this.currentRoot = this.rootData;
        this.calculateTotalValue();

        if (!this.rootData.children || this.rootData.children.length === 0) {
            throw new Error('No data after building hierarchy');
        }
    }

    /**
     * Validates and normalizes hierarchy data structure.
     * @param {Object} data - Hierarchy data
     * @returns {Object} - Validated hierarchy
     */
    validateHierarchy(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Hierarchy data must be an object');
        }

        const normalize = (node) => {
            const normalized = {
                name: node.name || 'Unnamed',
                data: node.data || node
            };

            if (node.children && Array.isArray(node.children)) {
                normalized.children = node.children.map(child => normalize(child));
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
            name: 'Root',
            children: aggregated.map(item => ({
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

        data.forEach(record => {
            const primaryKey = String(record[this.groupByField] ?? 'Null');
            const secondaryKey = String(record[this.secondaryGroupByField] ?? 'Null');

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
            name: 'Root',
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
        const container = this.template.querySelector('.chart-container');
        if (!container) return;

        const { width } = container.getBoundingClientRect();
        if (width === 0) return;

        this.tooltip = createTooltip(container);
        this.initColorScale();
        this.renderChart(width);

        this.resizeHandler = createResizeHandler(container, ({ width: newWidth }) => {
            if (newWidth > 0) {
                this.renderChart(newWidth);
            }
        });
        this.resizeHandler.observe();
    }

    /**
     * Initializes color scale based on colorMode.
     */
    initColorScale() {
        const root = this.currentRoot || this.rootData;
        if (!root || !root.children) return;

        const categories = root.children.map(c => c.name);
        const colors = getColors(this.theme, categories.length, this.config.customColors);

        if (this.colorMode === 'category') {
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
        const container = this.template.querySelector('.chart-container');
        if (!container || !d3) return;

        // Clear existing SVG
        d3.select(container).select('svg').remove();

        const margin = { top: 10, right: 10, bottom: 10, left: 10 };
        const width = containerWidth - margin.left - margin.right;
        const height = this.height - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) return;

        // Create SVG
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', this.height)
            .attr('class', 'treemap-svg')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create hierarchy from current root
        const root = d3.hierarchy(this.currentRoot || this.rootData)
            .sum(d => d.value || 0)
            .sort((a, b) => b.value - a.value);

        // Create treemap layout
        const treemap = d3.treemap()
            .size([width, height])
            .paddingOuter(this.tilePadding)
            .paddingInner(this.innerPadding)
            .paddingTop(this.secondaryGroupByField ? 20 : this.tilePadding)
            .round(true);

        treemap(root);

        // Get colors
        const categories = (this.rootData?.children || []).map(c => c.name);
        const colors = getColors(this.theme, Math.max(categories.length, 5), this.config.customColors);
        const depthColors = ['#1589EE', '#4BCA81', '#FF9E2C', '#FF5D5D', '#AD7BFF'];

        // Draw parent groups if nested
        if (this.secondaryGroupByField) {
            const parents = root.descendants().filter(d => d.depth === 1);
            
            this.svg.selectAll('.group-rect')
                .data(parents)
                .enter()
                .append('rect')
                .attr('class', 'group-rect')
                .attr('x', d => d.x0)
                .attr('y', d => d.y0)
                .attr('width', d => Math.max(0, d.x1 - d.x0))
                .attr('height', d => Math.max(0, d.y1 - d.y0))
                .attr('fill', 'none')
                .attr('stroke', '#d8d8d8')
                .attr('stroke-width', 1);

            // Group labels
            this.svg.selectAll('.group-label')
                .data(parents)
                .enter()
                .append('text')
                .attr('class', 'group-label')
                .attr('x', d => d.x0 + 4)
                .attr('y', d => d.y0 + 14)
                .style('font-size', '11px')
                .style('font-weight', 'bold')
                .style('fill', '#16325c')
                .text(d => truncateLabel(d.data.name, 30));
        }

        // Get leaf nodes
        const leaves = root.leaves();

        // Draw leaf rectangles
        const cells = this.svg.selectAll('.leaf')
            .data(leaves)
            .enter()
            .append('g')
            .attr('class', 'leaf')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);

        // Rectangle fill
        cells.append('rect')
            .attr('class', 'tile')
            .attr('width', d => Math.max(0, d.x1 - d.x0))
            .attr('height', d => Math.max(0, d.y1 - d.y0))
            .attr('fill', (d, i) => {
                if (this.colorMode === 'depth') {
                    return depthColors[d.depth % depthColors.length];
                }
                // Category color - use parent's name for color
                const categoryName = d.depth > 1 ? d.parent.data.name : d.data.name;
                const catIndex = categories.indexOf(categoryName);
                return colors[catIndex >= 0 ? catIndex : i % colors.length];
            })
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('rx', 2)
            .attr('cursor', (this.enableZoom || this.objectApiName) ? 'pointer' : 'default')
            .attr('opacity', 0)
            .on('mouseenter', (event, d) => {
                this.showTileTooltip(event, d);
                d3.select(event.currentTarget)
                    .transition()
                    .duration(100)
                    .attr('opacity', 0.85);
            })
            .on('mouseleave', (event) => {
                this.hideTooltip();
                d3.select(event.currentTarget)
                    .transition()
                    .duration(100)
                    .attr('opacity', 1);
            })
            .on('click', (event, d) => {
                this.handleTileClick(d);
            })
            .transition()
            .duration(500)
            .delay((d, i) => i * 10)
            .attr('opacity', 1);

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
                    cell.append('text')
                        .attr('class', 'tile-label')
                        .attr('x', 4)
                        .attr('y', 14)
                        .style('font-size', '11px')
                        .style('font-weight', 'bold')
                        .style('fill', this.getContrastColor(d, colors, categories, depthColors))
                        .style('pointer-events', 'none')
                        .text(truncateLabel(d.data.name, maxChars));

                    // Value label (if enough height)
                    if (cellHeight >= 35) {
                        cell.append('text')
                            .attr('class', 'tile-value')
                            .attr('x', 4)
                            .attr('y', 28)
                            .style('font-size', '10px')
                            .style('fill', this.getContrastColor(d, colors, categories, depthColors))
                            .style('opacity', 0.9)
                            .style('pointer-events', 'none')
                            .text(formatNumber(d.value));
                    }
                }
            });
        }
    }

    /**
     * Determines appropriate text color for contrast.
     * @param {Object} d - Data node
     * @param {Array} colors - Color palette
     * @param {Array} categories - Category names
     * @param {Array} depthColors - Depth color palette
     * @returns {String} - Color hex
     */
    getContrastColor(d, colors, categories, depthColors) {
        let bgColor;
        if (this.colorMode === 'depth') {
            bgColor = depthColors[d.depth % depthColors.length];
        } else {
            const categoryName = d.depth > 1 ? d.parent.data.name : d.data.name;
            const catIndex = categories.indexOf(categoryName);
            bgColor = colors[catIndex >= 0 ? catIndex : 0];
        }

        // Simple luminance check
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        return luminance > 0.5 ? '#16325c' : '#ffffff';
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP HANDLERS
    // ═══════════════════════════════════════════════════════════════
    
    showTileTooltip(event, d) {
        if (!this.tooltip) return;

        const percent = this.totalValue > 0 ? (d.value / this.totalValue) : 0;
        
        // Build path/category info
        const path = [];
        let current = d;
        while (current.parent) {
            if (current.data.name !== 'Root') {
                path.unshift(current.data.name);
            }
            current = current.parent;
        }

        const content = `
            <div class="tooltip-content">
                <div style="font-weight: bold; margin-bottom: 4px;">
                    ${path.join(' › ') || d.data.name}
                </div>
                <div><strong>Value:</strong> ${formatNumber(d.value)}</div>
                <div><strong>Percentage:</strong> ${formatPercent(percent)}</div>
                ${this.enableZoom && d.children ? '<div class="tooltip-hint" style="margin-top: 4px; font-size: 11px; color: #706e6b;">Click to zoom in</div>' : ''}
                ${this.objectApiName && !d.children ? '<div class="tooltip-hint" style="margin-top: 4px; font-size: 11px; color: #706e6b;">Click to view records</div>' : ''}
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
        // Dispatch custom event
        this.dispatchEvent(new CustomEvent('tileclick', {
            detail: {
                name: d.data.name,
                value: d.value,
                data: d.data.data || d.data,
                depth: d.depth,
                hasChildren: !!d.children
            },
            bubbles: true,
            composed: true
        }));

        // Handle zoom if enabled and node has children
        if (this.enableZoom && d.data.children && d.data.children.length > 0) {
            this.zoomToNode(d.data);
            return;
        }

        // Handle navigation if configured
        if (this.objectApiName && !d.children) {
            this[NavigationMixin.Navigate]({
                type: 'standard__objectPage',
                attributes: {
                    objectApiName: this.objectApiName,
                    actionName: 'list'
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
            { name: this.currentRoot.name === 'Root' ? 'All' : this.currentRoot.name, data: this.currentRoot }
        ];

        this.currentRoot = nodeData;
        
        // Re-render with animation
        const container = this.template.querySelector('.chart-container');
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
            const container = this.template.querySelector('.chart-container');
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

        const container = this.template.querySelector('.chart-container');
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
