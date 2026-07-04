import {
  PALETTES,
  THEMES,
  DEFAULT_THEME,
  getColors,
  createColorScale,
  getColor,
  SEMANTIC_COLORS,
  getSequentialRamp,
  getRampHueForTheme,
  getSemanticVariantForTheme
} from "c/themeService";

describe("themeService", () => {
  describe("PALETTES", () => {
    it("has Salesforce Standard palette", () => {
      expect(PALETTES["Salesforce Standard"]).toBeDefined();
      expect(PALETTES["Salesforce Standard"]).toHaveLength(10);
    });

    it("has Warm palette", () => {
      expect(PALETTES.Warm).toBeDefined();
      expect(PALETTES.Warm.length).toBeGreaterThanOrEqual(5);
    });

    it("has Cool palette", () => {
      expect(PALETTES.Cool).toBeDefined();
    });

    it("has Vibrant palette", () => {
      expect(PALETTES.Vibrant).toBeDefined();
    });

    it("all palettes have valid hex colors", () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      Object.values(PALETTES).forEach((palette) => {
        palette.forEach((color) => {
          expect(color).toMatch(hexRegex);
        });
      });
    });
  });

  describe("THEMES", () => {
    it("lists all available themes", () => {
      expect(THEMES).toContain("Salesforce Standard");
      expect(THEMES).toContain("Warm");
      expect(THEMES).toContain("Cool");
      expect(THEMES).toContain("Vibrant");
    });

    it("has correct length", () => {
      expect(THEMES).toHaveLength(4);
    });
  });

  describe("DEFAULT_THEME", () => {
    it("is Salesforce Standard", () => {
      expect(DEFAULT_THEME).toBe("Salesforce Standard");
    });

    it("exists in PALETTES", () => {
      expect(PALETTES[DEFAULT_THEME]).toBeDefined();
    });
  });

  describe("getColors", () => {
    it("returns colors from specified theme", () => {
      const colors = getColors("Warm", 3);
      expect(colors).toHaveLength(3);
      expect(PALETTES.Warm).toContain(colors[0]);
    });

    it("falls back to default theme for unknown theme", () => {
      const colors = getColors("NonExistent", 3);
      expect(colors).toHaveLength(3);
      expect(PALETTES["Salesforce Standard"]).toContain(colors[0]);
    });

    it("returns exact count of colors", () => {
      expect(getColors("Cool", 5)).toHaveLength(5);
      expect(getColors("Cool", 1)).toHaveLength(1);
    });

    it("cycles colors when count exceeds palette size", () => {
      const palette = PALETTES["Salesforce Standard"];
      const colors = getColors("Salesforce Standard", 15);
      expect(colors).toHaveLength(15);
      // 11th color should cycle back to 1st
      expect(colors[10]).toBe(palette[0]);
    });

    it("uses custom colors when provided", () => {
      const custom = ["#FF0000", "#00FF00", "#0000FF"];
      const colors = getColors("Warm", 3, custom);
      expect(colors).toEqual(custom);
    });

    it("extends custom colors if count exceeds custom array", () => {
      const custom = ["#FF0000", "#00FF00"];
      const colors = getColors("Warm", 4, custom);
      expect(colors).toHaveLength(4);
      expect(colors[2]).toBe("#FF0000"); // Cycles
    });

    it("returns empty array for count <= 0", () => {
      expect(getColors("Warm", 0)).toEqual([]);
      expect(getColors("Warm", -1)).toEqual([]);
    });

    it("ignores empty custom colors array", () => {
      const colors = getColors("Warm", 3, []);
      expect(PALETTES.Warm).toContain(colors[0]);
    });

    it("ignores non-array custom colors", () => {
      const colors = getColors("Warm", 3, "not an array");
      expect(PALETTES.Warm).toContain(colors[0]);
    });
  });

  describe("createColorScale", () => {
    it("returns a function", () => {
      const scale = createColorScale("Warm", ["A", "B", "C"]);
      expect(typeof scale).toBe("function");
    });

    it("maps domain values to colors", () => {
      const domain = ["Alpha", "Beta", "Gamma"];
      const scale = createColorScale("Salesforce Standard", domain);

      const colors = domain.map((d) => scale(d));
      expect(colors).toHaveLength(3);
      // Each should be unique (within same palette)
      expect(new Set(colors).size).toBe(3);
    });

    it("returns first color for unknown domain value", () => {
      const scale = createColorScale("Warm", ["A", "B"]);
      const unknownColor = scale("Unknown");
      const firstColor = scale("A");
      expect(unknownColor).toBe(firstColor);
    });

    it("uses custom colors when provided", () => {
      const custom = ["#111", "#222", "#333"];
      const scale = createColorScale("Warm", ["A", "B", "C"], custom);
      expect(scale("A")).toBe("#111");
      expect(scale("B")).toBe("#222");
    });
  });

  describe("getColor", () => {
    it("returns single color by index", () => {
      const color = getColor("Salesforce Standard", 0);
      expect(color).toBe(PALETTES["Salesforce Standard"][0]);
    });

    it("returns correct color for higher index", () => {
      const color = getColor("Salesforce Standard", 5);
      expect(color).toBe(PALETTES["Salesforce Standard"][5]);
    });

    it("defaults to index 0", () => {
      const color = getColor("Salesforce Standard");
      expect(color).toBe(PALETTES["Salesforce Standard"][0]);
    });

    it("uses custom colors when provided", () => {
      const custom = ["#ABC", "#DEF"];
      const color = getColor("Warm", 1, custom);
      expect(color).toBe("#DEF");
    });
  });

  describe("SEMANTIC_COLORS", () => {
    it("exports positive color", () => {
      expect(SEMANTIC_COLORS.positive).toBe("#4BCA81");
    });
    it("exports negative color", () => {
      expect(SEMANTIC_COLORS.negative).toBe("#FF5D5D");
    });
    it("exports neutral color", () => {
      expect(SEMANTIC_COLORS.neutral).toBeDefined();
    });
    it("exports subtotal color", () => {
      expect(SEMANTIC_COLORS.subtotal).toBeDefined();
    });
  });

  describe("getSequentialRamp", () => {
    it("returns array of requested length", () => {
      const ramp = getSequentialRamp("blue", 5);
      expect(ramp).toHaveLength(5);
    });

    it("returns valid hex colors", () => {
      const ramp = getSequentialRamp("blue", 3);
      ramp.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it("goes from light to dark", () => {
      const ramp = getSequentialRamp("blue", 5);
      const hexToSum = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return r + g + b;
      };
      expect(hexToSum(ramp[0])).toBeGreaterThan(
        hexToSum(ramp[ramp.length - 1])
      );
    });

    it("supports blue ramp", () => {
      expect(getSequentialRamp("blue", 3)).toHaveLength(3);
    });

    it("supports green ramp", () => {
      expect(getSequentialRamp("green", 3)).toHaveLength(3);
    });

    it("supports red ramp", () => {
      expect(getSequentialRamp("red", 3)).toHaveLength(3);
    });

    it("falls back to blue for unknown ramp", () => {
      expect(getSequentialRamp("unknown", 3)).toHaveLength(3);
    });

    it("handles 1-step ramp", () => {
      expect(getSequentialRamp("blue", 1)).toHaveLength(1);
    });
  });

  describe("getRampHueForTheme", () => {
    it("maps each of the 4 palette names to a getSequentialRamp hue", () => {
      expect(getRampHueForTheme("Salesforce Standard")).toBe("blue");
      expect(getRampHueForTheme("Warm")).toBe("red");
      expect(getRampHueForTheme("Cool")).toBe("blue");
      expect(getRampHueForTheme("Vibrant")).toBe("green");
    });

    it("returns a hue getSequentialRamp accepts (yields the requested step count)", () => {
      const hue = getRampHueForTheme("Warm");
      expect(getSequentialRamp(hue, 4)).toHaveLength(4);
    });

    it("falls back to the default blue hue for unknown/undefined theme", () => {
      expect(getRampHueForTheme(undefined)).toBe("blue");
      expect(getRampHueForTheme("NonExistent")).toBe("blue");
    });
  });

  describe("getSemanticVariantForTheme", () => {
    it("returns the SEMANTIC_COLORS positive/negative pair for the default theme (byte-for-byte)", () => {
      expect(getSemanticVariantForTheme("Salesforce Standard")).toEqual({
        positive: SEMANTIC_COLORS.positive,
        negative: SEMANTIC_COLORS.negative
      });
      expect(getSemanticVariantForTheme("Salesforce Standard")).toEqual({
        positive: "#4BCA81",
        negative: "#FF5D5D"
      });
    });

    it("returns a valid positive/negative hex pair per palette", () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      ["Warm", "Cool", "Vibrant"].forEach((theme) => {
        const variant = getSemanticVariantForTheme(theme);
        expect(variant.positive).toMatch(hexRegex);
        expect(variant.negative).toMatch(hexRegex);
        expect(variant.positive).not.toBe(variant.negative);
      });
    });

    it("falls back to the default theme pair for unknown/undefined theme", () => {
      expect(getSemanticVariantForTheme(undefined)).toEqual({
        positive: SEMANTIC_COLORS.positive,
        negative: SEMANTIC_COLORS.negative
      });
      expect(getSemanticVariantForTheme("NonExistent")).toEqual(
        getSemanticVariantForTheme("Salesforce Standard")
      );
    });
  });
});
