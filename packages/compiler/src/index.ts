import { parse } from "svelte/compiler";
import type { AST } from "svelte/compiler";
import { validate } from "./validation/validator.js";
import { buildIR } from "./ir/builder.js";
import { emitXML, emitItemComponentXML } from "./emitters/xml.js";
import { emitBrightScript, emitItemComponentBrightScript } from "./emitters/brightscript.js";
import { resolveLayout } from "./layout/index.js";
import type {
  CompileError,
  CompileWarning,
  SourceLocation,
} from "./errors/types.js";
import type { AssetReference } from "./ir/types.js";

export type { CompileError, CompileWarning, SourceLocation, AssetReference };
export { emitManifest } from "./emitters/manifest.js";
export type { ManifestOptions } from "./emitters/manifest.js";
export { processAssets, type ProcessAssetsResult } from "./assets/processor.js";

export interface CompileOptions {
  isEntry?: boolean;
  resolution?: { width: number; height: number };
  filePath?: string;
}

export interface AdditionalComponent {
  name: string;
  xml: string;
  brightscript: string;
}

export interface CompileResult {
  xml: string;
  brightscript: string;
  warnings: CompileWarning[];
  errors: CompileError[];
  assets: AssetReference[];
  additionalComponents?: AdditionalComponent[];
  requiresRuntime?: boolean;
  requiresStdlib?: boolean;
  requiredPolyfills?: string[];
}

export async function compile(
  source: string,
  filename: string,
  options?: CompileOptions,
): Promise<CompileResult> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  let ast: AST.Root;
  try {
    ast = parse(source, { filename, modern: true });
  } catch (e: unknown) {
    const parseErr = e as {
      message?: string;
      start?: { line?: number; column?: number };
    };
    errors.push({
      code: "PARSE_ERROR",
      message: parseErr.message ?? "Failed to parse Svelte source",
      hint: "Check your Svelte syntax.",
      docsUrl: "https://svelte.dev/docs",
      fatal: true,
      loc: {
        file: filename,
        line: parseErr.start?.line ?? 1,
        column: parseErr.start?.column ?? 1,
        source:
          source.split("\n")[(parseErr.start?.line ?? 1) - 1] ?? "",
      },
    });
    return { xml: "", brightscript: "", warnings, errors, assets: [] };
  }

  const validation = validate(ast, source, filename);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  if (errors.some((e) => e.fatal)) {
    return { xml: "", brightscript: "", warnings, errors, assets: [] };
  }

  const irResult = buildIR(ast, source, filename, {
    isEntry: options?.isEntry,
    resolution: options?.resolution,
    filePath: options?.filePath,
  });
  warnings.push(...irResult.warnings);
  errors.push(...irResult.errors);

  const assets = irResult.component.assets ?? [];

  if (errors.some((e) => e.fatal)) {
    return { xml: "", brightscript: "", warnings, errors, assets };
  }

  // Layout resolution pass (async for Yoga WASM)
  const layoutConfig = {
    rootWidth: options?.resolution?.width ?? 0,
    rootHeight: options?.resolution?.height ?? 0,
  };
  const layoutResult = await resolveLayout(irResult.component, layoutConfig);
  warnings.push(...layoutResult.warnings);
  errors.push(...layoutResult.errors);

  if (errors.some((e) => e.fatal)) {
    return { xml: "", brightscript: "", warnings, errors, assets };
  }

  const xml = emitXML(irResult.component);
  const brightscript = emitBrightScript(irResult.component);

  // Emit additional components (item components for lists)
  let additionalComponents: AdditionalComponent[] | undefined;
  if (irResult.component.itemComponents && irResult.component.itemComponents.length > 0) {
    additionalComponents = [];
    for (const ic of irResult.component.itemComponents) {
      additionalComponents.push({
        name: ic.name,
        xml: emitItemComponentXML(ic),
        brightscript: emitItemComponentBrightScript(ic),
      });
    }
  }

  const requiresRuntime = irResult.component.requiresRuntime || undefined;
  const requiresStdlib = irResult.component.requiresStdlib || undefined;
  const requiredPolyfills = irResult.component.requiredPolyfills
    ? [...irResult.component.requiredPolyfills]
    : undefined;

  return { xml, brightscript, warnings, errors, assets, additionalComponents, requiresRuntime, requiresStdlib, requiredPolyfills };
}
