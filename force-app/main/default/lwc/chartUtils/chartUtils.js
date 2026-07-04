/**
 * Shared utilities for D3 chart components.
 * Provides formatters, tooltip helpers, and resize handling.
 */

// ===== NUMBER FORMATTERS =====

/**
 * Formats a number for display (K, M, B suffixes).
 * @param {Number} value - Number to format
 * @param {Number} decimals - Decimal places (default: 1)
 * @returns {String} - Formatted string
 */
export const formatNumber = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return "0";
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1e9) {
    return sign + (absValue / 1e9).toFixed(decimals).replace(/\.0+$/, "") + "B";
  }
  if (absValue >= 1e6) {
    return sign + (absValue / 1e6).toFixed(decimals).replace(/\.0+$/, "") + "M";
  }
  if (absValue >= 1e3) {
    return sign + (absValue / 1e3).toFixed(decimals).replace(/\.0+$/, "") + "K";
  }

  return sign + absValue.toFixed(decimals).replace(/\.0+$/, "");
};

/**
 * Formats a number as currency.
 * @param {Number} value - Number to format
 * @param {String} currency - Currency code (default: 'USD')
 * @returns {String} - Formatted currency string
 */
export const formatCurrency = (value, currency = "USD") => {
  if (value === null || value === undefined || isNaN(value)) {
    return "$0";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return "$" + formatNumber(value);
  }
};

/**
 * Formats a percentage.
 * @param {Number} value - Decimal value (0.5 = 50%)
 * @param {Number} decimals - Decimal places
 * @returns {String} - Formatted percentage
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return "0%";
  }
  return (value * 100).toFixed(decimals) + "%";
};

/**
 * Truncates a label to max length with ellipsis.
 * @param {String} label - Label to truncate
 * @param {Number} maxLength - Maximum characters
 * @returns {String} - Truncated label
 */
export const truncateLabel = (label, maxLength = 20) => {
  if (!label) return "";
  const str = String(label);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
};

// ===== TOOLTIP UTILITIES =====

/**
 * Creates SLDS-styled tooltip element.
 * @param {HTMLElement} container - Parent container for tooltip
 * @returns {Object} - Tooltip controller { show, hide, destroy, element }
 */
export const createTooltip = (container) => {
  // Create tooltip div with SLDS styling
  const tooltip = document.createElement("div");
  tooltip.className = "slds-popover slds-popover_tooltip slds-nubbin_bottom";
  tooltip.setAttribute("role", "tooltip");
  tooltip.style.cssText = `
        position: absolute;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease-in-out;
        z-index: 9999;
        max-width: 300px;
        background: #16325c;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;

  const body = document.createElement("div");
  body.className = "slds-popover__body";
  tooltip.appendChild(body);

  container.appendChild(tooltip);

  return {
    element: tooltip,

    /**
     * Shows tooltip with content at position.
     * @param {String} content - HTML content
     * @param {Number} x - X position
     * @param {Number} y - Y position
     */
    show(content, x, y) {
      // eslint-disable-next-line @lwc/lwc/no-inner-html
      body.innerHTML = content;
      tooltip.style.opacity = "1";

      // Position tooltip above the point
      const rect = tooltip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      let left = x - rect.width / 2;
      let top = y - rect.height - 10;

      // Keep within container bounds
      left = Math.max(0, Math.min(left, containerRect.width - rect.width));
      top = Math.max(0, top);

      tooltip.style.left = left + "px";
      tooltip.style.top = top + "px";
    },

    /**
     * Hides the tooltip.
     */
    hide() {
      tooltip.style.opacity = "0";
    },

    /**
     * Removes tooltip from DOM.
     */
    destroy() {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    }
  };
};

/**
 * Builds tooltip content HTML.
 * @param {String} label - Primary label
 * @param {String|Number} value - Value to display
 * @param {Object} options - { formatter: Function, prefix: String, suffix: String }
 * @returns {String} - HTML string
 */
export const buildTooltipContent = (label, value, options = {}) => {
  const { formatter = formatNumber, prefix = "", suffix = "" } = options;
  const formattedValue = formatter ? formatter(value) : value;

  return `
        <div style="font-weight: bold; margin-bottom: 4px;">${label}</div>
        <div>${prefix}${formattedValue}${suffix}</div>
    `;
};

// ===== RESIZE UTILITIES =====

/**
 * Creates a debounced resize observer for a container.
 * @param {HTMLElement} container - Element to observe
 * @param {Function} callback - Called with { width, height } on resize
 * @param {Number} debounceMs - Debounce delay (default: 250)
 * @returns {Object} - { observe, disconnect }
 */
export const createResizeHandler = (container, callback, debounceMs = 250) => {
  let timeoutId = null;
  let observer = null;

  const debouncedCallback = (entries) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // eslint-disable-next-line @lwc/lwc/no-async-operation
    timeoutId = setTimeout(() => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        callback({ width, height });
      }
    }, debounceMs);
  };

  return {
    /**
     * Starts observing the container.
     */
    observe() {
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(debouncedCallback);
        observer.observe(container);
      } else {
        // Fallback: just call once with current size
        const rect = container.getBoundingClientRect();
        callback({ width: rect.width, height: rect.height });
      }
    },

    /**
     * Stops observing and cleans up.
     */
    disconnect() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }
  };
};

/**
 * Calculates chart dimensions from container with margins.
 * @param {Number} containerWidth - Container width
 * @param {Number} containerHeight - Container height
 * @param {Object} margins - { top, right, bottom, left }
 * @returns {Object} - { width, height, margins }
 */
export const calculateDimensions = (
  containerWidth,
  containerHeight,
  margins = {}
) => {
  const defaultMargins = { top: 20, right: 20, bottom: 30, left: 40 };
  const m = { ...defaultMargins, ...margins };

  return {
    width: Math.max(0, containerWidth - m.left - m.right),
    height: Math.max(0, containerHeight - m.top - m.bottom),
    margins: m
  };
};

/**
 * Determines if chart should use compact mode based on width.
 * @param {Number} width - Current width
 * @param {Number} minWidth - Minimum recommended width
 * @returns {Boolean} - True if compact mode should be used
 */
export const shouldUseCompactMode = (width, minWidth = 300) => {
  return width < minWidth;
};

// ===== LAYOUT RETRY UTILITIES =====

/**
 * Creates a RAF-based retry loop that polls a container for non-zero width.
 * Useful when a container starts at zero width (e.g. flex-grow: 0 in Local Dev Preview)
 * and the chart needs to wait for the layout engine to assign width.
 * @param {HTMLElement} container - Element to poll
 * @param {Function} onLayout - Called with width when container has non-zero width
 * @param {Object} options - { maxAttempts: number } (default: 60 ≈ 1 second at 60fps)
 * @returns {Object} - { cancel() } for cleanup
 */
export const createLayoutRetry = (
  container,
  onLayout,
  { maxAttempts = 60 } = {}
) => {
  let rafId = null;
  let cancelled = false;

  const check = (attempt) => {
    if (cancelled) return;
    const { width } = container.getBoundingClientRect();
    if (width > 0) {
      rafId = null;
      onLayout(width);
      return;
    }
    if (attempt >= maxAttempts) {
      rafId = null;
      return;
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    rafId = requestAnimationFrame(() => check(attempt + 1));
  };

  // eslint-disable-next-line @lwc/lwc/no-async-operation
  rafId = requestAnimationFrame(() => check(0));

  return {
    cancel() {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  };
};

// ===== COLOR CONTRAST UTILITIES =====

/**
 * Returns black or white text color based on background luminance.
 * Uses WCAG relative luminance formula.
 * @param {String} hexColor - Background color in hex (#RGB or #RRGGBB)
 * @returns {String} - '#000000' or '#ffffff'
 */
export const getContrastColor = (hexColor) => {
  if (!hexColor || typeof hexColor !== "string") return "#000000";

  let hex = hexColor.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length !== 6) return "#000000";

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const toLinear = (c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance > 0.179 ? "#000000" : "#ffffff";
};

// ===== CALENDAR GRID UTILITIES =====

/**
 * Builds a calendar grid for a given year (GitHub-contribution-style).
 * @param {Number} year - Full year (e.g. 2025)
 * @returns {Array} - [{ date: Date, week: Number, dayOfWeek: 0-6, month: 0-11 }, ...]
 */
export const buildCalendarGrid = (year) => {
  const grid = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  let weekNum = 0;
  let lastDayOfWeek = -1;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const dayOfWeek = date.getDay();

    if (dayOfWeek < lastDayOfWeek) {
      weekNum++;
    }
    lastDayOfWeek = dayOfWeek;

    grid.push({
      date: new Date(date),
      week: weekNum,
      dayOfWeek,
      month: date.getMonth()
    });
  }

  return grid;
};

// ===== DATE-RANGE UTILITIES =====

/**
 * Coerces a value into a valid Date, or null.
 * Accepts a Date instance, a parseable date string, or an
 * epoch-milliseconds number. Returns null for empty, invalid, or
 * non-date input.
 * @param {Date|String|Number} value - Value to coerce
 * @returns {Date|null} - A valid Date, or null
 */
export const parseDate = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    if (isNaN(value)) {
      return null;
    }
    const fromNumber = new Date(value);
    return isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (typeof value === "string") {
    if (value.trim() === "") {
      return null;
    }
    const fromString = new Date(value);
    return isNaN(fromString.getTime()) ? null : fromString;
  }

  return null;
};

/**
 * Computes the [min, max] Date extent across rows for a Gantt-style
 * time domain. The minimum is taken from parsed startField values and
 * the maximum from parsed endField values; unparseable values are
 * skipped per-field (a bad start does not discard a good end).
 * If only one pool has parseable dates, the missing bound falls back to
 * that pool so the result is always [min, max] with min <= max.
 * @param {Array} rows - Array of row objects
 * @param {String} startField - Field name holding the start value
 * @param {String} endField - Field name holding the end value
 * @returns {Array|null} - [minDate, maxDate], or null when nothing parses
 */
export const computeDateExtent = (rows, startField, endField) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const starts = [];
  const ends = [];

  rows.forEach((row) => {
    const start = parseDate(row[startField]);
    if (start) {
      starts.push(start.getTime());
    }
    const end = parseDate(row[endField]);
    if (end) {
      ends.push(end.getTime());
    }
  });

  if (starts.length === 0 && ends.length === 0) {
    return null;
  }

  // Fall back to the other pool when one side has no parseable dates,
  // guaranteeing a [min, max] pair with min <= max.
  const minPool = starts.length > 0 ? starts : ends;
  const maxPool = ends.length > 0 ? ends : starts;

  const minTime = Math.min(...minPool);
  const maxTime = Math.max(...maxPool);

  return [new Date(minTime), new Date(maxTime)];
};

// ===== ACCESSIBILITY UTILITIES =====

/**
 * Applies SVG accessibility attributes and child nodes to a chart's root svg.
 * Sets role="img" + aria-label, and prepends <title>/<desc> nodes so the final
 * child order is <title>, <desc>. Dependency-free: operates only on the passed
 * d3 selection (no chart-specific knowledge).
 * @param {Object} svgSelection - d3 selection of the root svg
 * @param {Object} options - { title: String, desc: String }
 * @returns {void}
 */
export const applySvgA11y = (svgSelection, { title, desc } = {}) => {
  if (!svgSelection) return;

  svgSelection.attr("role", "img");
  if (title) {
    svgSelection.attr("aria-label", title);
  }

  // Insert <desc> first, then <title>, so the final child order is
  // <title>, <desc> (each insert goes before the current first child).
  if (desc) {
    svgSelection.insert("desc", ":first-child").text(desc);
  }
  if (title) {
    svgSelection.insert("title", ":first-child").text(title);
  }
};
