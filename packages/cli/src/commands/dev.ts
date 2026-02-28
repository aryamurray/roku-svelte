import { defineCommand } from "citty";
import { consola } from "consola";

export const devCommand = defineCommand({
  meta: { name: "dev", description: "Start development server with live reload" },
  args: {
    host: { type: "string", description: "Roku device IP address" },
    password: { type: "string", description: "Roku device password" },
  },
  async run({ args }) {
    const { createServer } = await import("vite");
    const { svelteRoku } = await import("@svelte-roku/vite-plugin");
    const { resolveConfig } = await import("@svelte-roku/config");

    const overrides: Record<string, unknown> = {};
    if (args.host) {
      overrides.roku = {
        host: args.host,
        password: args.password ?? "rokudev",
      };
    }

    const config = resolveConfig(overrides);

    const server = await createServer({
      plugins: [svelteRoku(overrides)],
    });

    await server.listen();
    server.printUrls();

    if (config.roku) {
      consola.info(`Deploying to Roku at ${config.roku.host}`);
    } else {
      consola.info("No Roku device configured — running in watch-only mode");
    }
  },
});
