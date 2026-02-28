import { describe, it, expect } from "vitest";
import { transformMarkup, svelteRokuPreprocess } from "../src/index.js";

describe("transformMarkup", () => {
  it("strips <web> blocks on roku platform", () => {
    const input = `<div>hello</div><web><p>web only</p></web><div>world</div>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(`<div>hello</div><div>world</div>`);
  });

  it("strips <roku> blocks on web platform", () => {
    const input = `<div>hello</div><roku><p>roku only</p></roku><div>world</div>`;
    const result = transformMarkup(input, "web");
    expect(result).toBe(`<div>hello</div><div>world</div>`);
  });

  it("unwraps <roku> blocks on roku platform (keep children)", () => {
    const input = `<roku><p>roku content</p></roku>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(`<p>roku content</p>`);
  });

  it("unwraps <web> blocks on web platform (keep children)", () => {
    const input = `<web><p>web content</p></web>`;
    const result = transformMarkup(input, "web");
    expect(result).toBe(`<p>web content</p>`);
  });

  it("handles nested same-name tags fully stripped", () => {
    const input = `<web><web>inner</web></web>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(``);
  });

  it("handles nested same-name tags when unwrapping", () => {
    const input = `<roku><roku>inner</roku></roku>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(`inner`);
  });

  it("transforms <screen> to <group data-roku-extends='Scene'>", () => {
    const input = `<screen><p>hello</p></screen>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(`<group data-roku-extends="Scene"><p>hello</p></group>`);
  });

  it("handles <screen> with attributes", () => {
    const input = `<screen class="foo"><p>hello</p></screen>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(`<group data-roku-extends="Scene" class="foo"><p>hello</p></group>`);
  });

  it("handles mixed platform blocks", () => {
    const input = `<roku><p>roku</p></roku><web><p>web</p></web><div>shared</div>`;
    const rokuResult = transformMarkup(input, "roku");
    expect(rokuResult).toBe(`<p>roku</p><div>shared</div>`);

    const webResult = transformMarkup(input, "web");
    expect(webResult).toBe(`<p>web</p><div>shared</div>`);
  });

  it("does not mangle content inside <script>", () => {
    const input = `<script>const x = "<web>not a tag</web>";</script><web><p>web</p></web>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(`<script>const x = "<web>not a tag</web>";</script>`);
  });

  it("passes through content with no custom tags", () => {
    const input = `<div><p>hello world</p></div>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(input);
  });

  it("handles self-closing <web />", () => {
    const input = `<div>before</div><web /><div>after</div>`;
    const result = transformMarkup(input, "roku");
    expect(result).toBe(`<div>before</div><div>after</div>`);
  });

  it("handles self-closing <roku />", () => {
    const input = `<div>before</div><roku /><div>after</div>`;
    const result = transformMarkup(input, "web");
    expect(result).toBe(`<div>before</div><div>after</div>`);
  });
});

describe("svelteRokuPreprocess", () => {
  it("returns a preprocessor with markup handler", () => {
    const pp = svelteRokuPreprocess({ platform: "roku" });
    expect(pp.markup).toBeTypeOf("function");

    const result = pp.markup({ content: `<web><p>gone</p></web><p>stays</p>` });
    expect(result.code).toBe(`<p>stays</p>`);
  });
});
