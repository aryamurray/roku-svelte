import { createRequire } from "module";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "pathe";
import { RUNTIME_FILES } from "@svelte-roku/runtime";

export function copyRuntimeFiles(outDir: string): void {
  const require = createRequire(import.meta.url);
  const runtimeIndex = require.resolve("@svelte-roku/runtime");
  const runtimeSrcDir = join(dirname(runtimeIndex), "..", "src");
  const destDir = join(outDir, "source", "runtime");

  mkdirSync(destDir, { recursive: true });

  for (const file of RUNTIME_FILES) {
    const content = readFileSync(join(runtimeSrcDir, file), "utf-8");
    writeFileSync(join(destDir, file), content);
  }
}
