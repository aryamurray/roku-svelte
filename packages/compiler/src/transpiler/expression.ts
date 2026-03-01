import type { CompileError } from "../errors/types.js";
import { ErrorCode } from "../errors/types.js";
import { createError, locationFromOffset } from "../errors/formatter.js";
import {
  ARRAY_METHODS,
  ARRAY_PROPERTIES,
  STRING_METHODS,
  STRING_PROPERTIES,
  MATH_METHODS,
  MATH_CONSTANTS,
  OBJECT_STATIC_METHODS,
  OBJECT_INSTANCE_METHODS,
  JSON_METHODS,
  CONSOLE_METHODS,
  ARRAY_STATIC_METHODS,
  STRING_STATIC_METHODS,
  FUNCTIONAL_METHODS,
} from "./stdlib.js";
import {
  TIMER_FUNCTIONS,
  BASE64_FUNCTIONS,
  CONSTRUCTOR_MAP,
  DATE_STATIC_METHODS,
  DATE_INSTANCE_METHODS,
  URL_INSTANCE_METHODS,
  URL_SEARCH_PARAMS_METHODS,
  STORAGE_METHODS,
  EVENT_TARGET_METHODS,
  ABORT_CONTROLLER_METHODS,
  HEADERS_METHODS,
  MAP_METHODS,
  MAP_PROPERTIES,
  SET_METHODS,
  SET_PROPERTIES,
  NAVIGATOR_PROPERTIES,
  WINDOW_PROPERTIES,
  WINDOW_LOCATION_PROPERTIES,
  TYPEOF_CONSTANTS,
} from "./browser.js";
import type { IRHandler, IRHandlerStatement } from "../ir/types.js";

export interface TranspileContext {
  stateVarNames: Set<string>;
  stateVarTypes: Map<string, "number" | "string" | "boolean" | "array" | "object">;
  singleExpressionOnly: boolean;
  tempVarCounter: number;
  chainDepth: number;
  errors: CompileError[];
  source: string;
  filename: string;
  usesStdlib: boolean;
  requiredPolyfills: Set<string>;
  extractedCallbacks: IRHandler[];
  callbackCounter: number;
}

export interface TranspileResult {
  code: string;
  dependencies: string[];
  preamble?: string[];
  tempVarName?: string;
  extractedCallbacks?: IRHandler[];
}

const MAX_CHAIN_DEPTH = 4;

const BINARY_OP_MAP: Record<string, string> = {
  "===": "=",
  "!==": "<>",
  "==": "=",
  "!=": "<>",
  "&&": "and",
  "||": "or",
  "+": "+",
  "-": "-",
  "*": "*",
  "/": "/",
  "%": "MOD",
  "<": "<",
  ">": ">",
  "<=": "<=",
  ">=": ">=",
  "**": "^",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transpileExpression(node: any, ctx: TranspileContext): TranspileResult {
  switch (node.type) {
    case "Identifier":
      return transpileIdentifier(node, ctx);
    case "Literal":
      return transpileLiteral(node);
    case "MemberExpression":
      return transpileMemberExpression(node, ctx);
    case "CallExpression":
      return transpileCallExpression(node, ctx);
    case "BinaryExpression":
    case "LogicalExpression":
      return transpileBinaryExpression(node, ctx);
    case "UnaryExpression":
      return transpileUnaryExpression(node, ctx);
    case "TemplateLiteral":
      return transpileTemplateLiteral(node, ctx);
    case "ConditionalExpression":
      return transpileConditionalExpression(node, ctx);
    case "ObjectExpression":
      return transpileObjectExpression(node, ctx);
    case "ArrayExpression":
      return transpileArrayExpression(node, ctx);
    case "NewExpression":
      return transpileNewExpression(node, ctx);
    case "ChainExpression":
      return transpileChainExpression(node, ctx);
    default: {
      ctx.errors.push(
        createError(
          ErrorCode.UNSUPPORTED_EXPRESSION,
          locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
          { expression: ctx.source.slice(node.start, node.end) },
        ),
      );
      return { code: "invalid", dependencies: [] };
    }
  }
}

/**
 * Check if an expression can be transpiled as a single BRS expression
 * (no multi-line expansion needed). Used by validation for template expressions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function canTranspileAsSingleExpression(node: any): boolean {
  switch (node.type) {
    case "Identifier":
    case "Literal":
      return true;

    case "MemberExpression": {
      // Allow property access and simple method-result references
      if (!canTranspileAsSingleExpression(node.object)) return false;
      // Computed with non-literal → not single-expression
      if (node.computed && node.property?.type !== "Literal") return false;
      return true;
    }

    case "CallExpression": {
      const callee = node.callee;
      // Method calls: check if the method is a functional method requiring multi-line
      if (callee?.type === "MemberExpression") {
        const methodName = callee.property?.name;
        if (FUNCTIONAL_METHODS.has(methodName)) return false;
      }
      // Check all arguments are single-expression
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const arg of node.arguments ?? []) {
        if (!canTranspileAsSingleExpression(arg)) return false;
      }
      // Check callee is transpilable
      if (callee?.type === "MemberExpression") {
        // Allow Math.floor(x), console.log(x), JSON.parse(x), Date.now(), etc.
        if (callee.object?.type === "Identifier") {
          const objName = callee.object.name;
          if (["Math", "JSON", "console", "Object", "Array", "String", "Date"].includes(objName)) return true;
        }
        // Allow receiver.method()
        return canTranspileAsSingleExpression(callee.object);
      }
      if (callee?.type === "Identifier") return true;
      return false;
    }

    case "BinaryExpression":
    case "LogicalExpression":
      if (node.operator === "??") {
        // ?? uses SvelteRoku_iif in single-expression mode
        return (
          canTranspileAsSingleExpression(node.left) &&
          canTranspileAsSingleExpression(node.right)
        );
      }
      return (
        canTranspileAsSingleExpression(node.left) &&
        canTranspileAsSingleExpression(node.right) &&
        node.operator in BINARY_OP_MAP
      );

    case "UnaryExpression":
      if (node.operator === "typeof") return true;
      return (
        (node.operator === "!" || node.operator === "-" || node.operator === "+") &&
        canTranspileAsSingleExpression(node.argument)
      );

    case "NewExpression": {
      const ctorName = node.callee?.name;
      if (ctorName && ctorName in CONSTRUCTOR_MAP) return true;
      return false;
    }

    case "TemplateLiteral":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (node.expressions ?? []).every((e: any) => canTranspileAsSingleExpression(e));

    case "ConditionalExpression":
      return (
        canTranspileAsSingleExpression(node.test) &&
        canTranspileAsSingleExpression(node.consequent) &&
        canTranspileAsSingleExpression(node.alternate)
      );

    case "ChainExpression":
      return false;

    default:
      return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileIdentifier(node: any, ctx: TranspileContext): TranspileResult {
  const name = node.name;
  if (ctx.stateVarNames.has(name)) {
    return { code: `m.state.${name}`, dependencies: [name] };
  }
  return { code: name, dependencies: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileLiteral(node: any): TranspileResult {
  if (typeof node.value === "string") {
    return { code: `"${escapeString(node.value)}"`, dependencies: [] };
  }
  if (typeof node.value === "boolean") {
    return { code: node.value ? "true" : "false", dependencies: [] };
  }
  if (typeof node.value === "number") {
    return { code: String(node.value), dependencies: [] };
  }
  if (node.value === null) {
    return { code: "invalid", dependencies: [] };
  }
  return { code: String(node.value), dependencies: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileMemberExpression(node: any, ctx: TranspileContext): TranspileResult {
  const obj = node.object;
  const prop = node.property;

  // Math constants: Math.PI, Math.E
  if (obj?.type === "Identifier" && obj.name === "Math" && prop?.type === "Identifier") {
    const constant = MATH_CONSTANTS[prop.name];
    if (constant) {
      return { code: constant, dependencies: [] };
    }
  }

  // navigator.* property access
  if (obj?.type === "Identifier" && obj.name === "navigator" && prop?.type === "Identifier") {
    const navProp = NAVIGATOR_PROPERTIES[prop.name];
    if (navProp) {
      return { code: navProp.code, dependencies: [] };
    }
  }

  // window.location.* access
  if (
    obj?.type === "MemberExpression" &&
    obj.object?.type === "Identifier" &&
    obj.object.name === "window" &&
    obj.property?.type === "Identifier" &&
    obj.property.name === "location" &&
    prop?.type === "Identifier"
  ) {
    const locProp = WINDOW_LOCATION_PROPERTIES[prop.name];
    if (locProp) {
      return { code: locProp.code, dependencies: [] };
    }
  }

  // window.* property access
  if (obj?.type === "Identifier" && obj.name === "window" && prop?.type === "Identifier") {
    const winProp = WINDOW_PROPERTIES[prop.name];
    if (winProp) {
      return { code: winProp.code, dependencies: [] };
    }
    // window.location is handled by nested access above, fall through for general access
  }

  // Map/Set .size property
  if (prop?.type === "Identifier" && prop.name === "size" && !node.computed) {
    const receiverType = inferBrowserType(obj, ctx);
    if (receiverType === "Map") {
      const objResult = transpileExpression(obj, ctx);
      ctx.requiredPolyfills.add("Collections");
      return { code: `SvelteRoku_mapSize(${objResult.code})`, dependencies: objResult.dependencies };
    }
    if (receiverType === "Set") {
      const objResult = transpileExpression(obj, ctx);
      ctx.requiredPolyfills.add("Collections");
      return { code: `SvelteRoku_setSize(${objResult.code})`, dependencies: objResult.dependencies };
    }
  }

  // Property access: .length etc.
  if (prop?.type === "Identifier" && !node.computed) {
    const propName = prop.name;
    const objResult = transpileExpression(obj, ctx);

    // Detect type for .length disambiguation
    if (propName === "length") {
      const receiverType = inferType(obj, ctx);
      if (receiverType === "array") {
        return { code: `${objResult.code}.Count()`, dependencies: objResult.dependencies, preamble: objResult.preamble, tempVarName: objResult.tempVarName };
      }
      if (receiverType === "string") {
        return { code: `Len(${objResult.code})`, dependencies: objResult.dependencies, preamble: objResult.preamble, tempVarName: objResult.tempVarName };
      }
      // Unknown type — use runtime helper
      ctx.usesStdlib = true;
      return { code: `SvelteRoku_length(${objResult.code})`, dependencies: objResult.dependencies, preamble: objResult.preamble, tempVarName: objResult.tempVarName };
    }

    // General property access
    return { code: `${objResult.code}.${propName}`, dependencies: objResult.dependencies, preamble: objResult.preamble, tempVarName: objResult.tempVarName };
  }

  // Computed access: arr[0], obj["key"]
  if (node.computed) {
    const objResult = transpileExpression(obj, ctx);
    const propResult = transpileExpression(prop, ctx);
    return {
      code: `${objResult.code}[${propResult.code}]`,
      dependencies: [...objResult.dependencies, ...propResult.dependencies],
    };
  }

  const objResult = transpileExpression(obj, ctx);
  return { code: `${objResult.code}.${prop?.name ?? ""}`, dependencies: objResult.dependencies };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileCallExpression(node: any, ctx: TranspileContext): TranspileResult {
  const callee = node.callee;
  const args = node.arguments ?? [];

  // Static global calls: Math.floor(x), JSON.parse(x), etc.
  if (callee?.type === "MemberExpression" && callee.object?.type === "Identifier") {
    const objName = callee.object.name;
    const methodName = callee.property?.name;

    if (objName === "Math") return transpileMathCall(methodName, args, ctx, node);
    if (objName === "JSON") return transpileJsonCall(methodName, args, ctx, node);
    if (objName === "console") return transpileConsoleCall(methodName, args, ctx, node);
    if (objName === "Object") return transpileObjectStaticCall(methodName, args, ctx, node);
    if (objName === "Array") return transpileArrayStaticCall(methodName, args, ctx, node);
    if (objName === "String") return transpileStringStaticCall(methodName, args, ctx, node);
    if (objName === "Date") return transpileDateStaticCall(methodName, args, ctx, node);

    // localStorage.method() / sessionStorage.method()
    if (objName === "localStorage" || objName === "sessionStorage") {
      return transpileStorageCall(methodName, args, ctx, node);
    }
  }

  // Instance method calls: arr.push(x), str.toLowerCase()
  if (callee?.type === "MemberExpression") {
    const methodName = callee.property?.name;
    return transpileInstanceMethodCall(callee.object, methodName, args, ctx, node);
  }

  // Plain function call — check for browser API globals first
  if (callee?.type === "Identifier") {
    const funcName = callee.name;

    // Timer functions
    const timerEntry = TIMER_FUNCTIONS[funcName];
    if (timerEntry) {
      return transpileTimerCall(funcName, timerEntry, args, ctx, node);
    }

    // Base64 functions
    const base64Entry = BASE64_FUNCTIONS[funcName];
    if (base64Entry) {
      if (base64Entry.polyfill) ctx.requiredPolyfills.add(base64Entry.polyfill);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transpiled = args.map((a: any) => transpileExpression(a, ctx));
      const allDeps = transpiled.flatMap((r: TranspileResult) => r.dependencies);
      const argCodes = transpiled.map((r: TranspileResult) => r.code);
      return { code: `${base64Entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transpiled = args.map((a: any) => transpileExpression(a, ctx));
    const allDeps = transpiled.flatMap((r: TranspileResult) => r.dependencies);
    const argCodes = transpiled.map((r: TranspileResult) => r.code);
    return { code: `${callee.name}(${argCodes.join(", ")})`, dependencies: allDeps };
  }

  ctx.errors.push(
    createError(
      ErrorCode.UNSUPPORTED_EXPRESSION,
      locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
      { expression: ctx.source.slice(node.start, node.end) },
    ),
  );
  return { code: "invalid", dependencies: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileMathCall(methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  const entry = MATH_METHODS[methodName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_STDLIB_METHOD,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { method: `Math.${methodName}` },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r) => r.dependencies);
  const argCodes = transpiled.map((r) => r.code);

  switch (entry.strategy) {
    case "function-wrap":
      return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
    case "operator":
      if (argCodes.length === 2) {
        return { code: `${argCodes[0]} ${entry.brs} ${argCodes[1]}`, dependencies: allDeps };
      }
      return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
    case "special":
      if (methodName === "random") {
        return { code: "Rnd(0)", dependencies: [] };
      }
      return { code: "invalid", dependencies: [] };
    case "inline":
      if (methodName === "log2") {
        return { code: `(Log(${argCodes[0]}) / Log(2))`, dependencies: allDeps };
      }
      if (methodName === "log10") {
        return { code: `(Log(${argCodes[0]}) / Log(10))`, dependencies: allDeps };
      }
      return { code: "invalid", dependencies: [] };
    case "runtime-helper":
      ctx.usesStdlib = true;
      return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
    default:
      return { code: "invalid", dependencies: [] };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileJsonCall(methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  const entry = JSON_METHODS[methodName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_STDLIB_METHOD,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { method: `JSON.${methodName}` },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r) => r.dependencies);
  const argCodes = transpiled.map((r) => r.code);
  return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileConsoleCall(methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  const entry = CONSOLE_METHODS[methodName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_STDLIB_METHOD,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { method: `console.${methodName}` },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  if (methodName === "debug") {
    // Strip debug calls — emit nothing
    return { code: "", dependencies: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r) => r.dependencies);
  const argCodes = transpiled.map((r) => r.code);

  if (methodName === "log") {
    return { code: `print ${argCodes.join("; ")}`, dependencies: allDeps };
  }

  // warn and error: prepend prefix
  const prefix = methodName === "warn" ? "[WARN] " : "[ERROR] ";
  return { code: `print "${prefix}" + ${argCodes.join(" + ")}`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileObjectStaticCall(methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  const entry = OBJECT_STATIC_METHODS[methodName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_STDLIB_METHOD,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { method: `Object.${methodName}` },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r) => r.dependencies);
  const argCodes = transpiled.map((r) => r.code);

  switch (entry.strategy) {
    case "rename":
      if (methodName === "keys") {
        return { code: `${argCodes[0]}.Keys()`, dependencies: allDeps };
      }
      if (methodName === "hasOwn") {
        return { code: `${argCodes[0]}.DoesExist(${argCodes[1]})`, dependencies: allDeps };
      }
      return { code: "invalid", dependencies: [] };
    case "special":
      if (methodName === "assign") {
        // Object.assign(target, source) → target.Append(source)
        if (argCodes.length >= 2) {
          return { code: `${argCodes[0]}.Append(${argCodes[1]})`, dependencies: allDeps };
        }
        return { code: argCodes[0] ?? "invalid", dependencies: allDeps };
      }
      if (methodName === "freeze") {
        // No-op, return the object
        return { code: argCodes[0] ?? "invalid", dependencies: allDeps };
      }
      return { code: "invalid", dependencies: [] };
    case "runtime-helper":
      ctx.usesStdlib = true;
      return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
    default:
      return { code: "invalid", dependencies: [] };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileArrayStaticCall(methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  const entry = ARRAY_STATIC_METHODS[methodName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_STDLIB_METHOD,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { method: `Array.${methodName}` },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r) => r.dependencies);
  const argCodes = transpiled.map((r) => r.code);

  ctx.usesStdlib = true;
  return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileStringStaticCall(methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  const entry = STRING_STATIC_METHODS[methodName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_STDLIB_METHOD,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { method: `String.${methodName}` },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r) => r.dependencies);
  const argCodes = transpiled.map((r) => r.code);

  if (methodName === "fromCharCode") {
    return { code: `Chr(${argCodes[0]})`, dependencies: allDeps };
  }

  return { code: "invalid", dependencies: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileInstanceMethodCall(obj: any, methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  // Check for Object instance methods first
  const objEntry = OBJECT_INSTANCE_METHODS[methodName];
  if (objEntry) {
    const objResult = transpileExpression(obj, ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transpiled = args.map((a: any) => transpileExpression(a, ctx));
    const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
    const argCodes = transpiled.map((r) => r.code);
    return { code: `${objResult.code}.DoesExist(${argCodes[0]})`, dependencies: allDeps };
  }

  // Determine receiver type
  const receiverType = inferType(obj, ctx);

  // Try array methods
  if (receiverType === "array" || receiverType === "unknown") {
    const arrayEntry = ARRAY_METHODS[methodName];
    if (arrayEntry) {
      return transpileArrayMethod(obj, methodName, args, arrayEntry, ctx, node);
    }
  }

  // Try string methods
  if (receiverType === "string" || receiverType === "unknown") {
    const stringEntry = STRING_METHODS[methodName];
    if (stringEntry) {
      return transpileStringMethod(obj, methodName, args, stringEntry, ctx, node);
    }
  }

  // If the type is known but no method matched, try the other set as fallback
  if (receiverType === "array") {
    const stringEntry = STRING_METHODS[methodName];
    if (stringEntry) {
      return transpileStringMethod(obj, methodName, args, stringEntry, ctx, node);
    }
  }
  if (receiverType === "string") {
    const arrayEntry = ARRAY_METHODS[methodName];
    if (arrayEntry) {
      return transpileArrayMethod(obj, methodName, args, arrayEntry, ctx, node);
    }
  }

  // Browser API instance methods
  const browserResult = transpileBrowserInstanceMethod(obj, methodName, args, ctx, node);
  if (browserResult) return browserResult;

  // Unknown method — error
  ctx.errors.push(
    createError(
      ErrorCode.UNSUPPORTED_STDLIB_METHOD,
      locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
      { method: `.${methodName}()` },
    ),
  );
  return { code: "invalid", dependencies: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileArrayMethod(obj: any, methodName: string, args: any[], entry: any, ctx: TranspileContext, node: any): TranspileResult {
  const objResult = transpileExpression(obj, ctx);

  // Functional methods requiring multi-line expansion
  if (entry.multiLine) {
    if (ctx.singleExpressionOnly) {
      ctx.errors.push(
        createError(
          ErrorCode.FUNCTIONAL_IN_TEMPLATE,
          locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
          { method: methodName },
        ),
      );
      return { code: "invalid", dependencies: [] };
    }

    if (ctx.chainDepth >= MAX_CHAIN_DEPTH) {
      ctx.errors.push(
        createError(
          ErrorCode.UNSUPPORTED_HANDLER_BODY,
          locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
          { handler: "chain too deep" },
        ),
      );
      return { code: "invalid", dependencies: [] };
    }

    return expandFunctionalMethod(objResult, methodName, args, ctx, node);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
  const argCodes = transpiled.map((r) => r.code);

  switch (entry.strategy) {
    case "rename":
      return { code: `${objResult.code}.${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps, preamble: objResult.preamble, tempVarName: objResult.tempVarName };
    case "runtime-helper":
      ctx.usesStdlib = true;
      return { code: `${entry.brs}(${objResult.code}, ${argCodes.join(", ")})`, dependencies: allDeps, preamble: objResult.preamble, tempVarName: objResult.tempVarName };
    default:
      return { code: "invalid", dependencies: [] };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileStringMethod(obj: any, methodName: string, args: any[], entry: any, ctx: TranspileContext, node: any): TranspileResult {
  const objResult = transpileExpression(obj, ctx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
  const argCodes = transpiled.map((r) => r.code);

  switch (entry.strategy) {
    case "rename":
      return { code: `${objResult.code}.${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
    case "function-wrap":
      return { code: `${entry.brs}(${objResult.code})`, dependencies: allDeps };
    case "inline":
      return transpileInlineStringMethod(objResult, methodName, argCodes, allDeps);
    case "runtime-helper":
      ctx.usesStdlib = true;
      return { code: `${entry.brs}(${objResult.code}, ${argCodes.join(", ")})`, dependencies: allDeps };
    default:
      return { code: "invalid", dependencies: [] };
  }
}

function transpileInlineStringMethod(
  objResult: TranspileResult,
  methodName: string,
  argCodes: string[],
  deps: string[],
): TranspileResult {
  const obj = objResult.code;
  switch (methodName) {
    case "includes":
      return { code: `(Instr(1, ${obj}, ${argCodes[0]}) > 0)`, dependencies: deps };
    case "startsWith":
      return { code: `(Left(${obj}, Len(${argCodes[0]})) = ${argCodes[0]})`, dependencies: deps };
    case "endsWith":
      return { code: `(Right(${obj}, Len(${argCodes[0]})) = ${argCodes[0]})`, dependencies: deps };
    case "indexOf":
      return { code: `(Instr(1, ${obj}, ${argCodes[0]}) - 1)`, dependencies: deps };
    case "charAt":
      return { code: `Mid(${obj}, ${argCodes[0]} + 1, 1)`, dependencies: deps };
    case "charCodeAt":
      return { code: `Asc(Mid(${obj}, ${argCodes[0]} + 1, 1))`, dependencies: deps };
    default:
      return { code: "invalid", dependencies: [] };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function expandFunctionalMethod(objResult: TranspileResult, methodName: string, args: any[], ctx: TranspileContext, _node: any): TranspileResult {
  const tmpName = `__tmp_${ctx.tempVarCounter++}`;
  const preamble: string[] = objResult.preamble ? [...objResult.preamble] : [];
  const receiver = objResult.tempVarName ?? objResult.code;
  const allDeps = [...objResult.dependencies];

  ctx.chainDepth++;

  // Extract the callback function
  const callback = args[0];
  if (!callback || (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression")) {
    ctx.chainDepth--;
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_HANDLER_BODY,
        locationFromOffset(ctx.source, _node.start ?? 0, ctx.filename),
        { handler: methodName },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  // Only support expression bodies for arrow functions
  if (callback.type === "ArrowFunctionExpression" && callback.body?.type === "BlockStatement") {
    ctx.chainDepth--;
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_HANDLER_BODY,
        locationFromOffset(ctx.source, _node.start ?? 0, ctx.filename),
        { handler: methodName },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  // Get param name(s)
  const params = callback.params ?? [];
  const itemParam = params[0]?.name ?? "__item";
  const accParam = params.length > 1 ? params[0]?.name : undefined;
  const itemParamForReduce = params.length > 1 ? params[1]?.name : itemParam;

  // Create a sub-context that treats the callback param as a local (not state) var
  const subCtx: TranspileContext = {
    ...ctx,
    stateVarNames: new Set(ctx.stateVarNames),
  };
  // Remove callback param from state var names so it resolves as local
  subCtx.stateVarNames.delete(itemParam);
  if (accParam) subCtx.stateVarNames.delete(accParam);
  if (itemParamForReduce) subCtx.stateVarNames.delete(itemParamForReduce);

  // Get the body expression
  const bodyExpr = callback.body?.type === "BlockStatement"
    ? callback.body.body?.[0]?.argument ?? callback.body.body?.[0]?.expression
    : callback.body;

  const bodyResult = bodyExpr ? transpileExpression(bodyExpr, subCtx) : { code: "invalid", dependencies: [] };
  allDeps.push(...bodyResult.dependencies);

  switch (methodName) {
    case "map": {
      preamble.push(`${tmpName} = []`);
      preamble.push(`for each ${itemParam} in ${receiver}`);
      preamble.push(`  ${tmpName}.Push(${bodyResult.code})`);
      preamble.push("end for");
      break;
    }
    case "filter": {
      preamble.push(`${tmpName} = []`);
      preamble.push(`for each ${itemParam} in ${receiver}`);
      preamble.push(`  if ${bodyResult.code} then ${tmpName}.Push(${itemParam})`);
      preamble.push("end for");
      break;
    }
    case "reduce": {
      const initArg = args[1];
      const initResult = initArg ? transpileExpression(initArg, ctx) : { code: "0", dependencies: [] };
      allDeps.push(...initResult.dependencies);
      preamble.push(`${tmpName} = ${initResult.code}`);
      preamble.push(`for each ${itemParamForReduce} in ${receiver}`);
      // In reduce, the body expression references acc and item
      // We need to substitute acc with tmpName
      const reduceBody = bodyResult.code.replace(new RegExp(`\\b${accParam}\\b`, "g"), tmpName);
      preamble.push(`  ${tmpName} = ${reduceBody}`);
      preamble.push("end for");
      break;
    }
    case "find": {
      preamble.push(`${tmpName} = invalid`);
      preamble.push(`for each ${itemParam} in ${receiver}`);
      preamble.push(`  if ${bodyResult.code} then`);
      preamble.push(`    ${tmpName} = ${itemParam}`);
      preamble.push("    exit for");
      preamble.push("  end if");
      preamble.push("end for");
      break;
    }
    case "findIndex": {
      const counterName = `__idx_${ctx.tempVarCounter++}`;
      preamble.push(`${tmpName} = -1`);
      preamble.push(`${counterName} = 0`);
      preamble.push(`for each ${itemParam} in ${receiver}`);
      preamble.push(`  if ${bodyResult.code} then`);
      preamble.push(`    ${tmpName} = ${counterName}`);
      preamble.push("    exit for");
      preamble.push("  end if");
      preamble.push(`  ${counterName} = ${counterName} + 1`);
      preamble.push("end for");
      break;
    }
    case "some": {
      preamble.push(`${tmpName} = false`);
      preamble.push(`for each ${itemParam} in ${receiver}`);
      preamble.push(`  if ${bodyResult.code} then`);
      preamble.push(`    ${tmpName} = true`);
      preamble.push("    exit for");
      preamble.push("  end if");
      preamble.push("end for");
      break;
    }
    case "every": {
      preamble.push(`${tmpName} = true`);
      preamble.push(`for each ${itemParam} in ${receiver}`);
      preamble.push(`  if not (${bodyResult.code}) then`);
      preamble.push(`    ${tmpName} = false`);
      preamble.push("    exit for");
      preamble.push("  end if");
      preamble.push("end for");
      break;
    }
    case "forEach": {
      preamble.push(`for each ${itemParam} in ${receiver}`);
      preamble.push(`  ${bodyResult.code}`);
      preamble.push("end for");
      ctx.chainDepth--;
      return { code: "", dependencies: allDeps, preamble };
    }
    case "flatMap": {
      preamble.push(`${tmpName} = []`);
      preamble.push(`for each ${itemParam} in ${receiver}`);
      preamble.push(`  __flatItem = ${bodyResult.code}`);
      preamble.push('  if type(__flatItem) = "roArray" then');
      preamble.push(`    for each __fi in __flatItem`);
      preamble.push(`      ${tmpName}.Push(__fi)`);
      preamble.push("    end for");
      preamble.push("  else");
      preamble.push(`    ${tmpName}.Push(__flatItem)`);
      preamble.push("  end if");
      preamble.push("end for");
      break;
    }
  }

  ctx.chainDepth--;

  return {
    code: tmpName,
    dependencies: allDeps,
    preamble,
    tempVarName: tmpName,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileBinaryExpression(node: any, ctx: TranspileContext): TranspileResult {
  // Nullish coalescing: a ?? b → temp-var pattern
  if (node.operator === "??") {
    return transpileNullishCoalescing(node, ctx);
  }

  const op = BINARY_OP_MAP[node.operator];
  if (!op) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_EXPRESSION,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { expression: ctx.source.slice(node.start, node.end) },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  const left = transpileExpression(node.left, ctx);
  const right = transpileExpression(node.right, ctx);

  return {
    code: `(${left.code} ${op} ${right.code})`,
    dependencies: [...left.dependencies, ...right.dependencies],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileNullishCoalescing(node: any, ctx: TranspileContext): TranspileResult {
  const left = transpileExpression(node.left, ctx);
  const right = transpileExpression(node.right, ctx);
  const allDeps = [...left.dependencies, ...right.dependencies];

  if (ctx.singleExpressionOnly) {
    // In single-expression context, use SvelteRoku_iif helper
    ctx.usesStdlib = true;
    return {
      code: `SvelteRoku_iif(${left.code} <> invalid, ${left.code}, ${right.code})`,
      dependencies: allDeps,
    };
  }

  const tmp = `__nc_${ctx.tempVarCounter++}`;
  const preamble: string[] = [];
  if (left.preamble) preamble.push(...left.preamble);
  if (right.preamble) preamble.push(...right.preamble);
  preamble.push(`${tmp} = ${right.code}`);
  preamble.push(`if ${left.code} <> invalid then ${tmp} = ${left.code}`);

  return { code: tmp, dependencies: allDeps, preamble, tempVarName: tmp };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileUnaryExpression(node: any, ctx: TranspileContext): TranspileResult {
  if (node.operator === "typeof") {
    return transpileTypeof(node.argument, ctx);
  }

  const arg = transpileExpression(node.argument, ctx);

  if (node.operator === "!") {
    return { code: `not ${arg.code}`, dependencies: arg.dependencies };
  }
  if (node.operator === "-") {
    return { code: `(-${arg.code})`, dependencies: arg.dependencies };
  }
  if (node.operator === "+") {
    return { code: arg.code, dependencies: arg.dependencies };
  }

  return { code: "invalid", dependencies: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileTypeof(argument: any, ctx: TranspileContext): TranspileResult {
  // Constant-fold known globals
  if (argument.type === "Identifier") {
    const name = argument.name;
    const constant = TYPEOF_CONSTANTS[name];
    if (constant) {
      return { code: constant, dependencies: [] };
    }
    // State variable — use runtime type()
    if (ctx.stateVarNames.has(name)) {
      return { code: `type(m.state.${name})`, dependencies: [name] };
    }
  }
  // Fall through to BRS type() call
  const arg = transpileExpression(argument, ctx);
  return { code: `type(${arg.code})`, dependencies: arg.dependencies };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileTemplateLiteral(node: any, ctx: TranspileContext): TranspileResult {
  const parts: string[] = [];
  const allDeps: string[] = [];

  for (let i = 0; i < node.quasis.length; i++) {
    const quasi = node.quasis[i];
    if (quasi.value.cooked) {
      parts.push(`"${escapeString(quasi.value.cooked)}"`);
    }
    if (i < node.expressions.length) {
      const expr = transpileExpression(node.expressions[i], ctx);
      allDeps.push(...expr.dependencies);
      parts.push(`Str(${expr.code}).Trim()`);
    }
  }

  // Filter out empty string parts
  const nonEmpty = parts.filter((p) => p !== '""');
  if (nonEmpty.length === 0) return { code: '""', dependencies: allDeps };

  return { code: nonEmpty.join(" + "), dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileConditionalExpression(node: any, ctx: TranspileContext): TranspileResult {
  const test = transpileExpression(node.test, ctx);
  const consequent = transpileExpression(node.consequent, ctx);
  const alternate = transpileExpression(node.alternate, ctx);

  // BrightScript ternary: if(cond, then, else) — actually BRS doesn't have ternary
  // Use inline if: (function() : if cond then return a else return b : end function)()
  // Actually, let's use a simpler approach with a runtime helper
  // Or just use: if cond then result = a else result = b — but that requires preamble
  // For single expression context, we need an inline form
  // BRS has no ternary operator, so we'll use a helper function
  ctx.usesStdlib = true;
  return {
    code: `SvelteRoku_iif(${test.code}, ${consequent.code}, ${alternate.code})`,
    dependencies: [...test.dependencies, ...consequent.dependencies, ...alternate.dependencies],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileObjectExpression(node: any, ctx: TranspileContext): TranspileResult {
  const allDeps: string[] = [];
  const entries: string[] = [];

  for (const prop of node.properties ?? []) {
    if (prop.type === "Property") {
      const key = prop.key?.name ?? prop.key?.value;
      if (!key) continue;
      const valResult = transpileExpression(prop.value, ctx);
      allDeps.push(...valResult.dependencies);
      entries.push(`"${key}": ${valResult.code}`);
    }
  }

  return { code: `{ ${entries.join(", ")} }`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileArrayExpression(node: any, ctx: TranspileContext): TranspileResult {
  const allDeps: string[] = [];
  const elems = node.elements ?? [];

  // Check for spread elements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasSpread = elems.some((e: any) => e?.type === "SpreadElement");

  if (!hasSpread) {
    const elements: string[] = [];
    for (const elem of elems) {
      if (!elem) {
        elements.push("invalid");
        continue;
      }
      const result = transpileExpression(elem, ctx);
      allDeps.push(...result.dependencies);
      elements.push(result.code);
    }
    return { code: `[${elements.join(", ")}]`, dependencies: allDeps };
  }

  // Spread elements present — requires multi-line expansion
  if (ctx.singleExpressionOnly) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_EXPRESSION,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { expression: "spread in template" },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  const tmp = `__spread_${ctx.tempVarCounter++}`;
  const preamble: string[] = [];
  preamble.push(`${tmp} = []`);

  for (const elem of elems) {
    if (!elem) continue;
    if (elem.type === "SpreadElement") {
      const result = transpileExpression(elem.argument, ctx);
      allDeps.push(...result.dependencies);
      if (result.preamble) preamble.push(...result.preamble);
      preamble.push(`${tmp}.Append(${result.code})`);
    } else {
      const result = transpileExpression(elem, ctx);
      allDeps.push(...result.dependencies);
      if (result.preamble) preamble.push(...result.preamble);
      preamble.push(`${tmp}.Push(${result.code})`);
    }
  }

  return { code: tmp, dependencies: allDeps, preamble, tempVarName: tmp };
}

/**
 * Infer the type of a receiver expression for method dispatch.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferType(node: any, ctx: TranspileContext): "array" | "string" | "number" | "boolean" | "object" | "unknown" {
  if (node.type === "Identifier") {
    const name = node.name;
    const t = ctx.stateVarTypes.get(name);
    if (t) return t;
  }

  // Array literal
  if (node.type === "ArrayExpression") return "array";

  // String literal
  if (node.type === "Literal") {
    if (typeof node.value === "string") return "string";
    if (typeof node.value === "number") return "number";
    if (typeof node.value === "boolean") return "boolean";
  }

  // Template literal → string
  if (node.type === "TemplateLiteral") return "string";

  // Call expressions that return known types
  if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
    const methodName = node.callee.property?.name;
    // Functional methods return arrays
    if (methodName === "map" || methodName === "filter" || methodName === "flatMap" || methodName === "flat" || methodName === "slice" || methodName === "splice") return "array";
    // String methods
    if (methodName === "toLowerCase" || methodName === "toUpperCase" || methodName === "trim" || methodName === "replace" || methodName === "replaceAll") return "string";
    if (methodName === "join") return "string";
    // Number methods
    if (methodName === "indexOf" || methodName === "findIndex") return "number";
    // Boolean methods
    if (methodName === "includes" || methodName === "some" || methodName === "every" || methodName === "startsWith" || methodName === "endsWith") return "boolean";
  }

  // Math calls return numbers
  if (node.type === "CallExpression" && node.callee?.object?.name === "Math") return "number";

  // MemberExpression: infer from parent
  if (node.type === "MemberExpression") {
    // .length on known types
    if (node.property?.name === "length") return "number";
    // Infer from object
    return inferType(node.object, ctx);
  }

  return "unknown";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileNewExpression(node: any, ctx: TranspileContext): TranspileResult {
  const callee = node.callee;
  if (callee?.type !== "Identifier") {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_EXPRESSION,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { expression: ctx.source.slice(node.start, node.end) },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  const ctorName = callee.name;
  const entry = CONSTRUCTOR_MAP[ctorName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_EXPRESSION,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { expression: ctx.source.slice(node.start, node.end) },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);

  const args = node.arguments ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r: TranspileResult) => r.dependencies);
  const argCodes = transpiled.map((r: TranspileResult) => r.code);

  // Date has arity variants
  if (ctorName === "Date" && entry.arityVariants) {
    const brs = entry.arityVariants[args.length] ?? entry.arityVariants[1] ?? entry.brs;
    return { code: `${brs}(${argCodes.join(", ")})`, dependencies: allDeps };
  }

  return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileDateStaticCall(methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  const entry = DATE_STATIC_METHODS[methodName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_STDLIB_METHOD,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { method: `Date.${methodName}` },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r) => r.dependencies);
  const argCodes = transpiled.map((r) => r.code);
  return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileStorageCall(methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  const entry = STORAGE_METHODS[methodName];
  if (!entry) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_STDLIB_METHOD,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { method: `localStorage.${methodName}` },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r) => r.dependencies);
  const argCodes = transpiled.map((r) => r.code);
  return { code: `${entry.brs}(${argCodes.join(", ")})`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileTimerCall(funcName: string, entry: any, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);

  // For setTimeout/setInterval/queueMicrotask, check if first arg is an inline arrow/function
  if (funcName === "setTimeout" || funcName === "setInterval" || funcName === "queueMicrotask") {
    const firstArg = args[0];
    if (firstArg && (firstArg.type === "ArrowFunctionExpression" || firstArg.type === "FunctionExpression")) {
      return extractTimerCallback(funcName, entry, firstArg, args, ctx, node);
    }

    // Named function reference — pass name as string
    if (firstArg?.type === "Identifier") {
      const restArgs = args.slice(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transpiled = restArgs.map((a: any) => transpileExpression(a, ctx));
      const allDeps = transpiled.flatMap((r: TranspileResult) => r.dependencies);
      const argCodes = transpiled.map((r: TranspileResult) => r.code);
      const allArgCodes = [`"${firstArg.name}"`, ...argCodes, "m.top"];
      return { code: `${entry.brs}(${allArgCodes.join(", ")})`, dependencies: allDeps };
    }
  }

  // clearTimeout/clearInterval — pass through handle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = args.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r: TranspileResult) => r.dependencies);
  const argCodes = transpiled.map((r: TranspileResult) => r.code);
  const allArgCodes = [...argCodes, "m.top"];
  return { code: `${entry.brs}(${allArgCodes.join(", ")})`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTimerCallback(funcName: string, entry: any, callback: any, args: any[], ctx: TranspileContext, node: any): TranspileResult {
  // Check for nested timer inside callback body (unsupported)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = callback.body;
  if (body?.type === "BlockStatement") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const stmt of body.body ?? []) {
      if (hasNestedTimerCall(stmt)) {
        ctx.errors.push(
          createError(
            ErrorCode.UNSUPPORTED_HANDLER_BODY,
            locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
            { handler: funcName },
          ),
        );
        return { code: "invalid", dependencies: [] };
      }
    }
  }

  const cbName = `__timer_cb_${ctx.callbackCounter++}`;
  const cbStatements: IRHandlerStatement[] = [];
  const mutatedVariables: string[] = [];

  if (body?.type === "BlockStatement") {
    // Block body — transpile each statement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const stmt of body.body ?? []) {
      transpileCallbackStatement(stmt, cbStatements, mutatedVariables, ctx);
    }
  } else {
    // Expression body — wrap in a synthetic expression statement
    transpileCallbackExpression(body, cbStatements, mutatedVariables, ctx);
  }

  const handler: IRHandler = {
    name: cbName,
    statements: cbStatements,
    mutatedVariables,
  };

  ctx.extractedCallbacks.push(handler);

  // Build remaining args (delay for setTimeout/setInterval)
  const restArgs = args.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transpiled = restArgs.map((a: any) => transpileExpression(a, ctx));
  const allDeps = transpiled.flatMap((r: TranspileResult) => r.dependencies);
  const argCodes = transpiled.map((r: TranspileResult) => r.code);
  const allArgCodes = [`"${cbName}"`, ...argCodes, "m.top"];

  return { code: `${entry.brs}(${allArgCodes.join(", ")})`, dependencies: allDeps };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasNestedTimerCall(node: any): boolean {
  if (!node) return false;
  if (node.type === "ExpressionStatement") {
    return hasNestedTimerCall(node.expression);
  }
  if (node.type === "CallExpression") {
    if (node.callee?.type === "Identifier") {
      const name = node.callee.name;
      if (name === "setTimeout" || name === "setInterval" || name === "queueMicrotask") return true;
    }
    // Check args for nested callbacks with timers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const arg of node.arguments ?? []) {
      if (arg.type === "ArrowFunctionExpression" || arg.type === "FunctionExpression") {
        if (arg.body?.type === "BlockStatement") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const stmt of arg.body.body ?? []) {
            if (hasNestedTimerCall(stmt)) return true;
          }
        }
      }
    }
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileCallbackStatement(stmt: any, statements: IRHandlerStatement[], mutatedVariables: string[], ctx: TranspileContext): void {
  if (stmt.type !== "ExpressionStatement") return;
  const expr = stmt.expression;

  if (expr.type === "UpdateExpression") {
    const varName = expr.argument?.name;
    if (varName && ctx.stateVarNames.has(varName)) {
      if (expr.operator === "++") {
        statements.push({ type: "increment", variable: varName });
      } else if (expr.operator === "--") {
        statements.push({ type: "decrement", variable: varName });
      }
      if (!mutatedVariables.includes(varName)) mutatedVariables.push(varName);
      return;
    }
  }

  if (expr.type === "AssignmentExpression" && expr.operator === "=") {
    const varName = expr.left?.name;
    if (varName && ctx.stateVarNames.has(varName)) {
      const rhs = expr.right;
      if (rhs.type === "Literal") {
        statements.push({ type: "assign-literal", variable: varName, value: String(rhs.value) });
      } else {
        const result = transpileExpression(rhs, ctx);
        statements.push({ type: "assign-expr", variable: varName, brsCode: result.code, preamble: result.preamble });
      }
      if (!mutatedVariables.includes(varName)) mutatedVariables.push(varName);
      return;
    }
  }

  // General expression statement
  const result = transpileExpression(expr, ctx);
  if (result.code !== "" && result.code !== "invalid") {
    statements.push({ type: "expr-statement", brsCode: result.code, preamble: result.preamble });
    for (const dep of result.dependencies) {
      if (ctx.stateVarNames.has(dep) && !mutatedVariables.includes(dep)) {
        mutatedVariables.push(dep);
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileCallbackExpression(expr: any, statements: IRHandlerStatement[], mutatedVariables: string[], ctx: TranspileContext): void {
  if (expr.type === "UpdateExpression") {
    const varName = expr.argument?.name;
    if (varName && ctx.stateVarNames.has(varName)) {
      if (expr.operator === "++") {
        statements.push({ type: "increment", variable: varName });
      } else if (expr.operator === "--") {
        statements.push({ type: "decrement", variable: varName });
      }
      if (!mutatedVariables.includes(varName)) mutatedVariables.push(varName);
      return;
    }
  }

  if (expr.type === "AssignmentExpression" && expr.operator === "=") {
    const varName = expr.left?.name;
    if (varName && ctx.stateVarNames.has(varName)) {
      const rhs = expr.right;
      if (rhs.type === "Literal") {
        statements.push({ type: "assign-literal", variable: varName, value: String(rhs.value) });
      } else {
        const result = transpileExpression(rhs, ctx);
        statements.push({ type: "assign-expr", variable: varName, brsCode: result.code, preamble: result.preamble });
      }
      if (!mutatedVariables.includes(varName)) mutatedVariables.push(varName);
      return;
    }
  }

  const result = transpileExpression(expr, ctx);
  if (result.code !== "" && result.code !== "invalid") {
    statements.push({ type: "expr-statement", brsCode: result.code, preamble: result.preamble });
    for (const dep of result.dependencies) {
      if (ctx.stateVarNames.has(dep) && !mutatedVariables.includes(dep)) {
        mutatedVariables.push(dep);
      }
    }
  }
}

/**
 * Try to transpile a method call on a browser API type (Date, URL, EventTarget, Map, Set, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileBrowserInstanceMethod(obj: any, methodName: string, args: any[], ctx: TranspileContext, node: any): TranspileResult | null {
  const browserType = inferBrowserType(obj, ctx);

  // Date methods
  if (browserType === "Date") {
    const entry = DATE_INSTANCE_METHODS[methodName];
    if (entry) {
      if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);
      const objResult = transpileExpression(obj, ctx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transpiled = args.map((a: any) => transpileExpression(a, ctx));
      const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
      const argCodes = transpiled.map((r) => r.code);
      const allArgs = [objResult.code, ...argCodes];
      return { code: `${entry.brs}(${allArgs.join(", ")})`, dependencies: allDeps };
    }
  }

  // URL methods
  if (browserType === "URL") {
    const entry = URL_INSTANCE_METHODS[methodName];
    if (entry) {
      if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);
      const objResult = transpileExpression(obj, ctx);
      return { code: `${entry.brs}(${objResult.code})`, dependencies: objResult.dependencies };
    }
  }

  // URLSearchParams methods
  if (browserType === "URLSearchParams") {
    const entry = URL_SEARCH_PARAMS_METHODS[methodName];
    if (entry) {
      if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);
      const objResult = transpileExpression(obj, ctx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transpiled = args.map((a: any) => transpileExpression(a, ctx));
      const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
      const argCodes = transpiled.map((r) => r.code);
      const allArgs = [objResult.code, ...argCodes];
      return { code: `${entry.brs}(${allArgs.join(", ")})`, dependencies: allDeps };
    }
  }

  // EventTarget methods
  if (browserType === "EventTarget") {
    const entry = EVENT_TARGET_METHODS[methodName];
    if (entry) {
      if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);
      const objResult = transpileExpression(obj, ctx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transpiled = args.map((a: any) => transpileExpression(a, ctx));
      const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
      const argCodes = transpiled.map((r) => r.code);
      const allArgs = [objResult.code, ...argCodes];
      return { code: `${entry.brs}(${allArgs.join(", ")})`, dependencies: allDeps };
    }
  }

  // AbortController methods
  if (browserType === "AbortController") {
    const entry = ABORT_CONTROLLER_METHODS[methodName];
    if (entry) {
      if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);
      const objResult = transpileExpression(obj, ctx);
      return { code: `${entry.brs}(${objResult.code})`, dependencies: objResult.dependencies };
    }
  }

  // Headers methods
  if (browserType === "Headers") {
    const entry = HEADERS_METHODS[methodName];
    if (entry) {
      if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);
      const objResult = transpileExpression(obj, ctx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transpiled = args.map((a: any) => transpileExpression(a, ctx));
      const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
      const argCodes = transpiled.map((r) => r.code);
      const allArgs = [objResult.code, ...argCodes];
      return { code: `${entry.brs}(${allArgs.join(", ")})`, dependencies: allDeps };
    }
  }

  // Map methods
  if (browserType === "Map") {
    const entry = MAP_METHODS[methodName];
    if (entry) {
      if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);
      const objResult = transpileExpression(obj, ctx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transpiled = args.map((a: any) => transpileExpression(a, ctx));
      const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
      const argCodes = transpiled.map((r) => r.code);
      const allArgs = [objResult.code, ...argCodes];
      return { code: `${entry.brs}(${allArgs.join(", ")})`, dependencies: allDeps };
    }
  }

  // Set methods
  if (browserType === "Set") {
    const entry = SET_METHODS[methodName];
    if (entry) {
      if (entry.polyfill) ctx.requiredPolyfills.add(entry.polyfill);
      const objResult = transpileExpression(obj, ctx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transpiled = args.map((a: any) => transpileExpression(a, ctx));
      const allDeps = [...objResult.dependencies, ...transpiled.flatMap((r) => r.dependencies)];
      const argCodes = transpiled.map((r) => r.code);
      const allArgs = [objResult.code, ...argCodes];
      return { code: `${entry.brs}(${allArgs.join(", ")})`, dependencies: allDeps };
    }
  }

  return null;
}

/**
 * Infer browser API type from expression context (NewExpression, Date.now(), etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferBrowserType(node: any, _ctx: TranspileContext): string | null {
  // new Date() → "Date", new URL() → "URL", etc.
  if (node.type === "NewExpression" && node.callee?.type === "Identifier") {
    return node.callee.name;
  }

  // Identifier referencing a state var — check if it was initialized with a constructor
  // (We can't easily track this in v0.6, so rely on method name dispatch)

  // .searchParams property → URLSearchParams
  if (node.type === "MemberExpression" && node.property?.name === "searchParams") {
    return "URLSearchParams";
  }

  // .signal property → treat as EventTarget-like for abort signal
  if (node.type === "MemberExpression" && node.property?.name === "signal") {
    return null; // signal is an AA with .aborted property, not a method target
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileChainExpression(node: any, ctx: TranspileContext): TranspileResult {
  if (ctx.singleExpressionOnly) {
    ctx.errors.push(
      createError(
        ErrorCode.UNSUPPORTED_EXPRESSION,
        locationFromOffset(ctx.source, node.start ?? 0, ctx.filename),
        { expression: ctx.source.slice(node.start, node.end) },
      ),
    );
    return { code: "invalid", dependencies: [] };
  }

  const preamble: string[] = [];
  const allDeps: string[] = [];
  const result = transpileChainNode(node.expression, preamble, allDeps, ctx);

  if (preamble.length === 0) {
    return { code: result, dependencies: allDeps };
  }

  return { code: result, dependencies: allDeps, preamble, tempVarName: result };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transpileChainNode(node: any, preamble: string[], deps: string[], ctx: TranspileContext): string {
  if (node.type === "MemberExpression" && node.optional) {
    // a?.b — guard on a being invalid
    const objCode = transpileChainNode(node.object, preamble, deps, ctx);
    const tmp = `__oc_${ctx.tempVarCounter++}`;
    preamble.push(`${tmp} = invalid`);

    let propAccess: string;
    if (node.computed) {
      const propResult = transpileExpression(node.property, ctx);
      deps.push(...propResult.dependencies);
      propAccess = `${objCode}[${propResult.code}]`;
    } else {
      propAccess = `${objCode}.${node.property.name}`;
    }

    preamble.push(`if ${objCode} <> invalid then ${tmp} = ${propAccess}`);
    return tmp;
  }

  if (node.type === "CallExpression" && node.optional) {
    // a?.b() — guard on callee being callable
    const calleeCode = transpileChainNode(node.callee, preamble, deps, ctx);
    const tmp = `__oc_${ctx.tempVarCounter++}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const argResults = (node.arguments ?? []).map((a: any) => transpileExpression(a, ctx));
    for (const r of argResults) deps.push(...r.dependencies);
    const argCodes = argResults.map((r: TranspileResult) => r.code);

    preamble.push(`${tmp} = invalid`);
    preamble.push(`if ${calleeCode} <> invalid then ${tmp} = ${calleeCode}(${argCodes.join(", ")})`);
    return tmp;
  }

  if (node.type === "MemberExpression" && !node.optional) {
    // Non-optional member in chain: a?.b.c — the .c part
    const objCode = transpileChainNode(node.object, preamble, deps, ctx);
    if (node.computed) {
      const propResult = transpileExpression(node.property, ctx);
      deps.push(...propResult.dependencies);
      return `${objCode}[${propResult.code}]`;
    }
    return `${objCode}.${node.property.name}`;
  }

  if (node.type === "CallExpression" && !node.optional) {
    // Non-optional call in chain: a?.b()
    const calleeCode = transpileChainNode(node.callee, preamble, deps, ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const argResults = (node.arguments ?? []).map((a: any) => transpileExpression(a, ctx));
    for (const r of argResults) deps.push(...r.dependencies);
    const argCodes = argResults.map((r: TranspileResult) => r.code);
    return `${calleeCode}(${argCodes.join(", ")})`;
  }

  // Base case: identifier or literal
  const result = transpileExpression(node, ctx);
  deps.push(...result.dependencies);
  if (result.preamble) preamble.push(...result.preamble);
  return result.code;
}

function escapeString(s: string): string {
  return s.replace(/"/g, '""');
}
