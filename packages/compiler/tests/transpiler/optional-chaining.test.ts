import { describe, it, expect } from "vitest";
import {
	transpileExpression,
	type TranspileContext,
	canTranspileAsSingleExpression,
} from "../../src/transpiler/expression.js";
import type * as ESTree from "estree";

/**
 * Helper to create a base TranspileContext for testing
 */
function createContext(overrides?: Partial<TranspileContext>): TranspileContext {
	return {
		stateVarNames: new Set(["data", "a", "obj"]),
		stateVarTypes: new Map([
			["data", "string"],
			["a", "object"],
			["obj", "object"],
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
		...overrides,
	};
}

/**
 * Helper to create an Identifier node
 */
function identifier(name: string): ESTree.Identifier {
	return {
		type: "Identifier",
		name,
	};
}

/**
 * Helper to create a MemberExpression node
 */
function memberExpression(
	object: ESTree.Expression,
	property: ESTree.Expression | ESTree.Identifier,
	optional = false,
	computed = false,
): ESTree.MemberExpression {
	return {
		type: "MemberExpression",
		object,
		property,
		computed,
		optional,
	};
}

/**
 * Helper to create a ChainExpression node
 */
function chainExpression(
	expression: ESTree.Expression,
): ESTree.ChainExpression {
	return {
		type: "ChainExpression",
		expression,
	};
}

/**
 * Helper to create a CallExpression node
 */
function callExpression(
	callee: ESTree.Expression,
	args: ESTree.Expression[] = [],
	optional = false,
): ESTree.CallExpression {
	return {
		type: "CallExpression",
		callee,
		arguments: args,
		optional,
	};
}

describe("optional chaining transpilation", () => {
	it("should transpile simple optional member access a?.b", () => {
		const ctx = createContext();

		// Build AST for: a?.b
		const ast = chainExpression(
			memberExpression(identifier("a"), identifier("b"), true),
		);

		const result = transpileExpression(ast, ctx);

		expect(result.code).toBe("__oc_0");
		expect(result.preamble).toContain("__oc_0 = invalid");
		expect(result.preamble).toContain("if m.state.a <> invalid then __oc_0 = m.state.a.b");
		expect(result.dependencies).toContain("a");
	});

	it("should transpile chained optional access a?.b?.c", () => {
		const ctx = createContext();

		// Build AST for: a?.b?.c
		const ast = chainExpression(
			memberExpression(
				memberExpression(identifier("a"), identifier("b"), true),
				identifier("c"),
				true,
			),
		);

		const result = transpileExpression(ast, ctx);

		expect(result.code).toContain("__oc_");
		expect(result.preamble!.join("\n")).toContain("invalid");
		// Should have multiple temp vars and guards
		expect(result.preamble!.join("\n")).toMatch(/if.*<> invalid/);
		expect(result.dependencies).toContain("a");
	});

	it("should transpile optional method call a?.b()", () => {
		const ctx = createContext();

		// Build AST for: a?.b()
		const ast = chainExpression(
			callExpression(
				memberExpression(identifier("a"), identifier("b"), false),
				[],
				true,
			),
		);

		const result = transpileExpression(ast, ctx);

		expect(result.code).toContain("__oc_");
		expect(result.preamble!.join("\n")).toContain("invalid");
		expect(result.preamble!.join("\n")).toMatch(/if.*<> invalid/);
		expect(result.dependencies).toContain("a");
	});

	it("should transpile mixed optional and non-optional a?.b.c", () => {
		const ctx = createContext();

		// Build AST for: a?.b.c
		const ast = chainExpression(
			memberExpression(
				memberExpression(identifier("a"), identifier("b"), true),
				identifier("c"),
				false,
			),
		);

		const result = transpileExpression(ast, ctx);

		expect(result.code).toContain("__oc_");
		expect(result.preamble!.join("\n")).toContain("invalid");
		// Should guard the optional part, then access .c
		expect(result.preamble!.join("\n")).toMatch(/if.*<> invalid/);
		expect(result.dependencies).toContain("a");
	});

	it("should push error when in singleExpressionOnly mode", () => {
		const ctx = createContext({ singleExpressionOnly: true });

		// Build AST for: a?.b
		const ast = chainExpression(
			memberExpression(identifier("a"), identifier("b"), true),
		);

		transpileExpression(ast, ctx);

		expect(ctx.errors.length).toBeGreaterThan(0);
		expect(ctx.errors[0].code).toBe("UNSUPPORTED_EXPRESSION");
	});

	it("should return false from canTranspileAsSingleExpression for ChainExpression", () => {
		// Build AST for: a?.b
		const ast = chainExpression(
			memberExpression(identifier("a"), identifier("b"), true),
		);

		const result = canTranspileAsSingleExpression(ast);

		expect(result).toBe(false);
	});

	it("should handle optional chaining with multiple levels a?.b?.c?.d", () => {
		const ctx = createContext();

		// Build AST for: a?.b?.c?.d
		const ast = chainExpression(
			memberExpression(
				memberExpression(
					memberExpression(identifier("a"), identifier("b"), true),
					identifier("c"),
					true,
				),
				identifier("d"),
				true,
			),
		);

		const result = transpileExpression(ast, ctx);

		expect(result.code).toContain("__oc_");
		expect(result.preamble!.join("\n")).toContain("invalid");
		expect(result.dependencies).toContain("a");
	});

	it("should handle optional chaining with computed property a?.[key]", () => {
		const ctx = createContext({
			stateVarNames: new Set(["a", "key"]),
			stateVarTypes: new Map([
				["a", "object"],
				["key", "string"],
			]),
		});

		// Build AST for: a?.[key]
		const ast = chainExpression(
			memberExpression(identifier("a"), identifier("key"), true, true),
		);

		const result = transpileExpression(ast, ctx);

		expect(result.code).toContain("__oc_");
		expect(result.preamble!.join("\n")).toContain("invalid");
		expect(result.dependencies).toContain("a");
		expect(result.dependencies).toContain("key");
	});

	it("should handle optional call with arguments a?.method(x, y)", () => {
		const ctx = createContext({
			stateVarNames: new Set(["a", "x", "y"]),
			stateVarTypes: new Map([
				["a", "object"],
				["x", "number"],
				["y", "number"],
			]),
		});

		// Build AST for: a?.method(x, y)
		const ast = chainExpression(
			callExpression(
				memberExpression(identifier("a"), identifier("method"), false),
				[identifier("x"), identifier("y")],
				true,
			),
		);

		const result = transpileExpression(ast, ctx);

		expect(result.code).toContain("__oc_");
		expect(result.preamble!.join("\n")).toContain("invalid");
		expect(result.dependencies).toContain("a");
		expect(result.dependencies).toContain("x");
		expect(result.dependencies).toContain("y");
	});

	it("should track temp var counter correctly", () => {
		const ctx = createContext();

		// First optional chain
		const ast1 = chainExpression(
			memberExpression(identifier("a"), identifier("b"), true),
		);

		const result1 = transpileExpression(ast1, ctx);
		expect(result1.code).toBe("__oc_0");

		// Second optional chain in same context
		const ast2 = chainExpression(
			memberExpression(identifier("a"), identifier("c"), true),
		);

		const result2 = transpileExpression(ast2, ctx);
		expect(result2.code).toBe("__oc_1");
	});
});
