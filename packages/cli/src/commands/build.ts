import { defineCommand } from "citty";
import { consola } from "consola";
import fg from "fast-glob";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
import { join, basename, dirname, normalize } from "pathe";
import { compile, emitManifest } from "@svelte-roku/compiler";
import { RUNTIME_FILES } from "@svelte-roku/runtime";
import { svelteRokuPreprocess } from "@svelte-roku/preprocessor";
import { loadCLIConfig } from "../utils/config.js";
import { displayDiagnostics } from "../utils/format.js";

function copyRuntimeFiles(outDir: string): void {
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

export const buildCommand = defineCommand({
  meta: { name: "build", description: "Build Roku channel from Svelte components" },
  async run() {
    const config = await loadCLIConfig();
    const preprocessor = svelteRokuPreprocess({ platform: "roku" });

    const files = await fg("src/**/*.svelte", { cwd: config.root });
    if (files.length === 0) {
      consola.warn("No .svelte files found in src/");
      return;
    }

    consola.start(`Building ${files.length} component(s)...`);

    const componentsDir = join(config.outDir, "components");
    mkdirSync(componentsDir, { recursive: true });

    let hasErrors = false;

    for (const file of files) {
      const fullPath = join(config.root, file);
      const source = readFileSync(fullPath, "utf-8");
      const filename = basename(file, ".svelte");

      const preprocessed = preprocessor.markup({ content: source, filename: file });
      const isEntry = normalize(fullPath) === normalize(config.entry);
      const result = compile(preprocessed.code, filename, { isEntry });

      if (result.errors.length > 0) {
        displayDiagnostics(result.errors, consola);
        hasErrors = true;
        continue;
      }

      if (result.warnings.length > 0) {
        displayDiagnostics(result.warnings, consola);
      }

      writeFileSync(join(componentsDir, `${filename}.xml`), result.xml);
      writeFileSync(join(componentsDir, `${filename}.brs`), result.brightscript);

      if (result.additionalComponents) {
        for (const ac of result.additionalComponents) {
          writeFileSync(join(componentsDir, `${ac.name}.xml`), ac.xml);
          writeFileSync(join(componentsDir, `${ac.name}.brs`), ac.brightscript);
        }
      }
    }

    if (hasErrors) {
      consola.error("Build failed with errors");
      process.exit(1);
    }

    // Write manifest
    const manifest = emitManifest({
      title: config.title,
      uiResolutions: config.uiResolutions,
    });
    mkdirSync(config.outDir, { recursive: true });
    writeFileSync(join(config.outDir, "manifest"), manifest);

    // Write main.brs entry point
    const entryName = basename(config.entry, ".svelte");
    const sourceDir = join(config.outDir, "source");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, "main.brs"),
      `sub main()\n  screen = CreateObject("roSGScreen")\n  m.port = CreateObject("roMessagePort")\n  screen.setMessagePort(m.port)\n  scene = screen.CreateScene("${entryName}")\n  screen.show()\n\n  while true\n    msg = wait(0, m.port)\n    msgType = type(msg)\n    if msgType = "roSGScreenEvent"\n      if msg.isScreenClosed() then return\n    end if\n  end while\nend sub\n`,
    );

    // Copy runtime files
    copyRuntimeFiles(config.outDir);

    // Create zip via roku-deploy
    try {
      const rokuDeploy = await import("roku-deploy").then((m) => m.rokuDeploy);
      await rokuDeploy.createPackage({
        rootDir: config.outDir,
        files: ["**/*"],
        outDir: config.root,
        outFile: "channel.zip",
      });
      consola.success("Build complete: channel.zip");
    } catch {
      consola.warn("roku-deploy not available, skipping zip creation");
      consola.success(`Build complete: ${config.outDir}`);
    }
  },
});
