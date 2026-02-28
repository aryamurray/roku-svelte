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
  UNSUPPORTED_STATE_INIT: "UNSUPPORTED_STATE_INIT",
  UNSUPPORTED_EXPRESSION: "UNSUPPORTED_EXPRESSION",
  UNSUPPORTED_HANDLER_BODY: "UNSUPPORTED_HANDLER_BODY",
  INLINE_HANDLER: "INLINE_HANDLER",
  UNKNOWN_HANDLER: "UNKNOWN_HANDLER",
  UNKNOWN_STATE_REF: "UNKNOWN_STATE_REF",
  EACH_OUTSIDE_LIST: "EACH_OUTSIDE_LIST",
  EACH_NO_ARRAY_STATE: "EACH_NO_ARRAY_STATE",
  EACH_WITH_INDEX: "EACH_WITH_INDEX",
  EACH_WITH_KEY: "EACH_WITH_KEY",
  EACH_NESTED: "EACH_NESTED",
  UNSUPPORTED_ARRAY_INIT: "UNSUPPORTED_ARRAY_INIT",
  EACH_OUTER_STATE_REF: "EACH_OUTER_STATE_REF",
  UNSUPPORTED_STDLIB_METHOD: "UNSUPPORTED_STDLIB_METHOD",
  FUNCTIONAL_IN_TEMPLATE: "FUNCTIONAL_IN_TEMPLATE",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const WarningCode = {
  UNSUPPORTED_CSS: "UNSUPPORTED_CSS",
  UNSUPPORTED_TRANSITION: "UNSUPPORTED_TRANSITION",
  UNKNOWN_ELEMENT: "UNKNOWN_ELEMENT",
} as const;

export type WarningCodeValue = (typeof WarningCode)[keyof typeof WarningCode];
