import { describe, it, expect } from "vitest";
import {
  transpileExpression,
  canTranspileAsSingleExpression,
  type TranspileContext,
} from "../../src/transpiler/expression.js";
import { parse } from "svelte/compiler";

function createCtx(overrides?: Partial<TranspileContext>): TranspileContext {
  return {
    stateVarNames: new Set(["count", "name", "items", "score", "active", "data"]),
    stateVarTypes: new Map([
      ["count", "number"],
      ["name", "string"],
      ["items", "array"],
      ["score", "number"],
      ["active", "boolean"],
      ["data", "string"],
    ]),
    singleExpressionOnly: false,
    tempVarCounter: 0,
    chainDepth: 0,
    errors: [],
    source: "",
    filename: "Test.svelte",
    usesStdlib: false,
    ...overrides,
  };
}

// Helper: parse a JS expression and return its AST node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseExpr(code: string): any {
  // Wrap in a Svelte component so the parser can handle it
  const source = `<script>const __result = ${code};</script>`;
  const ast = parse(source, { filename: "test.svelte", modern: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (ast.instance as any).content.body;
  return body[0].declarations[0].init;
}

// === Identifier ===

describe("transpileExpression - Identifier", () => {
  it("transpiles state variable to m.state.name", () => {
    const ctx = createCtx();
    const node = parseExpr("count");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.count");
    expect(result.dependencies).toEqual(["count"]);
  });

  it("transpiles non-state identifier as raw name", () => {
    const ctx = createCtx();
    const node = parseExpr("localVar");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("localVar");
    expect(result.dependencies).toEqual([]);
  });
});

// === Literal ===

describe("transpileExpression - Literal", () => {
  it("transpiles number literal", () => {
    const ctx = createCtx();
    const node = parseExpr("42");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("42");
  });

  it("transpiles string literal", () => {
    const ctx = createCtx();
    const node = parseExpr('"hello"');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"hello"');
  });

  it("transpiles boolean literal", () => {
    const ctx = createCtx();
    const node = parseExpr("true");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("true");
  });

  it("transpiles null literal", () => {
    const ctx = createCtx();
    const node = parseExpr("null");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("invalid");
  });
});

// === BinaryExpression ===

describe("transpileExpression - BinaryExpression", () => {
  it("transpiles +", () => {
    const ctx = createCtx();
    const node = parseExpr("count + 1");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(m.state.count + 1)");
  });

  it("transpiles ===", () => {
    const ctx = createCtx();
    const node = parseExpr("count === 0");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(m.state.count = 0)");
  });

  it("transpiles !==", () => {
    const ctx = createCtx();
    const node = parseExpr("count !== 0");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(m.state.count <> 0)");
  });

  it("transpiles &&", () => {
    const ctx = createCtx();
    const node = parseExpr("active && count > 0");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(m.state.active and (m.state.count > 0))");
  });

  it("transpiles ||", () => {
    const ctx = createCtx();
    const node = parseExpr("active || count > 0");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(m.state.active or (m.state.count > 0))");
  });

  it("transpiles %", () => {
    const ctx = createCtx();
    const node = parseExpr("count % 2");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(m.state.count MOD 2)");
  });

  it("transpiles **", () => {
    const ctx = createCtx();
    const node = parseExpr("count ** 2");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(m.state.count ^ 2)");
  });

  it("collects dependencies from both sides", () => {
    const ctx = createCtx();
    const node = parseExpr("count + score");
    const result = transpileExpression(node, ctx);
    expect(result.dependencies).toContain("count");
    expect(result.dependencies).toContain("score");
  });
});

// === UnaryExpression ===

describe("transpileExpression - UnaryExpression", () => {
  it("transpiles ! to not", () => {
    const ctx = createCtx();
    const node = parseExpr("!active");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("not m.state.active");
  });

  it("transpiles - (negation)", () => {
    const ctx = createCtx();
    const node = parseExpr("-count");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(-m.state.count)");
  });
});

// === Math ===

describe("transpileExpression - Math", () => {
  it("transpiles Math.floor()", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.floor(score)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Int(m.state.score)");
  });

  it("transpiles Math.abs()", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.abs(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Abs(m.state.count)");
  });

  it("transpiles Math.sqrt()", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.sqrt(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Sqr(m.state.count)");
  });

  it("transpiles Math.round()", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.round(score)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Cint(m.state.score)");
  });

  it("transpiles Math.pow() to ^ operator", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.pow(count, 2)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.count ^ 2");
  });

  it("transpiles Math.random() to Rnd(0)", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.random()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Rnd(0)");
  });

  it("transpiles Math.PI to constant", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.PI");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("3.14159265358979");
  });

  it("transpiles Math.E to constant", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.E");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("2.71828182845905");
  });

  it("transpiles Math.sin()", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.sin(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Sin(m.state.count)");
  });

  it("transpiles Math.cos()", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.cos(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Cos(m.state.count)");
  });

  it("transpiles Math.log()", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.log(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Log(m.state.count)");
  });

  it("transpiles Math.log2() inline", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.log2(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(Log(m.state.count) / Log(2))");
  });

  it("transpiles Math.log10() inline", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.log10(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("(Log(m.state.count) / Log(10))");
  });

  it("transpiles Math.ceil() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.ceil(score)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_mathCeil(m.state.score)");
    expect(ctx.usesStdlib).toBe(true);
  });

  it("transpiles Math.min() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.min(count, score)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_mathMin(m.state.count, m.state.score)");
    expect(ctx.usesStdlib).toBe(true);
  });

  it("transpiles Math.max() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.max(count, score)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_mathMax(m.state.count, m.state.score)");
  });

  it("transpiles Math.sign() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.sign(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_mathSign(m.state.count)");
  });

  it("transpiles Math.trunc() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.trunc(score)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_mathTrunc(m.state.score)");
  });

  it("errors on unknown Math method", () => {
    const ctx = createCtx();
    const node = parseExpr("Math.hypot(3, 4)");
    transpileExpression(node, ctx);
    expect(ctx.errors.length).toBeGreaterThan(0);
    expect(ctx.errors[0]!.code).toBe("UNSUPPORTED_STDLIB_METHOD");
  });
});

// === String methods ===

describe("transpileExpression - String methods", () => {
  it("transpiles .toLowerCase()", () => {
    const ctx = createCtx();
    const node = parseExpr("name.toLowerCase()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("LCase(m.state.name)");
  });

  it("transpiles .toUpperCase()", () => {
    const ctx = createCtx();
    const node = parseExpr("name.toUpperCase()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("UCase(m.state.name)");
  });

  it("transpiles .trim()", () => {
    const ctx = createCtx();
    const node = parseExpr("name.trim()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.name.Trim()");
  });

  it("transpiles .split()", () => {
    const ctx = createCtx();
    const node = parseExpr('name.split(",")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('m.state.name.Split(",")');
  });

  it("transpiles .replace()", () => {
    const ctx = createCtx();
    const node = parseExpr('name.replace("a", "b")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('m.state.name.Replace("a", "b")');
  });

  it("transpiles .includes() inline", () => {
    const ctx = createCtx();
    const node = parseExpr('name.includes("hello")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('(Instr(1, m.state.name, "hello") > 0)');
  });

  it("transpiles .startsWith() inline", () => {
    const ctx = createCtx();
    const node = parseExpr('name.startsWith("he")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('(Left(m.state.name, Len("he")) = "he")');
  });

  it("transpiles .endsWith() inline", () => {
    const ctx = createCtx();
    const node = parseExpr('name.endsWith("ld")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('(Right(m.state.name, Len("ld")) = "ld")');
  });

  it("transpiles .indexOf() inline", () => {
    const ctx = createCtx();
    const node = parseExpr('name.indexOf("world")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('(Instr(1, m.state.name, "world") - 1)');
  });

  it("transpiles .charAt() inline", () => {
    const ctx = createCtx();
    const node = parseExpr("name.charAt(0)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Mid(m.state.name, 0 + 1, 1)");
  });

  it("transpiles .charCodeAt() inline", () => {
    const ctx = createCtx();
    const node = parseExpr("name.charCodeAt(0)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Asc(Mid(m.state.name, 0 + 1, 1))");
  });

  it("transpiles string .length to Len()", () => {
    const ctx = createCtx();
    const node = parseExpr("name.length");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Len(m.state.name)");
  });

  it("transpiles .lastIndexOf() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr('name.lastIndexOf("l")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_strLastIndexOf(m.state.name, "l")');
    expect(ctx.usesStdlib).toBe(true);
  });

  it("transpiles .replaceAll() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr('name.replaceAll("l", "r")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_strReplaceAll(m.state.name, "l", "r")');
    expect(ctx.usesStdlib).toBe(true);
  });

  it("transpiles .padStart() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr('name.padStart(10, "0")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_strPadStart(m.state.name, 10, "0")');
    expect(ctx.usesStdlib).toBe(true);
  });

  it("transpiles .repeat() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("name.repeat(3)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_strRepeat(m.state.name, 3)");
    expect(ctx.usesStdlib).toBe(true);
  });
});

// === Array methods ===

describe("transpileExpression - Array methods", () => {
  it("transpiles .push() rename", () => {
    const ctx = createCtx();
    const node = parseExpr('items.push("x")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('m.state.items.Push("x")');
  });

  it("transpiles .pop() rename", () => {
    const ctx = createCtx();
    const node = parseExpr("items.pop()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.items.Pop()");
  });

  it("transpiles .reverse() rename", () => {
    const ctx = createCtx();
    const node = parseExpr("items.reverse()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.items.Reverse()");
  });

  it("transpiles .sort() rename", () => {
    const ctx = createCtx();
    const node = parseExpr("items.sort()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.items.Sort()");
  });

  it("transpiles array .length to .Count()", () => {
    const ctx = createCtx();
    const node = parseExpr("items.length");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.items.Count()");
  });

  it("transpiles .includes() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr('items.includes("x")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_arrayIncludes(m.state.items, "x")');
    expect(ctx.usesStdlib).toBe(true);
  });

  it("transpiles .indexOf() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr('items.indexOf("x")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_arrayIndexOf(m.state.items, "x")');
    expect(ctx.usesStdlib).toBe(true);
  });

  it("transpiles .slice() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("items.slice(1, 3)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_arraySlice(m.state.items, 1, 3)");
  });

  it("transpiles .join() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr('items.join(", ")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_arrayJoin(m.state.items, ", ")');
  });
});

// === Functional array methods (inline expansion) ===

describe("transpileExpression - Functional methods", () => {
  it("transpiles .filter() to for-each loop", () => {
    const ctx = createCtx();
    const node = parseExpr("items.filter(x => x.active)");
    const result = transpileExpression(node, ctx);
    expect(result.preamble).toBeDefined();
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = []");
    expect(result.preamble!.join("\n")).toContain("for each x in m.state.items");
    expect(result.preamble!.join("\n")).toContain("if x.active then __tmp_0.Push(x)");
    expect(result.preamble!.join("\n")).toContain("end for");
    expect(result.code).toBe("__tmp_0");
    expect(result.tempVarName).toBe("__tmp_0");
  });

  it("transpiles .map() to for-each loop", () => {
    const ctx = createCtx();
    const node = parseExpr("items.map(x => x.title)");
    const result = transpileExpression(node, ctx);
    expect(result.preamble).toBeDefined();
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = []");
    expect(result.preamble!.join("\n")).toContain("for each x in m.state.items");
    expect(result.preamble!.join("\n")).toContain("__tmp_0.Push(x.title)");
    expect(result.code).toBe("__tmp_0");
  });

  it("transpiles .find() with early exit", () => {
    const ctx = createCtx();
    const node = parseExpr("items.find(x => x.active)");
    const result = transpileExpression(node, ctx);
    expect(result.preamble).toBeDefined();
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = invalid");
    expect(result.preamble!.join("\n")).toContain("exit for");
  });

  it("transpiles .findIndex() with counter", () => {
    const ctx = createCtx();
    const node = parseExpr("items.findIndex(x => x.active)");
    const result = transpileExpression(node, ctx);
    expect(result.preamble).toBeDefined();
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = -1");
    expect(result.preamble!.join("\n")).toContain("__idx_1 = 0");
  });

  it("transpiles .some() with short-circuit true", () => {
    const ctx = createCtx();
    const node = parseExpr("items.some(x => x.active)");
    const result = transpileExpression(node, ctx);
    expect(result.preamble).toBeDefined();
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = false");
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = true");
  });

  it("transpiles .every() with short-circuit false", () => {
    const ctx = createCtx();
    const node = parseExpr("items.every(x => x.active)");
    const result = transpileExpression(node, ctx);
    expect(result.preamble).toBeDefined();
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = true");
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = false");
  });

  it("transpiles .forEach()", () => {
    const ctx = createCtx();
    const node = parseExpr("items.forEach(x => x.active)");
    const result = transpileExpression(node, ctx);
    expect(result.preamble).toBeDefined();
    expect(result.preamble!.join("\n")).toContain("for each x in m.state.items");
    expect(result.code).toBe("");
  });

  it("transpiles .reduce()", () => {
    const ctx = createCtx();
    const node = parseExpr("items.reduce((acc, x) => acc + x, 0)");
    const result = transpileExpression(node, ctx);
    expect(result.preamble).toBeDefined();
    expect(result.preamble!.join("\n")).toContain("__tmp_0 = 0");
    expect(result.preamble!.join("\n")).toContain("for each x in m.state.items");
  });

  it("rejects functional methods in singleExpressionOnly mode", () => {
    const ctx = createCtx({ singleExpressionOnly: true });
    const node = parseExpr("items.filter(x => x.active)");
    transpileExpression(node, ctx);
    expect(ctx.errors.length).toBeGreaterThan(0);
    expect(ctx.errors[0]!.code).toBe("FUNCTIONAL_IN_TEMPLATE");
  });

  it("rejects block body arrow functions", () => {
    const ctx = createCtx();
    const source = "items.filter(x => { return x.active; })";
    const expr = parseExpr(source);
    transpileExpression(expr, ctx);
    expect(ctx.errors.length).toBeGreaterThan(0);
  });
});

// === JSON ===

describe("transpileExpression - JSON", () => {
  it("transpiles JSON.parse()", () => {
    const ctx = createCtx();
    const node = parseExpr("JSON.parse(data)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("ParseJSON(m.state.data)");
  });

  it("transpiles JSON.stringify()", () => {
    const ctx = createCtx();
    const node = parseExpr("JSON.stringify(data)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("FormatJSON(m.state.data)");
  });
});

// === Console ===

describe("transpileExpression - Console", () => {
  it("transpiles console.log()", () => {
    const ctx = createCtx();
    const node = parseExpr("console.log(count)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("print m.state.count");
  });

  it("transpiles console.warn()", () => {
    const ctx = createCtx();
    const node = parseExpr('console.warn("test")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toContain("[WARN]");
  });

  it("transpiles console.error()", () => {
    const ctx = createCtx();
    const node = parseExpr('console.error("test")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toContain("[ERROR]");
  });

  it("strips console.debug()", () => {
    const ctx = createCtx();
    const node = parseExpr('console.debug("test")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("");
  });
});

// === Object static methods ===

describe("transpileExpression - Object", () => {
  it("transpiles Object.keys()", () => {
    const ctx = createCtx();
    const node = parseExpr("Object.keys(data)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.data.Keys()");
  });

  it("transpiles Object.assign()", () => {
    const ctx = createCtx();
    const node = parseExpr("Object.assign(data, name)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.data.Append(m.state.name)");
  });

  it("transpiles Object.freeze() as no-op", () => {
    const ctx = createCtx();
    const node = parseExpr("Object.freeze(data)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("m.state.data");
  });

  it("transpiles Object.values() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("Object.values(data)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_objectValues(m.state.data)");
    expect(ctx.usesStdlib).toBe(true);
  });

  it("transpiles .hasOwnProperty()", () => {
    const ctx = createCtx();
    const node = parseExpr('data.hasOwnProperty("key")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('m.state.data.DoesExist("key")');
  });
});

// === String static methods ===

describe("transpileExpression - String static methods", () => {
  it("transpiles String.fromCharCode()", () => {
    const ctx = createCtx();
    const node = parseExpr("String.fromCharCode(65)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("Chr(65)");
  });
});

// === Array static methods ===

describe("transpileExpression - Array static methods", () => {
  it("transpiles Array.isArray() with runtime helper", () => {
    const ctx = createCtx();
    const node = parseExpr("Array.isArray(items)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_arrayIsArray(m.state.items)");
    expect(ctx.usesStdlib).toBe(true);
  });
});

// === TemplateLiteral ===

describe("transpileExpression - TemplateLiteral", () => {
  it("transpiles template literal with expressions", () => {
    const ctx = createCtx();
    const source = "`Count: ${count}`";
    const node = parseExpr(source);
    const result = transpileExpression(node, ctx);
    expect(result.code).toContain('"Count: "');
    expect(result.code).toContain("m.state.count");
  });
});

// === canTranspileAsSingleExpression ===

describe("canTranspileAsSingleExpression", () => {
  it("returns true for Identifier", () => {
    expect(canTranspileAsSingleExpression(parseExpr("count"))).toBe(true);
  });

  it("returns true for Literal", () => {
    expect(canTranspileAsSingleExpression(parseExpr("42"))).toBe(true);
  });

  it("returns true for MemberExpression", () => {
    expect(canTranspileAsSingleExpression(parseExpr("items.length"))).toBe(true);
  });

  it("returns true for Math.floor()", () => {
    expect(canTranspileAsSingleExpression(parseExpr("Math.floor(42)"))).toBe(true);
  });

  it("returns true for binary expression", () => {
    expect(canTranspileAsSingleExpression(parseExpr("1 + 2"))).toBe(true);
  });

  it("returns false for .map() (functional)", () => {
    expect(canTranspileAsSingleExpression(parseExpr("items.map(x => x)"))).toBe(false);
  });

  it("returns false for .filter() (functional)", () => {
    expect(canTranspileAsSingleExpression(parseExpr("items.filter(x => x)"))).toBe(false);
  });

  it("returns true for .push() (non-functional)", () => {
    expect(canTranspileAsSingleExpression(parseExpr('items.push("x")'))).toBe(true);
  });

  it("returns true for console.log()", () => {
    expect(canTranspileAsSingleExpression(parseExpr("console.log(42)"))).toBe(true);
  });

  it("returns true for unary !", () => {
    expect(canTranspileAsSingleExpression(parseExpr("!true"))).toBe(true);
  });

  it("returns true for ternary", () => {
    expect(canTranspileAsSingleExpression(parseExpr("true ? 1 : 2"))).toBe(true);
  });

  it("returns false for NewExpression", () => {
    expect(canTranspileAsSingleExpression({ type: "NewExpression" })).toBe(false);
  });
});
