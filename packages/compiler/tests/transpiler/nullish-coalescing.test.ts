import { describe, test, expect } from "vitest";
import {
	transpileExpression,
	canTranspileAsSingleExpression,
} from "../../src/transpiler/expression.js";
import type { TranspileContext } from "../../src/transpiler/expression.js";

describe("nullish coalescing transpilation", () => {
	test("a ?? b where a is state variable", () => {
		const ctx: TranspileContext = {
			stateVarNames: new Set(["a"]),
			stateVarTypes: new Map([["a", "number"]]),
			singleExpressionOnly: false,
			tempVarCounter: 0,
			chainDepth: 0,
			errors: [],
			source: "",
			filename: "test.svelte",
			usesStdlib: false,
			requiredPolyfills: new Set(),
			extractedCallbacks: [],
			callbackCounter: 0,
		};

		const ast = {
			type: "LogicalExpression",
			operator: "??",
			left: { type: "Identifier", name: "a" },
			right: { type: "Identifier", name: "b" },
		} as any;

		const result = transpileExpression(ast, ctx);

		expect(result.code).toBe("__nc_0");
		expect(result.preamble).toContain("__nc_0 = b");
		expect(result.preamble).toContain("if m.state.a <> invalid then __nc_0 = m.state.a");
	});

	test("a ?? 0 with literal fallback", () => {
		const ctx: TranspileContext = {
			stateVarNames: new Set(["a"]),
			stateVarTypes: new Map([["a", "number"]]),
			singleExpressionOnly: false,
			tempVarCounter: 0,
			chainDepth: 0,
			errors: [],
			source: "",
			filename: "test.svelte",
			usesStdlib: false,
			requiredPolyfills: new Set(),
			extractedCallbacks: [],
			callbackCounter: 0,
		};

		const ast = {
			type: "LogicalExpression",
			operator: "??",
			left: { type: "Identifier", name: "a" },
			right: { type: "Literal", value: 0, raw: "0" },
		} as any;

		const result = transpileExpression(ast, ctx);

		expect(result.code).toBe("__nc_0");
		expect(result.preamble).toContain("__nc_0 = 0");
		expect(result.preamble).toContain("if m.state.a <> invalid then __nc_0 = m.state.a");
	});

	test("singleExpressionOnly uses SvelteRoku_iif helper", () => {
		const ctx: TranspileContext = {
			stateVarNames: new Set(["a"]),
			stateVarTypes: new Map([["a", "number"]]),
			singleExpressionOnly: true,
			tempVarCounter: 0,
			chainDepth: 0,
			errors: [],
			source: "",
			filename: "test.svelte",
			usesStdlib: false,
			requiredPolyfills: new Set(),
			extractedCallbacks: [],
			callbackCounter: 0,
		};

		const ast = {
			type: "LogicalExpression",
			operator: "??",
			left: { type: "Identifier", name: "a" },
			right: { type: "Literal", value: 0, raw: "0" },
		} as any;

		const result = transpileExpression(ast, ctx);

		expect(result.code).toContain("SvelteRoku_iif(");
		expect(result.code).toContain("<> invalid");
		expect(result.code).toContain("m.state.a");
		expect(result.code).toContain(", 0)");
		expect(ctx.usesStdlib).toBe(true);
		expect(result.preamble).toBeUndefined();
	});

	test("canTranspileAsSingleExpression returns true for simple nullish coalescing", () => {
		const ast = {
			type: "LogicalExpression",
			operator: "??",
			left: { type: "Identifier", name: "a" },
			right: { type: "Literal", value: 0, raw: "0" },
		} as any;

		const result = canTranspileAsSingleExpression(ast);

		expect(result).toBe(true);
	});

	test("nested nullish coalescing a ?? b ?? c", () => {
		const ctx: TranspileContext = {
			stateVarNames: new Set(["a", "b", "c"]),
			stateVarTypes: new Map([
				["a", "number"],
				["b", "number"],
				["c", "number"],
			]),
			singleExpressionOnly: false,
			tempVarCounter: 0,
			chainDepth: 0,
			errors: [],
			source: "",
			filename: "test.svelte",
			usesStdlib: false,
			requiredPolyfills: new Set(),
			extractedCallbacks: [],
			callbackCounter: 0,
		};

		const ast = {
			type: "LogicalExpression",
			operator: "??",
			left: {
				type: "LogicalExpression",
				operator: "??",
				left: { type: "Identifier", name: "a" },
				right: { type: "Identifier", name: "b" },
			},
			right: { type: "Identifier", name: "c" },
		} as any;

		const result = transpileExpression(ast, ctx);

		expect(result.code).toBe("__nc_1");
		expect(result.preamble).toBeTruthy();
		// Should have nested temp vars
		expect(result.preamble!.join("\n")).toContain("__nc_0");
		expect(result.preamble!.join("\n")).toContain("__nc_1");
	});

	test("nullish coalescing with non-state variable", () => {
		const ctx: TranspileContext = {
			stateVarNames: new Set(),
			stateVarTypes: new Map(),
			singleExpressionOnly: false,
			tempVarCounter: 0,
			chainDepth: 0,
			errors: [],
			source: "",
			filename: "test.svelte",
			usesStdlib: false,
			requiredPolyfills: new Set(),
			extractedCallbacks: [],
			callbackCounter: 0,
		};

		const ast = {
			type: "LogicalExpression",
			operator: "??",
			left: { type: "Identifier", name: "localVar" },
			right: { type: "Literal", value: "default", raw: '"default"' },
		} as any;

		const result = transpileExpression(ast, ctx);

		expect(result.code).toBe("__nc_0");
		expect(result.preamble).toContain('__nc_0 = "default"');
		expect(result.preamble).toContain("if localVar <> invalid then __nc_0 = localVar");
	});

	test("nullish coalescing with complex right expression", () => {
		const ctx: TranspileContext = {
			stateVarNames: new Set(["a", "b"]),
			stateVarTypes: new Map([
				["a", "number"],
				["b", "number"],
			]),
			singleExpressionOnly: false,
			tempVarCounter: 0,
			chainDepth: 0,
			errors: [],
			source: "",
			filename: "test.svelte",
			usesStdlib: false,
			requiredPolyfills: new Set(),
			extractedCallbacks: [],
			callbackCounter: 0,
		};

		const ast = {
			type: "LogicalExpression",
			operator: "??",
			left: { type: "Identifier", name: "a" },
			right: {
				type: "BinaryExpression",
				operator: "+",
				left: { type: "Identifier", name: "b" },
				right: { type: "Literal", value: 1, raw: "1" },
			},
		} as any;

		const result = transpileExpression(ast, ctx);

		expect(result.code).toBe("__nc_0");
		expect(result.preamble!.join("\n")).toContain("__nc_0 = (m.state.b + 1)");
		expect(result.preamble!.join("\n")).toContain("if m.state.a <> invalid then __nc_0 = m.state.a");
	});

	test("string literal fallback", () => {
		const ctx: TranspileContext = {
			stateVarNames: new Set(["title"]),
			stateVarTypes: new Map([["title", "string"]]),
			singleExpressionOnly: false,
			tempVarCounter: 0,
			chainDepth: 0,
			errors: [],
			source: "",
			filename: "test.svelte",
			usesStdlib: false,
			requiredPolyfills: new Set(),
			extractedCallbacks: [],
			callbackCounter: 0,
		};

		const ast = {
			type: "LogicalExpression",
			operator: "??",
			left: { type: "Identifier", name: "title" },
			right: { type: "Literal", value: "Untitled", raw: '"Untitled"' },
		} as any;

		const result = transpileExpression(ast, ctx);

		expect(result.code).toBe("__nc_0");
		expect(result.preamble).toContain('__nc_0 = "Untitled"');
		expect(result.preamble).toContain(
			"if m.state.title <> invalid then __nc_0 = m.state.title"
		);
	});
});
