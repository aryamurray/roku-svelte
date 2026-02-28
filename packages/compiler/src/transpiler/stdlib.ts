export type TranspileStrategy = "rename" | "function-wrap" | "inline" | "runtime-helper" | "operator" | "constant" | "special";

export interface StdlibEntry {
  strategy: TranspileStrategy;
  brs?: string;
  value?: string;
  multiLine?: boolean; // requires for-each expansion
}

// Array methods — receiver is an array variable
export const ARRAY_METHODS: Record<string, StdlibEntry> = {
  push: { strategy: "rename", brs: "Push" },
  pop: { strategy: "rename", brs: "Pop" },
  shift: { strategy: "rename", brs: "Shift" },
  unshift: { strategy: "rename", brs: "Unshift" },
  reverse: { strategy: "rename", brs: "Reverse" },
  sort: { strategy: "rename", brs: "Sort" },
  map: { strategy: "inline", multiLine: true },
  filter: { strategy: "inline", multiLine: true },
  reduce: { strategy: "inline", multiLine: true },
  find: { strategy: "inline", multiLine: true },
  findIndex: { strategy: "inline", multiLine: true },
  some: { strategy: "inline", multiLine: true },
  every: { strategy: "inline", multiLine: true },
  forEach: { strategy: "inline", multiLine: true },
  flatMap: { strategy: "inline", multiLine: true },
  includes: { strategy: "runtime-helper", brs: "SvelteRoku_arrayIncludes" },
  indexOf: { strategy: "runtime-helper", brs: "SvelteRoku_arrayIndexOf" },
  slice: { strategy: "runtime-helper", brs: "SvelteRoku_arraySlice" },
  splice: { strategy: "runtime-helper", brs: "SvelteRoku_arraySplice" },
  flat: { strategy: "runtime-helper", brs: "SvelteRoku_arrayFlat" },
  fill: { strategy: "runtime-helper", brs: "SvelteRoku_arrayFill" },
  join: { strategy: "runtime-helper", brs: "SvelteRoku_arrayJoin" },
};

// Array properties
export const ARRAY_PROPERTIES: Record<string, StdlibEntry> = {
  length: { strategy: "rename", brs: "Count()" },
};

// String methods
export const STRING_METHODS: Record<string, StdlibEntry> = {
  trim: { strategy: "rename", brs: "Trim" },
  split: { strategy: "rename", brs: "Split" },
  replace: { strategy: "rename", brs: "Replace" },
  toLowerCase: { strategy: "function-wrap", brs: "LCase" },
  toUpperCase: { strategy: "function-wrap", brs: "UCase" },
  includes: { strategy: "inline" },
  startsWith: { strategy: "inline" },
  endsWith: { strategy: "inline" },
  indexOf: { strategy: "inline" },
  charAt: { strategy: "inline" },
  charCodeAt: { strategy: "inline" },
  lastIndexOf: { strategy: "runtime-helper", brs: "SvelteRoku_strLastIndexOf" },
  slice: { strategy: "runtime-helper", brs: "SvelteRoku_strSlice" },
  substring: { strategy: "runtime-helper", brs: "SvelteRoku_strSubstring" },
  substr: { strategy: "runtime-helper", brs: "SvelteRoku_strSubstr" },
  replaceAll: { strategy: "runtime-helper", brs: "SvelteRoku_strReplaceAll" },
  trimStart: { strategy: "runtime-helper", brs: "SvelteRoku_strTrimStart" },
  trimEnd: { strategy: "runtime-helper", brs: "SvelteRoku_strTrimEnd" },
  padStart: { strategy: "runtime-helper", brs: "SvelteRoku_strPadStart" },
  padEnd: { strategy: "runtime-helper", brs: "SvelteRoku_strPadEnd" },
  repeat: { strategy: "runtime-helper", brs: "SvelteRoku_strRepeat" },
};

// String properties
export const STRING_PROPERTIES: Record<string, StdlibEntry> = {
  length: { strategy: "function-wrap", brs: "Len" },
};

// Math methods
export const MATH_METHODS: Record<string, StdlibEntry> = {
  abs: { strategy: "function-wrap", brs: "Abs" },
  sqrt: { strategy: "function-wrap", brs: "Sqr" },
  floor: { strategy: "function-wrap", brs: "Int" },
  round: { strategy: "function-wrap", brs: "Cint" },
  log: { strategy: "function-wrap", brs: "Log" },
  sin: { strategy: "function-wrap", brs: "Sin" },
  cos: { strategy: "function-wrap", brs: "Cos" },
  tan: { strategy: "function-wrap", brs: "Tan" },
  pow: { strategy: "operator", brs: "^" },
  random: { strategy: "special", brs: "Rnd(0)" },
  ceil: { strategy: "runtime-helper", brs: "SvelteRoku_mathCeil" },
  min: { strategy: "runtime-helper", brs: "SvelteRoku_mathMin" },
  max: { strategy: "runtime-helper", brs: "SvelteRoku_mathMax" },
  sign: { strategy: "runtime-helper", brs: "SvelteRoku_mathSign" },
  trunc: { strategy: "runtime-helper", brs: "SvelteRoku_mathTrunc" },
  clamp: { strategy: "runtime-helper", brs: "SvelteRoku_mathClamp" },
  log2: { strategy: "inline" },
  log10: { strategy: "inline" },
};

// Math constants
export const MATH_CONSTANTS: Record<string, string> = {
  PI: "3.14159265358979",
  E: "2.71828182845905",
};

// Object static methods
export const OBJECT_STATIC_METHODS: Record<string, StdlibEntry> = {
  keys: { strategy: "rename", brs: "Keys" },
  assign: { strategy: "special" },
  hasOwn: { strategy: "rename", brs: "DoesExist" },
  freeze: { strategy: "special" },
  values: { strategy: "runtime-helper", brs: "SvelteRoku_objectValues" },
  entries: { strategy: "runtime-helper", brs: "SvelteRoku_objectEntries" },
  fromEntries: { strategy: "runtime-helper", brs: "SvelteRoku_objectFromEntries" },
};

// Instance methods available on any object
export const OBJECT_INSTANCE_METHODS: Record<string, StdlibEntry> = {
  hasOwnProperty: { strategy: "rename" as const, brs: "DoesExist" },
};

// JSON methods
export const JSON_METHODS: Record<string, StdlibEntry> = {
  parse: { strategy: "function-wrap", brs: "ParseJSON" },
  stringify: { strategy: "function-wrap", brs: "FormatJSON" },
};

// Console methods
export const CONSOLE_METHODS: Record<string, StdlibEntry> = {
  log: { strategy: "special", brs: "print" },
  warn: { strategy: "special", brs: 'print "[WARN] " +' },
  error: { strategy: "special", brs: 'print "[ERROR] " +' },
  debug: { strategy: "special" },
};

// Static array methods
export const ARRAY_STATIC_METHODS: Record<string, StdlibEntry> = {
  from: { strategy: "runtime-helper", brs: "SvelteRoku_arrayFrom" },
  isArray: { strategy: "runtime-helper", brs: "SvelteRoku_arrayIsArray" },
};

// String static methods
export const STRING_STATIC_METHODS: Record<string, StdlibEntry> = {
  fromCharCode: { strategy: "inline" },
};

// Set of functional methods that require multi-line expansion
export const FUNCTIONAL_METHODS = new Set([
  "map", "filter", "reduce", "find", "findIndex",
  "some", "every", "forEach", "flatMap",
]);
