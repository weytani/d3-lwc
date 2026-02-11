// ABOUTME: Integration tests for the dataService module's data processing pipeline.
// ABOUTME: Verifies that validation, truncation, and aggregation functions compose correctly.

import {
  prepareData,
  aggregateData,
  MAX_RECORDS,
  OPERATIONS
} from "c/dataService";

// ═══════════════════════════════════════════════════════════════════════
// Test Data Helpers
// ═══════════════════════════════════════════════════════════════════════

function generateRecords(count, groups = ["A", "B", "C"]) {
  return Array.from({ length: count }, (_, i) => ({
    Category: groups[i % groups.length],
    Value: (i + 1) * 10
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// Integration Tests
// ═══════════════════════════════════════════════════════════════════════

describe("dataService integration", () => {
  // ═══════════════════════════════════════════════════════════════════
  // Full prepareData Pipeline
  // ═══════════════════════════════════════════════════════════════════

  describe("full prepareData pipeline", () => {
    it("validates, checks fields, and truncates in one call", () => {
      const largeDataset = Array.from({ length: 2500 }, (_, i) => ({
        StageName: `Stage_${i % 5}`,
        Amount: (i + 1) * 100
      }));

      const result = prepareData(largeDataset, {
        requiredFields: ["StageName", "Amount"]
      });

      expect(result.valid).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.originalCount).toBe(2500);
      expect(result.data).toHaveLength(MAX_RECORDS);
    });

    it("rejects data with missing required fields", () => {
      const incompleteData = [
        { StageName: "Prospecting" },
        { StageName: "Closed Won" }
      ];

      const result = prepareData(incompleteData, {
        requiredFields: ["StageName", "Amount"]
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Missing required fields");
      expect(result.error).toContain("Amount");
    });

    it("passes valid data under 2000 without truncation", () => {
      const smallDataset = Array.from({ length: 100 }, (_, i) => ({
        Category: `Cat_${i % 3}`,
        Value: i * 10
      }));

      const result = prepareData(smallDataset, {
        requiredFields: ["Category", "Value"]
      });

      expect(result.valid).toBe(true);
      expect(result.truncated).toBe(false);
      expect(result.data).toHaveLength(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // prepareData -> aggregateData Pipeline
  // ═══════════════════════════════════════════════════════════════════

  describe("prepareData -> aggregateData pipeline", () => {
    it("full pipeline with Sum aggregation on 100+ records", () => {
      const groups = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
      const records = generateRecords(150, groups);

      // 150 records, 30 per group (evenly distributed by modulo)
      // Alpha gets indices 0,5,10,...,145 -> values 10,60,110,160,...,1460
      // Beta  gets indices 1,6,11,...,146 -> values 20,70,120,170,...,1470
      // etc.
      // Each group has 30 records. Group at offset g gets indices g, g+5, g+10, ..., g+145
      // Values: (g+1)*10, (g+6)*10, (g+11)*10, ..., (g+146)*10
      // Sum for group g: 10 * sum_{k=0}^{29} (g + 1 + 5k) = 10 * (30*(g+1) + 5*(29*30/2))
      //                = 10 * (30*(g+1) + 2175) = 10 * (30g + 30 + 2175) = 10 * (30g + 2205)
      //                = 300g + 22050

      const expectedSums = {
        Alpha: 300 * 0 + 22050, // 22050
        Beta: 300 * 1 + 22050, // 22350
        Gamma: 300 * 2 + 22050, // 22650
        Delta: 300 * 3 + 22050, // 22950
        Epsilon: 300 * 4 + 22050 // 23250
      };

      const prepared = prepareData(records, {
        requiredFields: ["Category", "Value"]
      });
      expect(prepared.valid).toBe(true);

      const aggregated = aggregateData(
        prepared.data,
        "Category",
        "Value",
        OPERATIONS.SUM
      );

      expect(aggregated).toHaveLength(5);

      // Verify each group has the correct sum
      aggregated.forEach((group) => {
        expect(group.value).toBe(expectedSums[group.label]);
      });

      // Verify descending sort order
      for (let i = 1; i < aggregated.length; i++) {
        expect(aggregated[i - 1].value).toBeGreaterThanOrEqual(
          aggregated[i].value
        );
      }

      // Epsilon should be first (highest sum)
      expect(aggregated[0].label).toBe("Epsilon");
      expect(aggregated[0].value).toBe(23250);
    });

    it("full pipeline with Count aggregation", () => {
      const testData = [
        { Category: "A", Value: 100 },
        { Category: "A", Value: 200 },
        { Category: "B", Value: 300 },
        { Category: "B", Value: 150 },
        { Category: "B", Value: 50 },
        { Category: "C", Value: 400 }
      ];

      const prepared = prepareData(testData, {
        requiredFields: ["Category", "Value"]
      });
      expect(prepared.valid).toBe(true);

      const aggregated = aggregateData(
        prepared.data,
        "Category",
        "Value",
        OPERATIONS.COUNT
      );

      expect(aggregated).toHaveLength(3);

      // B=3, A=2, C=1 sorted descending by count
      expect(aggregated[0]).toEqual({ label: "B", value: 3 });
      expect(aggregated[1]).toEqual({ label: "A", value: 2 });
      expect(aggregated[2]).toEqual({ label: "C", value: 1 });
    });

    it("full pipeline handles null values in aggregation", () => {
      const nullData = [
        { Category: "X", Value: 100 },
        { Category: "X", Value: null },
        { Category: "Y", Value: 200 },
        { Category: "Y", Value: 300 }
      ];

      const prepared = prepareData(nullData, {
        requiredFields: ["Category", "Value"]
      });
      expect(prepared.valid).toBe(true);

      const aggregated = aggregateData(
        prepared.data,
        "Category",
        "Value",
        OPERATIONS.SUM
      );

      expect(aggregated).toHaveLength(2);

      // Y sum = 200 + 300 = 500, X sum = 100 + 0 (null treated as 0) = 100
      // Sorted descending: Y=500, X=100
      expect(aggregated[0]).toEqual({ label: "Y", value: 500 });
      expect(aggregated[1]).toEqual({ label: "X", value: 100 });
    });
  });
});
