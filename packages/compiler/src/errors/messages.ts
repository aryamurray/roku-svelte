import { ErrorCode, WarningCode } from "./types.js";

interface ErrorDefinition {
  message: string;
  hint: string;
  docsUrl: string;
  fatal: boolean;
}

interface WarningDefinition {
  message: string;
}

const DOCS_BASE = "https://svelte-roku.dev/errors";

export const ERROR_MESSAGES: Record<string, ErrorDefinition> = {
  [ErrorCode.PARSE_ERROR]: {
    message: "Failed to parse Svelte source",
    hint: "Check your Svelte syntax.",
    docsUrl: "https://svelte.dev/docs",
    fatal: true,
  },
  [ErrorCode.NO_ASYNC]: {
    message: "async/await is not supported in svelte-roku v0.1",
    hint: "Async support is planned for v0.4. For now, use synchronous data patterns.",
    docsUrl: `${DOCS_BASE}/no-async`,
    fatal: true,
  },
  [ErrorCode.NO_FETCH]: {
    message: "fetch() is not available on Roku devices",
    hint: "Network requests will use roUrlTransfer in v0.4. For now, use static data.",
    docsUrl: `${DOCS_BASE}/no-fetch`,
    fatal: true,
  },
  [ErrorCode.NO_TIMERS]: {
    message:
      "setTimeout/setInterval are not available on Roku devices",
    hint: "Timer support via roTimeSpan is planned for a future version.",
    docsUrl: `${DOCS_BASE}/no-timers`,
    fatal: true,
  },
  [ErrorCode.NO_DOM]: {
    message:
      "DOM APIs (document, window, navigator) are not available on Roku",
    hint: "Roku uses SceneGraph nodes instead of DOM elements. Use <rectangle>, <text>, etc.",
    docsUrl: `${DOCS_BASE}/no-dom`,
    fatal: true,
  },
  [ErrorCode.NO_AWAIT_BLOCK]: {
    message: "{#await} blocks are not supported in svelte-roku v0.1",
    hint: "Async rendering is planned for v0.4.",
    docsUrl: `${DOCS_BASE}/no-await-block`,
    fatal: true,
  },
  [ErrorCode.NO_GESTURES]: {
    message:
      "Touch/gesture events are not available on Roku (remote-only input)",
    hint: "Use on:select for D-pad OK button presses. Focus management is available in v0.2.",
    docsUrl: `${DOCS_BASE}/no-gestures`,
    fatal: true,
  },
  [ErrorCode.UNKNOWN_IMPORT]: {
    message:
      'Unknown import: "{specifier}" is not in the svelte-roku allowlist',
    hint: "Only allowed packages can be imported. See docs for the allowlist, or open an issue to request support.",
    docsUrl: `${DOCS_BASE}/unknown-import`,
    fatal: true,
  },
};

export const WARNING_MESSAGES: Record<string, WarningDefinition> = {
  [WarningCode.UNSUPPORTED_CSS]: {
    message:
      'CSS property "{property}" is not supported on Roku and will be ignored',
  },
  [WarningCode.UNSUPPORTED_TRANSITION]: {
    message:
      "Svelte transitions are not supported on Roku and will be ignored",
  },
  [WarningCode.UNKNOWN_ELEMENT]: {
    message:
      'Element <{element}> is not a recognized svelte-roku element and will be ignored',
  },
};
