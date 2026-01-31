import {
    validateData,
    validateFields,
    truncateData,
    prepareData,
    aggregateData,
    MAX_RECORDS,
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

    describe('OPERATIONS', () => {
        it('has Sum, Count, Average', () => {
            expect(OPERATIONS.SUM).toBe('Sum');
            expect(OPERATIONS.COUNT).toBe('Count');
            expect(OPERATIONS.AVERAGE).toBe('Average');
        });
    });
});
