import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export class EngineController {
  private process: ChildProcess | null = null;
  private adminUrl: string;
  private analyticsUrl: string;
  public readonly port: number;

  constructor(adminUrl: string, analyticsUrl: string, port: number = 3000) {
    this.adminUrl = adminUrl;
    this.analyticsUrl = analyticsUrl;
    this.port = port;
  }

  public async start() {
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

    return new Promise<void>((resolve, reject) => {
      if (!this.process) return reject(new Error('Process failed to spawn'));

      let started = false;

      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          const str = data.toString();
          console.log(`[ENGINE]: ${str}`);

          // Wait for SSE connection to be established to ensure we don't miss initial updates
          if (str.includes('[SSE] Connected') && !started) {
            started = true;
            resolve();
          }
        });
      }

      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          console.error(`[ENGINE ERR]: ${data.toString()}`);
        });
      }

      setTimeout(() => {
        if (!started) {
           console.warn('[EngineController] Timeout waiting for Engine start message, proceeding anyway...');
           resolve();
        }
      }, 10000); // Increased timeout
    });
  }

  public async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
