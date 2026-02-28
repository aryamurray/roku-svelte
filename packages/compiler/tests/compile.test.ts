import { describe, it, expect } from "vitest";
import { compile, emitManifest } from "../src/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_DIR = path.join(__dirname, "fixtures", "valid");
const INVALID_DIR = path.join(__dirname, "fixtures", "invalid");

// === v0.1 regression tests ===

describe("compile - valid fixtures (v0.1)", () => {
  it("compiles static-text", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "static-text.svelte"),
      "utf-8",
    );
    const result = compile(source, "static-text.svelte");

    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('<component name="static-text"');
    expect(result.xml).toContain('extends="Group"');
    expect(result.xml).toContain("Label");
    expect(result.xml).toContain('text="Hello Roku"');
    expect(result.brightscript).toContain("function init()");
    expect(result.brightscript).toContain("end function");
    expect(result.brightscript).not.toContain("findNode");
  });

  it("compiles nested-elements", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "nested-elements.svelte"),
      "utf-8",
    );
    const result = compile(source, "nested-elements.svelte");

    expect(result.errors).toEqual([]);
    expect(result.xml).toContain("Group");
    expect(result.xml).toContain("Rectangle");
    expect(result.xml).toContain("Label");
    expect(result.xml).toContain('width="1920"');
    expect(result.xml).toContain('height="1080"');
    expect(result.brightscript).toContain("function init()");
  });

  it("compiles image-poster", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "image-poster.svelte"),
      "utf-8",
    );
    const result = compile(source, "image-poster.svelte");

    expect(result.errors).toEqual([]);
    expect(result.xml).toContain("Poster");
    expect(result.xml).toContain('uri="pkg:/images/hero.jpg"');
    expect(result.xml).toContain('width="500"');
    expect(result.xml).toContain('height="281"');
  });

  it("compiles styled-text", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "styled-text.svelte"),
      "utf-8",
    );
    const result = compile(source, "styled-text.svelte");

    expect(result.errors).toEqual([]);
    expect(result.xml).toContain("Label");
    expect(result.xml).toContain('color="0xff0000ff"');
    expect(result.xml).toContain('fontSize="48"');
    expect(result.xml).toContain('text="Big Red Title"');
  });
});

describe("compile - isEntry option", () => {
  it("defaults to extends Group", () => {
    const result = compile("<text>Hello</text>", "App.svelte");
    expect(result.xml).toContain('extends="Group"');
  });

  it("extends Scene when isEntry is true", () => {
    const result = compile("<text>Hello</text>", "App.svelte", {
      isEntry: true,
    });
    expect(result.xml).toContain('extends="Scene"');
  });

  it("extends Group when isEntry is false", () => {
    const result = compile("<text>Hello</text>", "App.svelte", {
      isEntry: false,
    });
    expect(result.xml).toContain('extends="Group"');
  });
});

describe("compile - static/dynamic prop split", () => {
  it("puts static props in XML only, not BrightScript", () => {
    const result = compile(
      '<rectangle width="100" height="50" color="#ff0000" />',
      "Test.svelte",
    );

    expect(result.xml).toContain('width="100"');
    expect(result.xml).toContain('height="50"');
    expect(result.xml).toContain('color="0xff0000ff"');

    expect(result.brightscript).not.toContain("findNode");
    expect(result.brightscript).not.toContain("width");
    expect(result.brightscript).not.toContain("height");
    expect(result.brightscript).not.toContain("color");
  });
});

describe("compile - invalid fixtures (v0.1)", () => {
  it("rejects async-function with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "async-function.svelte"),
      "utf-8",
    );
    const result = compile(source, "async-function.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.fatal)).toBe(true);
    expect(result.errors.some((e) => e.code === "NO_ASYNC")).toBe(true);
    expect(result.xml).toBe("");
    expect(result.brightscript).toBe("");
  });

  it("rejects fetch-usage with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "fetch-usage.svelte"),
      "utf-8",
    );
    const result = compile(source, "fetch-usage.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "NO_FETCH")).toBe(true);
    expect(result.xml).toBe("");
  });

  it("rejects timer-usage with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "timer-usage.svelte"),
      "utf-8",
    );
    const result = compile(source, "timer-usage.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "NO_TIMERS")).toBe(true);
    expect(result.xml).toBe("");
  });

  it("rejects dom-access with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "dom-access.svelte"),
      "utf-8",
    );
    const result = compile(source, "dom-access.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "NO_DOM")).toBe(true);
    expect(result.xml).toBe("");
  });

  it("rejects unknown-import with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "unknown-import.svelte"),
      "utf-8",
    );
    const result = compile(source, "unknown-import.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "UNKNOWN_IMPORT")).toBe(true);
    expect(result.errors[0]?.message).toContain("axios");
    expect(result.xml).toBe("");
  });
});

// === v0.2 integration tests ===

describe("compile - v0.2 valid fixtures", () => {
  it("compiles counter with state, events, binding", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "counter.svelte"),
      "utf-8",
    );
    const result = compile(source, "counter.svelte");

    expect(result.errors).toEqual([]);

    // XML
    expect(result.xml).toContain("Label");
    expect(result.xml).toContain('focusable="true"');
    expect(result.xml).not.toContain("text="); // text is dynamic

    // BrightScript
    expect(result.brightscript).toContain("v0.2");
    expect(result.brightscript).toContain("m.state = { count: 0, dirty: {} }");
    expect(result.brightscript).toContain("m_update()");
    expect(result.brightscript).toContain("function m_update()");
    expect(result.brightscript).toContain("m.state.dirty.count");
    expect(result.brightscript).toContain("function onKeyEvent");
    expect(result.brightscript).toContain("function increment()");
    expect(result.brightscript).toContain(
      "m.state.count = m.state.count + 1",
    );
  });

  it("compiles toggle with boolean state and visibility", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "toggle.svelte"),
      "utf-8",
    );
    const result = compile(source, "toggle.svelte");

    expect(result.errors).toEqual([]);
    expect(result.xml).toContain("Rectangle");
    expect(result.xml).toContain('focusable="true"');
    expect(result.brightscript).toContain("m.state = { active: true, dirty: {} }");
    expect(result.brightscript).toContain("m.state.active = not m.state.active");
    expect(result.brightscript).toContain("function toggle()");
  });

  it("compiles mixed-text with interpolation", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "mixed-text.svelte"),
      "utf-8",
    );
    const result = compile(source, "mixed-text.svelte");

    expect(result.errors).toEqual([]);
    expect(result.brightscript).toContain("Str(m.state.count).Trim()");
    // Should contain string concatenation
    expect(result.brightscript).toContain("+");
  });

  it("compiles autofocus with setFocus", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "autofocus.svelte"),
      "utf-8",
    );
    const result = compile(source, "autofocus.svelte");

    expect(result.errors).toEqual([]);
    expect(result.xml).toContain('focusable="true"');
    expect(result.brightscript).toContain("setFocus(true)");
  });

  it("compiles multi-state with multiple variables", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "multi-state.svelte"),
      "utf-8",
    );
    const result = compile(source, "multi-state.svelte");

    expect(result.errors).toEqual([]);
    expect(result.brightscript).toContain("count: 0");
    expect(result.brightscript).toContain('"hello"');
    expect(result.brightscript).toContain("visible: true");
  });
});

describe("compile - v0.2 invalid fixtures", () => {
  it("rejects complex-expression with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "complex-expression.svelte"),
      "utf-8",
    );
    const result = compile(source, "complex-expression.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some((e) => e.code === "UNSUPPORTED_EXPRESSION"),
    ).toBe(true);
    expect(result.xml).toBe("");
  });

  it("rejects inline-handler with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "inline-handler.svelte"),
      "utf-8",
    );
    const result = compile(source, "inline-handler.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "INLINE_HANDLER")).toBe(true);
    expect(result.xml).toBe("");
  });

  it("rejects complex-state-init with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "complex-state-init.svelte"),
      "utf-8",
    );
    const result = compile(source, "complex-state-init.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some((e) => e.code === "UNSUPPORTED_STATE_INIT"),
    ).toBe(true);
    expect(result.xml).toBe("");
  });

  it("rejects unknown-handler with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "unknown-handler.svelte"),
      "utf-8",
    );
    const result = compile(source, "unknown-handler.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "UNKNOWN_HANDLER")).toBe(true);
    expect(result.xml).toBe("");
  });

  it("rejects unsupported-handler body with fatal error", () => {
    const source = fs.readFileSync(
      path.join(INVALID_DIR, "unsupported-handler.svelte"),
      "utf-8",
    );
    const result = compile(source, "unsupported-handler.svelte");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some((e) => e.code === "UNSUPPORTED_HANDLER_BODY"),
    ).toBe(true);
    expect(result.xml).toBe("");
  });
});

describe("compile - v0.2 edge cases", () => {
  it("compiles component with state but no handlers or events", () => {
    const source = '<script>let count = 0;</script><text>{count}</text>';
    const result = compile(source, "StateOnly.svelte");

    expect(result.errors).toEqual([]);
    expect(result.brightscript).toContain("m.state = { count: 0, dirty: {} }");
    expect(result.brightscript).toContain("function m_update()");
    expect(result.brightscript).not.toContain("onKeyEvent");
  });

  it("compiles string state bound to text", () => {
    const source = '<script>let name = "world";</script><text>{name}</text>';
    const result = compile(source, "StringBind.svelte");

    expect(result.errors).toEqual([]);
    expect(result.brightscript).toContain('"world"');
    expect(result.brightscript).toContain("m.state.name");
  });

  it("compiles negative number state init", () => {
    const source = '<script>let count = -5;</script><text>{count}</text>';
    const result = compile(source, "Negative.svelte");

    expect(result.errors).toEqual([]);
    expect(result.brightscript).toContain("count: -5");
  });

  it("compiles component with multiple handlers", () => {
    const source = `<script>
  let count = 0;
  function increment() { count++; }
  function decrement() { count--; }
</script>
<text on:select={increment} focusable>{count}</text>
<text on:select={decrement} focusable>-</text>`;
    const result = compile(source, "MultiHandler.svelte");

    expect(result.errors).toEqual([]);
    expect(result.brightscript).toContain("function increment()");
    expect(result.brightscript).toContain("function decrement()");
    expect(result.brightscript).toContain("m.state.count + 1");
    expect(result.brightscript).toContain("m.state.count - 1");
  });

  it("compiles boolean false state", () => {
    const source =
      '<script>let hidden = false; function toggle() { hidden = !hidden; }</script><rectangle visible={hidden} on:select={toggle} focusable />';
    const result = compile(source, "FalseState.svelte");

    expect(result.errors).toEqual([]);
    expect(result.brightscript).toContain("hidden: false");
  });

  it("v0.1 static-only produces v0.1 output (no state)", () => {
    const result = compile("<text>Hello</text>", "Static.svelte");

    expect(result.errors).toEqual([]);
    expect(result.brightscript).toContain("v0.1");
    expect(result.brightscript).not.toContain("m.state");
    expect(result.brightscript).not.toContain("m_update");
  });
});

describe("emitManifest", () => {
  it("generates default manifest", () => {
    const manifest = emitManifest();
    expect(manifest).toContain("title=Dev Channel");
    expect(manifest).toContain("major_version=1");
    expect(manifest).toContain("minor_version=0");
    expect(manifest).toContain("build_version=0");
    expect(manifest).toContain("ui_resolutions=fhd");
  });

  it("accepts custom options", () => {
    const manifest = emitManifest({
      title: "My Channel",
      majorVersion: 2,
      minorVersion: 1,
      buildVersion: 42,
      uiResolutions: "fhd,hd",
    });
    expect(manifest).toContain("title=My Channel");
    expect(manifest).toContain("major_version=2");
    expect(manifest).toContain("minor_version=1");
    expect(manifest).toContain("build_version=42");
    expect(manifest).toContain("ui_resolutions=fhd,hd");
  });
});
