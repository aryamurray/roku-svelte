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
    requiredPolyfills: new Set(),
    extractedCallbacks: [],
    callbackCounter: 0,
    ...overrides,
  };
}

// Helper: parse a JS expression and return its AST node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseExpr(code: string): any {
  const source = `<script>const __result = ${code};</script>`;
  const ast = parse(source, { filename: "test.svelte", modern: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (ast.instance as any).content.body;
  return body[0].declarations[0].init;
}

describe("transpileExpression - typeof", () => {
  it("constant-folds typeof window", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof window");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"object"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof document", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof document");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"undefined"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof navigator", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof navigator");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"object"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof localStorage", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof localStorage");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"object"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof sessionStorage", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof sessionStorage");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"object"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof Worker", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof Worker");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"undefined"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof ServiceWorker", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof ServiceWorker");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"undefined"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof SharedWorker", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof SharedWorker");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"undefined"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof globalThis", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof globalThis");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"object"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof setTimeout", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof setTimeout");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"function"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof setInterval", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof setInterval");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"function"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof fetch", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof fetch");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"function"');
    expect(result.dependencies).toEqual([]);
  });

  it("constant-folds typeof undefined", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof undefined");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('"undefined"');
    expect(result.dependencies).toEqual([]);
  });

  it("transpiles typeof state variable", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof count");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("type(m.state.count)");
    expect(result.dependencies).toEqual(["count"]);
  });

  it("transpiles typeof non-state variable", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof localVar");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("type(localVar)");
    expect(result.dependencies).toEqual([]);
  });
});

describe("transpileExpression - NewExpression", () => {
  it("transpiles new Date()", () => {
    const ctx = createCtx();
    const node = parseExpr("new Date()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_dateNow()");
    expect(ctx.requiredPolyfills.has("DatePolyfill")).toBe(true);
  });

  it("transpiles new Date(1234)", () => {
    const ctx = createCtx();
    const node = parseExpr("new Date(1234)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_dateCreate(1234)");
    expect(ctx.requiredPolyfills.has("DatePolyfill")).toBe(true);
  });

  it("transpiles new URL(string)", () => {
    const ctx = createCtx();
    const node = parseExpr('new URL("https://example.com")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_urlParse("https://example.com")');
    expect(ctx.requiredPolyfills.has("URLPolyfill")).toBe(true);
  });

  it("transpiles new URLSearchParams(string)", () => {
    const ctx = createCtx();
    const node = parseExpr('new URLSearchParams("a=1")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_urlSearchParamsCreate("a=1")');
    expect(ctx.requiredPolyfills.has("URLPolyfill")).toBe(true);
  });

  it("transpiles new EventTarget()", () => {
    const ctx = createCtx();
    const node = parseExpr("new EventTarget()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_eventTargetCreate()");
    expect(ctx.requiredPolyfills.has("EventTarget")).toBe(true);
  });

  it("transpiles new AbortController()", () => {
    const ctx = createCtx();
    const node = parseExpr("new AbortController()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_abortControllerCreate()");
    expect(ctx.requiredPolyfills.has("EventTarget")).toBe(true);
  });

  it("transpiles new Headers()", () => {
    const ctx = createCtx();
    const node = parseExpr("new Headers()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_headersCreate()");
    expect(ctx.requiredPolyfills.has("FetchAPI")).toBe(true);
  });

  it("transpiles new Request(string)", () => {
    const ctx = createCtx();
    const node = parseExpr('new Request("https://example.com")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_requestCreate("https://example.com")');
    expect(ctx.requiredPolyfills.has("FetchAPI")).toBe(true);
  });

  it("transpiles new Response(string)", () => {
    const ctx = createCtx();
    const node = parseExpr('new Response("body")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_responseCreate("body")');
    expect(ctx.requiredPolyfills.has("FetchAPI")).toBe(true);
  });

  it("transpiles new Map()", () => {
    const ctx = createCtx();
    const node = parseExpr("new Map()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_mapCreate()");
    expect(ctx.requiredPolyfills.has("Collections")).toBe(true);
  });

  it("transpiles new Set()", () => {
    const ctx = createCtx();
    const node = parseExpr("new Set()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_setCreate()");
    expect(ctx.requiredPolyfills.has("Collections")).toBe(true);
  });

  it("reports error for unknown constructor", () => {
    const ctx = createCtx();
    const node = parseExpr("new WeakMap()");
    transpileExpression(node, ctx);
    expect(ctx.errors.length).toBeGreaterThan(0);
    expect(ctx.errors.some(e => e.code === "UNSUPPORTED_EXPRESSION")).toBe(true);
  });
});

describe("transpileExpression - Date static", () => {
  it("transpiles Date.now()", () => {
    const ctx = createCtx();
    const node = parseExpr("Date.now()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_dateNowMs()");
    expect(ctx.requiredPolyfills.has("DatePolyfill")).toBe(true);
  });
});

describe("transpileExpression - Timer functions", () => {
  it("transpiles setTimeout with function reference", () => {
    const ctx = createCtx();
    const node = parseExpr("setTimeout(increment, 1000)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_setTimeout("increment", 1000, m.top)');
    expect(ctx.requiredPolyfills.has("Timers")).toBe(true);
  });

  it("transpiles setInterval with function reference", () => {
    const ctx = createCtx();
    const node = parseExpr("setInterval(increment, 500)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_setInterval("increment", 500, m.top)');
    expect(ctx.requiredPolyfills.has("Timers")).toBe(true);
  });

  it("transpiles clearTimeout", () => {
    const ctx = createCtx();
    const node = parseExpr("clearTimeout(handle)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_clearTimeout(handle, m.top)");
    expect(ctx.requiredPolyfills.has("Timers")).toBe(true);
  });

  it("transpiles clearInterval", () => {
    const ctx = createCtx();
    const node = parseExpr("clearInterval(handle)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_clearInterval(handle, m.top)");
    expect(ctx.requiredPolyfills.has("Timers")).toBe(true);
  });

  it("transpiles queueMicrotask", () => {
    const ctx = createCtx();
    const node = parseExpr("queueMicrotask(doWork)");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_queueMicrotask("doWork", m.top)');
    expect(ctx.requiredPolyfills.has("Timers")).toBe(true);
  });

  it("transpiles setTimeout with arrow function (block body)", () => {
    const source = "setTimeout(() => { count++ }, 1000)";
    const ctx = createCtx({ source });
    const node = parseExpr(source);
    const result = transpileExpression(node, ctx);
    expect(result.code).toContain('SvelteRoku_setTimeout("__timer_cb_0", 1000, m.top)');
    expect(ctx.extractedCallbacks.length).toBe(1);
    expect(ctx.extractedCallbacks[0].name).toBe("__timer_cb_0");
    expect(ctx.extractedCallbacks[0].statements.length).toBe(1);
    expect(ctx.extractedCallbacks[0].statements[0].type).toBe("increment");
    expect(ctx.extractedCallbacks[0].statements[0].variable).toBe("count");
    expect(ctx.callbackCounter).toBe(1);
    expect(ctx.requiredPolyfills.has("Timers")).toBe(true);
  });

  it("transpiles setTimeout with arrow function (expression body)", () => {
    const source = "setTimeout(() => count++, 1000)";
    const ctx = createCtx({ source });
    const node = parseExpr(source);
    const result = transpileExpression(node, ctx);
    expect(result.code).toContain('SvelteRoku_setTimeout("__timer_cb_0", 1000, m.top)');
    expect(ctx.extractedCallbacks.length).toBe(1);
    expect(ctx.extractedCallbacks[0].name).toBe("__timer_cb_0");
    expect(ctx.extractedCallbacks[0].statements.length).toBe(1);
    expect(ctx.extractedCallbacks[0].statements[0].type).toBe("increment");
    expect(ctx.extractedCallbacks[0].statements[0].variable).toBe("count");
    expect(ctx.callbackCounter).toBe(1);
    expect(ctx.requiredPolyfills.has("Timers")).toBe(true);
  });
});

describe("transpileExpression - Base64", () => {
  it("transpiles btoa", () => {
    const ctx = createCtx();
    const node = parseExpr('btoa("hello")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_btoa("hello")');
    expect(ctx.requiredPolyfills.has("Base64")).toBe(true);
  });

  it("transpiles atob", () => {
    const ctx = createCtx();
    const node = parseExpr('atob("aGVsbG8=")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_atob("aGVsbG8=")');
    expect(ctx.requiredPolyfills.has("Base64")).toBe(true);
  });
});

describe("transpileExpression - Storage", () => {
  it("transpiles localStorage.getItem", () => {
    const ctx = createCtx();
    const node = parseExpr('localStorage.getItem("key")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_storageGet("key")');
    expect(ctx.requiredPolyfills.has("Storage")).toBe(true);
  });

  it("transpiles localStorage.setItem", () => {
    const ctx = createCtx();
    const node = parseExpr('localStorage.setItem("key", "val")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_storageSet("key", "val")');
    expect(ctx.requiredPolyfills.has("Storage")).toBe(true);
  });

  it("transpiles localStorage.removeItem", () => {
    const ctx = createCtx();
    const node = parseExpr('localStorage.removeItem("key")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_storageRemove("key")');
    expect(ctx.requiredPolyfills.has("Storage")).toBe(true);
  });

  it("transpiles localStorage.clear", () => {
    const ctx = createCtx();
    const node = parseExpr("localStorage.clear()");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("SvelteRoku_storageClear()");
    expect(ctx.requiredPolyfills.has("Storage")).toBe(true);
  });

  it("transpiles sessionStorage.getItem (same as localStorage)", () => {
    const ctx = createCtx();
    const node = parseExpr('sessionStorage.getItem("key")');
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('SvelteRoku_storageGet("key")');
    expect(ctx.requiredPolyfills.has("Storage")).toBe(true);
  });
});

describe("transpileExpression - Navigator/Window", () => {
  it("transpiles navigator.userAgent", () => {
    const ctx = createCtx();
    const node = parseExpr("navigator.userAgent");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('CreateObject("roDeviceInfo").GetModel()');
  });

  it("transpiles navigator.language", () => {
    const ctx = createCtx();
    const node = parseExpr("navigator.language");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('CreateObject("roDeviceInfo").GetCurrentLocale()');
  });

  it("transpiles navigator.onLine", () => {
    const ctx = createCtx();
    const node = parseExpr("navigator.onLine");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("true");
  });

  it("transpiles window.innerWidth", () => {
    const ctx = createCtx();
    const node = parseExpr("window.innerWidth");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('CreateObject("roDeviceInfo").GetDisplaySize().w');
  });

  it("transpiles window.innerHeight", () => {
    const ctx = createCtx();
    const node = parseExpr("window.innerHeight");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('CreateObject("roDeviceInfo").GetDisplaySize().h');
  });

  it("transpiles window.devicePixelRatio", () => {
    const ctx = createCtx();
    const node = parseExpr("window.devicePixelRatio");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe("1");
  });
});

describe("transpileExpression - window.location", () => {
  it("transpiles window.location.href", () => {
    const ctx = createCtx();
    const node = parseExpr("window.location.href");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('""');
  });

  it("transpiles window.location.hostname", () => {
    const ctx = createCtx();
    const node = parseExpr("window.location.hostname");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('""');
  });

  it("transpiles window.location.pathname", () => {
    const ctx = createCtx();
    const node = parseExpr("window.location.pathname");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('""');
  });

  it("transpiles window.location.origin", () => {
    const ctx = createCtx();
    const node = parseExpr("window.location.origin");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('""');
  });

  it("transpiles window.location.protocol", () => {
    const ctx = createCtx();
    const node = parseExpr("window.location.protocol");
    const result = transpileExpression(node, ctx);
    expect(result.code).toBe('""');
  });
});

describe("Polyfill tracking", () => {
  it("tracks Base64 polyfill for btoa", () => {
    const ctx = createCtx();
    const node = parseExpr('btoa("x")');
    transpileExpression(node, ctx);
    expect(ctx.requiredPolyfills.has("Base64")).toBe(true);
  });

  it("tracks DatePolyfill for new Date()", () => {
    const ctx = createCtx();
    const node = parseExpr("new Date()");
    transpileExpression(node, ctx);
    expect(ctx.requiredPolyfills.has("DatePolyfill")).toBe(true);
  });

  it("tracks Storage polyfill for localStorage.getItem", () => {
    const ctx = createCtx();
    const node = parseExpr('localStorage.getItem("k")');
    transpileExpression(node, ctx);
    expect(ctx.requiredPolyfills.has("Storage")).toBe(true);
  });

  it("tracks Timers polyfill for setTimeout", () => {
    const ctx = createCtx();
    const node = parseExpr("setTimeout(fn, 100)");
    transpileExpression(node, ctx);
    expect(ctx.requiredPolyfills.has("Timers")).toBe(true);
  });

  it("does not track polyfill for navigator.userAgent (inline)", () => {
    const ctx = createCtx();
    const node = parseExpr("navigator.userAgent");
    transpileExpression(node, ctx);
    expect(ctx.requiredPolyfills.size).toBe(0);
  });

  it("does not track polyfill for typeof window (constant folded)", () => {
    const ctx = createCtx();
    const node = parseExpr("typeof window");
    transpileExpression(node, ctx);
    expect(ctx.requiredPolyfills.size).toBe(0);
  });
});

describe("canTranspileAsSingleExpression - browser", () => {
  it("allows typeof window", () => {
    const node = parseExpr("typeof window");
    expect(canTranspileAsSingleExpression(node)).toBe(true);
  });

  it("allows new Date()", () => {
    const node = parseExpr("new Date()");
    expect(canTranspileAsSingleExpression(node)).toBe(true);
  });

  it("allows new Map()", () => {
    const node = parseExpr("new Map()");
    expect(canTranspileAsSingleExpression(node)).toBe(true);
  });

  it("allows new Set()", () => {
    const node = parseExpr("new Set()");
    expect(canTranspileAsSingleExpression(node)).toBe(true);
  });

  it("disallows new WeakMap() (unknown constructor)", () => {
    const node = parseExpr("new WeakMap()");
    expect(canTranspileAsSingleExpression(node)).toBe(false);
  });
});
