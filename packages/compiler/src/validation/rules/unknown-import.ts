import type { AST } from "svelte/compiler";
import { ErrorCode } from "../../errors/types.js";
import type { CompileError } from "../../errors/types.js";
import { createError, locationFromOffset } from "../../errors/formatter.js";

const ALLOWED_PREFIXES = [".", "/", "$", "svelte"];

export function unknownImport(
  ast: AST.Root,
  source: string,
  filename: string,
): CompileError[] {
  const errors: CompileError[] = [];

  if (ast.instance?.content?.body) {
    for (const node of ast.instance.content.body) {
      if (node.type === "ImportDeclaration") {
        const specifier = node.source.value as string;
        const isAllowed = ALLOWED_PREFIXES.some((prefix) =>
          specifier.startsWith(prefix),
        );
        if (!isAllowed) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const start = (node as any).start ?? 0;
          errors.push(
            createError(
              ErrorCode.UNKNOWN_IMPORT,
              locationFromOffset(source, start, filename),
              { specifier },
            ),
          );
        }
      }
    }
  }

  return errors;
}
