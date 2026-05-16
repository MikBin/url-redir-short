// Inject mock environment variables for Vitest to prevent connection errors and missing credential crashes during Nuxt boot

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'dummy-supabase-key';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'dummy-supabase-service-key';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.VALKEY_URL = process.env.VALKEY_URL || 'redis://localhost:6379';
process.env.TEST_ENV = 'true';

process.env.NUXT_PUBLIC_SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
process.env.NUXT_PUBLIC_SUPABASE_KEY = process.env.NUXT_PUBLIC_SUPABASE_KEY || 'dummy-supabase-key';

// Make sure Nuxt's internal components see these keys as well if it reads them from config or env at boot
globalThis.process.env.SUPABASE_URL = process.env.SUPABASE_URL;
globalThis.process.env.SUPABASE_KEY = process.env.SUPABASE_KEY;

import { vi } from 'vitest';

vi.mock('ioredis', () => {
  const RedisMock = require('ioredis-mock')
  return {
    default: RedisMock,
    __esModule: true
  }
});
