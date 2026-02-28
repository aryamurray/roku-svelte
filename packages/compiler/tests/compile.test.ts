import { describe, it, expect } from "vitest";
import { compile, emitManifest } from "../src/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_DIR = path.join(__dirname, "fixtures", "valid");
const INVALID_DIR = path.join(__dirname, "fixtures", "invalid");

describe("compile - valid fixtures", () => {
  it("compiles static-text", () => {
    const source = fs.readFileSync(
      path.join(VALID_DIR, "static-text.svelte"),
      "utf-8",
    );
    const result = compile(source, "static-text.svelte");

    expect(result.errors).toEqual([]);
    // Static props in XML
    expect(result.xml).toContain('<component name="static-text"');
    expect(result.xml).toContain('extends="Group"');
    expect(result.xml).toContain("Label");
    expect(result.xml).toContain('text="Hello Roku"');
    // BrightScript has empty init (all props are static)
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

    // XML has the properties
    expect(result.xml).toContain('width="100"');
    expect(result.xml).toContain('height="50"');
    expect(result.xml).toContain('color="0xff0000ff"');

    // BrightScript does NOT duplicate them
    expect(result.brightscript).not.toContain("findNode");
    expect(result.brightscript).not.toContain("width");
    expect(result.brightscript).not.toContain("height");
    expect(result.brightscript).not.toContain("color");
  });
});

describe("compile - invalid fixtures", () => {
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
