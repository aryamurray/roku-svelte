import { describe, it, expect, vi } from "vitest";
import { formatDiagnostic, displayDiagnostics } from "../src/utils/format.js";

describe("formatDiagnostic", () => {
  it("fatal error includes error[CODE]: message, location, source line, caret, hint", () => {
    const diag = {
      code: "PARSE_ERROR",
      message: "Unexpected token",
      hint: "Check your syntax",
      docsUrl: "",
      fatal: true,
      loc: { file: "App.svelte", line: 5, column: 3, source: "  <invalid>" },
    };
    const output = formatDiagnostic(diag);
    expect(output).toContain("error[PARSE_ERROR]: Unexpected token");
    expect(output).toContain("--> App.svelte:5:3");
    expect(output).toContain("5 | ");
    expect(output).toContain("<invalid>");
    expect(output).toContain("^");
    expect(output).toContain("hint: Check your syntax");
  });

  it("warning includes warning[CODE]: message, no hint line", () => {
    const diag = {
      code: "UNKNOWN_ELEMENT",
      message: "Unknown element <foo>",
      loc: { file: "Bar.svelte", line: 2, column: 1, source: "<foo />" },
    };
    const output = formatDiagnostic(diag);
    expect(output).toContain("warning[UNKNOWN_ELEMENT]: Unknown element <foo>");
    expect(output).not.toContain("hint:");
  });

  it("no loc → no location/source lines", () => {
    const diag = {
      code: "NO_ASYNC",
      message: "Async not supported",
      hint: "Remove async",
      docsUrl: "",
      fatal: true,
      loc: undefined as any,
    };
    const output = formatDiagnostic(diag);
    expect(output).toContain("error[NO_ASYNC]: Async not supported");
    expect(output).not.toContain("-->");
    expect(output).not.toContain("|");
  });

  it("loc without source → location line but no source/caret", () => {
    const diag = {
      code: "NO_DOM",
      message: "DOM not available",
      hint: "",
      docsUrl: "",
      fatal: true,
      loc: { file: "X.svelte", line: 10, column: 5, source: "" },
    };
    const output = formatDiagnostic(diag);
    expect(output).toContain("--> X.svelte:10:5");
    expect(output).toContain("|");
    // source is empty string so the line with source is still present but empty
  });

  it("caret positioned correctly for column > 1", () => {
    const diag = {
      code: "PARSE_ERROR",
      message: "Error",
      hint: "",
      docsUrl: "",
      fatal: true,
      loc: { file: "A.svelte", line: 1, column: 5, source: "abcdefgh" },
    };
    const output = formatDiagnostic(diag);
    const lines = output.split("\n");
    const caretLine = lines.find((l) => l.includes("^") && !l.includes("|"));
    expect(caretLine).toBeDefined();
    // Caret should be offset from the start of the source text
    const caretPos = caretLine!.indexOf("^");
    const sourceLine = lines.find((l) => l.includes("abcdefgh"))!;
    const sourceStart = sourceLine.indexOf("a");
    // caretPad uses lineNum.length + 3 + (column-1), source line starts at 1 + lineNum.length + 3
    // So offset from source start = column - 2 for single-digit line numbers
    expect(caretPos).toBeGreaterThan(sourceStart);
  });

  it("multi-digit line numbers aligned correctly", () => {
    const diag = {
      code: "PARSE_ERROR",
      message: "Error",
      hint: "",
      docsUrl: "",
      fatal: true,
      loc: { file: "A.svelte", line: 100, column: 1, source: "text" },
    };
    const output = formatDiagnostic(diag);
    expect(output).toContain(" 100 | text");
  });
});

describe("displayDiagnostics", () => {
  it("fatal errors call logger.error()", () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const diags = [
      {
        code: "PARSE_ERROR",
        message: "Bad",
        hint: "",
        docsUrl: "",
        fatal: true,
        loc: { file: "A.svelte", line: 1, column: 1, source: "" },
      },
    ];
    displayDiagnostics(diags, logger);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warnings call logger.warn()", () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const diags = [
      {
        code: "UNKNOWN_ELEMENT",
        message: "Unknown",
        loc: { file: "A.svelte", line: 1, column: 1, source: "" },
      },
    ];
    displayDiagnostics(diags, logger);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("empty array → zero calls", () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    displayDiagnostics([], logger);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
