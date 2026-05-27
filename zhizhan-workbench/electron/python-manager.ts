import { ChildProcess, spawn } from "child_process";
import path from "path";
import http from "http";

const PYTHON_PORT = 8765;
const MAX_STARTUP_WAIT = 30000;
const HEALTH_CHECK_INTERVAL = 1000;

let pythonProcess: ChildProcess | null = null;

function getPythonExecutable(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return "python";
  }
  return path.join(process.resourcesPath, "python", "python.exe");
}

import { app } from "electron";

function getScriptPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, "..", "python-backend", "main.py");
  }
  return path.join(process.resourcesPath, "python-backend", "main.py");
}

export function startPythonBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonExecutable();
    const scriptPath = getScriptPath();

    console.log(`[Python] Starting: ${pythonExe} ${scriptPath}`);

    pythonProcess = spawn(pythonExe, [scriptPath], {
      env: {
        ...process.env,
        PYTHON_PORT: String(PYTHON_PORT),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    pythonProcess.stdout?.on("data", (data: Buffer) => {
      console.log(`[Python stdout] ${data.toString().trim()}`);
    });

    pythonProcess.stderr?.on("data", (data: Buffer) => {
      console.log(`[Python stderr] ${data.toString().trim()}`);
    });

    pythonProcess.on("error", (err) => {
      console.error(`[Python] Failed to start: ${err.message}`);
      reject(err);
    });

    pythonProcess.on("close", (code) => {
      console.log(`[Python] Process exited with code ${code}`);
      pythonProcess = null;
    });

    const startTime = Date.now();

    const checkHealth = () => {
      if (Date.now() - startTime > MAX_STARTUP_WAIT) {
        reject(new Error("Python backend startup timeout"));
        return;
      }

      const req = http.get(
        `http://localhost:${PYTHON_PORT}/health`,
        (res) => {
          if (res.statusCode === 200) {
            console.log("[Python] Backend is ready");
            resolve();
          } else {
            setTimeout(checkHealth, HEALTH_CHECK_INTERVAL);
          }
        }
      );

      req.on("error", () => {
        setTimeout(checkHealth, HEALTH_CHECK_INTERVAL);
      });

      req.end();
    };

    setTimeout(checkHealth, 1000);
  });
}

export function stopPythonBackend(): void {
  if (pythonProcess && !pythonProcess.killed) {
    console.log("[Python] Stopping backend...");
    pythonProcess.kill("SIGTERM");

    setTimeout(() => {
      if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill("SIGKILL");
      }
    }, 5000);
  }
}

export function isPythonRunning(): boolean {
  return pythonProcess !== null && !pythonProcess.killed;
}
