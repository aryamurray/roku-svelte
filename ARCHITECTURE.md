Project: svelte-roku
What it is: A Svelte compiler backend that takes .svelte files and emits Roku SceneGraph XML + BrightScript. Gives Svelte developers a way to build Roku channels without learning BrightScript/SceneGraph.

Core Architecture Decision
Not a runtime transpiler. An ahead-of-time compiler (like Svelte itself, like Dart2JS). The developer writes Svelte, the compiler emits idiomatic BrightScript. No JS engine runs on device.
Pipeline:
.svelte source
  → Svelte's own parser (don't write our own)
  → Our IR (intermediate representation)
  → Layout resolver (static Flexbox at compile time where possible)
  → XML emitter (SceneGraph .xml)
  → BrightScript emitter (.brs)
  → BrightScript runtime library copied to output

Key Technical Decisions Made
1. Use Svelte's compiler API, don't fork it
typescriptimport { parse, analyze } from 'svelte/compiler'
const ast = parse(source, { filename })
const analysis = analyze(ast)
// then build our own IR from the AST
2. Two-pass layout resolution

First try static: run Yoga (Facebook's Flexbox engine, available as yoga-layout npm package compiled to WASM) at compile time. Emit hardcoded translation, width, height into XML.
If layout depends on runtime data (dynamic lists, text wrapping), flag for runtime Flexbox library (Flexbox.brs in the runtime package).
Static resolution preferred, runtime fallback for dynamic cases.

3. Async strategy — compiler errors for now, polyfill later

v0.1-v0.3: any use of async/await, Promise, fetch, setTimeout is a hard compiler error with a helpful message pointing to the roadmap
v0.4+: implement Promise.brs, MicrotaskQueue.brs, fetch polyfill using roUrlTransfer, flush microtasks every iteration of the main message loop

4. Module system

BrightScript has no imports, everything is global
Use Rollup to bundle JS first, then transpile the bundle
Runtime .brs files are just copied to output, they're always global

5. npm package handling

Maintain an explicit allowlist of known-safe packages (date-fns, lodash, zod, uuid, etc.)
Unknown packages: compiler error with link to open a GitHub issue
Known-bad packages (axios, svelte-routing, etc.): error with specific migration guidance


Element Mapping (Svelte → SceneGraph)
Svelte elementSceneGraph typeNotes<rectangle> / <view>Rectangle<text>Label<image>Postersrc → uri<scroll>ScrollingGroupvertical only v1<list>MarkupListitems → content<grid>MarkupGrid<input>TextEditBox<video>Video<spinner>BusySpinner<group>Grouplayout only

CSS Property Mapping
CSSSceneGraph fieldNotescolor (on text)colorhex stringfont-sizefontSizenumberbackground-colorcolor on Rectanglewidth / heightwidth / heightstatic or runtimeopacityopacity0.0–1.0display: nonevisible = falseall flex propsFlexbox.brs or staticborder-radius—warn + skippseudo-classes—errormedia queries—error

BrightScript Emit Pattern
Every compiled component produces two files. Here's what the emitted BrightScript looks like:
brightscript' HomeScreen.brs
function init()
  ' node refs
  m.titleLabel = m.top.findNode("title")
  m.list = m.top.findNode("list")

  ' state
  m.state = {
    selected: 0,
    items: [],
    dirty: {}
  }

  ' observers
  m.list.observeField("itemSelected", "onListSelect")

  ' onMount effects
  Store_dispatch({ type: "FETCH_CONTENT", url: "/api/content" })
  Store_subscribe("CONTENT_LOADED", "onContentLoaded")

  m_update()
end function

function m_update()
  ' targeted updates grouped by dependency
  if m.state.dirty.items or m.state.dirty.selected then
    featured = m.state.items[m.state.selected]
    if featured <> invalid then
      m.titleLabel.text = featured.title
    end if
  end if
  m.state.dirty = {}
end function

function onListSelect()
  m.state.selected = m.list.itemSelected
  m.state.dirty.selected = true
  m_update()
end function

function onContentLoaded(data)
  m.state.items = data
  m.state.dirty.items = true
  m_update()
end function
```

Key pattern: `m_update()` does targeted SceneGraph mutations based on `m.state.dirty` flags. No virtual DOM diffing. Svelte's compiler already figured out which state affects which nodes — we inherit that analysis.

---

## Runtime Library (BrightScript, ships with every app)
```
packages/runtime/src/
  Store.brs           # pub/sub, all async goes through here
  Network.brs         # roUrlTransfer wrapper, resolves into Store
  Flexbox.brs         # runtime layout engine (~300-500 lines)
  Router.brs          # D-pad screen stack navigation
  Registry.brs        # roRegistrySection wrapper (AsyncStorage equiv)
  Promise.brs         # v0.4+ minimal Promise polyfill
  MicrotaskQueue.brs  # v0.4+ JS microtask queue pattern
  stdlib/
    Array.brs         # map, filter, reduce, find, some, every, flat, includes
    String.brs        # split, trim, includes, startsWith, endsWith, replace, padStart
    Object.brs        # keys, values, entries, assign, fromEntries
    Math.brs          # missing Math methods
    JSON.brs          # thin wrapper over ParseJSON/FormatJSON
Main message loop pattern (generated into every app's Main.brs):
brightscriptsub Main()
  m.global.microtaskQueue = MicrotaskQueue_create()
  m.global.pendingRequests = []
  m.global.networkPort = createObject("roMessagePort")

  screen = createObject("roSGScreen")
  screen.setMessagePort(m.global.networkPort)
  screen.show()

  while true
    msg = wait(0, m.global.networkPort)

    if type(msg) = "roUrlEvent" then
      Network_handleResponse(msg)
    else if type(msg) = "roSGScreenEvent" then
      if msg.isScreenClosed() then exit while
    end if

    MicrotaskQueue_flush(m.global.microtaskQueue)
  end while
end sub
```

---

## Compiler Error Philosophy

Errors over silent failures. Always. Every error must:
1. Point to exact file + line + column
2. Show code context (the line, with a caret)
3. Explain what's wrong and why
4. Show the alternative or workaround
5. Link to docs
6. Say which version adds support if it's on the roadmap

Error tiers:
- **Fatal errors** (stop build): async/await, Promise, fetch, setTimeout, unknown imports, {#await} blocks, touch events, DOM access
- **Warnings** (emit best-effort): unsupported CSS properties, Svelte transitions
- **Silent** (just handle it): JSON.stringify→FormatJSON, console.log→print in debug

---

## Repo Structure
```
svelte-roku/
├── package.json                    # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .eslintrc.base.json
├── .prettierrc
│
├── packages/
│   ├── compiler/                   # @svelte-roku/compiler
│   │   └── src/
│   │       ├── index.ts            # compile(source, filename): CompileResult
│   │       ├── ir/
│   │       │   ├── types.ts
│   │       │   ├── builder.ts
│   │       │   ├── state.ts
│   │       │   ├── reactive.ts
│   │       │   ├── effects.ts
│   │       │   ├── stores.ts
│   │       │   └── props.ts
│   │       ├── emitters/
│   │       │   ├── xml.ts
│   │       │   ├── brightscript.ts
│   │       │   ├── manifest.ts
│   │       │   └── main.ts
│   │       ├── layout/
│   │       │   ├── resolver.ts
│   │       │   ├── yoga-bridge.ts
│   │       │   ├── css-parser.ts
│   │       │   └── types.ts
│   │       ├── transforms/
│   │       │   ├── async.ts
│   │       │   ├── imports.ts
│   │       │   ├── elements.ts
│   │       │   └── events.ts
│   │       ├── validation/
│   │       │   ├── validator.ts
│   │       │   ├── rules/
│   │       │   │   ├── no-async.ts
│   │       │   │   ├── no-fetch.ts
│   │       │   │   ├── no-timers.ts
│   │       │   │   ├── no-dom.ts
│   │       │   │   ├── no-await-block.ts
│   │       │   │   ├── no-gestures.ts
│   │       │   │   └── unknown-import.ts
│   │       │   └── allowlist.ts
│   │       └── errors/
│   │           ├── types.ts
│   │           ├── formatter.ts
│   │           └── messages.ts
│   │
│   ├── runtime/                    # @svelte-roku/runtime (pure .brs)
│   │   └── src/
│   │       ├── Store.brs
│   │       ├── Network.brs
│   │       ├── Flexbox.brs
│   │       ├── Router.brs
│   │       ├── Registry.brs
│   │       ├── Promise.brs
│   │       ├── MicrotaskQueue.brs
│   │       └── stdlib/
│   │           ├── Array.brs
│   │           ├── String.brs
│   │           ├── Object.brs
│   │           ├── Math.brs
│   │           └── JSON.brs
│   │
│   ├── cli/                        # @svelte-roku/cli
│   │   └── src/
│   │       ├── index.ts            # bin entry
│   │       ├── commands/
│   │       │   ├── build.ts        # svelte-roku build
│   │       │   ├── dev.ts          # watch + ECP deploy via roku-deploy
│   │       │   ├── check.ts        # typecheck + lint only
│   │       │   └── init.ts         # scaffold new project
│   │       ├── config/
│   │       │   ├── loader.ts
│   │       │   └── types.ts
│   │       └── utils/
│   │           ├── deploy.ts       # roku-deploy wrapper
│   │           ├── watcher.ts      # chokidar
│   │           ├── bundler.ts      # rollup integration
│   │           └── logger.ts
│   │
│   ├── vscode-extension/           # svelte-roku-tools
│   │   └── src/
│   │       ├── extension.ts
│   │       ├── diagnostics.ts      # compiler errors as squiggles
│   │       ├── hover.ts
│   │       └── completions.ts
│   │
│   └── config/                     # @svelte-roku/config
│       └── src/
│           ├── index.ts            # defineConfig()
│           ├── defaults.ts
│           └── types.ts
│
├── examples/
│   ├── minimal/                    # static UI, no async, prove pipeline
│   └── content-channel/            # real channel, lists, navigation
│
└── docs/
    ├── guide/
    │   ├── getting-started.md
    │   ├── component-model.md
    │   ├── async.md
    │   ├── navigation.md
    │   ├── styling.md
    │   └── deploying.md
    ├── reference/
    │   ├── elements.md
    │   ├── css-properties.md
    │   ├── compiler-errors.md
    │   └── config.md
    └── roadmap.md
```

---

## Build Order / Milestones
```
v0.1  Static UI only
      Svelte parse → IR → XML + BrightScript emit
      No state, no events, no layout engine
      Goal: render a hardcoded component on a real Roku device

v0.2  State + events
      let declarations → BrightScript state object
      {expression} bindings → m_update() pattern
      on:select, focus management

v0.3  Lists
      {#each} → MarkupList
      Unlocks content browsing channels (core Roku use case)

v0.4  Async
      fetch polyfill via roUrlTransfer
      Promise.brs + MicrotaskQueue.brs
      Main message loop integration

v0.5  Full stdlib
      Array/String/Object methods in BrightScript

v0.6  Static layout
      yoga-layout WASM at compile time
      Flexbox → absolute positions for fixed layouts

v0.7  Runtime layout
      Flexbox.brs for dynamic content

v1.0  Stable API
      Router, VS Code extension, full docs

Starting Point For Claude Code
The first thing to build is packages/compiler/src/index.ts and get its public API interface locked in before anything else:
typescriptexport interface CompileResult {
  xml: string
  brightscript: string
  warnings: CompileWarning[]
  errors: CompileError[]
}

export interface CompileError {
  code: string           // e.g. "NO_ASYNC"
  message: string        // human readable
  hint: string           // what to do instead
  docsUrl: string        // link to docs
  fatal: boolean
  loc: {
    file: string
    line: number
    column: number
    source: string       // the offending line of source
  }
}

export interface CompileWarning {
  code: string
  message: string
  loc: CompileError['loc']
}

export function compile(source: string, filename: string): CompileResult
Then build in this order:

errors/types.ts and errors/messages.ts — define all error codes upfront
errors/formatter.ts — pretty printer for errors
validation/rules/ — all the "not yet supported" rules that make v0.1 honest
validation/validator.ts — runs all rules against the AST
ir/types.ts — define the IR shape
ir/builder.ts — Svelte AST → IR (static components only first)
emitters/xml.ts — IR → SceneGraph XML
emitters/brightscript.ts — IR → BrightScript (init + static props only)
Wire it all together in index.ts
Write fixture tests: a .svelte file in tests/fixtures/valid/ and verify the XML output is correct

Don't touch layout, async, or the runtime until the basic emit pipeline works end to end and renders something on a real Roku device.

Useful External References

Svelte compiler API: import { parse, analyze, walk } from 'svelte/compiler'
Roku SceneGraph docs: https://developer.roku.com/docs/references/scenegraph/
BrightScript reference: https://developer.roku.com/docs/references/brightscript/
roku-deploy (ECP sideloading): https://www.npmjs.com/package/roku-deploy
yoga-layout (Flexbox engine): https://www.npmjs.com/package/yoga-layout
BrighterScript (prior art, good reference): https://github.com/rokucommunity/brighterscript