/**
 * D3 Donut Chart Lightning Web Component
 * Displays part-to-whole data as a donut/pie chart with drill-down support.
 */
import { LightningElement, api, track } from 'lwc';
import { loadD3 } from 'c/d3Lib';
import { prepareData, aggregateData, OPERATIONS } from 'c/dataService';
import { getColors, DEFAULT_THEME } from 'c/themeService';
import { formatNumber, formatPercent, createTooltip, createResizeHandler } from 'c/chartUtils';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';

export default class D3DonutChart extends NavigationMixin(LightningElement) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════
    
    /** Data collection from Flow or parent component */
    @api recordCollection = [];
    
    /** SOQL query string (used if recordCollection is empty) */
    @api soqlQuery = '';
    
    /** Field to group by (slice categories) */
    @api groupByField = '';
    
    /** Field to aggregate (slice values) */
    @api valueField = '';
    
    /** Aggregation operation: Sum, Count, Average */
    @api operation = OPERATIONS.SUM;
    
    /** Chart height in pixels */
    @api height = 300;
    
    /** Color theme */
    @api theme = DEFAULT_THEME;
    
    /** Show legend (defaults to true via getter) */
    @api showLegend;
    
    /** Inner radius ratio (0 = pie, 0.5 = donut) */
    @api innerRadiusRatio = 0.5;
    
    /** Advanced configuration JSON */
    @api advancedConfig = '{}';
    
    /** Object API name for drill-down navigation */
    @api objectApiName = '';
    
    /** Filter field for drill-down */
    @api filterField = '';

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════
    
    @track isLoading = true;
    @track error = null;
    @track chartData = [];
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
    _config = {};
    _configParsed = false;

    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════
    
    get containerStyle() {
        return `height: ${this.height}px;`;
    }

    get effectiveShowLegend() {
        return this.showLegend !== false;
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

    get legendItems() {
        if (!this.chartData || !this.effectiveShowLegend) return [];
        const colors = getColors(this.theme, this.chartData.length, this.config.customColors);
        return this.chartData.map((d, i) => ({
            label: d.label,
            value: d.value,
            percent: this.totalValue > 0 ? formatPercent(d.value / this.totalValue) : '0%',
            color: colors[i],
            colorStyle: `background-color: ${colors[i]};`
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
            console.error('D3DonutChart initialization error:', e);
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

        this.chartData = aggregateData(
            prepared.data,
            this.groupByField,
            this.valueField,
            this.operation
        );

        this.totalValue = this.chartData.reduce((sum, d) => sum + d.value, 0);

        if (this.chartData.length === 0) {
            throw new Error('No data after aggregation');
        }
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
        this.renderChart(width);

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

        d3.select(container).select('svg').remove();

        const legendWidth = this.effectiveShowLegend ? 150 : 0;
        const margin = { top: 20, right: 20 + legendWidth, bottom: 20, left: 20 };
        const width = containerWidth - margin.left - margin.right;
        const height = this.height - margin.top - margin.bottom;

        if (width <= 0 || height <= 0) return;

        const radius = Math.min(width, height) / 2;
        const innerRadius = radius * this.innerRadiusRatio;

        this.svg = d3.select(container)
            .append('svg')
            .attr('width', containerWidth)
            .attr('height', this.height)
            .attr('class', 'donut-chart-svg')
            .append('g')
            .attr('transform', `translate(${margin.left + width / 2},${margin.top + height / 2})`);

        const colors = getColors(this.theme, this.chartData.length, this.config.customColors);

        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(radius);

        const arcHover = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(radius + 10);

        const slices = this.svg.selectAll('.slice')
            .data(pie(this.chartData))
            .enter()
            .append('g')
            .attr('class', 'slice');

        slices.append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => colors[i])
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('cursor', this.objectApiName ? 'pointer' : 'default')
            .on('mouseenter', (event, d) => {
                d3.select(event.currentTarget)
                    .transition()
                    .duration(200)
                    .attr('d', arcHover);
                this.showTooltip(event, d.data);
            })
            .on('mousemove', (event) => {
                this.moveTooltip(event);
            })
            .on('mouseleave', (event, d) => {
                d3.select(event.currentTarget)
                    .transition()
                    .duration(200)
                    .attr('d', arc);
                this.hideTooltip();
            })
            .on('click', (event, d) => {
                this.handleSliceClick(d.data);
            })
            .transition()
            .duration(750)
            .attrTween('d', function(d) {
                const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
                return function(t) {
                    return arc(interpolate(t));
                };
            });

        // Center text (total)
        if (this.config.showTotal !== false && innerRadius > 30) {
            this.svg.append('text')
                .attr('class', 'center-total')
                .attr('text-anchor', 'middle')
                .attr('dy', '-0.2em')
                .style('font-size', '14px')
                .style('fill', '#706e6b')
                .text('Total');

            this.svg.append('text')
                .attr('class', 'center-value')
                .attr('text-anchor', 'middle')
                .attr('dy', '1em')
                .style('font-size', '20px')
                .style('font-weight', 'bold')
                .style('fill', '#16325c')
                .text(formatNumber(this.totalValue));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLTIP HANDLERS
    // ═══════════════════════════════════════════════════════════════
    
    showTooltip(event, d) {
        if (!this.tooltip) return;
        
        const percent = this.totalValue > 0 ? (d.value / this.totalValue) : 0;
        const content = `
            <strong>${d.label}</strong><br/>
            ${formatNumber(d.value)} (${formatPercent(percent)})
        `;
        
        this.tooltip.show(content, event.offsetX, event.offsetY);
    }

    moveTooltip(event) {
        // Position handled in show()
    }

    hideTooltip() {
        if (!this.tooltip) return;
        this.tooltip.hide();
    }

    // ═══════════════════════════════════════════════════════════════
    // CLICK HANDLER - DRILL DOWN
    // ═══════════════════════════════════════════════════════════════
    
    handleSliceClick(d) {
        if (!this.objectApiName) return;

        const filterFieldName = this.filterField || this.groupByField;
        
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: this.objectApiName,
                actionName: 'list'
            }
        });

        this.dispatchEvent(new CustomEvent('sliceclick', {
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
    // LEGEND CLICK
    // ═══════════════════════════════════════════════════════════════
    
    handleLegendClick(event) {
        const label = event.currentTarget.dataset.label;
        const item = this.chartData.find(d => d.label === label);
        if (item) {
            this.handleSliceClick(item);
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
