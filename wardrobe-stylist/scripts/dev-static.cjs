// Dev mode that loads static files (no Vite)
const { spawn } = require('child_process');

// Just build main+preload, Electron loads renderer from dist/
const buildMain = spawn('npx', ['tsc', '-p', 'tsconfig.main.json'], { shell: true, stdio: 'inherit' });
const buildPreload = spawn('npx', ['tsc', '-p', 'tsconfig.preload.json'], { shell: true, stdio: 'inherit' });

Promise.all([
  new Promise((r) => buildMain.on('close', r)),
  new Promise((r) => buildPreload.on('close', r)),
]).then(() => {
  console.log('Build done. Starting Electron without Vite...');
  const env = { ...process.env, NODE_ENV: 'development' };
  delete env.ELECTRON_RUN_AS_NODE;

  const electron = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env,
  });

  electron.on('close', () => process.exit());
});
