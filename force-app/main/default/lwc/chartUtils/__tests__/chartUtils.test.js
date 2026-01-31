import {
    formatNumber,
    formatCurrency,
    formatPercent,
    truncateLabel,
    createTooltip,
    buildTooltipContent,
    createResizeHandler,
    calculateDimensions,
    shouldUseCompactMode
} from 'c/chartUtils';

describe('chartUtils', () => {
    describe('formatNumber', () => {
        it('formats thousands with K', () => {
            expect(formatNumber(1500)).toBe('1.5K');
            expect(formatNumber(10000)).toBe('10K');
        });

        it('formats millions with M', () => {
            expect(formatNumber(1500000)).toBe('1.5M');
            expect(formatNumber(25000000)).toBe('25M');
        });

        it('formats billions with B', () => {
            expect(formatNumber(1500000000)).toBe('1.5B');
        });

        it('handles small numbers without suffix', () => {
            expect(formatNumber(500)).toBe('500');
            expect(formatNumber(50.5)).toBe('50.5');
        });

        it('handles negative numbers', () => {
            expect(formatNumber(-1500)).toBe('-1.5K');
            expect(formatNumber(-500)).toBe('-500');
        });

        it('handles null/undefined', () => {
            expect(formatNumber(null)).toBe('0');
            expect(formatNumber(undefined)).toBe('0');
            expect(formatNumber(NaN)).toBe('0');
        });

        it('respects decimal places parameter', () => {
            expect(formatNumber(1234567, 2)).toBe('1.23M');
            expect(formatNumber(1234567, 0)).toBe('1M');
        });

        it('removes trailing zeros', () => {
            expect(formatNumber(100)).toBe('100');
            expect(formatNumber(100.0)).toBe('100');
        });
    });

    describe('formatCurrency', () => {
        it('formats USD by default', () => {
            expect(formatCurrency(1000)).toBe('$1,000');
            expect(formatCurrency(1500000)).toBe('$1,500,000');
        });

        it('handles null/undefined', () => {
            expect(formatCurrency(null)).toBe('$0');
            expect(formatCurrency(undefined)).toBe('$0');
        });

        it('handles zero', () => {
            expect(formatCurrency(0)).toBe('$0');
        });
    });

    describe('formatPercent', () => {
        it('converts decimal to percentage', () => {
            expect(formatPercent(0.5)).toBe('50.0%');
            expect(formatPercent(0.123)).toBe('12.3%');
        });

        it('handles values over 100%', () => {
            expect(formatPercent(1.5)).toBe('150.0%');
        });

        it('handles null/undefined', () => {
            expect(formatPercent(null)).toBe('0%');
            expect(formatPercent(undefined)).toBe('0%');
        });

        it('respects decimal places', () => {
            expect(formatPercent(0.1234, 2)).toBe('12.34%');
            expect(formatPercent(0.1234, 0)).toBe('12%');
        });
    });

    describe('truncateLabel', () => {
        it('returns short labels unchanged', () => {
            expect(truncateLabel('Short')).toBe('Short');
        });

        it('truncates long labels with ellipsis', () => {
            const long = 'This is a very long label that needs truncation';
            const result = truncateLabel(long, 20);
            expect(result).toHaveLength(20);
            expect(result.endsWith('...')).toBe(true);
        });

        it('handles empty/null input', () => {
            expect(truncateLabel(null)).toBe('');
            expect(truncateLabel('')).toBe('');
            expect(truncateLabel(undefined)).toBe('');
        });

        it('converts non-strings to strings', () => {
            expect(truncateLabel(12345)).toBe('12345');
        });

        it('uses default maxLength of 20', () => {
            const long = 'Exactly twenty one!!';
            const result = truncateLabel(long);
            expect(result.length).toBeLessThanOrEqual(20);
        });
    });

    describe('createTooltip', () => {
        let container;
        let tooltip;

        beforeEach(() => {
            container = document.createElement('div');
            container.style.position = 'relative';
            container.style.width = '500px';
            container.style.height = '300px';
            document.body.appendChild(container);
            tooltip = createTooltip(container);
        });

        afterEach(() => {
            tooltip.destroy();
            container.remove();
        });

        it('creates tooltip element in container', () => {
            expect(tooltip.element).toBeDefined();
            expect(container.contains(tooltip.element)).toBe(true);
        });

        it('has SLDS classes', () => {
            expect(tooltip.element.classList.contains('slds-popover')).toBe(true);
            expect(tooltip.element.classList.contains('slds-popover_tooltip')).toBe(true);
        });

        it('starts hidden (opacity 0)', () => {
            expect(tooltip.element.style.opacity).toBe('0');
        });

        it('show() displays tooltip with content', () => {
            tooltip.show('<b>Test</b>', 100, 100);
            expect(tooltip.element.style.opacity).toBe('1');
            expect(tooltip.element.querySelector('.slds-popover__body').innerHTML).toContain('Test');
        });

        it('hide() hides tooltip', () => {
            tooltip.show('Content', 100, 100);
            tooltip.hide();
            expect(tooltip.element.style.opacity).toBe('0');
        });

        it('destroy() removes from DOM', () => {
            tooltip.destroy();
            expect(container.contains(tooltip.element)).toBe(false);
        });

        it('destroy() handles already removed tooltip', () => {
            tooltip.destroy();
            expect(() => tooltip.destroy()).not.toThrow();
        });
    });

    describe('buildTooltipContent', () => {
        it('builds HTML with label and value', () => {
            const html = buildTooltipContent('Sales', 1500000);
            expect(html).toContain('Sales');
            expect(html).toContain('1.5M'); // Default formatter
        });

        it('uses custom formatter', () => {
            const html = buildTooltipContent('Count', 42, { formatter: (v) => v.toString() });
            expect(html).toContain('42');
        });

        it('adds prefix and suffix', () => {
            const html = buildTooltipContent('Amount', 100, { prefix: '$', suffix: ' USD' });
            expect(html).toContain('$');
            expect(html).toContain('USD');
        });

        it('handles null formatter', () => {
            const html = buildTooltipContent('Label', 'Value', { formatter: null });
            expect(html).toContain('Value');
        });
    });

    describe('createResizeHandler', () => {
        let container;
        let originalResizeObserver;

        // Mock ResizeObserver
        class MockResizeObserver {
            constructor(callback) {
                this.callback = callback;
                this.elements = [];
            }
            observe(element) {
                this.elements.push(element);
                // Simulate initial call
                this.callback([{ contentRect: { width: 500, height: 300 } }]);
            }
            disconnect() {
                this.elements = [];
            }
        }

        beforeEach(() => {
            container = document.createElement('div');
            originalResizeObserver = global.ResizeObserver;
            global.ResizeObserver = MockResizeObserver;
        });

        afterEach(() => {
            global.ResizeObserver = originalResizeObserver;
        });

        it('returns observe and disconnect functions', () => {
            const handler = createResizeHandler(container, jest.fn());
            expect(typeof handler.observe).toBe('function');
            expect(typeof handler.disconnect).toBe('function');
        });

        it('calls callback with dimensions on observe', (done) => {
            const callback = jest.fn();
            const handler = createResizeHandler(container, callback, 10);
            handler.observe();

            setTimeout(() => {
                expect(callback).toHaveBeenCalled();
                expect(callback).toHaveBeenCalledWith({ width: 500, height: 300 });
                handler.disconnect();
                done();
            }, 50);
        });

        it('disconnect cleans up', () => {
            const handler = createResizeHandler(container, jest.fn());
            handler.observe();
            handler.disconnect();
            // Should not throw
            expect(() => handler.disconnect()).not.toThrow();
        });
    });

    describe('calculateDimensions', () => {
        it('calculates inner dimensions from container and margins', () => {
            const result = calculateDimensions(500, 300, { top: 10, right: 10, bottom: 30, left: 40 });
            expect(result.width).toBe(450); // 500 - 10 - 40
            expect(result.height).toBe(260); // 300 - 10 - 30
        });

        it('uses default margins if not provided', () => {
            const result = calculateDimensions(500, 300);
            expect(result.margins.top).toBe(20);
            expect(result.margins.left).toBe(40);
            expect(result.margins.right).toBe(20);
            expect(result.margins.bottom).toBe(30);
        });

        it('returns non-negative dimensions', () => {
            const result = calculateDimensions(50, 50, { top: 100, right: 0, bottom: 0, left: 0 });
            expect(result.height).toBe(0); // Would be -50, clamped to 0
        });

        it('allows partial margin override', () => {
            const result = calculateDimensions(500, 300, { left: 60 });
            expect(result.margins.left).toBe(60);
            expect(result.margins.top).toBe(20); // Default
        });

        it('returns margins object', () => {
            const result = calculateDimensions(500, 300);
            expect(result.margins).toBeDefined();
            expect(result.margins.top).toBeDefined();
        });
    });

    describe('shouldUseCompactMode', () => {
        it('returns true when width below minimum', () => {
            expect(shouldUseCompactMode(200, 300)).toBe(true);
        });

        it('returns false when width above minimum', () => {
            expect(shouldUseCompactMode(400, 300)).toBe(false);
        });

        it('returns false when width equals minimum', () => {
            expect(shouldUseCompactMode(300, 300)).toBe(false);
        });

        it('uses default minimum of 300', () => {
            expect(shouldUseCompactMode(250)).toBe(true);
            expect(shouldUseCompactMode(350)).toBe(false);
        });
    });
});
