import { defineCommand } from "citty";
import { consola } from "consola";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "pathe";

const SCAFFOLD_FILES: Record<string, string> = {
  "svelte-roku.config.ts": `import { defineConfig } from '@svelte-roku/config'

export default defineConfig({
  title: 'My Roku Channel',
  entry: 'src/HomeScreen.svelte',
})
`,

  "vite.config.ts": `import { defineConfig } from 'vite'
import { svelteRoku } from '@svelte-roku/vite-plugin'

export default defineConfig({
  plugins: [svelteRoku()],
})
`,

  "svelte.config.js": `import { svelteRokuPreprocess } from '@svelte-roku/preprocessor'

export default {
  preprocess: [svelteRokuPreprocess({ platform: 'roku' })],
}
`,

  "package.json": `{
  "name": "my-roku-channel",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "svelte-roku dev",
    "build": "svelte-roku build",
    "check": "svelte-roku check"
  },
  "devDependencies": {
    "@svelte-roku/cli": "*",
    "@svelte-roku/compiler": "*",
    "@svelte-roku/config": "*",
    "@svelte-roku/preprocessor": "*",
    "@svelte-roku/vite-plugin": "*",
    "@svelte-roku/runtime": "*",
    "svelte": "^5.0.0",
    "vite": "^6.0.0"
  }
}
`,

  "tsconfig.json": `{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
`,

  "src/HomeScreen.svelte": `<script>
  let items = [];

  async function loadContent() {
    const res = await fetch('https://api.example.com/content');
    items = await res.json();
  }

  loadContent();
</script>

<screen>
  <roku>
    {#each items as item}
      <label text={item.title} />
    {/each}
  </roku>

  <web>
    <ul>
      {#each items as item}
        <li>{item.title}</li>
      {/each}
    </ul>
  </web>
</screen>
`,
};

export const initCommand = defineCommand({
  meta: { name: "init", description: "Scaffold a new Svelte-Roku project" },
  args: {
    dir: { type: "positional", description: "Project directory (default: cwd)", required: false },
  },
  async run({ args }) {
    const targetDir = args.dir ? resolve(args.dir) : process.cwd();

    // Check for existing files
    const existing = Object.keys(SCAFFOLD_FILES).filter((file) =>
      existsSync(join(targetDir, file)),
    );

    if (existing.length > 0) {
      consola.error(
        `Cannot scaffold: the following files already exist:\n${existing.map((f) => `  - ${f}`).join("\n")}`,
      );
      process.exit(1);
    }

    // Create directories
    mkdirSync(join(targetDir, "src"), { recursive: true });

    // Write files
    for (const [file, content] of Object.entries(SCAFFOLD_FILES)) {
      const filePath = join(targetDir, file);
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, content);
      consola.log(`  Created ${file}`);
    }

    consola.success("Project scaffolded! Run `bun install` to get started.");
  },
});
