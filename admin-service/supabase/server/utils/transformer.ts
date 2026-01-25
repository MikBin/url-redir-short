// Type definitions locally to avoid external dependency issues in this monorepo structure
export interface RedirectRule {
  id: string;
  path: string;
  destination: string;
  code: 301 | 302;

  // Phase 3: Advanced Logic
  ab_testing?: {
    enabled: boolean;
    variations: Array<{
      id: string;
      destination: string;
      weight: number; // 0-100 or ratio
    }>;
  };

  targeting?: {
    enabled: boolean;
    rules: Array<{
      id: string;
      target: 'language' | 'device' | 'country';
      value: string; // e.g., "en-US", "mobile", "US"
      destination: string;
    }>;
  };

  hsts?: {
    enabled: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };

  // Phase 4: Extended Features
  password_protection?: {
    enabled: boolean;
    password: string;
  };

  // Expiration Logic
  expiresAt?: number;
  maxClicks?: number;
}

export interface SupabaseLink {
  id: string;
  slug: string;
  destination: string;
  is_active?: boolean;
  targeting?: any;
  ab_testing?: any;
  hsts?: any;
  password_protection?: any;
  expires_at?: string | null;
  max_clicks?: number | null;
  created_at?: string;
  updated_at?: string;
  owner_id?: string;
  domain_id?: string | null;
}

export function transformLink(link: SupabaseLink): RedirectRule {
  // Ensure path starts with /
  let path = link.slug;
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const rule: RedirectRule = {
    id: link.id,
    path: path,
    destination: link.destination,
    code: 301, // Default to 301 as schema does not support status_code yet
  };

  if (link.targeting) {
    rule.targeting = link.targeting;
  }

  if (link.ab_testing) {
    rule.ab_testing = link.ab_testing;
  }

  if (link.hsts) {
    rule.hsts = link.hsts;
  }

  if (link.password_protection) {
    rule.password_protection = link.password_protection;
  }

  if (link.expires_at) {
    const date = new Date(link.expires_at);
    if (!isNaN(date.getTime())) {
      rule.expiresAt = date.getTime();
    }
  }

  if (link.max_clicks !== undefined && link.max_clicks !== null) {
    rule.maxClicks = link.max_clicks;
  }

  return rule;
}
