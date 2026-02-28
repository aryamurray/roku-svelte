export interface RokuDeviceConfig {
  host: string;
  password: string;
}

export interface SvelteRokuConfig {
  entry?: string;
  title?: string;
  outDir?: string;
  resolution?: "1080p" | "720p";
  strict?: boolean;
  roku?: RokuDeviceConfig;
}

export interface ResolvedConfig {
  entry: string;
  title: string;
  outDir: string;
  resolution: "1080p" | "720p";
  uiResolutions: string;
  strict: boolean;
  roku?: RokuDeviceConfig;
  root: string;
}
