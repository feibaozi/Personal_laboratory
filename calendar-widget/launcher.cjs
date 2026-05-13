// Launcher: removes ELECTRON_RUN_AS_NODE then starts Electron
const { spawn } = require('child_process');
const path = require('path');

// CRITICAL: delete from current process env before spawning
delete process.env.ELECTRON_RUN_AS_NODE;

// Also permanently remove from registry for future
try {
  require('child_process').execSync(
    'reg delete HKCU\\Environment /v ELECTRON_RUN_AS_NODE /f',
    { stdio: 'ignore' }
  );
} catch {}

// Use electron.exe directly instead of going through cli.js
const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');

console.log('[Launcher] Starting Electron...');

const p = spawn(electronExe, ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
});

p.on('error', (err) => {
  console.error('[Launcher] Failed to start Electron:', err.message);
  process.exit(1);
});

p.on('close', (code) => {
  if (code !== 0) {
    console.error('[Launcher] Electron exited with code:', code);
  }
  process.exit(code || 0);
});
