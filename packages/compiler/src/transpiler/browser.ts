export type BrowserTranspileStrategy = "polyfill" | "inline" | "constant";

export interface BrowserAPIEntry {
  strategy: BrowserTranspileStrategy;
  brs: string;
  polyfill?: string;
}

// Timer global function calls
export const TIMER_FUNCTIONS: Record<string, BrowserAPIEntry> = {
  setTimeout: { strategy: "polyfill", brs: "SvelteRoku_setTimeout", polyfill: "Timers" },
  setInterval: { strategy: "polyfill", brs: "SvelteRoku_setInterval", polyfill: "Timers" },
  clearTimeout: { strategy: "polyfill", brs: "SvelteRoku_clearTimeout", polyfill: "Timers" },
  clearInterval: { strategy: "polyfill", brs: "SvelteRoku_clearInterval", polyfill: "Timers" },
  queueMicrotask: { strategy: "polyfill", brs: "SvelteRoku_queueMicrotask", polyfill: "Timers" },
};

// Base64 global functions
export const BASE64_FUNCTIONS: Record<string, BrowserAPIEntry> = {
  btoa: { strategy: "polyfill", brs: "SvelteRoku_btoa", polyfill: "Base64" },
  atob: { strategy: "polyfill", brs: "SvelteRoku_atob", polyfill: "Base64" },
};

// Constructor mappings for NewExpression
export interface ConstructorEntry {
  brs: string;
  polyfill?: string;
  arityVariants?: Record<number, string>; // Different BRS functions per arg count
}

export const CONSTRUCTOR_MAP: Record<string, ConstructorEntry> = {
  Date: {
    brs: "SvelteRoku_dateNow",
    polyfill: "DatePolyfill",
    arityVariants: {
      0: "SvelteRoku_dateNow",
      1: "SvelteRoku_dateCreate", // Dispatches on arg type (number vs string)
    },
  },
  URL: {
    brs: "SvelteRoku_urlParse",
    polyfill: "URLPolyfill",
  },
  URLSearchParams: {
    brs: "SvelteRoku_urlSearchParamsCreate",
    polyfill: "URLPolyfill",
  },
  EventTarget: {
    brs: "SvelteRoku_eventTargetCreate",
    polyfill: "EventTarget",
  },
  AbortController: {
    brs: "SvelteRoku_abortControllerCreate",
    polyfill: "EventTarget",
  },
  Headers: {
    brs: "SvelteRoku_headersCreate",
    polyfill: "FetchAPI",
  },
  Request: {
    brs: "SvelteRoku_requestCreate",
    polyfill: "FetchAPI",
  },
  Response: {
    brs: "SvelteRoku_responseCreate",
    polyfill: "FetchAPI",
  },
  Map: {
    brs: "SvelteRoku_mapCreate",
    polyfill: "Collections",
  },
  Set: {
    brs: "SvelteRoku_setCreate",
    polyfill: "Collections",
  },
};

// Static method calls on Date
export const DATE_STATIC_METHODS: Record<string, BrowserAPIEntry> = {
  now: { strategy: "polyfill", brs: "SvelteRoku_dateNowMs", polyfill: "DatePolyfill" },
};

// Instance methods on Date wrappers
export const DATE_INSTANCE_METHODS: Record<string, BrowserAPIEntry> = {
  getTime: { strategy: "polyfill", brs: "SvelteRoku_dateGetTime", polyfill: "DatePolyfill" },
  getFullYear: { strategy: "polyfill", brs: "SvelteRoku_dateGetYear", polyfill: "DatePolyfill" },
  getMonth: { strategy: "polyfill", brs: "SvelteRoku_dateGetMonth", polyfill: "DatePolyfill" },
  getDate: { strategy: "polyfill", brs: "SvelteRoku_dateGetDay", polyfill: "DatePolyfill" },
  getHours: { strategy: "polyfill", brs: "SvelteRoku_dateGetHours", polyfill: "DatePolyfill" },
  getMinutes: { strategy: "polyfill", brs: "SvelteRoku_dateGetMinutes", polyfill: "DatePolyfill" },
  getSeconds: { strategy: "polyfill", brs: "SvelteRoku_dateGetSeconds", polyfill: "DatePolyfill" },
  toISOString: { strategy: "polyfill", brs: "SvelteRoku_dateToISO", polyfill: "DatePolyfill" },
  toLocaleDateString: { strategy: "polyfill", brs: "SvelteRoku_dateToLocale", polyfill: "DatePolyfill" },
  toJSON: { strategy: "polyfill", brs: "SvelteRoku_dateToISO", polyfill: "DatePolyfill" },
};

// URL instance methods
export const URL_INSTANCE_METHODS: Record<string, BrowserAPIEntry> = {
  toString: { strategy: "polyfill" as const, brs: "SvelteRoku_urlToString", polyfill: "URLPolyfill" },
};

// URLSearchParams instance methods
export const URL_SEARCH_PARAMS_METHODS: Record<string, BrowserAPIEntry> = {
  get: { strategy: "polyfill", brs: "SvelteRoku_urlSearchParamsGet", polyfill: "URLPolyfill" },
  set: { strategy: "polyfill", brs: "SvelteRoku_urlSearchParamsSet", polyfill: "URLPolyfill" },
  has: { strategy: "polyfill", brs: "SvelteRoku_urlSearchParamsHas", polyfill: "URLPolyfill" },
  delete: { strategy: "polyfill", brs: "SvelteRoku_urlSearchParamsDelete", polyfill: "URLPolyfill" },
  toString: { strategy: "polyfill" as const, brs: "SvelteRoku_urlSearchParamsToString", polyfill: "URLPolyfill" },
};

// localStorage/sessionStorage method calls
export const STORAGE_METHODS: Record<string, BrowserAPIEntry> = {
  getItem: { strategy: "polyfill", brs: "SvelteRoku_storageGet", polyfill: "Storage" },
  setItem: { strategy: "polyfill", brs: "SvelteRoku_storageSet", polyfill: "Storage" },
  removeItem: { strategy: "polyfill", brs: "SvelteRoku_storageRemove", polyfill: "Storage" },
  clear: { strategy: "polyfill", brs: "SvelteRoku_storageClear", polyfill: "Storage" },
};

// EventTarget instance methods
export const EVENT_TARGET_METHODS: Record<string, BrowserAPIEntry> = {
  addEventListener: { strategy: "polyfill", brs: "SvelteRoku_etAddListener", polyfill: "EventTarget" },
  removeEventListener: { strategy: "polyfill", brs: "SvelteRoku_etRemoveListener", polyfill: "EventTarget" },
  dispatchEvent: { strategy: "polyfill", brs: "SvelteRoku_etDispatch", polyfill: "EventTarget" },
};

// AbortController instance methods
export const ABORT_CONTROLLER_METHODS: Record<string, BrowserAPIEntry> = {
  abort: { strategy: "polyfill", brs: "SvelteRoku_abortControllerAbort", polyfill: "EventTarget" },
};

// Headers instance methods
export const HEADERS_METHODS: Record<string, BrowserAPIEntry> = {
  get: { strategy: "polyfill", brs: "SvelteRoku_headersGet", polyfill: "FetchAPI" },
  set: { strategy: "polyfill", brs: "SvelteRoku_headersSet", polyfill: "FetchAPI" },
  has: { strategy: "polyfill", brs: "SvelteRoku_headersHas", polyfill: "FetchAPI" },
  delete: { strategy: "polyfill", brs: "SvelteRoku_headersDelete", polyfill: "FetchAPI" },
};

// Map instance methods
export const MAP_METHODS: Record<string, BrowserAPIEntry> = {
  get: { strategy: "polyfill", brs: "SvelteRoku_mapGet", polyfill: "Collections" },
  set: { strategy: "polyfill", brs: "SvelteRoku_mapSet", polyfill: "Collections" },
  has: { strategy: "polyfill", brs: "SvelteRoku_mapHas", polyfill: "Collections" },
  delete: { strategy: "polyfill", brs: "SvelteRoku_mapDelete", polyfill: "Collections" },
  clear: { strategy: "polyfill", brs: "SvelteRoku_mapClear", polyfill: "Collections" },
  keys: { strategy: "polyfill", brs: "SvelteRoku_mapKeys", polyfill: "Collections" },
  values: { strategy: "polyfill", brs: "SvelteRoku_mapValues", polyfill: "Collections" },
  entries: { strategy: "polyfill", brs: "SvelteRoku_mapEntries", polyfill: "Collections" },
};

// Map .size property
export const MAP_PROPERTIES: Record<string, BrowserAPIEntry> = {
  size: { strategy: "polyfill", brs: "SvelteRoku_mapSize", polyfill: "Collections" },
};

// Set instance methods
export const SET_METHODS: Record<string, BrowserAPIEntry> = {
  add: { strategy: "polyfill", brs: "SvelteRoku_setAdd", polyfill: "Collections" },
  has: { strategy: "polyfill", brs: "SvelteRoku_setHas", polyfill: "Collections" },
  delete: { strategy: "polyfill", brs: "SvelteRoku_setDelete", polyfill: "Collections" },
  clear: { strategy: "polyfill", brs: "SvelteRoku_setClear", polyfill: "Collections" },
  keys: { strategy: "polyfill", brs: "SvelteRoku_setValues", polyfill: "Collections" },
  values: { strategy: "polyfill", brs: "SvelteRoku_setValues", polyfill: "Collections" },
  entries: { strategy: "polyfill", brs: "SvelteRoku_setEntries", polyfill: "Collections" },
};

// Set .size property
export const SET_PROPERTIES: Record<string, BrowserAPIEntry> = {
  size: { strategy: "polyfill", brs: "SvelteRoku_setSize", polyfill: "Collections" },
};

// navigator.* property mappings (direct inline)
export const NAVIGATOR_PROPERTIES: Record<string, { code: string }> = {
  userAgent: { code: 'CreateObject("roDeviceInfo").GetModel()' },
  language: { code: 'CreateObject("roDeviceInfo").GetCurrentLocale()' },
  onLine: { code: "true" },
};

// window.* property mappings
export const WINDOW_PROPERTIES: Record<string, { code: string } | null> = {
  innerWidth: { code: 'CreateObject("roDeviceInfo").GetDisplaySize().w' },
  innerHeight: { code: 'CreateObject("roDeviceInfo").GetDisplaySize().h' },
  devicePixelRatio: { code: "1" },
  location: null, // Nested access — handled separately
};

// window.location.* property mappings
export const WINDOW_LOCATION_PROPERTIES: Record<string, { code: string }> = {
  href: { code: '""' },
  hostname: { code: '""' },
  pathname: { code: '""' },
  origin: { code: '""' },
  protocol: { code: '""' },
  host: { code: '""' },
  port: { code: '""' },
  search: { code: '""' },
  hash: { code: '""' },
};

// typeof constant-folding rules
export const TYPEOF_CONSTANTS: Record<string, string> = {
  window: '"object"',
  document: '"undefined"',
  navigator: '"object"',
  localStorage: '"object"',
  sessionStorage: '"object"',
  Worker: '"undefined"',
  ServiceWorker: '"undefined"',
  SharedWorker: '"undefined"',
  globalThis: '"object"',
  setTimeout: '"function"',
  setInterval: '"function"',
  clearTimeout: '"function"',
  clearInterval: '"function"',
  fetch: '"function"',
  undefined: '"undefined"',
};

// Polyfill script URI mappings
export const POLYFILL_SCRIPTS: Record<string, string> = {
  Timers: "pkg:/source/runtime/Timers.brs",
  Storage: "pkg:/source/runtime/Storage.brs",
  DatePolyfill: "pkg:/source/runtime/DatePolyfill.brs",
  URLPolyfill: "pkg:/source/runtime/URLPolyfill.brs",
  Base64: "pkg:/source/runtime/Base64.brs",
  EventTarget: "pkg:/source/runtime/EventTarget.brs",
  FetchAPI: "pkg:/source/runtime/FetchAPI.brs",
  Collections: "pkg:/source/runtime/Collections.brs",
};
