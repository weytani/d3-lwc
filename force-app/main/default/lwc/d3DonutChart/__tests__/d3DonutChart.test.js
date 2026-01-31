import { createElement } from 'lwc';
import D3DonutChart from 'c/d3DonutChart';
import { loadD3 } from 'c/d3Lib';
import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';

// Mock d3Lib
jest.mock('c/d3Lib', () => ({
    loadD3: jest.fn()
}));

// Mock Apex
jest.mock('@salesforce/apex/D3ChartController.executeQuery', () => ({
    default: jest.fn()
}), { virtual: true });

// Mock D3 instance
const mockD3 = {
    select: jest.fn(() => mockD3),
    append: jest.fn(() => mockD3),
    attr: jest.fn(() => mockD3),
    style: jest.fn(() => mockD3),
    call: jest.fn(() => mockD3),
    selectAll: jest.fn(() => mockD3),
    data: jest.fn(() => mockD3),
    enter: jest.fn(() => mockD3),
    transition: jest.fn(() => mockD3),
    duration: jest.fn(() => mockD3),
    attrTween: jest.fn(() => mockD3),
    on: jest.fn(() => mockD3),
    remove: jest.fn(() => mockD3),
    text: jest.fn(() => mockD3),
    pie: jest.fn(() => {
        const pieFn = jest.fn(data => data.map((d, i) => ({
            data: d,
            value: d.value,
            startAngle: i * 0.5,
            endAngle: (i + 1) * 0.5
        })));
        pieFn.value = jest.fn(() => pieFn);
        pieFn.sort = jest.fn(() => pieFn);
        return pieFn;
    }),
    arc: jest.fn(() => {
        const arcFn = jest.fn(() => 'M0,0');
        arcFn.innerRadius = jest.fn(() => arcFn);
        arcFn.outerRadius = jest.fn(() => arcFn);
        return arcFn;
    }),
    interpolate: jest.fn(() => jest.fn(() => ({ startAngle: 0, endAngle: 1 })))
};

// Sample test data
const SAMPLE_DATA = [
    { StageName: 'Prospecting', Amount: 100 },
    { StageName: 'Prospecting', Amount: 200 },
    { StageName: 'Qualification', Amount: 150 },
    { StageName: 'Closed Won', Amount: 500 }
];

// Flush promises helper
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('c-d3-donut-chart', () => {
    let element;

    beforeEach(() => {
        jest.clearAllMocks();
        loadD3.mockResolvedValue(mockD3);
        executeQuery.mockResolvedValue(SAMPLE_DATA);

        Element.prototype.getBoundingClientRect = jest.fn(() => ({
            width: 400,
            height: 300,
            top: 0,
            left: 0,
            bottom: 300,
            right: 400
        }));

        global.ResizeObserver = jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            unobserve: jest.fn(),
            disconnect: jest.fn()
        }));
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    async function createChart(props = {}) {
        element = createElement('c-d3-donut-chart', {
            is: D3DonutChart
        });

        Object.assign(element, {
            groupByField: 'StageName',
            valueField: 'Amount',
            operation: 'Sum',
            recordCollection: SAMPLE_DATA,
            ...props
        });

        document.body.appendChild(element);
        await flushPromises();
        return element;
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ═══════════════════════════════════════════════════════════════
    
    describe('initialization', () => {
        it('shows loading spinner initially', () => {
            element = createElement('c-d3-donut-chart', {
                is: D3DonutChart
            });
            element.groupByField = 'StageName';
            element.recordCollection = SAMPLE_DATA;
            
            document.body.appendChild(element);
            
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeTruthy();
        });

        it('loads D3 library on connect', async () => {
            await createChart();
            expect(loadD3).toHaveBeenCalled();
        });

        it('hides spinner after data loads', async () => {
            await createChart();
            await flushPromises();
            
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeFalsy();
        });

        it('renders chart container when data is available', async () => {
            await createChart();
            await flushPromises();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // DATA SOURCE TESTS
    // ═══════════════════════════════════════════════════════════════
    
    describe('data sources', () => {
        it('uses recordCollection when provided', async () => {
            await createChart({ recordCollection: SAMPLE_DATA });
            expect(executeQuery).not.toHaveBeenCalled();
        });

        it('calls Apex when recordCollection is empty', async () => {
            await createChart({
                recordCollection: [],
                soqlQuery: 'SELECT StageName, Amount FROM Opportunity'
            });

            expect(executeQuery).toHaveBeenCalledWith({
                queryString: 'SELECT StageName, Amount FROM Opportunity'
            });
        });

        it('shows error when no data source provided', async () => {
            await createChart({
                recordCollection: [],
                soqlQuery: ''
            });
            await flushPromises();
            await flushPromises(); // Extra flush for re-render

            const errorMessage = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorMessage).toBeTruthy();
        });

        it('shows error when SOQL query fails', async () => {
            executeQuery.mockRejectedValue({
                body: { message: 'Invalid query' }
            });

            await createChart({
                recordCollection: [],
                soqlQuery: 'SELECT Invalid FROM Object'
            });
            await flushPromises();
            await flushPromises(); // Extra flush for re-render

            const errorMessage = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorMessage).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // AGGREGATION TESTS
    // ═══════════════════════════════════════════════════════════════
    
    describe('aggregation', () => {
        it('accepts Sum operation', async () => {
            await createChart({ operation: 'Sum' });
            await flushPromises();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });

        it('accepts Count operation', async () => {
            await createChart({ operation: 'Count' });
            await flushPromises();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });

        it('accepts Average operation', async () => {
            await createChart({ operation: 'Average' });
            await flushPromises();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // THEME TESTS
    // ═══════════════════════════════════════════════════════════════
    
    describe('themes', () => {
        it('renders with Salesforce Standard theme', async () => {
            await createChart({ theme: 'Salesforce Standard' });
            await flushPromises();
            
            expect(element.shadowRoot.querySelector('.chart-container')).toBeTruthy();
        });

        it('renders with Warm theme', async () => {
            await createChart({ theme: 'Warm' });
            await flushPromises();
            
            expect(element.shadowRoot.querySelector('.chart-container')).toBeTruthy();
        });

        it('renders with Cool theme', async () => {
            await createChart({ theme: 'Cool' });
            await flushPromises();
            
            expect(element.shadowRoot.querySelector('.chart-container')).toBeTruthy();
        });

        it('renders with Vibrant theme', async () => {
            await createChart({ theme: 'Vibrant' });
            await flushPromises();
            
            expect(element.shadowRoot.querySelector('.chart-container')).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURATION TESTS
    // ═══════════════════════════════════════════════════════════════
    
    describe('configuration', () => {
        it('applies custom height', async () => {
            await createChart({ height: 400 });
            await flushPromises();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container.getAttribute('style')).toContain('400px');
        });

        it('accepts advancedConfig JSON', async () => {
            await createChart({
                advancedConfig: '{"showTotal": false}'
            });
            await flushPromises();
            
            expect(element.shadowRoot.querySelector('.chart-container')).toBeTruthy();
        });

        it('handles invalid advancedConfig gracefully', async () => {
            await createChart({
                advancedConfig: 'not valid json'
            });
            await flushPromises();
            
            // Should not crash - still renders
            expect(element.shadowRoot.querySelector('.chart-container')).toBeTruthy();
        });

        it('accepts innerRadiusRatio for donut vs pie', async () => {
            await createChart({ innerRadiusRatio: 0 }); // pie
            await flushPromises();
            
            expect(element.shadowRoot.querySelector('.chart-container')).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // LEGEND TESTS
    // ═══════════════════════════════════════════════════════════════
    
    describe('legend', () => {
        it('shows legend by default', async () => {
            await createChart();
            await flushPromises();
            
            const legend = element.shadowRoot.querySelector('.legend-container');
            expect(legend).toBeTruthy();
        });

        it('hides legend when showLegend is false', async () => {
            await createChart({ showLegend: false });
            await flushPromises();
            
            const legend = element.shadowRoot.querySelector('.legend-container');
            expect(legend).toBeFalsy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // RESPONSIVE TESTS
    // ═══════════════════════════════════════════════════════════════
    
    describe('responsive behavior', () => {
        it('creates ResizeObserver for responsive reflow', async () => {
            await createChart();
            await flushPromises();

            expect(global.ResizeObserver).toHaveBeenCalled();
        });

        it('disconnects ResizeObserver on component removal', async () => {
            const mockDisconnect = jest.fn();
            global.ResizeObserver = jest.fn().mockImplementation(() => ({
                observe: jest.fn(),
                unobserve: jest.fn(),
                disconnect: mockDisconnect
            }));

            await createChart();
            await flushPromises();

            document.body.removeChild(element);

            expect(mockDisconnect).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // EVENTS TESTS
    // ═══════════════════════════════════════════════════════════════
    
    describe('events', () => {
        it('sets objectApiName for drill-down navigation', async () => {
            await createChart({ objectApiName: 'Opportunity' });
            await flushPromises();
            
            // Component should be configured for navigation
            expect(element.shadowRoot.querySelector('.chart-container')).toBeTruthy();
        });
    });
});
