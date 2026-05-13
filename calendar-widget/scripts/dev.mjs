import { spawn } from 'child_process';
import { createServer } from 'vite';

async function startDev() {
  // Start Vite dev server for renderer
  const server = await createServer({
    configFile: './vite.config.ts',
  });
  await server.listen();
  server.printUrls();

  // Build main + preload once, then wait for Vite
  const buildMain = spawn('npx', ['tsc', '-p', 'tsconfig.main.json'], {
    shell: true,
    stdio: 'inherit',
  });
  const buildPreload = spawn('npx', ['tsc', '-p', 'tsconfig.preload.json'], {
    shell: true,
    stdio: 'inherit',
  });

  await Promise.all([
    new Promise((r) => buildMain.on('close', r)),
    new Promise((r) => buildPreload.on('close', r)),
  ]);

  // Clean env for Electron
  const electronEnv = { ...process.env, NODE_ENV: 'development' };
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  // Start Electron pointing to Vite dev server
  const electron = spawn(
    'npx',
    [
      'electron',
      '.',
      '--dev',
      '--dev-url=http://localhost:5173',
    ],
    {
      shell: true,
      stdio: 'inherit',
      env: electronEnv,
    }
  );

  electron.on('close', () => {
    server.close();
    process.exit();
  });
}

startDev().catch(console.error);
