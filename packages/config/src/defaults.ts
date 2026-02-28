export const CONFIG_DEFAULTS = {
  entry: "src/HomeScreen.svelte",
  title: "SvelteRoku App",
  outDir: "dist",
  resolution: "1080p" as const,
  strict: false,
};

export const RESOLUTION_MAP: Record<string, string> = {
  "1080p": "fhd",
  "720p": "hd",
};
