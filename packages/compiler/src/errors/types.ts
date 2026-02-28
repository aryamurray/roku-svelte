export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  source: string;
}

export interface CompileError {
  code: string;
  message: string;
  hint: string;
  docsUrl: string;
  fatal: boolean;
  loc: SourceLocation;
}

export interface CompileWarning {
  code: string;
  message: string;
  loc: SourceLocation;
}

export const ErrorCode = {
  PARSE_ERROR: "PARSE_ERROR",
  NO_ASYNC: "NO_ASYNC",
  NO_FETCH: "NO_FETCH",
  NO_TIMERS: "NO_TIMERS",
  NO_DOM: "NO_DOM",
  NO_AWAIT_BLOCK: "NO_AWAIT_BLOCK",
  NO_GESTURES: "NO_GESTURES",
  UNKNOWN_IMPORT: "UNKNOWN_IMPORT",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const WarningCode = {
  UNSUPPORTED_CSS: "UNSUPPORTED_CSS",
  UNSUPPORTED_TRANSITION: "UNSUPPORTED_TRANSITION",
  UNKNOWN_ELEMENT: "UNKNOWN_ELEMENT",
} as const;

export type WarningCodeValue = (typeof WarningCode)[keyof typeof WarningCode];
