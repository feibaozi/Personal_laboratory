import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      shell: true,
      stdio: "inherit",
      cwd: root,
      ...opts,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with ${code}`));
    });
  });
}

async function startDev() {
  console.log("Building Electron main + preload...");
  await run("npx", ["tsc", "-p", "electron/tsconfig.json"]);

  console.log("Starting Next.js dev server...");
  const nextDev = spawn("npx", ["next", "dev", "-p", "3002"], {
    shell: true,
    stdio: "inherit",
    cwd: root,
  });

  await new Promise((r) => setTimeout(r, 5000));

  console.log("Starting Electron...");
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;

  const electron = spawn(
    "npx",
    ["electron", ".", "--dev"],
    {
      shell: true,
      stdio: "inherit",
      cwd: root,
      env: cleanEnv,
    }
  );

  electron.on("close", () => {
    nextDev.kill();
    process.exit();
  });

  nextDev.on("close", () => {
    electron.kill();
    process.exit();
  });
}

startDev().catch((err) => {
  console.error(err);
  process.exit(1);
});
