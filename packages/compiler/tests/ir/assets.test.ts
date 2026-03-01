import { describe, it, expect } from "vitest";
import { compile } from "../../src/index.js";

describe("asset resolution", () => {
  it("HTTP src passes through with no assets", async () => {
    const source = '<image src="https://example.com/logo.png" />';
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors).toEqual([]);
    expect(result.assets).toEqual([]);
    expect(result.xml).toContain('uri="https://example.com/logo.png"');
  });

  it("pkg:/ src passes through with no assets", async () => {
    const source = '<image src="pkg:/images/hero.jpg" />';
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors).toEqual([]);
    expect(result.assets).toEqual([]);
    expect(result.xml).toContain('uri="pkg:/images/hero.jpg"');
  });

  it("relative .jpg rewrites to pkg:/images/ and emits asset", async () => {
    const source = '<image src="./hero.jpg" />';
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors).toEqual([]);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      sourcePath: "/project/src/hero.jpg",
      destPath: "images/hero.jpg",
      pkgPath: "pkg:/images/hero.jpg",
    });
    expect(result.xml).toContain('uri="pkg:/images/hero.jpg"');
  });

  it("relative .svg with width/height rasterizes to PNG", async () => {
    const source = '<image src="./icon.svg" width="64" height="64" />';
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors).toEqual([]);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      sourcePath: "/project/src/icon.svg",
      destPath: "images/icon.png",
      pkgPath: "pkg:/images/icon.png",
      transform: "rasterize",
      rasterizeWidth: 64,
      rasterizeHeight: 64,
    });
    expect(result.xml).toContain('uri="pkg:/images/icon.png"');
  });

  it(".woff font emits UNSUPPORTED_ASSET_FORMAT fatal error", async () => {
    const source = '<image src="./font.woff" />';
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "UNSUPPORTED_ASSET_FORMAT")).toBe(true);
  });

  it("SVG without size emits SVG_RASTERIZE_NO_SIZE warning and defaults 512x512", async () => {
    const source = '<image src="./logo.svg" />';
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.code === "SVG_RASTERIZE_NO_SIZE")).toBe(true);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      rasterizeWidth: 512,
      rasterizeHeight: 512,
    });
  });

  it("no filePath option means no asset resolution", async () => {
    const source = '<image src="./hero.jpg" />';
    const result = await compile(source, "Test.svelte");
    expect(result.errors).toEqual([]);
    expect(result.assets).toEqual([]);
    // Should pass through as-is
    expect(result.xml).toContain('uri="./hero.jpg"');
  });

  it("multiple images accumulate multiple assets", async () => {
    const source = '<image src="./a.png" />\n<image src="./b.jpg" />';
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors).toEqual([]);
    expect(result.assets).toHaveLength(2);
    expect(result.assets[0]!.destPath).toBe("images/a.png");
    expect(result.assets[1]!.destPath).toBe("images/b.jpg");
  });

  it("assets is empty array on parse error", async () => {
    const source = "<image src='hello' "; // invalid, unclosed
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.assets).toEqual([]);
  });

  it("assets is empty array on component with no images", async () => {
    const source = '<rectangle width="100" height="100" />';
    const result = await compile(source, "Test.svelte", {
      filePath: "/project/src/Test.svelte",
    });
    expect(result.errors).toEqual([]);
    expect(result.assets).toEqual([]);
  });
});
