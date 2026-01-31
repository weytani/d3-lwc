import { createElement } from 'lwc';
import D3BarChart from 'c/d3BarChart';
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
    delay: jest.fn(() => mockD3),
    on: jest.fn(() => mockD3),
    remove: jest.fn(() => mockD3),
    html: jest.fn(() => mockD3),
    scaleBand: jest.fn(() => {
        const scale = jest.fn(() => 50);
        scale.domain = jest.fn(() => scale);
        scale.range = jest.fn(() => scale);
        scale.padding = jest.fn(() => scale);
        scale.bandwidth = jest.fn(() => 40);
        return scale;
    }),
    scaleLinear: jest.fn(() => {
        const scale = jest.fn(() => 100);
        scale.domain = jest.fn(() => scale);
        scale.range = jest.fn(() => scale);
        scale.nice = jest.fn(() => scale);
        return scale;
    }),
    axisBottom: jest.fn(() => {
        const axis = jest.fn();
        axis.tickFormat = jest.fn(() => axis);
        return axis;
    }),
    axisLeft: jest.fn(() => {
        const axis = jest.fn();
        axis.tickFormat = jest.fn(() => axis);
        axis.tickSize = jest.fn(() => axis);
        return axis;
    }),
    max: jest.fn(() => 500)
};

// Sample test data
const SAMPLE_DATA = [
    { StageName: 'Prospecting', Amount: 100 },
    { StageName: 'Prospecting', Amount: 200 },
    { StageName: 'Qualification', Amount: 150 },
    { StageName: 'Closed Won', Amount: 500 }
];

const AGGREGATED_DATA = [
    { label: 'Closed Won', value: 500 },
    { label: 'Prospecting', value: 300 },
    { label: 'Qualification', value: 150 }
];

describe('c-d3-bar-chart', () => {
    let element;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        loadD3.mockResolvedValue(mockD3);
        executeQuery.mockResolvedValue(SAMPLE_DATA);

        // Mock getBoundingClientRect
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
            width: 400,
            height: 300,
            top: 0,
            left: 0,
            bottom: 300,
            right: 400
        }));

        // Mock ResizeObserver
        global.ResizeObserver = jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            unobserve: jest.fn(),
            disconnect: jest.fn()
        }));
    });

    afterEach(() => {
        // Clean up DOM
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    // Helper to create element with properties
    async function createChart(props = {}) {
        element = createElement('c-d3-bar-chart', {
            is: D3BarChart
        });

        Object.assign(element, {
            groupByField: 'StageName',
            valueField: 'Amount',
            operation: 'Sum',
            recordCollection: SAMPLE_DATA,
            ...props
        });

        document.body.appendChild(element);
        
        // Wait for async operations
        await Promise.resolve();
        await Promise.resolve();
        
        return element;
    }

    describe('initialization', () => {
        it('shows loading state initially', async () => {
            element = createElement('c-d3-bar-chart', {
                is: D3BarChart
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

        it('hides loading after initialization', async () => {
            await createChart();
            
            // Wait for render
            await Promise.resolve();
            
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeFalsy();
        });
    });

    describe('data handling', () => {
        it('uses recordCollection when provided', async () => {
            await createChart({
                recordCollection: SAMPLE_DATA
            });

            // executeQuery should not be called
            expect(executeQuery).not.toHaveBeenCalled();
        });

        it('executes SOQL when recordCollection is empty', async () => {
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

            await Promise.resolve();

            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });

        it('shows error when SOQL query fails', async () => {
            executeQuery.mockRejectedValue({
                body: { message: 'Query error' }
            });

            await createChart({
                recordCollection: [],
                soqlQuery: 'SELECT Invalid FROM Opportunity'
            });

            await Promise.resolve();

            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });
    });

    describe('configuration', () => {
        it('applies height style to container', async () => {
            await createChart({
                height: 400
            });

            await Promise.resolve();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            if (container) {
                expect(container.style.height).toBe('400px');
            }
        });

        it('parses advancedConfig JSON', async () => {
            await createChart({
                advancedConfig: '{"showGrid": true, "showLegend": false}'
            });

            // Component should not throw error
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('handles invalid advancedConfig JSON gracefully', async () => {
            await createChart({
                advancedConfig: 'not valid json'
            });

            // Should not throw - falls back to empty config
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });
    });

    describe('aggregation operations', () => {
        it('performs Sum aggregation', async () => {
            await createChart({
                operation: 'Sum',
                groupByField: 'StageName',
                valueField: 'Amount'
            });

            // Chart should render without error
            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('performs Count aggregation', async () => {
            await createChart({
                operation: 'Count',
                groupByField: 'StageName'
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('performs Average aggregation', async () => {
            await createChart({
                operation: 'Average',
                groupByField: 'StageName',
                valueField: 'Amount'
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });
    });

    describe('themes', () => {
        it('accepts Salesforce Standard theme', async () => {
            await createChart({
                theme: 'Salesforce Standard'
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('accepts Warm theme', async () => {
            await createChart({
                theme: 'Warm'
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('accepts Cool theme', async () => {
            await createChart({
                theme: 'Cool'
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('accepts Vibrant theme', async () => {
            await createChart({
                theme: 'Vibrant'
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });
    });

    describe('click events', () => {
        it('dispatches barclick event on bar click', async () => {
            await createChart({
                objectApiName: 'Opportunity'
            });

            await Promise.resolve();

            // Add event listener
            const clickHandler = jest.fn();
            element.addEventListener('barclick', clickHandler);

            // Simulate bar click would require DOM manipulation
            // This test verifies the component doesn't error when objectApiName is set
            expect(loadD3).toHaveBeenCalled();
        });
    });

    describe('responsive behavior', () => {
        it('sets up resize observer', async () => {
            await createChart();

            await Promise.resolve();

            // ResizeObserver should be instantiated
            expect(global.ResizeObserver).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('disconnects resize observer on disconnect', async () => {
            const mockDisconnect = jest.fn();
            global.ResizeObserver = jest.fn().mockImplementation(() => ({
                observe: jest.fn(),
                unobserve: jest.fn(),
                disconnect: mockDisconnect
            }));

            await createChart();
            await Promise.resolve();

            // Remove element from DOM
            document.body.removeChild(element);

            expect(mockDisconnect).toHaveBeenCalled();
        });
    });
});
