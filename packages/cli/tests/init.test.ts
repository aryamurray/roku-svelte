import { describe, it, expect } from "vitest";
import { SCAFFOLD_FILES } from "../src/commands/init.js";

describe("SCAFFOLD_FILES", () => {
  const filePaths = Object.keys(SCAFFOLD_FILES);

  it("contains all 6 expected file paths", () => {
    expect(filePaths).toHaveLength(6);
    expect(filePaths).toContain("svelte-roku.config.ts");
    expect(filePaths).toContain("vite.config.ts");
    expect(filePaths).toContain("svelte.config.js");
    expect(filePaths).toContain("package.json");
    expect(filePaths).toContain("tsconfig.json");
    expect(filePaths).toContain("src/HomeScreen.svelte");
  });

  it("each template is non-empty", () => {
    for (const [file, content] of Object.entries(SCAFFOLD_FILES)) {
      expect(content.trim().length, `${file} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("package.json template is valid JSON", () => {
    expect(() => JSON.parse(SCAFFOLD_FILES["package.json"])).not.toThrow();
  });

  it("tsconfig.json template is valid JSON", () => {
    expect(() => JSON.parse(SCAFFOLD_FILES["tsconfig.json"])).not.toThrow();
  });

  it("templates reference @svelte-roku/* packages", () => {
    const allContent = Object.values(SCAFFOLD_FILES).join("\n");
    expect(allContent).toContain("@svelte-roku/config");
    expect(allContent).toContain("@svelte-roku/vite-plugin");
    expect(allContent).toContain("@svelte-roku/preprocessor");
    expect(allContent).toContain("@svelte-roku/runtime");
    expect(allContent).toContain("@svelte-roku/compiler");
  });

  it("src/HomeScreen.svelte contains <screen> tag", () => {
    expect(SCAFFOLD_FILES["src/HomeScreen.svelte"]).toContain("<screen>");
  });
});
