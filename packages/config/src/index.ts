import { resolve } from "path";
import { CONFIG_DEFAULTS, RESOLUTION_MAP } from "./defaults.js";
import type { SvelteRokuConfig, ResolvedConfig } from "./types.js";

export type { SvelteRokuConfig, ResolvedConfig, RokuDeviceConfig } from "./types.js";
export { CONFIG_DEFAULTS, RESOLUTION_MAP } from "./defaults.js";

export function defineConfig(config: SvelteRokuConfig): SvelteRokuConfig {
  return config;
}

export function resolveConfig(
  raw: SvelteRokuConfig = {},
  cwd: string = process.cwd(),
): ResolvedConfig {
  const resolution = raw.resolution ?? CONFIG_DEFAULTS.resolution;
  return {
    entry: resolve(cwd, raw.entry ?? CONFIG_DEFAULTS.entry),
    title: raw.title ?? CONFIG_DEFAULTS.title,
    outDir: resolve(cwd, raw.outDir ?? CONFIG_DEFAULTS.outDir),
    resolution,
    uiResolutions: RESOLUTION_MAP[resolution] ?? "fhd",
    strict: raw.strict ?? CONFIG_DEFAULTS.strict,
    roku: raw.roku,
    root: cwd,
  };
}
