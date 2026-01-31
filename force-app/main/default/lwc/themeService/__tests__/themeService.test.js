import {
    PALETTES,
    THEMES,
    DEFAULT_THEME,
    getColors,
    createColorScale,
    getColor
} from 'c/themeService';

describe('themeService', () => {
    describe('PALETTES', () => {
        it('has Salesforce Standard palette', () => {
            expect(PALETTES['Salesforce Standard']).toBeDefined();
            expect(PALETTES['Salesforce Standard']).toHaveLength(10);
        });

        it('has Warm palette', () => {
            expect(PALETTES['Warm']).toBeDefined();
            expect(PALETTES['Warm'].length).toBeGreaterThanOrEqual(5);
        });

        it('has Cool palette', () => {
            expect(PALETTES['Cool']).toBeDefined();
        });

        it('has Vibrant palette', () => {
            expect(PALETTES['Vibrant']).toBeDefined();
        });

        it('all palettes have valid hex colors', () => {
            const hexRegex = /^#[0-9A-Fa-f]{6}$/;
            Object.values(PALETTES).forEach(palette => {
                palette.forEach(color => {
                    expect(color).toMatch(hexRegex);
                });
            });
        });
    });

    describe('THEMES', () => {
        it('lists all available themes', () => {
            expect(THEMES).toContain('Salesforce Standard');
            expect(THEMES).toContain('Warm');
            expect(THEMES).toContain('Cool');
            expect(THEMES).toContain('Vibrant');
        });

        it('has correct length', () => {
            expect(THEMES).toHaveLength(4);
        });
    });

    describe('DEFAULT_THEME', () => {
        it('is Salesforce Standard', () => {
            expect(DEFAULT_THEME).toBe('Salesforce Standard');
        });

        it('exists in PALETTES', () => {
            expect(PALETTES[DEFAULT_THEME]).toBeDefined();
        });
    });

    describe('getColors', () => {
        it('returns colors from specified theme', () => {
            const colors = getColors('Warm', 3);
            expect(colors).toHaveLength(3);
            expect(PALETTES['Warm']).toContain(colors[0]);
        });

        it('falls back to default theme for unknown theme', () => {
            const colors = getColors('NonExistent', 3);
            expect(colors).toHaveLength(3);
            expect(PALETTES['Salesforce Standard']).toContain(colors[0]);
        });

        it('returns exact count of colors', () => {
            expect(getColors('Cool', 5)).toHaveLength(5);
            expect(getColors('Cool', 1)).toHaveLength(1);
        });

        it('cycles colors when count exceeds palette size', () => {
            const palette = PALETTES['Salesforce Standard'];
            const colors = getColors('Salesforce Standard', 15);
            expect(colors).toHaveLength(15);
            // 11th color should cycle back to 1st
            expect(colors[10]).toBe(palette[0]);
        });

        it('uses custom colors when provided', () => {
            const custom = ['#FF0000', '#00FF00', '#0000FF'];
            const colors = getColors('Warm', 3, custom);
            expect(colors).toEqual(custom);
        });

        it('extends custom colors if count exceeds custom array', () => {
            const custom = ['#FF0000', '#00FF00'];
            const colors = getColors('Warm', 4, custom);
            expect(colors).toHaveLength(4);
            expect(colors[2]).toBe('#FF0000'); // Cycles
        });

        it('returns empty array for count <= 0', () => {
            expect(getColors('Warm', 0)).toEqual([]);
            expect(getColors('Warm', -1)).toEqual([]);
        });

        it('ignores empty custom colors array', () => {
            const colors = getColors('Warm', 3, []);
            expect(PALETTES['Warm']).toContain(colors[0]);
        });

        it('ignores non-array custom colors', () => {
            const colors = getColors('Warm', 3, 'not an array');
            expect(PALETTES['Warm']).toContain(colors[0]);
        });
    });

    describe('createColorScale', () => {
        it('returns a function', () => {
            const scale = createColorScale('Warm', ['A', 'B', 'C']);
            expect(typeof scale).toBe('function');
        });

        it('maps domain values to colors', () => {
            const domain = ['Alpha', 'Beta', 'Gamma'];
            const scale = createColorScale('Salesforce Standard', domain);

            const colors = domain.map(d => scale(d));
            expect(colors).toHaveLength(3);
            // Each should be unique (within same palette)
            expect(new Set(colors).size).toBe(3);
        });

        it('returns first color for unknown domain value', () => {
            const scale = createColorScale('Warm', ['A', 'B']);
            const unknownColor = scale('Unknown');
            const firstColor = scale('A');
            expect(unknownColor).toBe(firstColor);
        });

        it('uses custom colors when provided', () => {
            const custom = ['#111', '#222', '#333'];
            const scale = createColorScale('Warm', ['A', 'B', 'C'], custom);
            expect(scale('A')).toBe('#111');
            expect(scale('B')).toBe('#222');
        });
    });

    describe('getColor', () => {
        it('returns single color by index', () => {
            const color = getColor('Salesforce Standard', 0);
            expect(color).toBe(PALETTES['Salesforce Standard'][0]);
        });

        it('returns correct color for higher index', () => {
            const color = getColor('Salesforce Standard', 5);
            expect(color).toBe(PALETTES['Salesforce Standard'][5]);
        });

        it('defaults to index 0', () => {
            const color = getColor('Salesforce Standard');
            expect(color).toBe(PALETTES['Salesforce Standard'][0]);
        });

        it('uses custom colors when provided', () => {
            const custom = ['#ABC', '#DEF'];
            const color = getColor('Warm', 1, custom);
            expect(color).toBe('#DEF');
        });
    });
});
