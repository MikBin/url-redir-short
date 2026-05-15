import fs from 'fs';
import path from 'path';

const specsDir = path.resolve(__dirname, '../redir-engine/e2e-suite/specs');
const files = fs.readdirSync(specsDir).filter(f => f.endsWith('.test.ts'));

for (const file of files) {
  const filePath = path.join(specsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip T01 as it's already patched
  if (file === 'T01-boot-and-sync.test.ts') continue;

  console.log(`Patching ${file}...`);

  // 1. Ensure runtime variable is available
  if (!content.includes('const runtime =')) {
    content = content.replace(
      /engine = new EngineController\(/,
      "const runtime = (process.env.TEST_RUNTIME || 'node') as RuntimeType;\n    engine = new EngineController("
    );
  }

  // 2. Set engineUrl
  if (!content.includes('adminService.engineUrl =')) {
    content = content.replace(
      /await engine\.start\(\);/,
      "await engine.start();\n    adminService.engineUrl = `http://127.0.0.1:${engine.port}`;"
    );
  }

  // 3. Conditional waitForConnection
  content = content.replace(
    /await adminService\.waitForConnection\(15000\);/,
    `if (runtime === 'cf-worker') {
        console.log('[${file.split('.')[0]}] Worker runtime: skipping SSE connection wait');
    } else {
        await adminService.waitForConnection(15000);
    }`
  );

  fs.writeFileSync(filePath, content);
}
