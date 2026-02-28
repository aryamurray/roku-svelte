import type { CompileError, CompileWarning } from "@svelte-roku/compiler";

export function formatDiagnostic(diag: CompileError | CompileWarning): string {
  const lines: string[] = [];
  const prefix = "fatal" in diag && diag.fatal ? "error" : "warning";
  const code = diag.code;

  lines.push(`${prefix}[${code}]: ${diag.message}`);

  if (diag.loc) {
    lines.push(`  --> ${diag.loc.file}:${diag.loc.line}:${diag.loc.column}`);
    lines.push(`  |`);

    if (diag.loc.source) {
      const lineNum = String(diag.loc.line);
      lines.push(` ${lineNum} | ${diag.loc.source}`);
      const caretPad = " ".repeat(lineNum.length + 3 + Math.max(0, diag.loc.column - 1));
      lines.push(`${caretPad}^`);
    }
  }

  if ("hint" in diag && diag.hint) {
    lines.push(`  = hint: ${diag.hint}`);
  }

  return lines.join("\n");
}

export function displayDiagnostics(
  diagnostics: (CompileError | CompileWarning)[],
  logger: { error: (msg: string) => void; warn: (msg: string) => void },
): void {
  for (const diag of diagnostics) {
    const formatted = formatDiagnostic(diag);
    if ("fatal" in diag && diag.fatal) {
      logger.error(formatted);
    } else {
      logger.warn(formatted);
    }
  }
}
