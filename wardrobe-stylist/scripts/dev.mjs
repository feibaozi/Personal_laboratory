import { spawn } from 'child_process';
import { createServer } from 'vite';

async function startDev() {
  const server = await createServer({
    configFile: './vite.config.ts',
  });
  await server.listen();

  const address = server.httpServer?.address();
  const port = typeof address === 'object' ? address?.port : 5173;
  const devUrl = `http://localhost:${port}`;

  console.log(`\n  Vite: ${devUrl}`);
  console.log(`  Electron loading: ${devUrl}\n`);

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

  const electronEnv = { ...process.env, NODE_ENV: 'development' };
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  const electron = spawn(
    'npx',
    ['electron', '.', '--dev', `--dev-url=${devUrl}`],
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
