import type { Plugin } from "vite";
import { loadSvelteRokuConfig } from "./config-loader.js";
import { MODULE_ALIASES } from "./aliases.js";
import { compileSvelteFile } from "./compiler-bridge.js";
import { copyRuntimeFiles } from "./runtime-copy.js";
import { deployToDevice } from "./deploy.js";
import { emitManifest } from "@svelte-roku/compiler";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "pathe";
import type { SvelteRokuConfig, ResolvedConfig } from "@svelte-roku/config";

export { defineConfig } from "@svelte-roku/config";
export type { SvelteRokuConfig, ResolvedConfig } from "@svelte-roku/config";

export function svelteRoku(options?: SvelteRokuConfig): Plugin {
  let resolvedConfig: ResolvedConfig;
  let isDev = false;

  return {
    name: "svelte-roku",

    async config(_config, env) {
      resolvedConfig = await loadSvelteRokuConfig(options);
      isDev = env.command === "serve";

      return {
        define: {
          __ROKU__: JSON.stringify(false),
          __WEB__: JSON.stringify(true),
          __DEV__: JSON.stringify(env.command === "serve"),
          __PROD__: JSON.stringify(env.command === "build"),
        },
      };
    },

    resolveId(source) {
      if (source in MODULE_ALIASES) {
        return MODULE_ALIASES[source];
      }
      return null;
    },

    async transform(code, id) {
      if (!id.endsWith(".svelte")) return null;

      const result = await compileSvelteFile(id, resolvedConfig);

      for (const error of result.errors) {
        this.error({
          message: error.message,
          id: error.loc?.file,
        });
      }

      for (const warning of result.warnings) {
        this.warn({
          message: warning.message,
          id: warning.loc?.file,
        });
      }

      // Real output is filesystem side effects; return empty module for Vite
      return {
        code: "export default {};",
        map: null,
      };
    },

    async closeBundle() {
      // Write manifest
      const manifest = emitManifest({
        title: resolvedConfig.title,
        uiResolutions: resolvedConfig.uiResolutions,
      });
      mkdirSync(resolvedConfig.outDir, { recursive: true });
      writeFileSync(join(resolvedConfig.outDir, "manifest"), manifest);

      // Copy runtime files
      copyRuntimeFiles(resolvedConfig.outDir);

      // Deploy if dev mode + device configured
      if (isDev && resolvedConfig.roku) {
        try {
          await deployToDevice(resolvedConfig);
        } catch (err) {
          console.error("[svelte-roku] Deploy failed:", err);
        }
      }
    },
  };
}
