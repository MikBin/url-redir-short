import { spawn } from 'child_process';
import path from 'path';
import { createServer } from 'net';

const rootDir = path.resolve(__dirname, '../../');
const adminDir = path.join(rootDir, 'admin-service/supabase');
const engineDir = path.join(rootDir, 'redir-engine');

const ADMIN_PORT = 3001;
const ENGINE_PORT = 3002;
const SYNC_KEY = 'test-sync-key';

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function waitForUrl(url: string, timeout = 60000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const res = await fetch(url);
            // Accept 503 (Service Unavailable) as "started but unhealthy" (e.g. missing DB)
            if (res.ok || res.status === 401 || res.status === 404 || res.status === 503) return;
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Timeout waiting for ${url}`);
}

async function startService(name: string, dir: string, command: string, args: string[], env: NodeJS.ProcessEnv, port: number) {
    console.log(`Starting ${name} on port ${port}...`);
    // Check if port is free
    const isFree = await checkPort(port);
    if (!isFree) {
        console.warn(`Port ${port} is already in use. Assuming service is already running.`);
        return null;
    }

    const child = spawn(command, args, {
        cwd: dir,
        env: { ...process.env, ...env },
        stdio: 'inherit',
        shell: true
    });

    child.on('error', (err) => {
        console.error(`${name} failed to start:`, err);
    });

    return child;
}

async function main() {
    const adminEnv = {
        PORT: String(ADMIN_PORT),
        NITRO_PORT: String(ADMIN_PORT),
        SYNC_API_KEY: SYNC_KEY,
        SUPABASE_URL: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
        SUPABASE_KEY: process.env.SUPABASE_KEY || 'dummy-key',
    };

    const engineEnv = {
        PORT: String(ENGINE_PORT),
        ADMIN_SERVICE_URL: `http://localhost:${ADMIN_PORT}/api/sync/stream`,
        ANALYTICS_SERVICE_URL: `http://localhost:${ADMIN_PORT}`,
        SYNC_API_KEY: SYNC_KEY
    };

    console.log("Starting services...");

    const admin = await startService('Admin Service', adminDir, 'npm', ['run', 'dev'], adminEnv, ADMIN_PORT);

    // Wait for Admin to be ready (it might take a while to build Nuxt)
    console.log("Waiting for Admin Service to be ready...");
    try {
        await waitForUrl(`http://localhost:${ADMIN_PORT}/api/health`, 60000);
        console.log("Admin Service is ready.");
    } catch (e) {
        console.error("Admin Service failed to respond in time.");
        // Continue anyway to see logs
    }

    const engine = await startService('Engine', engineDir, 'npm', ['run', 'dev'], engineEnv, ENGINE_PORT);

    console.log("Waiting for Engine to be ready...");
    try {
        await waitForUrl(`http://localhost:${ENGINE_PORT}/health`, 10000); // Engine usually faster
         console.log("Engine is ready.");
    } catch (e) {
         // Engine might not have /health endpoint exposed or it's different.
         console.log("Engine health check skipped or failed.");
    }

    // Keep alive
    const cleanup = () => {
        if (admin) admin.kill();
        if (engine) engine.kill();
        process.exit();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
