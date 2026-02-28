import { walk } from "estree-walker";
import type { AST } from "svelte/compiler";
import { ErrorCode } from "../../errors/types.js";
import type { CompileError } from "../../errors/types.js";
import { createError, locationFromOffset } from "../../errors/formatter.js";

export function noAsync(
  ast: AST.Root,
  source: string,
  filename: string,
): CompileError[] {
  const errors: CompileError[] = [];

  if (ast.instance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walk(ast.instance.content as any, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enter(node: any) {
        if (
          (node.type === "FunctionDeclaration" ||
            node.type === "FunctionExpression" ||
            node.type === "ArrowFunctionExpression") &&
          node.async
        ) {
          errors.push(
            createError(
              ErrorCode.NO_ASYNC,
              locationFromOffset(source, node.start ?? 0, filename),
            ),
          );
        }

        if (node.type === "AwaitExpression") {
          errors.push(
            createError(
              ErrorCode.NO_ASYNC,
              locationFromOffset(source, node.start ?? 0, filename),
            ),
          );
        }

        if (node.type === "Identifier" && node.name === "Promise") {
          errors.push(
            createError(
              ErrorCode.NO_ASYNC,
              locationFromOffset(source, node.start ?? 0, filename),
            ),
          );
        }
      },
    });
  }

  return errors;
}
