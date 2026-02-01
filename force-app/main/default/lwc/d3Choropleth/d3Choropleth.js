/**
 * D3 Choropleth Map Lightning Web Component
 * Displays geographic data visualization with region coloring by value.
 * Supports US states, world countries, or custom GeoJSON.
 */
import { LightningElement, api, track } from 'lwc';
import { loadD3 } from 'c/d3Lib';
import { prepareData, aggregateData, OPERATIONS } from 'c/dataService';
import { getColors, DEFAULT_THEME } from 'c/themeService';
import { formatNumber, createTooltip, createResizeHandler, truncateLabel } from 'c/chartUtils';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';
import US_STATES from '@salesforce/resourceUrl/usStates';

// Maximum regions to process
const MAX_REGIONS = 500;

// Default color for regions with no data
const NO_DATA_COLOR = '#E5E5E5';

// Built-in simplified US states GeoJSON (will be used if no custom data provided)
// State FIPS codes and abbreviations for matching
const US_STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia'
};

// Reverse mapping (name to code)
const US_STATE_CODES = Object.fromEntries(
    Object.entries(US_STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code])
);

export default class D3Choropleth extends NavigationMixin(LightningElement) {
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API PROPERTIES
    // ═══════════════════════════════════════════════════════════════
    
    /** Data collection from Flow or parent component */
    @api recordCollection = [];
    
    /** SOQL query string (used if recordCollection is empty) */
    @api soqlQuery = '';
    
    /** Field containing region identifier (state code, country code, etc.) */
    @api regionField = '';
    
    /** Field containing the value to aggregate/display */
    @api valueField = '';
    
    /** Aggregation operation (Sum, Count, Average) */
    @api operation = OPERATIONS.SUM;
    
    /**
     * Map type: 'us-states', 'world', or 'custom'
     * For custom, provide geoJsonData property
     */
    @api mapType = 'us-states';
    
    /** Custom GeoJSON data (for mapType='custom') */
    @api geoJsonData = null;
    
    /** Property name in GeoJSON features for region identification */
    @api geoJsonIdProperty = 'id';
    
    /** Property name in GeoJSON features for region display name */
    @api geoJsonNameProperty = 'name';
    
    /** Chart height in pixels */
    @api height = 400;
    
    /** Color theme */
    @api theme = DEFAULT_THEME;
    
    /** Color scale type: 'sequential' (light-to-dark) or 'diverging' (for +/- values) */
    @api colorScaleType = 'sequential';
    
    /** Low value color for sequential scale */
    @api lowColor = '#f7fbff';
    
    /** High value color for sequential scale */
    @api highColor = '#08519c';
    
    /** Middle value color for diverging scale (used for zero/neutral) */
    @api midColor = '#f7f7f7';
    
    /** Negative value color for diverging scale */
    @api negativeColor = '#b2182b';
    
    /** Positive value color for diverging scale */
    @api positiveColor = '#2166ac';
    
    /** Show legend (defaults to true via getter) */
    @api showLegend;
    
    /** Legend position: 'bottom-right', 'bottom-left', 'top-right', 'top-left' */
    @api legendPosition = 'bottom-right';
    
    /** Enable zoom and pan (defaults to true via getter) */
    @api enableZoom;
    
    /** Show region labels */
    @api showLabels = false;
    
    /** Region border color */
    @api borderColor = '#ffffff';
    
    /** Region border width */
    @api borderWidth = 0.5;
    
    /** Hover border color */
    @api hoverBorderColor = '#333333';
    
    /** Hover border width */
    @api hoverBorderWidth = 2;
    
    /** Object API Name for navigation on click */
    @api objectApiName = '';
    
    /** Record ID field for navigation */
    @api recordIdField = '';
    
    /** Advanced configuration JSON */
    @api advancedConfig = '{}';

    // ═══════════════════════════════════════════════════════════════
    // TRACKED STATE
    // ═══════════════════════════════════════════════════════════════
    
    @track isLoading = true;
    @track error = null;
    @track chartData = null;
    @track truncatedWarning = null;

    // ═══════════════════════════════════════════════════════════════
    // PRIVATE PROPERTIES
    // ═══════════════════════════════════════════════════════════════
    
    d3 = null;
    svg = null;
    geoData = null;
    tooltip = null;
    resizeHandler = null;
    chartRendered = false;
    zoomBehavior = null;
    _config = {};
    _configParsed = false;
    _currentTransform = null;
    _valueExtent = [0, 0];
    _colorScale = null;
    _regionLookup = new Map();

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
        return this.geoData && this.chartData;
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

    get effectiveShowLegend() {
        // Default to true if not explicitly set to false
        return this.showLegend !== false;
    }

    get effectiveEnableZoom() {
        // Default to true if not explicitly set to false
        return this.enableZoom !== false;
    }

    get effectiveShowLabels() {
        // Default to false
        return this.showLabels === true;
    }

    // ═══════════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS
    // ═══════════════════════════════════════════════════════════════
    
    async connectedCallback() {
        try {
            this.d3 = await loadD3(this);
            await this.loadGeoData();
            await this.loadData();
        } catch (e) {
            this.error = e.message || 'Failed to initialize chart';
            console.error('D3Choropleth initialization error:', e);
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
    // GEO DATA LOADING
    // ═══════════════════════════════════════════════════════════════
    
    async loadGeoData() {
        if (this.mapType === 'custom' && this.geoJsonData) {
            // Use provided custom GeoJSON
            this.geoData = this.parseGeoJson(this.geoJsonData);
        } else if (this.mapType === 'us-states') {
            // Use built-in US states simplified GeoJSON
            this.geoData = await this.loadUSStatesGeoJson();
        } else if (this.mapType === 'world') {
            // For world map, we'd need to load from static resource
            // For now, show error - world map requires custom data
            throw new Error('World map requires custom GeoJSON data. Set mapType to "custom" and provide geoJsonData.');
        } else {
            throw new Error(`Unknown map type: ${this.mapType}`);
        }

        if (!this.geoData || !this.geoData.features || this.geoData.features.length === 0) {
            throw new Error('Invalid or empty GeoJSON data');
        }

        // Build region lookup for efficient matching
        this.buildRegionLookup();
    }

    /**
     * Parses GeoJSON data (string or object).
     * @param {String|Object} data - GeoJSON data
     * @returns {Object} - Parsed GeoJSON object
     */
    parseGeoJson(data) {
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (e) {
                throw new Error('Invalid GeoJSON: Could not parse JSON string');
            }
        }
        return data;
    }

    /**
     * Loads the built-in US states GeoJSON from static resource.
     * @returns {Object} - GeoJSON FeatureCollection
     */
    async loadUSStatesGeoJson() {
        try {
            const response = await fetch(US_STATES);
            if (!response.ok) {
                throw new Error(`Failed to load US states data: ${response.status}`);
            }
            const geoJson = await response.json();
            
            // Normalize the GeoJSON to ensure consistent structure
            return this.normalizeUSStatesGeoJson(geoJson);
        } catch (e) {
            console.error('Error loading US states GeoJSON:', e);
            throw new Error('Failed to load US states map data. Please try again.');
        }
    }

    /**
     * Normalizes US states GeoJSON to ensure consistent ID and name properties.
     * @param {Object} geoJson - Raw GeoJSON from static resource
     * @returns {Object} - Normalized GeoJSON FeatureCollection
     */
    normalizeUSStatesGeoJson(geoJson) {
        if (!geoJson || !geoJson.features) {
            throw new Error('Invalid GeoJSON structure');
        }

        // Map FIPS codes to state abbreviations
        const fipsToAbbrev = {
            '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
            '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
            '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
            '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
            '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
            '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
            '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
            '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
            '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
            '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
            '56': 'WY', '72': 'PR'
        };

        const normalizedFeatures = geoJson.features.map(feature => {
            const fipsId = feature.id || feature.properties?.id;
            const abbrev = fipsToAbbrev[fipsId] || fipsId;
            const name = feature.properties?.name || US_STATE_NAMES[abbrev] || abbrev;

            return {
                ...feature,
                id: abbrev, // Use state abbreviation as ID
                properties: {
                    ...feature.properties,
                    id: abbrev,
                    name: name,
                    abbrev: abbrev,
                    fips: fipsId
                }
            };
        });

        return {
            type: 'FeatureCollection',
            features: normalizedFeatures
        };
    }

    /**
     * Builds lookup map for efficient region matching.
     */
    buildRegionLookup() {
        this._regionLookup.clear();

        this.geoData.features.forEach(feature => {
            const id = feature.id || feature.properties?.[this.geoJsonIdProperty];
            const name = feature.properties?.[this.geoJsonNameProperty] || feature.properties?.name;

            if (id) {
                // Store by ID
                this._regionLookup.set(String(id).toLowerCase(), feature);
                // Also store by name if available
                if (name) {
                    this._regionLookup.set(String(name).toLowerCase(), feature);
                }
            }
        });
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
            // No data source - still render map with no colors
            this.chartData = new Map();
            return;
        }

        // Validate required fields
        if (!this.regionField) {
            throw new Error('regionField is required');
        }

        const requiredFields = [this.regionField];
        if (this.operation !== OPERATIONS.COUNT && this.valueField) {
            requiredFields.push(this.valueField);
        }

        const prepared = prepareData(rawData, {
            requiredFields,
            limit: MAX_REGIONS * 10 // Allow more records since we aggregate
        });

        if (!prepared.valid) {
            throw new Error(prepared.error);
        }

        if (prepared.truncated) {
            this.truncatedWarning = `Displaying first ${MAX_REGIONS * 10} of ${prepared.originalCount} records`;
            this.dispatchEvent(new ShowToastEvent({
                title: 'Data Truncated',
                message: this.truncatedWarning,
                variant: 'warning'
            }));
        }

        // Aggregate data by region
        const aggregated = aggregateData(
            prepared.data,
            this.regionField,
            this.valueField,
            this.operation
        );

        // Convert to Map for efficient lookup
        this.chartData = new Map();
        aggregated.forEach(item => {
            // Normalize region key for matching
            const normalizedKey = this.normalizeRegionKey(item.label);
            this.chartData.set(normalizedKey, {
                label: item.label,
                value: item.value,
                originalRecords: prepared.data.filter(r => 
                    this.normalizeRegionKey(String(r[this.regionField])) === normalizedKey
                )
            });
        });

        // Calculate value extent for color scale
        const values = aggregated.map(d => d.value);
        this._valueExtent = [
            Math.min(0, ...values),
            Math.max(...values)
        ];
    }

    /**
     * Normalizes a region key for matching.
     * Handles state codes, names, and variations.
     * @param {String} key - Region identifier
     * @returns {String} - Normalized key
     */
    normalizeRegionKey(key) {
        if (!key) return '';
        const normalized = String(key).trim().toLowerCase();
        
        // If it's a US state name, convert to code
        if (US_STATE_CODES[normalized]) {
            return US_STATE_CODES[normalized].toLowerCase();
        }
        
        return normalized;
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
        if (!container || !d3 || !this.geoData) return;

        // Clear existing SVG
        d3.select(container).select('svg').remove();

        const width = containerWidth;
        const height = this.height;
        const margin = { top: 10, right: 10, bottom: 10, left: 10 };

        if (width <= 0 || height <= 0) return;

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('class', 'choropleth-svg')
            .attr('viewBox', [0, 0, width, height]);

        this.svg = svg;

        // Create main group for zoom/pan
        const g = svg.append('g').attr('class', 'map-container');

        // Setup color scale
        this.setupColorScale();

        // Create projection based on map type
        const projection = this.createProjection(width, height, margin);
        const path = d3.geoPath().projection(projection);

        // Draw regions - use full geoData for geoAlbersUsa (it handles AK/HI positioning)
        const geoFeatures = this.geoData.features;
        const regions = g.selectAll('path.region')
            .data(geoFeatures.filter(f => f.geometry))
            .join('path')
            .attr('class', 'region')
            .attr('d', path)
            .attr('fill', d => this.getRegionColor(d))
            .attr('stroke', this.borderColor)
            .attr('stroke-width', this.borderWidth)
            .attr('cursor', this.objectApiName ? 'pointer' : 'default');

        // Region interactions
        regions
            .on('mouseenter', (event, d) => {
                this.handleRegionHover(event, d, true);
            })
            .on('mouseleave', (event, d) => {
                this.handleRegionHover(event, d, false);
            })
            .on('click', (event, d) => {
                this.handleRegionClick(event, d);
            });

        // Draw labels if enabled
        if (this.effectiveShowLabels) {
            this.renderLabels(g, path);
        }

        // Draw legend if enabled
        if (this.effectiveShowLegend && this._valueExtent[1] > this._valueExtent[0]) {
            this.renderLegend(svg, width, height);
        }

        // Enable zoom/pan if enabled
        if (this.effectiveEnableZoom) {
            this.setupZoom(svg, g, width, height);
        }
    }

    /**
     * Creates the appropriate projection for the map type.
     * @param {Number} width - Chart width
     * @param {Number} height - Chart height
     * @param {Object} margin - Margins
     * @returns {Object} - D3 projection
     */
    createProjection(width, height, margin) {
        const d3 = this.d3;
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        if (this.mapType === 'us-states') {
            // Filter to continental US (exclude AK, HI, PR which have problematic coordinates)
            const continentalUS = {
                type: 'FeatureCollection',
                features: this.geoData.features.filter(f => {
                    const id = f.id || f.properties?.id || f.properties?.abbrev;
                    return !['02', 'AK', '15', 'HI', '72', 'PR'].includes(id);
                })
            };
            // Store filtered data for rendering
            this._filteredGeoData = continentalUS;

            // Use standard D3 geoAlbersUsa projection for US maps
            // For best results, return projection and let fitExtent handle scaling
            const projection = d3.geoAlbersUsa();

            // Manually set scale based on expected US map dimensions
            // geoAlbersUsa at scale 1070 fits roughly 960x600
            const targetWidth = innerWidth * 0.95;
            const targetHeight = innerHeight * 0.95;
            const scaleX = targetWidth / 960 * 1070;
            const scaleY = targetHeight / 600 * 1070;
            const scale = Math.min(scaleX, scaleY);

            return projection
                .scale(scale)
                .translate([innerWidth / 2, innerHeight / 2]);
        } else if (this.mapType === 'world') {
            // Use Natural Earth projection for world maps
            return d3.geoNaturalEarth1()
                .fitSize([innerWidth, innerHeight], this.geoData);
        } else {
            // For custom, auto-fit to the data
            return d3.geoMercator()
                .fitSize([innerWidth, innerHeight], this.geoData);
        }
    }

    /**
     * Sets up the color scale based on configuration.
     */
    setupColorScale() {
        const d3 = this.d3;
        const [minVal, maxVal] = this._valueExtent;

        if (this.colorScaleType === 'diverging' && minVal < 0) {
            // Diverging scale for positive/negative values
            this._colorScale = d3.scaleDiverging()
                .domain([minVal, 0, maxVal])
                .interpolator(d3.interpolateRgbBasis([
                    this.negativeColor,
                    this.midColor,
                    this.positiveColor
                ]));
        } else {
            // Sequential scale (light to dark)
            this._colorScale = d3.scaleSequential()
                .domain([0, maxVal || 1])
                .interpolator(d3.interpolateRgb(this.lowColor, this.highColor));
        }
    }

    /**
     * Gets the color for a region based on its value.
     * @param {Object} feature - GeoJSON feature
     * @returns {String} - Color hex code
     */
    getRegionColor(feature) {
        const regionId = feature.id || feature.properties?.[this.geoJsonIdProperty];
        const normalizedId = this.normalizeRegionKey(regionId);
        
        const data = this.chartData?.get(normalizedId);
        if (!data) {
            return this.config.noDataColor || NO_DATA_COLOR;
        }

        return this._colorScale(data.value);
    }

    /**
     * Gets the data for a region.
     * @param {Object} feature - GeoJSON feature
     * @returns {Object|null} - Region data or null
     */
    getRegionData(feature) {
        const regionId = feature.id || feature.properties?.[this.geoJsonIdProperty];
        const normalizedId = this.normalizeRegionKey(regionId);
        return this.chartData?.get(normalizedId) || null;
    }

    /**
     * Handles region hover events.
     * @param {Event} event - Mouse event
     * @param {Object} d - GeoJSON feature
     * @param {Boolean} entering - True if mouseenter, false if mouseleave
     */
    handleRegionHover(event, d, entering) {
        const d3 = this.d3;
        const target = d3.select(event.target);

        if (entering) {
            // Highlight region
            target
                .raise()
                .transition()
                .duration(100)
                .attr('stroke', this.hoverBorderColor)
                .attr('stroke-width', this.hoverBorderWidth);

            // Show tooltip
            this.showRegionTooltip(event, d);
        } else {
            // Reset region
            target
                .transition()
                .duration(100)
                .attr('stroke', this.borderColor)
                .attr('stroke-width', this.borderWidth);

            // Hide tooltip
            this.hideTooltip();
        }
    }

    /**
     * Shows tooltip for a region.
     * @param {Event} event - Mouse event
     * @param {Object} d - GeoJSON feature
     */
    showRegionTooltip(event, d) {
        if (!this.tooltip) return;

        const regionName = d.properties?.[this.geoJsonNameProperty] || 
                          d.properties?.name || 
                          d.id || 
                          'Unknown';
        const data = this.getRegionData(d);
        
        let content = `<div style="font-weight: bold; margin-bottom: 4px;">${regionName}</div>`;
        
        if (data) {
            const formattedValue = formatNumber(data.value);
            content += `<div><strong>${this.getOperationLabel()}:</strong> ${formattedValue}</div>`;
        } else {
            content += `<div style="color: #999;">No data</div>`;
        }

        if (this.objectApiName) {
            content += `<div style="margin-top: 4px; font-size: 11px; color: #aaa;">Click to drill down</div>`;
        }

        this.tooltip.show(content, event.offsetX, event.offsetY);
    }

    /**
     * Hides the tooltip.
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.hide();
        }
    }

    /**
     * Gets a human-readable label for the current operation.
     * @returns {String} - Operation label
     */
    getOperationLabel() {
        switch (this.operation) {
            case OPERATIONS.COUNT: return 'Count';
            case OPERATIONS.AVERAGE: return 'Average';
            case OPERATIONS.SUM:
            default: return 'Total';
        }
    }

    /**
     * Handles click on a region.
     * @param {Event} event - Click event
     * @param {Object} d - GeoJSON feature
     */
    handleRegionClick(event, d) {
        const regionName = d.properties?.[this.geoJsonNameProperty] || 
                          d.properties?.name || 
                          d.id;
        const regionId = d.id || d.properties?.[this.geoJsonIdProperty];
        const data = this.getRegionData(d);

        // Dispatch custom event
        this.dispatchEvent(new CustomEvent('regionclick', {
            detail: {
                regionId: regionId,
                regionName: regionName,
                value: data?.value || null,
                records: data?.originalRecords || [],
                feature: d
            },
            bubbles: true,
            composed: true
        }));

        // Navigate if configured
        if (this.objectApiName && data?.originalRecords?.length > 0) {
            const recordId = data.originalRecords[0][this.recordIdField || 'Id'];
            if (recordId) {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: recordId,
                        objectApiName: this.objectApiName,
                        actionName: 'view'
                    }
                });
            }
        }
    }

    /**
     * Renders region labels.
     * @param {Object} g - D3 selection for main group
     * @param {Function} path - D3 geoPath
     */
    renderLabels(g, path) {
        const d3 = this.d3;

        g.selectAll('text.region-label')
            .data(this.geoData.features.filter(f => f.geometry))
            .join('text')
            .attr('class', 'region-label')
            .attr('transform', d => {
                const centroid = path.centroid(d);
                return `translate(${centroid})`;
            })
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .style('font-size', '10px')
            .style('fill', '#333')
            .style('pointer-events', 'none')
            .text(d => {
                const name = d.properties?.abbrev || d.id || '';
                return truncateLabel(name, 5);
            });
    }

    /**
     * Renders the color legend.
     * @param {Object} svg - D3 SVG selection
     * @param {Number} width - Chart width
     * @param {Number} height - Chart height
     */
    renderLegend(svg, width, height) {
        const d3 = this.d3;
        const legendWidth = 200;
        const legendHeight = 15;
        const padding = 15;

        // Position based on legendPosition
        let x, y;
        switch (this.legendPosition) {
            case 'top-left':
                x = padding;
                y = padding;
                break;
            case 'top-right':
                x = width - legendWidth - padding;
                y = padding;
                break;
            case 'bottom-left':
                x = padding;
                y = height - legendHeight - 30;
                break;
            case 'bottom-right':
            default:
                x = width - legendWidth - padding;
                y = height - legendHeight - 30;
        }

        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${x}, ${y})`);

        // Background
        legend.append('rect')
            .attr('x', -5)
            .attr('y', -5)
            .attr('width', legendWidth + 10)
            .attr('height', legendHeight + 25)
            .attr('fill', 'white')
            .attr('fill-opacity', 0.9)
            .attr('rx', 4);

        // Create gradient for legend
        const gradientId = `legend-gradient-${Date.now()}`;
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')
            .attr('x2', '100%');

        // Add gradient stops
        const numStops = 10;
        for (let i = 0; i <= numStops; i++) {
            const t = i / numStops;
            const value = this._valueExtent[0] + t * (this._valueExtent[1] - this._valueExtent[0]);
            gradient.append('stop')
                .attr('offset', `${t * 100}%`)
                .attr('stop-color', this._colorScale(value));
        }

        // Draw gradient rectangle
        legend.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .attr('fill', `url(#${gradientId})`)
            .attr('stroke', '#ccc')
            .attr('stroke-width', 0.5);

        // Add min/max labels
        legend.append('text')
            .attr('x', 0)
            .attr('y', legendHeight + 12)
            .style('font-size', '10px')
            .style('fill', '#333')
            .text(formatNumber(this._valueExtent[0]));

        legend.append('text')
            .attr('x', legendWidth)
            .attr('y', legendHeight + 12)
            .attr('text-anchor', 'end')
            .style('font-size', '10px')
            .style('fill', '#333')
            .text(formatNumber(this._valueExtent[1]));
    }

    /**
     * Sets up zoom and pan behavior.
     * @param {Object} svg - D3 SVG selection
     * @param {Object} g - Main group selection
     * @param {Number} width - Chart width
     * @param {Number} height - Chart height
     */
    setupZoom(svg, g, width, height) {
        const d3 = this.d3;

        this.zoomBehavior = d3.zoom()
            .scaleExtent([0.5, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                this._currentTransform = event.transform;
            });

        svg.call(this.zoomBehavior);

        // Apply saved transform if exists
        if (this._currentTransform) {
            svg.call(this.zoomBehavior.transform, this._currentTransform);
        }

        // Add zoom controls
        this.addZoomControls(svg, g, width);
    }

    /**
     * Adds zoom control buttons.
     * @param {Object} svg - D3 SVG selection
     * @param {Object} g - Main group selection
     * @param {Number} width - Chart width
     */
    addZoomControls(svg, g, width) {
        const d3 = this.d3;
        const controls = svg.append('g')
            .attr('class', 'zoom-controls')
            .attr('transform', `translate(${width - 40}, 10)`);

        // Zoom in button
        const zoomIn = controls.append('g')
            .attr('class', 'zoom-button')
            .attr('cursor', 'pointer')
            .on('click', () => {
                svg.transition().duration(300).call(
                    this.zoomBehavior.scaleBy, 1.5
                );
            });

        zoomIn.append('rect')
            .attr('width', 28)
            .attr('height', 28)
            .attr('rx', 4)
            .attr('fill', 'white')
            .attr('stroke', '#ccc');

        zoomIn.append('text')
            .attr('x', 14)
            .attr('y', 19)
            .attr('text-anchor', 'middle')
            .style('font-size', '18px')
            .style('fill', '#333')
            .text('+');

        // Zoom out button
        const zoomOut = controls.append('g')
            .attr('class', 'zoom-button')
            .attr('transform', 'translate(0, 32)')
            .attr('cursor', 'pointer')
            .on('click', () => {
                svg.transition().duration(300).call(
                    this.zoomBehavior.scaleBy, 0.67
                );
            });

        zoomOut.append('rect')
            .attr('width', 28)
            .attr('height', 28)
            .attr('rx', 4)
            .attr('fill', 'white')
            .attr('stroke', '#ccc');

        zoomOut.append('text')
            .attr('x', 14)
            .attr('y', 19)
            .attr('text-anchor', 'middle')
            .style('font-size', '18px')
            .style('fill', '#333')
            .text('−');

        // Reset button
        const reset = controls.append('g')
            .attr('class', 'zoom-button')
            .attr('transform', 'translate(0, 64)')
            .attr('cursor', 'pointer')
            .on('click', () => {
                svg.transition().duration(300).call(
                    this.zoomBehavior.transform, d3.zoomIdentity
                );
                this._currentTransform = null;
            });

        reset.append('rect')
            .attr('width', 28)
            .attr('height', 28)
            .attr('rx', 4)
            .attr('fill', 'white')
            .attr('stroke', '#ccc');

        reset.append('text')
            .attr('x', 14)
            .attr('y', 18)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#333')
            .text('⟲');
    }

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════════
    
    cleanup() {
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
