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

    // Using npx tsx to run the typescript file directly
    this.process = spawn('npx', ['tsx', entryPoint], {
      cwd: path.resolve(__dirname, '../..'), // Run from redir-engine root
      env: {
        ...process.env,
        ADMIN_SERVICE_URL: this.adminUrl,
        ANALYTICS_SERVICE_URL: this.analyticsUrl,
        PORT: this.port.toString(),
      },
      stdio: 'pipe' // Capture output
    });

    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        console.log(`[ENGINE]: ${data.toString()}`);
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        console.error(`[ENGINE ERR]: ${data.toString()}`);
      });
    }

    // Wait for engine to be ready (naive check for now, or just return)
    // Real implementation might poll health check
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  public async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
