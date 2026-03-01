/**
 * CSS value parsing and conversion for Roku SceneGraph.
 * Handles unit conversion, color normalization, transform parsing, and font mapping.
 */

export interface LengthContext {
  parentFontSize?: number;
  canvasWidth: number;
  canvasHeight: number;
  parentWidth?: number;
  parentHeight?: number;
}

/**
 * Resolve a CSS length value to a numeric pixel value.
 * Returns null for unresolvable values (auto, calc(), etc.).
 */
export function resolveLength(
  value: string,
  axis: "width" | "height",
  context: LengthContext,
): number | null {
  const trimmed = value.trim();

  // bare number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // px
  const pxMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (pxMatch) {
    return parseFloat(pxMatch[1]!);
  }

  // rem
  const remMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)rem$/);
  if (remMatch) {
    return parseFloat(remMatch[1]!) * 16;
  }

  // em
  const emMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)em$/);
  if (emMatch) {
    return parseFloat(emMatch[1]!) * (context.parentFontSize ?? 16);
  }

  // vh
  const vhMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)vh$/);
  if (vhMatch) {
    if (!context.canvasHeight) return null; // no resolution configured
    return (parseFloat(vhMatch[1]!) / 100) * context.canvasHeight;
  }

  // vw
  const vwMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)vw$/);
  if (vwMatch) {
    if (!context.canvasWidth) return null; // no resolution configured
    return (parseFloat(vwMatch[1]!) / 100) * context.canvasWidth;
  }

  // percentage
  const pctMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pctMatch) {
    const parentSize =
      axis === "width" ? context.parentWidth : context.parentHeight;
    if (!parentSize) return null; // no parent size available
    return (parseFloat(pctMatch[1]!) / 100) * parentSize;
  }

  // Unresolvable: auto, calc(), etc.
  return null;
}

// Named color map — comprehensive list for Roku
const NAMED_COLORS: Record<string, string> = {
  white: "0xffffffff",
  black: "0x000000ff",
  red: "0xff0000ff",
  green: "0x00ff00ff",
  blue: "0x0000ffff",
  yellow: "0xffff00ff",
  transparent: "0x00000000",
  gray: "0x808080ff",
  grey: "0x808080ff",
  orange: "0xffa500ff",
  purple: "0x800080ff",
  cyan: "0x00ffffff",
  magenta: "0xff00ffff",
  pink: "0xffc0cbff",
  brown: "0xa52a2aff",
  navy: "0x000080ff",
  teal: "0x008080ff",
  silver: "0xc0c0c0ff",
  gold: "0xffd700ff",
  coral: "0xff7f50ff",
  crimson: "0xdc143cff",
  indigo: "0x4b0082ff",
  lime: "0x00ff00ff",
  maroon: "0x800000ff",
  olive: "0x808000ff",
  salmon: "0xfa8072ff",
  violet: "0xee82eeff",
  aqua: "0x00ffffff",
};

/**
 * Convert a CSS color value to Roku's 0xRRGGBBAA hex format.
 */
export function cssColorToRokuHex(color: string): string {
  const trimmed = color.trim().toLowerCase();

  // Already Roku format
  if (trimmed.startsWith("0x")) return trimmed;

  // #rrggbb
  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return `0x${trimmed.slice(1)}ff`;
  }

  // #rgb
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const r = trimmed[1]! + trimmed[1]!;
    const g = trimmed[2]! + trimmed[2]!;
    const b = trimmed[3]! + trimmed[3]!;
    return `0x${r}${g}${b}ff`;
  }

  // #rrggbbaa
  if (/^#[0-9a-f]{8}$/.test(trimmed)) {
    return `0x${trimmed.slice(1)}`;
  }

  // rgb(r, g, b)
  const rgbMatch = trimmed.match(
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/,
  );
  if (rgbMatch) {
    const r = clamp(parseInt(rgbMatch[1]!, 10), 0, 255);
    const g = clamp(parseInt(rgbMatch[2]!, 10), 0, 255);
    const b = clamp(parseInt(rgbMatch[3]!, 10), 0, 255);
    return `0x${toHex(r)}${toHex(g)}${toHex(b)}ff`;
  }

  // rgba(r, g, b, a)
  const rgbaMatch = trimmed.match(
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)$/,
  );
  if (rgbaMatch) {
    const r = clamp(parseInt(rgbaMatch[1]!, 10), 0, 255);
    const g = clamp(parseInt(rgbaMatch[2]!, 10), 0, 255);
    const b = clamp(parseInt(rgbaMatch[3]!, 10), 0, 255);
    const a = clamp(parseFloat(rgbaMatch[4]!), 0, 1);
    const aByte = Math.round(a * 255);
    return `0x${toHex(r)}${toHex(g)}${toHex(b)}${toHex(aByte)}`;
  }

  // Named colors
  return NAMED_COLORS[trimmed] ?? color;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

export interface TransformResult {
  translation?: [number, number];
  rotation?: number;
  scale?: [number, number];
}

/**
 * Parse CSS transform value into Roku-compatible properties.
 * Supports translate(), rotate(), scale() and compound transforms.
 */
export function parseTransform(value: string): TransformResult {
  const result: TransformResult = {};

  // Match individual transform functions
  const funcRegex = /(translate|rotate|scale)\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(value)) !== null) {
    const func = match[1]!;
    const args = match[2]!;

    if (func === "translate") {
      const parts = args.split(",").map((s) => parseFloat(s.trim()));
      const x = parts[0] ?? 0;
      const y = parts[1] ?? 0;
      if (result.translation) {
        result.translation[0] += x;
        result.translation[1] += y;
      } else {
        result.translation = [x, y];
      }
    } else if (func === "rotate") {
      const degMatch = args.match(/(-?\d+(?:\.\d+)?)\s*deg/);
      if (degMatch) {
        result.rotation = parseFloat(degMatch[1]!);
      } else {
        // bare number = degrees
        result.rotation = parseFloat(args);
      }
    } else if (func === "scale") {
      const parts = args.split(",").map((s) => parseFloat(s.trim()));
      const x = parts[0] ?? 1;
      const y = parts[1] ?? x;
      result.scale = [x, y];
    }
  }

  return result;
}

// Roku system font names
const ROKU_FONTS = {
  smallest: "font:SmallestSystemFont",
  small: "font:SmallSystemFont",
  medium: "font:MediumSystemFont",
  large: "font:LargeSystemFont",
  largest: "font:LargestSystemFont",
  mediumBold: "font:MediumBoldSystemFont",
  largeBold: "font:LargeBoldSystemFont",
  largestBold: "font:LargestBoldSystemFont",
} as const;

/**
 * Map CSS font-weight (and optional font-family) to a Roku system font URI.
 * Returns null if no mapping is possible.
 */
export function resolveFont(
  weight: string,
  _family?: string,
): string | null {
  const w = weight.trim().toLowerCase();

  if (w === "bold" || w === "700" || w === "800" || w === "900") {
    return ROKU_FONTS.mediumBold;
  }

  if (w === "normal" || w === "400") {
    return ROKU_FONTS.medium;
  }

  if (w === "lighter" || w === "100" || w === "200" || w === "300") {
    return ROKU_FONTS.small;
  }

  return null;
}
