import { describe, it, expect } from "vitest";
import { buildIR, cssColorToRokuHex } from "../../src/ir/builder.js";
import { parse } from "svelte/compiler";

function parseSource(source: string) {
  return parse(source, { filename: "test.svelte", modern: true });
}

describe("buildIR", () => {
  it("builds IR from a simple text element", () => {
    const ast = parseSource("<text>Hello</text>");
    const { component } = buildIR(ast, "<text>Hello</text>", "Test.svelte");

    expect(component.name).toBe("Test");
    expect(component.extends).toBe("Group");
    expect(component.children).toHaveLength(1);
    expect(component.children[0]!.type).toBe("Label");
    expect(component.children[0]!.textContent).toBe("Hello");
  });

  it("maps image to Poster with uri", () => {
    const source = '<image src="test.jpg" width="100" height="50" />';
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Img.svelte");

    const poster = component.children[0]!;
    expect(poster.type).toBe("Poster");
    expect(poster.properties).toContainEqual({
      name: "uri",
      value: "test.jpg",
    });
    expect(poster.properties).toContainEqual({
      name: "width",
      value: "100",
    });
  });

  it("handles nested groups", () => {
    const source = "<group><text>Inner</text></group>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Nested.svelte");

    expect(component.children).toHaveLength(1);
    expect(component.children[0]!.type).toBe("Group");
    expect(component.children[0]!.children).toHaveLength(1);
    expect(component.children[0]!.children[0]!.type).toBe("Label");
  });

  it("warns on unknown elements", () => {
    const source = "<div>Hello</div>";
    const ast = parseSource(source);
    const { component, warnings } = buildIR(ast, source, "Bad.svelte");

    expect(component.children).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe("UNKNOWN_ELEMENT");
  });

  it("parses inline styles", () => {
    const source = '<text style="color: red; font-size: 24">Styled</text>';
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Styled.svelte");

    const label = component.children[0]!;
    expect(label.properties).toContainEqual({
      name: "color",
      value: "0xff0000ff",
    });
    expect(label.properties).toContainEqual({
      name: "fontSize",
      value: "24",
    });
  });

  it("handles display:none", () => {
    const source = '<rectangle style="display: none" />';
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Hidden.svelte");

    const rect = component.children[0]!;
    expect(rect.properties).toContainEqual({
      name: "visible",
      value: "false",
    });
  });

  it("assigns auto-generated IDs", () => {
    const source = "<text>A</text><text>B</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Multi.svelte");

    expect(component.children[0]!.id).toBe("label_0");
    expect(component.children[1]!.id).toBe("label_1");
  });

  it("uses explicit id attribute", () => {
    const source = '<text id="title">Hello</text>';
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "WithId.svelte");

    expect(component.children[0]!.id).toBe("title");
  });

  it("extends Group by default", () => {
    const ast = parseSource("<text>Hello</text>");
    const { component } = buildIR(ast, "<text>Hello</text>", "Test.svelte");
    expect(component.extends).toBe("Group");
  });

  it("extends Scene when isEntry is true", () => {
    const ast = parseSource("<text>Hello</text>");
    const { component } = buildIR(ast, "<text>Hello</text>", "Test.svelte", {
      isEntry: true,
    });
    expect(component.extends).toBe("Scene");
  });
});

describe("buildIR - state extraction", () => {
  it("extracts let declarations as number state", () => {
    const source = "<script>let count = 0;</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    expect(component.state![0]).toEqual({
      name: "count",
      initialValue: "0",
      type: "number",
    });
  });

  it("extracts let declarations as string state", () => {
    const source = '<script>let name = "world";</script><text>Hello</text>';
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    expect(component.state![0]).toEqual({
      name: "name",
      initialValue: "world",
      type: "string",
    });
  });

  it("extracts let declarations as boolean state", () => {
    const source = "<script>let active = true;</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    expect(component.state![0]).toEqual({
      name: "active",
      initialValue: "true",
      type: "boolean",
    });
  });

  it("defaults uninitialized let to number 0", () => {
    const source = "<script>let x;</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    expect(component.state![0]).toEqual({
      name: "x",
      initialValue: "0",
      type: "number",
    });
  });

  it("skips const declarations (not reactive)", () => {
    const source = "<script>const PI = 3.14;</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toBeUndefined();
  });

  it("extracts multiple state variables", () => {
    const source =
      '<script>let count = 0; let label = "hi"; let visible = true;</script><text>Hello</text>';
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(3);
    expect(component.state![0]!.name).toBe("count");
    expect(component.state![1]!.name).toBe("label");
    expect(component.state![2]!.name).toBe("visible");
  });

  it("errors on non-literal state init", () => {
    const source = "<script>let x = someFunction();</script><text>Hello</text>";
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("UNSUPPORTED_STATE_INIT");
  });

  it("extracts negative number state init", () => {
    const source = "<script>let x = -5;</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    expect(component.state![0]).toEqual({
      name: "x",
      initialValue: "-5",
      type: "number",
    });
  });

  it("extracts false boolean state", () => {
    const source = "<script>let active = false;</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    expect(component.state![0]).toEqual({
      name: "active",
      initialValue: "false",
      type: "boolean",
    });
  });

  it("extracts state alongside const declarations", () => {
    const source =
      "<script>const PI = 3.14; let count = 0; const NAME = 'test';</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    expect(component.state![0]!.name).toBe("count");
  });
});

describe("buildIR - handler extraction", () => {
  it("extracts handler with increment", () => {
    const source =
      "<script>let count = 0; function increment() { count++; }</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.handlers).toHaveLength(1);
    expect(component.handlers![0]!.name).toBe("increment");
    expect(component.handlers![0]!.statements).toEqual([
      { type: "increment", variable: "count" },
    ]);
    expect(component.handlers![0]!.mutatedVariables).toEqual(["count"]);
  });

  it("extracts handler with decrement", () => {
    const source =
      "<script>let count = 0; function decrement() { count--; }</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.handlers![0]!.statements).toEqual([
      { type: "decrement", variable: "count" },
    ]);
  });

  it("extracts handler with assign-literal", () => {
    const source =
      "<script>let count = 0; function reset() { count = 0; }</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.handlers![0]!.statements).toEqual([
      { type: "assign-literal", variable: "count", value: "0" },
    ]);
  });

  it("extracts handler with assign-negate", () => {
    const source =
      "<script>let active = true; function toggle() { active = !active; }</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.handlers![0]!.statements).toEqual([
      { type: "assign-negate", variable: "active" },
    ]);
  });

  it("extracts handler with assign-add", () => {
    const source =
      "<script>let count = 0; function addFive() { count = count + 5; }</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.handlers![0]!.statements).toEqual([
      { type: "assign-add", variable: "count", operand: "5" },
    ]);
  });

  it("extracts handler with assign-sub", () => {
    const source =
      "<script>let count = 10; function subThree() { count = count - 3; }</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.handlers![0]!.statements).toEqual([
      { type: "assign-sub", variable: "count", operand: "3" },
    ]);
  });

  it("errors on unsupported handler body", () => {
    const source =
      "<script>let count = 0; function bad() { for (let i = 0; i < 10; i++) { count++; } }</script><text>Hello</text>";
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("UNSUPPORTED_HANDLER_BODY");
  });

  it("extracts handler with multiple statements", () => {
    const source =
      '<script>let count = 0; let label = "a"; function multi() { count++; label = "b"; }</script><text>Hello</text>';
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.handlers![0]!.name).toBe("multi");
    expect(component.handlers![0]!.statements).toHaveLength(2);
    expect(component.handlers![0]!.statements[0]).toEqual({
      type: "increment",
      variable: "count",
    });
    expect(component.handlers![0]!.statements[1]).toEqual({
      type: "assign-literal",
      variable: "label",
      value: "b",
    });
    expect(component.handlers![0]!.mutatedVariables).toEqual(["count", "label"]);
  });

  it("errors when handler mutates non-state variable", () => {
    const source =
      "<script>let count = 0; function bad() { unknown++; }</script><text>Hello</text>";
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("UNSUPPORTED_HANDLER_BODY");
  });

  it("extracts empty handler (no statements)", () => {
    const source =
      "<script>let count = 0; function noop() {}</script><text>Hello</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.handlers![0]!.name).toBe("noop");
    expect(component.handlers![0]!.statements).toEqual([]);
    expect(component.handlers![0]!.mutatedVariables).toEqual([]);
  });
});

describe("buildIR - bindings", () => {
  it("extracts expression binding from text content", () => {
    const source =
      "<script>let count = 0;</script><text>{count}</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.bindings).toHaveLength(1);
    expect(component.bindings![0]!.property).toBe("text");
    expect(component.bindings![0]!.stateVar).toBe("count");
    expect(component.bindings![0]!.dependencies).toEqual(["count"]);
  });

  it("extracts mixed text bindings with textParts", () => {
    const source =
      "<script>let count = 0;</script><text>Count: {count}</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.bindings).toHaveLength(1);
    const binding = component.bindings![0]!;
    expect(binding.textParts).toBeDefined();
    expect(binding.textParts).toEqual([
      { type: "static", value: "Count:" },
      { type: "dynamic", value: "count" },
    ]);
  });

  it("extracts attribute binding", () => {
    const source =
      "<script>let active = true;</script><rectangle visible={active} />";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.bindings).toHaveLength(1);
    expect(component.bindings![0]!.property).toBe("visible");
    expect(component.bindings![0]!.stateVar).toBe("active");
  });

  it("errors on unknown state ref in text", () => {
    const source = "<script>let count = 0;</script><text>{unknown}</text>";
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("UNKNOWN_STATE_REF");
  });

  it("errors on unknown state ref in attribute", () => {
    const source = "<script>let count = 0;</script><rectangle visible={unknown} />";
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("UNKNOWN_STATE_REF");
  });

  it("extracts multiple bindings on same node", () => {
    const source =
      "<script>let show = true; let alpha = 1;</script><rectangle visible={show} opacity={alpha} />";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.bindings).toHaveLength(2);
    expect(component.bindings![0]!.property).toBe("visible");
    expect(component.bindings![0]!.stateVar).toBe("show");
    expect(component.bindings![1]!.property).toBe("opacity");
    expect(component.bindings![1]!.stateVar).toBe("alpha");
  });

  it("extracts mixed text with multiple dynamic vars", () => {
    const source =
      '<script>let first = "John"; let last = "Doe";</script><text>{first} {last}</text>';
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.bindings).toHaveLength(1);
    const binding = component.bindings![0]!;
    expect(binding.dependencies).toContain("first");
    expect(binding.dependencies).toContain("last");
    expect(binding.textParts!.filter((p) => p.type === "dynamic")).toHaveLength(2);
  });

  it("does not add static text property for dynamic-only text", () => {
    const source =
      "<script>let count = 0;</script><text>{count}</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const label = component.children[0]!;
    // text property should not be in static properties
    expect(label.properties.find((p) => p.name === "text")).toBeUndefined();
    expect(label.textContent).toBeUndefined();
  });
});

describe("buildIR - events", () => {
  it("extracts on:select events", () => {
    const source =
      "<script>let count = 0; function increment() { count++; }</script><text on:select={increment} focusable>{count}</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.events).toHaveLength(1);
    expect(component.events![0]!.eventType).toBe("select");
    expect(component.events![0]!.handlerName).toBe("increment");
  });

  it("errors on unknown handler reference", () => {
    const source =
      "<script>let count = 0;</script><text on:select={nonExistent} focusable>{count}</text>";
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("UNKNOWN_HANDLER");
  });
});

describe("buildIR - focus", () => {
  it("detects focusable attribute", () => {
    const source =
      "<script>let count = 0; function inc() { count++; }</script><text on:select={inc} focusable>{count}</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.children[0]!.focusable).toBe(true);
  });

  it("detects autofocus attribute", () => {
    const source =
      "<script>let count = 0; function inc() { count++; }</script><text on:select={inc} focusable autofocus>{count}</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.autofocusNodeId).toBe("label_0");
    expect(component.children[0]!.focusable).toBe(true);
  });

  it("autofocus implies focusable", () => {
    const source =
      "<script>let count = 0; function inc() { count++; }</script><text on:select={inc} autofocus>{count}</text>";
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.children[0]!.focusable).toBe(true);
    expect(component.autofocusNodeId).toBe("label_0");
  });
});

// === v0.3 — array state + {#each} ===

describe("buildIR - array state extraction", () => {
  it("extracts array state with object literal items", () => {
    const source = `<script>let items = [{ title: "A" }, { title: "B" }];</script><list>{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    expect(component.state![0]!.type).toBe("array");
    expect(component.state![0]!.name).toBe("items");
  });

  it("extracts field names and types from array items", () => {
    const source = `<script>let items = [{ title: "A", count: 1, active: true }];</script><list>{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const sv = component.state![0]!;
    expect(sv.arrayItemFields).toHaveLength(3);
    expect(sv.arrayItemFields![0]).toEqual({ name: "title", type: "string" });
    expect(sv.arrayItemFields![1]).toEqual({ name: "count", type: "number" });
    expect(sv.arrayItemFields![2]).toEqual({ name: "active", type: "boolean" });
  });

  it("extracts array item values", () => {
    const source = `<script>let items = [{ title: "A" }, { title: "B" }];</script><list>{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const sv = component.state![0]!;
    expect(sv.arrayItems).toHaveLength(2);
    expect(sv.arrayItems![0]!.fields).toEqual({ title: "A" });
    expect(sv.arrayItems![1]!.fields).toEqual({ title: "B" });
  });

  it("errors on non-object-literal array items", () => {
    const source = `<script>let items = ["a", "b"];</script><text>hello</text>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("UNSUPPORTED_ARRAY_INIT");
  });

  it("errors on non-literal field values in array items", () => {
    const source = `<script>let items = [{ title: getTitle() }];</script><text>hello</text>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("UNSUPPORTED_ARRAY_INIT");
  });
});

describe("buildIR - {#each} block handling", () => {
  it("creates IREachBlock linking list to item component", () => {
    const source = `<script>let items = [{ title: "A" }];</script><list>{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.eachBlocks).toHaveLength(1);
    expect(component.eachBlocks![0]!.arrayVar).toBe("items");
    expect(component.eachBlocks![0]!.itemAlias).toBe("item");
    expect(component.eachBlocks![0]!.itemComponentName).toBe("Test_Item0");
    expect(component.eachBlocks![0]!.listNodeId).toMatch(/^markuplist_/);
  });

  it("creates IRItemComponent with correct children", () => {
    const source = `<script>let items = [{ title: "A" }];</script><list>{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.itemComponents).toHaveLength(1);
    const ic = component.itemComponents![0]!;
    expect(ic.name).toBe("Test_Item0");
    expect(ic.children).toHaveLength(1);
    expect(ic.children[0]!.type).toBe("Label");
  });

  it("creates IRItemFieldBindings for {item.field} in text", () => {
    const source = `<script>let items = [{ title: "A" }];</script><list>{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const ic = component.itemComponents![0]!;
    expect(ic.fieldBindings).toHaveLength(1);
    expect(ic.fieldBindings[0]!.property).toBe("text");
    expect(ic.fieldBindings[0]!.field).toBe("title");
  });

  it("creates multiple field bindings for multiple labels", () => {
    const source = `<script>let items = [{ title: "A", year: "2024" }];</script><list>{#each items as item}<text>{item.title}</text><text>{item.year}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const ic = component.itemComponents![0]!;
    expect(ic.fieldBindings).toHaveLength(2);
    expect(ic.fieldBindings[0]!.field).toBe("title");
    expect(ic.fieldBindings[1]!.field).toBe("year");
    expect(ic.children).toHaveLength(2);
  });

  it("handles mixed text with item fields (IRItemTextPart)", () => {
    const source = `<script>let items = [{ title: "A" }];</script><list>{#each items as item}<text>Title: {item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const ic = component.itemComponents![0]!;
    expect(ic.fieldBindings).toHaveLength(1);
    const binding = ic.fieldBindings[0]!;
    expect(binding.textParts).toBeDefined();
    expect(binding.textParts).toHaveLength(2);
    expect(binding.textParts![0]).toEqual({ type: "static", value: "Title:" });
    expect(binding.textParts![1]).toEqual({ type: "field", value: "title" });
  });

  it("parses itemSize from list attribute", () => {
    const source = `<script>let items = [{ title: "A" }];</script><list itemSize="[1920, 100]">{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const ic = component.itemComponents![0]!;
    expect(ic.itemSize).toEqual([1920, 100]);
  });

  it("adds itemComponentName property to MarkupList node", () => {
    const source = `<script>let items = [{ title: "A" }];</script><list>{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const listNode = component.children[0]!;
    expect(listNode.type).toBe("MarkupList");
    expect(listNode.properties.find(p => p.name === "itemComponentName")?.value).toBe("Test_Item0");
  });

  it("errors on {#each} outside <list>", () => {
    const source = `<script>let items = [{ title: "A" }];</script><group>{#each items as item}<text>{item.title}</text>{/each}</group>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.code === "EACH_OUTSIDE_LIST")).toBe(true);
  });

  it("errors on {#each} with index", () => {
    const source = `<script>let items = [{ title: "A" }];</script><list>{#each items as item, i}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.code === "EACH_WITH_INDEX")).toBe(true);
  });

  it("errors on {#each} with key expression", () => {
    const source = `<script>let items = [{ id: "1", title: "A" }];</script><list>{#each items as item (item.id)}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.code === "EACH_WITH_KEY")).toBe(true);
  });

  it("errors on nested {#each}", () => {
    const source = `<script>let items = [{ title: "A" }]; let nested = [{ name: "B" }];</script><list>{#each items as item}<list>{#each nested as n}<text>{n.name}</text>{/each}</list>{/each}</list>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.code === "EACH_NESTED")).toBe(true);
  });

  it("errors on outer state ref inside {#each}", () => {
    const source = `<script>let count = 0; let items = [{ title: "A" }];</script><list>{#each items as item}<text>{count}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.code === "EACH_OUTER_STATE_REF")).toBe(true);
  });

  it("errors on unknown array var in {#each}", () => {
    const source = `<script>let count = 0;</script><list>{#each unknownItems as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.code === "EACH_NO_ARRAY_STATE")).toBe(true);
  });

  it("errors when {#each} references a non-array state var", () => {
    const source = `<script>let count = 0;</script><list>{#each count as item}<text>{item.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { errors } = buildIR(ast, source, "Test.svelte");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.code === "EACH_NO_ARRAY_STATE")).toBe(true);
  });
});

// === v0.4 — fetch state extraction ===

describe("buildIR - fetch state extraction", () => {
  it("extracts fetch-sourced state variable with URL and taskComponentName", () => {
    const source = `<script>let movies = fetch("/api/movies")</script><list>{#each movies as movie}<text>{movie.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state).toHaveLength(1);
    const sv = component.state![0]!;
    expect(sv.name).toBe("movies");
    expect(sv.type).toBe("array");
    expect(sv.fetchCall).toBeDefined();
    expect(sv.fetchCall!.url).toBe("/api/movies");
    expect(sv.fetchCall!.urlIsLiteral).toBe(true);
    expect(sv.fetchCall!.hasOptions).toBe(false);
  });

  it("back-fills arrayItemFields from template field bindings", () => {
    const source = `<script>let movies = fetch("/api/movies")</script><list>{#each movies as movie}<text>{movie.title}</text><text>{movie.year}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    const sv = component.state![0]!;
    expect(sv.arrayItemFields).toBeDefined();
    expect(sv.arrayItemFields).toHaveLength(2);
    expect(sv.arrayItemFields![0]).toEqual({ name: "title", type: "string" });
    expect(sv.arrayItemFields![1]).toEqual({ name: "year", type: "string" });
  });

  it("back-fill works correctly with mixed static + fetch state", () => {
    const source = `<script>let count = 0; let movies = fetch("/api/movies")</script><text>{count}</text><list>{#each movies as movie}<text>{movie.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    // Static state should be unaffected
    expect(component.state).toHaveLength(2);
    expect(component.state![0]!.name).toBe("count");
    expect(component.state![0]!.type).toBe("number");
    expect(component.state![0]!.fetchCall).toBeUndefined();

    // Fetch state should have back-filled fields
    expect(component.state![1]!.name).toBe("movies");
    expect(component.state![1]!.fetchCall).toBeDefined();
    expect(component.state![1]!.arrayItemFields).toHaveLength(1);
    expect(component.state![1]!.arrayItemFields![0]).toEqual({ name: "title", type: "string" });
  });

  it("sets requiresRuntime when fetch is used", () => {
    const source = `<script>let movies = fetch("/api/movies")</script><list>{#each movies as movie}<text>{movie.title}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.requiresRuntime).toBe(true);
  });

  it("accepts dynamic URL and sets urlIsLiteral: false", () => {
    const source = `<script>let data = fetch(someVar)</script><text>Loading</text>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state![0]!.fetchCall!.urlIsLiteral).toBe(false);
    expect(component.state![0]!.fetchCall!.url).toBe("someVar");
  });

  it("accepts fetch with options", () => {
    const source = `<script>let data = fetch("/api", { method: "POST" })</script><text>Loading</text>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    expect(component.state![0]!.fetchCall!.hasOptions).toBe(true);
    expect(component.state![0]!.fetchCall!.optionsSource).toContain("method");
  });

  it("sets requiresRuntime when multiple fetch calls exist", () => {
    const source = `<script>let a = fetch("/api/a"); let b = fetch("/api/b")</script><list>{#each a as item}<text>{item.name}</text>{/each}</list><list>{#each b as item}<text>{item.name}</text>{/each}</list>`;
    const ast = parseSource(source);
    const { component } = buildIR(ast, source, "Test.svelte");

    // Both state vars should have fetchCall defined
    expect(component.requiresRuntime).toBe(true);
    expect(component.state![0]!.fetchCall).toBeDefined();
    expect(component.state![1]!.fetchCall).toBeDefined();
  });
});

describe("cssColorToRokuHex", () => {
  it("converts #rrggbb", () => {
    expect(cssColorToRokuHex("#ff0000")).toBe("0xff0000ff");
  });

  it("converts #rgb", () => {
    expect(cssColorToRokuHex("#f00")).toBe("0xff0000ff");
  });

  it("converts #rrggbbaa", () => {
    expect(cssColorToRokuHex("#ff000080")).toBe("0xff000080");
  });

  it("converts named colors", () => {
    expect(cssColorToRokuHex("red")).toBe("0xff0000ff");
    expect(cssColorToRokuHex("white")).toBe("0xffffffff");
    expect(cssColorToRokuHex("transparent")).toBe("0x00000000");
  });

  it("passes through 0x format", () => {
    expect(cssColorToRokuHex("0xAABBCCDD")).toBe("0xaabbccdd");
  });
});
