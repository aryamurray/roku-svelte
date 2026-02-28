import { describe, it, expect } from "vitest";
import { MODULE_ALIASES } from "../src/aliases.js";

describe("MODULE_ALIASES", () => {
  it("maps $app/environment to runtime/env", () => {
    expect(MODULE_ALIASES["$app/environment"]).toBe("@svelte-roku/runtime/env");
  });

  it("maps $app/navigation to runtime/navigation", () => {
    expect(MODULE_ALIASES["$app/navigation"]).toBe("@svelte-roku/runtime/navigation");
  });

  it("maps $app/stores to runtime/stores", () => {
    expect(MODULE_ALIASES["$app/stores"]).toBe("@svelte-roku/runtime/stores");
  });

  it("maps $roku/env to config/env", () => {
    expect(MODULE_ALIASES["$roku/env"]).toBe("@svelte-roku/config/env");
  });

  it("maps $roku/router to runtime/router", () => {
    expect(MODULE_ALIASES["$roku/router"]).toBe("@svelte-roku/runtime/router");
  });

  it("maps $roku/storage to runtime/storage", () => {
    expect(MODULE_ALIASES["$roku/storage"]).toBe("@svelte-roku/runtime/storage");
  });

  it("maps $roku/animate to runtime/animate", () => {
    expect(MODULE_ALIASES["$roku/animate"]).toBe("@svelte-roku/runtime/animate");
  });

  it("maps $roku/network to runtime/network", () => {
    expect(MODULE_ALIASES["$roku/network"]).toBe("@svelte-roku/runtime/network");
  });
});
