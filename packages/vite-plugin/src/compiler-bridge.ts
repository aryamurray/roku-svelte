import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "pathe";
import { compile, type CompileResult, type CompileOptions } from "@svelte-roku/compiler";
import type { ResolvedConfig } from "@svelte-roku/config";

export function compileSvelteFile(
  filePath: string,
  config: ResolvedConfig,
): CompileResult {
  const source = readFileSync(filePath, "utf-8");
  const filename = basename(filePath, ".svelte");
  const isEntry = filePath === config.entry;

  const options: CompileOptions = { isEntry };
  const result = compile(source, filename, options);

  if (result.errors.length === 0) {
    const componentsDir = join(config.outDir, "components");
    mkdirSync(componentsDir, { recursive: true });

    writeFileSync(join(componentsDir, `${filename}.xml`), result.xml);
    writeFileSync(join(componentsDir, `${filename}.brs`), result.brightscript);

    if (result.additionalComponents) {
      for (const ac of result.additionalComponents) {
        writeFileSync(join(componentsDir, `${ac.name}.xml`), ac.xml);
        writeFileSync(join(componentsDir, `${ac.name}.brs`), ac.brightscript);
      }
    }
  }

  return result;
}
