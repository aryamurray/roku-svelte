import { describe, it, expect } from "vitest";
import { resolveConfig, defineConfig, CONFIG_DEFAULTS } from "../src/index.js";

describe("defineConfig", () => {
  it("returns the config as-is (identity with type narrowing)", () => {
    const cfg = { title: "My App" };
    expect(defineConfig(cfg)).toBe(cfg);
  });
});

describe("resolveConfig", () => {
  it("fills all defaults when given empty config", () => {
    const resolved = resolveConfig({}, "/project");
    expect(resolved.title).toBe(CONFIG_DEFAULTS.title);
    expect(resolved.resolution).toBe("1080p");
    expect(resolved.uiResolutions).toBe("fhd");
    expect(resolved.strict).toBe(false);
    expect(resolved.roku).toBeUndefined();
    expect(resolved.root).toBe("/project");
  });

  it("resolves entry and outDir to absolute paths", () => {
    const resolved = resolveConfig({ entry: "src/App.svelte", outDir: "build" }, "/project");
    expect(resolved.entry).toContain("App.svelte");
    expect(resolved.outDir).toContain("build");
    // Paths should be absolute
    expect(resolved.entry.startsWith("/") || resolved.entry.match(/^[A-Z]:\\/)).toBeTruthy();
    expect(resolved.outDir.startsWith("/") || resolved.outDir.match(/^[A-Z]:\\/)).toBeTruthy();
  });

  it("derives uiResolutions from resolution", () => {
    expect(resolveConfig({ resolution: "1080p" }, "/p").uiResolutions).toBe("fhd");
    expect(resolveConfig({ resolution: "720p" }, "/p").uiResolutions).toBe("hd");
  });

  it("preserves roku device config", () => {
    const resolved = resolveConfig({
      roku: { host: "192.168.1.100", password: "rokudev" },
    }, "/project");
    expect(resolved.roku).toEqual({ host: "192.168.1.100", password: "rokudev" });
  });

  it("uses custom title and strict mode", () => {
    const resolved = resolveConfig({ title: "Custom", strict: true }, "/p");
    expect(resolved.title).toBe("Custom");
    expect(resolved.strict).toBe(true);
  });
});
