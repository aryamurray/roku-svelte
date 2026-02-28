import { defineCommand } from "citty";
import { consola } from "consola";
import { loadCLIConfig } from "../utils/config.js";

export const deployCommand = defineCommand({
  meta: { name: "deploy", description: "Deploy built channel to a Roku device" },
  args: {
    host: { type: "string", description: "Roku device IP address", required: true },
    password: { type: "string", description: "Roku device password", default: "rokudev" },
  },
  async run({ args }) {
    const config = await loadCLIConfig();

    consola.start(`Deploying to ${args.host}...`);

    try {
      const rokuDeploy = await import("roku-deploy").then((m) => m.rokuDeploy);
      await rokuDeploy.deploy({
        host: args.host,
        password: args.password,
        rootDir: config.outDir,
        files: ["**/*"],
        outDir: config.outDir,
        outFile: "channel.zip",
      });
      consola.success(`Deployed to ${args.host}`);
    } catch (err) {
      consola.error("Deploy failed:", err);
      process.exit(1);
    }
  },
});
