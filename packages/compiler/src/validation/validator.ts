import type { AST } from "svelte/compiler";
import type { CompileError, CompileWarning } from "../errors/types.js";
import { noAsync } from "./rules/no-async.js";
import { noFetch } from "./rules/no-fetch.js";
import { noTimers } from "./rules/no-timers.js";
import { noDom } from "./rules/no-dom.js";
import { noAwaitBlock } from "./rules/no-await-block.js";
import { noGestures } from "./rules/no-gestures.js";
import { unknownImport } from "./rules/unknown-import.js";
import { noComplexExpressions } from "./rules/no-complex-expressions.js";
import { noInlineHandlers } from "./rules/no-inline-handlers.js";

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

  return { errors, warnings };
}
