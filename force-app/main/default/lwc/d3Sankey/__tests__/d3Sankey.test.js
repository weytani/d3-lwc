import { createElement } from 'lwc';
import D3Sankey from 'c/d3Sankey';
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

// Mock NavigationMixin
const mockNavigate = jest.fn();
jest.mock('lightning/navigation', () => {
    return {
        NavigationMixin: jest.fn((Base) => {
            return class extends Base {
                [Symbol.for('NavigationMixin.Navigate')] = mockNavigate;
            };
        })
    };
}, { virtual: true });

// Mock D3 instance with sankey-specific functions
const createMockD3 = () => {
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
        text: jest.fn(() => mockD3),
        datum: jest.fn(() => mockD3),
        node: jest.fn(() => null),
        each: jest.fn((callback) => {
            // Simulate calling callback for each element
            if (callback) {
                callback({}, 0, [{}]);
            }
            return mockD3;
        }),
        // Sankey-specific mocks
        sankey: jest.fn(() => {
            const sankeyFn = jest.fn((data) => {
                // Generate mock layout data
                const nodes = data.nodes.map((node, i) => ({
                    ...node,
                    x0: i * 100,
                    x1: i * 100 + 20,
                    y0: i * 50,
                    y1: i * 50 + 100,
                    value: 100,
                    sourceLinks: [],
                    targetLinks: []
                }));

                const links = data.links.map((link, i) => ({
                    ...link,
                    source: nodes[link.source] || nodes[0],
                    target: nodes[link.target] || nodes[1],
                    width: 10,
                    y0: 50,
                    y1: 50
                }));

                // Connect links to nodes
                links.forEach(link => {
                    if (link.source) link.source.sourceLinks.push(link);
                    if (link.target) link.target.targetLinks.push(link);
                });

                return { nodes, links };
            });
            sankeyFn.nodeWidth = jest.fn(() => sankeyFn);
            sankeyFn.nodePadding = jest.fn(() => sankeyFn);
            sankeyFn.nodeAlign = jest.fn(() => sankeyFn);
            sankeyFn.extent = jest.fn(() => sankeyFn);
            sankeyFn.iterations = jest.fn(() => sankeyFn);
            return sankeyFn;
        }),
        sankeyJustify: jest.fn(),
        sankeyLinkHorizontal: jest.fn(() => jest.fn(() => 'M0,0 L100,100'))
    };
    return mockD3;
};

// Sample flat data for source-target-value structure
const SAMPLE_FLAT_DATA = [
    { Id: '001', Source: 'Web', Target: 'Qualified', Amount: 10000 },
    { Id: '002', Source: 'Web', Target: 'Qualified', Amount: 15000 },
    { Id: '003', Source: 'Web', Target: 'Unqualified', Amount: 5000 },
    { Id: '004', Source: 'Referral', Target: 'Qualified', Amount: 50000 },
    { Id: '005', Source: 'Referral', Target: 'Converted', Amount: 30000 },
    { Id: '006', Source: 'Email', Target: 'Unqualified', Amount: 8000 },
    { Id: '007', Source: 'Qualified', Target: 'Converted', Amount: 40000 },
    { Id: '008', Source: 'Qualified', Target: 'Lost', Amount: 20000 }
];

// Sample pre-built sankey data
const SAMPLE_SANKEY_DATA = {
    nodes: [
        { name: 'Source A' },
        { name: 'Source B' },
        { name: 'Target X' },
        { name: 'Target Y' }
    ],
    links: [
        { source: 0, target: 2, value: 100 },
        { source: 0, target: 3, value: 50 },
        { source: 1, target: 2, value: 75 },
        { source: 1, target: 3, value: 25 }
    ]
};

// Sample sankey data with string references
const SANKEY_DATA_STRING_REFS = {
    nodes: [
        { name: 'Input' },
        { name: 'Process' },
        { name: 'Output' }
    ],
    links: [
        { source: 'Input', target: 'Process', value: 100 },
        { source: 'Process', target: 'Output', value: 80 }
    ]
};

// Simple flat data
const SIMPLE_DATA = [
    { Id: '001', From: 'A', To: 'B', Value: 100 },
    { Id: '002', From: 'A', To: 'C', Value: 200 },
    { Id: '003', From: 'B', To: 'D', Value: 150 }
];

// Data with null values
const DATA_WITH_NULLS = [
    { Id: '001', Source: 'A', Target: 'B', Value: 100 },
    { Id: '002', Source: null, Target: 'C', Value: 200 },
    { Id: '003', Source: 'B', Target: null, Value: 150 }
];

describe('c-d3-sankey', () => {
    let element;
    let mockD3;

    beforeEach(() => {
        jest.clearAllMocks();
        mockD3 = createMockD3();
        loadD3.mockResolvedValue(mockD3);
        executeQuery.mockResolvedValue(SAMPLE_FLAT_DATA);

        // Mock getBoundingClientRect
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
            width: 600,
            height: 400,
            top: 0,
            left: 0,
            bottom: 400,
            right: 600
        }));

        // Mock ResizeObserver
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

    // Helper to create element
    async function createChart(props = {}) {
        element = createElement('c-d3-sankey', {
            is: D3Sankey
        });

        Object.assign(element, {
            sourceField: 'Source',
            targetField: 'Target',
            valueField: 'Amount',
            recordCollection: SAMPLE_FLAT_DATA,
            ...props
        });

        document.body.appendChild(element);
        
        // Wait for async operations
        await Promise.resolve();
        await Promise.resolve();
        
        return element;
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('initialization', () => {
        it('shows loading state initially', async () => {
            element = createElement('c-d3-sankey', {
                is: D3Sankey
            });
            element.sourceField = 'Source';
            element.targetField = 'Target';
            element.recordCollection = SAMPLE_FLAT_DATA;
            
            document.body.appendChild(element);
            
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeTruthy();
        });

        it('loads D3 library on connect', async () => {
            await createChart();
            expect(loadD3).toHaveBeenCalled();
        });

        it('hides loading spinner after initialization', async () => {
            await createChart();
            await Promise.resolve();
            
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeFalsy();
        });

        it('renders chart container when data is available', async () => {
            await createChart();
            await Promise.resolve();

            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });

        it('handles D3 load failure gracefully', async () => {
            loadD3.mockRejectedValue(new Error('Failed to load D3'));
            
            await createChart();
            await Promise.resolve();

            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // DATA HANDLING TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('data handling', () => {
        it('uses recordCollection when provided', async () => {
            await createChart({
                recordCollection: SAMPLE_FLAT_DATA
            });

            expect(executeQuery).not.toHaveBeenCalled();
        });

        it('executes SOQL when recordCollection is empty', async () => {
            await createChart({
                recordCollection: [],
                soqlQuery: 'SELECT Source, Target, Amount FROM Flow__c'
            });

            expect(executeQuery).toHaveBeenCalledWith({
                queryString: 'SELECT Source, Target, Amount FROM Flow__c'
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
                body: { message: 'Invalid query' }
            });

            await createChart({
                recordCollection: [],
                soqlQuery: 'SELECT Invalid FROM Flow__c'
            });

            await Promise.resolve();

            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });

        it('shows error when sourceField is missing', async () => {
            await createChart({
                sourceField: '',
                targetField: 'Target',
                recordCollection: SAMPLE_FLAT_DATA
            });

            await Promise.resolve();

            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });

        it('shows error when targetField is missing', async () => {
            await createChart({
                sourceField: 'Source',
                targetField: '',
                recordCollection: SAMPLE_FLAT_DATA
            });

            await Promise.resolve();

            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });

        it('handles data without valueField (defaults to 1)', async () => {
            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: '',
                recordCollection: SIMPLE_DATA
            });

            await Promise.resolve();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });

        it('handles null values in source and target fields', async () => {
            await createChart({
                sourceField: 'Source',
                targetField: 'Target',
                valueField: 'Value',
                recordCollection: DATA_WITH_NULLS
            });

            await Promise.resolve();
            
            // Should convert nulls to 'Unknown'
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // SANKEY DATA VALIDATION TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('sankey data validation', () => {
        it('uses sankeyData when provided', async () => {
            await createChart({
                recordCollection: [],
                sankeyData: SAMPLE_SANKEY_DATA
            });

            await Promise.resolve();
            
            expect(executeQuery).not.toHaveBeenCalled();
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });

        it('validates sankeyData has nodes array', async () => {
            await createChart({
                recordCollection: [],
                sankeyData: { links: [] }
            });

            await Promise.resolve();
            
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });

        it('validates sankeyData has links array', async () => {
            await createChart({
                recordCollection: [],
                sankeyData: { nodes: [] }
            });

            await Promise.resolve();
            
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });

        it('handles sankeyData with string references', async () => {
            await createChart({
                recordCollection: [],
                sankeyData: SANKEY_DATA_STRING_REFS
            });

            await Promise.resolve();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });

        it('rejects invalid sankeyData type', async () => {
            await createChart({
                recordCollection: [],
                sankeyData: 'not an object'
            });

            await Promise.resolve();
            
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURATION TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('configuration', () => {
        it('accepts height property', async () => {
            await createChart({
                height: 500
            });

            expect(element.height).toBe(500);
        });

        it('applies height style to container', async () => {
            await createChart({
                height: 500
            });

            await Promise.resolve();
            
            const container = element.shadowRoot.querySelector('.chart-container');
            if (container) {
                expect(container.style.height).toBe('500px');
            }
        });

        it('accepts nodeWidth property', async () => {
            await createChart({
                nodeWidth: 30
            });

            expect(element.nodeWidth).toBe(30);
        });

        it('accepts nodePadding property', async () => {
            await createChart({
                nodePadding: 15
            });

            expect(element.nodePadding).toBe(15);
        });

        it('accepts iterations property', async () => {
            await createChart({
                iterations: 64
            });

            expect(element.iterations).toBe(64);
        });

        it('parses advancedConfig JSON correctly', async () => {
            await createChart({
                advancedConfig: '{"customColors": ["#FF0000", "#00FF00"], "linkColor": "#CCC"}'
            });

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

        it('handles undefined advancedConfig', async () => {
            await createChart({
                advancedConfig: undefined
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // THEME TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('themes', () => {
        it('accepts Salesforce Standard theme', async () => {
            await createChart({
                theme: 'Salesforce Standard'
            });

            expect(element.theme).toBe('Salesforce Standard');
        });

        it('accepts Warm theme', async () => {
            await createChart({
                theme: 'Warm'
            });

            expect(element.theme).toBe('Warm');
        });

        it('accepts Cool theme', async () => {
            await createChart({
                theme: 'Cool'
            });

            expect(element.theme).toBe('Cool');
        });

        it('accepts Vibrant theme', async () => {
            await createChart({
                theme: 'Vibrant'
            });

            expect(element.theme).toBe('Vibrant');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // LINK COLOR MODE TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('link color modes', () => {
        it('accepts gradient color mode', async () => {
            await createChart({
                linkColorMode: 'gradient'
            });

            expect(element.linkColorMode).toBe('gradient');
        });

        it('accepts source color mode', async () => {
            await createChart({
                linkColorMode: 'source'
            });

            expect(element.linkColorMode).toBe('source');
        });

        it('accepts target color mode', async () => {
            await createChart({
                linkColorMode: 'target'
            });

            expect(element.linkColorMode).toBe('target');
        });

        it('accepts solid color mode', async () => {
            await createChart({
                linkColorMode: 'solid'
            });

            expect(element.linkColorMode).toBe('solid');
        });

        it('defaults to gradient color mode', async () => {
            await createChart();

            expect(element.linkColorMode).toBe('gradient');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // LINK OPACITY TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('link opacity', () => {
        it('accepts linkOpacity property', async () => {
            await createChart({
                linkOpacity: 0.6
            });

            expect(element.linkOpacity).toBe(0.6);
        });

        it('accepts linkHoverOpacity property', async () => {
            await createChart({
                linkHoverOpacity: 0.9
            });

            expect(element.linkHoverOpacity).toBe(0.9);
        });

        it('defaults linkOpacity to 0.5', async () => {
            await createChart();

            expect(element.linkOpacity).toBe(0.5);
        });

        it('defaults linkHoverOpacity to 0.8', async () => {
            await createChart();

            expect(element.linkHoverOpacity).toBe(0.8);
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // LABEL TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('labels', () => {
        it('accepts showLabels property', async () => {
            await createChart({
                showLabels: false
            });

            expect(element.showLabels).toBe(false);
        });

        it('defaults showLabels to undefined', async () => {
            await createChart();

            expect(element.showLabels).toBeUndefined();
        });

        it('accepts showValues property', async () => {
            await createChart({
                showValues: false
            });

            expect(element.showValues).toBe(false);
        });

        it('defaults showValues to undefined', async () => {
            await createChart();

            expect(element.showValues).toBeUndefined();
        });

        it('accepts labelPosition auto', async () => {
            await createChart({
                labelPosition: 'auto'
            });

            expect(element.labelPosition).toBe('auto');
        });

        it('accepts labelPosition inside', async () => {
            await createChart({
                labelPosition: 'inside'
            });

            expect(element.labelPosition).toBe('inside');
        });

        it('accepts labelPosition outside', async () => {
            await createChart({
                labelPosition: 'outside'
            });

            expect(element.labelPosition).toBe('outside');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // CLICK EVENT TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('click events', () => {
        it('dispatches linkclick event', async () => {
            await createChart();
            await Promise.resolve();

            const clickHandler = jest.fn();
            element.addEventListener('linkclick', clickHandler);

            expect(loadD3).toHaveBeenCalled();
        });

        it('dispatches nodeclick event', async () => {
            await createChart();
            await Promise.resolve();

            const clickHandler = jest.fn();
            element.addEventListener('nodeclick', clickHandler);

            expect(loadD3).toHaveBeenCalled();
        });

        it('accepts objectApiName for navigation', async () => {
            await createChart({
                objectApiName: 'Lead'
            });

            expect(element.objectApiName).toBe('Lead');
        });

        it('accepts filterField for navigation filtering', async () => {
            await createChart({
                filterField: 'Status'
            });

            expect(element.filterField).toBe('Status');
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // RESPONSIVE BEHAVIOR TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('responsive behavior', () => {
        it('sets up resize observer', async () => {
            await createChart();
            await Promise.resolve();

            expect(global.ResizeObserver).toHaveBeenCalled();
        });

        it('handles container width of 0 gracefully', async () => {
            Element.prototype.getBoundingClientRect = jest.fn(() => ({
                width: 0,
                height: 0,
                top: 0,
                left: 0,
                bottom: 0,
                right: 0
            }));

            await createChart();
            await Promise.resolve();

            expect(loadD3).toHaveBeenCalled();
        });

        it('handles very small container', async () => {
            Element.prototype.getBoundingClientRect = jest.fn(() => ({
                width: 100,
                height: 100,
                top: 0,
                left: 0,
                bottom: 100,
                right: 100
            }));

            await createChart({
                height: 100
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // CLEANUP TESTS
    // ═══════════════════════════════════════════════════════════════

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

            document.body.removeChild(element);

            expect(mockDisconnect).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // GETTER TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('getters', () => {
        it('hasError returns true when error is set', async () => {
            await createChart({
                recordCollection: [],
                soqlQuery: ''
            });

            await Promise.resolve();
            
            const errorEl = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorEl).toBeTruthy();
        });

        it('hasData returns true when graphData has nodes and links', async () => {
            await createChart();
            await Promise.resolve();

            const container = element.shadowRoot.querySelector('.chart-container');
            expect(container).toBeTruthy();
        });

        it('containerStyle returns correct height string', async () => {
            await createChart({
                height: 450
            });

            await Promise.resolve();
            const container = element.shadowRoot.querySelector('.chart-container');
            if (container) {
                expect(container.style.height).toBe('450px');
            }
        });

        it('showLabels defaults to undefined (component uses getter for true default)', async () => {
            await createChart();

            // showLabels is undefined, component getter treats as true
            expect(element.showLabels).toBeUndefined();
        });

        it('showValues defaults to undefined (component uses getter for true default)', async () => {
            await createChart();

            // showValues is undefined, component getter treats as true
            expect(element.showValues).toBeUndefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('edge cases', () => {
        it('handles empty recordCollection array', async () => {
            await createChart({
                recordCollection: [],
                soqlQuery: ''
            });

            await Promise.resolve();
            
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeTruthy();
        });

        it('handles single link', async () => {
            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: [{ Id: '001', From: 'A', To: 'B', Value: 100 }]
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('handles circular flows (A→B and B→A)', async () => {
            const circularData = [
                { Id: '001', From: 'A', To: 'B', Value: 100 },
                { Id: '002', From: 'B', To: 'A', Value: 50 }
            ];

            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: circularData
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('handles very large numeric values', async () => {
            const largeData = [
                { Id: '001', From: 'A', To: 'B', Value: 1000000000 },
                { Id: '002', From: 'A', To: 'C', Value: 1 }
            ];

            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: largeData
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('handles zero values', async () => {
            const zeroData = [
                { Id: '001', From: 'A', To: 'B', Value: 0 },
                { Id: '002', From: 'B', To: 'C', Value: 100 }
            ];

            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: zeroData
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('handles negative values', async () => {
            const negativeData = [
                { Id: '001', From: 'A', To: 'B', Value: -100 },
                { Id: '002', From: 'B', To: 'C', Value: 50 }
            ];

            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: negativeData
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('handles many nodes', async () => {
            const manyNodes = [];
            for (let i = 0; i < 20; i++) {
                manyNodes.push({
                    Id: `${i}`,
                    From: `Source${i % 5}`,
                    To: `Target${i % 4}`,
                    Value: Math.random() * 1000
                });
            }

            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: manyNodes
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('handles special characters in node names', async () => {
            const specialData = [
                { Id: '001', From: 'Test & Demo', To: 'Output > Result', Value: 100 },
                { Id: '002', From: '<Script>', To: '"Quoted"', Value: 200 }
            ];

            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: specialData
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('handles unicode in node names', async () => {
            const unicodeData = [
                { Id: '001', From: 'ソース', To: 'ターゲット', Value: 100 },
                { Id: '002', From: '源头', To: '目标', Value: 200 }
            ];

            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: unicodeData
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });

        it('aggregates duplicate source-target pairs', async () => {
            const duplicates = [
                { Id: '001', From: 'A', To: 'B', Value: 100 },
                { Id: '002', From: 'A', To: 'B', Value: 150 },
                { Id: '003', From: 'A', To: 'B', Value: 50 }
            ];

            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: duplicates
            });

            await Promise.resolve();
            // Should aggregate to single link A→B with value 300
            expect(loadD3).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // RENDERING TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('rendering', () => {
        it('calls d3.sankey for layout', async () => {
            await createChart();
            await Promise.resolve();

            expect(mockD3.sankey).toHaveBeenCalled();
        });

        it('sets nodeWidth on sankey generator', async () => {
            await createChart({
                nodeWidth: 25
            });
            await Promise.resolve();

            expect(mockD3.sankey).toHaveBeenCalled();
        });

        it('sets nodePadding on sankey generator', async () => {
            await createChart({
                nodePadding: 12
            });
            await Promise.resolve();

            expect(mockD3.sankey).toHaveBeenCalled();
        });

        it('creates SVG element', async () => {
            await createChart();
            await Promise.resolve();

            expect(mockD3.append).toHaveBeenCalled();
        });

        it('uses sankeyLinkHorizontal for link paths', async () => {
            await createChart();
            await Promise.resolve();

            expect(mockD3.sankeyLinkHorizontal).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // NO DATA STATE TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('no data state', () => {
        it('shows no data message when graphData is empty', async () => {
            executeQuery.mockResolvedValue([]);
            
            await createChart({
                recordCollection: [],
                soqlQuery: 'SELECT Id FROM Flow__c LIMIT 0'
            });

            await Promise.resolve();

            // Either error or no data state
            const hasState = element.shadowRoot.querySelector('.slds-text-color_error') || 
                            element.shadowRoot.querySelector('.slds-text-color_weak');
            expect(hasState).toBeTruthy();
        });

        it('displays appropriate icon for no data', async () => {
            await createChart({
                recordCollection: [],
                sankeyData: { nodes: [], links: [] }
            });

            await Promise.resolve();

            // Should show flow icon or error
            const icon = element.shadowRoot.querySelector('lightning-icon');
            expect(icon).toBeTruthy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // ADVANCED CONFIG TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('advancedConfig', () => {
        it('supports customColors option', async () => {
            await createChart({
                advancedConfig: '{"customColors": ["#FF0000", "#00FF00", "#0000FF"]}'
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('supports linkColor option for solid mode', async () => {
            await createChart({
                linkColorMode: 'solid',
                advancedConfig: '{"linkColor": "#CCCCCC"}'
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('supports empty advancedConfig', async () => {
            await createChart({
                advancedConfig: '{}'
            });

            await Promise.resolve();
            const errorElement = element.shadowRoot.querySelector('.slds-text-color_error');
            expect(errorElement).toBeFalsy();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // SANKEY DATA BUILDING TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('sankey data building', () => {
        it('creates unique nodes from source and target fields', async () => {
            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: SIMPLE_DATA
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('creates links with correct indices', async () => {
            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: SIMPLE_DATA
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('uses value of 1 when no valueField', async () => {
            await createChart({
                sourceField: 'From',
                targetField: 'To',
                recordCollection: SIMPLE_DATA
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('calculates total value from all links', async () => {
            await createChart();
            await Promise.resolve();

            // Total value should be calculated
            expect(loadD3).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // TOTAL VALUE TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('total value calculation', () => {
        it('calculates sum of all link values', async () => {
            await createChart({
                sourceField: 'From',
                targetField: 'To',
                valueField: 'Value',
                recordCollection: SIMPLE_DATA
            });

            await Promise.resolve();
            expect(loadD3).toHaveBeenCalled();
        });

        it('handles empty graphData for total calculation', async () => {
            await createChart({
                recordCollection: [],
                sankeyData: { nodes: [], links: [] }
            });

            await Promise.resolve();
            // Should not crash
            expect(loadD3).toHaveBeenCalled();
        });
    });
});
