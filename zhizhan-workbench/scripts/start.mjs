import { spawn, execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const PYTHON_DIR = join(ROOT, "python-backend");
const PYTHON_PORT = 8765;
const NEXT_PORT = 3001;

const isDesktop = process.argv.includes("--desktop");

let processes = [];

function log(tag, msg) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  console.log(`[${time}] [${tag}] ${msg}`);
}

function runAsync(command, options = {}) {
  const tag = options.tag || "PROC";
  const proc = spawn(command, [], {
    shell: true,
    cwd: options.cwd || ROOT,
    stdio: "pipe",
    env: { ...process.env, ...options.env },
  });

  proc.stdout?.on("data", (data) => {
    data.toString().split("\n").forEach((line) => {
      if (line.trim()) log(tag, line.trim());
    });
  });

  proc.stderr?.on("data", (data) => {
    data.toString().split("\n").forEach((line) => {
      if (line.trim()) log(tag, line.trim());
    });
  });

  proc.on("error", (err) => {
    log("ERROR", `Failed: ${err.message}`);
  });

  processes.push(proc);
  return proc;
}

function runSync(command, options = {}) {
  try {
    execSync(command, {
      cwd: options.cwd || ROOT,
      stdio: "pipe",
      env: { ...process.env },
      timeout: options.timeout || 120000,
    });
    return true;
  } catch (e) {
    log("ERROR", `Sync command failed: ${command}`);
    return false;
  }
}

function runAsyncAndWait(command, options = {}) {
  return new Promise((resolve) => {
    const proc = runAsync(command, options);
    proc.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

async function waitForUrl(url, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function setupPython() {
  const venvPath = join(PYTHON_DIR, ".venv");
  const isWin = process.platform === "win32";

  const venvPython = isWin
    ? join(venvPath, "Scripts", "python.exe")
    : join(venvPath, "bin", "python");
  const venvPip = isWin
    ? join(venvPath, "Scripts", "pip.exe")
    : join(venvPath, "bin", "pip");

  if (!existsSync(venvPython)) {
    log("SETUP", "Creating Python virtual environment...");
    const ok = runSync("python -m venv .venv", { cwd: PYTHON_DIR, timeout: 60000 });
    if (ok) {
      log("SETUP", "✓ Virtual environment created");
    } else {
      log("ERROR", "Failed to create venv, will try system python");
      return "python";
    }
  }

  const reqFile = join(PYTHON_DIR, "requirements.txt");
  if (existsSync(reqFile) && existsSync(venvPip)) {
    log("SETUP", "Installing core Python dependencies...");
    await runAsyncAndWait(`"${venvPip}" install -r requirements.txt`, {
      cwd: PYTHON_DIR,
      tag: "PIP",
    });
    log("SETUP", "✓ Core dependencies installed");
  }

  const aiReqFile = join(PYTHON_DIR, "requirements-ai.txt");
  if (existsSync(aiReqFile) && existsSync(venvPip)) {
    log("SETUP", "Installing AI dependencies (langchain/chromadb, may take a while)...");
    await runAsyncAndWait(`"${venvPip}" install -r requirements-ai.txt`, {
      cwd: PYTHON_DIR,
      tag: "PIP-AI",
    });
    log("SETUP", "✓ AI dependencies installed");
  }

  return venvPython;
}

async function startPythonBackend(venvPython) {
  log("PYTHON", "Starting Python backend...");
  runAsync(`"${venvPython}" main.py`, {
    cwd: PYTHON_DIR,
    tag: "PYTHON",
  });

  log("PYTHON", `Waiting for backend on port ${PYTHON_PORT}...`);
  const ready = await waitForUrl(`http://localhost:${PYTHON_PORT}/health`, 30000);

  if (ready) {
    log("PYTHON", "✓ Backend is ready!");
  } else {
    log("WARN", "Backend health check timeout, continuing anyway...");
  }
}

async function startNextDev() {
  log("NEXT", `Starting Next.js dev server on port ${NEXT_PORT}...`);
  runAsync(`npx next dev -p ${NEXT_PORT}`, { tag: "NEXT" });

  log("NEXT", "Waiting for Next.js...");
  const ready = await waitForUrl(`http://localhost:${NEXT_PORT}`, 30000);

  if (ready) {
    log("NEXT", "✓ Next.js is ready!");
  } else {
    log("WARN", "Next.js startup timeout, continuing anyway...");
  }
}

async function compileAndStartElectron() {
  log("ELECTRON", "Compiling Electron TypeScript...");
  const ok = runSync("npx tsc -p electron/tsconfig.json");
  if (!ok) {
    log("ERROR", "Electron compilation failed!");
    return;
  }
  log("ELECTRON", "✓ Compilation done!");

  log("ELECTRON", "Launching Electron...");
  runAsync("npx electron . --dev", { tag: "ELECTRON" });
}

function cleanup() {
  log("CLEANUP", "Shutting down all processes...");
  processes.forEach((p) => {
    try { if (!p.killed) p.kill(); } catch { /* ignore */ }
  });
  setTimeout(() => process.exit(0), 2000);
}

async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║         智研工作台 - 一键启动脚本            ║");
  console.log(`║    模式: ${isDesktop ? "Electron 桌面端" : "Web 浏览器          "}            ║`);
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Step 1: Python
  const venvPython = await setupPython();
  await startPythonBackend(venvPython);

  // Step 2: Next.js
  await startNextDev();

  // Step 3: Electron (optional)
  if (isDesktop) {
    await compileAndStartElectron();
  }

  console.log("");
  log("READY", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  log("READY", `  前端地址: http://localhost:${NEXT_PORT}`);
  log("READY", `  后端地址: http://localhost:${PYTHON_PORT}`);
  log("READY", `  健康检查: http://localhost:${PYTHON_PORT}/health`);
  log("READY", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  log("INFO", "按 Ctrl+C 停止所有服务");
}

main().catch((err) => {
  log("FATAL", err.message);
  cleanup();
});
