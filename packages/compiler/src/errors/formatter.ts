import type { CompileError, CompileWarning, SourceLocation } from "./types.js";
import { ERROR_MESSAGES, WARNING_MESSAGES } from "./messages.js";

export function createError(
  code: string,
  loc: SourceLocation,
  templateVars?: Record<string, string>,
): CompileError {
  const def = ERROR_MESSAGES[code];
  if (!def) {
    throw new Error(`Unknown error code: ${code}`);
  }

  let message = def.message;
  let hint = def.hint;
  if (templateVars) {
    for (const [key, value] of Object.entries(templateVars)) {
      message = message.replaceAll(`{${key}}`, value);
      hint = hint.replaceAll(`{${key}}`, value);
    }
  }

  return {
    code,
    message,
    hint,
    docsUrl: def.docsUrl,
    fatal: def.fatal,
    loc,
  };
}

export function createWarning(
  code: string,
  loc: SourceLocation,
  templateVars?: Record<string, string>,
): CompileWarning {
  const def = WARNING_MESSAGES[code];
  if (!def) {
    throw new Error(`Unknown warning code: ${code}`);
  }

  let message = def.message;
  if (templateVars) {
    for (const [key, value] of Object.entries(templateVars)) {
      message = message.replaceAll(`{${key}}`, value);
    }
  }

  return { code, message, loc };
}

export function locationFromOffset(
  source: string,
  offset: number,
  filename: string,
): SourceLocation {
  const lines = source.split("\n");
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineLength = (lines[i]?.length ?? 0) + 1;
    if (currentOffset + lineLength > offset) {
      return {
        file: filename,
        line: i + 1,
        column: offset - currentOffset + 1,
        source: lines[i] ?? "",
      };
    }
    currentOffset += lineLength;
  }

  return {
    file: filename,
    line: lines.length,
    column: 1,
    source: lines[lines.length - 1] ?? "",
  };
}

export function formatError(error: CompileError): string {
  const lines: string[] = [];
  lines.push(`error[${error.code}]: ${error.message}`);
  lines.push(`  --> ${error.loc.file}:${error.loc.line}:${error.loc.column}`);
  lines.push("  |");
  lines.push(
    `${String(error.loc.line).padStart(3)} | ${error.loc.source}`,
  );
  lines.push(`  |${" ".repeat(error.loc.column)}^`);
  lines.push(`  = hint: ${error.hint}`);
  lines.push(`  = docs: ${error.docsUrl}`);
  return lines.join("\n");
}
