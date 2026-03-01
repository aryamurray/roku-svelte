import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "pathe";
import { tmpdir } from "os";
import { processAssets, type AssetReference } from "@svelte-roku/compiler";

const TEST_DIR = join(tmpdir(), "svelte-roku-asset-test-" + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("processAssets", () => {
  it("empty array is a no-op", async () => {
    const result = await processAssets([], TEST_DIR);
    expect(result.copied).toBe(0);
    expect(result.rasterized).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("copies file to correct destination", async () => {
    const srcDir = join(TEST_DIR, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "hero.png"), "fake-png-data");

    const outDir = join(TEST_DIR, "dist");
    const assets: AssetReference[] = [
      {
        sourcePath: join(srcDir, "hero.png"),
        destPath: "images/hero.png",
        pkgPath: "pkg:/images/hero.png",
      },
    ];

    const result = await processAssets(assets, outDir);
    expect(result.copied).toBe(1);
    expect(result.errors).toEqual([]);
    expect(existsSync(join(outDir, "images", "hero.png"))).toBe(true);
    expect(readFileSync(join(outDir, "images", "hero.png"), "utf-8")).toBe("fake-png-data");
  });

  it("deduplicates identical sourcePaths", async () => {
    const srcDir = join(TEST_DIR, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "logo.png"), "logo-data");

    const outDir = join(TEST_DIR, "dist");
    const asset: AssetReference = {
      sourcePath: join(srcDir, "logo.png"),
      destPath: "images/logo.png",
      pkgPath: "pkg:/images/logo.png",
    };

    const result = await processAssets([asset, asset, asset], outDir);
    expect(result.copied).toBe(1);
  });

  it("creates destination directory if missing", async () => {
    const srcDir = join(TEST_DIR, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "icon.png"), "icon-data");

    const outDir = join(TEST_DIR, "dist", "deep", "nested");
    const assets: AssetReference[] = [
      {
        sourcePath: join(srcDir, "icon.png"),
        destPath: "images/icon.png",
        pkgPath: "pkg:/images/icon.png",
      },
    ];

    const result = await processAssets(assets, outDir);
    expect(result.copied).toBe(1);
    expect(existsSync(join(outDir, "images", "icon.png"))).toBe(true);
  });

  it("rasterizes SVG to PNG", async () => {
    const srcDir = join(TEST_DIR, "src");
    mkdirSync(srcDir, { recursive: true });

    const svgFixture = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="red"/>
</svg>`;
    writeFileSync(join(srcDir, "icon.svg"), svgFixture);

    const outDir = join(TEST_DIR, "dist");
    const assets: AssetReference[] = [
      {
        sourcePath: join(srcDir, "icon.svg"),
        destPath: "images/icon.png",
        pkgPath: "pkg:/images/icon.png",
        transform: "rasterize",
        rasterizeWidth: 100,
        rasterizeHeight: 100,
      },
    ];

    const result = await processAssets(assets, outDir);
    expect(result.rasterized).toBe(1);
    expect(result.errors).toEqual([]);

    const outPath = join(outDir, "images", "icon.png");
    expect(existsSync(outPath)).toBe(true);

    // Verify it's a valid PNG (starts with PNG magic bytes)
    const pngData = readFileSync(outPath);
    expect(pngData[0]).toBe(0x89);
    expect(pngData[1]).toBe(0x50); // P
    expect(pngData[2]).toBe(0x4e); // N
    expect(pngData[3]).toBe(0x47); // G
  });
});
