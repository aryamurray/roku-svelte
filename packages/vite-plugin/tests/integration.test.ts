import { describe, it, expect } from "vitest";
import { transformMarkup } from "@svelte-roku/preprocessor";
import { compile } from "@svelte-roku/compiler";

describe("preprocessor → compiler integration", () => {
  it("svelte with <roku>/<web> blocks: preprocessed then compiled removes web content", () => {
    const source = `<script>
  let title = "Hello";
</script>

<screen>
  <roku>
    <label text={title} />
  </roku>
  <web>
    <h1>{title}</h1>
  </web>
</screen>`;

    const preprocessed = transformMarkup(source, "roku");
    expect(preprocessed).not.toContain("<web>");
    expect(preprocessed).not.toContain("<h1>");

    const result = compile(preprocessed, "TestComponent", { isEntry: false });
    expect(result.errors).toHaveLength(0);
    expect(result.xml).not.toContain("<h1>");
    expect(result.xml).not.toContain("<web>");
  });

  it("entry component gets extends='Scene'", () => {
    const source = `<script>
  let msg = "hi";
</script>

<group data-roku-extends="Scene">
  <label text={msg} />
</group>`;

    const result = compile(source, "HomeScreen", { isEntry: true });
    expect(result.errors).toHaveLength(0);
    expect(result.xml).toContain('extends="Scene"');
  });

  it("non-entry component gets extends='Group'", () => {
    const source = `<script>
  let msg = "hi";
</script>

<label text={msg} />`;

    const result = compile(source, "Card", { isEntry: false });
    expect(result.errors).toHaveLength(0);
    expect(result.xml).toContain('extends="Group"');
  });
});
