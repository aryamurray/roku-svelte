import { walk } from "estree-walker";
import type { AST } from "svelte/compiler";
import { ErrorCode } from "../../errors/types.js";
import type { CompileError } from "../../errors/types.js";
import { createError, locationFromOffset } from "../../errors/formatter.js";

const GESTURE_EVENT_PREFIXES = [
  "touch",
  "pointer",
  "mouse",
  "click",
  "dblclick",
  "drag",
  "drop",
  "swipe",
  "wheel",
  "contextmenu",
];

export function noGestures(
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
          if (attr.type === "OnDirective") {
            const eventName: string = attr.name;
            if (
              GESTURE_EVENT_PREFIXES.some(
                (prefix) =>
                  eventName === prefix || eventName.startsWith(prefix),
              )
            ) {
              errors.push(
                createError(
                  ErrorCode.NO_GESTURES,
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
