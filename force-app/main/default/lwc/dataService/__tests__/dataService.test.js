// ABOUTME: Unit tests for the dataService shared module.
// ABOUTME: Covers validation, truncation, aggregation, sampling, and CHART_LIMITS constants.
import {
    validateData,
    validateFields,
    truncateData,
    prepareData,
    aggregateData,
    aggregateSeriesData,
    computeQuartiles,
    computeRunningTotal,
    sampleData,
    MAX_RECORDS,
    CHART_LIMITS,
    SVG_ELEMENT_CAP,
    OPERATIONS
} from 'c/dataService';

describe('dataService', () => {
    describe('validateData', () => {
        it('returns invalid for null data', () => {
            const result = validateData(null);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('required');
        });

        it('returns invalid for undefined data', () => {
            const result = validateData(undefined);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('required');
        });

        it('returns invalid for non-array data', () => {
            const result = validateData({ foo: 'bar' });
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('array');
        });

        it('returns invalid for empty array', () => {
            const result = validateData([]);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('empty');
        });

        it('returns valid for non-empty array', () => {
            const result = validateData([{ id: 1 }]);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeNull();
        });
    });

    describe('validateFields', () => {
        const testData = [{ Name: 'Test', Amount: 100 }];

        it('returns valid when no required fields', () => {
            const result = validateFields(testData, []);
            expect(result.isValid).toBe(true);
        });

        it('returns valid when required fields is null', () => {
            const result = validateFields(testData, null);
            expect(result.isValid).toBe(true);
        });

        it('returns valid when all fields present', () => {
            const result = validateFields(testData, ['Name', 'Amount']);
            expect(result.isValid).toBe(true);
        });

        it('returns invalid with missing fields listed', () => {
            const result = validateFields(testData, ['Name', 'Missing']);
            expect(result.isValid).toBe(false);
            expect(result.missingFields).toContain('Missing');
            expect(result.error).toContain('Missing');
        });

        it('returns all missing fields', () => {
            const result = validateFields(testData, ['Field1', 'Field2']);
            expect(result.missingFields).toHaveLength(2);
        });
    });

    describe('truncateData', () => {
        it('returns data unchanged when under limit', () => {
            const data = [{ id: 1 }, { id: 2 }];
            const result = truncateData(data, 10);
            expect(result.data).toHaveLength(2);
            expect(result.truncated).toBe(false);
        });

        it('truncates data when over limit', () => {
            const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
            const result = truncateData(data, 50);
            expect(result.data).toHaveLength(50);
            expect(result.truncated).toBe(true);
            expect(result.originalCount).toBe(100);
        });

        it('uses MAX_RECORDS as default limit', () => {
            const data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            const result = truncateData(data);
            expect(result.truncated).toBe(false);
        });

        it('handles exact limit match', () => {
            const data = Array.from({ length: 50 }, (_, i) => ({ id: i }));
            const result = truncateData(data, 50);
            expect(result.data).toHaveLength(50);
            expect(result.truncated).toBe(false);
        });
    });

    describe('prepareData', () => {
        it('returns invalid for bad data', () => {
            const result = prepareData(null);
            expect(result.valid).toBe(false);
        });

        it('returns invalid for missing required fields', () => {
            const result = prepareData([{ Name: 'Test' }], { requiredFields: ['Amount'] });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Amount');
        });

        it('returns valid prepared data', () => {
            const data = [{ Name: 'Test', Amount: 100 }];
            const result = prepareData(data, { requiredFields: ['Name'] });
            expect(result.valid).toBe(true);
            expect(result.data).toHaveLength(1);
        });

        it('indicates when data was truncated', () => {
            const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
            const result = prepareData(data, { limit: 50 });
            expect(result.truncated).toBe(true);
            expect(result.data).toHaveLength(50);
            expect(result.originalCount).toBe(100);
        });

        it('uses default options when none provided', () => {
            const data = [{ id: 1 }];
            const result = prepareData(data);
            expect(result.valid).toBe(true);
        });
    });

    describe('aggregateData', () => {
        const testData = [
            { StageName: 'Prospecting', Amount: 100 },
            { StageName: 'Prospecting', Amount: 200 },
            { StageName: 'Closed Won', Amount: 500 },
            { StageName: 'Closed Won', Amount: 300 },
            { StageName: 'Closed Won', Amount: 200 }
        ];

        it('returns empty array for null data', () => {
            expect(aggregateData(null, 'StageName', 'Amount', 'Sum')).toEqual([]);
        });

        it('returns empty array for missing groupByField', () => {
            expect(aggregateData(testData, null, 'Amount', 'Sum')).toEqual([]);
        });

        describe('Sum operation', () => {
            it('sums values by group', () => {
                const result = aggregateData(testData, 'StageName', 'Amount', OPERATIONS.SUM);
                expect(result).toHaveLength(2);

                const closedWon = result.find(r => r.label === 'Closed Won');
                expect(closedWon.value).toBe(1000); // 500 + 300 + 200

                const prospecting = result.find(r => r.label === 'Prospecting');
                expect(prospecting.value).toBe(300); // 100 + 200
            });
        });

        describe('Count operation', () => {
            it('counts records by group', () => {
                const result = aggregateData(testData, 'StageName', 'Amount', OPERATIONS.COUNT);

                const closedWon = result.find(r => r.label === 'Closed Won');
                expect(closedWon.value).toBe(3);

                const prospecting = result.find(r => r.label === 'Prospecting');
                expect(prospecting.value).toBe(2);
            });

            it('works without valueField', () => {
                const result = aggregateData(testData, 'StageName', null, OPERATIONS.COUNT);
                expect(result.find(r => r.label === 'Closed Won').value).toBe(3);
            });
        });

        describe('Average operation', () => {
            it('averages values by group', () => {
                const result = aggregateData(testData, 'StageName', 'Amount', OPERATIONS.AVERAGE);

                const closedWon = result.find(r => r.label === 'Closed Won');
                expect(closedWon.value).toBeCloseTo(333.33, 1); // 1000 / 3

                const prospecting = result.find(r => r.label === 'Prospecting');
                expect(prospecting.value).toBe(150); // 300 / 2
            });
        });

        it('handles null values in groupByField', () => {
            const dataWithNull = [...testData, { StageName: null, Amount: 50 }];
            const result = aggregateData(dataWithNull, 'StageName', 'Amount', OPERATIONS.SUM);

            const nullGroup = result.find(r => r.label === 'Null');
            expect(nullGroup).toBeDefined();
            expect(nullGroup.value).toBe(50);
        });

        it('sorts results by value descending', () => {
            const result = aggregateData(testData, 'StageName', 'Amount', OPERATIONS.SUM);
            expect(result[0].label).toBe('Closed Won'); // 1000 > 300
            expect(result[1].label).toBe('Prospecting');
        });

        it('handles non-numeric values gracefully', () => {
            const badData = [
                { Stage: 'A', Amount: 'not a number' },
                { Stage: 'A', Amount: 100 }
            ];
            const result = aggregateData(badData, 'Stage', 'Amount', OPERATIONS.SUM);
            expect(result[0].value).toBe(100); // NaN treated as 0
        });

        it('uses count as default for unknown operation', () => {
            const result = aggregateData(testData, 'StageName', 'Amount', 'Unknown');
            expect(result.find(r => r.label === 'Closed Won').value).toBe(3);
        });
    });

    describe('MAX_RECORDS', () => {
        it('is set to 2000', () => {
            expect(MAX_RECORDS).toBe(2000);
        });
    });

    describe('CHART_LIMITS', () => {
        it('defines limits for all chart types', () => {
            expect(CHART_LIMITS).toBeDefined();
            expect(Object.keys(CHART_LIMITS)).toHaveLength(20);
        });

        it('has null limits for aggregation charts (server GROUP BY)', () => {
            expect(CHART_LIMITS.BAR).toBeNull();
            expect(CHART_LIMITS.DONUT).toBeNull();
            expect(CHART_LIMITS.TREEMAP).toBeNull();
        });

        it('has numeric limits for non-aggregation charts', () => {
            expect(CHART_LIMITS.HISTOGRAM).toBe(10000);
            expect(CHART_LIMITS.SCATTER).toBe(5000);
            expect(CHART_LIMITS.LINE).toBe(1000);
            expect(CHART_LIMITS.FORCE_GRAPH).toBe(500);
            expect(CHART_LIMITS.GAUGE).toBe(1);
            expect(CHART_LIMITS.CHOROPLETH).toBe(500);
            expect(CHART_LIMITS.SANKEY).toBe(1000);
        });
    });

    describe('CHART_LIMITS for Phase 2 charts', () => {
        it('exports FUNNEL limit as null (server GROUP BY)', () => {
            expect(CHART_LIMITS.FUNNEL).toBeNull();
        });
        it('exports STACKED_BAR limit as null', () => {
            expect(CHART_LIMITS.STACKED_BAR).toBeNull();
        });
        it('exports AREA limit as 1000', () => {
            expect(CHART_LIMITS.AREA).toBe(1000);
        });
        it('exports BULLET limit as 1', () => {
            expect(CHART_LIMITS.BULLET).toBe(1);
        });
        it('exports HEATMAP limit as null', () => {
            expect(CHART_LIMITS.HEATMAP).toBeNull();
        });
        it('exports BOX_PLOT limit as 5000', () => {
            expect(CHART_LIMITS.BOX_PLOT).toBe(5000);
        });
        it('exports RADAR limit as null', () => {
            expect(CHART_LIMITS.RADAR).toBeNull();
        });
        it('exports WATERFALL limit as 500', () => {
            expect(CHART_LIMITS.WATERFALL).toBe(500);
        });
        it('exports CALENDAR_HEATMAP limit as 2000', () => {
            expect(CHART_LIMITS.CALENDAR_HEATMAP).toBe(2000);
        });
        it('exports SPARKLINE_GRID limit as 5000', () => {
            expect(CHART_LIMITS.SPARKLINE_GRID).toBe(5000);
        });
    });

    describe('OPERATIONS', () => {
        it('has Sum, Count, Average', () => {
            expect(OPERATIONS.SUM).toBe('Sum');
            expect(OPERATIONS.COUNT).toBe('Count');
            expect(OPERATIONS.AVERAGE).toBe('Average');
        });
    });

    describe('SVG_ELEMENT_CAP', () => {
        it('is set to 500', () => {
            expect(SVG_ELEMENT_CAP).toBe(500);
        });
    });

    describe('sampleData', () => {
        it('returns data unchanged when below limit', () => {
            const data = [{ x: 1 }, { x: 2 }, { x: 3 }];
            const result = sampleData(data, 'x', 500);
            expect(result.sampled).toBe(false);
            expect(result.data).toEqual(data);
            expect(result.originalCount).toBe(3);
        });

        it('samples data when above limit', () => {
            const data = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i * 2 }));
            const result = sampleData(data, 'x', 500);
            expect(result.sampled).toBe(true);
            expect(result.data.length).toBe(500);
            expect(result.originalCount).toBe(1000);
        });

        it('preserves first and last points (extent)', () => {
            const data = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i * 2 }));
            const result = sampleData(data, 'x', 100);
            expect(result.data[0].x).toBe(0);
            expect(result.data[result.data.length - 1].x).toBe(999);
        });

        it('handles null/undefined data', () => {
            expect(sampleData(null, 'x').data).toEqual([]);
            expect(sampleData(undefined, 'x').data).toEqual([]);
            expect(sampleData(null, 'x').sampled).toBe(false);
        });

        it('handles empty array', () => {
            const result = sampleData([], 'x');
            expect(result.data).toEqual([]);
            expect(result.sampled).toBe(false);
        });

        it('handles data exactly at limit', () => {
            const data = Array.from({ length: 500 }, (_, i) => ({ x: i }));
            const result = sampleData(data, 'x', 500);
            expect(result.sampled).toBe(false);
            expect(result.data.length).toBe(500);
        });

        it('produces evenly distributed samples', () => {
            const data = Array.from({ length: 100 }, (_, i) => ({ x: i }));
            const result = sampleData(data, 'x', 10);
            // Samples should be roughly evenly spaced
            const xs = result.data.map(d => d.x);
            // First and last
            expect(xs[0]).toBe(0);
            expect(xs[xs.length - 1]).toBe(99);
            // Check spacing is roughly uniform (within 1 of expected)
            const expectedStep = 99 / 9;
            for (let i = 1; i < xs.length - 1; i++) {
                expect(Math.abs(xs[i] - Math.round(i * expectedStep))).toBeLessThanOrEqual(1);
            }
        });

        it('uses SVG_ELEMENT_CAP as default limit', () => {
            const data = Array.from({ length: 600 }, (_, i) => ({ x: i }));
            const result = sampleData(data, 'x');
            expect(result.sampled).toBe(true);
            expect(result.data.length).toBe(500); // SVG_ELEMENT_CAP
        });

        it('sorts by sortField before sampling', () => {
            // Unsorted input
            const data = [
                { x: 100 }, { x: 1 }, { x: 50 }, { x: 75 }, { x: 25 },
                { x: 90 }, { x: 10 }, { x: 60 }, { x: 40 }, { x: 80 },
                { x: 5 }
            ];
            const result = sampleData(data, 'x', 5);
            // Should be sorted by x
            for (let i = 1; i < result.data.length; i++) {
                expect(result.data[i].x).toBeGreaterThanOrEqual(result.data[i - 1].x);
            }
        });
    });

    describe('aggregateSeriesData', () => {
        const SERIES_DATA = [
            { StageName: 'Prospecting', Type: 'New Business', Amount: 100 },
            { StageName: 'Prospecting', Type: 'Existing Business', Amount: 200 },
            { StageName: 'Qualification', Type: 'New Business', Amount: 150 },
            { StageName: 'Qualification', Type: 'Existing Business', Amount: 300 },
            { StageName: 'Closed Won', Type: 'New Business', Amount: 500 },
        ];

        it('groups by two dimensions with Sum', () => {
            const result = aggregateSeriesData(SERIES_DATA, 'StageName', 'Type', 'Amount', 'Sum');
            expect(result.length).toBe(5);
            const prospectingNew = result.find(r => r.label === 'Prospecting' && r.series === 'New Business');
            expect(prospectingNew.value).toBe(100);
        });

        it('returns all unique series names', () => {
            const result = aggregateSeriesData(SERIES_DATA, 'StageName', 'Type', 'Amount', 'Sum');
            const seriesNames = [...new Set(result.map(r => r.series))];
            expect(seriesNames).toContain('New Business');
            expect(seriesNames).toContain('Existing Business');
        });

        it('handles Count operation', () => {
            const result = aggregateSeriesData(SERIES_DATA, 'StageName', 'Type', 'Amount', 'Count');
            const prospectingNew = result.find(r => r.label === 'Prospecting' && r.series === 'New Business');
            expect(prospectingNew.value).toBe(1);
        });

        it('handles Average operation', () => {
            const dupes = [
                { StageName: 'A', Type: 'X', Amount: 100 },
                { StageName: 'A', Type: 'X', Amount: 200 },
            ];
            const result = aggregateSeriesData(dupes, 'StageName', 'Type', 'Amount', 'Average');
            expect(result[0].value).toBe(150);
        });

        it('returns empty array for null data', () => {
            expect(aggregateSeriesData(null, 'a', 'b', 'c', 'Sum')).toEqual([]);
        });

        it('returns empty array when seriesField is missing', () => {
            expect(aggregateSeriesData(SERIES_DATA, 'StageName', '', 'Amount', 'Sum')).toEqual([]);
        });

        it('handles null series values as "Null" label', () => {
            const withNull = [{ StageName: 'A', Type: null, Amount: 100 }];
            const result = aggregateSeriesData(withNull, 'StageName', 'Type', 'Amount', 'Sum');
            expect(result[0].series).toBe('Null');
        });
    });

    describe('computeQuartiles', () => {
        it('computes quartiles for odd-count dataset', () => {
            const data = [
                { val: 2 }, { val: 4 }, { val: 6 }, { val: 8 }, { val: 10 },
                { val: 12 }, { val: 14 }, { val: 16 }, { val: 18 }
            ];
            const result = computeQuartiles(data, 'val');
            expect(result.q2).toBe(10);
            expect(result.q1).toBe(5);
            expect(result.q3).toBe(15);
        });

        it('computes IQR correctly', () => {
            const data = [{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }, { val: 100 }];
            const result = computeQuartiles(data, 'val');
            expect(result.iqr).toBe(result.q3 - result.q1);
        });

        it('identifies outliers beyond 1.5*IQR', () => {
            const data = [
                { val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }, { val: 5 },
                { val: 6 }, { val: 7 }, { val: 8 }, { val: 9 }, { val: 100 }
            ];
            const result = computeQuartiles(data, 'val');
            expect(result.outliers.length).toBeGreaterThan(0);
            expect(result.outliers).toContain(100);
        });

        it('sets whiskers at data extent within 1.5*IQR', () => {
            const data = [{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }, { val: 5 }];
            const result = computeQuartiles(data, 'val');
            expect(result.whiskerLow).toBeGreaterThanOrEqual(1);
            expect(result.whiskerHigh).toBeLessThanOrEqual(5);
        });

        it('returns null for empty data', () => {
            expect(computeQuartiles([], 'val')).toBeNull();
        });

        it('returns null for null data', () => {
            expect(computeQuartiles(null, 'val')).toBeNull();
        });

        it('handles single value', () => {
            const result = computeQuartiles([{ val: 5 }], 'val');
            expect(result.q1).toBe(5);
            expect(result.q2).toBe(5);
            expect(result.q3).toBe(5);
        });

        it('skips null values in field', () => {
            const data = [{ val: 1 }, { val: null }, { val: 3 }, { val: 5 }];
            const result = computeQuartiles(data, 'val');
            expect(result).not.toBeNull();
        });
    });

    describe('computeRunningTotal', () => {
        it('computes cumulative sum', () => {
            const data = [
                { label: 'A', value: 100 },
                { label: 'B', value: -30 },
                { label: 'C', value: 50 },
            ];
            const result = computeRunningTotal(data);
            expect(result[0].cumulative).toBe(100);
            expect(result[1].cumulative).toBe(70);
            expect(result[2].cumulative).toBe(120);
        });

        it('marks positive and negative deltas', () => {
            const data = [
                { label: 'A', value: 100 },
                { label: 'B', value: -30 },
            ];
            const result = computeRunningTotal(data);
            expect(result[0].isPositive).toBe(true);
            expect(result[1].isPositive).toBe(false);
        });

        it('sets start and end for waterfall bar positioning', () => {
            const data = [
                { label: 'A', value: 100 },
                { label: 'B', value: -30 },
            ];
            const result = computeRunningTotal(data);
            expect(result[0].start).toBe(0);
            expect(result[0].end).toBe(100);
            expect(result[1].start).toBe(100);
            expect(result[1].end).toBe(70);
        });

        it('returns empty for null/empty input', () => {
            expect(computeRunningTotal(null)).toEqual([]);
            expect(computeRunningTotal([])).toEqual([]);
        });

        it('handles all negative values', () => {
            const data = [
                { label: 'A', value: -10 },
                { label: 'B', value: -20 },
            ];
            const result = computeRunningTotal(data);
            expect(result[0].cumulative).toBe(-10);
            expect(result[1].cumulative).toBe(-30);
        });
    });
});
