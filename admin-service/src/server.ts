import { DatabaseAdapter } from './db/database_adapter';
import { PostgresAdapter } from './db/postgres_adapter';
// import { PocketBaseAdapter } from './db/pocketbase_adapter'; // Toggle as needed
import { SyncManager } from './sync_manager';

// Configuration
const DB_TYPE = process.env.DB_TYPE || 'postgres';
const PORT = process.env.PORT || 3000;

// Init dependencies
let db: DatabaseAdapter;

if (DB_TYPE === 'postgres') {
  db = new PostgresAdapter('postgres://user:pass@localhost:5432/db');
} else {
  // db = new PocketBaseAdapter('http://127.0.0.1:8090', 'secret');
  throw new Error('Unsupported DB_TYPE for this draft');
}

const syncManager = new SyncManager();

// Hook SyncManager into DB events
db.onRuleChange((change) => {
  // When DB changes (even from outside this app), push to Engines
  syncManager.broadcast({
    action: change.action,
    rule: change.rule,
    timestamp: new Date().toISOString()
  });
});

// Setup Server (Express/Hono/etc. - Abstracted for Draft)
// const app = express(); ...

console.log(`Admin Service starting on port ${PORT}...`);
console.log('Endpoints:');
console.log(' - POST /api/rules (Create Rule)');
console.log(' - GET  /sync/stream (SSE for Engines)');

/**
 * Placeholder API Handlers
 */
async function handleCreateRule(req: any, res: any) {
  const newRule = await db.createRule(req.body);
  // Manual broadcast if not relying solely on DB subscription
  syncManager.broadcast({
    action: 'create',
    rule: newRule,
    timestamp: new Date().toISOString()
  });
  res.json(newRule);
}

async function handleSyncStream(req: any, res: any) {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  syncManager.addClient(res);
}

// Start listener...
