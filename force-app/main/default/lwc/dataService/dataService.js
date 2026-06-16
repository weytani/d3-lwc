// ABOUTME: Data processing utilities for D3 chart components.
// ABOUTME: Handles validation, truncation, aggregation, sampling, and per-chart record limits.
/**
 * Data processing utilities for D3 chart components.
 * Handles validation, truncation, and aggregation.
 *
 * For the soqlQuery path with full field configuration, charts prefer
 * server-side processing via D3ChartController Apex methods
 * (getAggregatedData, getStatistics, getCorrelation).
 * These client-side utilities serve as the processing layer for
 * the recordCollection path and as a fallback when server-side
 * processing is unavailable.
 */

/**
 * Maximum number of records to process (performance guardrail).
 */
export const MAX_RECORDS = 2000;

/**
 * Per-chart-type record limits tuned to visual capacity.
 * Aggregation charts (bar, donut, treemap) use server GROUP BY with no raw cap.
 * Each chart imports its own limit from this map.
 */
export const CHART_LIMITS = {
  BAR: null, // Server GROUP BY, no raw record cap
  DONUT: null, // Server GROUP BY, no raw record cap
  TREEMAP: null, // Server GROUP BY, no raw record cap
  HISTOGRAM: 10000, // Raw values for binning math, not SVG elements
  SCATTER: 5000, // SVG_ELEMENT_CAP handles rendering separately
  LINE: 1000, // Visual comprehension ceiling
  FORCE_GRAPH: 500, // O(n log n) simulation cost
  GAUGE: 1, // Single value
  CHOROPLETH: 500, // Geographic region limit
  SANKEY: 1000, // Flow diagram readability
  // Phase 2 charts
  FUNNEL: null, // Server GROUP BY, no raw record cap
  STACKED_BAR: null, // Server GROUP BY, no raw record cap
  AREA: 1000, // Visual comprehension ceiling
  BULLET: 1, // Single value
  HEATMAP: null, // Server GROUP BY, no raw record cap
  BOX_PLOT: 5000, // Raw values for distribution math
  RADAR: null, // Server GROUP BY, no raw record cap
  WATERFALL: 500, // Sequential step readability
  CALENDAR_HEATMAP: 2000, // Daily data points (~5.5 years)
  SPARKLINE_GRID: 5000, // Multiple small charts, raw values
  // Phase 3 charts
  SUNBURST: 2000, // Raw hierarchy rows for client nest
  CHORD: 2000, // Raw edge rows for matrix pivot
  GANTT: 2000, // Raw date-range rows
  BUBBLE: 5000, // Raw xy rows; SVG_ELEMENT_CAP handles rendering separately
  DIVERGING_BAR: null, // Server GROUP BY (signed), no raw record cap
  WAFFLE: null, // Server GROUP BY Count, no raw record cap
  HORIZONTAL_BAR: null, // Server GROUP BY, no raw record cap
  PIE: null, // Server GROUP BY, no raw record cap
  PROGRESS_BAR: null, // Server GROUP BY (single row), no raw record cap
  LOLLIPOP: null // Server GROUP BY, no raw record cap
};

/**
 * Supported aggregation operations.
 */
export const OPERATIONS = {
  SUM: "Sum",
  COUNT: "Count",
  AVERAGE: "Average"
};

/**
 * Validates that data is a non-empty array.
 * @param {Array} data - Data to validate
 * @returns {Object} - { isValid: boolean, error: string|null }
 */
export const validateData = (data) => {
  if (!data) {
    return { isValid: false, error: "Data is required" };
  }
  if (!Array.isArray(data)) {
    return { isValid: false, error: "Data must be an array" };
  }
  if (data.length === 0) {
    return { isValid: false, error: "Data array is empty" };
  }
  return { isValid: true, error: null };
};

/**
 * Validates that required fields exist in data objects.
 * @param {Array} data - Data array
 * @param {Array} requiredFields - Field names to check
 * @returns {Object} - { isValid: boolean, error: string|null, missingFields: Array }
 */
export const validateFields = (data, requiredFields) => {
  if (!requiredFields || requiredFields.length === 0) {
    return { isValid: true, error: null, missingFields: [] };
  }

  const sample = data[0];
  const missingFields = requiredFields.filter((field) => !(field in sample));

  if (missingFields.length > 0) {
    return {
      isValid: false,
      error: `Missing required fields: ${missingFields.join(", ")}`,
      missingFields
    };
  }

  return { isValid: true, error: null, missingFields: [] };
};

/**
 * Truncates data array to max records limit.
 * @param {Array} data - Data to truncate
 * @param {Number} limit - Max records (default: MAX_RECORDS)
 * @returns {Object} - { data: Array, truncated: boolean, originalCount: number }
 */
export const truncateData = (data, limit = MAX_RECORDS) => {
  const originalCount = data.length;
  const truncated = originalCount > limit;

  return {
    data: truncated ? data.slice(0, limit) : data,
    truncated,
    originalCount
  };
};

/**
 * Prepares data with validation and truncation.
 * @param {Array} data - Raw data
 * @param {Object} options - { requiredFields: Array, limit: Number }
 * @returns {Object} - { data: Array, valid: boolean, error: string, truncated: boolean }
 */
export const prepareData = (data, options = {}) => {
  const { requiredFields = [], limit = MAX_RECORDS } = options;

  // Validate
  const validation = validateData(data);
  if (!validation.isValid) {
    return {
      data: [],
      valid: false,
      error: validation.error,
      truncated: false
    };
  }

  // Validate fields
  const fieldValidation = validateFields(data, requiredFields);
  if (!fieldValidation.isValid) {
    return {
      data: [],
      valid: false,
      error: fieldValidation.error,
      truncated: false
    };
  }

  // Truncate
  const truncation = truncateData(data, limit);

  return {
    data: truncation.data,
    valid: true,
    error: null,
    truncated: truncation.truncated,
    originalCount: truncation.originalCount
  };
};

/**
 * Threshold above which scatter data is sampled to reduce SVG element count.
 */
export const SVG_ELEMENT_CAP = 500;

/**
 * Samples data to reduce point count for SVG rendering performance.
 * Uses stratified sampling to preserve distribution shape:
 * sorts by the specified field, then takes evenly-spaced samples.
 * Always includes first and last points to preserve extent.
 * @param {Array} data - Array of data points
 * @param {String} sortField - Field to sort by for stratified sampling
 * @param {Number} limit - Maximum points to return (default: SVG_ELEMENT_CAP)
 * @returns {Object} - { data: Array, sampled: boolean, originalCount: number }
 */
export const sampleData = (data, sortField, limit = SVG_ELEMENT_CAP) => {
  if (!data || data.length <= limit) {
    return {
      data: data || [],
      sampled: false,
      originalCount: data ? data.length : 0
    };
  }

  const sorted = [...data].sort((a, b) => {
    const aVal = Number(a[sortField]) || 0;
    const bVal = Number(b[sortField]) || 0;
    return aVal - bVal;
  });

  const originalCount = sorted.length;
  const step = (originalCount - 1) / (limit - 1);
  const sampled = [];

  for (let i = 0; i < limit; i++) {
    const index = Math.round(i * step);
    sampled.push(sorted[index]);
  }

  return { data: sampled, sampled: true, originalCount };
};

/**
 * Aggregates data by a group field using the specified operation.
 * For the soqlQuery path, prefer the server-side getAggregatedData Apex method
 * which can process larger datasets via SOQL GROUP BY.
 * This function is used for the recordCollection path and as a fallback.
 * @param {Array} data - Array of records
 * @param {String} groupByField - Field to group by
 * @param {String} valueField - Field to aggregate (not needed for Count)
 * @param {String} operation - 'Sum', 'Count', or 'Average'
 * @returns {Array} - [{ label: string, value: number }, ...]
 */
export const aggregateData = (data, groupByField, valueField, operation) => {
  if (!data || !groupByField) {
    return [];
  }

  // Group by the specified field
  const groups = new Map();

  data.forEach((record) => {
    const key = String(record[groupByField] ?? "Null");
    if (!groups.has(key)) {
      groups.set(key, { sum: 0, count: 0 });
    }
    const group = groups.get(key);
    group.count += 1;
    if (valueField && record[valueField] != null) {
      group.sum += Number(record[valueField]) || 0;
    }
  });

  // Calculate final values based on operation
  const result = [];
  groups.forEach((group, label) => {
    let value;
    switch (operation) {
      case OPERATIONS.SUM:
        value = group.sum;
        break;
      case OPERATIONS.COUNT:
        value = group.count;
        break;
      case OPERATIONS.AVERAGE:
        value = group.count > 0 ? group.sum / group.count : 0;
        break;
      default:
        value = group.count;
    }
    result.push({ label, value });
  });

  // Sort by value descending
  return result.sort((a, b) => b.value - a.value);
};

/**
 * Aggregates data by two group fields (label + series).
 * Returns flat array of { label, series, value } objects.
 * @param {Array} data - Array of records
 * @param {String} groupByField - Primary grouping (x-axis categories)
 * @param {String} seriesField - Secondary grouping (series/stacks)
 * @param {String} valueField - Field to aggregate
 * @param {String} operation - 'Sum', 'Count', or 'Average'
 * @returns {Array} - [{ label, series, value }, ...]
 */
export const aggregateSeriesData = (
  data,
  groupByField,
  seriesField,
  valueField,
  operation
) => {
  if (!data || !groupByField || !seriesField) {
    return [];
  }

  const groups = new Map();

  data.forEach((record) => {
    const label = String(record[groupByField] ?? "Null");
    const series = String(record[seriesField] ?? "Null");
    const key = `${label}|||${series}`;

    if (!groups.has(key)) {
      groups.set(key, { label, series, sum: 0, count: 0 });
    }
    const group = groups.get(key);
    group.count += 1;
    if (valueField && record[valueField] != null) {
      group.sum += Number(record[valueField]) || 0;
    }
  });

  const result = [];
  groups.forEach((group) => {
    let value;
    switch (operation) {
      case OPERATIONS.SUM:
        value = group.sum;
        break;
      case OPERATIONS.COUNT:
        value = group.count;
        break;
      case OPERATIONS.AVERAGE:
        value = group.count > 0 ? group.sum / group.count : 0;
        break;
      default:
        value = group.count;
    }
    result.push({ label: group.label, series: group.series, value });
  });

  return result;
};

/**
 * Computes quartile statistics for a numeric field.
 * @param {Array} data - Array of records
 * @param {String} valueField - Numeric field to analyze
 * @returns {Object|null} - { q1, q2, q3, iqr, whiskerLow, whiskerHigh, min, max, outliers[] }
 */
export const computeQuartiles = (data, valueField) => {
  if (!data || data.length === 0) {
    return null;
  }

  const values = data
    .map((d) => d[valueField])
    .filter((v) => v != null && !isNaN(Number(v)))
    .map(Number)
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return null;
  }

  const median = (arr) => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const q2 = median(values);
  const mid = Math.floor(values.length / 2);
  const lowerHalf = values.slice(0, mid);
  const upperHalf =
    values.length % 2 !== 0 ? values.slice(mid + 1) : values.slice(mid);
  const q1 = lowerHalf.length > 0 ? median(lowerHalf) : q2;
  const q3 = upperHalf.length > 0 ? median(upperHalf) : q2;
  const iqr = q3 - q1;

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const whiskerLow = values.find((v) => v >= lowerFence) ?? values[0];
  const whiskerHigh =
    [...values].reverse().find((v) => v <= upperFence) ??
    values[values.length - 1];

  const outliers = values.filter((v) => v < lowerFence || v > upperFence);

  return {
    q1,
    q2,
    q3,
    iqr,
    whiskerLow,
    whiskerHigh,
    min: values[0],
    max: values[values.length - 1],
    outliers
  };
};

/**
 * Computes running total with start/end positions for waterfall charts.
 * Input data should already be aggregated: [{ label, value }, ...]
 * @param {Array} data - Aggregated data with label and value
 * @returns {Array} - [{ label, value, cumulative, start, end, isPositive }, ...]
 */
export const computeRunningTotal = (data) => {
  if (!data || data.length === 0) {
    return [];
  }

  let cumulative = 0;
  return data.map((d) => {
    const start = cumulative;
    cumulative += d.value;
    return {
      label: d.label,
      value: d.value,
      cumulative,
      start,
      end: cumulative,
      isPositive: d.value >= 0
    };
  });
};

/**
 * Builds a square adjacency matrix from a directed edge list.
 * Used by the Chord diagram, which feeds the matrix to d3.chord().
 * Labels are the union of source + target values in first-seen order
 * (source of an edge before its target). Duplicate source->target
 * edges are summed into a single cell.
 * @param {Array} edges - Edge records, e.g. getMultiGroupData output
 * @param {String} sourceKey - Field holding the source label
 * @param {String} targetKey - Field holding the target label
 * @param {String} valueKey - Field holding the numeric edge weight
 * @returns {Object} - { matrix: number[][], labels: string[] }
 */
export const buildMatrix = (edges, sourceKey, targetKey, valueKey) => {
  if (!edges || edges.length === 0) {
    return { matrix: [], labels: [] };
  }

  // Collect union of labels in first-seen order (source before target).
  const labels = [];
  const indexOf = new Map();
  const register = (value) => {
    const label = String(value ?? "Null");
    if (!indexOf.has(label)) {
      indexOf.set(label, labels.length);
      labels.push(label);
    }
    return indexOf.get(label);
  };

  edges.forEach((edge) => {
    register(edge[sourceKey]);
    register(edge[targetKey]);
  });

  const size = labels.length;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));

  edges.forEach((edge) => {
    const sourceIndex = indexOf.get(String(edge[sourceKey] ?? "Null"));
    const targetIndex = indexOf.get(String(edge[targetKey] ?? "Null"));
    matrix[sourceIndex][targetIndex] += Number(edge[valueKey]) || 0;
  });

  return { matrix, labels };
};
