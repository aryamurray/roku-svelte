import { defineCommand, runMain } from "citty";
import { buildCommand } from "./commands/build.js";
import { devCommand } from "./commands/dev.js";
import { checkCommand } from "./commands/check.js";
import { initCommand } from "./commands/init.js";
import { deployCommand } from "./commands/deploy.js";

const main = defineCommand({
  meta: {
    name: "svelte-roku",
    version: "0.1.0",
    description: "Svelte-to-Roku compiler toolchain",
  },
  subCommands: {
    build: buildCommand,
    dev: devCommand,
    check: checkCommand,
    init: initCommand,
    deploy: deployCommand,
  },
});

runMain(main);
