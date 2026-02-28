import { loadConfig } from "c12";
import { resolveConfig, type SvelteRokuConfig, type ResolvedConfig } from "@svelte-roku/config";

export async function loadCLIConfig(): Promise<ResolvedConfig> {
  const { config } = await loadConfig<SvelteRokuConfig>({
    name: "svelte-roku",
  });
  return resolveConfig(config ?? {});
}
