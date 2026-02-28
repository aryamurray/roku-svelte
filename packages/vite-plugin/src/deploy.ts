import { createConnection } from "net";
import type { ResolvedConfig } from "@svelte-roku/config";

export async function deployToDevice(config: ResolvedConfig): Promise<void> {
  if (!config.roku) {
    throw new Error("No Roku device configured. Set roku.host and roku.password.");
  }

  const rokuDeploy = await import("roku-deploy").then((m) => m.rokuDeploy);
  await rokuDeploy.deploy({
    host: config.roku.host,
    password: config.roku.password,
    rootDir: config.outDir,
    files: ["**/*"],
    outDir: config.outDir,
    outFile: "channel.zip",
  });
}

export function connectTelnet(host: string, port: number = 8085): void {
  const socket = createConnection({ host, port }, () => {
    console.log(`[svelte-roku] Connected to Roku debug console at ${host}:${port}`);
  });

  socket.on("data", (data) => {
    process.stdout.write(data);
  });

  socket.on("error", (err) => {
    console.error(`[svelte-roku] Telnet error: ${err.message}`);
  });

  socket.on("close", () => {
    console.log("[svelte-roku] Debug console disconnected");
  });
}
