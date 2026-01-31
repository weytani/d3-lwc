/**
 * D3 Bar Chart Lightning Web Component
 * Displays aggregated data as vertical bars with drill-down support.
 */
import { LightningElement, api, track } from 'lwc';
import { loadD3 } from 'c/d3Lib';
import { prepareData, aggregateData, OPERATIONS } from 'c/dataService';
import { getColors, DEFAULT_THEME } from 'c/themeService';
import { formatNumber, truncateLabel, createTooltip, createResizeHandler, buildTooltipContent } from 'c/chartUtils';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';

export default class D3BarChart extends NavigationMixin(LightningElement) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════
    
    /** Data collection from Flow or parent component */
    @api recordCollection = [];
    
    /** SOQL query string (used if recordCollection is empty) */
    @api soqlQuery = '';
    
    /** Field to group by (category axis) */
    @api groupByField = '';
    
    /** Field to aggregate (value axis) */
    @api valueField = '';
    
    /** Aggregation operation: Sum, Count, Average */
    @api operation = OPERATIONS.SUM;
    
    /** Chart height in pixels */
    @api height = 300;
    
    /** Color theme */
    @api theme = DEFAULT_THEME;
    
    /** Advanced configuration JSON */
    @api advancedConfig = '{}';
    
    /** Object API name for drill-down navigation */
    @api objectApiName = '';
    
    /** Filter field for drill-down (usually same as groupByField) */
    @api filterField = '';

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════
    
    @track isLoading = true;
    @track error = null;
    @track chartData = [];
    @track truncatedWarning = null;

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE PROPERTIES
    // ═══════════════════════════════════════════════════════════════
    
    d3 = null;
    svg = null;
    tooltip = null;
    resizeHandler = null;
    chartRendered = false;
    _config = {};

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
            // Load D3
            this.d3 = await loadD3(this);
            
            // Load data
            await this.loadData();
            
            // Render will happen in renderedCallback after DOM is ready
        } catch (e) {
            this.error = e.message || 'Failed to initialize chart';
            console.error('D3BarChart initialization error:', e);
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
        let rawData = [];

        // Use recordCollection if provided, otherwise execute SOQL
        if (this.recordCollection && this.recordCollection.length > 0) {
            rawData = [...this.recordCollection];
        } else if (this.soqlQuery) {
            try {
                rawData = await executeQuery({ queryString: this.soqlQuery });
            } catch (e) {
                throw new Error(`SOQL Error: ${e.body?.message || e.message}`);
            }
        } else {
            throw new Error('No data source provided. Set recordCollection or soqlQuery.');
        }

        // Validate required fields
        const requiredFields = [this.groupByField];
        if (this.operation !== OPERATIONS.COUNT) {
            requiredFields.push(this.valueField);
        }

        // Prepare data (validate + truncate)
        const prepared = prepareData(rawData, { requiredFields });
        
        if (!prepared.valid) {
            throw new Error(prepared.error);
        }

        if (prepared.truncated) {
            this.truncatedWarning = `Displaying first 2,000 of ${prepared.originalCount} records`;
            this.showTruncationToast(prepared.originalCount);
        }

        // Aggregate data
        this.chartData = aggregateData(
            prepared.data,
            this.groupByField,
            this.valueField,
            this.operation
        );

        if (this.chartData.length === 0) {
            throw new Error('No data after aggregation');
        }
    }

    showTruncationToast(originalCount) {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Data Truncated',
            message: `Displaying first 2,000 of ${originalCount} records for performance`,
            variant: 'warning'
        }));
    }

    // ═══════════════════════════════════════════════════════════════
    // CHART RENDERING
    // ═══════════════════════════════════════════════════════════════
    
    initializeChart() {
        const container = this.template.querySelector('.chart-container');
        if (!container) return;

        const { width } = container.getBoundingClientRect();
        if (width === 0) return;

        // Create tooltip
        this.tooltip = createTooltip(container);

        // Render chart
        this.renderChart(width);

        // Setup resize observer
        this.resizeHandler = createResizeHandler(container, ({ width: newWidth }) => {
            if (newWidth > 0) {
                this.renderChart(newWidth);
            }
        });
        this.resizeHandler.observe();
    }

    renderChart(containerWidth) {
        const d3 = this.d3;
        const container = this.template.querySelector('.chart-container');
        if (!container || !d3) return;

        // Clear existing SVG
        d3.select(container).select('svg').remove();

        // Margins
        const margin = {
            top: 20,
            right: 20,
            bottom: this.config.showGrid !== false ? 60 : 40,
            left: 60
        };

        const width = containerWidth - margin.left - margin.right;
        const height = this.height - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) return;

        // Create SVG
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', this.height)
            .attr('class', 'bar-chart-svg')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleBand()
            .domain(this.chartData.map(d => d.label))
            .range([0, width])
            .padding(0.2);

        const yMax = d3.max(this.chartData, d => d.value) || 0;
        const yScale = d3.scaleLinear()
            .domain([0, yMax * 1.1]) // 10% headroom
            .nice()
            .range([height, 0]);

        // Colors
        const colors = getColors(
            this.theme,
            this.chartData.length,
            this.config.customColors
        );

        // Grid lines (optional)
        if (this.config.showGrid !== false) {
            this.svg.append('g')
                .attr('class', 'grid')
                .call(d3.axisLeft(yScale)
                    .tickSize(-width)
                    .tickFormat('')
                )
                .selectAll('line')
                .attr('stroke', '#e0e0e0')
                .attr('stroke-dasharray', '2,2');
            
            this.svg.select('.grid .domain').remove();
        }

        // X Axis
        const xAxis = this.svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d => truncateLabel(d, 12)));

        // Rotate labels if many bars
        if (this.chartData.length > 6) {
            xAxis.selectAll('text')
                .attr('transform', 'rotate(-45)')
                .style('text-anchor', 'end')
                .attr('dx', '-0.5em')
                .attr('dy', '0.5em');
        }

        // Y Axis
        this.svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale).tickFormat(d => formatNumber(d)));

        // Bars
        const bars = this.svg.selectAll('.bar')
            .data(this.chartData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.label))
            .attr('width', xScale.bandwidth())
            .attr('y', height) // Start from bottom for animation
            .attr('height', 0)
            .attr('fill', (d, i) => colors[i])
            .attr('rx', 2) // Rounded corners
            .attr('cursor', this.objectApiName ? 'pointer' : 'default');

        // Animate bars
        bars.transition()
            .duration(750)
            .delay((d, i) => i * 50)
            .attr('y', d => yScale(d.value))
            .attr('height', d => height - yScale(d.value));

        // Tooltip interactions
        bars.on('mouseenter', (event, d) => {
            this.showTooltip(event, d);
            d3.select(event.currentTarget)
                .transition()
                .duration(100)
                .attr('opacity', 0.8);
        })
        .on('mousemove', (event) => {
            this.moveTooltip(event);
        })
        .on('mouseleave', (event) => {
            this.hideTooltip();
            d3.select(event.currentTarget)
                .transition()
                .duration(100)
                .attr('opacity', 1);
        })
        .on('click', (event, d) => {
            this.handleBarClick(d);
        });

        // Legend (if enabled in config)
        if (this.config.showLegend) {
            this.renderLegend(colors);
        }
    }

    renderLegend(colors) {
        const legendPosition = this.config.legendPosition || 'bottom';
        // Legend implementation for bar chart (simplified - typically less needed for bar charts)
        // Can be extended based on requirements
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP HANDLERS
    // ═══════════════════════════════════════════════════════════════
    
    showTooltip(event, d) {
        if (!this.tooltip) return;
        
        const content = buildTooltipContent(d.label, d.value, {
            prefix: `${this.operation || 'Value'}: `
        });
        
        this.tooltip.show(content, event.offsetX, event.offsetY);
    }

    moveTooltip(event) {
        // Tooltip position is set in show(), but we can update it here if needed
        // The current implementation handles positioning in show()
    }

    hideTooltip() {
        if (!this.tooltip) return;
        this.tooltip.hide();
    }

    // ═══════════════════════════════════════════════════════════════
    // CLICK HANDLER - DRILL DOWN
    // ═══════════════════════════════════════════════════════════════
    
    handleBarClick(d) {
        if (!this.objectApiName) return;

        const filterFieldName = this.filterField || this.groupByField;
        
        // Navigate to list view with filter
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: this.objectApiName,
                actionName: 'list'
            },
            state: {
                filterName: 'Recent',
                // Note: Deep filtering requires a custom list view or Lightning Page
                // This provides basic navigation to the object list
            }
        });

        // Dispatch custom event for parent components to handle filtering
        this.dispatchEvent(new CustomEvent('barclick', {
            detail: {
                label: d.label,
                value: d.value,
                filterField: filterFieldName
            },
            bubbles: true,
            composed: true
        }));
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
