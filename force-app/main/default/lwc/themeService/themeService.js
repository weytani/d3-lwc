/**
 * Theme service for D3 chart components.
 * Provides color palettes aligned with SLDS and custom themes.
 */

/**
 * Predefined color palettes.
 * 'Salesforce Standard' uses SLDS chart colors.
 */
export const PALETTES = {
  "Salesforce Standard": [
    "#1589EE", // Brand Blue
    "#FF9E2C", // Warning Orange
    "#4BCA81", // Success Green
    "#FF5D5D", // Error Red
    "#AD7BFF", // Purple
    "#FF84C6", // Pink
    "#00C6CD", // Cyan
    "#B8E986", // Lime
    "#FFD86E", // Yellow
    "#A4C7F1" // Light Blue
  ],
  Warm: [
    "#FF6B6B",
    "#FF8E72",
    "#FFB677",
    "#FFD93D",
    "#F9844A",
    "#F3722C",
    "#F94144",
    "#E63946",
    "#D62839",
    "#BA1B1D"
  ],
  Cool: [
    "#4361EE",
    "#3A0CA3",
    "#7209B7",
    "#560BAD",
    "#480CA8",
    "#3F37C9",
    "#4895EF",
    "#4CC9F0",
    "#00B4D8",
    "#0077B6"
  ],
  Vibrant: [
    "#FF595E",
    "#FFCA3A",
    "#8AC926",
    "#1982C4",
    "#6A4C93",
    "#FF85A1",
    "#FFD166",
    "#06D6A0",
    "#118AB2",
    "#9B5DE5"
  ]
};

/**
 * Available theme names.
 */
export const THEMES = Object.keys(PALETTES);

/**
 * Default theme.
 */
export const DEFAULT_THEME = "Salesforce Standard";

/**
 * Extends or truncates a color array to match count.
 * If count > colors.length, cycles through colors.
 * @param {Array} colors - Base color array
 * @param {Number} count - Desired count
 * @returns {Array} - Color array of exact length
 */
const extendColors = (colors, count) => {
  if (count <= 0) return [];
  if (count <= colors.length) return colors.slice(0, count);

  // Cycle through colors to fill count
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
};

/**
 * Gets color array for a dataset.
 * @param {String} theme - Theme name (falls back to default)
 * @param {Number} count - Number of colors needed
 * @param {Array} customColors - Optional custom color override
 * @returns {Array} - Array of hex color strings
 */
export const getColors = (theme, count, customColors = null) => {
  // Use custom colors if provided
  if (customColors && Array.isArray(customColors) && customColors.length > 0) {
    return extendColors(customColors, count);
  }

  // Get palette for theme
  const palette = PALETTES[theme] || PALETTES[DEFAULT_THEME];
  return extendColors(palette, count);
};

/**
 * Creates a color scale function from theme.
 * @param {String} theme - Theme name
 * @param {Array} domain - Data domain (labels)
 * @param {Array} customColors - Optional custom colors
 * @returns {Function} - Function that maps label to color
 */
export const createColorScale = (theme, domain, customColors = null) => {
  const colors = getColors(theme, domain.length, customColors);
  const colorMap = new Map();
  domain.forEach((label, i) => colorMap.set(label, colors[i]));
  return (label) => colorMap.get(label) || colors[0];
};

/**
 * Gets a single color from theme by index.
 * @param {String} theme - Theme name
 * @param {Number} index - Color index
 * @param {Array} customColors - Optional custom colors
 * @returns {String} - Hex color string
 */
export const getColor = (theme, index = 0, customColors = null) => {
  const colors = getColors(theme, index + 1, customColors);
  return colors[index] || colors[0];
};

/**
 * Semantic colors for charts with directional meaning.
 */
export const SEMANTIC_COLORS = {
  positive: "#4BCA81",
  negative: "#FF5D5D",
  neutral: "#B0C4DE",
  subtotal: "#1589EE"
};

/**
 * Base hues for sequential ramps (light → dark).
 */
const SEQUENTIAL_BASES = {
  blue: { light: [222, 235, 247], dark: [8, 48, 107] },
  green: { light: [229, 245, 224], dark: [0, 68, 27] },
  red: { light: [254, 229, 217], dark: [153, 0, 13] }
};

/**
 * Generates a sequential color ramp from light to dark.
 * @param {String} hue - 'blue', 'green', or 'red'
 * @param {Number} steps - Number of colors to generate
 * @returns {Array} - Array of hex color strings, light to dark
 */
export const getSequentialRamp = (hue, steps) => {
  const base = SEQUENTIAL_BASES[hue] || SEQUENTIAL_BASES.blue;
  if (steps <= 0) return [];
  if (steps === 1) {
    const mid = base.light.map((l, i) => Math.round((l + base.dark[i]) / 2));
    return ["#" + mid.map((v) => v.toString(16).padStart(2, "0")).join("")];
  }

  const ramp = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const rgb = base.light.map((l, idx) =>
      Math.round(l + t * (base.dark[idx] - l))
    );
    ramp.push("#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join(""));
  }
  return ramp;
};
