import { loadConfig } from "c12";
import { defu } from "defu";
import { resolveConfig, type SvelteRokuConfig, type ResolvedConfig } from "@svelte-roku/config";

export async function loadSvelteRokuConfig(
  inlineOptions?: SvelteRokuConfig,
): Promise<ResolvedConfig> {
  const { config: fileConfig } = await loadConfig<SvelteRokuConfig>({
    name: "svelte-roku",
  });

  const merged = defu(inlineOptions ?? {}, fileConfig ?? {}) as SvelteRokuConfig;
  return resolveConfig(merged);
}
