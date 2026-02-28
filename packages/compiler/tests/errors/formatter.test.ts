import { describe, it, expect } from "vitest";
import {
  createError,
  createWarning,
  locationFromOffset,
  formatError,
} from "../../src/errors/formatter.js";
import { ErrorCode, WarningCode } from "../../src/errors/types.js";

describe("locationFromOffset", () => {
  it("converts offset to line 1", () => {
    const loc = locationFromOffset("hello world", 6, "test.svelte");
    expect(loc.line).toBe(1);
    expect(loc.column).toBe(7);
    expect(loc.source).toBe("hello world");
    expect(loc.file).toBe("test.svelte");
  });

  it("converts offset on second line", () => {
    const loc = locationFromOffset("line1\nline2", 8, "test.svelte");
    expect(loc.line).toBe(2);
    expect(loc.column).toBe(3);
    expect(loc.source).toBe("line2");
  });

  it("handles offset at start of file", () => {
    const loc = locationFromOffset("hello", 0, "test.svelte");
    expect(loc.line).toBe(1);
    expect(loc.column).toBe(1);
  });
});

describe("createError", () => {
  it("creates an error with the correct fields", () => {
    const loc = locationFromOffset("let x = 1", 0, "test.svelte");
    const error = createError(ErrorCode.NO_ASYNC, loc);

    expect(error.code).toBe("NO_ASYNC");
    expect(error.fatal).toBe(true);
    expect(error.message).toContain("async/await");
    expect(error.hint).toBeTruthy();
    expect(error.docsUrl).toBeTruthy();
  });

  it("applies template variables", () => {
    const loc = locationFromOffset("import axios", 0, "test.svelte");
    const error = createError(ErrorCode.UNKNOWN_IMPORT, loc, {
      specifier: "axios",
    });

    expect(error.message).toContain("axios");
  });

  it("throws on unknown error code", () => {
    const loc = locationFromOffset("x", 0, "test.svelte");
    expect(() => createError("BOGUS_CODE", loc)).toThrow(
      "Unknown error code",
    );
  });
});

describe("createWarning", () => {
  it("creates a warning with template vars", () => {
    const loc = locationFromOffset("x", 0, "test.svelte");
    const warning = createWarning(WarningCode.UNSUPPORTED_CSS, loc, {
      property: "border-radius",
    });

    expect(warning.code).toBe("UNSUPPORTED_CSS");
    expect(warning.message).toContain("border-radius");
  });
});

describe("formatError", () => {
  it("produces human-readable output", () => {
    const loc = locationFromOffset("  async function load() {}", 2, "App.svelte");
    const error = createError(ErrorCode.NO_ASYNC, loc);
    const output = formatError(error);

    expect(output).toContain("error[NO_ASYNC]");
    expect(output).toContain("App.svelte");
    expect(output).toContain("hint:");
    expect(output).toContain("docs:");
  });
});
