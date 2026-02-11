import { loadD3, getD3, resetD3 } from "c/d3Lib";
import { loadScript } from "lightning/platformResourceLoader";

// Mock the static resource URL
jest.mock("@salesforce/resourceUrl/d3", () => ({ default: "/resource/d3" }), {
  virtual: true
});

describe("d3Lib", () => {
  beforeEach(() => {
    resetD3();
    jest.clearAllMocks();
    delete window.d3;
  });

  afterEach(() => {
    delete window.d3;
  });

  describe("loadD3", () => {
    it("returns existing window.d3 without calling loadScript", async () => {
      window.d3 = { version: "7.0.0-mock" };
      const mockComponent = {};
      const d3 = await loadD3(mockComponent);

      expect(d3.version).toBe("7.0.0-mock");
      expect(loadScript).not.toHaveBeenCalled();
    });

    it("calls loadScript with correct resource when window.d3 is absent", async () => {
      loadScript.mockImplementation(() => {
        window.d3 = { version: "7.0.0-mock" };
        return Promise.resolve();
      });
      const mockComponent = {};
      await loadD3(mockComponent);

      expect(loadScript).toHaveBeenCalledTimes(1);
      expect(loadScript).toHaveBeenCalledWith(mockComponent, "/resource/d3");
    });

    it("returns d3 instance after loading", async () => {
      loadScript.mockImplementation(() => {
        window.d3 = { version: "7.0.0-mock" };
        return Promise.resolve();
      });
      const mockComponent = {};
      const d3 = await loadD3(mockComponent);

      expect(d3).toBeDefined();
      expect(d3.version).toBe("7.0.0-mock");
    });

    it("returns cached instance on subsequent calls", async () => {
      loadScript.mockImplementation(() => {
        window.d3 = { version: "7.0.0-mock" };
        return Promise.resolve();
      });
      const mockComponent = {};

      const d3First = await loadD3(mockComponent);
      const d3Second = await loadD3(mockComponent);

      expect(loadScript).toHaveBeenCalledTimes(1); // Only called once
      expect(d3First).toBe(d3Second);
    });

    it("falls back to fetch+eval when loadScript fails", async () => {
      loadScript.mockRejectedValueOnce(new Error("CSP blocked"));
      // Mock fetch to return D3 source that sets window.d3
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: () => {
          window.d3 = { version: "7.0.0-fetched" };
          return Promise.resolve('window.d3 = { version: "7.0.0-fetched" }');
        }
      });
      const mockComponent = {};
      const d3 = await loadD3(mockComponent);

      expect(d3.version).toBe("7.0.0-fetched");
      delete global.fetch;
    });

    it("throws when loadScript and all fetch fallbacks fail", async () => {
      loadScript.mockRejectedValueOnce(new Error("Network error"));
      // Mock fetch to fail for all URLs
      global.fetch = jest.fn().mockRejectedValue(new Error("Fetch failed"));
      const mockComponent = {};

      await expect(loadD3(mockComponent)).rejects.toThrow(
        "Failed to load D3.js"
      );
      delete global.fetch;
    });
  });

  describe("getD3", () => {
    it("returns null before loading", () => {
      expect(getD3()).toBeNull();
    });

    it("returns d3 instance after loading", async () => {
      window.d3 = { version: "7.0.0-mock" };
      const mockComponent = {};
      await loadD3(mockComponent);

      expect(getD3()).toBeDefined();
      expect(getD3().version).toBe("7.0.0-mock");
    });
  });

  describe("resetD3", () => {
    it("clears cached instance", async () => {
      window.d3 = { version: "7.0.0-mock" };
      const mockComponent = {};
      await loadD3(mockComponent);

      expect(getD3()).toBeDefined();

      resetD3();

      expect(getD3()).toBeNull();
    });
  });
});
