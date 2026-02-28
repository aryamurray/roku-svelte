import { walk } from "estree-walker";
import type { AST } from "svelte/compiler";
import { ErrorCode } from "../../errors/types.js";
import type { CompileError } from "../../errors/types.js";
import { createError, locationFromOffset } from "../../errors/formatter.js";

const DOM_GLOBALS = new Set([
  "document",
  "window",
  "navigator",
  "location",
  "localStorage",
  "sessionStorage",
  "HTMLElement",
  "Element",
  "Node",
]);

export function noDom(
  ast: AST.Root,
  source: string,
  filename: string,
): CompileError[] {
  const errors: CompileError[] = [];

  if (ast.instance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walk(ast.instance.content as any, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enter(node: any, parent: any) {
        if (
          node.type === "Identifier" &&
          DOM_GLOBALS.has(node.name ?? "")
        ) {
          if (parent?.type === "MemberExpression" && parent.property === node) {
            return;
          }
          errors.push(
            createError(
              ErrorCode.NO_DOM,
              locationFromOffset(source, node.start ?? 0, filename),
            ),
          );
        }
      },
    });
  }

  return errors;
}
