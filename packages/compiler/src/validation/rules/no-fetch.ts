import { walk } from "estree-walker";
import type { AST } from "svelte/compiler";
import { ErrorCode } from "../../errors/types.js";
import type { CompileError } from "../../errors/types.js";
import { createError, locationFromOffset } from "../../errors/formatter.js";

export function noFetch(
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
          node.type === "CallExpression" &&
          node.callee?.type === "Identifier" &&
          node.callee?.name === "fetch"
        ) {
          errors.push(
            createError(
              ErrorCode.NO_FETCH,
              locationFromOffset(source, node.start ?? 0, filename),
            ),
          );
        }
      },
    });
  }

  return errors;
}
