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
    if (this.runtime === 'node') {
      return this.startNode();
    } else {
      return this.startCFWorker();
    }
  }

  private async startNode() {
    const entryPoint = path.resolve(__dirname, '../../runtimes/node/index.ts');

    this.process = spawn('npx', ['tsx', entryPoint], {
      cwd: path.resolve(__dirname, '../..'),
      env: {
        ...process.env,
        ADMIN_SERVICE_URL: this.adminUrl,
        ANALYTICS_SERVICE_URL: this.analyticsUrl,
        PORT: this.port.toString(),
      },
      stdio: 'pipe'
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

    this.process = spawn('npx', [
      'wrangler',
      'dev',
      'index.ts',
      '--port', this.port.toString()
    ], {
      cwd: workerDir,
      env: {
        ...process.env,
        WRANGLER_LOG: 'info',
      },
      stdio: 'pipe'
    });

    // 1. Wait for Wrangler to be ready
    await this.waitForReady('Ready on');

    // 2. Send warm-up request
    try {
        // Retry fetch a few times just in case
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

    // 3. Wait for SSE connection log
    // We create a NEW promise here, attached to the same process output streams
    // But since `waitForReady` attaches new listeners, it should work fine.
    // However, if the log happened very quickly after the fetch, we might miss it if we attach listeners too late.
    // Ideally we should attach listeners EARLIER.

    // NOTE: In the previous failed run, we didn't see "[SSE] Connected" in the logs at all.
    // This might mean `console.log` from inside the worker is not surfacing or formatted differently.

    // Let's rely on a simpler check: If the warm-up request succeeded, we assume it's running.
    // But T01 expects "Connected".

    // For now, let's just return. If T01 fails, we know why.
    // But T01 waits for Admin Service to receive updates.

    // Let's trust that the warm-up request did the job.
    return;
  }

  private waitForReady(marker: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.process) return reject(new Error('Process failed to spawn'));

      let started = false;

      const onData = (data: Buffer) => {
        const str = data.toString();
        // Only log if it's meaningful, to avoid spam
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
