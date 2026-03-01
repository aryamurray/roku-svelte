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
  IREachBlock,
  IRItemComponent,
  IRItemFieldBinding,
  IRItemTextPart,
  IRArrayItemField,
  IRArrayItem,
  AssetReference,
  IRPropVariable,
  IRObjectField,
  IRTwoWayBinding,
  IRAsyncHandler,
  IRContinuation,
} from "./types.js";
import type { CompileError, CompileWarning } from "../errors/types.js";
import { ErrorCode, WarningCode } from "../errors/types.js";
import { createError, createWarning, locationFromOffset } from "../errors/formatter.js";
import { transpileExpression, type TranspileContext } from "../transpiler/expression.js";
import {
  resolveLength,
  cssColorToRokuHex as cssColorToRokuHexValue,
  parseTransform,
  resolveFont,
  type LengthContext,
} from "./css-values.js";
import { resolveAssetSrc } from "./asset-resolver.js";

export interface StyleContext {
  canvasWidth: number;
  canvasHeight: number;
  parentWidth: number;
  parentHeight: number;
  parentFontSize: number;
}

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
  color: null,              // context-sensitive: handled in dispatch
  "font-size": "fontSize",
  "background-color": null, // context-sensitive: handled in dispatch
  width: "width",
  height: "height",
  opacity: "opacity",
  "letter-spacing": "letterSpacing",
  "line-height": "lineSpacing",
  // Handled with special logic (null = known but dispatched separately)
  display: null,
  visibility: null,
  transform: null,
  left: null,
  top: null,
  "text-align": null,
  "font-weight": null,
  "font-family": null,
  "white-space": null,
  "word-wrap": null,
  "overflow-wrap": null,
  // Flex properties — stored as flexStyles metadata
  "flex-direction": null,
  "justify-content": null,
  "align-items": null,
  "align-self": null,
  flex: null,
  "flex-grow": null,
  "flex-wrap": null,
  gap: null,
  "row-gap": null,
  "column-gap": null,
  padding: null,
  "padding-top": null,
  "padding-right": null,
  "padding-bottom": null,
  "padding-left": null,
  // Unsupported with hints (null = known, warning issued in dispatch)
  margin: null,
  "margin-top": null,
  "margin-right": null,
  "margin-bottom": null,
  "margin-left": null,
  border: null,
  "border-radius": null,
  "box-shadow": null,
  "background-image": null,
  overflow: null,
  position: null,
  "max-width": null,
  "max-height": null,
  "z-index": null,
};

const ATTRIBUTE_MAP: Record<string, string> = {
  src: "uri",
  width: "width",
  height: "height",
  color: "color",
  opacity: "opacity",
  text: "text",
  visible: "visible",
  itemSize: "itemSize",
  translation: "translation",
  rotation: "rotation",
  scale: "scale",
  horizAlign: "horizAlign",
  vertAlign: "vertAlign",
  wrap: "wrap",
  maxLines: "maxLines",
  lineSpacing: "lineSpacing",
  font: "font",
  letterSpacing: "letterSpacing",
  focusable: "focusable",
};

let nodeIdCounter = 0;

function generateId(prefix: string): string {
  return `${prefix}_${nodeIdCounter++}`;
}

export interface BuildOptions {
  isEntry?: boolean;
  resolution?: { width: number; height: number };
  filePath?: string;
}

export interface BuildResult {
  component: IRComponent;
  warnings: CompileWarning[];
  errors: CompileError[];
}

interface EachContext {
  alias: string;
  arrayVar: string;
  fieldBindings: IRItemFieldBinding[];
  indexName: string | null;
}

interface BuildContext {
  source: string;
  filename: string;
  filePath: string | null;
  warnings: CompileWarning[];
  errors: CompileError[];
  assets: AssetReference[];
  stateVarNames: Set<string>;
  stateVars: IRStateVariable[];
  handlerNames: Set<string>;
  handlers: IRHandler[];
  bindings: IRBinding[];
  events: IREvent[];
  autofocusNodeId: string | null;
  eachBlocks: IREachBlock[];
  itemComponents: IRItemComponent[];
  eachContext: EachContext | null;
  componentName: string;
  eachCounter: number;
  ifCounter: number;
  usesFetch: boolean;
  usesStdlib: boolean;
  constNames: Set<string>;
  requiredPolyfills: Set<string>;
  extractedCallbacks: IRHandler[];
  callbackCounter: number;
  styleContext: StyleContext;
  componentImports: Map<string, string>;
  props: IRPropVariable[];
  onMountHandler: IRHandler | null;
  onDestroyHandler: IRHandler | null;
  twoWayBindings: IRTwoWayBinding[];
  asyncHandlers: IRAsyncHandler[];
  usesAsync: boolean;
  asyncContCounter: number;
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

  const name = basename(filename, ".svelte");

  const ctx: BuildContext = {
    source,
    filename,
    filePath: options?.filePath ?? null,
    warnings: [],
    errors: [],
    assets: [],
    stateVarNames: new Set(),
    stateVars: [],
    handlerNames: new Set(),
    handlers: [],
    bindings: [],
    events: [],
    autofocusNodeId: null,
    eachBlocks: [],
    itemComponents: [],
    eachContext: null,
    componentName: name,
    eachCounter: 0,
    ifCounter: 0,
    usesFetch: false,
    usesStdlib: false,
    constNames: new Set(),
    requiredPolyfills: new Set(),
    extractedCallbacks: [],
    callbackCounter: 0,
    componentImports: new Map(),
    props: [],
    onMountHandler: null,
    onDestroyHandler: null,
    twoWayBindings: [],
    asyncHandlers: [],
    usesAsync: false,
    asyncContCounter: 0,
    styleContext: {
      canvasWidth: options?.resolution?.width ?? 0,
      canvasHeight: options?.resolution?.height ?? 0,
      parentWidth: options?.resolution?.width ?? 0,
      parentHeight: options?.resolution?.height ?? 0,
      parentFontSize: 16,
    },
  };

  // Extract state and handlers from <script>
  if (ast.instance) {
    extractState(ast.instance, ctx);
  }

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
  if (ctx.eachBlocks.length > 0) {
    component.eachBlocks = ctx.eachBlocks;
  }
  if (ctx.itemComponents.length > 0) {
    component.itemComponents = ctx.itemComponents;
  }

  // Back-fill arrayItemFields for fetch-sourced state vars
  for (const sv of ctx.stateVars) {
    if (sv.fetchCall && !sv.arrayItemFields) {
      const eachBlock = ctx.eachBlocks.find((eb) => eb.arrayVar === sv.name);
      if (eachBlock) {
        const itemComp = ctx.itemComponents.find((ic) => ic.name === eachBlock.itemComponentName);
        if (itemComp) {
          const fieldNames = new Set<string>();
          const fields: IRArrayItemField[] = [];
          for (const fb of itemComp.fieldBindings) {
            if (fb.textParts) {
              for (const part of fb.textParts) {
                if (part.type === "field" && !fieldNames.has(part.value)) {
                  fieldNames.add(part.value);
                  fields.push({ name: part.value, type: "string" });
                }
              }
            } else if (!fieldNames.has(fb.field)) {
              fieldNames.add(fb.field);
              fields.push({ name: fb.field, type: "string" });
            }
          }
          sv.arrayItemFields = fields;
        }
      }
    }
  }

  if (ctx.usesFetch) {
    component.requiresRuntime = true;
  }

  if (ctx.usesStdlib) {
    component.requiresStdlib = true;
  }

  if (ctx.requiredPolyfills.size > 0) {
    component.requiredPolyfills = ctx.requiredPolyfills;
  }

  if (ctx.extractedCallbacks.length > 0) {
    component.extractedCallbacks = ctx.extractedCallbacks;
  }

  if (ctx.assets.length > 0) {
    component.assets = ctx.assets;
  }

  if (ctx.props.length > 0) {
    component.props = ctx.props;
  }

  if (ctx.componentImports.size > 0) {
    component.componentImports = [...ctx.componentImports.entries()].map(([name, path]) => ({ name, path }));
  }

  if (ctx.onMountHandler) {
    component.onMountHandler = ctx.onMountHandler;
  }

  if (ctx.onDestroyHandler) {
    component.onDestroyHandler = ctx.onDestroyHandler;
  }

  if (ctx.twoWayBindings.length > 0) {
    component.twoWayBindings = ctx.twoWayBindings;
  }

  if (ctx.asyncHandlers.length > 0) {
    component.asyncHandlers = ctx.asyncHandlers;
    component.usesAsync = true;
  }

  if (ctx.usesAsync) {
    component.usesAsync = true;
  }

  return { component, warnings: ctx.warnings, errors: ctx.errors };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractState(instance: any, ctx: BuildContext): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = instance.content.body as any[];

  for (const node of body) {
    // Import tracking: detect .svelte component imports
    if (node.type === "ImportDeclaration") {
      const source = node.source?.value as string;
      if (source && source.endsWith(".svelte")) {
        for (const spec of node.specifiers ?? []) {
          if (spec.type === "ImportDefaultSpecifier" && spec.local?.name) {
            ctx.componentImports.set(spec.local.name, source);
          }
        }
      }
      // Allow imports from 'svelte' (onMount, onDestroy, etc.)
      continue;
    }

    // Lifecycle hooks: onMount(() => { ... }) and onDestroy(() => { ... })
    if (
      node.type === "ExpressionStatement" &&
      node.expression?.type === "CallExpression" &&
      node.expression.callee?.type === "Identifier"
    ) {
      const calleeName = node.expression.callee.name;
      if (calleeName === "onMount" || calleeName === "onDestroy") {
        const callback = node.expression.arguments?.[0];
        if (callback && (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression")) {
          const handler = compileLifecycleCallback(calleeName, callback, ctx);
          if (handler) {
            if (calleeName === "onMount") {
              ctx.onMountHandler = handler;
            } else {
              ctx.onDestroyHandler = handler;
            }
          }
        }
        continue;
      }
    }

    // Export let props: export let title = "default"
    if (node.type === "ExportNamedDeclaration" && node.declaration?.type === "VariableDeclaration") {
      for (const decl of node.declaration.declarations) {
        const propName = decl.id?.name;
        if (!propName) continue;

        let propType: "string" | "number" | "boolean" = "string";
        let defaultValue = "";
        let stateType: "number" | "string" | "boolean" | "array" = "string";

        if (decl.init?.type === "Literal") {
          const val = decl.init.value;
          if (typeof val === "number") { propType = "number"; defaultValue = String(val); stateType = "number"; }
          else if (typeof val === "boolean") { propType = "boolean"; defaultValue = String(val); stateType = "boolean"; }
          else if (typeof val === "string") { propType = "string"; defaultValue = val; stateType = "string"; }
        } else if (!decl.init) {
          defaultValue = "";
        }

        ctx.props.push({ name: propName, type: propType, defaultValue });
        ctx.stateVarNames.add(propName);
        ctx.stateVars.push({ name: propName, initialValue: defaultValue, type: stateType });
      }
      continue;
    }

    if (node.type === "VariableDeclaration") {
      if (node.kind === "const") {
        // Track const names for transpiler context but don't create state vars
        for (const decl of node.declarations) {
          const cname = decl.id?.name;
          if (cname) ctx.constNames.add(cname);
        }
        continue;
      }

      for (const decl of node.declarations) {
        const name = decl.id?.name;
        if (!name) continue;

        if (!decl.init) {
          // let x; -> default to number 0
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
        } else if (decl.init.type === "ArrayExpression") {
          extractArrayState(name, decl.init, decl.start ?? 0, ctx);
        } else if (decl.init.type === "ObjectExpression") {
          extractObjectState(name, decl.init, decl.start ?? 0, ctx);
        } else if (
          decl.init.type === "CallExpression" &&
          decl.init.callee?.type === "Identifier" &&
          decl.init.callee?.name === "fetch"
        ) {
          extractFetchState(name, decl.init, decl.start ?? 0, ctx);
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

      if (node.async) {
        extractAsyncHandler(node, ctx);
        continue;
      }

      ctx.handlerNames.add(funcName);
      compileHandlerBody(funcName, node.body, ctx);
    } else if (
      node.type === "LabeledStatement" &&
      node.label?.name === "$" &&
      node.body?.type === "ExpressionStatement" &&
      node.body.expression?.type === "AssignmentExpression" &&
      node.body.expression.operator === "="
    ) {
      // $: derived = expr
      const assignExpr = node.body.expression;
      const derivedName = assignExpr.left?.name;
      if (!derivedName) continue;

      const tCtx = createTranspileContext(ctx);
      const result = transpileExpression(assignExpr.right, tCtx);

      if (tCtx.errors.length > 0) {
        ctx.errors.push(...tCtx.errors);
        continue;
      }
      if (tCtx.usesStdlib) ctx.usesStdlib = true;
      mergePolyfillContext(tCtx, ctx);

      const deps = result.dependencies.filter(d => ctx.stateVarNames.has(d));

      // Infer type from expression or default to number
      let derivedType: "number" | "string" | "boolean" | "array" = "number";
      const rhs = assignExpr.right;
      if (rhs.type === "Literal") {
        if (typeof rhs.value === "string") derivedType = "string";
        else if (typeof rhs.value === "boolean") derivedType = "boolean";
      } else if (rhs.type === "TemplateLiteral") {
        derivedType = "string";
      } else if (rhs.type === "BinaryExpression" && (rhs.operator === ">" || rhs.operator === "<" || rhs.operator === ">=" || rhs.operator === "<=" || rhs.operator === "===" || rhs.operator === "!==" || rhs.operator === "==" || rhs.operator === "!=")) {
        derivedType = "boolean";
      }

      ctx.stateVarNames.add(derivedName);
      ctx.stateVars.push({
        name: derivedName,
        initialValue: derivedType === "string" ? "" : derivedType === "boolean" ? "false" : "0",
        type: derivedType,
        derivedFrom: {
          brsExpression: result.code,
          dependencies: deps,
          preamble: result.preamble,
        },
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractArrayState(name: string, arrayExpr: any, offset: number, ctx: BuildContext): void {
  const elements = arrayExpr.elements;

  if (!elements || elements.length === 0) {
    ctx.stateVarNames.add(name);
    ctx.stateVars.push({ name, initialValue: "", type: "array", arrayItemFields: [], arrayItems: [] });
    return;
  }

  // Validate each element is an ObjectExpression with Literal values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const elem of elements) {
    if (!elem || elem.type !== "ObjectExpression") {
      ctx.errors.push(
        createError(
          ErrorCode.UNSUPPORTED_ARRAY_INIT,
          locationFromOffset(ctx.source, offset, ctx.filename),
          { name },
        ),
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const prop of elem.properties) {
      if (prop.type !== "Property" || prop.value?.type !== "Literal") {
        ctx.errors.push(
          createError(
            ErrorCode.UNSUPPORTED_ARRAY_INIT,
            locationFromOffset(ctx.source, offset, ctx.filename),
            { name },
          ),
        );
        return;
      }
    }
  }

  // Extract field schema from first element
  const firstElem = elements[0];
  const arrayItemFields: IRArrayItemField[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const prop of firstElem.properties) {
    const fieldName = prop.key?.name ?? prop.key?.value;
    const val = prop.value?.value;
    let fieldType: "string" | "number" | "boolean" = "string";
    if (typeof val === "number") fieldType = "number";
    else if (typeof val === "boolean") fieldType = "boolean";
    arrayItemFields.push({ name: fieldName, type: fieldType });
  }

  // Build IRArrayItem[] from all elements
  const arrayItems: IRArrayItem[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const elem of elements) {
    const fields: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const prop of elem.properties) {
      const fieldName = prop.key?.name ?? prop.key?.value;
      fields[fieldName] = String(prop.value.value);
    }
    arrayItems.push({ fields });
  }

  ctx.stateVarNames.add(name);
  ctx.stateVars.push({
    name,
    initialValue: "",
    type: "array",
    arrayItemFields,
    arrayItems,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractObjectState(name: string, objExpr: any, offset: number, ctx: BuildContext): void {
  const properties = objExpr.properties ?? [];

  const objectFields: IRObjectField[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const prop of properties) {
    if (prop.type !== "Property") {
      ctx.errors.push(
        createError(
          ErrorCode.UNSUPPORTED_STATE_INIT,
          locationFromOffset(ctx.source, offset, ctx.filename),
          { name },
        ),
      );
      return;
    }
    const key = prop.key?.name ?? prop.key?.value;
    if (!key) continue;

    if (prop.value?.type === "Literal") {
      const val = prop.value.value;
      let fieldType: "string" | "number" | "boolean" = "string";
      if (typeof val === "number") fieldType = "number";
      else if (typeof val === "boolean") fieldType = "boolean";
      objectFields.push({ name: key, value: String(val), type: fieldType });
    } else if (prop.value?.type === "ObjectExpression" || prop.value?.type === "ArrayExpression") {
      ctx.errors.push(
        createError(
          ErrorCode.UNSUPPORTED_STATE_INIT,
          locationFromOffset(ctx.source, offset, ctx.filename),
          { name },
        ),
      );
      return;
    } else {
      ctx.errors.push(
        createError(
          ErrorCode.UNSUPPORTED_STATE_INIT,
          locationFromOffset(ctx.source, offset, ctx.filename),
          { name },
        ),
      );
      return;
    }
  }

  ctx.stateVarNames.add(name);
  ctx.stateVars.push({ name, initialValue: "", type: "object", objectFields });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFetchState(name: string, callExpr: any, offset: number, ctx: BuildContext): void {
  const args = callExpr.arguments;

  // Extract URL — can be any expression now
  let url = "";
  let urlIsLiteral = false;
  if (args && args.length > 0) {
    if (args[0].type === "Literal" && typeof args[0].value === "string") {
      url = args[0].value as string;
      urlIsLiteral = true;
    } else {
      // Dynamic URL — extract source text
      url = ctx.source.slice(args[0].start, args[0].end);
      urlIsLiteral = false;
    }
  }

  // Extract options if present
  let hasOptions = false;
  let optionsSource: string | undefined;
  if (args && args.length > 1) {
    hasOptions = true;
    optionsSource = ctx.source.slice(args[1].start, args[1].end);
  }

  ctx.stateVarNames.add(name);
  ctx.stateVars.push({
    name,
    initialValue: "",
    type: "array",
    fetchCall: { url, urlIsLiteral, hasOptions, optionsSource },
  });

  ctx.usesFetch = true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileHandlerBody(funcName: string, body: any, ctx: BuildContext): void {
  const statements: IRHandlerStatement[] = [];
  const mutatedVariables: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyStatements = body.body as any[];

  for (const stmt of bodyStatements) {
    compileStatement(stmt, statements, mutatedVariables, funcName, ctx);
  }

  ctx.handlers.push({ name: funcName, statements, mutatedVariables });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileLifecycleCallback(name: string, callback: any, ctx: BuildContext): IRHandler | null {
  const statements: IRHandlerStatement[] = [];
  const mutatedVariables: string[] = [];

  const body = callback.body;
  if (body?.type === "BlockStatement") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const stmt of body.body as any[]) {
      compileStatement(stmt, statements, mutatedVariables, name, ctx);
    }
  } else if (body) {
    // Expression body (arrow function)
    compileStatement({ type: "ExpressionStatement", expression: body, start: body.start }, statements, mutatedVariables, name, ctx);
  }

  return { name, statements, mutatedVariables };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAsyncHandler(node: any, ctx: BuildContext): void {
  const funcName = node.id?.name;
  if (!funcName) return;

  ctx.handlerNames.add(funcName);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyStmts = node.body?.body as any[];
  if (!bodyStmts) return;

  // Split body at each await point
  const preAwaitStatements: IRHandlerStatement[] = [];
  const preAwaitMutated: string[] = [];
  const continuations: IRContinuation[] = [];

  let currentStatements = preAwaitStatements;
  let currentMutated = preAwaitMutated;

  for (const stmt of bodyStmts) {
    // Check for await in variable declarations: const x = await expr
    if (
      stmt.type === "VariableDeclaration" &&
      stmt.declarations?.[0]?.init?.type === "AwaitExpression"
    ) {
      const decl = stmt.declarations[0];
      const resultVar = decl.id?.name;
      const awaitExpr = decl.init.argument;

      // Check if await is in a loop context (unsupported)
      // (This is already a top-level statement so we're fine)

      // Determine await type
      let awaitType: "fetch" | "generic" = "generic";
      let awaitTarget = "";
      let fetchUrl: string | undefined;

      if (
        awaitExpr.type === "CallExpression" &&
        awaitExpr.callee?.type === "Identifier" &&
        awaitExpr.callee.name === "fetch"
      ) {
        awaitType = "fetch";
        const args = awaitExpr.arguments ?? [];
        const urlArg = args[0];
        if (urlArg?.type === "Literal" && typeof urlArg.value === "string") {
          fetchUrl = `"${urlArg.value}"`;
        } else if (urlArg) {
          const tCtx = createTranspileContext(ctx);
          const urlResult = transpileExpression(urlArg, tCtx);
          if (tCtx.errors.length > 0) {
            ctx.errors.push(...tCtx.errors);
            return;
          }
          fetchUrl = urlResult.code;
        }
        awaitTarget = `__async_fetchTask_${ctx.asyncContCounter}`;
      } else {
        // Generic await
        const tCtx = createTranspileContext(ctx);
        const exprResult = transpileExpression(awaitExpr, tCtx);
        if (tCtx.errors.length > 0) {
          ctx.errors.push(...tCtx.errors);
          return;
        }
        if (tCtx.usesStdlib) ctx.usesStdlib = true;
        mergePolyfillContext(tCtx, ctx);
        awaitTarget = exprResult.code;
      }

      const contName = `${funcName}__cont_${ctx.asyncContCounter}`;
      ctx.asyncContCounter++;

      // Start a new continuation
      const contStatements: IRHandlerStatement[] = [];
      const contMutated: string[] = [];

      continuations.push({
        name: contName,
        awaitType,
        awaitTarget,
        fetchUrl,
        resultVar: resultVar ?? undefined,
        statements: contStatements,
        mutatedVariables: contMutated,
      });

      currentStatements = contStatements;
      currentMutated = contMutated;
      continue;
    }

    // Check for expression statements with await: await expr (no result)
    if (
      stmt.type === "ExpressionStatement" &&
      stmt.expression?.type === "AwaitExpression"
    ) {
      const awaitExpr = stmt.expression.argument;
      const tCtx = createTranspileContext(ctx);
      const exprResult = transpileExpression(awaitExpr, tCtx);
      if (tCtx.errors.length > 0) {
        ctx.errors.push(...tCtx.errors);
        return;
      }
      if (tCtx.usesStdlib) ctx.usesStdlib = true;
      mergePolyfillContext(tCtx, ctx);

      const contName = `${funcName}__cont_${ctx.asyncContCounter}`;
      ctx.asyncContCounter++;

      const contStatements: IRHandlerStatement[] = [];
      const contMutated: string[] = [];

      continuations.push({
        name: contName,
        awaitType: "generic",
        awaitTarget: exprResult.code,
        statements: contStatements,
        mutatedVariables: contMutated,
      });

      currentStatements = contStatements;
      currentMutated = contMutated;
      continue;
    }

    // Regular statement — compile into current segment
    compileStatement(stmt, currentStatements, currentMutated, funcName, ctx);
  }

  // Build the async handler
  const asyncHandler: IRAsyncHandler = {
    name: funcName,
    statements: preAwaitStatements,
    mutatedVariables: preAwaitMutated,
    isAsync: true,
    continuations,
  };

  ctx.asyncHandlers.push(asyncHandler);
  ctx.usesAsync = true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileStatement(stmt: any, statements: IRHandlerStatement[], mutatedVariables: string[], funcName: string, ctx: BuildContext): void {
  if (stmt.type === "ExpressionStatement") {
    compileExpressionStatement(stmt, statements, mutatedVariables, funcName, ctx);
  } else if (stmt.type === "IfStatement") {
    compileIfStatement(stmt, statements, mutatedVariables, funcName, ctx);
  } else if (stmt.type === "ForOfStatement") {
    compileForOfStatement(stmt, statements, mutatedVariables, funcName, ctx);
  } else if (stmt.type === "WhileStatement") {
    compileWhileStatement(stmt, statements, mutatedVariables, funcName, ctx);
  } else if (stmt.type === "ReturnStatement") {
    compileReturnStatement(stmt, statements, mutatedVariables, ctx);
  } else if (stmt.type === "VariableDeclaration") {
    compileVarDeclStatement(stmt, statements, mutatedVariables, ctx);
  } else if (stmt.type === "TryStatement") {
    compileTryStatement(stmt, statements, mutatedVariables, funcName, ctx);
  } else if (stmt.type === "BlockStatement") {
    // Unwrap block statements
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inner of stmt.body as any[]) {
      compileStatement(inner, statements, mutatedVariables, funcName, ctx);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileExpressionStatement(stmt: any, statements: IRHandlerStatement[], mutatedVariables: string[], funcName: string, ctx: BuildContext): void {
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
      return;
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
      // Try transpiler fallback for non-state assignments or complex expressions
      const handled = tryTranspileStatement(stmt, statements, mutatedVariables, funcName, ctx);
      if (!handled) {
        ctx.errors.push(
          createError(
            ErrorCode.UNSUPPORTED_HANDLER_BODY,
            locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
            { handler: funcName },
          ),
        );
      }
      return;
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
          const handled = tryTranspileAssignment(varName, rhs, stmt, statements, mutatedVariables, ctx);
          if (!handled) {
            ctx.errors.push(
              createError(
                ErrorCode.UNSUPPORTED_HANDLER_BODY,
                locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
                { handler: funcName },
              ),
            );
          }
          return;
        }
      } else {
        const handled = tryTranspileAssignment(varName, rhs, stmt, statements, mutatedVariables, ctx);
        if (!handled) {
          ctx.errors.push(
            createError(
              ErrorCode.UNSUPPORTED_HANDLER_BODY,
              locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
              { handler: funcName },
            ),
          );
        }
        return;
      }
    } else {
      const handled = tryTranspileAssignment(varName, rhs, stmt, statements, mutatedVariables, ctx);
      if (!handled) {
        ctx.errors.push(
          createError(
            ErrorCode.UNSUPPORTED_HANDLER_BODY,
            locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
            { handler: funcName },
          ),
        );
      }
      return;
    }

    if (!mutatedVariables.includes(varName)) {
      mutatedVariables.push(varName);
    }
  } else {
    const handled = tryTranspileStatement(stmt, statements, mutatedVariables, funcName, ctx);
    if (!handled) {
      ctx.errors.push(
        createError(
          ErrorCode.UNSUPPORTED_HANDLER_BODY,
          locationFromOffset(ctx.source, stmt.start ?? 0, ctx.filename),
          { handler: funcName },
        ),
      );
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileIfStatement(stmt: any, statements: IRHandlerStatement[], mutatedVariables: string[], funcName: string, ctx: BuildContext): void {
  const tCtx = createTranspileContext(ctx);
  const testResult = transpileExpression(stmt.test, tCtx);
  if (tCtx.errors.length > 0) {
    ctx.errors.push(...tCtx.errors);
    return;
  }
  if (tCtx.usesStdlib) ctx.usesStdlib = true;
  mergePolyfillContext(tCtx, ctx);

  const consequent: IRHandlerStatement[] = [];
  if (stmt.consequent.type === "BlockStatement") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inner of stmt.consequent.body as any[]) {
      compileStatement(inner, consequent, mutatedVariables, funcName, ctx);
    }
  } else {
    compileStatement(stmt.consequent, consequent, mutatedVariables, funcName, ctx);
  }

  let alternate: IRHandlerStatement[] | undefined;
  if (stmt.alternate) {
    alternate = [];
    if (stmt.alternate.type === "BlockStatement") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const inner of stmt.alternate.body as any[]) {
        compileStatement(inner, alternate, mutatedVariables, funcName, ctx);
      }
    } else {
      compileStatement(stmt.alternate, alternate, mutatedVariables, funcName, ctx);
    }
  }

  statements.push({
    type: "if",
    testBrs: testResult.code,
    testPreamble: testResult.preamble,
    consequent,
    alternate,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileForOfStatement(stmt: any, statements: IRHandlerStatement[], mutatedVariables: string[], funcName: string, ctx: BuildContext): void {
  const tCtx = createTranspileContext(ctx);
  const iterableResult = transpileExpression(stmt.right, tCtx);
  if (tCtx.errors.length > 0) {
    ctx.errors.push(...tCtx.errors);
    return;
  }
  if (tCtx.usesStdlib) ctx.usesStdlib = true;
  mergePolyfillContext(tCtx, ctx);

  // Extract loop variable name
  let variable = "item";
  if (stmt.left?.type === "VariableDeclaration" && stmt.left.declarations?.[0]?.id?.name) {
    variable = stmt.left.declarations[0].id.name;
  }

  const body: IRHandlerStatement[] = [];
  if (stmt.body.type === "BlockStatement") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inner of stmt.body.body as any[]) {
      compileStatement(inner, body, mutatedVariables, funcName, ctx);
    }
  } else {
    compileStatement(stmt.body, body, mutatedVariables, funcName, ctx);
  }

  statements.push({
    type: "for-each",
    variable,
    iterableBrs: iterableResult.code,
    iterablePreamble: iterableResult.preamble,
    body,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileWhileStatement(stmt: any, statements: IRHandlerStatement[], mutatedVariables: string[], funcName: string, ctx: BuildContext): void {
  const tCtx = createTranspileContext(ctx);
  const testResult = transpileExpression(stmt.test, tCtx);
  if (tCtx.errors.length > 0) {
    ctx.errors.push(...tCtx.errors);
    return;
  }
  if (tCtx.usesStdlib) ctx.usesStdlib = true;
  mergePolyfillContext(tCtx, ctx);

  const body: IRHandlerStatement[] = [];
  if (stmt.body.type === "BlockStatement") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inner of stmt.body.body as any[]) {
      compileStatement(inner, body, mutatedVariables, funcName, ctx);
    }
  } else {
    compileStatement(stmt.body, body, mutatedVariables, funcName, ctx);
  }

  statements.push({
    type: "while",
    testBrs: testResult.code,
    testPreamble: testResult.preamble,
    body,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileTryStatement(stmt: any, statements: IRHandlerStatement[], mutatedVariables: string[], funcName: string, ctx: BuildContext): void {
  const tryBody: IRHandlerStatement[] = [];
  if (stmt.block?.body) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inner of stmt.block.body as any[]) {
      compileStatement(inner, tryBody, mutatedVariables, funcName, ctx);
    }
  }

  const catchVar = stmt.handler?.param?.name ?? "e";
  const catchBody: IRHandlerStatement[] = [];
  if (stmt.handler?.body?.body) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inner of stmt.handler.body.body as any[]) {
      compileStatement(inner, catchBody, mutatedVariables, funcName, ctx);
    }
  }

  statements.push({ type: "try-catch", tryBody, catchVar, catchBody });

  // If there's a finalizer (finally block), inline its statements after the try-catch
  if (stmt.finalizer?.body) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inner of stmt.finalizer.body as any[]) {
      compileStatement(inner, statements, mutatedVariables, funcName, ctx);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileReturnStatement(stmt: any, statements: IRHandlerStatement[], _mutatedVariables: string[], ctx: BuildContext): void {
  if (stmt.argument) {
    const tCtx = createTranspileContext(ctx);
    const valResult = transpileExpression(stmt.argument, tCtx);
    if (tCtx.errors.length > 0) {
      ctx.errors.push(...tCtx.errors);
      return;
    }
    if (tCtx.usesStdlib) ctx.usesStdlib = true;
    mergePolyfillContext(tCtx, ctx);
    statements.push({ type: "return", valueBrs: valResult.code, valuePreamble: valResult.preamble });
  } else {
    statements.push({ type: "return" });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileVarDeclStatement(stmt: any, statements: IRHandlerStatement[], _mutatedVariables: string[], ctx: BuildContext): void {
  for (const decl of stmt.declarations) {
    const name = decl.id?.name;
    if (!name) continue;
    if (decl.init) {
      const tCtx = createTranspileContext(ctx);
      const valResult = transpileExpression(decl.init, tCtx);
      if (tCtx.errors.length > 0) {
        ctx.errors.push(...tCtx.errors);
        continue;
      }
      if (tCtx.usesStdlib) ctx.usesStdlib = true;
      mergePolyfillContext(tCtx, ctx);
      statements.push({ type: "var-decl", variable: name, valueBrs: valResult.code, valuePreamble: valResult.preamble });
    } else {
      statements.push({ type: "var-decl", variable: name, valueBrs: "invalid" });
    }
  }
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
    } else if (child.type === "EachBlock") {
      // EachBlock outside of a list context
      if (!ctx.eachContext) {
        ctx.errors.push(
          createError(
            ErrorCode.EACH_OUTSIDE_LIST,
            locationFromOffset(ctx.source, (child as unknown as { start: number }).start ?? 0, ctx.filename),
          ),
        );
      }
      // If inside eachContext (nested), it's handled by buildListElement
    } else if (child.type === "IfBlock") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ifNodes = buildIfBlock(child as any, ctx);
      nodes.push(...ifNodes);
    } else if (child.type === "Component") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compNode = buildComponentNode(child as any, ctx);
      if (compNode) nodes.push(compNode);
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

  // Handle list elements with {#each} blocks
  if (sgType === "MarkupList") {
    return buildListElement(element, ctx);
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
        const styleResult = parseInlineStyle(
          value,
          sgType,
          ctx.styleContext,
          ctx.source,
          ctx.filename,
          element.start,
          ctx.warnings,
        );
        properties.push(...styleResult.properties);
        if (styleResult.flexStyles) {
          // Store flex styles temporarily — will be attached to IRNode later
          (element as SvelteElement & { _flexStyles?: Record<string, string> })._flexStyles = styleResult.flexStyles;
        }
        continue;
      }

      if (value !== null) {
        // Static attribute
        const sgField = ATTRIBUTE_MAP[attrName];
        if (sgField) {
          properties.push({ name: sgField, value: convertValue(sgField, value) });
        }
      } else {
        // Dynamic attribute -- check for expression binding
        const exprTag = extractExpressionFromAttribute(attr);
        if (exprTag) {
          if (ctx.eachContext) {
            // Inside {#each} context — handle item.field bindings
            handleEachAttributeBinding(attr, exprTag, properties, ctx);
          } else if (exprTag.type === "Identifier") {
            const varName = exprTag.name;
            if (ctx.stateVarNames.has(varName)) {
              const sgField = ATTRIBUTE_MAP[attrName];
              if (sgField) {
                properties.push({ name: sgField, value: "", dynamic: true });
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

      if (value !== null) {
        // Run through the same dispatch logic as inline style
        const styleResult = parseInlineStyle(
          `${cssProp}: ${value}`,
          sgType,
          ctx.styleContext,
          ctx.source,
          ctx.filename,
          attr.start,
          ctx.warnings,
        );
        properties.push(...styleResult.properties);
      }
    } else if (attr.type === "BindDirective") {
      const bindName = attr.name; // "value", etc.
      if (bindName === "value" && sgType === "TextEditBox") {
        // bind:value on <input> → two-way binding
        const exprTag = attr.expression;
        if (exprTag?.type === "Identifier" && ctx.stateVarNames.has(exprTag.name)) {
          const varName = exprTag.name;
          // One-way: state→text (set in init via binding)
          properties.push({ name: "text", value: "", dynamic: true });
          (attr as SvelteAttribute & { _bindingVar?: string })._bindingVar = varName;
        }
      } else {
        ctx.errors.push(
          createError(
            ErrorCode.UNSUPPORTED_BIND,
            locationFromOffset(ctx.source, attr.start, ctx.filename),
            { property: bindName },
          ),
        );
      }
    } else if (attr.type === "OnDirective") {
      // Handle on:select — store for post-processing with node ID
      // Inline handlers are caught by validation rule
    }
  }

  // Post-process Poster nodes: resolve asset src paths
  if (sgType === "Poster") {
    const uriProp = properties.find((p) => p.name === "uri" && !p.dynamic);
    if (uriProp) {
      const widthProp = properties.find((p) => p.name === "width");
      const heightProp = properties.find((p) => p.name === "height");
      const w = widthProp ? parseFloat(widthProp.value) || null : null;
      const h = heightProp ? parseFloat(heightProp.value) || null : null;
      const loc = locationFromOffset(ctx.source, element.start, ctx.filename);
      const assetResult = resolveAssetSrc(uriProp.value, ctx.filePath, loc, w, h);
      uriProp.value = assetResult.uri;
      if (assetResult.asset) ctx.assets.push(assetResult.asset);
      if (assetResult.error) ctx.errors.push(assetResult.error);
      if (assetResult.warning) ctx.warnings.push(assetResult.warning);
    }
  }

  const id = explicitId ?? generateId(sgType.toLowerCase());

  // Now create bindings and events with the resolved node ID
  if (!ctx.eachContext) {
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
      } else if (attr.type === "BindDirective") {
        const bindVar = (attr as SvelteAttribute & { _bindingVar?: string })._bindingVar;
        if (bindVar) {
          // One-way binding: state → text
          ctx.bindings.push({
            nodeId: id,
            property: "text",
            stateVar: bindVar,
            dependencies: [bindVar],
          });
          // Two-way binding: text → state
          ctx.twoWayBindings.push({
            nodeId: id,
            property: "text",
            stateVar: bindVar,
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
  }

  // Handle autofocus
  if (autofocus) {
    focusable = true; // autofocus implies focusable
    ctx.autofocusNodeId = id;
  }

  // Update style context for children based on this node's resolved dimensions
  const prevStyleContext = ctx.styleContext;
  const thisWidth = properties.find((p) => p.name === "width");
  const thisHeight = properties.find((p) => p.name === "height");
  if (thisWidth || thisHeight) {
    ctx.styleContext = {
      ...prevStyleContext,
      parentWidth: thisWidth ? parseFloat(thisWidth.value) || prevStyleContext.parentWidth : prevStyleContext.parentWidth,
      parentHeight: thisHeight ? parseFloat(thisHeight.value) || prevStyleContext.parentHeight : prevStyleContext.parentHeight,
    };
  }

  const children = buildFragment(element.fragment, ctx);

  // Restore parent style context
  ctx.styleContext = prevStyleContext;

  // Handle text content for Labels
  let textContent: string | undefined;
  if (sgType === "Label") {
    if (ctx.eachContext) {
      const textResult = extractEachTextContent(element.fragment, id, ctx);
      if (textResult.type === "static") {
        textContent = textResult.value;
        if (textContent) {
          properties.push({ name: "text", value: textContent });
        }
      }
      // For field bindings, they're already added to ctx.eachContext.fieldBindings
    } else {
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

  // Attach flex styles if present
  const flexStyles = (element as SvelteElement & { _flexStyles?: Record<string, string> })._flexStyles;
  if (flexStyles) {
    node.flexStyles = flexStyles;
  }

  return node;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildComponentNode(element: any, ctx: BuildContext): IRNode | null {
  const compName = element.name as string;

  if (!ctx.componentImports.has(compName)) {
    ctx.warnings.push(
      createWarning(
        WarningCode.UNKNOWN_ELEMENT,
        locationFromOffset(ctx.source, element.start ?? 0, ctx.filename),
        { element: compName },
      ),
    );
    return null;
  }

  const id = generateId(compName.toLowerCase());
  const properties: IRProperty[] = [];

  for (const attr of element.attributes ?? []) {
    if (attr.type === "Attribute") {
      const attrName = attr.name;
      const value = extractStaticAttributeValue(attr);

      if (value !== null) {
        // Static prop
        properties.push({ name: attrName, value });
      } else {
        // Dynamic prop — create binding
        const exprTag = extractExpressionFromAttribute(attr);
        if (exprTag?.type === "Identifier") {
          const varName = exprTag.name;
          if (ctx.stateVarNames.has(varName)) {
            properties.push({ name: attrName, value: "", dynamic: true });
            ctx.bindings.push({
              nodeId: id,
              property: attrName,
              stateVar: varName,
              dependencies: [varName],
            });
          }
        } else if (exprTag) {
          // Complex expression prop
          const tCtx = createTranspileContext(ctx);
          tCtx.singleExpressionOnly = true;
          const result = transpileExpression(exprTag, tCtx);
          if (tCtx.errors.length === 0 && result.code !== "invalid") {
            if (tCtx.usesStdlib) ctx.usesStdlib = true;
            mergePolyfillContext(tCtx, ctx);
            const deps = result.dependencies.filter(d => ctx.stateVarNames.has(d));
            properties.push({ name: attrName, value: "", dynamic: true });
            ctx.bindings.push({
              nodeId: id,
              property: attrName,
              stateVar: deps[0] ?? "",
              dependencies: [...new Set(deps)],
              brsExpression: result.code,
            });
          } else {
            ctx.errors.push(...tCtx.errors);
          }
        }
      }
    }
  }

  return {
    id,
    type: compName,
    properties,
    children: [],
    isComponent: true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildIfBlock(ifBlock: any, ctx: BuildContext): IRNode[] {
  const counter = ctx.ifCounter++;
  const nodes: IRNode[] = [];

  // Flatten the if/else-if/else chain
  interface IfBranch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    test: any | null; // null for else branch
    fragment: AST.Fragment;
  }

  const branches: IfBranch[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function flattenIfChain(block: any): void {
    branches.push({ test: block.test, fragment: block.consequent });
    if (block.alternate) {
      // Check if alternate is another IfBlock (else-if)
      // In Svelte AST, alternate is a Fragment; if it contains a single IfBlock child, that's an else-if
      const altFragment = block.alternate as AST.Fragment;
      const altNodes = altFragment.nodes ?? [];
      const firstAlt = altNodes[0];
      if (altNodes.length === 1 && firstAlt && firstAlt.type === "IfBlock") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flattenIfChain(firstAlt as any);
      } else {
        // else branch
        branches.push({ test: null, fragment: altFragment });
      }
    }
  }

  flattenIfChain(ifBlock);

  // Transpile all test expressions
  const testResults: Array<{ code: string; deps: string[] }> = [];
  for (const branch of branches) {
    if (branch.test) {
      const tCtx = createTranspileContext(ctx);
      tCtx.singleExpressionOnly = true;
      const result = transpileExpression(branch.test, tCtx);
      if (tCtx.errors.length > 0) {
        ctx.errors.push(...tCtx.errors);
        return [];
      }
      if (tCtx.usesStdlib) ctx.usesStdlib = true;
      mergePolyfillContext(tCtx, ctx);
      testResults.push({ code: result.code, deps: result.dependencies.filter(d => ctx.stateVarNames.has(d)) });
    } else {
      testResults.push({ code: "", deps: [] });
    }
  }

  // Create Group wrappers with visibility bindings for each branch
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i]!;
    const groupId = `if_${counter}_${i}`;

    // Build the fragment children
    const children = buildFragment(branch.fragment, ctx);

    // Determine static visible value (first branch true, rest false)
    const staticVisible = i === 0 ? "true" : "false";

    const properties: IRProperty[] = [
      { name: "visible", value: staticVisible },
    ];

    const node: IRNode = {
      id: groupId,
      type: "Group",
      properties,
      children,
    };
    nodes.push(node);

    // Build visibility expression and dependencies for binding
    let visExpr: string;
    let allDeps: string[] = [];

    if (i === 0) {
      // First branch: visible when test is true
      visExpr = testResults[0]!.code;
      allDeps = [...testResults[0]!.deps];
    } else if (branch.test === null) {
      // Else branch: visible when all previous tests are false
      const negations = testResults.slice(0, i).filter(t => t.code !== "").map(t => `not (${t.code})`);
      visExpr = negations.length > 0 ? negations.join(" and ") : "true";
      for (let j = 0; j < i; j++) {
        allDeps.push(...testResults[j]!.deps);
      }
    } else {
      // Else-if branch: visible when previous tests are false AND this test is true
      const negations = testResults.slice(0, i).filter(t => t.code !== "").map(t => `not (${t.code})`);
      const parts = [...negations, testResults[i]!.code];
      visExpr = parts.join(" and ");
      for (let j = 0; j <= i; j++) {
        allDeps.push(...testResults[j]!.deps);
      }
    }

    const uniqueDeps = [...new Set(allDeps)];

    // Only create binding if there are state dependencies
    if (uniqueDeps.length > 0) {
      ctx.bindings.push({
        nodeId: groupId,
        property: "visible",
        stateVar: uniqueDeps[0]!,
        dependencies: uniqueDeps,
        brsExpression: visExpr,
      });
    }
  }

  return nodes;
}

function buildListElement(
  element: SvelteElement,
  ctx: BuildContext,
): IRNode | null {
  const properties: IRProperty[] = [];
  let explicitId: string | null = null;
  let itemSizeValue: string | null = null;

  // Process list attributes
  for (const attr of element.attributes) {
    if (attr.type === "Attribute") {
      const attrName = attr.name;

      if (attrName === "id") {
        explicitId = extractStaticAttributeValue(attr);
        continue;
      }

      const value = extractStaticAttributeValue(attr);
      if (value !== null) {
        const sgField = ATTRIBUTE_MAP[attrName];
        if (sgField) {
          if (sgField === "itemSize") {
            itemSizeValue = value;
          }
          properties.push({ name: sgField, value });
        }
      }
    }
  }

  const id = explicitId ?? generateId("markuplist");

  // Look for EachBlock in the list's fragment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let eachBlockNode: any = null;
  for (const child of element.fragment.nodes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = child as any;
    if (c.type === "EachBlock") {
      eachBlockNode = c;
      break;
    }
  }

  if (eachBlockNode) {
    // Validate the each block
    const eachStart = eachBlockNode.start ?? 0;

    // Capture index name if present
    const indexName: string | null = eachBlockNode.index ?? null;

    // Check for key expression
    if (eachBlockNode.key) {
      ctx.errors.push(
        createError(
          ErrorCode.EACH_WITH_KEY,
          locationFromOffset(ctx.source, eachStart, ctx.filename),
        ),
      );
      return null;
    }

    // Check for nested {#each}
    if (ctx.eachContext) {
      ctx.errors.push(
        createError(
          ErrorCode.EACH_NESTED,
          locationFromOffset(ctx.source, eachStart, ctx.filename),
        ),
      );
      return null;
    }

    // Validate expression is an Identifier referencing an array state var
    const eachExpr = eachBlockNode.expression;
    if (!eachExpr || eachExpr.type !== "Identifier") {
      ctx.errors.push(
        createError(
          ErrorCode.EACH_NO_ARRAY_STATE,
          locationFromOffset(ctx.source, eachStart, ctx.filename),
          { name: "unknown" },
        ),
      );
      return null;
    }

    const arrayVarName = eachExpr.name;
    const arrayStateVar = ctx.stateVars.find(
      (sv) => sv.name === arrayVarName && sv.type === "array",
    );
    if (!arrayStateVar) {
      ctx.errors.push(
        createError(
          ErrorCode.EACH_NO_ARRAY_STATE,
          locationFromOffset(ctx.source, eachStart, ctx.filename),
          { name: arrayVarName },
        ),
      );
      return null;
    }

    // Extract alias from node.context
    const contextNode = eachBlockNode.context;
    const alias = contextNode?.name ?? contextNode?.id?.name ?? "item";

    // Generate item component name
    const itemComponentName = `${ctx.componentName}_Item${ctx.eachCounter}`;
    ctx.eachCounter++;

    // Set eachContext and build body elements
    ctx.eachContext = {
      alias,
      arrayVar: arrayVarName,
      fieldBindings: [],
      indexName,
    };

    const bodyFragment = eachBlockNode.body as AST.Fragment;
    const itemChildren = buildFragment(bodyFragment, ctx);

    const fieldBindings = [...ctx.eachContext.fieldBindings];
    ctx.eachContext = null;

    // Parse itemSize
    let itemSize: [number, number] | undefined;
    if (itemSizeValue) {
      const match = itemSizeValue.match(/\[(\d+),\s*(\d+)\]/);
      if (match) {
        itemSize = [parseInt(match[1]!, 10), parseInt(match[2]!, 10)];
      }
    }

    // Create IRItemComponent
    const itemComponent: IRItemComponent = {
      name: itemComponentName,
      scriptUri: `pkg:/components/${itemComponentName}.brs`,
      children: itemChildren,
      fieldBindings,
      itemSize,
    };
    ctx.itemComponents.push(itemComponent);

    // Create IREachBlock
    const eachBlock: IREachBlock = {
      arrayVar: arrayVarName,
      itemAlias: alias,
      itemComponentName,
      listNodeId: id,
    };
    if (indexName) {
      eachBlock.indexName = indexName;
    }
    ctx.eachBlocks.push(eachBlock);

    // Add itemComponentName property to MarkupList
    properties.push({ name: "itemComponentName", value: itemComponentName });
  }

  const node: IRNode = {
    id,
    type: "MarkupList",
    properties,
    children: [],
  };

  return node;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleEachAttributeBinding(
  attr: SvelteAttribute,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exprTag: any,
  properties: IRProperty[],
  ctx: BuildContext,
): void {
  if (!ctx.eachContext) return;

  if (
    exprTag.type === "MemberExpression" &&
    exprTag.object?.type === "Identifier" &&
    exprTag.object.name === ctx.eachContext.alias &&
    exprTag.property?.type === "Identifier"
  ) {
    const field = exprTag.property.name;
    const sgField = ATTRIBUTE_MAP[attr.name];
    if (sgField) {
      // Will be set dynamically in onItemContentChanged — don't add to XML static props
      properties.push({ name: sgField, value: "", dynamic: true });
    }
    // Note: The actual binding is created by extractEachTextContent or post-ID resolution
    // For attributes, we create the binding now since we don't need textParts
    // We'll add it after the node id is resolved in buildElement.
    // Actually, we need to store it for post-processing
    (attr as SvelteAttribute & { _eachBinding?: { sgField: string; field: string } })._eachBinding = {
      sgField: sgField ?? attr.name,
      field,
    };
  } else if (exprTag.type === "Identifier") {
    // Plain identifier in each context — outer state ref
    if (ctx.stateVarNames.has(exprTag.name)) {
      ctx.errors.push(
        createError(
          ErrorCode.EACH_OUTER_STATE_REF,
          locationFromOffset(ctx.source, attr.start, ctx.filename),
          { name: exprTag.name },
        ),
      );
    }
  }
}

interface EachTextResult {
  type: "static" | "field";
  value?: string;
}

function extractEachTextContent(
  fragment: AST.Fragment,
  nodeId: string,
  ctx: BuildContext,
): EachTextResult {
  if (!ctx.eachContext) return { type: "static" };

  let hasFieldRefs = false;
  const parts: IRItemTextPart[] = [];

  for (const node of fragment.nodes) {
    if (node.type === "Text") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textNode = node as any;
      const text = textNode.data as string;
      if (text.trim()) {
        parts.push({ type: "static", value: text.trim() });
      }
    } else if (node.type === "ExpressionTag") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exprTag = node as any;
      const expr = exprTag.expression;

      if (
        expr?.type === "MemberExpression" &&
        expr.object?.type === "Identifier" &&
        expr.object.name === ctx.eachContext.alias &&
        expr.property?.type === "Identifier"
      ) {
        hasFieldRefs = true;
        parts.push({ type: "field", value: expr.property.name });
      } else if (expr?.type === "Identifier" && ctx.eachContext.indexName && expr.name === ctx.eachContext.indexName) {
        // Index variable reference: {i} → bind to __index field
        hasFieldRefs = true;
        parts.push({ type: "field", value: "__index" });
      } else if (expr?.type === "Identifier") {
        // Plain identifier in each context — outer state ref error
        if (ctx.stateVarNames.has(expr.name)) {
          ctx.errors.push(
            createError(
              ErrorCode.EACH_OUTER_STATE_REF,
              locationFromOffset(ctx.source, exprTag.start ?? 0, ctx.filename),
              { name: expr.name },
            ),
          );
        }
      }
    }
  }

  if (!hasFieldRefs) {
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

  // Create field binding
  const hasMultipleParts = parts.length > 1;
  if (hasMultipleParts) {
    // Mixed text: "Title: {item.title}" => textParts
    const fieldParts = parts.filter((p) => p.type === "field");
    ctx.eachContext.fieldBindings.push({
      nodeId,
      property: "text",
      field: fieldParts[0]!.value,
      textParts: parts,
    });
  } else if (parts.length === 1 && parts[0]!.type === "field") {
    // Simple field binding: {item.title}
    ctx.eachContext.fieldBindings.push({
      nodeId,
      property: "text",
      field: parts[0]!.value,
    });
  }

  return { type: "field" };
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
      } else if (exprTag.expression) {
        // Try transpiling the expression for template bindings
        const tCtx = createTranspileContext(ctx);
        tCtx.singleExpressionOnly = true;
        const result = transpileExpression(exprTag.expression, tCtx);

        if (tCtx.errors.length === 0 && result.code !== "invalid") {
          hasExpressions = true;
          if (tCtx.usesStdlib) {
            ctx.usesStdlib = true;
          }
          mergePolyfillContext(tCtx, ctx);
          // Store the transpiled expression — will be used for binding
          const deps = result.dependencies.filter(d => ctx.stateVarNames.has(d));
          // Create a binding with brsExpression
          ctx.bindings.push({
            nodeId,
            property: "text",
            stateVar: deps[0] ?? "",
            dependencies: deps.length > 0 ? [...new Set(deps)] : [],
            brsExpression: result.code,
          });
          return { type: "dynamic" };
        }
        // If transpilation failed, errors are already in tCtx.errors — push them
        ctx.errors.push(...tCtx.errors);
      }
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
    return cssColorToRokuHexValue(value);
  }
  if (sgField === "visible") {
    return value === "false" || value === "none" ? "false" : "true";
  }
  return value;
}

// Re-export for backward compatibility with tests
export { cssColorToRokuHexValue as cssColorToRokuHex };

function createTranspileContext(ctx: BuildContext): TranspileContext {
  const stateVarTypes = new Map<string, "number" | "string" | "boolean" | "array" | "object">();
  for (const sv of ctx.stateVars) {
    stateVarTypes.set(sv.name, sv.type);
  }
  return {
    stateVarNames: ctx.stateVarNames,
    stateVarTypes,
    singleExpressionOnly: false,
    tempVarCounter: 0,
    chainDepth: 0,
    errors: [],
    source: ctx.source,
    filename: ctx.filename,
    usesStdlib: false,
    requiredPolyfills: new Set(),
    extractedCallbacks: [],
    callbackCounter: ctx.callbackCounter,
  };
}

function tryTranspileAssignment(
  varName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rhs: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _stmt: any,
  statements: IRHandlerStatement[],
  mutatedVariables: string[],
  ctx: BuildContext,
): boolean {
  const tCtx = createTranspileContext(ctx);
  const result = transpileExpression(rhs, tCtx);

  if (tCtx.errors.length > 0) {
    ctx.errors.push(...tCtx.errors);
    return false;
  }

  if (tCtx.usesStdlib) {
    ctx.usesStdlib = true;
  }

  mergePolyfillContext(tCtx, ctx);

  statements.push({
    type: "assign-expr",
    variable: varName,
    brsCode: result.code,
    preamble: result.preamble,
  });

  if (!mutatedVariables.includes(varName)) {
    mutatedVariables.push(varName);
  }

  return true;
}

function tryTranspileStatement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stmt: any,
  statements: IRHandlerStatement[],
  mutatedVariables: string[],
  _funcName: string,
  ctx: BuildContext,
): boolean {
  const expr = stmt.expression;

  // Try assignment with transpiled RHS
  if (expr.type === "AssignmentExpression" && expr.operator === "=") {
    const varName = expr.left?.name;
    if (varName && ctx.stateVarNames.has(varName)) {
      return tryTranspileAssignment(varName, expr.right, stmt, statements, mutatedVariables, ctx);
    }
    // Local variable assignment (not state) — emit as var-decl (no m.state. prefix)
    if (varName) {
      const tCtx = createTranspileContext(ctx);
      const result = transpileExpression(expr.right, tCtx);
      if (tCtx.errors.length > 0) {
        ctx.errors.push(...tCtx.errors);
        return false;
      }
      if (tCtx.usesStdlib) ctx.usesStdlib = true;
      mergePolyfillContext(tCtx, ctx);
      statements.push({
        type: "var-decl",
        variable: varName,
        valueBrs: result.code,
        valuePreamble: result.preamble,
      });
      return true;
    }
  }

  // Try as standalone expression statement
  const tCtx = createTranspileContext(ctx);
  const result = transpileExpression(expr, tCtx);

  if (tCtx.errors.length > 0) {
    ctx.errors.push(...tCtx.errors);
    return false;
  }

  if (tCtx.usesStdlib) {
    ctx.usesStdlib = true;
  }

  mergePolyfillContext(tCtx, ctx);

  // Check if any state vars were mutated (e.g., arr.push() mutates the array)
  for (const dep of result.dependencies) {
    if (ctx.stateVarNames.has(dep) && !mutatedVariables.includes(dep)) {
      mutatedVariables.push(dep);
    }
  }

  // Don't emit empty statements (e.g., console.debug stripped)
  if (result.code === "") {
    return true;
  }

  statements.push({
    type: "expr-statement",
    brsCode: result.code,
    preamble: result.preamble,
  });

  return true;
}

function mergePolyfillContext(tCtx: TranspileContext, ctx: BuildContext): void {
  for (const p of tCtx.requiredPolyfills) {
    ctx.requiredPolyfills.add(p);
  }
  for (const cb of tCtx.extractedCallbacks) {
    ctx.extractedCallbacks.push(cb);
  }
  // Sync callback counter back
  ctx.callbackCounter = tCtx.callbackCounter;
}

// CSS properties that get a specific helpful warning
const UNSUPPORTED_CSS_HINTS: Record<string, string> = {
  margin: "Use padding on parent Group or explicit positioning.",
  "margin-top": "Use padding on parent Group or explicit positioning.",
  "margin-right": "Use padding on parent Group or explicit positioning.",
  "margin-bottom": "Use padding on parent Group or explicit positioning.",
  "margin-left": "Use padding on parent Group or explicit positioning.",
  border: "Use a Rectangle node behind your content.",
  "border-radius": "Border radius is not supported on Roku.",
  "box-shadow": "Box shadow is not supported on Roku.",
  "background-image": 'Use an <image> element instead.',
  overflow: "Use ScrollingGroup for scrollable content.",
  position: "All positioning is absolute on Roku.",
  "max-width": "Use explicit width instead.",
  "max-height": "Use explicit height instead.",
  "z-index": "Z-order is controlled by node order in SceneGraph.",
};

// Flex properties that get stored as metadata
const FLEX_PROPERTIES = new Set([
  "flex-direction", "justify-content", "align-items", "align-self",
  "flex", "flex-grow", "flex-wrap", "gap", "row-gap", "column-gap",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
]);

interface ParseInlineStyleResult {
  properties: IRProperty[];
  flexStyles?: Record<string, string>;
}

function parseInlineStyle(
  style: string | null,
  nodeType: SGNodeType,
  styleContext: StyleContext,
  source: string,
  filename: string,
  nodeOffset: number,
  warnings: CompileWarning[],
): ParseInlineStyleResult {
  if (!style) return { properties: [] };
  const props: IRProperty[] = [];
  let flexStyles: Record<string, string> | undefined;

  let translationX = 0;
  let translationY = 0;

  const lengthCtx: LengthContext = {
    parentFontSize: styleContext.parentFontSize,
    canvasWidth: styleContext.canvasWidth,
    canvasHeight: styleContext.canvasHeight,
    parentWidth: styleContext.parentWidth,
    parentHeight: styleContext.parentHeight,
  };

  const declarations = style
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);

  for (const decl of declarations) {
    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) continue;

    const cssProp = decl.slice(0, colonIndex).trim();
    const cssValue = decl.slice(colonIndex + 1).trim();

    // 1. display: none → visible: false
    if (cssProp === "display" && cssValue === "none") {
      props.push({ name: "visible", value: "false" });
      continue;
    }

    // 2. display: flex → store flex metadata
    if (cssProp === "display" && cssValue === "flex") {
      if (!flexStyles) flexStyles = {};
      flexStyles.display = "flex";
      continue;
    }

    // 3. visibility: hidden → visible: false
    if (cssProp === "visibility" && cssValue === "hidden") {
      props.push({ name: "visible", value: "false" });
      continue;
    }

    // 4. transform → parse and accumulate
    if (cssProp === "transform") {
      const result = parseTransform(cssValue);
      if (result.translation) {
        translationX += result.translation[0];
        translationY += result.translation[1];
      }
      if (result.rotation != null) {
        props.push({ name: "rotation", value: String(result.rotation) });
      }
      if (result.scale) {
        props.push({ name: "scale", value: `[${result.scale[0]}, ${result.scale[1]}]` });
      }
      continue;
    }

    // 5. left → accumulate into translationX
    if (cssProp === "left") {
      const resolved = resolveLength(cssValue, "width", lengthCtx);
      if (resolved != null) translationX += resolved;
      continue;
    }

    // 6. top → accumulate into translationY
    if (cssProp === "top") {
      const resolved = resolveLength(cssValue, "height", lengthCtx);
      if (resolved != null) translationY += resolved;
      continue;
    }

    // 7. text-align → horizAlign
    if (cssProp === "text-align") {
      const alignMap: Record<string, string> = { left: "left", center: "center", right: "right" };
      const mapped = alignMap[cssValue];
      if (mapped) {
        props.push({ name: "horizAlign", value: mapped });
      }
      continue;
    }

    // 8. white-space / word-wrap / overflow-wrap → wrap boolean
    if (cssProp === "white-space") {
      props.push({ name: "wrap", value: cssValue === "normal" || cssValue === "pre-wrap" ? "true" : "false" });
      continue;
    }
    if (cssProp === "word-wrap" || cssProp === "overflow-wrap") {
      props.push({ name: "wrap", value: cssValue === "break-word" || cssValue === "anywhere" ? "true" : "false" });
      continue;
    }

    // 9. font-weight → font via resolveFont
    if (cssProp === "font-weight") {
      const font = resolveFont(cssValue);
      if (font) {
        props.push({ name: "font", value: font });
      }
      continue;
    }

    // 10. font-family → ignored with no warning (Roku only has system fonts)
    if (cssProp === "font-family") {
      continue;
    }

    // 11. color → context-sensitive
    if (cssProp === "color") {
      if (nodeType === "Label") {
        props.push({ name: "color", value: cssColorToRokuHexValue(cssValue) });
      } else {
        warnings.push(
          createWarning(
            WarningCode.CSS_CONTEXT_MISMATCH,
            locationFromOffset(source, nodeOffset, filename),
            { property: "color", nodeType, hint: "CSS 'color' only applies to Label (text) nodes." },
          ),
        );
      }
      continue;
    }

    // 12. background-color → context-sensitive
    if (cssProp === "background-color") {
      if (nodeType === "Rectangle") {
        props.push({ name: "color", value: cssColorToRokuHexValue(cssValue) });
      } else {
        warnings.push(
          createWarning(
            WarningCode.CSS_CONTEXT_MISMATCH,
            locationFromOffset(source, nodeOffset, filename),
            { property: "background-color", nodeType, hint: "CSS 'background-color' only applies to Rectangle nodes." },
          ),
        );
      }
      continue;
    }

    // 13. Flex properties → store as metadata
    if (FLEX_PROPERTIES.has(cssProp)) {
      if (cssProp === "flex-wrap") {
        warnings.push(
          createWarning(
            WarningCode.UNSUPPORTED_CSS_HINT,
            locationFromOffset(source, nodeOffset, filename),
            { property: "flex-wrap", hint: "Use explicit sizing, flex-wrap is not supported." },
          ),
        );
      }
      if (!flexStyles) flexStyles = {};
      flexStyles[cssProp] = cssValue;
      continue;
    }

    // 14. Unsupported with specific hints
    const hint = UNSUPPORTED_CSS_HINTS[cssProp];
    if (hint) {
      warnings.push(
        createWarning(
          WarningCode.UNSUPPORTED_CSS_HINT,
          locationFromOffset(source, nodeOffset, filename),
          { property: cssProp, hint },
        ),
      );
      continue;
    }

    // 15. Generic CSS_PROPERTY_MAP lookup
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

    // Resolve numeric values via resolveLength
    const axis = sgField === "width" || sgField === "letterSpacing" ? "width" : "height";
    const resolved = resolveLength(cssValue, axis, lengthCtx);
    if (resolved != null) {
      props.push({ name: sgField, value: String(resolved) });
    } else {
      props.push({ name: sgField, value: convertValue(sgField, cssValue) });
    }
  }

  // Emit accumulated translation
  if (translationX !== 0 || translationY !== 0) {
    props.push({ name: "translation", value: `[${translationX}, ${translationY}]` });
  }

  return { properties: props, flexStyles };
}
