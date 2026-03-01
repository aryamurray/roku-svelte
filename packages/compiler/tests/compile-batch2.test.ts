import { describe, it, expect } from "vitest";
import { compile } from "../src/index.js";

// Feature 1: Empty Array State Init
describe("Feature 1: Empty Array State Init", () => {
  it("compiles empty array init without errors", async () => {
    const source = `<script>let items = [];</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("items: []");
  });

  it("empty array works with handler push", async () => {
    const source = `<script>
let items = [];
function addItem() {
  items = [...items, { title: "New" }];
}
</script><rectangle on:select={addItem} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("items: []");
  });

  it("BRS init contains items: []", async () => {
    const source = `<script>let data = [];</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.brightscript).toContain("data: []");
  });
});

// Feature 2: Object Literal State Init
describe("Feature 2: Object Literal State Init", () => {
  it("compiles object with mixed types", async () => {
    const source = `<script>let config = { width: 1920, height: 1080, name: "default", active: true };</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("width: 1920");
    expect(result.brightscript).toContain("height: 1080");
    expect(result.brightscript).toContain('name: "default"');
    expect(result.brightscript).toContain("active: true");
  });

  it("compiles empty object", async () => {
    const source = `<script>let config = {};</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("config: {}");
  });

  it("errors on nested objects", async () => {
    const source = `<script>let config = { nested: { x: 1 } };</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.code === "UNSUPPORTED_STATE_INIT")).toBe(true);
  });

  it("handler can access object property via binding", async () => {
    const source = `<script>let config = { width: 1920 };</script><text>{config.width}</text>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("m.state.config.width");
  });

  it("template binding works for object state", async () => {
    const source = `<script>let settings = { volume: 50 };</script><text>{settings.volume}</text>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
  });
});

// Feature 3: Try/Catch in Handlers
describe("Feature 3: Try/Catch in Handlers", () => {
  it("compiles basic try/catch", async () => {
    const source = `<script>
let status = "ok";
function doSomething() {
  try {
    status = "running";
  } catch(e) {
    status = "error";
  }
}
</script><rectangle on:select={doSomething} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("try");
    expect(result.brightscript).toContain("catch e");
    expect(result.brightscript).toContain("end try");
  });

  it("preserves custom catch variable name", async () => {
    const source = `<script>
let x = 0;
function handler() {
  try {
    x = 1;
  } catch(err) {
    x = -1;
  }
}
</script><rectangle on:select={handler} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("catch err");
  });

  it("compiles state mutation inside try", async () => {
    const source = `<script>
let count = 0;
function handler() {
  try {
    count = count + 1;
  } catch(e) {
    count = 0;
  }
}
</script><rectangle on:select={handler} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("m.state.count = m.state.count + 1");
  });

  it("inlines finally statements after try-catch", async () => {
    const source = `<script>
let status = "idle";
function handler() {
  try {
    status = "running";
  } catch(e) {
    status = "error";
  } finally {
    status = "done";
  }
}
</script><rectangle on:select={handler} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("end try");
    // finally body is inlined after the try-catch
    expect(result.brightscript).toContain('m.state.status = "done"');
  });
});

// Feature 4: onMount Lifecycle Hook
describe("Feature 4: onMount Lifecycle Hook", () => {
  it("compiles basic onMount", async () => {
    const source = `<script>
import { onMount } from 'svelte';
let loaded = false;
onMount(() => {
  loaded = true;
});
</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("m.state.loaded = true");
  });

  it("onMount state mutation triggers m_update()", async () => {
    const source = `<script>
import { onMount } from 'svelte';
let count = 0;
onMount(() => {
  count = 10;
});
</script><text>{count}</text>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    const brs = result.brightscript;
    // After onMount body, dirty flag and m_update should be emitted
    expect(brs).toContain("m.state.count = 10");
    expect(brs).toContain("m.state.dirty.count = true");
  });

  it("import from svelte passes", async () => {
    const source = `<script>
import { onMount } from 'svelte';
let x = 0;
onMount(() => { x = 1; });
</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
  });

  it("multiple statements in onMount", async () => {
    const source = `<script>
import { onMount } from 'svelte';
let a = 0;
let b = "hello";
onMount(() => {
  a = 42;
  b = "world";
});
</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("m.state.a = 42");
    expect(result.brightscript).toContain('m.state.b = "world"');
  });
});

// Feature 5: onDestroy Lifecycle Hook
describe("Feature 5: onDestroy Lifecycle Hook", () => {
  it("compiles basic onDestroy", async () => {
    const source = `<script>
import { onDestroy } from 'svelte';
let active = true;
onDestroy(() => {
  active = false;
});
</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("sub onDestroy_handler()");
    expect(result.brightscript).toContain("end sub");
  });

  it("both onMount and onDestroy together", async () => {
    const source = `<script>
import { onMount, onDestroy } from 'svelte';
let status = "idle";
onMount(() => { status = "mounted"; });
onDestroy(() => { status = "destroyed"; });
</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain('m.state.status = "mounted"');
    expect(result.brightscript).toContain("sub onDestroy_handler()");
    expect(result.brightscript).toContain('m.state.status = "destroyed"');
  });

  it("handler body compiles correctly", async () => {
    const source = `<script>
import { onDestroy } from 'svelte';
let x = 0;
onDestroy(() => { x = -1; });
</script><rectangle />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("m.state.x = (-1)");
  });
});

// Feature 6: {#each} Index Support
describe("Feature 6: {#each} Index Support", () => {
  it("compiles {i} in text as __index field", async () => {
    const source = `<script>let items = [{ title: "A" }];</script>
<list itemSize="[100, 50]">{#each items as item, i}<text>{i}</text>{/each}</list>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    // The __index field should be added to ContentNode
    expect(result.brightscript).toContain("__index");
  });

  it("mixed #{i}: {item.title} text binding", async () => {
    const source = `<script>let items = [{ title: "Hello" }];</script>
<list itemSize="[100, 50]">{#each items as item, idx}<text>{idx}: {item.title}</text>{/each}</list>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
  });

  it("ContentNode has __index field in BRS output", async () => {
    const source = `<script>let items = [{ title: "X" }];</script>
<list itemSize="[100, 50]">{#each items as item, i}<text>{item.title}</text>{/each}</list>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain('child.addField("__index", "integer", false)');
    expect(result.brightscript).toContain("child.__index = __idx");
    expect(result.brightscript).toContain("__idx = __idx + 1");
  });

  it("eachBlock IR has indexName", async () => {
    const source = `<script>let items = [{ title: "A" }];</script>
<list itemSize="[100, 50]">{#each items as item, i}<text>{item.title}</text>{/each}</list>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    // Verify BRS output has __idx counter
    expect(result.brightscript).toContain("__idx = 0");
  });

  it("works without index (no __index emitted)", async () => {
    const source = `<script>let items = [{ title: "A" }];</script>
<list itemSize="[100, 50]">{#each items as item}<text>{item.title}</text>{/each}</list>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).not.toContain("__idx");
  });
});

// Feature 7: bind:value for TextEditBox
describe("Feature 7: bind:value for TextEditBox", () => {
  it("compiles bind:value on input", async () => {
    const source = `<script>let query = "";</script><input bind:value={query} />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("observeField");
    expect(result.brightscript).toContain("m.state.query");
  });

  it("creates one-way and two-way bindings", async () => {
    const source = `<script>let query = "hello";</script><input bind:value={query} />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    const brs = result.brightscript;
    // One-way: state→text in m_update
    expect(brs).toContain("m.state.query");
    // Two-way: observeField for text changes
    expect(brs).toContain('observeField("text"');
  });

  it("errors on bind:value on non-input element", async () => {
    const source = `<script>let x = "";</script><text bind:value={x}>hello</text>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.code === "UNSUPPORTED_BIND")).toBe(true);
  });

  it("BRS has observeField + observer sub", async () => {
    const source = `<script>let search = "";</script><input bind:value={search} />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    const brs = result.brightscript;
    expect(brs).toContain('observeField("text"');
    expect(brs).toContain("sub on_");
    expect(brs).toContain("_changed()");
    expect(brs).toContain("m.state.search = m.");
    expect(brs).toContain("m.state.dirty.search = true");
    expect(brs).toContain("m_update()");
  });

  it("errors on bind:checked", async () => {
    const source = `<script>let checked = false;</script><input bind:checked={checked} />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.code === "UNSUPPORTED_BIND")).toBe(true);
  });
});

// Feature 8: Spread in Array Expressions
describe("Feature 8: Spread in Array Expressions", () => {
  it("compiles [...items, item] in handler", async () => {
    const source = `<script>
let items = [];
let count = 0;
function addItem() {
  items = [...items, { title: "New" }];
  count = count + 1;
}
</script><rectangle on:select={addItem} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain("__spread_");
    expect(result.brightscript).toContain(".Append(");
    expect(result.brightscript).toContain(".Push(");
  });

  it("compiles [...a, ...b] with multiple spreads", async () => {
    const source = `<script>
let items = [];
let other = [];
function merge() {
  items = [...items, ...other];
}
</script><rectangle on:select={merge} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    const brs = result.brightscript;
    // Should have two .Append() calls
    const appendCount = (brs.match(/\.Append\(/g) || []).length;
    expect(appendCount).toBeGreaterThanOrEqual(2);
  });

  it("compiles [...items] copy", async () => {
    const source = `<script>
let items = [];
function copyItems() {
  items = [...items];
}
</script><rectangle on:select={copyItems} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.brightscript).toContain(".Append(");
  });

  it("errors on spread in template expression", async () => {
    const source = `<script>let items = []; let other = [];</script><text>{[...items, ...other].length}</text>`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// Feature 9: Async/Await Transpilation
describe("Feature 9: Async/Await Transpilation", () => {
  it("compiles basic async function with fetch await", async () => {
    const source = `<script>
let data = [];
async function loadData() {
  const res = await fetch("/api/items");
  data = res;
}
</script><rectangle on:select={loadData} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    const brs = result.brightscript;
    expect(brs).toContain("sub loadData()");
    expect(brs).toContain("fetch(");
    expect(brs).toContain("observeField");
    expect(brs).toContain("loadData__cont_");
  });

  it("includes Promise.brs and MicrotaskQueue.brs scripts", async () => {
    const source = `<script>
let data = [];
async function loadData() {
  const res = await fetch("/api");
  data = res;
}
</script><rectangle on:select={loadData} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    expect(result.xml).toContain("Promise.brs");
    expect(result.xml).toContain("MicrotaskQueue.brs");
  });

  it("state mutation after await generates dirty flags", async () => {
    const source = `<script>
let items = [];
async function loadItems() {
  const response = await fetch("/api/items");
  items = response;
}
</script><rectangle on:select={loadItems} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.length).toBe(0);
    const brs = result.brightscript;
    expect(brs).toContain("m.state.dirty.items = true");
    expect(brs).toContain("m_update()");
  });

  it("continuation sub receives fetch response", async () => {
    const source = `<script>
let result = "";
async function loadData() {
  const res = await fetch("/api/data");
  result = res;
}
</script><rectangle on:select={loadData} focusable />`;
    const r = await compile(source, "Test.svelte");
    expect(r.errors.length).toBe(0);
    const brs = r.brightscript;
    // The continuation should access the response
    expect(brs).toContain(".response");
  });

  it("compiles generic await with Promise_then", async () => {
    const source = `<script>
let result = "";
async function doWork() {
  const val = await someAsyncCall();
  result = val;
}
</script><rectangle on:select={doWork} focusable />`;
    const r = await compile(source, "Test.svelte");
    expect(r.errors.length).toBe(0);
    const brs = r.brightscript;
    expect(brs).toContain("Promise_then");
    expect(brs).toContain("doWork__cont_");
  });

  it("no NO_ASYNC validation errors", async () => {
    const source = `<script>
let x = 0;
async function test() {
  const val = await fetch("/api");
  x = 1;
}
</script><rectangle on:select={test} focusable />`;
    const result = await compile(source, "Test.svelte");
    expect(result.errors.filter(e => e.code === "NO_ASYNC").length).toBe(0);
  });
});
