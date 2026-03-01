import type { AST } from "svelte/compiler";
import type { CompileError, CompileWarning } from "../errors/types.js";
import { WarningCode } from "../errors/types.js";
import { createWarning, locationFromOffset } from "../errors/formatter.js";
import { noAsync } from "./rules/no-async.js";
import { noFetch } from "./rules/no-fetch.js";
import { noTimers } from "./rules/no-timers.js";
import { noDom } from "./rules/no-dom.js";
import { noAwaitBlock } from "./rules/no-await-block.js";
import { noGestures } from "./rules/no-gestures.js";
import { unknownImport } from "./rules/unknown-import.js";
import { noComplexExpressions } from "./rules/no-complex-expressions.js";
import { noInlineHandlers } from "./rules/no-inline-handlers.js";
import { noWorkers } from "./rules/no-workers.js";

export interface ValidationResult {
  errors: CompileError[];
  warnings: CompileWarning[];
}

type ValidationRule = (
  ast: AST.Root,
  source: string,
  filename: string,
) => CompileError[];

const rules: ValidationRule[] = [
  noAsync,
  noFetch,
  noTimers,
  noDom,
  noAwaitBlock,
  noGestures,
  unknownImport,
  noComplexExpressions,
  noInlineHandlers,
  noWorkers,
];

export function validate(
  ast: AST.Root,
  source: string,
  filename: string,
): ValidationResult {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  for (const rule of rules) {
    errors.push(...rule(ast, source, filename));
  }

  // Warn if <style> block has content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cssNode = (ast as any).css;
  if (cssNode && cssNode.children && cssNode.children.length > 0) {
    warnings.push(
      createWarning(
        WarningCode.UNSUPPORTED_STYLE_BLOCK,
        locationFromOffset(source, cssNode.start ?? 0, filename),
      ),
    );
  }

  return { errors, warnings };
}
