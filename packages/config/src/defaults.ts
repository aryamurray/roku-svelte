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

export const RESOLUTION_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1080p": { width: 1920, height: 1080 },
  "720p": { width: 1280, height: 720 },
};
