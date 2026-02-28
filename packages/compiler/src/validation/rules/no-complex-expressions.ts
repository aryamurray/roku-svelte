import { walk } from "estree-walker";
import type { AST } from "svelte/compiler";
import { ErrorCode } from "../../errors/types.js";
import type { CompileError } from "../../errors/types.js";
import { createError, locationFromOffset } from "../../errors/formatter.js";
import { canTranspileAsSingleExpression } from "../../transpiler/expression.js";
import { FUNCTIONAL_METHODS } from "../../transpiler/stdlib.js";

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
        // Allow: Identifier, simple MemberExpression (item.title), and transpilable expressions
        const isIdentifier = expr.type === "Identifier";
        const isSimpleMemberExpr =
          expr.type === "MemberExpression" &&
          expr.object?.type === "Identifier" &&
          expr.property?.type === "Identifier" &&
          !expr.computed;
        if (!isIdentifier && !isSimpleMemberExpr && !canTranspileAsSingleExpression(expr)) {
          // Check if this is specifically a functional method in template context
          if (isFunctionalMethodCall(expr)) {
            const methodName = expr.callee?.property?.name ?? "unknown";
            errors.push(
              createError(
                ErrorCode.FUNCTIONAL_IN_TEMPLATE,
                locationFromOffset(source, node.start ?? 0, filename),
                { method: methodName },
              ),
            );
          } else {
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
      }
    },
  });

  return errors;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFunctionalMethodCall(expr: any): boolean {
  if (expr.type !== "CallExpression") return false;
  const callee = expr.callee;
  if (callee?.type !== "MemberExpression") return false;
  const methodName = callee.property?.name;
  return FUNCTIONAL_METHODS.has(methodName);
}
