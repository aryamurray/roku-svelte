import { describe, it, expect } from "vitest";
import { MODULE_ALIASES } from "../src/aliases.js";
import { svelteRoku } from "../src/index.js";
import { deployToDevice } from "../src/deploy.js";
import { connectTelnet, } from "../src/deploy.js";
import { compileSvelteFile } from "../src/compiler-bridge.js";

describe("MODULE_ALIASES", () => {
  it("maps $app/environment to runtime/env", () => {
    expect(MODULE_ALIASES["$app/environment"]).toBe("@svelte-roku/runtime/env");
  });

  it("maps $app/navigation to runtime/navigation", () => {
    expect(MODULE_ALIASES["$app/navigation"]).toBe("@svelte-roku/runtime/navigation");
  });

  it("maps $app/stores to runtime/stores", () => {
    expect(MODULE_ALIASES["$app/stores"]).toBe("@svelte-roku/runtime/stores");
  });

  it("maps $roku/env to config/env", () => {
    expect(MODULE_ALIASES["$roku/env"]).toBe("@svelte-roku/config/env");
  });

  it("maps $roku/router to runtime/router", () => {
    expect(MODULE_ALIASES["$roku/router"]).toBe("@svelte-roku/runtime/router");
  });

  it("maps $roku/storage to runtime/storage", () => {
    expect(MODULE_ALIASES["$roku/storage"]).toBe("@svelte-roku/runtime/storage");
  });

  it("maps $roku/animate to runtime/animate", () => {
    expect(MODULE_ALIASES["$roku/animate"]).toBe("@svelte-roku/runtime/animate");
  });

  it("maps $roku/network to runtime/network", () => {
    expect(MODULE_ALIASES["$roku/network"]).toBe("@svelte-roku/runtime/network");
  });
});

describe("MODULE_ALIASES completeness", () => {
  it("has exactly 8 entries", () => {
    expect(Object.keys(MODULE_ALIASES)).toHaveLength(8);
  });
});

describe("svelteRoku plugin", () => {
  it("returns plugin with name 'svelte-roku'", () => {
    const plugin = svelteRoku();
    expect(plugin.name).toBe("svelte-roku");
  });

  it("has all 4 hooks: config, resolveId, transform, closeBundle", () => {
    const plugin = svelteRoku();
    expect(plugin.config).toBeTypeOf("function");
    expect(plugin.resolveId).toBeTypeOf("function");
    expect(plugin.transform).toBeTypeOf("function");
    expect(plugin.closeBundle).toBeTypeOf("function");
  });

  it("resolveId returns alias for known module", () => {
    const plugin = svelteRoku();
    const resolveId = plugin.resolveId as (source: string) => string | null;
    expect(resolveId("$app/environment")).toBe("@svelte-roku/runtime/env");
  });

  it("resolveId returns null for unknown module", () => {
    const plugin = svelteRoku();
    const resolveId = plugin.resolveId as (source: string) => string | null;
    expect(resolveId("unknown-module")).toBeNull();
  });
});

describe("deployToDevice", () => {
  it("rejects without roku config", async () => {
    const fakeConfig = {
      entry: "/app/src/App.svelte",
      title: "Test",
      outDir: "/app/dist",
      resolution: "1080p",
      uiResolutions: "fhd",
      strict: false,
      roku: undefined,
      root: "/app",
    } as any;
    await expect(deployToDevice(fakeConfig)).rejects.toThrow("No Roku device configured");
  });
});

describe("function exports", () => {
  it("connectTelnet is a function", () => {
    expect(connectTelnet).toBeTypeOf("function");
  });

  it("compileSvelteFile is a function", () => {
    expect(compileSvelteFile).toBeTypeOf("function");
  });
});
