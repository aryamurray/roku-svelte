export interface ManifestOptions {
  title?: string;
  majorVersion?: number;
  minorVersion?: number;
  buildVersion?: number;
  uiResolutions?: string;
}

export function emitManifest(options?: ManifestOptions): string {
  const title = options?.title ?? "Dev Channel";
  const major = options?.majorVersion ?? 1;
  const minor = options?.minorVersion ?? 0;
  const build = options?.buildVersion ?? 0;
  const resolutions = options?.uiResolutions ?? "fhd";

  const lines = [
    `title=${title}`,
    `major_version=${major}`,
    `minor_version=${minor}`,
    `build_version=${build}`,
    `ui_resolutions=${resolutions}`,
  ];

  return lines.join("\n");
}
