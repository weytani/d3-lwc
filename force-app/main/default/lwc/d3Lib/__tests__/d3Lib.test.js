import { loadD3, getD3, resetD3 } from 'c/d3Lib';
import { loadScript } from 'lightning/platformResourceLoader';

// Mock the static resource URL
jest.mock(
    '@salesforce/resourceUrl/d3',
    () => ({ default: '/resource/d3' }),
    { virtual: true }
);

describe('d3Lib', () => {
    beforeEach(() => {
        resetD3();
        jest.clearAllMocks();
        // Setup mock d3 on window
        window.d3 = { version: '7.0.0-mock' };
    });

    afterEach(() => {
        delete window.d3;
    });

    describe('loadD3', () => {
        it('calls loadScript with correct resource', async () => {
            const mockComponent = {};
            await loadD3(mockComponent);

            expect(loadScript).toHaveBeenCalledTimes(1);
            expect(loadScript).toHaveBeenCalledWith(mockComponent, '/resource/d3');
        });

        it('returns d3 instance after loading', async () => {
            const mockComponent = {};
            const d3 = await loadD3(mockComponent);

            expect(d3).toBeDefined();
            expect(d3.version).toBe('7.0.0-mock');
        });

        it('returns cached instance on subsequent calls', async () => {
            const mockComponent = {};
            
            const d3First = await loadD3(mockComponent);
            const d3Second = await loadD3(mockComponent);

            expect(loadScript).toHaveBeenCalledTimes(1); // Only called once
            expect(d3First).toBe(d3Second);
        });

        it('handles loadScript errors', async () => {
            loadScript.mockRejectedValueOnce(new Error('Network error'));
            const mockComponent = {};

            await expect(loadD3(mockComponent)).rejects.toThrow('Failed to load D3.js');
        });
    });

    describe('getD3', () => {
        it('returns null before loading', () => {
            expect(getD3()).toBeNull();
        });

        it('returns d3 instance after loading', async () => {
            const mockComponent = {};
            await loadD3(mockComponent);

            expect(getD3()).toBeDefined();
            expect(getD3().version).toBe('7.0.0-mock');
        });
    });

    describe('resetD3', () => {
        it('clears cached instance', async () => {
            const mockComponent = {};
            await loadD3(mockComponent);
            
            expect(getD3()).toBeDefined();
            
            resetD3();
            
            expect(getD3()).toBeNull();
        });
    });
});
