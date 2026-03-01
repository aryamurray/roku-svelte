import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "pathe";
import type { AssetReference } from "../ir/types.js";

export interface ProcessAssetsResult {
  copied: number;
  rasterized: number;
  errors: string[];
}

export async function processAssets(
  assets: AssetReference[],
  outDir: string,
): Promise<ProcessAssetsResult> {
  const result: ProcessAssetsResult = { copied: 0, rasterized: 0, errors: [] };

  if (assets.length === 0) return result;

  // Deduplicate by sourcePath (first-seen wins)
  const seen = new Map<string, AssetReference>();
  for (const asset of assets) {
    if (!seen.has(asset.sourcePath)) {
      seen.set(asset.sourcePath, asset);
    }
  }

  for (const asset of seen.values()) {
    const destFullPath = join(outDir, asset.destPath);

    // Ensure destination directory exists
    mkdirSync(dirname(destFullPath), { recursive: true });

    if (asset.transform === "rasterize") {
      try {
        let Resvg: typeof import("@resvg/resvg-js").Resvg;
        try {
          Resvg = (await import("@resvg/resvg-js")).Resvg;
        } catch {
          throw new Error(
            "SVG rasterization requires @resvg/resvg-js. Install it: bun add @resvg/resvg-js",
          );
        }

        const svgContent = readFileSync(asset.sourcePath, "utf-8");
        const resvg = new Resvg(svgContent, {
          fitTo: { mode: "width", value: asset.rasterizeWidth ?? 512 },
        });
        const pngData = resvg.render().asPng();
        writeFileSync(destFullPath, pngData);
        result.rasterized++;
      } catch (err) {
        result.errors.push(
          `Failed to rasterize ${asset.sourcePath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      try {
        copyFileSync(asset.sourcePath, destFullPath);
        result.copied++;
      } catch (err) {
        result.errors.push(
          `Failed to copy ${asset.sourcePath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return result;
}
