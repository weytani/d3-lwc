/**
 * D3.js loader utility module.
 * Provides singleton loading of D3 library from static resource.
 */
import { loadScript } from 'lightning/platformResourceLoader';
import D3_RESOURCE from '@salesforce/resourceUrl/d3';

let d3Instance = null;
let loadPromise = null;

/**
 * Loads D3.js library and returns the d3 object.
 * Uses singleton pattern to prevent multiple loads.
 * @param {LightningElement} component - The LWC component instance
 * @returns {Promise<Object>} - The d3 library object
 */
export const loadD3 = async (component) => {
    if (d3Instance) {
        return d3Instance;
    }
    if (!loadPromise) {
        loadPromise = loadScript(component, D3_RESOURCE)
            .then(() => {
                d3Instance = window.d3;
                return d3Instance;
            })
            .catch((error) => {
                loadPromise = null;
                throw new Error('Failed to load D3.js: ' + error.message);
            });
    }
    return loadPromise;
};

/**
 * Returns the cached D3 instance (if loaded).
 * @returns {Object|null} - The d3 library object or null if not loaded
 */
export const getD3 = () => d3Instance;

/**
 * Resets the D3 instance (mainly for testing).
 */
export const resetD3 = () => {
    d3Instance = null;
    loadPromise = null;
};
