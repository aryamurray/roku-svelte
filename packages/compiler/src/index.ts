import { parse } from "svelte/compiler";
import type { AST } from "svelte/compiler";
import { validate } from "./validation/validator.js";
import { buildIR } from "./ir/builder.js";
import { emitXML, emitItemComponentXML } from "./emitters/xml.js";
import { emitBrightScript, emitItemComponentBrightScript } from "./emitters/brightscript.js";
import type {
  CompileError,
  CompileWarning,
  SourceLocation,
} from "./errors/types.js";

export type { CompileError, CompileWarning, SourceLocation };
export { emitManifest } from "./emitters/manifest.js";
export type { ManifestOptions } from "./emitters/manifest.js";

export interface CompileOptions {
  isEntry?: boolean;
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
  additionalComponents?: AdditionalComponent[];
  requiresRuntime?: boolean;
  requiresStdlib?: boolean;
  requiredPolyfills?: string[];
}

export function compile(
  source: string,
  filename: string,
  options?: CompileOptions,
): CompileResult {
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
    return { xml: "", brightscript: "", warnings, errors };
  }

  const validation = validate(ast, source, filename);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  if (errors.some((e) => e.fatal)) {
    return { xml: "", brightscript: "", warnings, errors };
  }

  const irResult = buildIR(ast, source, filename, {
    isEntry: options?.isEntry,
  });
  warnings.push(...irResult.warnings);
  errors.push(...irResult.errors);

  if (errors.some((e) => e.fatal)) {
    return { xml: "", brightscript: "", warnings, errors };
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

  return { xml, brightscript, warnings, errors, additionalComponents, requiresRuntime, requiresStdlib, requiredPolyfills };
}
