import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export type RuntimeType = 'node' | 'cf-worker';

export class EngineController {
  private process: ChildProcess | null = null;
  private adminUrl: string;
  private analyticsUrl: string;
  public readonly port: number;
  private runtime: RuntimeType;

  constructor(adminUrl: string, analyticsUrl: string, port: number = 3000, runtime: RuntimeType = 'node') {
    this.adminUrl = adminUrl;
    this.analyticsUrl = analyticsUrl;
    this.port = port;
    this.runtime = runtime;
  }

  public async start() {
    console.log('[EngineController] start() called');
    if (this.runtime === 'node') {
      return this.startNode();
    } else {
      return this.startCFWorker();
    }
  }

  private async startNode() {
    const entryPoint = path.resolve(__dirname, '../../runtimes/node/index.ts');
    // Use local tsx to avoid npx overhead/issues
    const tsxPath = path.resolve(__dirname, '../../node_modules/.bin/tsx' + (process.platform === 'win32' ? '.cmd' : ''));

    console.log('[EngineController] Spawning node process using:', tsxPath);

    this.process = spawn(tsxPath, [entryPoint], {
      cwd: path.resolve(__dirname, '../..'),
      env: {
        ...process.env,
        ADMIN_SERVICE_URL: this.adminUrl,
        ANALYTICS_SERVICE_URL: this.analyticsUrl,
        PORT: this.port.toString(),
      },
      stdio: 'pipe',
      shell: true
    });

    return this.waitForReady('[SSE] Connected');
  }

  private async startCFWorker() {
    const workerDir = path.resolve(__dirname, '../../runtimes/cf-worker');

    const devVarsPath = path.join(workerDir, '.dev.vars');
    const devVarsContent = `
ADMIN_SERVICE_URL=${this.adminUrl}
ANALYTICS_SERVICE_URL=${this.analyticsUrl}
`;
    fs.writeFileSync(devVarsPath, devVarsContent);

    // Use wrangler from node_modules
    const wranglerPath = path.resolve(__dirname, '../../node_modules/.bin/wrangler' + (process.platform === 'win32' ? '.cmd' : ''));

    console.log('[EngineController] Spawning wrangler process using:', wranglerPath);

    // On Windows, use cmd.exe to run .cmd files directly; on Unix, use node to respect shebang
    const useNode = process.platform !== 'win32';
    const args = useNode ? [wranglerPath] : [];
    
    if (useNode) {
      args.push('dev', 'index.ts', '--port', this.port.toString(), '--ip', '127.0.0.1');
    } else {
      args.push('/c', wranglerPath, 'dev', 'index.ts', '--port', this.port.toString(), '--ip', '127.0.0.1');
    }

    this.process = spawn(useNode ? 'node' : 'cmd.exe', args, {
      cwd: workerDir,
      env: {
        ...process.env,
        WRANGLER_LOG: 'info',
        CI: 'true', // Disable interactivity
        WRANGLER_SEND_METRICS: 'false'
      },
      stdio: 'pipe',
      shell: false
    });

    // 1. Wait for Wrangler to be ready
    await this.waitForReady('Ready on');

    // 2. Send warm-up request
    try {
        for (let i = 0; i < 5; i++) {
            try {
                await fetch(`http://localhost:${this.port}/health`);
                break;
            } catch (e) {
                await new Promise(r => setTimeout(r, 200));
            }
        }
    } catch (e) {
        // ignore
    }
    return;
  }

  private waitForReady(marker: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.process) return reject(new Error('Process failed to spawn'));

      let started = false;

      const onData = (data: Buffer) => {
        const str = data.toString();
        // Log output for debugging
        if (str.trim().length > 0) {
            console.log(`[ENGINE ${this.runtime}]: ${str.trim()}`);
        }

        if (str.includes(marker) && !started) {
          started = true;
          resolve();
        }
      };

      if (this.process.stdout) {
        this.process.stdout.on('data', onData);
      }

      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
             const str = data.toString();
             console.error(`[ENGINE ${this.runtime} ERR]: ${str.trim()}`);
             if (str.includes(marker) && !started) {
                started = true;
                resolve();
             }
        });
      }

      setTimeout(() => {
        if (!started) {
           console.warn(`[EngineController] Timeout waiting for '${marker}', proceeding anyway...`);
           resolve();
        }
      }, 20000);
    });
  }

  public async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
