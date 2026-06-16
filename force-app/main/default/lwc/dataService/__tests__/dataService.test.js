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
  buildMatrix,
  buildHierarchy,
  sampleData,
  MAX_RECORDS,
  CHART_LIMITS,
  SVG_ELEMENT_CAP,
  OPERATIONS
} from "c/dataService";

describe("dataService", () => {
  describe("validateData", () => {
    it("returns invalid for null data", () => {
      const result = validateData(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("returns invalid for undefined data", () => {
      const result = validateData(undefined);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("returns invalid for non-array data", () => {
      const result = validateData({ foo: "bar" });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("array");
    });

    it("returns invalid for empty array", () => {
      const result = validateData([]);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("returns valid for non-empty array", () => {
      const result = validateData([{ id: 1 }]);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe("validateFields", () => {
    const testData = [{ Name: "Test", Amount: 100 }];

    it("returns valid when no required fields", () => {
      const result = validateFields(testData, []);
      expect(result.isValid).toBe(true);
    });

    it("returns valid when required fields is null", () => {
      const result = validateFields(testData, null);
      expect(result.isValid).toBe(true);
    });

    it("returns valid when all fields present", () => {
      const result = validateFields(testData, ["Name", "Amount"]);
      expect(result.isValid).toBe(true);
    });

    it("returns invalid with missing fields listed", () => {
      const result = validateFields(testData, ["Name", "Missing"]);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain("Missing");
      expect(result.error).toContain("Missing");
    });

    it("returns all missing fields", () => {
      const result = validateFields(testData, ["Field1", "Field2"]);
      expect(result.missingFields).toHaveLength(2);
    });
  });

  describe("truncateData", () => {
    it("returns data unchanged when under limit", () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = truncateData(data, 10);
      expect(result.data).toHaveLength(2);
      expect(result.truncated).toBe(false);
    });

    it("truncates data when over limit", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const result = truncateData(data, 50);
      expect(result.data).toHaveLength(50);
      expect(result.truncated).toBe(true);
      expect(result.originalCount).toBe(100);
    });

    it("uses MAX_RECORDS as default limit", () => {
      const data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      const result = truncateData(data);
      expect(result.truncated).toBe(false);
    });

    it("handles exact limit match", () => {
      const data = Array.from({ length: 50 }, (_, i) => ({ id: i }));
      const result = truncateData(data, 50);
      expect(result.data).toHaveLength(50);
      expect(result.truncated).toBe(false);
    });
  });

  describe("prepareData", () => {
    it("returns invalid for bad data", () => {
      const result = prepareData(null);
      expect(result.valid).toBe(false);
    });

    it("returns invalid for missing required fields", () => {
      const result = prepareData([{ Name: "Test" }], {
        requiredFields: ["Amount"]
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Amount");
    });

    it("returns valid prepared data", () => {
      const data = [{ Name: "Test", Amount: 100 }];
      const result = prepareData(data, { requiredFields: ["Name"] });
      expect(result.valid).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("indicates when data was truncated", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const result = prepareData(data, { limit: 50 });
      expect(result.truncated).toBe(true);
      expect(result.data).toHaveLength(50);
      expect(result.originalCount).toBe(100);
    });

    it("uses default options when none provided", () => {
      const data = [{ id: 1 }];
      const result = prepareData(data);
      expect(result.valid).toBe(true);
    });
  });

  describe("aggregateData", () => {
    const testData = [
      { StageName: "Prospecting", Amount: 100 },
      { StageName: "Prospecting", Amount: 200 },
      { StageName: "Closed Won", Amount: 500 },
      { StageName: "Closed Won", Amount: 300 },
      { StageName: "Closed Won", Amount: 200 }
    ];

    it("returns empty array for null data", () => {
      expect(aggregateData(null, "StageName", "Amount", "Sum")).toEqual([]);
    });

    it("returns empty array for missing groupByField", () => {
      expect(aggregateData(testData, null, "Amount", "Sum")).toEqual([]);
    });

    describe("Sum operation", () => {
      it("sums values by group", () => {
        const result = aggregateData(
          testData,
          "StageName",
          "Amount",
          OPERATIONS.SUM
        );
        expect(result).toHaveLength(2);

        const closedWon = result.find((r) => r.label === "Closed Won");
        expect(closedWon.value).toBe(1000); // 500 + 300 + 200

        const prospecting = result.find((r) => r.label === "Prospecting");
        expect(prospecting.value).toBe(300); // 100 + 200
      });
    });

    describe("Count operation", () => {
      it("counts records by group", () => {
        const result = aggregateData(
          testData,
          "StageName",
          "Amount",
          OPERATIONS.COUNT
        );

        const closedWon = result.find((r) => r.label === "Closed Won");
        expect(closedWon.value).toBe(3);

        const prospecting = result.find((r) => r.label === "Prospecting");
        expect(prospecting.value).toBe(2);
      });

      it("works without valueField", () => {
        const result = aggregateData(
          testData,
          "StageName",
          null,
          OPERATIONS.COUNT
        );
        expect(result.find((r) => r.label === "Closed Won").value).toBe(3);
      });
    });

    describe("Average operation", () => {
      it("averages values by group", () => {
        const result = aggregateData(
          testData,
          "StageName",
          "Amount",
          OPERATIONS.AVERAGE
        );

        const closedWon = result.find((r) => r.label === "Closed Won");
        expect(closedWon.value).toBeCloseTo(333.33, 1); // 1000 / 3

        const prospecting = result.find((r) => r.label === "Prospecting");
        expect(prospecting.value).toBe(150); // 300 / 2
      });
    });

    it("handles null values in groupByField", () => {
      const dataWithNull = [...testData, { StageName: null, Amount: 50 }];
      const result = aggregateData(
        dataWithNull,
        "StageName",
        "Amount",
        OPERATIONS.SUM
      );

      const nullGroup = result.find((r) => r.label === "Null");
      expect(nullGroup).toBeDefined();
      expect(nullGroup.value).toBe(50);
    });

    it("sorts results by value descending", () => {
      const result = aggregateData(
        testData,
        "StageName",
        "Amount",
        OPERATIONS.SUM
      );
      expect(result[0].label).toBe("Closed Won"); // 1000 > 300
      expect(result[1].label).toBe("Prospecting");
    });

    it("handles non-numeric values gracefully", () => {
      const badData = [
        { Stage: "A", Amount: "not a number" },
        { Stage: "A", Amount: 100 }
      ];
      const result = aggregateData(badData, "Stage", "Amount", OPERATIONS.SUM);
      expect(result[0].value).toBe(100); // NaN treated as 0
    });

    it("uses count as default for unknown operation", () => {
      const result = aggregateData(testData, "StageName", "Amount", "Unknown");
      expect(result.find((r) => r.label === "Closed Won").value).toBe(3);
    });
  });

  describe("MAX_RECORDS", () => {
    it("is set to 2000", () => {
      expect(MAX_RECORDS).toBe(2000);
    });
  });

  describe("CHART_LIMITS", () => {
    it("defines limits for all chart types", () => {
      expect(CHART_LIMITS).toBeDefined();
      expect(Object.keys(CHART_LIMITS)).toHaveLength(30);
    });

    it("has null limits for aggregation charts (server GROUP BY)", () => {
      expect(CHART_LIMITS.BAR).toBeNull();
      expect(CHART_LIMITS.DONUT).toBeNull();
      expect(CHART_LIMITS.TREEMAP).toBeNull();
    });

    it("has numeric limits for non-aggregation charts", () => {
      expect(CHART_LIMITS.HISTOGRAM).toBe(10000);
      expect(CHART_LIMITS.SCATTER).toBe(5000);
      expect(CHART_LIMITS.LINE).toBe(1000);
      expect(CHART_LIMITS.FORCE_GRAPH).toBe(500);
      expect(CHART_LIMITS.GAUGE).toBe(1);
      expect(CHART_LIMITS.CHOROPLETH).toBe(500);
      expect(CHART_LIMITS.SANKEY).toBe(1000);
    });
  });

  describe("CHART_LIMITS for Phase 2 charts", () => {
    it("exports FUNNEL limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.FUNNEL).toBeNull();
    });
    it("exports STACKED_BAR limit as null", () => {
      expect(CHART_LIMITS.STACKED_BAR).toBeNull();
    });
    it("exports AREA limit as 1000", () => {
      expect(CHART_LIMITS.AREA).toBe(1000);
    });
    it("exports BULLET limit as 1", () => {
      expect(CHART_LIMITS.BULLET).toBe(1);
    });
    it("exports HEATMAP limit as null", () => {
      expect(CHART_LIMITS.HEATMAP).toBeNull();
    });
    it("exports BOX_PLOT limit as 5000", () => {
      expect(CHART_LIMITS.BOX_PLOT).toBe(5000);
    });
    it("exports RADAR limit as null", () => {
      expect(CHART_LIMITS.RADAR).toBeNull();
    });
    it("exports WATERFALL limit as 500", () => {
      expect(CHART_LIMITS.WATERFALL).toBe(500);
    });
    it("exports CALENDAR_HEATMAP limit as 2000", () => {
      expect(CHART_LIMITS.CALENDAR_HEATMAP).toBe(2000);
    });
    it("exports SPARKLINE_GRID limit as 5000", () => {
      expect(CHART_LIMITS.SPARKLINE_GRID).toBe(5000);
    });
  });

  describe("CHART_LIMITS for Phase 3 charts", () => {
    it("exports SUNBURST limit as 2000 (raw hierarchy rows)", () => {
      expect(CHART_LIMITS.SUNBURST).toBe(2000);
    });
    it("exports CHORD limit as 2000 (raw edge rows)", () => {
      expect(CHART_LIMITS.CHORD).toBe(2000);
    });
    it("exports GANTT limit as 2000 (raw date-range rows)", () => {
      expect(CHART_LIMITS.GANTT).toBe(2000);
    });
    it("exports BUBBLE limit as 5000 (raw xy rows, SVG cap separate)", () => {
      expect(CHART_LIMITS.BUBBLE).toBe(5000);
    });
    it("exports DIVERGING_BAR limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.DIVERGING_BAR).toBeNull();
    });
    it("exports WAFFLE limit as null (server GROUP BY Count)", () => {
      expect(CHART_LIMITS.WAFFLE).toBeNull();
    });
    it("exports HORIZONTAL_BAR limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.HORIZONTAL_BAR).toBeNull();
    });
    it("exports PIE limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.PIE).toBeNull();
    });
    it("exports PROGRESS_BAR limit as null (server GROUP BY, single row)", () => {
      expect(CHART_LIMITS.PROGRESS_BAR).toBeNull();
    });
    it("exports LOLLIPOP limit as null (server GROUP BY)", () => {
      expect(CHART_LIMITS.LOLLIPOP).toBeNull();
    });
  });

  describe("OPERATIONS", () => {
    it("has Sum, Count, Average", () => {
      expect(OPERATIONS.SUM).toBe("Sum");
      expect(OPERATIONS.COUNT).toBe("Count");
      expect(OPERATIONS.AVERAGE).toBe("Average");
    });
  });

  describe("SVG_ELEMENT_CAP", () => {
    it("is set to 500", () => {
      expect(SVG_ELEMENT_CAP).toBe(500);
    });
  });

  describe("sampleData", () => {
    it("returns data unchanged when below limit", () => {
      const data = [{ x: 1 }, { x: 2 }, { x: 3 }];
      const result = sampleData(data, "x", 500);
      expect(result.sampled).toBe(false);
      expect(result.data).toEqual(data);
      expect(result.originalCount).toBe(3);
    });

    it("samples data when above limit", () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i * 2 }));
      const result = sampleData(data, "x", 500);
      expect(result.sampled).toBe(true);
      expect(result.data.length).toBe(500);
      expect(result.originalCount).toBe(1000);
    });

    it("preserves first and last points (extent)", () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i * 2 }));
      const result = sampleData(data, "x", 100);
      expect(result.data[0].x).toBe(0);
      expect(result.data[result.data.length - 1].x).toBe(999);
    });

    it("handles null/undefined data", () => {
      expect(sampleData(null, "x").data).toEqual([]);
      expect(sampleData(undefined, "x").data).toEqual([]);
      expect(sampleData(null, "x").sampled).toBe(false);
    });

    it("handles empty array", () => {
      const result = sampleData([], "x");
      expect(result.data).toEqual([]);
      expect(result.sampled).toBe(false);
    });

    it("handles data exactly at limit", () => {
      const data = Array.from({ length: 500 }, (_, i) => ({ x: i }));
      const result = sampleData(data, "x", 500);
      expect(result.sampled).toBe(false);
      expect(result.data.length).toBe(500);
    });

    it("produces evenly distributed samples", () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ x: i }));
      const result = sampleData(data, "x", 10);
      // Samples should be roughly evenly spaced
      const xs = result.data.map((d) => d.x);
      // First and last
      expect(xs[0]).toBe(0);
      expect(xs[xs.length - 1]).toBe(99);
      // Check spacing is roughly uniform (within 1 of expected)
      const expectedStep = 99 / 9;
      for (let i = 1; i < xs.length - 1; i++) {
        expect(
          Math.abs(xs[i] - Math.round(i * expectedStep))
        ).toBeLessThanOrEqual(1);
      }
    });

    it("uses SVG_ELEMENT_CAP as default limit", () => {
      const data = Array.from({ length: 600 }, (_, i) => ({ x: i }));
      const result = sampleData(data, "x");
      expect(result.sampled).toBe(true);
      expect(result.data.length).toBe(500); // SVG_ELEMENT_CAP
    });

    it("sorts by sortField before sampling", () => {
      // Unsorted input
      const data = [
        { x: 100 },
        { x: 1 },
        { x: 50 },
        { x: 75 },
        { x: 25 },
        { x: 90 },
        { x: 10 },
        { x: 60 },
        { x: 40 },
        { x: 80 },
        { x: 5 }
      ];
      const result = sampleData(data, "x", 5);
      // Should be sorted by x
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].x).toBeGreaterThanOrEqual(result.data[i - 1].x);
      }
    });
  });

  describe("aggregateSeriesData", () => {
    const SERIES_DATA = [
      { StageName: "Prospecting", Type: "New Business", Amount: 100 },
      { StageName: "Prospecting", Type: "Existing Business", Amount: 200 },
      { StageName: "Qualification", Type: "New Business", Amount: 150 },
      { StageName: "Qualification", Type: "Existing Business", Amount: 300 },
      { StageName: "Closed Won", Type: "New Business", Amount: 500 }
    ];

    it("groups by two dimensions with Sum", () => {
      const result = aggregateSeriesData(
        SERIES_DATA,
        "StageName",
        "Type",
        "Amount",
        "Sum"
      );
      expect(result.length).toBe(5);
      const prospectingNew = result.find(
        (r) => r.label === "Prospecting" && r.series === "New Business"
      );
      expect(prospectingNew.value).toBe(100);
    });

    it("returns all unique series names", () => {
      const result = aggregateSeriesData(
        SERIES_DATA,
        "StageName",
        "Type",
        "Amount",
        "Sum"
      );
      const seriesNames = [...new Set(result.map((r) => r.series))];
      expect(seriesNames).toContain("New Business");
      expect(seriesNames).toContain("Existing Business");
    });

    it("handles Count operation", () => {
      const result = aggregateSeriesData(
        SERIES_DATA,
        "StageName",
        "Type",
        "Amount",
        "Count"
      );
      const prospectingNew = result.find(
        (r) => r.label === "Prospecting" && r.series === "New Business"
      );
      expect(prospectingNew.value).toBe(1);
    });

    it("handles Average operation", () => {
      const dupes = [
        { StageName: "A", Type: "X", Amount: 100 },
        { StageName: "A", Type: "X", Amount: 200 }
      ];
      const result = aggregateSeriesData(
        dupes,
        "StageName",
        "Type",
        "Amount",
        "Average"
      );
      expect(result[0].value).toBe(150);
    });

    it("returns empty array for null data", () => {
      expect(aggregateSeriesData(null, "a", "b", "c", "Sum")).toEqual([]);
    });

    it("returns empty array when seriesField is missing", () => {
      expect(
        aggregateSeriesData(SERIES_DATA, "StageName", "", "Amount", "Sum")
      ).toEqual([]);
    });

    it('handles null series values as "Null" label', () => {
      const withNull = [{ StageName: "A", Type: null, Amount: 100 }];
      const result = aggregateSeriesData(
        withNull,
        "StageName",
        "Type",
        "Amount",
        "Sum"
      );
      expect(result[0].series).toBe("Null");
    });
  });

  describe("computeQuartiles", () => {
    it("computes quartiles for odd-count dataset", () => {
      const data = [
        { val: 2 },
        { val: 4 },
        { val: 6 },
        { val: 8 },
        { val: 10 },
        { val: 12 },
        { val: 14 },
        { val: 16 },
        { val: 18 }
      ];
      const result = computeQuartiles(data, "val");
      expect(result.q2).toBe(10);
      expect(result.q1).toBe(5);
      expect(result.q3).toBe(15);
    });

    it("computes IQR correctly", () => {
      const data = [
        { val: 1 },
        { val: 2 },
        { val: 3 },
        { val: 4 },
        { val: 100 }
      ];
      const result = computeQuartiles(data, "val");
      expect(result.iqr).toBe(result.q3 - result.q1);
    });

    it("identifies outliers beyond 1.5*IQR", () => {
      const data = [
        { val: 1 },
        { val: 2 },
        { val: 3 },
        { val: 4 },
        { val: 5 },
        { val: 6 },
        { val: 7 },
        { val: 8 },
        { val: 9 },
        { val: 100 }
      ];
      const result = computeQuartiles(data, "val");
      expect(result.outliers.length).toBeGreaterThan(0);
      expect(result.outliers).toContain(100);
    });

    it("sets whiskers at data extent within 1.5*IQR", () => {
      const data = [{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }, { val: 5 }];
      const result = computeQuartiles(data, "val");
      expect(result.whiskerLow).toBeGreaterThanOrEqual(1);
      expect(result.whiskerHigh).toBeLessThanOrEqual(5);
    });

    it("returns null for empty data", () => {
      expect(computeQuartiles([], "val")).toBeNull();
    });

    it("returns null for null data", () => {
      expect(computeQuartiles(null, "val")).toBeNull();
    });

    it("handles single value", () => {
      const result = computeQuartiles([{ val: 5 }], "val");
      expect(result.q1).toBe(5);
      expect(result.q2).toBe(5);
      expect(result.q3).toBe(5);
    });

    it("skips null values in field", () => {
      const data = [{ val: 1 }, { val: null }, { val: 3 }, { val: 5 }];
      const result = computeQuartiles(data, "val");
      expect(result).not.toBeNull();
    });
  });

  describe("computeRunningTotal", () => {
    it("computes cumulative sum", () => {
      const data = [
        { label: "A", value: 100 },
        { label: "B", value: -30 },
        { label: "C", value: 50 }
      ];
      const result = computeRunningTotal(data);
      expect(result[0].cumulative).toBe(100);
      expect(result[1].cumulative).toBe(70);
      expect(result[2].cumulative).toBe(120);
    });

    it("marks positive and negative deltas", () => {
      const data = [
        { label: "A", value: 100 },
        { label: "B", value: -30 }
      ];
      const result = computeRunningTotal(data);
      expect(result[0].isPositive).toBe(true);
      expect(result[1].isPositive).toBe(false);
    });

    it("sets start and end for waterfall bar positioning", () => {
      const data = [
        { label: "A", value: 100 },
        { label: "B", value: -30 }
      ];
      const result = computeRunningTotal(data);
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(100);
      expect(result[1].start).toBe(100);
      expect(result[1].end).toBe(70);
    });

    it("returns empty for null/empty input", () => {
      expect(computeRunningTotal(null)).toEqual([]);
      expect(computeRunningTotal([])).toEqual([]);
    });

    it("handles all negative values", () => {
      const data = [
        { label: "A", value: -10 },
        { label: "B", value: -20 }
      ];
      const result = computeRunningTotal(data);
      expect(result[0].cumulative).toBe(-10);
      expect(result[1].cumulative).toBe(-30);
    });
  });

  describe("buildMatrix", () => {
    it("builds a square matrix from a directed edge list", () => {
      const edges = [
        { src: "A", tgt: "B", val: 5 },
        { src: "A", tgt: "C", val: 3 },
        { src: "B", tgt: "C", val: 2 }
      ];
      const { matrix, labels } = buildMatrix(edges, "src", "tgt", "val");
      // Union in first-seen order: A (src e0), B (tgt e0), C (tgt e1)
      expect(labels).toEqual(["A", "B", "C"]);
      expect(matrix).toEqual([
        [0, 5, 3],
        [0, 0, 2],
        [0, 0, 0]
      ]);
    });

    it("sums duplicate source->target edges into one cell", () => {
      const edges = [
        { s: "X", t: "Y", v: 10 },
        { s: "X", t: "Y", v: 4 }
      ];
      const { matrix, labels } = buildMatrix(edges, "s", "t", "v");
      expect(labels).toEqual(["X", "Y"]);
      expect(matrix[0][1]).toBe(14);
    });

    it("collects the union of source and target labels", () => {
      const edges = [
        { s: "Prospecting", t: "Web", v: 1 },
        { s: "Closed Won", t: "Phone", v: 2 }
      ];
      const { labels } = buildMatrix(edges, "s", "t", "v");
      expect(labels).toEqual(["Prospecting", "Web", "Closed Won", "Phone"]);
      expect(labels).toHaveLength(4);
    });

    it("produces an NxN matrix where N equals label count", () => {
      const edges = [
        { s: "A", t: "B", v: 1 },
        { s: "C", t: "D", v: 1 }
      ];
      const { matrix, labels } = buildMatrix(edges, "s", "t", "v");
      expect(labels).toHaveLength(4);
      expect(matrix).toHaveLength(4);
      matrix.forEach((row) => expect(row).toHaveLength(4));
    });

    it("handles self-referencing edges on the diagonal", () => {
      const edges = [{ s: "A", t: "A", v: 7 }];
      const { matrix, labels } = buildMatrix(edges, "s", "t", "v");
      expect(labels).toEqual(["A"]);
      expect(matrix).toEqual([[7]]);
    });

    it("coerces non-numeric and null values to 0", () => {
      const edges = [
        { s: "A", t: "B", v: "oops" },
        { s: "A", t: "B", v: null },
        { s: "A", t: "B", v: 5 }
      ];
      const { matrix } = buildMatrix(edges, "s", "t", "v");
      expect(matrix[0][1]).toBe(5);
    });

    it("returns empty matrix and labels for empty edge list", () => {
      expect(buildMatrix([], "s", "t", "v")).toEqual({
        matrix: [],
        labels: []
      });
    });

    it("returns empty matrix and labels for null edges", () => {
      expect(buildMatrix(null, "s", "t", "v")).toEqual({
        matrix: [],
        labels: []
      });
    });

    it("consumes a getMultiGroupData edge list shape", () => {
      const edges = [
        { label: "Prospecting", series: "Web", value: 100 },
        { label: "Prospecting", series: "Phone", value: 50 },
        { label: "Closed Won", series: "Web", value: 200 }
      ];
      const { matrix, labels } = buildMatrix(edges, "label", "series", "value");
      expect(labels).toEqual(["Prospecting", "Web", "Phone", "Closed Won"]);
      const pIdx = labels.indexOf("Prospecting");
      const webIdx = labels.indexOf("Web");
      expect(matrix[pIdx][webIdx]).toBe(100);
    });
  });

  describe("buildHierarchy", () => {
    const ROWS = [
      { Region: "West", Stage: "Prospecting", Amount: 100 },
      { Region: "West", Stage: "Prospecting", Amount: 50 },
      { Region: "West", Stage: "Closed Won", Amount: 200 },
      { Region: "East", Stage: "Prospecting", Amount: 75 },
      { Region: "East", Stage: "Closed Won", Amount: 300 }
    ];

    it("wraps everything under a Root node", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Sum");
      expect(tree.name).toBe("Root");
      expect(Array.isArray(tree.children)).toBe(true);
    });

    it("builds a single-level hierarchy with Sum", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Sum");
      expect(tree.children).toHaveLength(2);
      const west = tree.children.find((c) => c.name === "West");
      const east = tree.children.find((c) => c.name === "East");
      expect(west.value).toBe(350); // 100 + 50 + 200
      expect(east.value).toBe(375); // 75 + 300
    });

    it("builds a two-level nested hierarchy with Sum", () => {
      const tree = buildHierarchy(ROWS, ["Region", "Stage"], "Amount", "Sum");
      const west = tree.children.find((c) => c.name === "West");
      expect(west.children).toHaveLength(2);
      const westProspecting = west.children.find(
        (c) => c.name === "Prospecting"
      );
      const westClosedWon = west.children.find((c) => c.name === "Closed Won");
      expect(westProspecting.value).toBe(150); // 100 + 50
      expect(westClosedWon.value).toBe(200);
      // Leaf nodes carry a value, not children.
      expect(westProspecting.children).toBeUndefined();
    });

    it("builds a three-level nested hierarchy", () => {
      const rows = [
        { L1: "a", L2: "x", L3: "p", v: 1 },
        { L1: "a", L2: "x", L3: "q", v: 2 },
        { L1: "a", L2: "y", L3: "p", v: 4 },
        { L1: "b", L2: "x", L3: "p", v: 8 }
      ];
      const tree = buildHierarchy(rows, ["L1", "L2", "L3"], "v", "Sum");
      const a = tree.children.find((c) => c.name === "a");
      const ax = a.children.find((c) => c.name === "x");
      const axp = ax.children.find((c) => c.name === "p");
      const axq = ax.children.find((c) => c.name === "q");
      expect(axp.value).toBe(1);
      expect(axq.value).toBe(2);
      const ay = a.children.find((c) => c.name === "y");
      expect(ay.children.find((c) => c.name === "p").value).toBe(4);
      const b = tree.children.find((c) => c.name === "b");
      expect(b.children[0].children[0].value).toBe(8);
    });

    it("aggregates leaves with Count", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Count");
      const west = tree.children.find((c) => c.name === "West");
      const east = tree.children.find((c) => c.name === "East");
      expect(west.value).toBe(3);
      expect(east.value).toBe(2);
    });

    it("aggregates leaves with Average", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Average");
      const west = tree.children.find((c) => c.name === "West");
      expect(west.value).toBe(350 / 3); // (100 + 50 + 200) / 3
    });

    it("falls back to Count for an unknown operation", () => {
      const tree = buildHierarchy(ROWS, ["Region"], "Amount", "Median");
      const west = tree.children.find((c) => c.name === "West");
      expect(west.value).toBe(3); // count, not sum
    });

    it("collapses null field values into a Null bucket", () => {
      const rows = [
        { Region: null, Amount: 10 },
        { Region: null, Amount: 20 }
      ];
      const tree = buildHierarchy(rows, ["Region"], "Amount", "Sum");
      const nullNode = tree.children.find((c) => c.name === "Null");
      expect(nullNode).toBeDefined();
      expect(nullNode.value).toBe(30);
    });

    it("coerces non-numeric values to 0 in the leaf sum", () => {
      const rows = [
        { Region: "A", Amount: "bad" },
        { Region: "A", Amount: 100 }
      ];
      const tree = buildHierarchy(rows, ["Region"], "Amount", "Sum");
      expect(tree.children[0].value).toBe(100); // NaN -> 0
    });

    it("returns an empty Root for null rows", () => {
      expect(buildHierarchy(null, ["Region"], "Amount", "Sum")).toEqual({
        name: "Root",
        children: []
      });
    });

    it("returns an empty Root for empty rows", () => {
      expect(buildHierarchy([], ["Region"], "Amount", "Sum")).toEqual({
        name: "Root",
        children: []
      });
    });

    it("returns an empty Root when fields list is empty", () => {
      expect(buildHierarchy(ROWS, [], "Amount", "Sum")).toEqual({
        name: "Root",
        children: []
      });
    });
  });
});
