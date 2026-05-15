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

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => {
  const mockClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  };
  return {
    createClient: vi.fn().mockReturnValue(mockClient),
    createBrowserClient: vi.fn().mockReturnValue(mockClient),
    createServerClient: vi.fn().mockReturnValue(mockClient)
  }
});

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => {
  const mockClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
       getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
       onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    }
  };
  return {
    createBrowserClient: vi.fn().mockReturnValue(mockClient),
    createServerClient: vi.fn().mockReturnValue(mockClient)
  }
});

// Mock #supabase/server auto-imports
vi.mock('#supabase/server', () => {
  const mockClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  };
  return {
    serverSupabaseClient: vi.fn().mockResolvedValue(mockClient),
    serverSupabaseServiceRole: vi.fn().mockResolvedValue(mockClient),
    serverSupabaseUser: vi.fn().mockResolvedValue({ id: 'dummy-user' })
  }
});
