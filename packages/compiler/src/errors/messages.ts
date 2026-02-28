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
  [ErrorCode.UNSUPPORTED_STATE_INIT]: {
    message:
      'State variable "{name}" must be initialized with a literal value (number, string, or boolean)',
    hint: "Complex initializers like function calls are not supported yet. Use a literal: let x = 0",
    docsUrl: `${DOCS_BASE}/unsupported-state-init`,
    fatal: true,
  },
  [ErrorCode.UNSUPPORTED_EXPRESSION]: {
    message:
      'Complex expression "{expression}" is not supported in templates',
    hint: "Only simple {identifier} bindings are supported in v0.2. Complex expressions are planned for a future version.",
    docsUrl: `${DOCS_BASE}/unsupported-expression`,
    fatal: true,
  },
  [ErrorCode.UNSUPPORTED_HANDLER_BODY]: {
    message:
      'Unsupported statement in handler "{handler}"',
    hint: "Only simple mutations are supported: x++, x--, x = literal, x = !x, x = x + literal, x = x - literal.",
    docsUrl: `${DOCS_BASE}/unsupported-handler-body`,
    fatal: true,
  },
  [ErrorCode.INLINE_HANDLER]: {
    message:
      "Inline event handlers are not supported",
    hint: "Define a named function in <script> and reference it: on:select={handlerName}",
    docsUrl: `${DOCS_BASE}/inline-handler`,
    fatal: true,
  },
  [ErrorCode.UNKNOWN_HANDLER]: {
    message:
      'Event handler "{handler}" is not defined in <script>',
    hint: "Define the function in your <script> block before referencing it in on:select.",
    docsUrl: `${DOCS_BASE}/unknown-handler`,
    fatal: true,
  },
  [ErrorCode.UNKNOWN_STATE_REF]: {
    message:
      '"{name}" is not a declared state variable',
    hint: "Only variables declared with let in <script> can be referenced in templates. Use: let {name} = initialValue",
    docsUrl: `${DOCS_BASE}/unknown-state-ref`,
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
