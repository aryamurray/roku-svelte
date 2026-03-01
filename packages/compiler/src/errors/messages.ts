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
    message: "fetch() is only supported as a state initializer",
    hint: "fetch() can only be used as a state initializer in v0.4. Full async support coming in v0.5.",
    docsUrl: `${DOCS_BASE}/no-fetch`,
    fatal: true,
  },
  [ErrorCode.NO_TIMERS]: {
    message:
      "requestAnimationFrame/cancelAnimationFrame are not available on Roku",
    hint: "Roku renders at its own framerate. Use setTimeout/setInterval for timed operations instead.",
    docsUrl: `${DOCS_BASE}/no-timers`,
    fatal: true,
  },
  [ErrorCode.NO_DOM]: {
    message:
      "DOM APIs (document, HTMLElement, Element, Node) are not available on Roku",
    hint: "Roku uses SceneGraph nodes instead of DOM elements. Use <rectangle>, <text>, etc. Use `typeof document !== 'undefined'` to guard web-only code.",
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
  [ErrorCode.EACH_OUTSIDE_LIST]: {
    message: "{#each} blocks are only supported inside <list> elements",
    hint: "Wrap your {#each} block in a <list> element. {#each} compiles to a Roku MarkupList which requires a list container.",
    docsUrl: `${DOCS_BASE}/each-outside-list`,
    fatal: true,
  },
  [ErrorCode.EACH_NO_ARRAY_STATE]: {
    message: '{#each} iterable "{name}" is not a declared array state variable',
    hint: "The iterable in {#each} must be a let variable initialized with an array literal: let {name} = [...]",
    docsUrl: `${DOCS_BASE}/each-no-array-state`,
    fatal: true,
  },
  [ErrorCode.EACH_WITH_INDEX]: {
    message: "{#each} with index variable is not yet supported",
    hint: "Index variables ({#each items as item, i}) are planned for a future version. For now, use {#each items as item} without an index.",
    docsUrl: `${DOCS_BASE}/each-with-index`,
    fatal: true,
  },
  [ErrorCode.EACH_WITH_KEY]: {
    message: "{#each} with key expression is not yet supported",
    hint: "Key expressions ({#each items as item (item.id)}) are planned for a future version. For now, use {#each items as item} without a key.",
    docsUrl: `${DOCS_BASE}/each-with-key`,
    fatal: true,
  },
  [ErrorCode.EACH_NESTED]: {
    message: "Nested {#each} blocks are not supported",
    hint: "Roku MarkupList items cannot contain nested lists. Flatten your data structure or use separate components.",
    docsUrl: `${DOCS_BASE}/each-nested`,
    fatal: true,
  },
  [ErrorCode.UNSUPPORTED_ARRAY_INIT]: {
    message: 'Array state variable "{name}" must be initialized with an array of object literals with literal field values',
    hint: "Use: let {name} = [{{ title: \"A\", year: \"2024\" }}]. Only string, number, and boolean literal values are supported.",
    docsUrl: `${DOCS_BASE}/unsupported-array-init`,
    fatal: true,
  },
  [ErrorCode.EACH_OUTER_STATE_REF]: {
    message: 'Cannot access outer state variable "{name}" inside {#each}',
    hint: "Roku item components run in a separate SceneGraph context and cannot access parent component state. Only {item.field} bindings are available inside {#each} blocks. This is a Roku platform limitation, not a compiler limitation.",
    docsUrl: `${DOCS_BASE}/each-outer-state-ref`,
    fatal: true,
  },
  [ErrorCode.UNSUPPORTED_STDLIB_METHOD]: {
    message: 'Unsupported JavaScript method "{method}" has no BrightScript equivalent',
    hint: "This JavaScript standard library method cannot be transpiled to BrightScript. See docs for the list of supported methods.",
    docsUrl: `${DOCS_BASE}/unsupported-stdlib-method`,
    fatal: true,
  },
  [ErrorCode.FUNCTIONAL_IN_TEMPLATE]: {
    message: 'Functional array method "{method}" cannot be used in template expressions',
    hint: "Methods like .map(), .filter(), .reduce() require multi-line expansion and can only be used in event handlers, not in {expression} template bindings.",
    docsUrl: `${DOCS_BASE}/functional-in-template`,
    fatal: true,
  },
  [ErrorCode.NO_WORKERS]: {
    message: "Web Workers are not available on Roku",
    hint: "Roku has no thread model compatible with Web Workers. Use single-threaded patterns instead.",
    docsUrl: `${DOCS_BASE}/no-workers`,
    fatal: true,
  },
  [ErrorCode.FLEX_UNKNOWN_SIZE]: {
    message: 'Flex child has unknown {axis} in {filename}:{line}',
    hint: "Flex layout requires all children to have explicit or percentage-based sizes. Add style=\"{axis}: Npx\" or use itemSize on <list> instead.",
    docsUrl: `${DOCS_BASE}/flex-unknown-size`,
    fatal: true,
  },
  [ErrorCode.UNSUPPORTED_ASSET_FORMAT]: {
    message: "Roku does not support {extension} fonts. Convert to TTF or OTF.",
    hint: "Web font formats like WOFF/WOFF2 are not supported on Roku. Use TTF or OTF instead.",
    docsUrl: `${DOCS_BASE}/unsupported-asset-format`,
    fatal: true,
  },
  [ErrorCode.UNSUPPORTED_BIND]: {
    message: 'bind:{property} is only supported on <input> (TextEditBox)',
    hint: "Two-way binding is only supported for bind:value on <input> elements. Use one-way bindings for other elements.",
    docsUrl: `${DOCS_BASE}/unsupported-bind`,
    fatal: true,
  },
  [ErrorCode.ASYNC_AWAIT_IN_LOOP]: {
    message: "await inside loops is not supported",
    hint: "Move the await outside of the loop or use sequential async operations.",
    docsUrl: `${DOCS_BASE}/async-await-in-loop`,
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
  [WarningCode.UNSUPPORTED_CSS_HINT]: {
    message:
      'CSS property "{property}" is not supported on Roku. {hint}',
  },
  [WarningCode.UNSUPPORTED_STYLE_BLOCK]: {
    message:
      '<style> blocks are not supported on Roku. Use inline style attributes instead.',
  },
  [WarningCode.CSS_CONTEXT_MISMATCH]: {
    message:
      'CSS property "{property}" has no effect on {nodeType}. {hint}',
  },
  [WarningCode.SVG_RASTERIZE_NO_SIZE]: {
    message:
      "SVG asset has no explicit width/height. Rasterizing at 512x512.",
  },
  [WarningCode.UNSUPPORTED_ASSET_TYPE]: {
    message:
      "Media files must be streamed via URL on Roku, not bundled.",
  },
};
