import { walk } from "estree-walker";
import type { AST } from "svelte/compiler";
import { ErrorCode } from "../../errors/types.js";
import type { CompileError } from "../../errors/types.js";
import { createError, locationFromOffset } from "../../errors/formatter.js";

export function noComplexExpressions(
  ast: AST.Root,
  source: string,
  filename: string,
): CompileError[] {
  const errors: CompileError[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walk(ast.fragment as any, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enter(node: any) {
      if (node.type === "ExpressionTag" && node.expression) {
        const expr = node.expression;
        if (expr.type !== "Identifier") {
          const exprSource = source.slice(expr.start, expr.end);
          errors.push(
            createError(
              ErrorCode.UNSUPPORTED_EXPRESSION,
              locationFromOffset(source, node.start ?? 0, filename),
              { expression: exprSource },
            ),
          );
        }
      }
    },
  });

  return errors;
}
