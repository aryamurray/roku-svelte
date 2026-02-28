import { defineCommand } from "citty";
import { consola } from "consola";
import fg from "fast-glob";
import { readFileSync } from "fs";
import { join, basename } from "pathe";
import { compile } from "@svelte-roku/compiler";
import { svelteRokuPreprocess } from "@svelte-roku/preprocessor";
import { loadCLIConfig } from "../utils/config.js";
import { displayDiagnostics } from "../utils/format.js";

export const checkCommand = defineCommand({
  meta: { name: "check", description: "Type-check and validate Svelte components" },
  async run() {
    const config = await loadCLIConfig();
    const preprocessor = svelteRokuPreprocess({ platform: "roku" });

    const files = await fg("src/**/*.svelte", { cwd: config.root });
    if (files.length === 0) {
      consola.warn("No .svelte files found in src/");
      return;
    }

    consola.start(`Checking ${files.length} component(s)...`);

    let errorCount = 0;
    let warningCount = 0;

    for (const file of files) {
      const fullPath = join(config.root, file);
      const source = readFileSync(fullPath, "utf-8");
      const filename = basename(file, ".svelte");

      // Preprocess first to strip <roku>/<web> tags
      const preprocessed = preprocessor.markup({ content: source, filename: file });
      const isEntry = fullPath === config.entry;
      const result = compile(preprocessed.code, filename, { isEntry });

      if (result.errors.length > 0) {
        displayDiagnostics(result.errors, consola);
        errorCount += result.errors.length;
      }

      if (result.warnings.length > 0) {
        displayDiagnostics(result.warnings, consola);
        warningCount += result.warnings.length;
      }
    }

    if (errorCount > 0) {
      consola.error(`Check failed: ${errorCount} error(s), ${warningCount} warning(s)`);
      process.exit(1);
    }

    if (warningCount > 0) {
      consola.warn(`Check passed with ${warningCount} warning(s)`);
    } else {
      consola.success(`All ${files.length} component(s) passed`);
    }
  },
});
