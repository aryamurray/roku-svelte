import { describe, it, expect } from "vitest";
import { resolveConfig, defineConfig, CONFIG_DEFAULTS, RESOLUTION_MAP } from "../src/index.js";

describe("defineConfig", () => {
  it("returns the config as-is (identity with type narrowing)", () => {
    const cfg = { title: "My App" };
    expect(defineConfig(cfg)).toBe(cfg);
  });

  it("preserves all fields including nested roku", () => {
    const cfg = {
      title: "Test",
      entry: "src/Main.svelte",
      outDir: "out",
      resolution: "720p" as const,
      strict: true,
      roku: { host: "10.0.0.1", password: "dev" },
    };
    const result = defineConfig(cfg);
    expect(result).toBe(cfg);
    expect(result.roku).toEqual({ host: "10.0.0.1", password: "dev" });
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

  it("with no args uses process.cwd() default", () => {
    const resolved = resolveConfig();
    expect(resolved.root).toBe(process.cwd());
    expect(resolved.title).toBe(CONFIG_DEFAULTS.title);
  });

  it("with already-absolute entry path doesn't double-resolve", () => {
    // Use platform-native absolute path
    const absPath = process.platform === "win32"
      ? "C:\\absolute\\path\\to\\App.svelte"
      : "/absolute/path/to/App.svelte";
    const resolved = resolveConfig({ entry: absPath }, "/project");
    expect(resolved.entry).toBe(absPath);
  });

  it("with all fields provided — zero defaults used", () => {
    const resolved = resolveConfig(
      {
        entry: "custom/Entry.svelte",
        title: "Full Config",
        outDir: "output",
        resolution: "720p",
        strict: true,
        roku: { host: "10.0.0.1", password: "pass" },
      },
      "/root",
    );
    expect(resolved.title).toBe("Full Config");
    expect(resolved.resolution).toBe("720p");
    expect(resolved.uiResolutions).toBe("hd");
    expect(resolved.strict).toBe(true);
    expect(resolved.roku).toEqual({ host: "10.0.0.1", password: "pass" });
    expect(resolved.entry).toContain("Entry.svelte");
    expect(resolved.outDir).toContain("output");
  });
});

describe("CONFIG_DEFAULTS", () => {
  it("has all expected fields with correct values", () => {
    expect(CONFIG_DEFAULTS.entry).toBe("src/HomeScreen.svelte");
    expect(CONFIG_DEFAULTS.title).toBe("SvelteRoku App");
    expect(CONFIG_DEFAULTS.outDir).toBe("dist");
    expect(CONFIG_DEFAULTS.resolution).toBe("1080p");
    expect(CONFIG_DEFAULTS.strict).toBe(false);
  });
});

describe("RESOLUTION_MAP", () => {
  it("has 1080p→fhd and 720p→hd entries", () => {
    expect(RESOLUTION_MAP["1080p"]).toBe("fhd");
    expect(RESOLUTION_MAP["720p"]).toBe("hd");
    expect(Object.keys(RESOLUTION_MAP)).toHaveLength(2);
  });
});

describe("env constants", () => {
  it("exports correct dev-mode values", async () => {
    const env = await import("../src/env.js");
    expect(env.ROKU).toBe(false);
    expect(env.WEB).toBe(true);
    expect(env.DEV).toBe(true);
    expect(env.PROD).toBe(false);
    expect(env.browser).toBe(true);
    expect(env.dev).toBe(true);
    expect(env.building).toBe(false);
  });
});
