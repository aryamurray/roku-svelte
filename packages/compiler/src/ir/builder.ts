import type { AST } from "svelte/compiler";
import { basename } from "pathe";
import type {
  IRComponent,
  IRNode,
  IRProperty,
  IRStateVariable,
  IRHandler,
  IRHandlerStatement,
  IRBinding,
  IRTextPart,
  IREvent,
  SGNodeType,
} from "./types.js";
import type { CompileError, CompileWarning } from "../errors/types.js";
import { ErrorCode, WarningCode } from "../errors/types.js";
import { createError, createWarning, locationFromOffset } from "../errors/formatter.js";

const ELEMENT_MAP: Record<string, SGNodeType> = {
  rectangle: "Rectangle",
  view: "Rectangle",
  text: "Label",
  image: "Poster",
  scroll: "ScrollingGroup",
  list: "MarkupList",
  grid: "MarkupGrid",
  input: "TextEditBox",
  video: "Video",
  spinner: "BusySpinner",
  group: "Group",
};

const CSS_PROPERTY_MAP: Record<string, string | null> = {
  color: "color",
  "font-size": "fontSize",
  "background-color": "color",
  width: "width",
  height: "height",
  opacity: "opacity",
};

const ATTRIBUTE_MAP: Record<string, string> = {
  src: "uri",
  width: "width",
  height: "height",
  color: "color",
  opacity: "opacity",
  text: "text",
  visible: "visible",
};

let nodeIdCounter = 0;

function generateId(prefix: string): string {
  return `${prefix}_${nodeIdCounter++}`;
}

export interface BuildOptions {
  isEntry?: boolean;
}

export interface BuildResult {
  component: IRComponent;
  warnings: CompileWarning[];
  errors: CompileError[];
}

interface BuildContext {
  source: string;
  filename: string;
  warnings: CompileWarning[];
  errors: CompileError[];
  stateVarNames: Set<string>;
  stateVars: IRStateVariable[];
  handlerNames: Set<string>;
  handlers: IRHandler[];
  bindings: IRBinding[];
  events: IREvent[];
  autofocusNodeId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SvelteElement {
  name: string;
  start: number;
  attributes: SvelteAttribute[];
  fragment: AST.Fragment;
}

interface SvelteAttribute {
  type: string;
  name: string;
  start: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expression?: any;
  value:
    | true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { type: string; expression?: any; start: number }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Array<{ type: string; data?: string; start: number; expression?: any }>;
}

export function buildIR(
  ast: AST.Root,
  source: string,
  filename: string,
  options?: BuildOptions,
): BuildResult {
  nodeIdCounter = 0;

  const ctx: BuildContext = {
    source,
    filename,
    warnings: [],
    errors: [],
    stateVarNames: new Set(),
    stateVars: [],
    handlerNames: new Set(),
    handlers: [],
    bindings: [],
    events: [],
    autofocusNodeId: null,
  };

  // Extract state and handlers from <script>
  if (ast.instance) {
    extractState(ast.instance, ctx);
  }

  const name = basename(filename, ".svelte");

  const children = buildFragment(ast.fragment, ctx);

  // Validate event handler references
  for (const event of ctx.events) {
    if (!ctx.handlerNames.has(event.handlerName)) {
      ctx.errors.push(
        createError(
          ErrorCode.UNKNOWN_HANDLER,
          locationFromOffset(source, 0, filename),
          { handler: event.handlerName },
        ),
      );
    }
  }

  const component: IRComponent = {
    name,
    extends: options?.isEntry ? "Scene" : "Group",
    children,
    scriptUri: `pkg:/components/${name}.brs`,
  };

  if (ctx.stateVars.length > 0) {
    component.state = ctx.stateVars;
  }
  if (ctx.handlers.length > 0) {
    component.handlers = ctx.handlers;
  }
  if (ctx.bindings.length > 0) {
    component.bindings = ctx.bindings;
  }
  if (ctx.events.length > 0) {
    component.events = ctx.events;
  }
  if (ctx.autofocusNodeId) {
    component.autofocusNodeId = ctx.autofocusNodeId;
  }

  return { component, warnings: ctx.warnings, errors: ctx.errors };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractState(instance: any, ctx: BuildContext): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = instance.content.body as any[];

  for (const node of body) {
    if (node.type === "VariableDeclaration") {
      if (node.kind === "const") continue; // const is not reactive state

      for (const decl of node.declarations) {
        const name = decl.id?.name;
        if (!name) continue;

        if (!decl.init) {
          // let x; → default to number 0
          ctx.stateVarNames.add(name);
          ctx.stateVars.push({ name, initialValue: "0", type: "number" });
          continue;
        }

        if (decl.init.type === "Literal") {
          const val = decl.init.value;
          if (typeof val === "number") {
            ctx.stateVarNames.add(name);
            ctx.stateVars.push({ name, initialValue: String(val), type: "number" });
          } else if (typeof val === "string") {
            ctx.stateVarNames.add(name);
            ctx.stateVars.push({ name, initialValue: val, type: "string" });
          } else if (typeof val === "boolean") {
            ctx.stateVarNames.add(name);
            ctx.stateVars.push({ name, initialValue: String(val), type: "boolean" });
          } else {
            ctx.errors.push(
              createError(
                ErrorCode.UNSUPPORTED_STATE_INIT,
                locationFromOffset(ctx.source, decl.start ?? 0, ctx.filename),
                { name },
              ),
            );
          }
        } else if (
          decl.init.type === "UnaryExpression" &&
          decl.init.operator === "-" &&
          decl.init.argument?.type === "Literal" &&
          typeof decl.init.argument.value === "number"
        ) {
          // Handle negative numbers: let x = -1
          ctx.stateVarNames.add(name);
          ctx.stateVars.push({
            name,
            initialValue: String(-decl.init.argument.value),
            type: "number",
          });
        } else {
          ctx.errors.push(
            createError(
              ErrorCode.UNSUPPORTED_STATE_INIT,
              locationFromOffset(ctx.source, decl.start ?? 0, ctx.filename),
              { name },
            ),
          );
        }
      }
    } else if (node.type === "FunctionDeclaration") {
      const funcName = node.id?.name;
      if (!funcName) continue;

      ctx.handlerNames.add(funcName);
      compileHandlerBody(funcName, node.body, ctx);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileHandlerBody(funcName: string, body: any, ctx: BuildContext): void {
  const statements: IRHandlerStatement[] = [];
  const mutatedVariables: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyStatements = body.body as any[];

  for (const stmt of bodyStatements) {
    if (stmt.type === "ExpressionStatement") {
      const expr = stmt.expression;

      if (expr.type === "UpdateExpression") {
        const varName = expr.argument?.name;
        if (!varName || !ctx.stateVarNames.has(varName)) {
          ctx.errors.push(
            createError(
              ErrorCode.UNSUPPORTED_HANDLER_BODY,
              locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
              { handler: funcName },
            ),
          );
          continue;
        }

        if (expr.operator === "++") {
          statements.push({ type: "increment", variable: varName });
        } else if (expr.operator === "--") {
          statements.push({ type: "decrement", variable: varName });
        }
        if (!mutatedVariables.includes(varName)) {
          mutatedVariables.push(varName);
        }
      } else if (expr.type === "AssignmentExpression" && expr.operator === "=") {
        const varName = expr.left?.name;
        if (!varName || !ctx.stateVarNames.has(varName)) {
          ctx.errors.push(
            createError(
              ErrorCode.UNSUPPORTED_HANDLER_BODY,
              locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
              { handler: funcName },
            ),
          );
          continue;
        }

        const rhs = expr.right;

        if (rhs.type === "Literal") {
          statements.push({
            type: "assign-literal",
            variable: varName,
            value: String(rhs.value),
          });
        } else if (
          rhs.type === "UnaryExpression" &&
          rhs.operator === "!" &&
          rhs.argument?.type === "Identifier" &&
          rhs.argument.name === varName
        ) {
          statements.push({ type: "assign-negate", variable: varName });
        } else if (rhs.type === "BinaryExpression") {
          if (
            rhs.left?.type === "Identifier" &&
            rhs.left.name === varName &&
            rhs.right?.type === "Literal"
          ) {
            if (rhs.operator === "+") {
              statements.push({
                type: "assign-add",
                variable: varName,
                operand: String(rhs.right.value),
              });
            } else if (rhs.operator === "-") {
              statements.push({
                type: "assign-sub",
                variable: varName,
                operand: String(rhs.right.value),
              });
            } else {
              ctx.errors.push(
                createError(
                  ErrorCode.UNSUPPORTED_HANDLER_BODY,
                  locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
                  { handler: funcName },
                ),
              );
              continue;
            }
          } else {
            ctx.errors.push(
              createError(
                ErrorCode.UNSUPPORTED_HANDLER_BODY,
                locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
                { handler: funcName },
              ),
            );
            continue;
          }
        } else {
          ctx.errors.push(
            createError(
              ErrorCode.UNSUPPORTED_HANDLER_BODY,
              locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
              { handler: funcName },
            ),
          );
          continue;
        }

        if (!mutatedVariables.includes(varName)) {
          mutatedVariables.push(varName);
        }
      } else {
        ctx.errors.push(
          createError(
            ErrorCode.UNSUPPORTED_HANDLER_BODY,
            locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
            { handler: funcName },
          ),
        );
      }
    } else {
      ctx.errors.push(
        createError(
          ErrorCode.UNSUPPORTED_HANDLER_BODY,
          locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
          { handler: funcName },
        ),
      );
    }
  }

  ctx.handlers.push({ name: funcName, statements, mutatedVariables });
}

function buildFragment(
  fragment: AST.Fragment,
  ctx: BuildContext,
): IRNode[] {
  const nodes: IRNode[] = [];

  for (const child of fragment.nodes) {
    if (child.type === "RegularElement") {
      const irNode = buildElement(child as unknown as SvelteElement, ctx);
      if (irNode) {
        nodes.push(irNode);
      }
    }
  }

  return nodes;
}

function buildElement(
  element: SvelteElement,
  ctx: BuildContext,
): IRNode | null {
  const tagName = element.name;
  const sgType = ELEMENT_MAP[tagName];

  if (!sgType) {
    ctx.warnings.push(
      createWarning(
        WarningCode.UNKNOWN_ELEMENT,
        locationFromOffset(ctx.source, element.start, ctx.filename),
        { element: tagName },
      ),
    );
    return null;
  }

  const properties: IRProperty[] = [];
  let explicitId: string | null = null;
  let focusable = false;
  let autofocus = false;

  for (const attr of element.attributes) {
    if (attr.type === "Attribute") {
      const attrName = attr.name;

      // Handle boolean focusable attribute
      if (attrName === "focusable") {
        focusable = true;
        continue;
      }

      // Handle boolean autofocus attribute
      if (attrName === "autofocus") {
        autofocus = true;
        continue;
      }

      const value = extractStaticAttributeValue(attr);

      if (attrName === "id") {
        explicitId = value;
        continue;
      }

      if (attrName === "style") {
        const styleProps = parseInlineStyle(
          value,
          ctx.source,
          ctx.filename,
          element.start,
          ctx.warnings,
        );
        properties.push(...styleProps);
        continue;
      }

      if (value !== null) {
        // Static attribute
        const sgField = ATTRIBUTE_MAP[attrName];
        if (sgField) {
          properties.push({ name: sgField, value: convertValue(sgField, value) });
        }
      } else {
        // Dynamic attribute — check for expression binding
        const exprTag = extractExpressionFromAttribute(attr);
        if (exprTag) {
          if (exprTag.type === "Identifier") {
            const varName = exprTag.name;
            if (ctx.stateVarNames.has(varName)) {
              const sgField = ATTRIBUTE_MAP[attrName];
              if (sgField) {
                properties.push({ name: sgField, value: "", dynamic: true });
                // We'll create the binding after we have the node ID
                // Store temporarily for post-processing
                (attr as SvelteAttribute & { _binding?: { sgField: string; varName: string } })._binding = {
                  sgField,
                  varName,
                };
              }
            } else {
              ctx.errors.push(
                createError(
                  ErrorCode.UNKNOWN_STATE_REF,
                  locationFromOffset(ctx.source, attr.start, ctx.filename),
                  { name: varName },
                ),
              );
            }
          }
          // Complex expressions are caught by the validation rule
        }
      }
    } else if (attr.type === "StyleDirective") {
      const cssProp = attr.name;
      const value = extractStaticAttributeValue(attr);
      const sgField = CSS_PROPERTY_MAP[cssProp];

      if (sgField === undefined) {
        ctx.warnings.push(
          createWarning(
            WarningCode.UNSUPPORTED_CSS,
            locationFromOffset(ctx.source, attr.start, ctx.filename),
            { property: cssProp },
          ),
        );
      } else if (sgField !== null && value !== null) {
        properties.push({ name: sgField, value: convertValue(sgField, value) });
      }
    } else if (attr.type === "OnDirective") {
      // Handle on:select — store for post-processing with node ID
      // Inline handlers are caught by validation rule
    }
  }

  const id = explicitId ?? generateId(sgType.toLowerCase());

  // Now create bindings and events with the resolved node ID
  for (const attr of element.attributes) {
    if (attr.type === "Attribute") {
      const binding = (attr as SvelteAttribute & { _binding?: { sgField: string; varName: string } })._binding;
      if (binding) {
        ctx.bindings.push({
          nodeId: id,
          property: binding.sgField,
          stateVar: binding.varName,
          dependencies: [binding.varName],
        });
      }
    } else if (attr.type === "OnDirective") {
      if (attr.expression && attr.expression.type === "Identifier") {
        ctx.events.push({
          nodeId: id,
          eventType: "select",
          handlerName: attr.expression.name,
        });
      }
    }
  }

  // Handle autofocus
  if (autofocus) {
    focusable = true; // autofocus implies focusable
    ctx.autofocusNodeId = id;
  }

  const children = buildFragment(element.fragment, ctx);

  // Handle text content for Labels
  let textContent: string | undefined;
  if (sgType === "Label") {
    const textResult = extractTextContentWithBindings(element.fragment, id, ctx);
    if (textResult.type === "static") {
      textContent = textResult.value;
      if (textContent) {
        properties.push({ name: "text", value: textContent });
      }
    } else if (textResult.type === "dynamic") {
      // Dynamic text — binding is already created
      textContent = undefined;
    }
  }

  const node: IRNode = {
    id,
    type: sgType,
    properties,
    children,
    textContent,
  };

  if (focusable) {
    node.focusable = true;
  }

  return node;
}

interface TextContentResult {
  type: "static" | "dynamic";
  value?: string;
}

function extractTextContentWithBindings(
  fragment: AST.Fragment,
  nodeId: string,
  ctx: BuildContext,
): TextContentResult {
  let hasExpressions = false;
  const parts: IRTextPart[] = [];

  for (const node of fragment.nodes) {
    if (node.type === "Text") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textNode = node as any;
      const text = textNode.data as string;
      // For mixed content, preserve whitespace trimming at boundaries
      if (text.trim()) {
        parts.push({ type: "static", value: text.trim() });
      }
    } else if (node.type === "ExpressionTag") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exprTag = node as any;
      if (exprTag.expression?.type === "Identifier") {
        const varName = exprTag.expression.name;
        if (ctx.stateVarNames.has(varName)) {
          hasExpressions = true;
          parts.push({ type: "dynamic", value: varName });
        } else {
          ctx.errors.push(
            createError(
              ErrorCode.UNKNOWN_STATE_REF,
              locationFromOffset(ctx.source, exprTag.start ?? 0, ctx.filename),
              { name: varName },
            ),
          );
        }
      }
      // Complex expressions are caught by validation rule
    }
  }

  if (!hasExpressions) {
    // All static text
    const staticTexts: string[] = [];
    for (const node of fragment.nodes) {
      if (node.type === "Text") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textNode = node as any;
        const trimmed = (textNode.data as string).trim();
        if (trimmed) staticTexts.push(trimmed);
      }
    }
    return {
      type: "static",
      value: staticTexts.length > 0 ? staticTexts.join(" ") : undefined,
    };
  }

  // Dynamic text — create a binding with textParts
  const dependencies = parts
    .filter((p) => p.type === "dynamic")
    .map((p) => p.value);
  const uniqueDeps = [...new Set(dependencies)];

  ctx.bindings.push({
    nodeId,
    property: "text",
    stateVar: uniqueDeps[0]!,
    dependencies: uniqueDeps,
    textParts: parts,
  });

  return { type: "dynamic" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractExpressionFromAttribute(attr: SvelteAttribute): any | null {
  const val = attr.value;
  // Direct ExpressionTag: visible={active}
  if (val && typeof val === "object" && !Array.isArray(val)) {
    if (val.type === "ExpressionTag" && val.expression) {
      return val.expression;
    }
  }
  // Array with ExpressionTag: width="{expr}"
  if (Array.isArray(val)) {
    for (const part of val) {
      if (part.type === "ExpressionTag" && part.expression) {
        return part.expression;
      }
    }
  }
  return null;
}

function extractStaticAttributeValue(attr: SvelteAttribute): string | null {
  const val = attr.value;
  if (val === true) return "true";
  if (Array.isArray(val)) {
    const parts: string[] = [];
    for (const part of val) {
      if (part.type === "Text") {
        parts.push(part.data ?? "");
      } else {
        return null;
      }
    }
    return parts.join("");
  }
  // Direct ExpressionTag object — not static
  if (val && typeof val === "object" && "type" in val) {
    return null;
  }
  return null;
}

function convertValue(sgField: string, value: string): string {
  if (sgField === "color") {
    return cssColorToRokuHex(value);
  }
  if (sgField === "visible") {
    return value === "false" || value === "none" ? "false" : "true";
  }
  return value;
}

export function cssColorToRokuHex(color: string): string {
  const trimmed = color.trim().toLowerCase();

  if (trimmed.startsWith("0x")) return trimmed;

  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return `0x${trimmed.slice(1)}ff`;
  }

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const r = trimmed[1]! + trimmed[1]!;
    const g = trimmed[2]! + trimmed[2]!;
    const b = trimmed[3]! + trimmed[3]!;
    return `0x${r}${g}${b}ff`;
  }

  if (/^#[0-9a-f]{8}$/.test(trimmed)) {
    return `0x${trimmed.slice(1)}`;
  }

  const namedColors: Record<string, string> = {
    white: "0xffffffff",
    black: "0x000000ff",
    red: "0xff0000ff",
    green: "0x00ff00ff",
    blue: "0x0000ffff",
    yellow: "0xffff00ff",
    transparent: "0x00000000",
  };

  return namedColors[trimmed] ?? color;
}

function parseInlineStyle(
  style: string | null,
  source: string,
  filename: string,
  nodeOffset: number,
  warnings: CompileWarning[],
): IRProperty[] {
  if (!style) return [];
  const props: IRProperty[] = [];

  const declarations = style
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);

  for (const decl of declarations) {
    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) continue;

    const cssProp = decl.slice(0, colonIndex).trim();
    const cssValue = decl.slice(colonIndex + 1).trim();

    if (cssProp === "display" && cssValue === "none") {
      props.push({ name: "visible", value: "false" });
      continue;
    }

    const sgField = CSS_PROPERTY_MAP[cssProp];
    if (sgField === undefined) {
      warnings.push(
        createWarning(
          WarningCode.UNSUPPORTED_CSS,
          locationFromOffset(source, nodeOffset, filename),
          { property: cssProp },
        ),
      );
      continue;
    }
    if (sgField === null) continue;

    props.push({ name: sgField, value: convertValue(sgField, cssValue) });
  }

  return props;
}
