import { dirname, join, basename, extname } from "pathe";
import type { AssetReference } from "./types.js";
import type { CompileError, CompileWarning, SourceLocation } from "../errors/types.js";
import { ErrorCode, WarningCode } from "../errors/types.js";
import { createError, createWarning } from "../errors/formatter.js";

export interface ResolveAssetResult {
  uri: string;
  asset?: AssetReference;
  error?: CompileError;
  warning?: CompileWarning;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const FONT_EXTENSIONS = new Set([".ttf", ".otf"]);
const UNSUPPORTED_FONT_EXTENSIONS = new Set([".woff", ".woff2"]);
const MEDIA_EXTENSIONS = new Set([
  ".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".webm", ".avi", ".mkv",
]);

export function resolveAssetSrc(
  rawSrc: string,
  filePath: string | null,
  loc: SourceLocation,
  nodeWidth: number | null,
  nodeHeight: number | null,
): ResolveAssetResult {
  // HTTP/HTTPS → passthrough
  if (rawSrc.startsWith("http://") || rawSrc.startsWith("https://")) {
    return { uri: rawSrc };
  }

  // Already a pkg:/ path → passthrough
  if (rawSrc.startsWith("pkg:/")) {
    return { uri: rawSrc };
  }

  // No filePath context (unit test mode) → passthrough
  if (!filePath) {
    return { uri: rawSrc };
  }

  // Resolve relative path against source file directory
  const resolvedPath = join(dirname(filePath), rawSrc);
  const ext = extname(rawSrc).toLowerCase();
  const name = basename(rawSrc, ext);
  const filename = basename(rawSrc);

  // Unsupported font formats → fatal error
  if (UNSUPPORTED_FONT_EXTENSIONS.has(ext)) {
    return {
      uri: rawSrc,
      error: createError(ErrorCode.UNSUPPORTED_ASSET_FORMAT, loc, {
        extension: ext,
      }),
    };
  }

  // SVG → rasterize to PNG
  if (ext === ".svg") {
    const width = nodeWidth ?? 512;
    const height = nodeHeight ?? 512;
    const destPath = `images/${name}.png`;
    const pkgPath = `pkg:/images/${name}.png`;

    const result: ResolveAssetResult = {
      uri: pkgPath,
      asset: {
        sourcePath: resolvedPath,
        destPath,
        pkgPath,
        transform: "rasterize",
        rasterizeWidth: width,
        rasterizeHeight: height,
      },
    };

    if (nodeWidth == null && nodeHeight == null) {
      result.warning = createWarning(
        WarningCode.SVG_RASTERIZE_NO_SIZE,
        loc,
      );
    }

    return result;
  }

  // Image formats → copy as-is
  if (IMAGE_EXTENSIONS.has(ext)) {
    const destPath = `images/${filename}`;
    const pkgPath = `pkg:/images/${filename}`;

    return {
      uri: pkgPath,
      asset: {
        sourcePath: resolvedPath,
        destPath,
        pkgPath,
      },
    };
  }

  // Font formats → copy to fonts/
  if (FONT_EXTENSIONS.has(ext)) {
    const destPath = `fonts/${filename}`;
    const pkgPath = `pkg:/fonts/${filename}`;

    return {
      uri: pkgPath,
      asset: {
        sourcePath: resolvedPath,
        destPath,
        pkgPath,
      },
    };
  }

  // Media formats → warning, passthrough
  if (MEDIA_EXTENSIONS.has(ext)) {
    return {
      uri: rawSrc,
      warning: createWarning(WarningCode.UNSUPPORTED_ASSET_TYPE, loc),
    };
  }

  // Unknown extension → passthrough
  return { uri: rawSrc };
}
