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
