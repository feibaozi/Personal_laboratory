import { spawn } from "child_process";

function runCommand(command, args, options = {}) {
  const proc = spawn(command, args, { shell: true, stdio: "inherit", ...options });
  proc.on("error", (err) => {
    console.error(`Failed to start ${command}:`, err);
  });
  return proc;
}

async function main() {
  console.log("[Dev] Compiling Electron TypeScript...");
  const tscProc = runCommand("npx", ["tsc", "-p", "electron/tsconfig.json"]);
  await new Promise((resolve) => tscProc.on("close", (code) => {
    if (code !== 0) {
      console.error("[Dev] Electron compilation failed");
      process.exit(1);
    }
    resolve();
  }));

  console.log("[Dev] Starting Next.js dev server...");
  const nextProc = runCommand("npx", ["next", "dev", "-p", "3001"]);

  console.log("[Dev] Waiting for Next.js to start...");
  await new Promise((resolve) => setTimeout(resolve, 6000));

  console.log("[Dev] Launching Electron...");
  const electronProc = runCommand("npx", ["electron", ".", "--dev"]);

  const cleanup = () => {
    console.log("[Dev] Cleaning up...");
    nextProc.kill();
    electronProc.kill();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  electronProc.on("close", () => {
    cleanup();
  });
}

main();
