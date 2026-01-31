/**
 * D3 Gauge Chart Component
 * Displays a single KPI value as a half-circle gauge.
 * 
 * @author D3 Chart Library
 * @since 1.0
 */
import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadD3 } from 'c/d3Lib';
import { getColor } from 'c/themeService';
import { 
    formatNumber, 
    formatCurrency, 
    formatPercent,
    createTooltip, 
    buildTooltipContent,
    createResizeHandler,
    calculateDimensions,
    shouldUseCompactMode
} from 'c/chartUtils';
import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';

export default class D3Gauge extends NavigationMixin(LightningElement) {
    // ===== DATA SOURCE PROPERTIES =====
    @api recordCollection = [];
    @api soqlQuery = '';

    // ===== CONFIGURATION PROPERTIES =====
    @api valueField = '';
    @api height = 200;
    @api theme = 'Salesforce Standard';
    @api minValue = 0;
    @api maxValue = 100;
    @api advancedConfig = '';

    // ===== NAVIGATION PROPERTY =====
    @api targetRecordId = '';

    // ===== INTERNAL STATE =====
    d3 = null;
    isLoading = true;
    error = null;
    currentValue = 0;
    tooltip = null;
    resizeHandler = null;

    // ===== GETTERS =====
    get hasError() {
        return !!this.error;
    }

    get parsedConfig() {
        if (!this.advancedConfig) return {};
        try {
            return JSON.parse(this.advancedConfig);
        } catch (e) {
            console.warn('D3Gauge: Invalid advancedConfig JSON:', e);
            return {};
        }
    }

    get effectiveMinValue() {
        return this.parsedConfig.minValue ?? this.minValue ?? 0;
    }

    get effectiveMaxValue() {
        return this.parsedConfig.maxValue ?? this.maxValue ?? 100;
    }

    get valueFormatter() {
        const format = this.parsedConfig.valueFormat || 'number';
        switch (format) {
            case 'currency':
                return formatCurrency;
            case 'percent':
                return formatPercent;
            default:
                return formatNumber;
        }
    }

    // ===== LIFECYCLE =====
    async connectedCallback() {
        try {
            this.d3 = await loadD3(this);
            await this.loadData();
        } catch (e) {
            this.error = e.message || 'Failed to initialize chart';
            console.error('D3Gauge initialization error:', e);
        } finally {
            this.isLoading = false;
        }
    }

    renderedCallback() {
        if (!this.isLoading && !this.error && this.d3 && !this.resizeHandler) {
            this.setupChart();
        }
    }

    disconnectedCallback() {
        this.cleanup();
    }

    // ===== SETUP =====
    setupChart() {
        const container = this.refs.container;
        if (!container) return;

        // Setup tooltip
        this.tooltip = createTooltip(container);

        // Setup resize handler
        this.resizeHandler = createResizeHandler(container, () => {
            this.renderChart();
        });
        this.resizeHandler.observe();

        // Initial render
        this.renderChart();
    }

    cleanup() {
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
        if (this.resizeHandler) {
            this.resizeHandler.disconnect();
            this.resizeHandler = null;
        }
    }

    // ===== DATA LOADING =====
    async loadData() {
        // Priority: recordCollection > soqlQuery
        if (this.recordCollection && this.recordCollection.length > 0) {
            this.processData(this.recordCollection);
            return;
        }

        if (this.soqlQuery) {
            try {
                const result = await executeQuery({ queryString: this.soqlQuery });
                this.processData(result);
            } catch (e) {
                const errorMsg = e.body?.message || e.message || 'Query failed';
                throw new Error('SOQL Error: ' + errorMsg);
            }
            return;
        }

        // No data source - use default or show error
        if (!this.valueField) {
            throw new Error('valueField is required');
        }
    }

    processData(records) {
        if (!records || records.length === 0) {
            this.currentValue = 0;
            return;
        }

        // For gauge, use first record's valueField
        const record = records[0];
        
        if (!this.valueField) {
            this.currentValue = 0;
            return;
        }

        const rawValue = record[this.valueField];
        this.currentValue = Number(rawValue) || 0;
    }

    // ===== RENDERING =====
    renderChart() {
        const container = this.refs.container;
        const svg = this.refs.svg;
        if (!container || !svg || !this.d3) return;

        const d3 = this.d3;
        const config = this.parsedConfig;

        // Get dimensions
        const containerWidth = container.clientWidth || 300;
        const chartHeight = this.height || 200;
        const isCompact = shouldUseCompactMode(containerWidth, 200);

        // Clear previous render
        d3.select(svg).selectAll('*').remove();

        // Calculate dimensions
        const width = containerWidth;
        const height = chartHeight;
        const centerY = height - 20;
        const radius = Math.min(width / 2, height) - 30;

        // Create SVG
        const svgSelection = d3.select(svg)
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);

        const g = svgSelection.append('g')
            .attr('transform', `translate(${width / 2}, ${centerY})`);

        // Arc generators
        const arcBackground = d3.arc()
            .innerRadius(radius * 0.65)
            .outerRadius(radius)
            .startAngle(-Math.PI / 2)
            .endAngle(Math.PI / 2)
            .cornerRadius(4);

        // Draw background arc
        g.append('path')
            .attr('d', arcBackground)
            .attr('fill', '#E5E5E5');

        // Calculate value angle
        const scale = d3.scaleLinear()
            .domain([this.effectiveMinValue, this.effectiveMaxValue])
            .range([-Math.PI / 2, Math.PI / 2])
            .clamp(true);

        const valueAngle = scale(this.currentValue);

        // Get color - check for zones or use theme
        let fillColor = this.getValueColor();

        // Arc generator for value
        const arcValue = d3.arc()
            .innerRadius(radius * 0.65)
            .outerRadius(radius)
            .startAngle(-Math.PI / 2)
            .endAngle(valueAngle)
            .cornerRadius(4);

        // Draw value arc
        const valuePath = g.append('path')
            .attr('d', arcValue)
            .attr('fill', fillColor)
            .style('cursor', this.targetRecordId ? 'pointer' : 'default');

        // Add interactions
        if (this.tooltip) {
            valuePath
                .on('mouseover', (event) => {
                    const content = buildTooltipContent(
                        config.label || 'Value',
                        this.currentValue,
                        { formatter: this.valueFormatter }
                    );
                    const [x, y] = d3.pointer(event, svg);
                    this.tooltip.show(content, x, y);
                })
                .on('mouseout', () => {
                    this.tooltip.hide();
                });
        }

        // Click navigation
        if (this.targetRecordId) {
            valuePath.on('click', () => this.handleClick());
        }

        // Add center text (value display)
        if (!isCompact) {
            // Value
            g.append('text')
                .attr('x', 0)
                .attr('y', -radius * 0.15)
                .attr('text-anchor', 'middle')
                .attr('class', 'gauge-value')
                .style('font-size', `${Math.max(16, radius * 0.35)}px`)
                .style('font-weight', 'bold')
                .style('fill', '#16325c')
                .text(this.valueFormatter(this.currentValue));

            // Label (if provided)
            if (config.label) {
                g.append('text')
                    .attr('x', 0)
                    .attr('y', -radius * 0.15 + 24)
                    .attr('text-anchor', 'middle')
                    .attr('class', 'gauge-label')
                    .style('font-size', '12px')
                    .style('fill', '#706e6b')
                    .text(config.label);
            }

            // Min/Max labels
            g.append('text')
                .attr('x', -radius + 10)
                .attr('y', 15)
                .attr('text-anchor', 'start')
                .style('font-size', '11px')
                .style('fill', '#706e6b')
                .text(formatNumber(this.effectiveMinValue));

            g.append('text')
                .attr('x', radius - 10)
                .attr('y', 15)
                .attr('text-anchor', 'end')
                .style('font-size', '11px')
                .style('fill', '#706e6b')
                .text(formatNumber(this.effectiveMaxValue));
        }
    }

    getValueColor() {
        const config = this.parsedConfig;
        
        // Check for color zones
        if (config.zones && Array.isArray(config.zones)) {
            for (const zone of config.zones) {
                if (this.currentValue >= zone.min && this.currentValue <= zone.max) {
                    return zone.color;
                }
            }
        }

        // Custom colors override
        if (config.customColors && config.customColors.length > 0) {
            return config.customColors[0];
        }

        // Use theme color
        return getColor(this.theme, 0);
    }

    // ===== NAVIGATION =====
    handleClick() {
        if (!this.targetRecordId) return;

        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.targetRecordId,
                actionName: 'view'
            }
        });
    }
}
