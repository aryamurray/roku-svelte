import { describe, it, expect, vi, afterEach } from "vitest";

describe("stores", () => {
  it("writable() subscriber receives initial value immediately", async () => {
    const { writable } = await import("../src/stubs/stores.js");
    const store = writable(42);
    const values: number[] = [];
    store.subscribe((v) => values.push(v));
    expect(values).toEqual([42]);
  });

  it("writable.set() notifies all subscribers", async () => {
    const { writable } = await import("../src/stubs/stores.js");
    const store = writable(0);
    const values1: number[] = [];
    const values2: number[] = [];
    store.subscribe((v) => values1.push(v));
    store.subscribe((v) => values2.push(v));
    store.set(10);
    expect(values1).toEqual([0, 10]);
    expect(values2).toEqual([0, 10]);
  });

  it("writable.update() receives current and notifies with result", async () => {
    const { writable } = await import("../src/stubs/stores.js");
    const store = writable(5);
    const values: number[] = [];
    store.subscribe((v) => values.push(v));
    store.update((v) => v * 2);
    expect(values).toEqual([5, 10]);
  });

  it("multiple subscribers all notified", async () => {
    const { writable } = await import("../src/stubs/stores.js");
    const store = writable("a");
    const results: string[] = [];
    store.subscribe((v) => results.push(`1:${v}`));
    store.subscribe((v) => results.push(`2:${v}`));
    store.subscribe((v) => results.push(`3:${v}`));
    store.set("b");
    expect(results).toEqual(["1:a", "2:a", "3:a", "1:b", "2:b", "3:b"]);
  });

  it("unsubscribe stops notifications", async () => {
    const { writable } = await import("../src/stubs/stores.js");
    const store = writable(0);
    const values: number[] = [];
    const unsub = store.subscribe((v) => values.push(v));
    store.set(1);
    unsub();
    store.set(2);
    expect(values).toEqual([0, 1]);
  });

  it("double-unsubscribe is safe (no error)", async () => {
    const { writable } = await import("../src/stubs/stores.js");
    const store = writable(0);
    const unsub = store.subscribe(() => {});
    unsub();
    expect(() => unsub()).not.toThrow();
  });

  it("new subscriber after set() gets latest value", async () => {
    const { writable } = await import("../src/stubs/stores.js");
    const store = writable(1);
    store.set(99);
    const values: number[] = [];
    store.subscribe((v) => values.push(v));
    expect(values).toEqual([99]);
  });

  it("readable() subscriber receives initial value", async () => {
    const { readable } = await import("../src/stubs/stores.js");
    const store = readable("hello");
    const values: string[] = [];
    store.subscribe((v) => values.push(v));
    expect(values).toEqual(["hello"]);
  });

  it("readable() unsubscribe returns cleanly", async () => {
    const { readable } = await import("../src/stubs/stores.js");
    const store = readable(0);
    const unsub = store.subscribe(() => {});
    expect(() => unsub()).not.toThrow();
  });
});

describe("env", () => {
  it("all 7 constants exported with correct dev-mode defaults", async () => {
    const env = await import("../src/stubs/env.js");
    expect(env.ROKU).toBe(false);
    expect(env.WEB).toBe(true);
    expect(env.DEV).toBe(true);
    expect(env.PROD).toBe(false);
    expect(env.browser).toBe(true);
    expect(env.dev).toBe(true);
    expect(env.building).toBe(false);
  });
});

describe("navigation", () => {
  it("goto() doesn't throw", async () => {
    const { goto } = await import("../src/stubs/navigation.js");
    expect(() => goto("/test")).not.toThrow();
  });

  it("back() doesn't throw", async () => {
    const { back } = await import("../src/stubs/navigation.js");
    expect(() => back()).not.toThrow();
  });

  it("replace() doesn't throw", async () => {
    const { replace } = await import("../src/stubs/navigation.js");
    expect(() => replace("/other")).not.toThrow();
  });
});

describe("storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getItem returns null in Node env (no localStorage)", async () => {
    const { getItem } = await import("../src/stubs/storage.js");
    expect(getItem("any")).toBeNull();
  });

  it("setItem doesn't throw in Node env", async () => {
    const { setItem } = await import("../src/stubs/storage.js");
    expect(() => setItem("k", "v")).not.toThrow();
  });

  it("removeItem doesn't throw in Node env", async () => {
    const { removeItem } = await import("../src/stubs/storage.js");
    expect(() => removeItem("k")).not.toThrow();
  });

  it("roundtrip with stubbed localStorage", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
    const { getItem, setItem } = await import("../src/stubs/storage.js");
    setItem("k", "v");
    expect(getItem("k")).toBe("v");
  });

  it("missing key returns null with stubbed localStorage", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
    const { getItem } = await import("../src/stubs/storage.js");
    expect(getItem("nonexistent")).toBeNull();
  });
});

describe("router", () => {
  it("createRouter() doesn't throw", async () => {
    const { createRouter } = await import("../src/stubs/router.js");
    expect(() => createRouter([])).not.toThrow();
  });

  it("getCurrentRoute() returns '/'", async () => {
    const { getCurrentRoute } = await import("../src/stubs/router.js");
    expect(getCurrentRoute()).toBe("/");
  });
});

describe("animate", () => {
  it("animate() doesn't throw", async () => {
    const { animate } = await import("../src/stubs/animate.js");
    expect(() => animate("node1", "opacity", 1, { duration: 300 })).not.toThrow();
  });
});

describe("network", () => {
  it("rokuFetch returns a Promise", async () => {
    const { rokuFetch } = await import("../src/stubs/network.js");
    const result = rokuFetch("https://example.com");
    expect(result).toBeInstanceOf(Promise);
    // Don't await — we just verify it returns a promise
    result.catch(() => {}); // Suppress unhandled rejection
  });
});
