import { describe, it, expect } from "vitest";
import { compile } from "../../src/index.js";

describe("flex layout integration", () => {
  it("compiles flex row layout with computed positions", async () => {
    const source = `<group style="display: flex; flex-direction: row; width: 1920px; height: 1080px">
  <rectangle style="width: 400px; height: 1080px" />
  <rectangle style="width: 400px; height: 1080px" />
</group>`;

    const result = await compile(source, "FlexRow.svelte");
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain("Group");
    expect(result.xml).toContain("Rectangle");
    // Second child should have translation
    expect(result.xml).toContain('translation="[400, 0]"');
  });

  it("compiles flex column layout", async () => {
    const source = `<group style="display: flex; flex-direction: column; width: 1920px; height: 1080px">
  <rectangle style="width: 1920px; height: 200px" />
  <rectangle style="width: 1920px; height: 300px" />
</group>`;

    const result = await compile(source, "FlexCol.svelte");
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('translation="[0, 200]"');
  });

  it("compiles flex-grow proportional layout", async () => {
    const source = `<group style="display: flex; flex-direction: row; width: 1920px; height: 1080px">
  <group style="width: 400px; height: 1080px"></group>
  <group style="flex: 1; height: 1080px"></group>
</group>`;

    const result = await compile(source, "FlexGrow.svelte");
    expect(result.errors).toEqual([]);
    // Second child should get width 1520 and translation [400, 0]
    expect(result.xml).toContain('width="1520"');
    expect(result.xml).toContain('translation="[400, 0]"');
  });

  it("compiles flex with gap", async () => {
    const source = `<group style="display: flex; flex-direction: row; gap: 20px; width: 1000px; height: 500px">
  <rectangle style="width: 200px; height: 100px" />
  <rectangle style="width: 200px; height: 100px" />
</group>`;

    const result = await compile(source, "FlexGap.svelte");
    expect(result.errors).toEqual([]);
    // Second child at 200 + 20 = 220
    expect(result.xml).toContain('translation="[220, 0]"');
  });

  it("compiles flex with justify-content: center", async () => {
    const source = `<group style="display: flex; justify-content: center; width: 1000px; height: 500px">
  <rectangle style="width: 200px; height: 100px" />
</group>`;

    const result = await compile(source, "FlexCenter.svelte");
    expect(result.errors).toEqual([]);
    // Centered: (1000 - 200) / 2 = 400
    expect(result.xml).toContain('translation="[400, 0]"');
  });

  it("compiles flex with align-items: center", async () => {
    const source = `<group style="display: flex; align-items: center; width: 1000px; height: 500px">
  <rectangle style="width: 200px; height: 100px" />
</group>`;

    const result = await compile(source, "FlexAlignCenter.svelte");
    expect(result.errors).toEqual([]);
    // Centered vertically: (500 - 100) / 2 = 200
    expect(result.xml).toContain('translation="[0, 200]"');
  });

  it("compiles non-flex components without loading yoga", async () => {
    const result = await compile('<text>Hello</text>', "NoFlex.svelte");
    expect(result.errors).toEqual([]);
    expect(result.xml).toContain("Label");
    expect(result.xml).toContain('text="Hello"');
  });

  it("compiles nested flex containers", async () => {
    const source = `<group style="display: flex; flex-direction: column; width: 1000px; height: 800px">
  <group style="display: flex; flex-direction: row; width: 1000px; height: 300px">
    <rectangle style="width: 500px; height: 300px" />
    <rectangle style="width: 500px; height: 300px" />
  </group>
  <group style="display: flex; flex-direction: row; width: 1000px; height: 500px; gap: 100px">
    <rectangle style="width: 200px; height: 500px" />
    <rectangle style="width: 200px; height: 500px" />
  </group>
</group>`;

    const result = await compile(source, "NestedFlex.svelte");
    expect(result.errors).toEqual([]);
    // Outer column: second group at y=300
    expect(result.xml).toContain('translation="[0, 300]"');
    // Inner row in second group: second rect at x=300 (200 + 100 gap)
    expect(result.xml).toContain('translation="[300, 0]"');
    // Inner row in first group: second rect at x=500
    expect(result.xml).toContain('translation="[500, 0]"');
    // No flex metadata in output
    expect(result.xml).not.toContain("flex-direction");
  });

  it("flex does not emit flexStyles in output", async () => {
    const source = `<group style="display: flex; flex-direction: row; width: 500px; height: 500px">
  <rectangle style="width: 100px; height: 100px" />
</group>`;

    const result = await compile(source, "NoFlexOutput.svelte");
    expect(result.errors).toEqual([]);
    expect(result.xml).not.toContain("flexStyles");
    expect(result.xml).not.toContain("flex-direction");
    expect(result.xml).not.toContain("display");
  });
});
