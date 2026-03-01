import { describe, it, expect } from "vitest";
import { compile } from "../../src/index.js";

describe("CSS property translation", () => {
  it("translates display:none to visible=false", async () => {
    const result = await compile(
      '<rectangle style="display: none" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('visible="false"');
  });

  it("translates visibility:hidden to visible=false", async () => {
    const result = await compile(
      '<rectangle style="visibility: hidden" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('visible="false"');
  });

  it("translates text-align to horizAlign", async () => {
    const result = await compile(
      '<text style="text-align: center">Hello</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('horizAlign="center"');
  });

  it("translates font-weight:bold to font", async () => {
    const result = await compile(
      '<text style="font-weight: bold">Bold</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('font="font:MediumBoldSystemFont"');
  });

  it("translates transform:rotate to rotation", async () => {
    const result = await compile(
      '<rectangle style="transform: rotate(45deg)" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('rotation="45"');
  });

  it("translates transform:scale to scale", async () => {
    const result = await compile(
      '<rectangle style="transform: scale(2, 3)" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('scale="[2, 3]"');
  });

  it("accumulates left + top into translation", async () => {
    const result = await compile(
      '<rectangle style="left: 100px; top: 50px" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('translation="[100, 50]"');
  });

  it("accumulates translate + left/top additively", async () => {
    const result = await compile(
      '<rectangle style="transform: translate(10, 20); left: 5px; top: 5px" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('translation="[15, 25]"');
  });

  it("translates white-space:normal to wrap=true", async () => {
    const result = await compile(
      '<text style="white-space: normal">Wrapping text</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('wrap="true"');
  });

  it("translates word-wrap:break-word to wrap=true", async () => {
    const result = await compile(
      '<text style="word-wrap: break-word">Wrapping text</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('wrap="true"');
  });

  it("translates white-space:nowrap to wrap=false", async () => {
    const result = await compile(
      '<text style="white-space: nowrap">No wrap</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('wrap="false"');
  });

  it("resolves px unit for width/height", async () => {
    const result = await compile(
      '<rectangle style="width: 200px; height: 100px" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('width="200"');
    expect(result.xml).toContain('height="100"');
  });

  it("resolves rem unit for font-size", async () => {
    const result = await compile(
      '<text style="font-size: 2rem">Big</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('fontSize="32"');
  });

  it("translates opacity", async () => {
    const result = await compile(
      '<rectangle style="opacity: 0.5" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('opacity="0.5"');
  });
});

describe("CSS context-sensitive color mapping", () => {
  it("maps color to color on Label", async () => {
    const result = await compile(
      '<text style="color: red">Red text</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('color="0xff0000ff"');
  });

  it("warns color on Rectangle", async () => {
    const result = await compile(
      '<rectangle style="color: red" />',
      "Test.svelte",
    );
    expect(result.warnings.some((w) => w.code === "CSS_CONTEXT_MISMATCH")).toBe(true);
  });

  it("maps background-color to color on Rectangle", async () => {
    const result = await compile(
      '<rectangle style="background-color: blue" />',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('color="0x0000ffff"');
  });

  it("warns background-color on Label", async () => {
    const result = await compile(
      '<text style="background-color: blue">Text</text>',
      "Test.svelte",
    );
    expect(result.warnings.some((w) => w.code === "CSS_CONTEXT_MISMATCH")).toBe(true);
  });

  it("maps rgb() colors correctly", async () => {
    const result = await compile(
      '<text style="color: rgb(128, 0, 255)">Purple</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('color="0x8000ffff"');
  });

  it("maps rgba() colors correctly", async () => {
    const result = await compile(
      '<text style="color: rgba(255, 0, 0, 0.5)">Half red</text>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('color="0xff000080"');
  });
});

describe("CSS unsupported property warnings", () => {
  it("warns on margin with hint", async () => {
    const result = await compile(
      '<rectangle style="margin: 10px" />',
      "Test.svelte",
    );
    expect(result.warnings.some((w) =>
      w.code === "UNSUPPORTED_CSS_HINT" && w.message.includes("margin"),
    )).toBe(true);
  });

  it("warns on border with hint", async () => {
    const result = await compile(
      '<rectangle style="border: 1px solid red" />',
      "Test.svelte",
    );
    expect(result.warnings.some((w) =>
      w.code === "UNSUPPORTED_CSS_HINT" && w.message.includes("border"),
    )).toBe(true);
  });

  it("warns on z-index with hint", async () => {
    const result = await compile(
      '<rectangle style="z-index: 10" />',
      "Test.svelte",
    );
    expect(result.warnings.some((w) =>
      w.code === "UNSUPPORTED_CSS_HINT" && w.message.includes("z-index"),
    )).toBe(true);
  });

  it("warns on max-width with hint", async () => {
    const result = await compile(
      '<rectangle style="max-width: 500px" />',
      "Test.svelte",
    );
    expect(result.warnings.some((w) =>
      w.code === "UNSUPPORTED_CSS_HINT" && w.message.includes("max-width"),
    )).toBe(true);
  });

  it("warns on unknown CSS property", async () => {
    const result = await compile(
      '<rectangle style="cursor: pointer" />',
      "Test.svelte",
    );
    expect(result.warnings.some((w) => w.code === "UNSUPPORTED_CSS")).toBe(true);
  });

  it("warns on flex-wrap", async () => {
    const result = await compile(
      '<group style="display: flex; flex-wrap: wrap; width: 500px; height: 500px"><rectangle style="width: 100px; height: 100px" /></group>',
      "Test.svelte",
    );
    expect(result.warnings.some((w) =>
      w.code === "UNSUPPORTED_CSS_HINT" && w.message.includes("flex-wrap"),
    )).toBe(true);
  });
});

describe("CSS display:flex stores flexStyles", () => {
  it("stores display:flex as flexStyles on IRNode", async () => {
    const result = await compile(
      '<group style="display: flex; flex-direction: column; width: 500px; height: 500px"><rectangle style="width: 100px; height: 100px" /></group>',
      "Test.svelte",
    );
    expect(result.errors).toEqual([]);
    // The flex layout pass should have processed and removed flexStyles
    // and injected computed positions
    expect(result.xml).toContain("Group");
  });
});

describe("style block warning", () => {
  it("warns on <style> blocks with content", async () => {
    const result = await compile(
      '<text>Hello</text><style>.foo { color: red; }</style>',
      "Test.svelte",
    );
    expect(result.warnings.some((w) => w.code === "UNSUPPORTED_STYLE_BLOCK")).toBe(true);
  });
});
