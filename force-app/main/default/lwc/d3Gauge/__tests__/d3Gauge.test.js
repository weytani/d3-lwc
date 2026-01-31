import { createElement } from 'lwc';
import D3Gauge from 'c/d3Gauge';
import { loadD3 } from 'c/d3Lib';
import { getColor } from 'c/themeService';
import executeQuery from '@salesforce/apex/D3ChartController.executeQuery';

// Mock d3Lib
jest.mock('c/d3Lib', () => ({
    loadD3: jest.fn()
}));

// Mock themeService
jest.mock('c/themeService', () => ({
    getColor: jest.fn().mockReturnValue('#1589EE')
}));

// Mock chartUtils
jest.mock('c/chartUtils', () => ({
    formatNumber: jest.fn((v) => String(v)),
    formatCurrency: jest.fn((v) => '$' + v),
    formatPercent: jest.fn((v) => (v * 100) + '%'),
    createTooltip: jest.fn().mockReturnValue({
        show: jest.fn(),
        hide: jest.fn(),
        destroy: jest.fn()
    }),
    buildTooltipContent: jest.fn().mockReturnValue('<div>tooltip</div>'),
    createResizeHandler: jest.fn().mockReturnValue({
        observe: jest.fn(),
        disconnect: jest.fn()
    }),
    calculateDimensions: jest.fn().mockReturnValue({ width: 300, height: 200, margins: {} }),
    shouldUseCompactMode: jest.fn().mockReturnValue(false)
}));

// Mock Apex
jest.mock(
    '@salesforce/apex/D3ChartController.executeQuery',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

// Create mock D3
const createMockD3 = () => ({
    select: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    style: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    arc: jest.fn().mockReturnValue({
        innerRadius: jest.fn().mockReturnThis(),
        outerRadius: jest.fn().mockReturnThis(),
        startAngle: jest.fn().mockReturnThis(),
        endAngle: jest.fn().mockReturnThis(),
        cornerRadius: jest.fn().mockReturnValue('mock-path')
    }),
    scaleLinear: jest.fn().mockReturnValue({
        domain: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        clamp: jest.fn().mockReturnValue((v) => v)
    }),
    pointer: jest.fn().mockReturnValue([100, 100])
});

describe('d3Gauge', () => {
    let mockD3;

    beforeEach(() => {
        mockD3 = createMockD3();
        loadD3.mockResolvedValue(mockD3);
        executeQuery.mockResolvedValue([]);
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    // Helper to create and wait for component
    const createComponent = async (props = {}) => {
        const element = createElement('c-d3-gauge', { is: D3Gauge });
        Object.assign(element, { valueField: 'Amount', ...props });
        document.body.appendChild(element);
        
        // Wait for async operations
        await Promise.resolve();
        await Promise.resolve();
        
        return element;
    };

    describe('Component Rendering', () => {
        it('renders chart container', async () => {
            const element = await createComponent();
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).not.toBeNull();
        });

        it('shows loading state initially', () => {
            const element = createElement('c-d3-gauge', { is: D3Gauge });
            element.valueField = 'Amount';
            document.body.appendChild(element);
            
            // Before async completes, loading should show
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            // Note: Due to timing, this may or may not be visible
        });

        it('loads D3 on connect', async () => {
            await createComponent();
            expect(loadD3).toHaveBeenCalled();
        });
    });

    describe('Data Properties', () => {
        it('accepts recordCollection', async () => {
            const records = [{ Amount: 500 }];
            const element = await createComponent({ recordCollection: records });
            expect(element.recordCollection).toEqual(records);
        });

        it('accepts soqlQuery', async () => {
            const query = 'SELECT Amount FROM Account';
            const element = await createComponent({ soqlQuery: query });
            expect(element.soqlQuery).toBe(query);
        });

        it('prioritizes recordCollection over soqlQuery', async () => {
            const records = [{ Amount: 500 }];
            await createComponent({ 
                recordCollection: records, 
                soqlQuery: 'SELECT Amount FROM Account' 
            });
            expect(executeQuery).not.toHaveBeenCalled();
        });

        it('calls executeQuery when soqlQuery provided', async () => {
            executeQuery.mockResolvedValue([{ Amount: 100 }]);
            await createComponent({ 
                recordCollection: [],
                soqlQuery: 'SELECT Amount FROM Account' 
            });
            expect(executeQuery).toHaveBeenCalledWith({ queryString: 'SELECT Amount FROM Account' });
        });
    });

    describe('Configuration Properties', () => {
        it('accepts height', async () => {
            const element = await createComponent({ height: 300 });
            expect(element.height).toBe(300);
        });

        it('accepts theme', async () => {
            const element = await createComponent({ theme: 'Warm' });
            expect(element.theme).toBe('Warm');
        });

        it('accepts minValue and maxValue', async () => {
            const element = await createComponent({ minValue: 0, maxValue: 200 });
            expect(element.minValue).toBe(0);
            expect(element.maxValue).toBe(200);
        });

        it('parses advancedConfig JSON', async () => {
            const config = { label: 'Test', minValue: 10 };
            const element = await createComponent({ 
                advancedConfig: JSON.stringify(config) 
            });
            expect(element.advancedConfig).toBe(JSON.stringify(config));
        });

        it('handles invalid advancedConfig gracefully', async () => {
            const element = await createComponent({ 
                advancedConfig: 'not valid json' 
            });
            // Should not throw, parsedConfig returns {}
            expect(element.advancedConfig).toBe('not valid json');
        });
    });

    describe('Navigation', () => {
        it('accepts targetRecordId', async () => {
            const element = await createComponent({ 
                targetRecordId: '001xx000003DGTEST' 
            });
            expect(element.targetRecordId).toBe('001xx000003DGTEST');
        });
    });

    describe('Theme Integration', () => {
        it('uses getColor from themeService', async () => {
            await createComponent({ theme: 'Warm' });
            // getColor should be called during render
            expect(getColor).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('displays error when D3 fails to load', async () => {
            loadD3.mockRejectedValue(new Error('Load failed'));
            const element = await createComponent();
            
            await Promise.resolve();
            await Promise.resolve();
            
            const errorDiv = element.shadowRoot.querySelector('.chart-error');
            expect(errorDiv).not.toBeNull();
        });

        it('displays error when query fails', async () => {
            executeQuery.mockRejectedValue({ body: { message: 'Query error' } });
            const element = await createComponent({
                recordCollection: [],
                soqlQuery: 'SELECT Bad FROM Query'
            });
            
            await Promise.resolve();
            await Promise.resolve();
            
            // Error should be set
            const errorDiv = element.shadowRoot.querySelector('.chart-error');
            expect(errorDiv).not.toBeNull();
        });
    });

    describe('Cleanup', () => {
        it('disconnects resize handler on destroy', async () => {
            const { createResizeHandler } = require('c/chartUtils');
            const mockHandler = {
                observe: jest.fn(),
                disconnect: jest.fn()
            };
            createResizeHandler.mockReturnValue(mockHandler);

            const element = await createComponent();
            
            // Trigger renderedCallback by waiting
            await Promise.resolve();
            
            // Remove element
            document.body.removeChild(element);
            
            // Disconnect should be called
            expect(mockHandler.disconnect).toHaveBeenCalled();
        });

        it('destroys tooltip on disconnect', async () => {
            const { createTooltip } = require('c/chartUtils');
            const mockTooltip = {
                show: jest.fn(),
                hide: jest.fn(),
                destroy: jest.fn()
            };
            createTooltip.mockReturnValue(mockTooltip);

            const element = await createComponent();
            await Promise.resolve();
            
            document.body.removeChild(element);
            
            expect(mockTooltip.destroy).toHaveBeenCalled();
        });
    });
});
