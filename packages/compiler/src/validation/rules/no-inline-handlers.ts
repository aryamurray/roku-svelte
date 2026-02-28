import { walk } from "estree-walker";
import type { AST } from "svelte/compiler";
import { ErrorCode } from "../../errors/types.js";
import type { CompileError } from "../../errors/types.js";
import { createError, locationFromOffset } from "../../errors/formatter.js";

export function noInlineHandlers(
  ast: AST.Root,
  source: string,
  filename: string,
): CompileError[] {
  const errors: CompileError[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walk(ast.fragment as any, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enter(node: any) {
      if (node.type === "RegularElement" && node.attributes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const attr of node.attributes as any[]) {
          if (attr.type === "OnDirective" && attr.expression) {
            const exprType = attr.expression.type;
            if (
              exprType === "ArrowFunctionExpression" ||
              exprType === "FunctionExpression"
            ) {
              errors.push(
                createError(
                  ErrorCode.INLINE_HANDLER,
                  locationFromOffset(source, attr.start ?? 0, filename),
                ),
              );
            }
          }
        }
      }
    },
  });

  return errors;
}
