# Custom Analytics Integration for Multi-Tenant Redirect Engine

## Overview

This document outlines the implementation of custom analytics integration for a multi-tenant redirect engine where each client can configure their own external analytics server while maintaining the existing built-in analytics system.

## Architecture

### Current System
- **Built-in Analytics**: `FireAndForgetCollector` sends data to `ANALYTICS_SERVICE_URL`
- **Data Collected**: Path, destination, timestamp, anonymized IP, user agent, referrer, status code
- **Configuration**: Single `ANALYTICS_SERVICE_URL` environment variable
- **Multi-tenant**: 1000+ clients with separate domains and link pools

### Proposed System
- **Dual Analytics**: Built-in + per-client custom analytics
- **Per-Client Configuration**: Each client configures their own analytics endpoint
- **Database-Driven**: Analytics configs stored in Supabase database
- **Caching**: Configurations cached for performance
- **Fallback**: Built-in analytics always available

## Database Schema

### New Table: `client_analytics`

```sql
-- Table: client_analytics
create table public.client_analytics (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users not null,
  analytics_url text not null,
  api_key text, -- Optional: for API key authentication
  headers jsonb default '{}', -- Custom headers (Authorization, etc.)
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(owner_id) -- One analytics config per client
);

-- Indexes for performance
create index idx_client_analytics_owner_id on public.client_analytics(owner_id);
create index idx_client_analytics_enabled on public.client_analytics(enabled);

-- RLS: Enable
alter table public.client_analytics enable row level security;

-- Policies: Client Analytics
create policy "Users can view their own analytics config"
on public.client_analytics for select
using (auth.uid() = owner_id);

create policy "Users can insert their own analytics config"
on public.client_analytics for insert
with check (auth.uid() = owner_id);

create policy "Users can update their own analytics config"
on public.client_analytics for update
using (auth.uid() = owner_id);

create policy "Users can delete their own analytics config"
on public.client_analytics for delete
using (auth.uid() = owner_id);

-- Realtime: Enable for admin interface
alter publication supabase_realtime add table public.client_analytics;
```

## Implementation Components

### 1. Client Analytics Configuration Interface

```typescript
interface ClientAnalyticsConfig {
  enabled: boolean;
  url: string;
  headers: Record<string, string>;
  apiKey?: string;
}
```

### 2. Client Analytics Provider

```typescript
class ClientAnalyticsProvider {
  private cache = new Map<string, { config: ClientAnalyticsConfig; expires: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor(private supabase: SupabaseClient) {}

  async getConfig(clientId: string): Promise<ClientAnalyticsConfig | null> {
    // Check cache first
    const cached = this.cache.get(clientId);
    if (cached && cached.expires > Date.now()) {
      return cached.config;
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from('client_analytics')
      .select('*')
      .eq('owner_id', clientId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Failed to fetch client analytics config:', error);
      return null;
    }

    if (!data || !data.enabled) {
      return null;
    }

    const config: ClientAnalyticsConfig = {
      enabled: data.enabled,
      url: data.analytics_url,
      headers: data.headers || {},
    };

    if (data.api_key) {
      config.headers['Authorization'] = `Bearer ${data.api_key}`;
    }

    // Cache the config
    this.cache.set(clientId, {
      config,
      expires: Date.now() + this.CACHE_TTL
    });

    return config;
  }

  clearCache(clientId: string): void {
    this.cache.delete(clientId);
  }
}
```

### 3. Custom Analytics Collector

```typescript
class CustomAnalyticsCollector implements AnalyticsCollector {
  constructor(
    private clientProvider: ClientAnalyticsProvider,
    private clientId: string
  ) {}

  async collect(payload: AnalyticsPayload): Promise<void> {
    const config = await this.clientProvider.getConfig(this.clientId);
    
    if (!config || !config.enabled) {
      return;
    }

    try {
      const response = await fetch(`${config.url}/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Custom analytics failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send custom analytics:', error);
    }
  }
}
```

### 4. Multi-Collector Pattern

```typescript
class MultiAnalyticsCollector implements AnalyticsCollector {
  constructor(
    private builtInCollector: AnalyticsCollector,
    private clientProvider: ClientAnalyticsProvider
  ) {}

  async collect(payload: AnalyticsPayload, clientId: string): Promise<void> {
    // Send to built-in analytics
    await this.builtInCollector.collect(payload);

    // Send to client's custom analytics
    const customCollector = new CustomAnalyticsCollector(this.clientProvider, clientId);
    await customCollector.collect(payload);
  }
}
```

### 5. Enhanced Handle Request Use Case

```typescript
export class HandleRequestUseCase {
  private radixTree: RadixTree;
  private cuckooFilter: CuckooFilter;
  private analyticsCollector?: MultiAnalyticsCollector;
  private clientProvider: ClientAnalyticsProvider;

  constructor(
    radixTree: RadixTree,
    cuckooFilter: CuckooFilter,
    analyticsCollector?: MultiAnalyticsCollector,
    clientProvider?: ClientAnalyticsProvider
  ) {
    this.radixTree = radixTree;
    this.cuckooFilter = cuckooFilter;
    this.analyticsCollector = analyticsCollector;
    this.clientProvider = clientProvider;
  }

  public async execute(
    path: string,
    headers: Headers,
    ip: string,
    originalUrl: string,
    passwordProvider?: () => Promise<string | undefined> | string | undefined
  ): Promise<HandleRequestResult> {
    // ... existing logic ...

    if (this.analyticsCollector && rule.owner_id) {
      // Async fire-and-forget analytics
      buildAnalyticsPayload(
        path,
        finalRule.destination,
        ip,
        headers,
        finalRule.code,
        originalUrl
      )
        .then((payload) => this.analyticsCollector?.collect(payload, rule.owner_id))
        .catch((err) => {
          console.error('Failed to collect analytics:', err);
        });
    }

    return { type: 'redirect', rule: finalRule };
  }
}
```

## Admin Interface Implementation

### 1. Analytics Settings Page

```vue
<!-- admin-service/supabase/app/pages/analytics-settings.vue -->
<template>
  <div class="analytics-settings">
    <h2>Custom Analytics Configuration</h2>
    
    <div class="config-form">
      <div class="form-group">
        <label>
          <input 
            type="checkbox" 
            v-model="config.enabled"
            @change="updateConfig"
          />
          Enable Custom Analytics
        </label>
      </div>

      <div v-if="config.enabled" class="form-fields">
        <div class="form-group">
          <label for="analytics-url">Analytics URL</label>
          <input 
            id="analytics-url"
            type="url" 
            v-model="config.url"
            placeholder="https://analytics.yourdomain.com/collect"
            @blur="updateConfig"
          />
        </div>

        <div class="form-group">
          <label for="api-key">API Key (Optional)</label>
          <input 
            id="api-key"
            type="password" 
            v-model="config.apiKey"
            placeholder="Enter your API key"
            @blur="updateConfig"
          />
        </div>

        <div class="form-group">
          <label>Custom Headers</label>
          <div v-for="(value, key) in config.headers" :key="key" class="header-row">
            <input 
              type="text" 
              v-model="config.headers[key]"
              :placeholder="key"
              @blur="updateConfig"
            />
            <button @click="removeHeader(key)">Remove</button>
          </div>
          <button @click="addHeader">Add Header</button>
        </div>

        <div class="form-group">
          <button @click="testConnection" :disabled="!config.enabled">
            Test Connection
          </button>
          <span v-if="testResult" :class="testResult.success ? 'success' : 'error'">
            {{ testResult.message }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient();
const user = useSupabaseUser();

const config = ref({
  enabled: false,
  url: '',
  apiKey: '',
  headers: {}
});

const testResult = ref(null);

onMounted(async () => {
  await loadConfig();
});

async function loadConfig() {
  const { data, error } = await supabase
    .from('client_analytics')
    .select('*')
    .eq('owner_id', user.value.id)
    .single();

  if (data) {
    config.value = {
      enabled: data.enabled,
      url: data.analytics_url,
      apiKey: data.api_key || '',
      headers: data.headers || {}
    };
  }
}

async function updateConfig() {
  const payload = {
    owner_id: user.value.id,
    analytics_url: config.value.url,
    api_key: config.value.apiKey || null,
    headers: config.value.headers,
    enabled: config.value.enabled
  };

  const { error } = await supabase
    .from('client_analytics')
    .upsert(payload, { onConflict: 'owner_id' });

  if (error) {
    console.error('Failed to update analytics config:', error);
  }
}

function addHeader() {
  const key = prompt('Enter header name:');
  if (key) {
    config.value.headers[key] = '';
    updateConfig();
  }
}

function removeHeader(key) {
  delete config.value.headers[key];
  updateConfig();
}

async function testConnection() {
  if (!config.value.enabled || !config.value.url) {
    testResult.value = { success: false, message: 'Please configure analytics URL first' };
    return;
  }

  try {
    const testPayload = {
      path: '/test',
      destination: 'https://example.com',
      timestamp: new Date().toISOString(),
      ip: 'test-ip',
      user_agent: 'test-agent',
      referrer: null,
      referrer_source: 'none',
      status: 302
    };

    const response = await fetch(`${config.value.url}/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.value.apiKey && { 'Authorization': `Bearer ${config.value.apiKey}` }),
        ...config.value.headers
      },
      body: JSON.stringify(testPayload)
    });

    testResult.value = {
      success: response.ok,
      message: response.ok ? 'Connection successful!' : `Failed: ${response.status} ${response.statusText}`
    };
  } catch (error) {
    testResult.value = {
      success: false,
      message: `Connection failed: ${error.message}`
    };
  }
}
</script>
```

## Security Considerations

### 1. URL Validation
```typescript
function validateAnalyticsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }
    
    // Prevent localhost/internal network access
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
```

### 2. Rate Limiting
```typescript
class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(private maxRequests: number = 100, private windowMs: number = 60000) {}

  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId) || [];
    
    // Remove old requests
    const recentRequests = clientRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);
    return true;
  }
}
```

### 3. Error Handling
```typescript
async function sendToCustomAnalytics(payload: AnalyticsPayload, config: ClientAnalyticsConfig): Promise<void> {
  try {
    const response = await fetch(`${config.url}/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    // Log error but don't fail the redirect
    console.error(`Custom analytics failed for client:`, error.message);
  }
}
```

## Deployment Configuration

### Environment Variables
```bash
# Built-in analytics (existing)
ANALYTICS_SERVICE_URL=http://localhost:3002

# Custom analytics settings
CUSTOM_ANALYTICS_ENABLED=true
CUSTOM_ANALYTICS_CACHE_TTL=600000  # 10 minutes
CUSTOM_ANALYTICS_RATE_LIMIT=100     # requests per minute
```

### Engine Initialization
```typescript
// redir-engine/runtimes/node/index.ts
import { ClientAnalyticsProvider } from '../../src/adapters/analytics/client-provider';
import { MultiAnalyticsCollector } from '../../src/adapters/analytics/multi-collector';

// Initialize client analytics provider
const clientProvider = new ClientAnalyticsProvider(supabaseClient);

// Initialize multi-collector
const multiCollector = new MultiAnalyticsCollector(analyticsCollector, clientProvider);

// Pass to handle request use case
const handleRequest = new HandleRequestUseCase(radixTree, cuckooFilter, multiCollector, clientProvider);
```

## Testing Strategy

### 1. Unit Tests
```typescript
// tests/adapters/analytics/client-provider.test.ts
describe('ClientAnalyticsProvider', () => {
  it('should fetch config from database', async () => {
    // Test database fetch
  });

  it('should cache configs', async () => {
    // Test caching behavior
  });

  it('should handle missing configs', async () => {
    // Test null/missing config handling
  });
});
```

### 2. Integration Tests
```typescript
// e2e-suite/specs/T14-custom-analytics.test.ts
describe('Custom Analytics Integration', () => {
  it('should send data to custom analytics endpoint', async () => {
    // Test custom analytics flow
  });

  it('should handle custom analytics failures gracefully', async () => {
    // Test error handling
  });

  it('should support multiple clients with different configs', async () => {
    // Test multi-tenant isolation
  });
});
```

## Migration Strategy

### Phase 1: Database Schema
1. Add `client_analytics` table to existing schema
2. Add RLS policies and indexes
3. Deploy database changes

### Phase 2: Backend Implementation
1. Implement client analytics provider
2. Create custom analytics collector
3. Update handle request use case
4. Add admin interface

### Phase 3: Frontend Implementation
1. Create analytics settings page
2. Add configuration form
3. Implement test connection functionality

### Phase 4: Testing & Deployment
1. Comprehensive testing
2. Gradual rollout to clients
3. Monitor performance and reliability

## Benefits

1. **Client Autonomy**: Each client controls their own analytics
2. **No Engine Restart**: Config changes take effect immediately
3. **Flexible Authentication**: Support for API keys, custom headers, etc.
4. **Performance**: Caching prevents database queries on every redirect
5. **Reliability**: Built-in analytics always works as fallback
6. **Security**: Proper validation and rate limiting
7. **Scalability**: Handles 1000+ clients efficiently

## Conclusion

This custom analytics integration provides a robust, secure, and scalable solution for multi-tenant redirect engines. Each client can configure their own analytics server while maintaining the reliability and performance of the built-in analytics system.